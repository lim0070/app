# Project: Larder & Timetable

Two standalone personal web apps, each a single self-contained HTML file.

> This folder holds **App 2** only: `timetable.html` (DayLedger). App 1 (Larder)
> lives at `/Users/lm/Desktop/claude/food sto/pantry.html` (folder name contains
> a space). The shared rules below still apply here.

## Hard rules (apply to both apps)
- Each app is ONE .html file: all HTML, CSS, and JS inline. No separate .css/.js files.
- No build step, no bundler, no npm, no server. The file must work when opened
  directly in Chrome via file:// (double-click to run).
- No external dependencies except fonts from Google Fonts and, where already used,
  CDN scripts. Do not introduce frameworks (React, Vue, etc.) or a package.json.
- Data persists in the browser via localStorage. Never use a backend or database.
- Preserve backward compatibility with existing saved data: when changing the data
  model, migrate old localStorage records rather than breaking them.
- Keep an Export/Import (JSON file) path working as the backup mechanism.
- Any API keys/tokens (e.g. Hugging Face) live only in localStorage and must be
  EXCLUDED from exported data. (The Firebase web config is NOT a secret — it may
  live in the HTML; security comes from Firestore rules + Google sign-in.)

### Agreed exceptions (user-approved, Jul 2026) — cloud sync & Android
- Goal: Android use via installable PWA + automatic cross-device sync (Firebase
  Firestore, Google sign-in) for BOTH apps. Hosting: GitHub Pages.
- Firebase compat SDK via gstatic CDN is allowed. Sync must stay OPTIONAL:
  with `FIREBASE_CONFIG = null` (or SDK unavailable / signed out) the app must
  behave exactly as before, fully local, working from file://.
- PWA companion files next to the HTML are allowed (and now exist): `sw.js`
  (service workers can't be inlined), `manifest.webmanifest`, `icon-192.png`,
  `icon-512.png`. All other HTML/CSS/JS stays in the single HTML file.
  SW registration is skipped on file:// so double-click use is unchanged.

### Sync architecture (implemented in timetable.html; reuse for Larder)
- State is split into sections: `settings`, `reminders`, `templates`, and one
  `day:<dateISO>` per day. Firestore docs: `users/{uid}/dayledger/{section}`
  and `users/{uid}/dayledgerDays/{dateISO}`, each `{j:<JSON string>, updatedAt:<ms>}`.
- Last-write-wins per doc by `updatedAt`. Local edit times persist in
  localStorage key `dayledger-sync-meta` (excluded from export, like HF token).
- Anti-echo/ping-pong: in-memory pushCache of last JSON seen per key; section
  serialization is deterministic (verified round-trip identical).
- Empty auto-created days ("ghost days" from just viewing a date) are never
  pushed unless the user actually edited/cleared that day.
- Done: (1) sync module + Firebase config wired in, tested via localhost;
  (2) PWA manifest/sw.js/icons. Remaining: (3) same sync module + PWA in
  pantry.html (folder `food sto`, shares the same Firebase project — use a
  different section prefix, e.g. `users/{uid}/larder/...`); (4) GitHub Pages
  deploy + add domain to Firebase authorized domains.

## Workflow expectations
- Make one focused change at a time; keep the app runnable after every change.
- After editing, sanity-check the JS: extract the <script> and run `node --check`.
- Verify every element id referenced in JS actually exists in the HTML.
- Don't refactor or restructure unprompted. Ask before large rewrites.
- Match the existing code style (plain vanilla JS, concise, existing naming).

## App 1: pantry.html (Larder — food stock manager)
- Tabs: Fridge, Shelf (inventory), Shopping, Recipes, plus an Add-item form.
- Items: {id, loc, name, qty, unit, exp, photo, added, cat}.
- Categories auto-guessed from item name; used to group inventory + shopping list.
- Shopping list is per-store (multiple named stores), items carry {store, qty, cat, done}.
- Recipes store ingredient lists; can push ingredients to a store's list and
  show what's missing vs current stock. Optional HF parsing for pasted recipes.

## App 2: timetable.html (DayLedger)
- Tabs: Build plan, Log actual, Review, Add reminder, Next 7 days, Template.
- Per-date plan/actual timetables; adjustable/custom slot lengths.
- Reminders with start/end date ranges + smart natural-language add (local parser
  first, optional HF fallback), including a built-in NYSE market calendar.
- Templates: reusable day designs applied to any date.

## Testing without a browser
There's no automated test suite. NOTE: this machine has NO node installed.
Use macOS's built-in JavaScriptCore instead:
  `/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc`
Syntax check: extract the inline <script> (python3 regex works well), then in a
jsc script do `new Function(readFile("tt.js"))` — parses without executing.
For logic checks, stub minimal globals (state, actById, …) and run pure
functions in jsc the same way.
