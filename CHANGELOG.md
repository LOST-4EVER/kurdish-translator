# Changelog

All notable changes to the **Kurdî Subtitle Translator** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.61.1] - 2026-09-27 (Release v172)

### 🐛 Fixed — Video Studio
- **Dead `window.VideoEditor` global removed**: `video-editor-player.js`, `mov-importer.js`
  and `mkv-importer.js` referenced a global that never existed (the singleton is
  `window.VideoStudio`). As a result the decoded **audio waveform never reached the
  timeline**, extracted **MKV/MOV subtitle tracks were never pushed to the timeline**,
  MOV trim-in seeking was skipped, and the no-video / no-metadata fallbacks in
  `seekTo()`, `stepSeconds()` and simulated playback always resolved to 0 / 10s.
- **Cue blocks could not be dragged**: `setCues()` reuses existing pills, so their
  handlers closed over stale cue objects. Drag deltas were written to a detached cue
  and read back from the live one, so the drag silently did nothing after any text
  edit. Pills now re-resolve the live cue on every gesture.
- **Redo was inverted**: `undo()` stored the *post-undo* snapshot and `redo()` restored
  it, so redoing a change was a no-op. Redo now restores the pre-undo snapshot and
  pushes a proper undo entry, so redo is itself undoable.
- **Undo hit the wrong cue**: history commands stored array indices, but cues are
  re-sorted by start time on every change. Commands now resolve their target by cue
  identity first. Undo/redo also mark the project dirty again.
- **Play/pause icon broke permanently** whenever simulated playback ran (pressing
  Space with no video loaded) because it overwrote the button's `innerHTML`, deleting
  the icon spans `_updatePlayIcon()` toggles.
- **`stepSeconds()` could pass `Infinity` to `video.currentTime`** (throwing on the
  media element) whenever no finite duration was known.
- **Video went silent after the first export**: the burn engine closed the shared
  `AudioContext` that the media element was attached to. The context is now kept
  alive and the element is re-routed to the default destination.
- **DSP click on loud peaks**: `enhanceSpeechInPlace` switched curve at |x| = 1.0
  (1.0 → 0.632 in a single sample). Now uses a monotonic `tanh` soft knee.
- **Subtitle position reset on every colour change**: `emitStyle` was bound directly
  as a `change`/`input` listener, so the event object was read as "clear custom
  position".
- **Stack overflow on huge scripts**: `Math.max(...cues)` is now a reduce.

### 🔒 Security
- **XSS in the subtitle search preview**: cue text, original text and the search term
  were interpolated into `innerHTML` unescaped. A malicious `.srt`/`.ass` executed
  script when the user searched. Everything is escaped now.
- **Unvalidated style injection in the studio**: `cue.fontFamily` / `cue.color` /
  `cue.fontSize` from imported files reached DOM `style` properties and the burn
  canvas unchecked. `SAFE_FONT_RE` / `SAFE_COLOR_RE` / numeric clamping are now applied
  in `video-editor-overlay.js` and `video-editor-burner.js`, matching `player.js`.

### ⚡ PWA
- **Precache no longer all-or-nothing**: `cache.addAll()` meant a single 404 left the
  installed app with an *empty* cache — no offline support at all, while still
  reporting success. Each asset is now cached independently and failures are logged.
- **Graceful offline fallback for the studio**: `video-editor.html` is fetched from
  the network, then the Cache API, then retried. If all fail, the reduced template is
  used *and* the user is told the studio opened in reduced mode (it is missing 171 of
  245 controls, which previously failed silently).
- Uncached-and-offline requests resolve to a real offline page instead of an
  unhandled rejection. Cache bumped to `kurdish-translator-v172`; `404.html` and the
  new mobile stylesheet are precached.
- The 2s "apply subtitles" poller now only runs while the studio is open instead of
  burning battery for the whole session.

### 📱 Mobile / UI
- New `assets/video-editor/video-editor-mobile.css` (loaded last) applies safe-area
  insets to the header and bottom bar, so they no longer sit under the iPhone notch or
  the Android home indicator.
- `100dvh` throughout the studio layout, so the toolbar is no longer cut off when the
  mobile browser chrome collapses.
- Inputs are forced to ≥16px, stopping iOS Safari from zooming the whole workstation
  when a field is focused.
- Larger transport tap targets in portrait, modals scroll instead of clipping on short
  screens, and `prefers-reduced-motion` is honoured.
- Mouse clicks on the video play/pause immediately instead of waiting out the 240ms
  double-tap window that only touch input needs.

---

## [1.50.0] - 2026-09-16 (Release v150)

### 🔒 Security & Input Sanitization
- **Strict Subtitle Style Sanitization**: Hardened player and canvas overlay against DOM-based Cross-Site Scripting (XSS). Applied `SAFE_FONT_RE` whitelist allowing only trusted font names, `SAFE_COLOR_RE` restricting CSS color values to valid hex (`#RGB`, `#RRGGBB`, `#RRGGBBAA`), rgb(), and hsl() formats, and numeric clamping on font sizes and line heights.
- **Inspector Popup Escaping**: Mandated `escapeHtml()` across all cue inspector panels, hold popups, and Quick-Text displays so malicious subtitle content cannot inject executable scripts.

### ⚡ Service Worker & PWA Performance
- **HTTP 206 Partial Content Range Bypass**: Resolved `DOMException: Entry was not cached` in `sw.js` when streaming or seeking media. The Service Worker now explicitly bypasses `cache.put()` on byte-range responses (`response.status === 206` or requests containing the `Range` header).
- **Service Worker Cache Upgrade**: Versioned cache to `kurdish-translator-v150`, invalidating stale runtime assets and ensuring atomic client updates.

### 🧠 Memory Management & Translation Cache
- **Media Object URL Revocation**: Added explicit `URL.revokeObjectURL()` calls when loading new video or audio files in Video Editor and Pre-Import Inspectors, eliminating multi-megabyte memory leaks on repeated file uploads.
- **FIFO Cache Eviction**: Enhanced in-memory translation cache with a 1,000-item First-In, First-Out (FIFO) eviction limit, preventing unbounded heap consumption during massive multi-hour subtitle batches.

### ✍️ Kurdish Sorani Linguistic Precision
- **Heavy R (`ڕ`) & Velarized L (`ڵ`) Stems**: Fixed regex stem matching in `translator-orthography.js` to account for prefix inflections (`دە-`, `نا-`, `نە-`, `بێ-`) and suffix markers, preventing misclassification of valid Kurdish vocabulary.
- **Dialogue Context Punctuation Safety**: Resolved grammatical suffix placement (`یش`) in compound expressions so suffixes attach to the preceding word before terminal punctuation marks (`.`, `!`, `؟`, `،`).
- **Zero-Width Non-Joiner (ZWNJ) Preservation**: Enforced correct ZWNJ (`\u200C`) boundaries when attaching Sorani verbal prefixes to prevent broken Arabic letter connections.

### 🎨 UI & Design Craft
- **Accessible Inline SVG Icons**: Replaced all remaining raw unicode checkmarks (`✓`) and arrow characters (`➔`) with scalable, responsive SVG icons across download buttons, timeline pills, time tags, and inspectors.
- **Bilingual Interface Polish**: Cleaned up download and copy labels in English and Kurdish Sorani (`Saved!`, `Copied!`, `پاشەکەوت کرا!`, `کۆپی کرا!`) to work harmoniously with visual status badges.

---

## [1.49.0] - 2026-09-14 (Release v149)

### Added
- **MKV & MOV Pre-Import Inspectors**: Comprehensive demuxer dialogs with video stream extraction, multi-track subtitle selection, audio mode routing (Stereo / Mono / Mute), and dialogue frequency boost.
- **Granular Undo / Redo Command Architecture**: Scalable command pattern for subtitle operations (`UPDATE_TEXT`, `UPDATE_TIMING`, `SPLIT_CUE`, `DELETE_CUE`, `ADD_CUE`, `MERGE_CUES`, `SHIFT_ALL`) replacing monolithic JSON state cloning.

---

## [1.48.0] - 2026-09-10 (Release v148)

### Added
- **Hardware & PWA Capabilities Integration**:
  - **Screen WakeLock API**: Prevents screen dimming during video playback and hardware subtitle burning.
  - **Tactile Haptic Feedback API**: Device vibration for timeline snaps, cue cuts, and export completions.
  - **Battery & Concurrency Guard**: Monitors battery levels and CPU core count before initiating heavy canvas encoding.
  - **Web Share API**: 1-click sharing of exported videos and subtitle files.

---

## [1.47.0] - 2026-09-05 (Release v147)

### Added
- **Bidirectional Studio Synchronization**: Real-time two-way synchronization between Subtitle Translator editor and Video Studio timeline.
- **Export Container Options**: Support for MP4 and WebM exports with 5 stylized subtitle visual effects (Drop Shadow, Dual Stroke Outline, Neon Glow, Cinema Letterbox, Box Background).

---

## [1.39.0] - 2026-08-20 (Release v139)

### Added
- **ASS/SSA Positioning Tag Extraction**: Dynamic coordinate calculation for alignment tags (`{\an1}` to `{\an9}`) and explicit coordinates (`{\pos(x, y)}`).
- **Kurdish Virtual Helper Bar**: Quick-access touch panel for Sorani Kurdish specific characters (`ڕ`, `ڵ`, `ێ`, `ۆ`, `ە`, `ڤ`, `ژ`, `پ`, `چ`, `گ`, `،`, `؛`, `؟`).

---

## [1.38.0] - 2026-08-01 (Release v138)

### Added
- **Subtitle Parser Hardening**: Support for SAMI (`.smi`), MicroDVD (`.sub`), and 9-field ASS dialogue lines with embedded commas.
- **Default Transparent Subtitle Backgrounds**: Text outlines and drop shadows defaulting to transparent background strips for an authentic cinema look.
