# 🎬 Kurdî Subtitle Translator | وەرگێڕی ژێرنووسی کوردی

[![Progressive Web App](https://img.shields.io/badge/PWA-Installable%20%26%20Offline-7c5cfc?style=flat-square&logo=pwa&logoColor=white)](https://LOST-4EVER.github.io/kurdish-translator/)
[![Kurdish Sorani](https://img.shields.io/badge/Language-Kurdish%20Sorani%20(ckb)-fbbf24?style=flat-square)](https://LOST-4EVER.github.io/kurdish-translator/)
[![100% Client-Side](https://img.shields.io/badge/Privacy-100%25%20In--Browser-a6f4c5?style=flat-square&logoColor=black)](https://LOST-4EVER.github.io/kurdish-translator/)
[![GitHub Pages](https://img.shields.io/badge/Hosted%20on-GitHub%20Pages-blue?style=flat-square&logo=github)](https://LOST-4EVER.github.io/kurdish-translator/)

Translate movie, anime, and TV series subtitles into **Kurdish Sorani (کوردیی ناوەندی - `ckb`)** right inside your browser. 100% client-side, completely private, installable on mobile and desktop, and works offline.

🔗 **Live App:** [https://LOST-4EVER.github.io/kurdish-translator/](https://LOST-4EVER.github.io/kurdish-translator/)

---

## 🗂 Supported Subtitle Formats

| Format | Extension | Key Capabilities & Features |
|---|:---:|---|
| **SubRip** | `.srt` | Standard timecodes (`hh:mm:ss,mmm`), HTML style tags (`<i>`, `<b>`, `<u>`, `<font>`) |
| **WebVTT** | `.vtt` | Header & cue settings (`align:start position:0%`), 2- and 3-part timecodes (`mm:ss.mmm` & `hh:mm:ss.mmm`) |
| **Advanced SubStation Alpha** | `.ass` | Full script headers, style definitions, override codes (`{\an8}`, `{\pos()}`, `{\c&H...&}`), `\N` linebreaks |
| **SubStation Alpha** | `.ssa` | V4 styles, dialogue layers, timing codes, and format field preservation |
| **MicroDVD** | `.sub` | Frame-based timing with FPS headers (`{1}{1}23.976`), pipe `\|` linebreaks, control codes |
| **SAMI** | `.smi` | `<SYNC Start=...>` blocks, multi-paragraph handling, HTML tag sanitization & entities |
| **Plain Text** | `.txt` | Line-by-line transcript translation with automated cue pacing |

---

## ✨ Features & Highlights

### 🚀 High-Speed Batch Translation
- **Intelligent Batching:** Groups subtitle lines into delimited batches for fast translations.
- **Markup Protection:** Replaces HTML tags, ASS tags (`{\...}`), and MicroDVD codes with bracketed tokens before translation, restoring them intact afterward.
- **Newline Sentinel Preservation:** Multiline subtitle cues are protected with literal sentinels so line breaks match the original timing.
- **Failover & Self-Healing:** Merged or truncated responses automatically fallback to individual line translation with exponential backoff and alternate endpoint routing.

### ✍️ Kurdish Sorani Orthography & Natural Dialogue Engine
- **Accurate Kurdish Typography:** Converts punctuation to Arabic-script marks (`,` &rarr; `،`, `;` &rarr; `؛`, `?` &rarr; `؟`).
- **Alphabet Normalization:** Normalizes Arabic Kaf (`ك` &rarr; `ک`), Yaa (`ي`/`ى` &rarr; `ی`), and Teh Marbuta (`ة` &rarr; `ە`).
- **Heavy R (ڕ) & Velarized L (ڵ):** Context-aware Kurdish root and affix orthography corrections (e.g. `ڕۆژ`, `ڕاست`, `ماڵ`, `بەڵێ`, `خۆشحاڵ`).
- **Verbal Prefix & Affix Rejoining:** Reconnects split preverbs and aspect markers (`دە-`, `نا-`, `نە-`, `مە-`, `هەڵ-`, `تێ-`, `پێ-`, `وەر-`).
- **Colloquial Subtitle Slang Preprocessing:** Expands spoken idioms (*gonna, wanna, gotta, hold on a sec, what's up, never mind*) into clear, translatable expressions.
- **Kurdish Numbers Option (٠١٢٣):** Optional toggle to convert Western digits to Kurdish Eastern Arabic digits while protecting technical tags.

### 🎬 Real-Time Subtitle Player & Preview
- **Video-Free Real-Time Preview:** Play subtitles synced to an accurate internal clock with 0.5× to 2× playback speed.
- **Interactive Timeline:** Scannable cue markers, hover timecode tooltip, and smooth scrubbing.
- **Font Scaling:** Dynamic subtitle sizing (`Small`, `Normal`, `Large`, `XL`) with responsive typography.
- **Keyboard Navigation:**
  - <kbd>Space</kbd> Play / Pause
  - <kbd>&larr;</kbd> / <kbd>&rarr;</kbd> Seek &plusmn;5 seconds
  - <kbd>&uarr;</kbd> / <kbd>&darr;</kbd> Jump to previous / next cue
  - <kbd>Esc</kbd> Exit fullscreen preview

### 📝 Live Subtitle Editor & Search
- **Live Two-Way Sync:** Typing in any cue updates the preview screen and refreshes download packages in real time.
- **Instant Search:** Filter cues in real time by dialogue text, cue number, or timestamp.
- **Full Undo / Redo History:** Multi-level history stack with keyboard shortcuts (<kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Y</kbd> / <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd>).
- **Fullscreen Focus Mode:** Distraction-free playback and one-tap cue editing.
- **Editor Toggles:** Show/hide timecodes, sync video position on click, and toggle "Save edits".

### ⚙️ Export & Hardware Compatibility
- **Format Conversion on Export:** Convert between SRT, WebVTT, and ASS/SSA upon download.
- **UTF-8 BOM:** Optional `\uFEFF` byte order mark for Smart TVs, legacy players, and Windows media software.
- **Windows CRLF Line Endings:** Optional `\r\n` line endings for hardware players.

### 🎭 Smart Character Naming & Pronunciation System
- **⚡ Automated Smart Recognition:** Scans subtitle files for speaker prefixes (e.g. `JOHN:`, `[MARY]`) and character mentions, automatically proposing proper Kurdish Sorani names and phonetic pronunciation guides.
- **🗣️ Phonetic Pronunciation Cards:** Attach phonetic guides (e.g., `جۆن (Dzhon)`, `ئارثەر (Ar-ther)`) to preserve character identity across translations.
- **🔄 Replace All in Subtitles:** Instantly replaces character names across all cues in the live editor, video player, and export files.
- **🎯 Typo & Spelling Variation Protection:** Matches common spelling variations or typos (e.g., replacing `Jhon` or `Johnn` with `جۆن`).

### 📱 Progressive Web App (PWA) & Native System Integration
- **Direct File Share Target (`share_target`):** Share subtitle files directly from your mobile device or file manager share menu straight into the app.
- **Native File Handler (`file_handlers`):** Double-click or open subtitle files (`.srt`, `.vtt`, `.ass`, `.ssa`, `.smi`, `.sub`, `.txt`) directly with Kurdî Subtitles on desktop and Android.
- **Installable:** Add to home screen on Android, iOS, Windows, macOS, and Linux with custom shortcuts.
- **Offline UI & Player:** Service worker caches app shell, fonts, icons, and player logic so you can edit and preview subtitles without an active internet connection.

---

## 🛠️ Architecture & Source Code

Static, build-free modular architecture (vanilla ES6 JavaScript, HTML5, CSS3):

```
├── index.html              # Main application single-page layout
├── manifest.json           # PWA metadata, standalone display & icons
├── sw.js                   # Service worker cache strategy (offline app shell)
├── metadata.json           # Application metadata
├── AGENTS.md               # Architecture documentation & coding guidelines
├── assets/
│   ├── css/
│   │   └── style.css       # Material 3 adaptive dark theme design system
│   ├── icons/              # PWA icons (192, 512, maskable 512, apple-touch, SVG)
│   └── js/
│       ├── parser.js       # Subtitle parser & serializer (SRT, VTT, ASS, SSA, SUB, SMI, TXT)
│       ├── translator.js   # Batch translation engine, rate-limit retry, Sorani normalizer
│       ├── player.js       # Real-time subtitle preview player & timeline controller
│       ├── i18n.js         # Kurdish Sorani (ckb) and English (en) localization dictionaries
│       ├── toast.js        # Non-intrusive interactive notification system
│       └── app.js          # Main UI controller, event delegation, history & PWA registration
```

### Script Execution Order
Scripts load in classic lexical scope in this exact sequence:
1. [`parser.js`](file:///home/lost/Desktop/app/assets/js/parser.js) &rarr; exposes `SubParser`
2. [`translator.js`](file:///home/lost/Desktop/app/assets/js/translator.js) &rarr; exposes `Translator`
3. [`i18n.js`](file:///home/lost/Desktop/app/assets/js/i18n.js) &rarr; exposes `UI_I18N`
4. [`toast.js`](file:///home/lost/Desktop/app/assets/js/toast.js) &rarr; exposes `Toast`
5. [`player.js`](file:///home/lost/Desktop/app/assets/js/player.js) &rarr; exposes `SubtitlePlayer`
6. [`app.js`](file:///home/lost/Desktop/app/assets/js/app.js) &rarr; initializes the UI controller

---

## 💻 Local Development & Testing

No external dependencies, build step, or compilation required.

```bash
# Run local development server
npm run dev
# or: node server.js

# Syntax check all JavaScript files
npm run lint
```

---

## 🌐 Deployment to GitHub Pages

1. Push this repository to GitHub on branch `main`.
2. In your GitHub repository: navigate to **Settings &rarr; Pages**.
3. Under **Build and deployment &rarr; Source**, choose **Deploy from a branch**.
4. Set branch to `main` and folder to `/ (root)`, then click **Save**.
5. Your application is live at `https://<username>.github.io/<repository-name>/`.

---

## 📄 License

Open-source project built for the Kurdish community and subtitling enthusiasts. Feel free to contribute and share!
