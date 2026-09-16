# Changelog

All notable changes to the **Kurdî Subtitle Translator** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
