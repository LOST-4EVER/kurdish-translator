/**
 * video-editor-bubble.js — Floating Interactive Subtitle Bubble Editor for Video Studio.
 * Appears docked at the bottom when clicking subtitle text on the video, text shower,
 * or timeline cue pills. Provides instant live text editing and formatting.
 */
(() => {
  'use strict';

  const hasArabic = (str) => /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(str || '');
  const stripTags = (str) => (str || '').replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, '').trim();

  class VideoEditorBubbleManager {
    constructor() {
      this.els = null;
      this.currentCue = null;
      this.currentIndex = -1;
      this.options = {};
    }

    init(els, options = {}) {
      this.els = els;
      this.options = options;
      this._bindEvents();
    }

    _bindEvents() {
      if (!this.els) return;

      // Textarea live typing
      if (this.els.bubbleTextarea) {
        this.els.bubbleTextarea.addEventListener('input', () => {
          if (this.currentIndex < 0 || !this.currentCue) return;
          const newText = this.els.bubbleTextarea.value;
          this.currentCue.text = newText;
          
          if (window.VideoEditorState) {
            window.VideoEditorState.updateCue(this.currentIndex, { text: newText });
          }

          this._updateStats();

          if (typeof this.options.onTextChange === 'function') {
            this.options.onTextChange(this.currentCue, this.currentIndex, newText);
          }
        });
      }

      // Close button
      if (this.els.bubbleCloseBtn) {
        this.els.bubbleCloseBtn.addEventListener('click', () => {
          this.close();
        });
      }

      // Nudge Start Minus
      if (this.els.bubbleNudgeStartMinus) {
        this.els.bubbleNudgeStartMinus.addEventListener('click', () => {
          if (this.currentIndex < 0 || !window.VideoEditorState) return;
          const cue = window.VideoEditorState.nudgeCueTiming(this.currentIndex, -100, 0);
          if (cue) this._refreshTimingDisplay(cue);
        });
      }

      // Nudge End Plus
      if (this.els.bubbleNudgeEndPlus) {
        this.els.bubbleNudgeEndPlus.addEventListener('click', () => {
          if (this.currentIndex < 0 || !window.VideoEditorState) return;
          const cue = window.VideoEditorState.nudgeCueTiming(this.currentIndex, 0, 100);
          if (cue) this._refreshTimingDisplay(cue);
        });
      }

      // Split button
      if (this.els.bubbleSplitBtn) {
        this.els.bubbleSplitBtn.addEventListener('click', () => {
          if (typeof this.options.onSplit === 'function') {
            this.options.onSplit(this.currentIndex);
          }
        });
      }

      // Delete button
      if (this.els.bubbleDeleteBtn) {
        this.els.bubbleDeleteBtn.addEventListener('click', () => {
          if (this.currentIndex < 0 || !window.VideoEditorState) return;
          const idx = this.currentIndex;
          this.close();
          window.VideoEditorState.deleteCue(idx);
          if (typeof Toast !== 'undefined' && Toast.show) {
            Toast.show('Cue deleted', 'info', { subtext: 'Use Undo (Ctrl+Z) to restore' });
          }
        });
      }

      // Font Family selection
      if (this.els.bubbleFontFamilySel) {
        this.els.bubbleFontFamilySel.addEventListener('change', (e) => {
          if (window.VideoEditorState) {
            window.VideoEditorState.setOverlayConfig({ fontFamily: e.target.value });
          }
        });
      }

      // Font Size chips
      if (this.els.bubbleSizeGroup) {
        this.els.bubbleSizeGroup.addEventListener('click', (e) => {
          const btn = e.target.closest('.vn-bubble-chip');
          if (!btn) return;
          const size = btn.getAttribute('data-size');
          if (size && window.VideoEditorState) {
            window.VideoEditorState.setOverlayConfig({ fontSize: size });
            this._updateSizeActiveChip(size);
          }
        });
      }

      // Placement chips
      if (this.els.bubblePosGroup) {
        this.els.bubblePosGroup.addEventListener('click', (e) => {
          const btn = e.target.closest('.vn-bubble-chip');
          if (!btn) return;
          const pos = btn.getAttribute('data-pos');
          if (pos && window.VideoEditorState) {
            window.VideoEditorState.setOverlayConfig({ position: pos });
            this._updatePosActiveChip(pos);
          }
        });
      }

      // Color dots
      if (this.els.bubbleColorGroup) {
        this.els.bubbleColorGroup.addEventListener('click', (e) => {
          const dot = e.target.closest('.vn-color-dot');
          if (!dot) return;
          const color = dot.getAttribute('data-color');
          if (color && window.VideoEditorState) {
            window.VideoEditorState.setOverlayConfig({ color });
            this._updateColorActiveDot(color);
          }
        });
      }

      // Background dropdown
      if (this.els.bubbleBgSel) {
        this.els.bubbleBgSel.addEventListener('change', (e) => {
          if (window.VideoEditorState) {
            window.VideoEditorState.setOverlayConfig({ bgColor: e.target.value });
          }
        });
      }
    }

    open(cue, index) {
      if (!cue || index < 0 || !this.els || !this.els.bubbleEditor) return;
      this.currentCue = { ...cue };
      this.currentIndex = index;

      // Populate text
      if (this.els.bubbleTextarea) {
        this.els.bubbleTextarea.value = stripTags(cue.text || '');
        this.els.bubbleTextarea.setAttribute('dir', hasArabic(cue.text) ? 'rtl' : 'ltr');
      }

      // Original text if present
      if (this.els.bubbleOrigText) {
        if (cue.origText) {
          this.els.bubbleOrigText.textContent = `Original: ${stripTags(cue.origText)}`;
          this.els.bubbleOrigText.classList.remove('hidden');
        } else {
          this.els.bubbleOrigText.classList.add('hidden');
        }
      }

      this._refreshTimingDisplay(cue);
      this._updateStats();
      this._syncConfigUI();

      this.els.bubbleEditor.classList.remove('hidden');

      // Auto-focus textarea for quick editing
      setTimeout(() => {
        if (this.els.bubbleTextarea) {
          this.els.bubbleTextarea.focus();
          this.els.bubbleTextarea.select();
        }
      }, 50);
    }

    close() {
      if (this.els && this.els.bubbleEditor) {
        this.els.bubbleEditor.classList.add('hidden');
      }
      this.currentIndex = -1;
      this.currentCue = null;
    }

    isOpen() {
      return this.els && this.els.bubbleEditor && !this.els.bubbleEditor.classList.contains('hidden');
    }

    _refreshTimingDisplay(cue) {
      if (!this.els) return;
      if (this.els.bubbleCueBadge) {
        this.els.bubbleCueBadge.textContent = `Cue #${this.currentIndex + 1}`;
      }
      if (this.els.bubbleTimeTag) {
        const startStr = this._formatTime(cue.start);
        const endStr = this._formatTime(cue.end);
        this.els.bubbleTimeTag.textContent = `${startStr} ➔ ${endStr}`;
      }
    }

    _updateStats() {
      if (!this.els || !this.currentCue) return;
      const text = this.els.bubbleTextarea ? this.els.bubbleTextarea.value : (this.currentCue.text || '');
      const charCount = text.replace(/\s+/g, '').length;
      const dur = Math.max(0.3, (this.currentCue.end - this.currentCue.start) / 1000);
      const cps = (charCount / dur).toFixed(1);

      if (this.els.bubblePace) {
        this.els.bubblePace.textContent = `${cps} CPS`;
        if (cps > 20) {
          this.els.bubblePace.className = 'vn-bubble-cps-tag vn-cps-fast';
          this.els.bubblePace.title = 'Fast reading pace - consider extending cue duration or splitting';
        } else if (cps < 5) {
          this.els.bubblePace.className = 'vn-bubble-cps-tag vn-cps-slow';
          this.els.bubblePace.title = 'Slow reading pace';
        } else {
          this.els.bubblePace.className = 'vn-bubble-cps-tag vn-cps-good';
          this.els.bubblePace.title = 'Optimal reading pace';
        }
      }
    }

    _syncConfigUI() {
      if (!window.VideoEditorState || !this.els) return;
      const cfg = window.VideoEditorState.overlayConfig || {};

      if (this.els.bubbleFontFamilySel && cfg.fontFamily) {
        this.els.bubbleFontFamilySel.value = cfg.fontFamily;
      }
      if (cfg.fontSize) {
        this._updateSizeActiveChip(cfg.fontSize);
      }
      if (cfg.position) {
        this._updatePosActiveChip(cfg.position);
      }
      if (cfg.color) {
        this._updateColorActiveDot(cfg.color);
      }
      if (this.els.bubbleBgSel && cfg.bgColor) {
        this.els.bubbleBgSel.value = cfg.bgColor;
      }
    }

    _updateSizeActiveChip(size) {
      if (!this.els || !this.els.bubbleSizeGroup) return;
      const chips = this.els.bubbleSizeGroup.querySelectorAll('.vn-bubble-chip');
      chips.forEach((c) => {
        c.classList.toggle('active', c.getAttribute('data-size') === String(size));
      });
    }

    _updatePosActiveChip(pos) {
      if (!this.els || !this.els.bubblePosGroup) return;
      const chips = this.els.bubblePosGroup.querySelectorAll('.vn-bubble-chip');
      chips.forEach((c) => {
        c.classList.toggle('active', c.getAttribute('data-pos') === String(pos));
      });
    }

    _updateColorActiveDot(color) {
      if (!this.els || !this.els.bubbleColorGroup) return;
      const dots = this.els.bubbleColorGroup.querySelectorAll('.vn-color-dot');
      dots.forEach((d) => {
        d.classList.toggle('active', d.getAttribute('data-color') === String(color));
      });
    }

    _formatTime(ms) {
      if (isNaN(ms) || ms < 0) ms = 0;
      const totalSec = Math.floor(ms / 1000);
      const m = Math.floor(totalSec / 60);
      const s = totalSec % 60;
      const millis = Math.floor(ms % 1000);
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
    }
  }

  window.VideoEditorBubble = new VideoEditorBubbleManager();
})();
