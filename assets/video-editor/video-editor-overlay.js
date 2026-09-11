/**
 * video-editor-overlay.js — Subtitle Overlay & Text Shower Renderer for Video Studio.
 * Renders Kurdish Sorani typography directly over the video viewport and updates
 * the interactive Text Shower strip above the timeline.
 */
(() => {
  'use strict';

  const hasArabic = (str) => /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(str || '');
  const stripTags = (str) => (str || '').replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, '').trim();

  class VideoEditorOverlayRenderer {
    constructor() {
      this.els = null;
    }

    init(els) {
      this.els = els;
    }

    renderActiveCue(cue, config) {
      if (!cue || !this.els || !this.els.videoOverlayText) {
        this.clearOverlay();
        return;
      }

      const kurdishText = stripTags(cue.text || '');
      this.els.videoOverlayText.textContent = kurdishText;
      this.els.videoOverlayText.setAttribute('dir', hasArabic(kurdishText) ? 'rtl' : 'ltr');

      if (config.showOrig && cue.origText && this.els.videoOverlayOrig) {
        this.els.videoOverlayOrig.textContent = stripTags(cue.origText);
        this.els.videoOverlayOrig.classList.remove('hidden');
      } else if (this.els.videoOverlayOrig) {
        this.els.videoOverlayOrig.classList.add('hidden');
      }

      if (this.els.videoOverlayContainer) {
        this.els.videoOverlayContainer.classList.remove('hidden');
      }
    }

    clearOverlay() {
      if (this.els && this.els.videoOverlayContainer) {
        this.els.videoOverlayContainer.classList.add('hidden');
      }
      if (this.els && this.els.videoOverlayText) {
        this.els.videoOverlayText.textContent = '';
      }
    }

    applyStyling(config) {
      if (!this.els) return;
      const container = this.els.videoOverlayContainer;
      const textEl = this.els.videoOverlayText;
      const origEl = this.els.videoOverlayOrig;
      if (!container || !textEl) return;

      container.classList.remove('pos-bottom', 'pos-center', 'pos-top');
      container.classList.add(`pos-${config.position || 'bottom'}`);

      textEl.style.fontSize = `${config.fontSize || '1.25'}rem`;
      if (config.fontFamily) {
        textEl.style.fontFamily = config.fontFamily;
      }
      textEl.style.color = config.color || '#ffffff';
      container.style.backgroundColor = config.bgColor || 'rgba(0, 0, 0, 0.75)';

      if (origEl) {
        origEl.style.fontSize = `${Math.max(0.75, (parseFloat(config.fontSize) || 1.25) * 0.72)}rem`;
      }
    }

    updateTextShower(cue, idx, nearestCue = null) {
      if (!this.els || !this.els.textShowerCard) return;

      if (cue) {
        const text = stripTags(cue.text || '');
        if (this.els.textShowerNum) this.els.textShowerNum.textContent = `#${idx + 1}`;
        if (this.els.textShowerText) {
          this.els.textShowerText.textContent = text;
          this.els.textShowerText.setAttribute('dir', hasArabic(text) ? 'rtl' : 'ltr');
        }

        // Reading Pace
        const charCount = text.replace(/\s+/g, '').length;
        const dur = Math.max(0.3, (cue.end - cue.start) / 1000);
        const cps = (charCount / dur).toFixed(1);

        if (this.els.textShowerPace) {
          this.els.textShowerPace.textContent = `${cps} CPS`;
          this.els.textShowerPace.classList.remove('hidden');
        }
      } else {
        if (nearestCue) {
          if (this.els.textShowerNum) this.els.textShowerNum.textContent = `Next #${nearestCue.index + 1}`;
          if (this.els.textShowerText) {
            this.els.textShowerText.textContent = stripTags(nearestCue.cue.text);
            this.els.textShowerText.setAttribute('dir', hasArabic(nearestCue.cue.text) ? 'rtl' : 'ltr');
          }
        } else {
          if (this.els.textShowerNum) this.els.textShowerNum.textContent = 'No Subtitle';
          if (this.els.textShowerText) {
            this.els.textShowerText.textContent = 'Scrub timeline or click "Apply Subtitles" to load translated cues';
            this.els.textShowerText.removeAttribute('dir');
          }
        }
        if (this.els.textShowerPace) this.els.textShowerPace.classList.add('hidden');
      }
    }
  }

  window.VideoEditorOverlay = new VideoEditorOverlayRenderer();
})();
