## 2025-02-18 - Subtitle Editor Dynamic Focus Sync
**Learning:** In timeline-based or media-synced document editors, focusing an input field/textarea to edit a specific segment must immediately seek the visual preview to that segment's starting time. Otherwise, a disconnected state occurs where the user is modifying text that is not visible on the preview, leading to cognitive friction.
**Action:** Ensure editing interactions automatically sync timeline position in the playback component.

## 2025-02-18 - Dynamic ARIA Labels on Symbolic Toggle Buttons
**Learning:** Symbolic and icon-only toggle controls (like play/pause) must dynamically update their programmatic descriptors (such as `aria-label`) to match the exact *action* that will be triggered on activation. Text contents like emoji/font symbols are not reliable for screen readers, and a static label misses the state change entirely.
**Action:** Implement real-time `aria-label` updates in state transition functions for play, pause, and other toggle controls.
