//  Shell.swift — the whole iOS app.
//
//  SIDELINE is one self-contained index.html. This file is the native shell around it and nothing
//  more: it hosts a WKWebView, serves the bundled page over a custom URL scheme, and does the four
//  things a web page cannot do for itself on iOS. There is deliberately no framework here (no
//  Capacitor, no CocoaPods, no npm) — the app needs five native capabilities, not a platform.
//
//  What the shell exists to fix, in order of how much it matters:
//
//  1. ORIGIN. The save system is keyed to origin and a career is ~1.4MB of localStorage. Loading the
//     page with loadFileURL() gives it an opaque file:// origin where WebKit's storage behaviour is
//     unreliable, so the page is served over a custom scheme instead (see BundleSchemeHandler).
//     WKWebView treats a registered custom scheme as a real, secure, STABLE origin — which means
//     saves survive app updates, and window.isSecureContext is true so navigator.clipboard works.
//  2. ZOOM. iOS Safari has ignored `user-scalable=no` since iOS 10 as an accessibility policy, so a
//     web page cannot stop double-tap and pinch zoom no matter what it puts in its viewport meta.
//     In a WKWebView the scroll view is ours, so it is pinned shut three ways below.
//  3. BOUNCE. The rubber-band overscroll is the single strongest "this is a web page" tell.
//  4. HAPTICS + FILE SAVE. Two small JS bridges. `a.download` is inert in a WKWebView, which is how
//     the blank-roster-template button silently did nothing.
//
//  Everything else — layout, state, the entire game — stays in index.html, unchanged and still
//  runnable from file:// and from any static server. The shell is how the game SHIPS, never a
//  dependency of it: the test gate drives the same file in headless Chromium with no shell at all.

import UIKit
import WebKit
#if DEBUG
import Network
#endif

enum Shell {
    /// Registered with WKWebView as a custom scheme. Changing this string changes the page's origin,
    /// which orphans every localStorage save on every device that already has the app. Don't.
    static let scheme = "sideline"
    static let pageURL = URL(string: "\(scheme)://local/index.html")!
    /// --bg from the stylesheet. Used for the window, the view and the web view so there is no white
    /// flash anywhere between the launch screen and the page's first paint.
    static let background = UIColor(red: 0x0d / 255.0, green: 0x0f / 255.0, blue: 0x12 / 255.0, alpha: 1)
}

// MARK: - Serving the bundle

/// Serves the app bundle over `sideline://`. index.html has no external references (fonts are
/// embedded base64), so in practice this answers exactly one request — but it resolves any bundled
/// resource so that adding a real asset later doesn't need native changes.
final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {

    /// BARE types, with no `; charset=` parameter on any of them.
    ///
    /// `URLResponse.mimeType` takes the type alone; the encoding belongs in `textEncodingName`.
    /// Passing "text/html; charset=utf-8" here does not fail — WebKit simply does not recognise it
    /// as HTML, falls back to plain text, and renders the whole game as a `<pre>` of its own source.
    /// The app still launches, still shows something, and is completely dead.
    private static let mimeTypes: [String: String] = [
        "html": "text/html",
        "js":   "text/javascript",
        "css":  "text/css",
        "json": "application/json",
        "svg":  "image/svg+xml",
        "png":  "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg",
        "woff2": "font/woff2", "woff": "font/woff", "ttf": "font/ttf",
    ]

    /// Text types need an encoding, and the page declares UTF-8. Handing it over here rather than
    /// letting WebKit guess keeps the em dashes and the curly quotes the design leans on.
    private static let textTypes: Set<String> = ["text/html", "text/javascript", "text/css",
                                                 "application/json", "image/svg+xml"]

    /// A task that has been stopped must not be messaged again — doing so throws an ObjC exception
    /// that takes the app with it. Serving is synchronous so this is belt-and-braces.
    private var stopped = Set<ObjectIdentifier>()

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        let id = ObjectIdentifier(task)
        guard let root = Bundle.main.resourceURL else { return fail(task, id, "no resource bundle") }

        var rel = task.request.url?.path ?? "/"
        if rel.isEmpty || rel == "/" { rel = "/index.html" }
        rel.removeFirst()

        let file = root.appendingPathComponent(rel).standardizedFileURL
        // Refuse anything that escapes the bundle, however it was spelled.
        guard file.path.hasPrefix(root.standardizedFileURL.path),
              let data = try? Data(contentsOf: file) else {
            return fail(task, id, "not found: \(rel)")
        }

        let mime = Self.mimeTypes[file.pathExtension.lowercased()] ?? "application/octet-stream"
        let response = URLResponse(url: task.request.url!, mimeType: mime,
                                   expectedContentLength: data.count,
                                   textEncodingName: Self.textTypes.contains(mime) ? "utf-8" : nil)
        guard !stopped.contains(id) else { return }
        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {
        stopped.insert(ObjectIdentifier(task))
    }

    private func fail(_ task: WKURLSchemeTask, _ id: ObjectIdentifier, _ why: String) {
        guard !stopped.contains(id) else { return }
        task.didFailWithError(NSError(domain: "Sideline", code: 404,
                                      userInfo: [NSLocalizedDescriptionKey: why]))
    }
}

// MARK: - The one view controller

final class ShellViewController: UIViewController {

    private var webView: WKWebView!
    #if DEBUG
    private var devBridge: DevBridge?
    #endif

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = Shell.background

        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(BundleSchemeHandler(), forURLScheme: Shell.scheme)
        config.websiteDataStore = .default()          // persistent: this is where the saves live
        config.allowsInlineMediaPlayback = true
        config.userContentController.add(self, name: "haptics")
        config.userContentController.add(self, name: "saveFile")
        // Tell the page it is running inside the shell, before any of its own script runs, so it can
        // prefer the native bridges over the web fallbacks that don't work here. The gesture block is
        // the web half of (2): WebKit raises `gesturestart` for a pinch, and refusing it here means
        // the zoom lock does not rest solely on the scroll-view delegate below.
        config.userContentController.addUserScript(WKUserScript(
            source: """
                window.__SIDELINE_NATIVE__ = true;
                document.addEventListener('gesturestart', function (e) { e.preventDefault(); }, { passive: false });
                """,
            injectionTime: .atDocumentStart, forMainFrameOnly: true))

        webView = WKWebView(frame: view.bounds, configuration: config)
        webView.navigationDelegate = self
        webView.allowsBackForwardNavigationGestures = false   // it's a single-page app; swipe-back is wrong
        webView.isOpaque = false
        webView.backgroundColor = Shell.background
        webView.scrollView.backgroundColor = Shell.background

        // (2) Zoom, shut three ways: the scale clamp, refusing to nominate a view to zoom, and a
        // delegate that snaps back if anything still manages to move it.
        webView.scrollView.minimumZoomScale = 1
        webView.scrollView.maximumZoomScale = 1
        webView.scrollView.bouncesZoom = false
        webView.scrollView.delegate = self

        // (3) Rubber-band, but only where a native app would have it.
        //
        // Phase 61 switched bouncing off outright, on the grounds that it is the strongest "this is a
        // web page" tell. That is true in SAFARI, where the bounce exposes the browser behind the
        // page. It is not true here: this is a real UIScrollView over a background that matches the
        // page, so a bounce exposes the app's own colour — and every native list on the platform
        // bounces. Switching it off is what made a long roster stop dead at the end, which is the
        // thing that actually feels wrong.
        // `alwaysBounceVertical` stays FALSE, and that is the half worth keeping: a screen whose
        // content does not fill the frame should not wobble.
        webView.scrollView.bounces = true
        webView.scrollView.alwaysBounceVertical = false
        // No automatic inset juggling — the page handles the safe area itself through
        // env(safe-area-inset-*), which only reports correctly if the web view is edge to edge.
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.showsVerticalScrollIndicator = false

        if #available(iOS 16.4, *) { webView.isInspectable = true }   // Safari Web Inspector over USB

        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        // Pinned to the view, NOT the safe area layout guide: edge to edge is what makes
        // viewport-fit=cover and the page's own env(safe-area-inset-bottom) padding work.
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])

        webView.load(URLRequest(url: Shell.pageURL))

        // Debug builds only. See DevBridge for why it exists and why it cannot ship.
        #if DEBUG
        devBridge = DevBridge(webView: webView)
        devBridge?.start()
        #endif
    }

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .portrait }
}

// MARK: - Zoom refusal

extension ShellViewController: UIScrollViewDelegate {
    func viewForZooming(in scrollView: UIScrollView) -> UIView? { nil }
    func scrollViewDidZoom(_ scrollView: UIScrollView) {
        if scrollView.zoomScale != 1 { scrollView.zoomScale = 1 }
    }
}

// MARK: - Navigation policy

extension ShellViewController: WKNavigationDelegate {
    /// The game never navigates away from itself. Anything that tries is a real outbound link, so it
    /// belongs in Safari rather than replacing the app with a web page it can't come back from.
    func webView(_ webView: WKWebView,
                 decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { return decisionHandler(.cancel) }
        if url.scheme == Shell.scheme { return decisionHandler(.allow) }
        if url.scheme == "http" || url.scheme == "https" || url.scheme == "mailto" {
            UIApplication.shared.open(url)
        }
        decisionHandler(.cancel)
    }
}

// MARK: - The two bridges

extension ShellViewController: WKScriptMessageHandler {
    func userContentController(_ controller: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        switch message.name {
        case "haptics": fireHaptic(String(describing: message.body))
        case "saveFile": presentSaveSheet(message.body)
        default: break
        }
    }

    /// (4a) Haptics. Fire-and-forget — nothing to hand back, so this stays the simple form.
    private func fireHaptic(_ kind: String) {
        switch kind {
        case "light":   UIImpactFeedbackGenerator(style: .light).impactOccurred()
        case "medium":  UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        case "heavy":   UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
        case "select":  UISelectionFeedbackGenerator().selectionChanged()
        case "success": UINotificationFeedbackGenerator().notificationOccurred(.success)
        case "warning": UINotificationFeedbackGenerator().notificationOccurred(.warning)
        case "error":   UINotificationFeedbackGenerator().notificationOccurred(.error)
        default: break
        }
    }

    /// (4b) File save. `URL.createObjectURL` + `a.download` is inert in a WKWebView, which is how the
    /// blank-roster-template button came to silently do nothing. The page hands over {name, text}
    /// and gets the system share sheet, which can write to Files, Mail, AirDrop, anywhere.
    private func presentSaveSheet(_ body: Any) {
        guard let dict = body as? [String: Any],
              let name = dict["name"] as? String,
              let text = dict["text"] as? String else { return }

        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent(name.isEmpty ? "sideline.json" : name)
        guard (try? text.write(to: url, atomically: true, encoding: .utf8)) != nil else { return }

        let sheet = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        // Required on iPad, harmless on iPhone.
        sheet.popoverPresentationController?.sourceView = view
        sheet.popoverPresentationController?.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY,
                                                                 width: 0, height: 0)
        present(sheet, animated: true)
    }
}

// MARK: - Dev bridge (debug builds only)

#if DEBUG
/// A loopback HTTP listener that runs JavaScript inside the live web view.
///
/// It exists for one reason. `simctl` can screenshot a booted simulator, but it cannot tap one. So
/// without a bridge there is no way to drive the shell from a script, and every change to how the
/// app FEELS has to be checked by hand on a device. With it, a tool puts the game into any state,
/// reads `S` and `UI` back, and screenshots the result — the same closed loop the browser gates
/// already have, but against the real WKWebView.
///
/// Three properties keep it out of the product:
///  1. `#if DEBUG` fences the whole file section. `npm run ios:deploy` builds Release, so no byte of
///     this reaches the phone. Deleting the fence is the only way to ship it.
///  2. It binds 127.0.0.1 by name. It is unreachable from another machine, and macOS raises no
///     "accept incoming connections" prompt.
///  3. It adds no JavaScript API and no user script. The page cannot detect it, so no game code can
///     come to depend on it — the same rule the two real bridges follow.
final class DevBridge {

    /// Fixed, so a driver script needs no discovery step. A busy port turns the bridge off rather
    /// than picking another one, because a silent second port is worse than no bridge.
    static let port: UInt16 = 8787

    private var listener: NWListener?
    private weak var webView: WKWebView?

    init(webView: WKWebView) { self.webView = webView }

    func start() {
        guard let port = NWEndpoint.Port(rawValue: Self.port) else { return }
        let params = NWParameters.tcp
        params.allowLocalEndpointReuse = true
        params.requiredLocalEndpoint = NWEndpoint.hostPort(host: "127.0.0.1", port: port)
        guard let listener = try? NWListener(using: params) else {
            NSLog("[DevBridge] port \(Self.port) is busy — bridge is off")
            return
        }
        listener.newConnectionHandler = { [weak self] conn in
            conn.start(queue: .main)
            self?.receive(conn, buffer: Data())
        }
        listener.start(queue: .main)
        self.listener = listener
        NSLog("[DevBridge] listening on http://127.0.0.1:\(Self.port)")
    }

    // MARK: Reading a request

    /// A body arrives in as many TCP chunks as the sender likes, so `Content-Length` is the only
    /// reliable end marker. Keep reading until the buffer holds the headers AND the whole body.
    private func receive(_ conn: NWConnection, buffer: Data) {
        conn.receive(minimumIncompleteLength: 1, maximumLength: 1 << 22) { [weak self] chunk, _, done, error in
            guard let self else { return conn.cancel() }
            guard error == nil else { return conn.cancel() }

            var buf = buffer
            if let chunk { buf.append(chunk) }

            guard let (head, body) = Self.split(buf), body.count >= Self.contentLength(head) else {
                if done { conn.cancel() } else { self.receive(conn, buffer: buf) }
                return
            }
            self.handle(conn, head: head, body: Data(body.prefix(Self.contentLength(head))))
        }
    }

    /// Splits a raw request at the blank line. Returns the header block and the body that follows.
    private static func split(_ buf: Data) -> (String, Data)? {
        guard let r = buf.range(of: Data("\r\n\r\n".utf8)) else { return nil }
        return (String(decoding: buf[..<r.lowerBound], as: UTF8.self), buf[r.upperBound...])
    }

    /// Foundation's `components(separatedBy:)`, and NOT `split(separator: "\n")`.
    ///
    /// Swift counts CR LF as ONE Character, because it is one extended grapheme cluster. So a split
    /// on the Character "\n" matches nothing at all in a CRLF request and hands back the whole
    /// header block as a single line — which reads as "no Content-Length", truncates every body to
    /// zero bytes, and makes every call return null with no error anywhere. The stdlib split that
    /// takes a multi-character separator would also work, but it needs iOS 16 and this app targets 15.
    private static func headerLines(_ head: String) -> [String] {
        head.components(separatedBy: "\n").map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
    }

    private static func contentLength(_ head: String) -> Int {
        for line in headerLines(head) {
            let parts = line.split(separator: ":", maxSplits: 1)
            guard parts.count == 2, parts[0].lowercased() == "content-length" else { continue }
            return Int(parts[1].trimmingCharacters(in: .whitespacesAndNewlines)) ?? 0
        }
        return 0
    }

    // MARK: Answering it

    private func handle(_ conn: NWConnection, head: String, body: Data) {
        let path = Self.headerLines(head).first?
            .split(separator: " ").dropFirst().first.map(String.init) ?? "/"

        if path.hasPrefix("/ping") {
            return reply(conn, #"{"ok":true,"bridge":"sideline"}"#)
        }
        // Hands back what the parser actually made of the request. The one tool that tells you
        // whether a null answer came from the JavaScript or from this file.
        if path.hasPrefix("/echo") {
            return reply(conn, "{\"ok\":true,\"bytes\":\(body.count),"
                + "\"length\":\(Self.contentLength(head)),"
                + "\"head\":\(Self.jsonString(head)),"
                + "\"body\":\(Self.jsonString(String(decoding: body, as: UTF8.self)))}")
        }
        guard path.hasPrefix("/eval") else {
            return reply(conn, #"{"ok":false,"error":"unknown path"}"#, status: "404 Not Found")
        }
        eval(String(decoding: body, as: UTF8.self)) { [weak self] json in
            self?.reply(conn, json)
        }
    }

    /// `callAsyncJavaScript` rather than `evaluateJavaScript`, so the caller can `await` — advancing
    /// a week and then waiting for the render both matter. The wrapper returns ONE JSON string, so
    /// every value comes back on a single path and Swift maps no types at all.
    private func eval(_ js: String, done: @escaping (String) -> Void) {
        guard let webView else { return done(#"{"ok":false,"error":"no web view"}"#) }
        let wrapped = """
        try {
          const value = await (async () => { \(js)
          })();
          return JSON.stringify({ ok: true, value: value === undefined ? null : value });
        } catch (e) {
          return JSON.stringify({ ok: false, error: String((e && e.message) || e) });
        }
        """
        webView.callAsyncJavaScript(wrapped, arguments: [:], in: nil, in: .page) { result in
            switch result {
            case .success(let value):
                // The wrapper always resolves to a JSON string. Anything else is a bug HERE, so say
                // so rather than reporting a successful null and sending the caller hunting in JS.
                done(value as? String
                     ?? "{\"ok\":false,\"error\":\(Self.jsonString("bridge returned \(type(of: value)): \(value)"))}")
            case .failure(let error):
                done("{\"ok\":false,\"error\":\(Self.jsonString(error.localizedDescription))}")
            }
        }
    }

    private func reply(_ conn: NWConnection, _ json: String, status: String = "200 OK") {
        let body = Data(json.utf8)
        let head = "HTTP/1.1 \(status)\r\n"
            + "Content-Type: application/json\r\n"
            + "Content-Length: \(body.count)\r\n"
            + "Connection: close\r\n\r\n"
        var out = Data(head.utf8)
        out.append(body)
        conn.send(content: out, completion: .contentProcessed { _ in conn.cancel() })
    }

    /// Quotes and escapes a string the way JSON needs. Only an error message goes through here.
    private static func jsonString(_ s: String) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: [s]) else { return "\"\"" }
        return String(String(decoding: data, as: UTF8.self).dropFirst().dropLast())
    }
}
#endif

// MARK: - Entry point

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let window = UIWindow(frame: UIScreen.main.bounds)
        window.backgroundColor = Shell.background
        window.rootViewController = ShellViewController()
        window.makeKeyAndVisible()
        self.window = window
        return true
    }
}
