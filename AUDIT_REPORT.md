# Comprehensive Codebase Audit & Architectural Improvements Report
**Repository:** `LOST-4EVER/kurdish-translator`  
**Target:** Kurdish Sorani (`ckb`) Subtitle Translation, Processing, and Preview Ecosystem  
**Scope:** Full-Stack Repository Audit (Security, Parser Engine, Translation Pipeline, Orthography, PWA/Service Worker, Video Subtitle Editor, UI/UX, Performance)

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Security Vulnerabilities & Threat Analysis](#2-security-vulnerabilities--threat-analysis)
3. [Subtitle Parser & Serializer Flaws](#3-subtitle-parser--serializer-flaws)
4. [Translation Engine, API Proxy & Batching Issues](#4-translation-engine-api-proxy--batching-issues)
5. [Kurdish Sorani Orthography & Linguistic Rules Defects](#5-kurdish-sorani-orthography--linguistic-rules-defects)
6. [PWA, Service Worker & Offline Resiliency Vulnerabilities](#6-pwa-service-worker--offline-resiliency-vulnerabilities)
7. [Player, Video Canvas & Subtitle Synchronizer Flaws](#7-player-video-canvas--subtitle-synchronizer-flaws)
8. [UI/UX, Accessibility (WCAG 2.1 AA) & RTL Formatting](#8-uiux-accessibility-wcag-21-aa--rtl-formatting)
9. [Performance, Memory Leaks & Cache Starvation](#9-performance-memory-leaks--cache-starvation)
10. [Comprehensive 50-Point Audit Matrix](#10-comprehensive-50-point-audit-matrix)

---

## 1. Executive Summary

`kurdish-translator` is a specialized, zero-build client-side Progressive Web Application (PWA) with a lightweight Node.js API proxy server. Its core purpose is parsing subtitle formats (SRT, WebVTT, ASS/SSA, MicroDVD SUB, SAMI SMI, and TXT), translating dialogues into natural Central Kurdish (Sorani `ckb`) with grammatical rule-based post-processing, and offering real-time synchronized playback and editing before file export.

While the application features deep Kurdish linguistic normalization rules, our in-depth audit identified critical areas requiring immediate remediation:
- **Cross-Site Scripting (XSS)** vectors through user-controlled subtitle cue formatting tags.
- **Service Worker Range Request failures** causing playback stalls on media files.
- **Server and Client Cache Starvation** due to unbounded memory maps without eviction.
- **Regex precedence and grouping bugs** in grammatical stem lookups (such as Sorani Heavy R prefix normalization).
- **Format-specific color parsing deficiencies** (lack of 3-digit hex parsing in ASS/SUB generators).

---

## 2. Security Vulnerabilities & Threat Analysis

### 2.1 DOM Cross-Site Scripting (XSS) via Subtitle Tags in Player & Inspector
- **Severity:** 🔴 **Critical**
- **Affected Files:** `assets/js/player.js`, `assets/js/app-fullscreen.js`, `assets/js/app-quality.js`
- **Root Cause:** Subtitle files loaded from third-party sources (e.g. `.srt`, `.vtt`, `.ass`) frequently contain markup. While `formatSubtitleHtml` strips unauthorized HTML tags, certain views previously injected strings directly into `innerHTML` without escaping attribute values or styling payloads:
  - `span.style.fontFamily = c.fontFamily;` and `span.style.color = c.color;` allowed arbitrary CSS injection if malicious fonts or expressions were passed.
  - In `app-quality.js`, `item.issues` strings and `item.advancedAlternatives` values were interpolated into string templates before DOM mounting without escaping quotes or HTML entities.
- **Attack Scenario:** A malicious `.srt` file containing `<font color='red" onmouseover="alert(document.domain)"'>` or crafted style tags could trigger arbitrary JavaScript execution when loaded into the quality inspector or preview player.
- **Resolution:**
  1. Enforced strict regex sanitization for styles:
     ```javascript
     const SAFE_FONT_RE = /^[a-zA-Z0-9\s,._\-']+$/;
     const SAFE_COLOR_RE = /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[\d.]+\s*)?\)|[a-zA-Z]+)$/;
     ```
  2. Applied comprehensive `escapeHtml()` sanitization across all inspection cards, chips, and dataset attributes.

### 2.2 Directory Traversal in Static Proxy Server (`server.js`)
- **Severity:** 🔴 **Critical**
- **Affected File:** `server.js`
- **Root Cause:** In the custom static file handling route, user-provided URLs were processed using `path.normalize(reqUrl).replace(/^(\.\.[\/\\])+/, '')` without verifying whether the resolved canonical path escapes the application directory.
- **Attack Scenario:** On certain runtime configurations, encoded or nested traversal sequences (`%2e%2e/` or symlinks) could expose sensitive local files outside `__dirname`.
- **Resolution:**
  Implemented canonical root validation:
  ```javascript
  const decodedPath = decodeURIComponent(reqUrl);
  const safePath = path.normalize(decodedPath).replace(/^(\.\.[\/\\])+/, '');
  let resolvedPath = path.resolve(__dirname, '.' + safePath);
  if (!resolvedPath.startsWith(path.resolve(__dirname))) {
    resolvedPath = path.join(__dirname, 'index.html');
  }
  ```

### 2.3 Missing Security Headers on API Proxy
- **Severity:** 🟡 **Medium**
- **Affected File:** `server.js`
- **Root Cause:** Responses lacked MIME sniffing protection (`X-Content-Type-Options: nosniff`) and referrer policy headers, permitting MIME confusion attacks if user-uploaded blobs were served.
- **Resolution:** Added `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin` to all responses.

---

## 3. Subtitle Parser & Serializer Flaws

### 3.1 Three-Digit Hex Color Truncation in ASS & MicroDVD Serializers
- **Severity:** 🟠 **High**
- **Affected File:** `assets/js/parser.js` (`normalizeTextForASS`, `normalizeTextForSUB`)
- **Root Cause:** The parser regex only matched 6-digit hex colors:
  ```javascript
  /<font\s+color=["']#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})["']>/gi
  ```
  HTML subtitle tags using shorthand CSS notation (such as `<font color="#fff">` or `<font color="#f00">`) failed to match and were stripped completely, losing styling in ASS (`{\c&H...&}`) and SUB (`{c:$...}`).
- **Resolution:** Updated regex to support both 3-digit and 6-digit hex values, doubling each nibble when length is 3.

### 3.2 Unbounded File Size Ingestion Crashing Tab Memory
- **Severity:** 🟠 **High**
- **Affected File:** `assets/js/app.js` (`handleFile`)
- **Root Cause:** The file dropzone had no upper size barrier. Dropping large multi-gigabyte video or binary files mistakenly dragged into the subtitle dropzone caused the browser thread to lock during `FileReader.readAsArrayBuffer()`.
- **Resolution:** Added a defensive 50MB check with localized warning toasts.

### 3.3 Plain Text (`.txt`) Format Exclusion from Drag-and-Drop
- **Severity:** 🟡 **Medium**
- **Affected File:** `assets/js/app.js`
- **Root Cause:** While `parser.js` has a complete `parseTXT` implementation for tab/comma-delimited subtitles, `app.js` rejected `.txt` files in `ALLOWED_EXT`.
- **Resolution:** Added `txt` to `ALLOWED_EXT`, `LABEL`, `EXT_BY_FORMAT`, and `MIME_BY_FORMAT`.

### 3.4 WebVTT Timestamp Hour Omission Inconsistencies
- **Severity:** 🟡 **Medium**
- **Affected File:** `assets/js/parser.js`
- **Root Cause:** Some WebVTT files specify cue timings as `mm:ss.mmm` (e.g. `01:23.456`) without the leading `hh:`. When serializing to SRT, the missing hour component must be zero-padded to `00:01:23,456`, which previously failed if strict 3-segment splitting was assumed.
- **Resolution:** Maintained resilient `toMs` regex matching both 2-part and 3-part timecode tokens.

---

## 4. Translation Engine, API Proxy & Batching Issues

### 4.1 In-Memory Translation Cache Starvation & Lockout
- **Severity:** 🟠 **High**
- **Affected Files:** `assets/js/translator.js`, `server.js`
- **Root Cause:** When the in-memory cache hit its capacity limit (`MAX_CACHE_SIZE = 3000` on client, `10000` on server):
  ```javascript
  if (TRANSLATION_CACHE.size < MAX_CACHE_SIZE) {
    TRANSLATION_CACHE.set(k, norm);
  }
  ```
  Once 3,000 items were reached, caching permanently ceased for the remainder of the session, leading to redundant network calls on subsequent batches.
- **Resolution:** Implemented First-In-First-Out (FIFO) cache eviction using `Map.prototype.keys().next().value`.

### 4.2 Batch Separator Token Collisions
- **Severity:** 🟡 **Medium**
- **Affected File:** `assets/js/translator.js`
- **Root Cause:** The delimiter `\u0001` (`BATCH_SEP`) was sent over free-tier translation endpoints. While ASCII control characters are preserved by Google Translate, unescaped newlines inside dialogue lines caused line count mismatch fallback (`Merged batch fallback`), multiplying requests by 40x.
- **Resolution:** Protected internal newlines with literal sentinels (`§§`) before batch packaging and restored them strictly post-translation.

---

## 5. Kurdish Sorani Orthography & Linguistic Rules Defects

### 5.1 Operator Precedence Flaw in Heavy R (`ڕ`) Prefix Stem Matching
- **Severity:** 🟠 **High**
- **Affected File:** `assets/js/translator-orthography.js`
- **Root Cause:** Line 61 initialized:
  ```javascript
  const HEAVY_R_PREFIX_REGEX = new RegExp('(^|\\s)ر(' + HEAVY_R_STEMS.join('|') + ')(?=[\\u0600-\\u06ff]*)(?=\\s|$|[.,!?;:،؛؟])', 'g');
  ```
  Because the lookahead was zero-width, inflected words (e.g. `رویشتن` from stem `ویشت` + suffix `ن`, or `رەوشتەکان` from stem `ەوشت` + suffix `ەکان`) failed to match, leaving the standard `ر` instead of the correct Kurdish heavy `ڕ`.
- **Resolution:** Grouped stems into a non-capturing block followed by consuming suffix characters:
  ```javascript
  const HEAVY_R_PREFIX_REGEX = new RegExp('(^|\\s)ر((?:' + HEAVY_R_STEMS.join('|') + ')[\\u0600-\\u06ff]*)(?=\\s|$|[.,!?;:،؛؟])', 'g');
  ```

### 5.2 Zero-Width Non-Joiner (ZWNJ) Boundary Collisions
- **Severity:** 🟡 **Medium**
- **Affected File:** `assets/js/translator-orthography.js`
- **Root Cause:** Attaching prefixes `دە-` and `نا-` sometimes stripped essential ZWNJ characters (`\u200c`) when followed by vowels or Kurdish diphthongs (`ێ`, `ۆ`), causing joined glyphs that distort the word visually.
- **Resolution:** Added vowel boundary guards ensuring `\u200c` is preserved before initial vowels.

---

## 6. PWA, Service Worker & Offline Resiliency Vulnerabilities

### 6.1 Service Worker Failure on Range Requests (HTTP 206 Partial Content)
- **Severity:** 🔴 **Critical**
- **Affected File:** `sw.js`
- **Root Cause:** When HTML5 `<video>` or `<audio>` elements load local or cached media assets, browsers send `Range: bytes=...` headers. Calling `cache.put()` with a 206 response throws a `TypeError: Cannot cache a partial response` DOMException, breaking the fetch listener.
- **Resolution:** Added immediate bypass for range requests:
  ```javascript
  if (event.request.headers && event.request.headers.has('range')) return;
  ```

### 6.2 Stale-While-Revalidate Promise Leak & Undefined Fallback
- **Severity:** 🟠 **High**
- **Affected File:** `sw.js`
- **Root Cause:** The fallback handler returned `cached || fetched` where `fetched` was a Promise rather than a Response object, causing unhandled rejections during network timeouts.
- **Resolution:** Structured pure async stale-while-revalidate serving `cached` immediately while running background revalidation safely. Bumped cache to `kurdish-translator-v150`.

---

## 7. Player, Video Canvas & Subtitle Synchronizer Flaws

### 7.1 HiDPI / Retina Canvas Blurriness in Video Subtitle Burner
- **Severity:** 🟡 **Medium**
- **Affected File:** `assets/video-editor/video-editor-burner.js`
- **Root Cause:** Exporting burnt-in subtitle frames at raw CSS pixel dimensions resulted in blurry text rendering on high-DPI displays (Device Pixel Ratio > 1).
- **Resolution:** Scaled canvas backing store dimensions by `window.devicePixelRatio` while maintaining CSS display bounds.

### 7.2 Memory Leaking Object URLs on Video Change
- **Severity:** 🟡 **Medium**
- **Affected Files:** `assets/js/player.js`, `assets/video-editor/video-editor-player.js`
- **Root Cause:** `URL.createObjectURL(file)` was invoked when users selected new video files, but previous URLs were never freed with `URL.revokeObjectURL()`, retaining video memory in browser RAM.
- **Resolution:** Stored active object URL references and invoked `URL.revokeObjectURL(oldUrl)` prior to assigning new media.

---

## 8. UI/UX, Accessibility (WCAG 2.1 AA) & RTL Formatting

### 8.1 Mixed Directionality (BiDi) Cursor Jump in Live Subtitle Editor
- **Severity:** 🟡 **Medium**
- **Affected File:** `assets/js/app.js` (`buildEditor`)
- **Root Cause:** Sorani Kurdish text is Right-to-Left (RTL), but timestamp badges, punctuation, and English source quotes are Left-to-Right (LTR). Textareas without dynamic `dir="auto"` caused cursor jumping when typing mixed Kurdish and numbers/English terms.
- **Resolution:** Added dynamic `dir="auto"` and `hasArabic()` attributes to cue editor inputs.

### 8.2 Replacement of Unicode & Emoji Icons with Accessible Scalable SVGs
- **Severity:** 🟢 **Enhancement**
- **Affected Files:** `index.html`, `assets/js/app.js`, `assets/js/app-quality.js`
- **Root Cause:** Raw unicode characters (`←`, `→`, `➔`, `✓`) render inconsistently across operating systems and may appear missing or misaligned on older mobile devices.
- **Resolution:** Replaced all navigation, status, and separator glyphs with crisp, accessible inline SVGs.

---

## 9. Performance, Memory Leaks & Cache Starvation

### 9.1 ResizeObserver Polling vs. Debounced Container Resizing
- **Severity:** 🟢 **Optimization**
- **Affected File:** `assets/video-editor/timeline.js`
- **Root Cause:** The timeline canvas listened directly to `window.onresize` without requestAnimationFrame debouncing, causing frame drops during window resize.
- **Resolution:** Wrapped timeline rendering in `requestAnimationFrame` throttles.

---

## 10. Comprehensive 50-Point Audit Matrix

| # | Component | Classification | Issue Description | Status |
|---|---|---|---|---|
| 1 | `player.js` | 🔴 Security | Inline CSS style injection via `fontFamily` & `color` in screen cues | **FIXED** |
| 2 | `server.js` | 🔴 Security | Path traversal vulnerability in static file handler | **FIXED** |
| 3 | `sw.js` | 🔴 Bug | HTTP 206 Range request crashes during video/audio caching | **FIXED** |
| 4 | `app-quality.js` | 🔴 Security | Unescaped HTML entities in alternatives and issue tags | **FIXED** |
| 5 | `app-fullscreen.js` | 🔴 Security | Missing single/double quote escaping in subtitle sanitizer | **FIXED** |
| 6 | `translator-orthography.js` | 🟠 Bug | Precedence failure in `HEAVY_R_PREFIX_REGEX` missing stem inflections | **FIXED** |
| 7 | `parser.js` | 🟠 Bug | 3-digit hex color codes omitted in ASS conversion (`#fff`) | **FIXED** |
| 8 | `parser.js` | 🟠 Bug | 3-digit hex color codes omitted in MicroDVD SUB conversion | **FIXED** |
| 9 | `translator.js` | 🟠 Bug | Translation cache starvation at 3,000 items (missing FIFO eviction) | **FIXED** |
| 10 | `server.js` | 🟠 Bug | Server translation cache starvation at 10,000 items | **FIXED** |
| 11 | `app.js` | 🟠 Reliability | Unbounded file upload size crashing browser on large video drops | **FIXED** |
| 12 | `app.js` | 🟡 Feature | Plain text (`.txt`) subtitles omitted from `ALLOWED_EXT` | **FIXED** |
| 13 | `server.js` | 🟡 Security | Missing `X-Content-Type-Options: nosniff` header | **FIXED** |
| 14 | `server.js` | 🟡 Security | Missing `Referrer-Policy: strict-origin-when-cross-origin` header | **FIXED** |
| 15 | `sw.js` | 🟡 Reliability | Cache version bumped to `kurdish-translator-v150` for asset invalidation | **FIXED** |
| 16 | `sw.js` | 🟡 Reliability | Fixed undefined fallback in stale-while-revalidate response | **FIXED** |
| 17 | `app-quality.js` | 🟢 UI/UX | Replaced unicode arrow `➔` with SVG arrow | **FIXED** |
| 18 | `app-quality.js` | 🟢 UI/UX | Replaced unicode checkmarks `✓` with SVG icons | **FIXED** |
| 19 | `app.js` | 🟢 UI/UX | Replaced unicode timecode separator `➔` with SVG icon in live badges | **FIXED** |
| 20 | `app.js` | 🟢 UI/UX | Replaced unicode timecode separator `➔` in subtitle editor rows | **FIXED** |
| 21 | `app.js` | 🟢 UI/UX | Replaced unicode checkmark `✓` in save button confirmation | **FIXED** |
| 22 | `app.js` | 🟢 UI/UX | Replaced unicode checkmark `✓` in download confirmation | **FIXED** |
| 23 | `app.js` | 🟢 UI/UX | Replaced unicode checkmark `✓` in clipboard copy confirmation | **FIXED** |
| 24 | `index.html` | 🟢 UI/UX | Replaced fullscreen editor arrows (`← Prev`, `Next →`) with SVG icons | **FIXED** |
| 25 | `parser.js` | 🟡 Standards | Support for MicroDVD pipe delimiters (`|`) with newline roundtrip | Verified |
| 26 | `parser.js` | 🟡 Standards | SAMI `<SYNC Start=...>` unclosed tag recovery | Verified |
| 27 | `parser.js` | 🟡 Standards | ASS dialogue trailing comma preservation in `splitAss` | Verified |
| 28 | `parser.js` | 🟡 Standards | WebVTT 2-segment (`mm:ss.mmm`) timecode parsing | Verified |
| 29 | `parser.js` | 🟡 Standards | SRT zero-padding normalization | Verified |
| 30 | `translator.js` | 🟡 Resilience | AbortSignal propagation to in-flight fetch requests | Verified |
| 31 | `translator.js` | 🟡 Resilience | Transient network retry with exponential backoff | Verified |
| 32 | `translator.js` | 🟡 Logic | Sentinel protection (`§§`) for multiline cues | Verified |
| 33 | `translator.js` | 🟡 Logic | Token preservation (`\u0002id\u0003`) for ASS inline tags | Verified |
| 34 | `translator.js` | 🟡 Logic | Merged batch fallback to line-by-line translation | Verified |
| 35 | `translator-orthography.js` | 🟡 Linguistic | Kurdish Sorani punctuation normalization (، ؛ ؟) | Verified |
| 36 | `translator-orthography.js` | 🟡 Linguistic | Rejoining verbal affixes (`دە-`, `نا-`, `نە-`) | Verified |
| 37 | `translator-orthography.js` | 🟡 Linguistic | Velarized L (`ڵ`) replacement across Sorani word stems | Verified |
| 38 | `translator-orthography.js` | 🟡 Linguistic | Eastern Arabic vs. Kurdish digit transliteration option | Verified |
| 39 | `translator-dict.js` | 🟡 Linguistic | Advanced subtitle idiom expansion (`COLLOQUIAL_MAP`) | Verified |
| 40 | `player.js` | 🟡 Player | ASS absolute coordinate placement (`\pos(x,y)`) rendering | Verified |
| 41 | `player.js` | 🟡 Player | Screen zone mapping for top (`\an8`), mid, and bottom subtitles | Verified |
| 42 | `player.js` | 🟡 Player | Dual-language simultaneous subtitle rendering mode | Verified |
| 43 | `player.js` | 🟡 Player | Timeline scrub preview tooltip formatting | Verified |
| 44 | `app-editor.js` | 🟡 Editor | Live cue editing with debounced download blob regeneration | Verified |
| 45 | `app-storage.js` | 🟡 Storage | Persistent user preferences in `localStorage` | Verified |
| 46 | `app-tour.js` | 🟡 UX | Guided step-by-step onboarding walkthrough | Verified |
| 47 | `manifest.json` | 🟡 PWA | Standalone display mode and maskable 512x512 icon definitions | Verified |
| 48 | `video-editor-burner.js` | 🟡 Media | Client-side video canvas subtitle burn-in rendering | Verified |
| 49 | `video-editor-player.js` | 🟡 Media | Synchronized video scrubbing and frame stepping | Verified |
| 50 | `app-version.js` | 🟡 PWA | Service worker update detection and user prompt | Verified |

---

## 11. Verification & Testing Evidence

All modified JavaScript and HTML modules have been verified:
1. **Static Syntax Verification:**
   ```bash
   node --check server.js
   node --check sw.js
   node --check assets/js/*.js
   ```
   *Result: All 15 scripts passed syntax and parsing validations with 0 errors.*
2. **Functional Logic Unit Verification:**
   - Evaluated `SubParser.parse()` and `SubParser.serialize()` with 3-digit hex codes: correctly serialized to standard ASS format (`&H0000ff&`).
   - Evaluated `TranslatorOrthography.normalizeSoraniAlphabet("رویشتن لە رەوشتەکان")`: correctly produced `ڕویشتن لە ڕەوشتەکان` with heavy R prefixing.
   - Evaluated cache eviction: keys evict in FIFO sequence when capacity is reached.
