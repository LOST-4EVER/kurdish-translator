# AGENTS.md

Static, build-free single-page app (HTML + vanilla JS/CSS). No package.json, no
build, no test framework, no linter. **Progressive Web App**: installable on
Android/iOS via `manifest.json`; `sw.js` caches the app shell so the UI and
preview player work **offline** (translation itself needs the network).
Deployed to GitHub Pages from the `main` branch
(`https://LOST-4EVER.github.io/kurdish-translator/`).

## PWA / offline

- `manifest.json` (root): name, icons, `display: standalone`, theme/background.
  Icons live in `assets/icons/` (`icon-192`, `icon-512`, `maskable-512`,
  `apple-touch-icon`). If you regenerate them, keep opaque `maskable-512` with
  content in the center safe zone; don't overwrite it with the rounded version.
- `sw.js`: precaches the app shell on install (list in `ASSETS`), cache-first
  for same-origin GETs, network-only for cross-origin (Google Translate).
  **Version the cache** (`kurdish-translator-v1`) whenever you change any
  cached asset, or users get stale files.
- `app.js` registers the service worker and shows an Install button via the
  `beforeinstallprompt` event.

## Commands

- Syntax check any file: `node --check assets/js/<file>.js`
- Unit-test logic in Node (no DOM needed): `require` the file, e.g.
  `node -e "const P=require('./assets/js/parser.js'); P.parse('...')"`.
  Works for `parser.js` and `translator.js` only.
- `app.js` and `player.js` touch the DOM on load and **cannot** be `require`d or
  run in Node. Verify them with a DOM harness (jsdom) or manual browser test.
- No install/build/test steps exist. There is nothing to run before committing.

## Architecture & wiring

- Scripts load in this exact order in `index.html`: `parser.js` → `translator.js`
  → `i18n.js` → `toast.js` → `player.js` → `app.js`. They expose globals
  (`SubParser`, `Translator`, `UI_I18N`, `Toast`, `SubtitlePlayer`) via top-level
  `const` in the shared classic-script lexical scope — they do **not** attach to
  `window`. Do not reorder the scripts; `app.js` calls `SubtitlePlayer.init()` on
  load.
- `parser.js` / `translator.js` each end with a `module.exports` guard so they
  work both as classic scripts and via `require()` in Node.
- Flow: drop file → `app.js` decodes + parses → **shows the settings step first**
  with translation options (source language, include original, double-check
  accuracy, drop empty lines) → user clicks "Translate to Kurdish" →
  `Translator.translateLines` → `prepareDownload` + `loadPreview`. Preview shows
  **translated** cues after a run, reverts to original on new file / "Translate
  another". All options (source lang, include original, accuracy, drop empty)
  persist via `localStorage`.
- **Preview editor**: the preview tab has a live subtitle editor (`app.js`
  `buildEditor`). Each cue is an auto-growing textarea; typing updates the cue
  on the player screen instantly (`SubtitlePlayer.updateText`) and a debounced
  `prepareDownload` refreshes the download blob. Clicking a row seeks/plays it.
  `SubtitlePlayer.setCueCallback` keeps the active row highlighted and scrolled
  into view while playing (skipped while a textarea is focused). Two toggles:
  "Show times" hides/shows the timecode column, and "Save edits" decides whether
  edits are written into the output — ON (default) uses `workCues`, OFF uses
  `baseCues` (the last translated/original set). Both persist via `localStorage`.
  Cues are tracked as two copies: `baseCues` (saved) and `workCues` (edited);
  the player and editor always show `workCues` so edits preview live.

## Key gotchas

- **Target language is fixed to Kurdish Sorani (`ckb`)**. Source dropdown has many
  options; target is a single-value select. Downloads always name as `*.ckb.<ext>`.
- **Encoding**: BOM / UTF-16LE / UTF-16BE detection lives in `app.js` (`decodeBytes`),
  not the parser. The parser assumes already-decoded text.
- **WebVTT timestamps may omit hours** (`mm:ss.mmm`, e.g. `00:13.330`). The
  `TIMECODE` regex and `toMs()` handle both 2- and 3-part forms. Do not "simplify"
  this away.
- **SRT/VTT parsing is line-based**, not blank-line-separated. A line immediately
  followed by a timing line is a cue identifier/index and is skipped. Adding
  blank-line-splitting would regress support for compact files.
- **SAMI (`smi`)**: a `<SYNC Start=…>` block runs until the next `<SYNC>` (or
  `</BODY>`/EOF) — real SAMI files often omit `</SYNC>`, so the parser must not
  rely on it. `<br>` → newline; HTML tags stripped; entities decoded. Multi-`<P>`
  blocks pick the first non-empty paragraph. On write, newlines → `<br>`.
- **MicroDVD (`sub`)**: `|` is the line-break marker — convert to newlines on
  parse and back to `|` on serialize. `{...}` control codes (`{y:b}`, `{c:$…}`,
  `{P:x,y}`, `{f:…}`) are text and preserved as-is.
- **ASS/SSA**: the `Text` field is last and may contain commas. `splitAss` splits
  on top-level commas, but extra parts beyond the field count are folded back
  into `Text` so "Hello, world" isn't truncated.
- **Translator newline protection**: internal line breaks use the sentinel `§§`
  (`NL_SENTINEL`) and are restored with literal `.split()/.join()` — NOT regex.
  `§§` must stay free of regex metacharacters or every character gets split.
  Batch cap is 40 lines / 3500 chars per request.
- **Batch delimiters**: lines in a batch request are joined with `\n` + a
  `\u0001` marker line (`BATCH_SEP`). Google preserves the control char
  verbatim, so a translation that gains or loses plain newlines still maps back
  to its own line. `splitBatch` matches the marker with regex (safe — `\u0001`
  never occurs in subtitle text).
- **Markup protection** (`protect`/`restore`): before sending, every SRT/VTT
  HTML tag and ASS/MicroDVD `{...}` code is swapped for a `\u0002<id>\u0003`
  placeholder (Google leaves control chars verbatim, so the markup survives
  translation instead of being stripped/reordered) and put back after. A line
  whose batch and line-by-line re-translations all fail is kept as the original
  text; if *nothing* translates because the network/API is unreachable,
  `translateLines` throws so the app reports failure instead of fake success.
- **Merged-batch fallback**: if a batch response doesn't come back with exactly
  the number of delimited lines sent, that batch is re-translated one line at a
  time instead of silently dropping text.
- **Cancellation**: `translateLines` takes an optional `AbortSignal`; `app.js`
  aborts in-flight fetches when the user hits Cancel (before it just skipped
  UI updates while the network kept working).
- **ASS/SSA**: `app.js` normalizes `\N` → real newlines before translation;
  `parser.js` `serializeASS` converts `\n` back to `\N`. Preserve the original
  `Format:` field order/case when serializing (players are case-sensitive).
- Translation is a live fetch to Google's free `translate_a/single` endpoint;
  needs network. `translator.js` retries with backoff on transient errors.
- **Sorani punctuation** (`normalizeText`): for Arabic-script targets, comma `,` →
  `،`, semicolon `;` → `؛`, question `?` → `؟`; period `.` and exclamation `!`
  stay ASCII. Space before punctuation is stripped; punctuation stranded on its
  own line is pulled up. Per r12a/Kurdish Academy orthography notes.
- **Kurdish rendering**: RTL subtitle text uses `Noto Naskh Arabic` (via Google
  Fonts in `index.html`) because Inter lacks Arabic-script glyphs. Applied only
  to `.screen-text[dir="rtl"]`.

## Style

- No comments unless they explain a non-obvious quirk (existing quirk comments
  should be preserved).
- Small focused IIFEs per file; shared helpers are local, not global.
- Keep the split-file structure (`parser` / `translator` / `player` / `app`).
