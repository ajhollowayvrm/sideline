# SIDELINE — design history: cloud saves

> Phase 47. Cross-device continuation for a game that is otherwise a single static file.

## Phase 47 design — cloud saves

Decided 2026-08-12 with AJ. The ask: *"continue progress everywhere."* Play a season on the
desktop, pick the same career up on the phone. Everything else about the app stays true —
static HTML in a native iOS shell, `localStorage` as the fast path, no accounts.

Three decisions were taken up front, because each one changes what gets built:

| Decision | Choice | Why |
|---|---|---|
| Backend | **AWS: Lambda Function URL + DynamoDB + S3** | The one the user owns; free tier covers personal play. |
| Identity | **Career code** (60-bit bearer token) | Preserves "no accounts". Type it once on the other device. |
| Sync model | **Auto, debounced** | Saving must never wait on a network. |

### Why a save can't just live in DynamoDB

A DynamoDB item caps at **400 KB**. A real Sideline save is ~2.4 MB after the Phase 9
columnar codec (the QA gate's mid-career state gzips to ~580 KB, ~770 KB as base64 on the
wire) — and it *grows* with seasons played, legends, and the record book. Chunking a save
across items would work but puts the most load-bearing data in the app behind a
reassembly step that has to be exactly right forever.

So the storage splits by what each store is actually good at:

- **S3** holds the blob — gzipped, one object per revision, private, Lambda-only access.
- **DynamoDB** holds the index — `rev`, the S3 key, size, and the small meta card the
  Load screen renders (team, coach, year/phase/week, record, `savedAt`).

The Load screen can therefore list every career on every device having downloaded **none**
of them. You only pay for the megabytes when you actually pull a career down.

### Identity: the career code

`SIDE-7K2M-9QX4-B8TR` — 12 Crockford base32 characters (60 bits), minted in the browser from
`crypto.getRandomValues`. Crockford because the alphabet drops I/L/O/U, and `cloudNormCode`
maps the lookalikes back (`O`→`0`, `I`/`L`→`1`, `U`→`V`) along with lowercase, spaces, the
dashes and the `SIDE` prefix — a code has to survive being read off one screen and typed into
another.

The server never stores it. The DynamoDB partition key is `sha256(<per-stack pepper>:<code>)`,
so a table dump can't be replayed as codes. There is **no registration**: an unknown code isn't
an error, it's an empty namespace. That absence is exactly what makes "type the code on your
phone" work without accounts — and it's why the code is a password, stated plainly in the UI.

*(Deliberately not built: email/magic-link recovery. It needs SES, a verification flow and token
storage to serve one person who can write a code down. Lose the code and the cloud copies are
unreachable — the local saves are untouched.)*

### Setup is a login, so the phone can remember it

If the code is a password, the screen that takes it has to *look* like a password field to the
one piece of software that will actually keep it safe. It didn't: the endpoint and the code were
two loose inputs in two cards, each with an `onclick` handler, which is a shape no password
manager recognises — so iOS never offered to save the one secret in the whole game that cannot
be recovered, and the second device had to be typed at by hand.

They are now a single `<form>`, because the two halves are one credential in practice — you need
both to reach a career, so they should be saved and filled **together**:

| element | why it's shaped that way |
|---|---|
| `<form method="post" autocomplete="on">` | The container the heuristics look for. |
| API URL → `name="username" autocomplete="username"` | `type="text"` + `inputmode="url"`, **not** `type="url"` — Safari only offers the username chip on a text/email/tel field, and inputmode keeps the URL keyboard. |
| Career code → `name="password" autocomplete="current-password"` | Flipped to `new-password` the moment "Create a code" mints one, so the manager files it as new rather than looking for a match. |
| One `<button type="submit">` | **The submit event is the connect action.** A manager captures a credential off a real submit; a handler hanging off a button click is invisible to it. The handler `preventDefault()`s and does the work. |
| Every other button carries `type="button"` | A bare `<button>` inside a form *is* a submit button. Reveal, Copy, Create and Disconnect all opt out explicitly — this is the easy way to break the screen. |

Two details that follow from it. The submit handler reads `input.value` off the DOM rather than
an `oninput` draft closure, because an autofilled field is filled by the browser and shouldn't
depend on whether it fired an event on the way in. And a **linked** device still renders the form
with both halves prefilled (the code masked, behind Reveal) rather than as static text, so a
device that connected before any of this existed can still hand the pair to the keychain by
hitting Update. Reveal toggles `input.type` in place instead of going through `render()` — a
re-render mid-typing would drop the field and whatever had just been autofilled into it.

Saved credentials are scoped to the **origin**, which is the same reason `localStorage` saves are:
the deployed Pages URL remembers, a local `file://` open does not.

### Sync: local first, always

`writeSlot` is unchanged in its contract — it writes `localStorage` and returns. The cloud push
is *queued behind it* on a 5-second debounce, and flushed early when the tab is hidden. A save
never waits on the network; offline just means the queue retries with backoff (capped, six
attempts) and the status line says so.

Everything a device needs to know about a career is a **watermark**: the `rev` it last
pushed or pulled, plus the `lastSaved` it had at that moment. That plus the local save's
`lastSaved` and the cloud's head `rev` is the whole decision, and `cloudResolve` makes it
purely:

| watermark vs cloud | local changed since? | → |
|---|---|---|
| same rev | no | **in sync** |
| same rev | yes | **push** |
| behind | no | **pull** — the other device is ahead |
| behind | **yes** | **conflict** — ask |
| ahead | — | **push** (cloud was reset) |
| no local copy | — | **pull** |
| no cloud copy | — | **push** (first backup) |

The row that matters is *behind **and** changed*: two devices genuinely diverged. The game
never guesses there. It shows both saves side by side — team, year, phase, week, record, how
long ago, which device — and the coach picks. "Continue from the cloud" downloads and loads;
"Keep this device's save" force-pushes over the top. Either way the loser's bytes were never
overwritten to begin with (see below), and auto-sync stays frozen until a choice is made.

### Conflicts can't eat a save

Push is optimistic: the client declares the `baseRev` it built on and DynamoDB's conditional
write rejects it if another device moved first. The ordering is the safety property:

1. write the blob to a **fresh S3 object, keyed uniquely per attempt** (`{rev}-{uuid}.bin`),
2. *then* conditionally update the index to point at it,
3. on success, sweep the key the **previous index item** named (so a career keeps ~1 live
   object); on rejection, delete only the object *this* attempt wrote.

The per-attempt key is not decoration — `test/lambdalab.js` caught the version that keyed by
revision alone. Two devices pushing from the same `baseRev` compute the **same next rev**, so
a rev-keyed path meant the loser overwrote the winner's bytes and then, in its own cleanup,
deleted them. Keying per attempt makes a losing push physically incapable of touching the save
that won, and sweeping the key recorded in the index (rather than a reconstructed path) keeps
cleanup authoritative.

### A career's identity is derived, not assigned

`cloudCareerId(state)` = `'c' + createdAt.toString(36) + '-' + seed.toString(36)`. No new field,
no id to migrate, no way for two devices to disagree about what "this career" means — and an
old save uploads unchanged and lands on the right career. This is also why **Phase 47 is a
structural no-op in `migrateState`** (v42→v43): the sync data (endpoint, code, watermarks)
lives in its own `localStorage` key, not in the save. The only addition to the slot envelope
is `meta.careerId`, and it's re-derivable from the state when absent.

### What's where

- **Pure engine** — `// === CLOUD ENGINE (Phase 47) START/END ===` in `index.html`: code
  minting/normalizing/formatting, `cloudCareerId`, `cloudProgress`, `cloudResolve`. No DOM,
  no network, no `S`. Extracted and validated by `test/cloudlab.js` (50 checks, including the
  full decision table and a two-device convergence walk).
- **Client layer** — config, gzip/base64 wire format, transport, the debounced queue, the
  Cloud screen, Load-screen badges, conflict + delete sheets.
- **Backend** — `infra/template.yaml` (SAM) + `infra/lambda/index.mjs`. One `sam deploy`.
  See `infra/README.md` for deploy, cost and the security model. Gated by `test/lambdalab.js`
  (30 checks): the real handler against in-memory DynamoDB/S3 stubs, installed through an ESM
  resolve hook so nothing needs npm-installing. It covers auth, namespace isolation, the full
  concurrency table and input validation. `normalizeCode` in the handler must stay byte-identical
  to the client's `cloudNormCode` — the owner key is a hash of the normalized code, so any
  divergence would put one person in two namespaces.
- **QA** — `test/qa.js` stands up an in-memory implementation of the real API inside the page
  (same routes, same rev semantics) and drives push → list → pull → conflict → force-resolve
  → offline, asserting all 11,377 players survive the gzip round-trip byte-for-byte. It also
  gates the setup screen's **form shape** — that it is a `<form>` carrying an
  `autocomplete="username"` field, an `autocomplete=*-password` field, exactly one
  `type="submit"` and no bare `<button>` — and that dispatching the **submit event** is what
  connects the device. Those are the properties iOS reads; none of them shows up in a
  screenshot, so nothing else would notice them going away.

### Deliberately out of scope

- **No live/multiplayer state.** A career is one coach's; the cloud is a mirror, not a session.
- **No revision history.** One live revision per career (plus a transient orphan). S3 makes
  keeping N cheap, but "which of my 40 autosaves is the right one" is a worse UX than one
  correct save; DynamoDB PITR covers operator-level recovery.
- **No background/periodic pull.** A device pulls when it opens the Load screen, boots, or is
  told to. Polling a save you're not looking at buys nothing.
- **No sync of the cloud config itself** (endpoint, auto-sync). It's per-device on purpose.
- **The endpoint is not baked in by default.** `CLOUD_ENDPOINT` is an empty const you may fill
  after deploying; with it empty the whole layer is inert and the game is exactly what it was.
