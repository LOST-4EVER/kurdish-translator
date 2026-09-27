# Changelog

All notable changes to the **Kurdî Subtitle Translator** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.62.2] - 2026-09-27 (Release v175)

### 🐛 Fixed — Playhead
- **The caret under the timecode bubble no longer pointed at the playhead.** The
  bubble is clamped sideways by `--vn-needle-shift` at the ends of the timeline, but
  the little triangle stayed at the bubble's centre, so it drifted away from the line
  it labels. It now counter-shifts by the same amount; verified algebraically to land
  on the scrubber centre for every bubble width and shift.
- **The bubble was oversized on phones**, swallowing about a third of the ruler. It
  now scales down with the rest of the studio at `max-width: 640px`, and the invisible
  grab area is slightly smaller to match.

### ⚡ Live text updating
- **Typing no longer rebuilds the timeline and overlay on every keystroke.** The Quick
  Text panel is a live editor, and each `input` event re-rendered the cue pills and
  re-ran the overlay pass. The state write stays immediate — undo grouping depends on
  it and the text must never be stale — but the downstream repaint is now coalesced to
  one pass per animation frame. `close()` flushes any queued repaint so the final
  keystroke is never lost, and opening a different cue drops a stale queued repaint
  rather than firing it against the wrong cue.

### 🎨 UI boxes
- **The Quick Text panel's action row was clipped on a phone.** `.vn-quick-header-right`
  is a flex row with no wrapping inside a card that was never wide enough for it, so
  the last control (Done) was cut off and unreachable — the wrapping was only on the
  parent header. It now wraps, and on phones the badge row and the action row each take
  their own full-width line with the actions spread across it.
- The character/word counter no longer wraps onto two lines.
- The panel textarea and the studio's other text boxes got `unicode-bidi: plaintext`
  and `tab-size`.

### ✍️ Text rendering
- **Mixed Kurdish/English lines rendered in the wrong order.** Subtitle text almost
  always contains an embedded English name or term, and the surfaces used
  `unicode-bidi: isolate`, which forces the whole line RTL and pushes the Latin
  fragment to the wrong side. Switched to `plaintext`, which resolves direction per
  line from its own first strong character, across the preview player
  (`.screen-text`), the editor rows (`.ed-input`), the live translation feed
  (`.live-caption`), the studio overlay and the Quick Text shower.

---

## [1.62.1] - 2026-09-27 (Release v174)

### 🐛 Fixed — Video Studio sizing (the mobile layout was unusable)
- **The mobile layer was overriding the base responsive stylesheet.**
  `video-editor-mobile.css` loads after `video-editor.css` and forced a 40px
  minimum on every icon and transport button and a 48×44px play button — on top of
  a base that already scales them to 28px/26px inside a **34px** transport bar. The
  play button therefore overflowed its own bar, and 5×40px of transport controls plus
  the timecode blew the horizontal budget, clipping the header and cutting the last
  tool off the bottom bar. The layer now only *adds* to the base (safe-area insets,
  dynamic viewport units, iOS input zoom, modal scrolling) and no longer restates
  sizes the base already handles.
- **The timeline is now usable on a phone.** It is 5 lanes squeezed into 148px while
  the video stage absorbed every spare pixel above it. It now takes `clamp(176px,
  28dvh, 280px)`. The override replaces the base `flex: 0 0 148px` deliberately and
  without `!important`, so the drag-to-resize handle still wins via its inline style
  and can still shrink the timeline to the base 90px floor.
- The tool bar gained scroll-snap and edge fades so the horizontal overflow reads as
  intentional, and opening a popover now scrolls its own trigger back into view —
  a tool scrolled off-screen used to open a panel pointing at nothing.
- The video lane's "No video loaded" hint ellipsizes instead of running off the edge.

### 🐛 Fixed — Playhead
- **The timecode bubble was clipped at both ends of the timeline.** The scrubber is a
  1px-wide element and the bubble is centred on it, so at 0:00 (and at the end) half
  of it fell outside the scroll canvas. `timeline.js` now clamps the bubble back inside
  via `--vn-needle-shift`. The width is cached through a `ResizeObserver` rather than
  read per frame, so the clamp does not force layout on the playback hot path. The
  bubble also got a 44×34px invisible grab area — the visible target was ~20px tall.

### 🐛 Fixed — Text editing
- **The Quick Text panel deleted subtitle markup on the first keystroke.** It is a
  *live* editor: it loaded a tag-stripped copy of the line into the textarea and wrote
  that stripped string straight back through `updateCueText`. Merely opening a cue with
  `{\an8}`, `{\pos()}`, `{\i1}…{\i0}` or `<i>`/`<b>` and closing it again was enough to
  delete the tags. The textarea now holds the line *body* while leading/trailing tags
  are parked and re-attached on every write, so the panel still offers a clean editing
  surface but the cue survives intact. `_syncFromCurrentState()` also compared the
  stripped body against the raw text, so it always saw a difference and rewrote the
  field (and the cursor) on every undo/redo tick.
- **The Quick Text panel wrote to the wrong cue.** Every write used the index captured
  when the panel opened, but cues are re-sorted by start time on any change. Writes are
  now resolved by cue identity first (reference, then start time) and the index is
  corrected as a side effect.
- **The cue inspector silently deleted subtitle markup.** It loaded a *tag-stripped*
  copy of the cue into the textarea but compared that stripped string against the raw
  `cue.text` on dismiss, so simply opening a cue with `{\an8}`, `{\pos()}` or
  `<i>`/`<b>` and closing it wrote the tags away. The editor now shows and accepts the
  raw text, with metrics still computed from the visible text.
- **Dismissing the inspector always wrote to the cue**, so the X button, the backdrop
  and Escape all saved — there was no way to cancel, and every accidental open/close
  polluted the undo stack. Dismissal is now non-destructive; Save is explicit and only
  fires when the text actually changed, and the button is disabled when it hasn't.
- Added `Ctrl`/`Cmd`+`Enter` to save, `Escape` to cancel from inside the textarea,
  auto-growing the textarea, focus-and-select on open, and a disabled style for the
  Save button.

### 🐛 Fixed — Popovers
- **Toggling "show original" wiped the custom subtitle position.** `emitStyle` was
  still bound directly as a `change` listener on that one checkbox, so the event object
  arrived as the `clearingCustomPos` argument (truthy) and cleared `customPos`. The
  other controls were fixed for this in 1.61.1; this one was missed.
- Popovers are placed from the trigger's rectangle, so rotating the device or opening
  the soft keyboard left one pointing at nothing. They now reposition on `resize`,
  `orientationchange` and `visualViewport` resize.

### 🐛 Fixed — Importing
- **Dropping a file that missed every drop target navigated the browser away**, which
  discarded the unsaved project — the default browser drop handler is now suppressed
  at the window level while the studio is open.
- The drag highlight no longer flickers off when the cursor crosses a child element
  (enter/leave are counted rather than toggled), the cursor shows a copy affordance,
  and the drop filter accepts the formats the parser already supports but the studio
  rejected: `.sbv`, `.lrc`, and `.m2ts`/`.mpg`/`.mpeg`/`.ogv`/`.3gp`/`.flv` for video.

### ♻️ Refactor
- **`video-editor.css` (4832 lines) split into four files** at its existing section
  boundaries: `video-editor.css` (shell, header, stage, transport, timeline, tool
  bar), `video-editor-exporter.css` (exporter, upscaling, MOV pre-import),
  `video-editor-panels.css` (quick text panel, mobile menu, resizer) and
  `video-editor-responsive.css` (breakpoints and HUD/filmstrip sections). Concatenated
  in load order they are byte-identical to the previous file (md5
  `0f6ec01c28315b4b8e8d5bffff76cbb3`), so the cascade is unchanged. All four are in
  the service worker precache; cache bumped to `kurdish-translator-v174`.

---

## [1.62.0] - 2026-09-27 (Release v173)

### ⚡ Performance
- **Translation preprocessing is ~10x faster**: `preprocessSource` ran all ~405
  colloquialism/contraction patterns against every subtitle line. Rules are now indexed by a
  pre-extracted trigger token (`preprocessTrigger`), and patterns containing top-level `|`
  alternation are always run because their trigger is ambiguous. The live token set is
  recomputed whenever a rule actually rewrites the line, so chained rewrites
  (`lookin'` → `looking` → `looking forward`) still apply in order. Verified byte-identical
  output over 380 curated lines and a 20 000-line fuzz corpus; 1500 unique lines went from
  124 ms to 12 ms, and repeated lines are memoized (1 ms).
- **Timeline no longer retains the decoded audio**: the waveform held the full decoded PCM
  `AudioBuffer` for the whole session (a 110 MB track pinned a 110 MB array). It is now
  downsampled once to a fixed 2048-bucket peak envelope and the buffer is released — 8192
  bytes instead, ~14000x smaller, built in 14 ms. Zooming redraws by max-pooling the
  envelope (`_resampleBuckets`), which is allocation-free on redraw.
- The `accuracy` check no longer builds a normalized copy of every original line on each run
  unless that option is actually enabled.

### 🐛 Fixed
- **Blank subtitle lines in ASS output**: "include original" joins the original and the
  translation with a real newline, but the original still carried its literal `\N`. The
  result serialized as `\N\N`, which players render as an empty line between the two
  languages. `normalizeTextForASS` now collapses `\N` sitting next to a real newline, while
  leaving genuine blank lines alone.
- **ASS alignment silently lost on round-trip**: the parser lifts `{\anN}` out of the text
  into `cue.placement`/`cue.align`, so serializing back dropped the alignment and cues
  jumped back to the bottom of the frame. The tag is now re-synthesized from the cue's
  grid position. Plain bottom-centre cues do **not** gain a tag (the `Default` style already
  anchors at 2), and cues positioned with `{\pos}` / MicroDVD `{P:x,y}` — which the parser
  records as `placement: 'custom'` — are left alone, since the coordinates govern and an
  extra anchor would shift them. All 9 `{\anN}` values round-trip exactly.
- **Waveform from a previous file could overwrite the current one**: audio decoding is
  async, so switching files mid-decode painted the old track's waveform. Loads are now
  tagged with a token that is bumped on every load and on unload; a late result is dropped.
  The `AudioContext` is closed on every exit path and the PCM is zeroed after use.
- **`buildBatches` crashed on a blank cue**: a `null`/whitespace-only line reached
  `text.trim()` unguarded and aborted the whole translation run. Blank lines are now skipped
  when building batches.

### 📹 Video Studio loading & unloading
- **New `unloadVideo()`** fully releases a video: stops playback (including simulated
  playback with no media attached), detaches and resets the element, revokes the object
  URL, clears the waveform, hides the specs badge and releases the wake lock. It runs on
  `pagehide` and whenever the tab is hidden, so a long session no longer pins a decoded
  video and a MediaStream in memory.
- `loadVideoFile()` now releases the previous file completely (URL revoked, handle nulled,
  waveform cleared) before attaching the next one, instead of leaking it.
- **Sample video is device-adaptive**: phones and low-memory/low-core devices now get
  720p/30fps/8s/5 Mbps instead of 1080p/60fps/15s/12 Mbps, which previously stalled or
  failed outright on mobile. Canvas fonts and geometry scale with the chosen resolution,
  the recorder is started with a 500 ms timeslice so times are collected, and the animation
  frame is cancelled and the tracks stopped on teardown.
- The specs badge is hidden rather than showing stale dimensions when no file is loaded.

### 🎨 Video sizing & UI
- **Legible subtitles on portrait and square video**: overlay text is sized in `cqi`
  (1% of the container *width*), so a 9:16 video got tiny subtitles. `setAspectRatio()` now
  computes the native aspect and publishes `--vn-sub-scale = clamp((16/9)/applied, 1, 2.2)`,
  which every overlay `cqi` size is multiplied by. A `"16:9"` selector value is parsed via
  `parseAspectRatio()` instead of being taken as a bare number.

### ⚙️ PWA
- Cache bumped to `kurdish-translator-v173` — `parser.js`, `translator.js`, `timeline.js`,
  `video-editor-player.js` and `video-editor-overlay.js` all changed, so installed clients
  would otherwise have kept serving the stale copies.

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
