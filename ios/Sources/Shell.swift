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
//  runnable from file:// and from GitHub Pages.

import UIKit
import WebKit

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

    private static let mimeTypes: [String: String] = [
        "html": "text/html; charset=utf-8",
        "js":   "text/javascript; charset=utf-8",
        "css":  "text/css; charset=utf-8",
        "json": "application/json; charset=utf-8",
        "svg":  "image/svg+xml",
        "png":  "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg",
        "woff2": "font/woff2", "woff": "font/woff", "ttf": "font/ttf",
    ]

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
                                   expectedContentLength: data.count, textEncodingName: nil)
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

        // (3) No rubber-band, and no automatic inset juggling — the page handles the safe area itself
        // through env(safe-area-inset-*), which only reports correctly if the web view is edge to edge.
        webView.scrollView.bounces = false
        webView.scrollView.alwaysBounceVertical = false
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
