## 2025-02-18 - Subtitle Editor Dynamic Focus Sync
**Learning:** In timeline-based or media-synced document editors, focusing an input field/textarea to edit a specific segment must immediately seek the visual preview to that segment's starting time. Otherwise, a disconnected state occurs where the user is modifying text that is not visible on the preview, leading to cognitive friction.
**Action:** Ensure editing interactions automatically sync timeline position in the playback component.

## 2025-02-18 - Dynamic ARIA Labels on Symbolic Toggle Buttons
**Learning:** Symbolic and icon-only toggle controls (like play/pause) must dynamically update their programmatic descriptors (such as `aria-label`) to match the exact *action* that will be triggered on activation. Text contents like emoji/font symbols are not reliable for screen readers, and a static label misses the state change entirely.
**Action:** Implement real-time `aria-label` updates in state transition functions for play, pause, and other toggle controls.

## 2026-08-08 - Contextual Visual Feedback on Action Buttons
**Learning:** Actions with delayed or detached feedback (like "Copy to Clipboard" which only triggers a brief notification or occurs invisibly) cause mild friction as the user's focus remains on the clicked element. Providing direct, inline visual transition (e.g. green check, temporary color/border shift) directly on the clicked button satisfies expectations instantly without requiring scanning of the screen.
**Action:** Transition action buttons (like Copy) to inline success states (e.g., "✓ Copied!") and revert them gracefully after a short timeout.

## 2026-08-09 - Accessible Focus Outlines on Custom Switches & Keyboard Dismiss Controls
**Learning:** Custom UI components (like slider toggle switches built using absolute positioning on opacity-0 inputs) often break native focus rings, rendering them invisible to keyboard-only and screen-reader users. Additionally, in timeline/media synced editors, missing quick-dismiss key shortcuts (like `Escape` or `Ctrl+Enter`) inside text fields locks the keyboard focus and prevents smooth resume of timeline media keys like `Space`.
**Action:** Always map focus states of invisible controls to their visible labels or sibling elements (e.g., `.switch input:focus-visible + .slider`) and provide keyboard shortcuts (`Escape`/`Ctrl+Enter`) to quickly commit and dismiss active input fields.
