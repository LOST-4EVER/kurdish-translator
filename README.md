# 🎬 Kurdî Subtitle Translator

Translate subtitle files into **Kurdish (Sorani)** right in your browser.
No upload, no signup, no backend — 100% client-side, hosted free on GitHub Pages.

Target: **Kurdish Sorani / کوردیی ناوەندی** (`ckb`).

## 🗂 Supported formats

| Format | Extension | Notes |
|--------|-----------|-------|
| SRT | `.srt` | Most common |
| WebVTT | `.vtt` | |
| SubStation Alpha | `.ass` | Preserves `{\...}` tags & `\N` line breaks |
| SSA | `.ssa` | |
| MicroDVD | `.sub` | Frame-based with FPS header |
| SAMI | `.smi` | |

Works on desktop, Android, and iOS.

## ✨ Features

- 📂 Drag-and-drop + tap-to-browse file picker — **auto-translates instantly**
- 🎬 Supports 6 formats: SRT, VTT, ASS, SSA, SUB, SMI
- ⚙️ Source language auto-detect or manual pick (target is always Sorani `ckb`); settings remembered
- 🧠 Uses Google Translate's free endpoint (no API key)
- ⚡ Batch translation — many lines per request, with newline protection
- 🛡️ Detects merged/truncated batch responses and re-translates those lines one-by-one
- 🏷️ Preserves formatting tags (`<i>`, `{\an8}`, `\N`, etc.)
- 🔁 Automatic retry with backoff on transient errors
- 🎞️ Built-in preview player: play cues on a 16:9 screen, seek, speed 0.5×–2×
- ✍️ Sorani typography: `,`→`،` `;`→`؛` `?`→`؟`, proper RTL rendering with `Noto Naskh Arabic`
- 📱 Fully responsive mobile UI with progress bar and cancel
- 🔒 Files never leave your device

## 🚀 Deploy to GitHub Pages

1. Create a repo and push this folder:
   ```bash
   git init
   git add .
   git commit -m "Kurdish subtitle translator"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
2. On GitHub: **Settings → Pages → Branch: `main` / `/ (root)` → Save**.
3. Done. Your site is live at `https://<you>.github.io/<repo>/`.

## 🗂 Project Structure

```
├── index.html              # Single-page UI
├── AGENTS.md               # Agent instructions / conventions
├── assets/
│   ├── css/style.css       # Styling / responsive layout
│   └── js/
│       ├── parser.js       # 6 subtitle formats: parse + serialize
│       ├── translator.js   # Google batch translation engine (retry + backoff, Sorani normalization)
│       ├── player.js       # Preview subtitle player (16:9 screen, RTL-aware)
│       └── app.js          # UI logic, file drop/encoding, download
```

Scripts load in this order (do not reorder): `parser.js` → `translator.js` →
`player.js` → `app.js`.

## ⚠️ Note

The free Google endpoint is unofficial and public — expect occasional rate limits
or timeouts on very large files. For large subtitles the app splits requests into
batches and retries each line individually on failure.
