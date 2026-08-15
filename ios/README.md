# SIDELINE on iPhone

A native iOS app around the same `index.html`. No Swift to write, no npm, no CocoaPods, no Mac.

Three files are the whole shell:

| File | What it is |
|---|---|
| `project.yml` | XcodeGen spec — the `.xcodeproj` is **generated**, never committed |
| `Sources/Shell.swift` | The entire app: a WKWebView, a URL-scheme handler, two JS bridges |
| `Resources/Assets.xcassets` | App icon + the launch-screen colour |

`index.html` is referenced in place from the repo root. There is no `www/` staging directory and no
copy step — edit the game, rebuild, done.

---

## Why a shell at all

Three of these are impossible from inside a web page on iOS, which is the entire argument for
wrapping rather than shipping a PWA:

- **Zoom.** iOS Safari has ignored `user-scalable=no` since iOS 10 as an accessibility policy, so a
  page cannot stop pinch and double-tap zoom however it writes its viewport meta. In a WKWebView the
  scroll view belongs to us and is pinned shut.
- **Origin.** A career is ~1.4 MB of `localStorage`, and storage is keyed to origin. The page is
  served over a custom `sideline://` scheme rather than `file://`, which gives it a real, stable,
  secure origin — so saves survive app updates and `navigator.clipboard` works.
- **Bounce.** Phase 61 switched rubber-band off outright, calling it the strongest "this is a web
  page" tell. **Phase 61.2 put it back**, because that is true in *Safari* — where the bounce exposes
  the browser behind the page — and false here: this is a real `UIScrollView` over a background that
  matches the page, so a bounce exposes the app's own colour, and every native list on the platform
  bounces. `alwaysBounceVertical` stays off, which is the half worth keeping: a screen whose content
  does not fill the frame should not wobble.
- **`a.download` is inert** in a WKWebView, which is how the blank-roster-template button came to
  silently do nothing. It goes through the share sheet now.

---

## Getting the app onto your phone (from Windows)

## On a Mac (the fast path)

```sh
brew install xcodegen
cd ios && xcodegen generate     # or: npm run ios:project
open Sideline.xcodeproj
```

Plug the iPhone in, pick it as the run destination, ⌘R. Xcode signs with your Apple ID and installs
directly — no CI, no artifact, no AltStore/Sideloadly in the loop. Signing settings are deliberately
**not** in `project.yml`, so the project behaves like any normal one: Signing & Capabilities →
*Automatically manage signing* → pick your Personal Team.

**Set a bundle ID that is yours** — if you forked this, it is the one line you must change.
`PRODUCT_BUNDLE_IDENTIFIER` is `com.ajholloway.sideline` in `project.yml`; change it and regenerate.
Apple requires bundle IDs to be globally unique even under free provisioning, so somebody else's ID
fails at signing with a misleading error. Do this **once, before the first install**: the bundle ID
identifies the app's container, so changing it later strands the saves inside the old one.

**Debug or Release?** ⌘R installs a **Debug** build, which contains the `DevBridge` automation
listener. It binds `127.0.0.1`, so nothing off the phone can reach it. For a build you keep on your
phone, switch the scheme to Release — Product → Scheme → Edit Scheme → Run → Build Configuration →
*Release* — which is what CI archives and carries no byte of the bridge.

**A free Apple ID expires the signature after 7 days.** The app then refuses to launch until you ⌘R
again. Your saves survive that, because they belong to the container and the container survives
anything short of deleting the app.

**Turn on Web Inspector** — the single biggest reason to use a Mac here. `Shell.swift` sets
`isInspectable = true`, so:

1. iPhone → Settings → Safari → Advanced → **Web Inspector** on
2. Mac Safari → Settings → Advanced → **Show features for web developers**
3. With the app running: Safari → Develop → *[your iPhone]* → **Sideline**

That is a full JS console, debugger and element inspector against the live app on the phone. Without
it you are debugging the WKWebView blind.

The **iOS Simulator** works too (⌘R with a simulated device) — good enough for layout and the bounce
behaviour. Pinch is Option-drag there, and haptics don't fire, so the zoom lock and the taptics still
want a real device.

---

## From Windows (no Mac)

Compiling needs macOS + Xcode. **Signing** needs your Apple ID. Only the first belongs in CI, and
that split is what makes this work without a Mac.

1. **Push, or run the workflow by hand** — Actions → *iOS ipa* → Run workflow. ~5 minutes.
2. **Download the artifact** — the run page → Artifacts → `sideline-ipa` → unzip → `sideline-unsigned.ipa`.
   Artifacts expire after 90 days; re-run the workflow for a fresh one.
3. **Sign and install it** with [Sideloadly](https://sideloadly.io) (simplest — one app, but needs
   iTunes from apple.com, *not* the Microsoft Store build), or [SideStore](https://sidestore.io) /
   AltStore. They re-sign with your Apple ID on the way in; any signature CI applied would just be
   stripped and redone, which is why there are no certificates or secrets in the workflow.

On a **free** Apple ID the install expires after 7 days and you may hold 3 sideloaded apps at once.
SideStore refreshes the signature on-device from the same `.ipa`; from a Mac it's just ⌘R again. A
paid account ($99/yr) removes both limits.

---

## Testing how it feels

Two loops, neither of them a gate. Both put the game into a named state and take a picture, so a
change to how the app FEELS can be checked without a phone in your hand.

```sh
npm run ios:web     # real WebKit at iPhone metrics — ~30s for every screen, no Xcode
npm run ios:sim     # the native shell on a booted simulator — the truth
```

| | `ios:web` | `ios:sim` |
|---|---|---|
| Engine | Playwright WebKit | the real WKWebView |
| Needs | `npx playwright install webkit` | Xcode + a simulator runtime |
| Speed | ~30 s, all screens | ~2 min with a build |
| Answers | layout, overflow, tap-target size, font metrics | plus origin, safe-area insets, zoom lock, bounce, the bridges |

`tools/ios/scenarios.js` holds the screen list **and the audit**, shared by both drivers and by the
`qa` gate, so a difference between the two sets of shots is a difference in the **engine** and never
in the setup. Shots land in `test/shots/iphone/`. Each line reads:

```
roster   overflow    0px   under-44pt   0/13    press  13/13
```

- **overflow** — how far the page scrolls sideways. Anything but 0 is a bug.
- **under-44pt** — controls whose *tappable* height is under Apple's minimum, out of those measured.
  Measured by **hit testing**, not by the bounding box: the box is what a control paints, the target
  is what the finger gets, and a pseudo-element may legitimately extend one past the other. Controls
  the probe cannot measure — clipped by the screen edge, or half under the fixed tab bar — are
  excluded rather than counted, because a scroll position is not a design defect.
- **press** — controls a `:active` rule answers. The tap highlight is deliberately suppressed, so a
  control without one gives the finger **nothing at all**, and a screenshot cannot show it.

**How `ios:sim` drives the app.** `simctl` can screenshot a simulator but it cannot tap one. So
`Shell.swift` carries a `DevBridge` — a loopback HTTP listener that runs JavaScript inside the live
web view. A simulator process shares the host loopback, so a POST from the command line reaches the
app. Three things keep it out of the product: `#if DEBUG` (CI archives Release), it binds `127.0.0.1`
by name, and it adds **no** JavaScript API, so no game code can come to depend on it.

```sh
npm run ios:sim -- build                       # build, install, launch, stop
npm run ios:sim -- eval 'return S.week'        # run JS in the app
npm run ios:sim -- shot rivals                 # screenshot what is on screen
npm run ios:sim -- --keep                      # skip the build, drive what is running
```

**If the build fails on the asset catalog** with `No simulator runtime version … available to use
with iphonesimulator SDK version`, then Xcode updated ahead of its simulator runtimes. Fix it once:

```sh
xcodebuild -downloadPlatform iOS
```

---

## Changing things

| Want to | Do |
|---|---|
| Change the app icon | Replace `Resources/Assets.xcassets/AppIcon.appiconset/icon-1024.png` (1024×1024, **no alpha**), or edit + rerun `npm run ios:icon` |
| Run on iPad too | `TARGETED_DEVICE_FAMILY: "1,2"` in `project.yml` |
| Allow landscape | Add `UIInterfaceOrientationLandscapeLeft`/`Right` to `UISupportedInterfaceOrientations` |
| Add a native capability | A `WKScriptMessageHandler` case in `Shell.swift`. If you need a value back, use `WKScriptMessageHandlerWithReply` — `postMessage` then returns a real JS Promise |

**Don't change `Shell.scheme`.** It is the page's origin, and changing it orphans every
`localStorage` save on every device that already has the app.

---

## What the web layer knows about the shell

`Shell.swift` injects `window.__SIDELINE_NATIVE__ = true` at document start. `index.html` uses it to
pick native paths over web fallbacks that don't work here — `nativeHaptic()` and the file-save
bridge. Everything is guarded, so the same file still runs from `file://` and from GitHub Pages with
no shell at all.
