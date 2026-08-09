# Bolt's Performance Journal

## 2025-02-13 - [Event delegation for the editor list]
**Learning:** Attaching multiple event listeners (input, focus, blur, click) to every individual cue row in the subtitle editor list (`.editor-list`) scales poorly (O(N) memory and setup overhead) with larger subtitle files (containing hundreds/thousands of cues). By leveraging event delegation, we can handle input, focusin, focusout, and click at the list level (`els.editorList`), reducing event listeners from 4 * N down to exactly 4.
**Action:** Replace per-row event listeners in `buildEditor` with unified delegation in `init`/`bindActions` on `els.editorList`.
