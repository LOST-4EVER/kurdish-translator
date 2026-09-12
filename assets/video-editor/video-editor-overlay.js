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
      this.options = {};
      this._isDragging = false;
      this._hasMoved = false;
      this._startX = 0;
      this._startY = 0;
      this._startXPct = 50;
      this._startYPct = 88;
      this._currentXPct = 50;
      this._currentYPct = 88;
    }

    init(els, options = {}) {
      this.els = els;
      this.options = options;

      this._bindGestureEvents();
    }

    _bindGestureEvents() {
      const container = this.els?.videoOverlayContainer;
      const viewport = this.els?.viewportWrapper || document.getElementById('studioViewportWrapper');
      if (!container || !viewport) return;

      const guideX = document.getElementById('studioSnapGuideX');
      const guideY = document.getElementById('studioSnapGuideY');

      const activePointers = new Map();

      const getTouchCentroid = (e) => {
        if (e && e.touches && e.touches.length >= 2) {
          return {
            x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
            y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
            count: e.touches.length
          };
        }
        if (activePointers.size >= 2) {
          let sumX = 0;
          let sumY = 0;
          activePointers.forEach((p) => {
            sumX += p.x;
            sumY += p.y;
          });
          return {
            x: sumX / activePointers.size,
            y: sumY / activePointers.size,
            count: activePointers.size
          };
        }
        return null;
      };

      const onPointerDown = (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        e.stopPropagation();

        activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });

        const isTouchDevice = e.pointerType === 'touch' || (e.touches && e.touches.length > 0);
        const centroid = getTouchCentroid(e);

        // Touch devices strictly require 2 fingers / 2 hands to initiate text moving
        if (isTouchDevice) {
          if (!centroid) {
            // Single finger tap/touch - don't drag text, prepare for click selection
            this._isDragging = false;
            this._hasMoved = false;
            return;
          }
          this._isDragging = true;
          this._hasMoved = true;
          this._startX = centroid.x;
          this._startY = centroid.y;
        } else {
          // Desktop / Mouse: standard drag or Shift/Ctrl drag
          this._isDragging = true;
          this._hasMoved = false;
          this._startX = e.clientX;
          this._startY = e.clientY;
        }

        const vpRect = viewport.getBoundingClientRect();
        const cRect = container.getBoundingClientRect();

        const cCenterX = cRect.left + cRect.width / 2;
        const cCenterY = cRect.top + cRect.height / 2;
        this._startXPct = Math.min(95, Math.max(5, ((cCenterX - vpRect.left) / vpRect.width) * 100));
        this._startYPct = Math.min(95, Math.max(5, ((cCenterY - vpRect.top) / vpRect.height) * 100));
        this._currentXPct = this._startXPct;
        this._currentYPct = this._startYPct;

        try {
          container.setPointerCapture(e.pointerId);
        } catch (_) {}
      };

      const onPointerMove = (e) => {
        if (activePointers.has(e.pointerId)) {
          activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
        }

        const isTouchDevice = e.pointerType === 'touch' || (e.touches && e.touches.length > 0);
        const centroid = getTouchCentroid(e);

        if (isTouchDevice && !centroid) {
          // If 2-finger touch released down to 1 finger during drag, stop dragging
          if (this._isDragging) {
            this._isDragging = false;
            container.classList.remove('is-dragging');
            if (guideX) guideX.classList.add('hidden');
            if (guideY) guideY.classList.add('hidden');
          }
          return;
        }

        if (!this._isDragging) return;

        const currentX = centroid ? centroid.x : e.clientX;
        const currentY = centroid ? centroid.y : e.clientY;

        const dx = currentX - this._startX;
        const dy = currentY - this._startY;

        if (!this._hasMoved && Math.hypot(dx, dy) > 4) {
          this._hasMoved = true;
          container.classList.add('is-dragging');
        }

        if (!this._hasMoved) return;

        const vpRect = viewport.getBoundingClientRect();
        if (!vpRect.width || !vpRect.height) return;

        let rawXPct = this._startXPct + (dx / vpRect.width) * 100;
        let rawYPct = this._startYPct + (dy / vpRect.height) * 100;

        let isSnappedX = false;
        if (Math.abs(rawXPct - 50) < 2.5) {
          rawXPct = 50;
          isSnappedX = true;
        }

        let isSnappedY = false;
        if (Math.abs(rawYPct - 50) < 2.5) {
          rawYPct = 50;
          isSnappedY = true;
        } else if (Math.abs(rawYPct - 88) < 2.5) {
          rawYPct = 88;
          isSnappedY = true;
        } else if (Math.abs(rawYPct - 12) < 2.5) {
          rawYPct = 12;
          isSnappedY = true;
        }

        if (guideX) {
          if (isSnappedX) guideX.classList.remove('hidden');
          else guideX.classList.add('hidden');
        }

        if (guideY) {
          if (isSnappedY) guideY.classList.remove('hidden');
          else guideY.classList.add('hidden');
        }

        this._currentXPct = Math.min(94, Math.max(6, rawXPct));
        this._currentYPct = Math.min(94, Math.max(6, rawYPct));

        container.style.left = `${this._currentXPct.toFixed(1)}%`;
        container.style.top = `${this._currentYPct.toFixed(1)}%`;
        container.style.bottom = 'auto';
        container.style.transform = 'translate(-50%, -50%)';
        container.classList.remove('pos-bottom', 'pos-center', 'pos-top');
      };

      const onPointerUp = (e) => {
        activePointers.delete(e.pointerId);

        if (!this._isDragging && !this._hasMoved) {
          // Single-finger tap: open quick editor bubble
          if (typeof this.options.onOverlayClick === 'function') {
            this.options.onOverlayClick();
          }
          return;
        }

        if (activePointers.size > 0 && (e.pointerType === 'touch' || e.touches?.length)) return;

        this._isDragging = false;
        container.classList.remove('is-dragging');

        if (guideX) guideX.classList.add('hidden');
        if (guideY) guideY.classList.add('hidden');

        try {
          if (container.hasPointerCapture(e.pointerId)) {
            container.releasePointerCapture(e.pointerId);
          }
        } catch (_) {}

        if (this._hasMoved) {
          const customPos = {
            xPct: Math.round(this._currentXPct * 10) / 10,
            yPct: Math.round(this._currentYPct * 10) / 10
          };

          if (window.VideoEditorState) {
            window.VideoEditorState.setOverlayConfig({ customPos });
          }
          if (typeof this.options.onPositionChange === 'function') {
            this.options.onPositionChange(customPos);
          }
        }
      };

      const onPointerCancel = (e) => {
        activePointers.delete(e.pointerId);
        this._isDragging = false;
        this._hasMoved = false;
        container.classList.remove('is-dragging');
        if (guideX) guideX.classList.add('hidden');
        if (guideY) guideY.classList.add('hidden');
      };

      container.addEventListener('pointerdown', onPointerDown);
      container.addEventListener('pointermove', onPointerMove);
      container.addEventListener('pointerup', onPointerUp);
      container.addEventListener('pointercancel', onPointerCancel);

      // Double-click to reset position back to bottom
      container.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        if (window.VideoEditorState) {
          window.VideoEditorState.setOverlayConfig({
            position: 'bottom',
            customPos: null
          });
          this.applyStyling(window.VideoEditorState.overlayConfig);
          if (typeof this.options.onPositionChange === 'function') {
            this.options.onPositionChange(null);
          }
        }
      });
    }

    renderActiveCue(cue, config) {
      if (!cue || !this.els || !this.els.videoOverlayText) {
        this.clearOverlay();
        return;
      }

      const kurdishText = stripTags(cue.text || '');
      this.els.videoOverlayText.textContent = kurdishText;
      this.els.videoOverlayText.setAttribute('dir', hasArabic(kurdishText) ? 'rtl' : 'ltr');

      // Check if original English/source text should be displayed alongside Kurdish
      const hasOrig = Boolean(config && config.showOrig && cue.origText && cue.origText.trim() && cue.origText.trim() !== kurdishText.trim());
      if (hasOrig && this.els.videoOverlayOrig) {
        this.els.videoOverlayOrig.textContent = stripTags(cue.origText);
        this.els.videoOverlayOrig.setAttribute('dir', 'ltr');
        this.els.videoOverlayOrig.classList.remove('hidden');
      } else if (this.els.videoOverlayOrig) {
        this.els.videoOverlayOrig.classList.add('hidden');
      }

      const container = this.els.videoOverlayContainer;
      const textEl = this.els.videoOverlayText;

      // Handle format-specific or cue-specific placement (from ASS, VTT, SUB, SAMI)
      if (container && !this._isDragging) {
        if (cue.pos && typeof cue.pos.x === 'number' && typeof cue.pos.y === 'number') {
          const xPct = cue.pos.x > 1 ? Math.min(95, Math.max(5, (cue.pos.x / 1920) * 100)) : (cue.pos.x * 100);
          const yPct = cue.pos.y > 1 ? Math.min(95, Math.max(5, (cue.pos.y / 1080) * 100)) : (cue.pos.y * 100);
          container.style.left = `${xPct}%`;
          container.style.top = `${yPct}%`;
          container.style.bottom = 'auto';
          container.style.transform = 'translate(-50%, -50%)';
          container.classList.remove('pos-bottom', 'pos-center', 'pos-top');
        } else if (cue.placement === 'top') {
          container.style.left = '50%';
          container.style.top = '';
          container.style.bottom = '';
          container.style.transform = '';
          container.classList.remove('pos-bottom', 'pos-center');
          container.classList.add('pos-top');
        } else if (cue.placement === 'center' || cue.placement === 'mid') {
          container.style.left = '50%';
          container.style.top = '';
          container.style.bottom = '';
          container.style.transform = '';
          container.classList.remove('pos-bottom', 'pos-top');
          container.classList.add('pos-center');
        } else if (config.customPos && typeof config.customPos.xPct === 'number' && typeof config.customPos.yPct === 'number') {
          container.style.left = `${config.customPos.xPct}%`;
          container.style.top = `${config.customPos.yPct}%`;
          container.style.bottom = 'auto';
          container.style.transform = 'translate(-50%, -50%)';
          container.classList.remove('pos-bottom', 'pos-center', 'pos-top');
        } else {
          container.style.left = '50%';
          container.style.top = '';
          container.style.bottom = '';
          container.style.transform = '';
          container.classList.remove('pos-bottom', 'pos-center', 'pos-top');
          container.classList.add(`pos-${config.position || 'bottom'}`);
        }
      }

      // Cue-specific font and color
      if (textEl) {
        textEl.style.fontFamily = cue.fontFamily || config.fontFamily || "'Noto Naskh Arabic', 'Vazirmatn', sans-serif";
        textEl.style.color = cue.color || config.color || '#ffffff';
        if (cue.fontSize) {
          textEl.style.fontSize = `clamp(0.85rem, ${(cue.fontSize / 18) * 3.2}cqi, 4.5rem)`;
        } else {
          const baseRem = parseFloat(config.fontSize) || 1.25;
          textEl.style.fontSize = `clamp(0.85rem, ${baseRem * 3.2}cqi, 4.5rem)`;
        }
      }

      if (container) {
        container.classList.remove('hidden');
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

      if (!this._isDragging) {
        if (config.customPos && typeof config.customPos.xPct === 'number' && typeof config.customPos.yPct === 'number') {
          container.style.left = `${config.customPos.xPct}%`;
          container.style.top = `${config.customPos.yPct}%`;
          container.style.bottom = 'auto';
          container.style.transform = 'translate(-50%, -50%)';
          container.classList.remove('pos-bottom', 'pos-center', 'pos-top');
        } else {
          container.style.left = '50%';
          container.style.top = '';
          container.style.bottom = '';
          container.style.transform = '';
          container.classList.remove('pos-bottom', 'pos-center', 'pos-top');
          container.classList.add(`pos-${config.position || 'bottom'}`);
        }
      }

      const baseRem = parseFloat(config.fontSize) || 1.25;
      textEl.style.fontSize = `clamp(0.85rem, ${baseRem * 3.2}cqi, 4.5rem)`;
      if (config.fontFamily) {
        textEl.style.fontFamily = config.fontFamily;
      }
      textEl.style.color = config.color || '#ffffff';
      container.style.backgroundColor = config.bgColor || 'transparent';

      if (origEl) {
        origEl.style.fontSize = `clamp(0.65rem, ${baseRem * 2.3}cqi, 3rem)`;
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
