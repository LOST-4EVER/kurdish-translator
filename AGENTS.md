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
  → `player.js` → `app.js`. They expose globals (`SubParser`, `Translator`,
  `SubtitlePlayer`) via top-level `const` in the shared classic-script lexical
  scope — they do **not** attach to `window`. Do not reorder the scripts; `app.js`
  calls `SubtitlePlayer.init()` on load.
- `parser.js` / `translator.js` each end with a `module.exports` guard so they
  work both as classic scripts and via `require()` in Node.
- Flow: drop file → `app.js` decodes + parses → **auto-translates immediately**
  (settings step is skipped on load; reachable via "Translate another") →
  `Translator.translateLines` → `prepareDownload` + `loadPreview`. Preview shows
  **translated** cues after a run, reverts to original on new file / "Translate
  another". Source language + "drop empty lines" preference persist via `localStorage`.

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
- **Translator newline protection**: internal line breaks use the sentinel `§§`
  (`NL_SENTINEL`) and are restored with literal `.split()/.join()` — NOT regex.
  `§§` must stay free of regex metacharacters or every character gets split.
  Batch cap is 40 lines / 3500 chars per request.
- **Merged-batch fallback**: Google sometimes collapses the `\n` separators that
  delimit lines in a batch. If a response returns fewer lines than sent, that
  batch is re-translated one line at a time instead of silently dropping text.
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
