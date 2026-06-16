# Traverse — Project Handoff

Hotel-tracking app built on Capacitor 7 + React 18 + Vite 5. Deployed
to Vercel (web PWA) and TestFlight (iOS via WKWebView).

---

## Stack at a glance

| Layer            | Choice                                           |
| ---------------- | ------------------------------------------------ |
| Shell            | Capacitor 7 + iOS WKWebView                      |
| UI               | React 18 (StrictMode **off** — Mapbox conflicts) |
| Build            | Vite 5                                           |
| Map              | Mapbox GL JS v3.7                                |
| Auth             | Firebase Auth (Apple + Google OAuth, Email/PW)   |
| Data             | Firestore                                        |
| Hosting          | Vercel (web), TestFlight (iOS)                   |

Env vars required at build time (Vite will fatal-screen if missing):

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_APP_ID
VITE_MAPBOX_TOKEN
```

---

## Recent work — what changed and why

### Home (`MapHome.jsx`) UX overhaul

- **HomeHighlights AI summary removed.** Tester feedback: distracting at
  the top of the map, didn't add signal.
- **Bottom sheet detents** stay at `peek` / `half`. The `full` detent
  no longer expands the drawer over the globe — it routes to the My
  Stays tab (`onSwitchToStaysTab`), so the map is never hidden.
- **`compact` prop on `StayCard`** suppresses the detail-expansion block
  on Home. Details only expand on the dedicated Stays tab where edit
  affordances make sense.
- **Peek empty state** is a real **+ Log Your First Stay** button (filled
  accent), not an instructional line of text. First-run users tap it
  directly instead of having to discover the drawer drags up.
- **City-filter focus.** Tapping a pin auto-expands to `half` and filters
  the drawer list to that `country::city`. A `Show all` ghost button
  clears the focus.

### Map controls (`MapView.jsx` + `FriendsMapView.jsx`)

- Replaced the square reset glyph with an inline-styled **"Fit all"
  frosted pill** at `top: 12 / left: 12`, frame-corners icon.
- `LayoutToggle` (Map / Split / List) moved to `top: 12` on the right so
  both controls share one horizontal line. Mirrored on the friend map
  minus the list mode.

### Status auto-flip (`useStays.js`, `useFriends.js`)

- Stays previously carried a write-time `status` field that went stale
  once a checkout passed. Both hooks now **derive `status` at read
  time** from `checkOut` vs today.
- Local-wall-clock date construction replaces `toISOString().split("T")`
  — UTC drift was flipping stays a day late for users east of UTC.
- `useFriends` re-decorates at midnight via a 24h tick so the timeline
  refreshes without a page reload.

### Auth (`Auth.jsx`, `services/auth.js`)

- **5-tap-on-logo gesture** reveals a hidden email/password form for
  Apple App Review. Tap counter resets after a 3 s gap. Sign-in goes
  through `signInWithEmail` (Firebase JS SDK direct) bypassing the OAuth
  bridge entirely.
- **Apple icon clipping fix.** Old SVG path used negative coordinates
  outside the `0 0 18 18` viewBox. Replaced with a `0 0 24 24` path that
  fits inside the box.

### AddStayModal (`AddStayModal.jsx`)

- **Cancel as text, not ✕.** Beta testers were tapping the X expecting
  it to save. Replaced with a plain "Cancel" text button. Tap-outside
  no longer closes either.
- **Wizard step optionality made obvious.** Once Step 1 is valid the
  bottom button becomes the filled **Save N-night stay** action and
  **Add details** becomes secondary. A small banner above the footer
  says "Everything below is optional — you can save now."
- Step 2 / Step 3 prompts carry an explicit `OPTIONAL` tag.
- **`bookedByMe` toggle** in Step 3 — "I personally booked this stay".
  Default off. Required for the stay's nights to count toward elite
  status (see Insights below).

### EditStayModal (`EditStayModal.jsx`)

- Mirrors the `bookedByMe` toggle so legacy stays can be retroactively
  marked.

### FriendsView (`FriendsView.jsx`)

- Friend-request errors now translate Firestore codes to plain English:
  - `permission-denied` → "A request to {name} is already pending —
    wait for them to accept."
  - `already-exists`  → "You've already sent this request."
  - Removed the raw "Update your Firestore rules" leak.

### Error overlays (`main.jsx`)

- **Debug overlay opt-in.** The full-bleed black stack-dump overlay is
  a dev aid and was scaring testers when transient noise (Mapbox worker
  teardown, Capacitor `errorCb is not a function`) fired. It's now
  gated behind `?debug=1` (sticky via `localStorage`). Production users
  get silent `console.error` + diag logging.
- **`NOISE_PATTERNS`** suppresses known benign noise entirely:
  `errorCb is not a function`, `this.errorCb`, `AbortError`,
  `The operation was aborted`.
- **`showFatalScreen`** — friendly light-themed crash screen for genuine
  startup failures. Indigo dot, message: *"Your app experienced an
  error. Please refresh or try again later. If this continues, please
  contact support."*, plus a **Refresh** button that cache-busts via
  `?_v=timestamp`. Technical detail only appended when `?debug=1`.
- **Stale-SPA reload guard.** If a chunk-load error fires (deploy
  replaced hashes, browser cached old index.html), one-shot
  `sessionStorage`-guarded hard reload with cache-bust.

### Insights / Elite tier gating (`StatsView.jsx`)

- `statusProgress(brand, stays)` now filters by `s.bookedByMe === true`
  before counting YTD nights.
- Long comment in the file explains the rationale: loyalty programs
  (Marriott, Hilton, Hyatt, IHG, Accor) only credit nights when the
  member personally booked. Comped, family-paid, business-booked, and
  OTA stays don't qualify. We err toward underreporting rather than
  telling someone they're "on track for Diamond" off ineligible nights.

### iOS top safe-area band

The visible colored band at the top of the iOS app came from:

1. `viewport-fit=cover` was missing from `index.html` viewport meta.
2. `capacitor.config.json` had `"contentInset": "always"` — native
   inserted opaque space above the WebView.

Fixed by:

- `index.html`: viewport meta now includes `viewport-fit=cover`.
- `capacitor.config.json`: `contentInset` → `"never"`.
- `app.css`: `.header` padding is now
  `max(20px, calc(env(safe-area-inset-top, 0px) + 8px)) 20px 12px` so
  content sits below the notch/island and the body background fills
  behind the status bar.

---

## File-by-file cheat sheet

| File                                  | Why you'll come back to it                                      |
| ------------------------------------- | --------------------------------------------------------------- |
| `src/main.jsx`                        | Boot, env-var fatal screen, error overlay (debug-gated), noise suppression, stale-SPA recovery |
| `src/components/App.jsx`              | Tab routing, modal mounting                                     |
| `src/components/MapHome.jsx`          | Globe + bottom-sheet detents + city-filter focus + first-run CTA |
| `src/components/MapView.jsx`          | Mapbox setup, Fit-all pill                                      |
| `src/components/FriendsMapView.jsx`   | Mirror of MapView for friends, no list detent                   |
| `src/components/BottomSheet.jsx`      | Detent state machine + drag handle                              |
| `src/components/LayoutToggle.jsx`     | Map / Split / List pill                                         |
| `src/components/StayCard.jsx`         | `compact` prop, detail expansion                                |
| `src/components/AddStayModal.jsx`     | 3-step wizard, Save-now button, `bookedByMe` toggle             |
| `src/components/EditStayModal.jsx`    | Edit fields, `bookedByMe` toggle                                |
| `src/components/StatsView.jsx`        | Brand elite-tier ladders, `bookedByMe`-gated `statusProgress`   |
| `src/components/FriendsView.jsx`      | Friend requests, plain-English error mapping                    |
| `src/components/Auth.jsx`             | OAuth buttons + 5-tap reviewer backdoor                         |
| `src/services/auth.js`                | Firebase auth wrappers incl. `signInWithEmail`                  |
| `src/hooks/useStays.js`               | Firestore stays + read-time status derivation                   |
| `src/hooks/useFriends.js`             | Friend stays + status decoration + midnight tick                |
| `src/styles/app.css`                  | Header safe-area padding, global tokens                         |
| `index.html`                          | Viewport meta with `viewport-fit=cover`                         |
| `capacitor.config.json`               | `contentInset: never`, plugin config                            |

---

## Build / run

```bash
npm install
npm run dev              # local Vite dev server
npm run build            # production build → dist/
npx cap sync ios         # copy build into the iOS project
npx cap open ios         # open Xcode for TestFlight archive
```

Deploy: push `main` to GitHub; Vercel rebuilds the web app
automatically. iOS goes through the standard Xcode → Archive →
TestFlight flow.

---

## Conventions worth keeping

- **StrictMode is intentionally off.** Mapbox manages DOM imperatively
  and the double-mount in dev produces a phantom `removeChild` error
  that doesn't repro in prod.
- **Inline JSX styles are preferred for floating overlays.** Stale CDN
  CSS bit us — inline styles can't be cached separately from the JS.
- **Read-time derivation over write-time fields** for anything that
  depends on "today" (status, days-until). Avoids stale-doc bugs.
- **Default off, opt in.** When in doubt (e.g. `bookedByMe`, debug
  overlay), default to the conservative behavior and let the user
  opt in. Underreporting beats lying.
- **Friendly errors only in production.** Raw stacks behind `?debug=1`.

---

## Known follow-ups

- The Apple reviewer backdoor account credentials need to be created in
  Firebase Auth before the next App Review submission.
- `MapDiag` chunk is ~2.6 MB — fine as a lazy route but worth
  manualChunks-ing if it shows up on the critical path.
- Several files dynamic-import Firebase Auth while it's also statically
  imported elsewhere — Vite warns but it's harmless. Worth unifying.
