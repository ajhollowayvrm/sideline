# SIDELINE — design history: the iOS app

> Phase 61. The same `index.html`, wrapped in a native shell and installable on an iPhone —
> plus the two web-layer defects that were making it feel like a web page regardless of packaging.

## Phase 61 design — native shell

Decided 2026-08-15 with AJ. The ask, in his words: *"I want it to feel like an iOS-first
experience but we don't need Swift."* The rejected alternative was named just as clearly — a PWA
*"feels cheap … zooming in randomly, not holding state for longer than like 10 minutes, having it
all be responsive mobile view."*

Three complaints. The useful thing that came out of scoping them is that they have **three
different causes**, only one of which packaging can fix:

| Complaint | Actual cause | Fixed by |
|---|---|---|
| "zooming in randomly" | iOS Safari has ignored `user-scalable=no` since iOS 10, as an accessibility policy | **Only** a native shell |
| "not holding state for 10 minutes" | A real bug: boot never resumed the live career | A ten-line web-layer fix |
| "all responsive mobile view" | True, and a shell alone doesn't fix it | Design work, unlocked by the shell |

That table is the phase. It is worth writing down because the instinct — *"it feels cheap, so wrap
it"* — would have shipped the shell and left the worst symptom in place.

### The zoom complaint was already half-solved, and half-unsolvable

`index.html` had carried `font-size:16px` on `input,select` since the design system was written,
which is the one mitigation Safari respects (a smaller input font is what triggers focus-zoom), and
`-webkit-tap-highlight-color:transparent` with it. The available work had been done.

What was left is **double-tap and pinch zoom**, and no web page can disable those in iOS Safari at
any price. `touch-action:manipulation` — added in this phase — kills double-tap zoom and the 300 ms
tap delay, and is a genuine win in the browser too. Pinch survives. Only owning the scroll view
gets rid of it, which is a WKWebView, which is the shell.

### The state complaint was a bug, not a storage failure

Boot was one line:

```js
render();                      // with UI = { view: 'menu', ... }
```

There was no session resume. iOS Safari and a WKWebView both jettison a backgrounded tab under
memory pressure — and this tab is a fat target, holding a decoded multi-MB world — then silently
reload it when you come back. The career was never at risk; it sat in `localStorage` the whole time.
The app just came back up on the **main menu**, which reads as total loss.

The fix records the live slot in its own key, `sideline_active`:

- **Set** wherever a career is opened — the new-game slot pick, all three cloud load paths, and
  inside `writeSlot` whenever the state being written *is* `S` (which covers every `autosave`).
- **Cleared** only on a deliberate exit: Quit to menu, deleting the slot, leaving a retired career,
  and `?reset=1` (which routes through `deleteSlot`, so it comes for free).

It is deliberately **not** part of `state`. Which slot this device has open is a property of the
session, not of the career — the same call Phase 47 made when it put cloud config in its own key
rather than inside the save.

The QA gate had `check('After reload, back at Menu', …)`, which encoded the bug as the contract. It
becomes two checks: a reload resumes into the career, **and** a deliberate quit survives a reload.
The second matters more than it looks — without it, "Quit" is a button that undoes itself.

### Not a PWA, and not Capacitor either

Capacitor was the first recommendation and it was wrong for this repo. The correction came from
counting what the shell actually has to do: host the page, kill zoom, kill bounce, style the status
bar, fire haptics, and save one file. Five capabilities — no push, no iCloud, no Game Center, no
camera, no permissions, no entitlements.

| Option | Verdict |
|---|---|
| PWA / Add to Home Screen | Rejected by the ask, and genuinely cannot fix zoom |
| **XcodeGen + one Swift file** | **Chosen.** ~150 lines total, no npm, no CocoaPods, nothing to upgrade |
| Capacitor | Real value is its plugin ecosystem; none of it is needed here |
| Native rewrite | 10k lines of DOM-driven JS. No. |

Capacitor would have brought `node_modules`, CocoaPods, a `www/` staging directory and a major
version that breaks roughly annually, into a project that has spent sixty phases keeping its runtime
dependency count at zero and hand-built its own cloud backend rather than take a service.

The line to watch for, recorded so the decision can be revisited honestly: switch when you find
yourself **writing generic plumbing instead of a specific feature**. Concretely that means
unsolicited native→JS events (a push token arrives whenever APNs feels like it, possibly before the
web view has loaded) or capabilities needing entitlements and runtime permission prompts. Bridges
that merely ask a question and get an answer stay cheap forever — since iOS 14,
`WKScriptMessageHandlerWithReply` makes `postMessage` return a real JS Promise, so the
request/response layer people used to hand-roll is obsolete.

### The shell, in the order the decisions matter

**Origin is the load-bearing one.** Saves are keyed to origin and a career is ~1.4 MB of
`localStorage`. `loadFileURL()` hands the page an opaque `file://` origin where WebKit's storage
behaviour is unreliable — so the page is served over a registered custom scheme, `sideline://`,
which WKWebView treats as a real, secure, stable origin. Saves therefore survive app updates, and
`window.isSecureContext` is true so `navigator.clipboard` keeps working for the career code.

`Shell.scheme` is effectively a schema version. Changing that string orphans every save on every
device that already has the app.

**Zoom is shut four ways**, because it is the complaint that started this: the scale clamp
(`min/maximumZoomScale = 1`), refusing to nominate a view to zoom (`viewForZooming` → `nil`), a
delegate that snaps back if anything still moves it, and a `gesturestart` preventer injected at
document start. The last one exists so the lock does not rest solely on the scroll-view delegate,
which is a documented-but-touchy thing to set on a WKWebView.

**Bounce off, insets manual.** `bounces = false` removes the strongest "web page" tell.
`contentInsetAdjustmentBehavior = .never` with the web view pinned to the view (not the safe-area
guide) is what keeps the page's own `env(safe-area-inset-*)` padding correct — the CSS was already
right, from `--safe-b` in the design system, and the shell's job is not to break it.

**Two bridges.** Haptics (fire-and-forget), and a share sheet for file saves. The second is a real
bug fix, not a nicety: `URL.createObjectURL` + `a.download` is inert in a WKWebView, so the
blank-roster-template button would have silently done nothing.

### Building it without a Mac

Compiling needs macOS + Xcode. **Signing** needs an Apple ID. Only the first belongs in CI, and
separating them is what makes this work from Windows:

- A free macOS runner (the repo is public) runs `xcodegen generate` and `xcodebuild archive` with
  `CODE_SIGNING_ALLOWED=NO`, then assembles the `.ipa` by hand — `xcodebuild -exportArchive` insists
  on a signing identity, and an `.ipa` is only a zip with the `.app` inside a `Payload/` directory.
- SideStore/AltStore re-signs it locally on the way in. Any signature CI applied would be stripped
  and redone anyway, which is why there are **no certificates, profiles or secrets** in the workflow.

So the `.xcodeproj` is generated, never committed: nothing to create on a Mac, and no `.pbxproj` to
merge-conflict over.

### Fonts had to be vendored first

The `<link>` to `fonts.googleapis.com` was the only external fetch in the file. Offline it silently
dropped the display face; inside the shell, which has no network origin at all, the entire
"sideline terminal" look would have degraded to system sans on first launch.

Five faces are now embedded as base64 (Saira Condensed 500/600/700/800, plus Inter — which Google
serves as one variable file spanning 400–700), latin subset, 117 KB of woff2 → 158 KB of base64.
`index.html` goes 712 KB → 870 KB and **stays one self-contained file**, which is the point: the
same bytes now render identically from `file://`, from Pages over `https://`, and from `sideline://`.
No asset paths to resolve three different ways, and nothing for the scheme handler to get wrong.

Sources are committed under `assets/fonts/` rather than re-fetched, because the gstatic URLs carry a
version segment (`/inter/v20/`, `/sairacondensed/v12/`) that rotates without warning.

A QA request listener now asserts that **nothing** loads off-origin across the whole run
(`fetch`/`xhr` excluded — that is the Phase 47 cloud layer, which has its own tests). That gate is
what stops this regressing the next time someone reaches for a CDN.

### Deliberately out of scope

- **Moving saves off `localStorage`.** 3 slots × ~1.4 MB ≈ **4.2 MB against Safari's ~5 MB
  per-origin cap** — genuinely near the wall, today, on the web build. `writeSlot` already toasts
  `'Save failed — storage full'` so it is not silent, but a transient toast during a week-advance is
  easy to miss. IndexedDB is the right fix and it is pure JS, but `readSlot` is **synchronous** and
  called from `findSlotFor`, `autosave`, `renderLoad` and boot, so converting is an async refactor
  with real blast radius. It is its own change, not a rider on a packaging phase. Recorded here so
  it does not get lost.
- **The App Store.** Real team names and colours are the blocker, not the technology.
- **Push notifications, iCloud, Game Center.** Explicitly ruled out by the ask, and the reason the
  hand-rolled shell beats a framework.
- **Making it genuinely feel iOS-first.** The shell is the prerequisite, not the finish: a 560px
  centred column in a WKWebView is still a 560px centred column. Push/pop navigation, iOS sheet
  physics, large-title headers and touch-target sizing are open, and want a device in hand to judge.
