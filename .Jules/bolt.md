# Bolt's Performance Journal

## 2025-02-13 - [Event delegation for the editor list]
**Learning:** Attaching multiple event listeners (input, focus, blur, click) to every individual cue row in the subtitle editor list (`.editor-list`) scales poorly (O(N) memory and setup overhead) with larger subtitle files (containing hundreds/thousands of cues). By leveraging event delegation, we can handle input, focusin, focusout, and click at the list level (`els.editorList`), reducing event listeners from 4 * N down to exactly 4.
**Action:** Replace per-row event listeners in `buildEditor` with unified delegation in `init`/`bindActions` on `els.editorList`.

## 2025-02-14 - [Highly-optimized timecode parsing]
**Learning:** Parsing timecode strings (SRT, WebVTT, SAMI) into milliseconds is on the hot path for parsing subtitle files (executing multiple times per line). The previous implementation allocated multiple arrays via `.split()`, performed regex replacements (`.replace()`), mapped array strings, and padded strings, creating massive GC pressure and CPU overhead on large files. Replacing this with string index searches (`indexOf`) and direct extraction (`substring`/`parseInt`) provides an immediate ~2.2x speedup.
**Action:** Always favor manual index-based string extraction over array splitting/mapping in hot paths such as subtitle parsers and format serializers.
