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
- **Bounce.** The rubber-band overscroll is the strongest "this is a web page" tell there is.
- **`a.download` is inert** in a WKWebView, which is how the blank-roster-template button came to
  silently do nothing. It goes through the share sheet now.

---

## Getting the app onto your phone (from Windows)

Compiling needs macOS + Xcode. **Signing** needs your Apple ID. Only the first belongs in CI, and
that split is what makes this work without a Mac.

1. **Push, or run the workflow by hand** — Actions → *iOS ipa* → Run workflow. ~5 minutes.
2. **Download the artifact** — the run page → Artifacts → `sideline-ipa` → unzip → `sideline-unsigned.ipa`.
3. **Sign and install it** with [SideStore](https://sidestore.io) or AltStore. They re-sign with your
   Apple ID on the way in; any signature CI applied would just be stripped and redone, which is why
   there are no certificates or secrets in the workflow.

On a **free** Apple ID the install expires after 7 days — but SideStore refreshes the signature
on-device from the same `.ipa`, so you don't rebuild. A paid account ($99/yr) stretches that to a
year. You only re-run the workflow when the game itself changes.

---

## Building on a Mac, if you ever have one

```sh
brew install xcodegen
cd ios && xcodegen generate     # or: npm run ios:project
open Sideline.xcodeproj
```

Signing settings are deliberately **not** in `project.yml`, so opening it in Xcode behaves like any
normal project — pick your team and hit run.

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
