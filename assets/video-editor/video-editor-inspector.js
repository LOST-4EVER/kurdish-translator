/**
 * video-editor-inspector.js — Subtitle Cue Diagnostics & Inline Inspector Modal for Video Studio.
 * Computes deep reading metrics (CPS, WPM, duration, word/char counts) and enables
 * immediate Kurdish dialogue refinement.
 */
(() => {
  'use strict';

  const hasArabic = (str) => /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(str || '');
  const stripTags = (str) => (str || '').replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, '').trim();

  class VideoEditorInspectorController {
    constructor() {
      this.els = null;
      this.activeCue = null;
      this.activeCueIndex = -1;
      this.onSaveCallback = null;
      this.onJumpCallback = null;
    }

    init(els, options = {}) {
      this.els = els;
      this.onSaveCallback = options.onSave;
      this.onJumpCallback = options.onJump;

      if (this.els.cueInfoCloseBtn) {
        this.els.cueInfoCloseBtn.addEventListener('click', () => this.close());
      }
      if (this.els.cueInfoModal) {
        this.els.cueInfoModal.addEventListener('click', (e) => {
          if (e.target === this.els.cueInfoModal) this.close();
        });
      }
      if (this.els.cueInfoSaveBtn) {
        this.els.cueInfoSaveBtn.addEventListener('click', () => this._handleSave());
      }
      if (this.els.cueInfoJumpBtn) {
        this.els.cueInfoJumpBtn.addEventListener('click', () => {
          if (this.activeCue && this.onJumpCallback) {
            this.onJumpCallback(this.activeCue.start);
            this.close();
          }
        });
      }
    }

    open(cue, index, totalCuesCount = 0) {
      if (!cue || !this.els.cueInfoModal) return;

      this.activeCue = cue;
      this.activeCueIndex = index;

      if (this.els.cueInfoCueNum) {
        this.els.cueInfoCueNum.textContent = `Cue #${index + 1} of ${totalCuesCount || (index + 1)}`;
      }
      if (this.els.cueInfoStartTime) {
        this.els.cueInfoStartTime.textContent = VideoEditorPlayer.formatTime(cue.start);
      }
      if (this.els.cueInfoEndTime) {
        this.els.cueInfoEndTime.textContent = VideoEditorPlayer.formatTime(cue.end);
      }
      const durationSec = ((cue.end - cue.start) / 1000).toFixed(3);
      if (this.els.cueInfoDuration) {
        this.els.cueInfoDuration.textContent = `${durationSec}s`;
      }

      const cleanText = stripTags(cue.text || '');
      const charCount = cleanText.length;
      const words = cleanText.trim().split(/\s+/).filter(Boolean);
      const wordCount = words.length;
      const dur = Math.max(0.3, (cue.end - cue.start) / 1000);
      const cps = (cleanText.replace(/\s+/g, '').length / dur).toFixed(1);
      const wpm = Math.round((wordCount / dur) * 60);

      if (this.els.cueInfoCpsVal) this.els.cueInfoCpsVal.textContent = `${cps} char/s`;
      if (this.els.cueInfoWpmVal) this.els.cueInfoWpmVal.textContent = `${wpm} wpm`;
      if (this.els.cueInfoCharsVal) this.els.cueInfoCharsVal.textContent = charCount;
      if (this.els.cueInfoWordsVal) this.els.cueInfoWordsVal.textContent = wordCount;

      const isArabic = hasArabic(cleanText);
      if (this.els.cueInfoScriptVal) {
        this.els.cueInfoScriptVal.textContent = isArabic ? 'Kurdish Sorani (RTL)' : 'Latin / English (LTR)';
      }

      if (this.els.cueInfoTextInput) {
        this.els.cueInfoTextInput.value = cleanText;
        this.els.cueInfoTextInput.setAttribute('dir', isArabic ? 'rtl' : 'ltr');
      }

      if (cue.origText && this.els.cueInfoOrigText) {
        this.els.cueInfoOrigText.textContent = cue.origText;
        if (this.els.cueInfoOrigText.parentElement) {
          this.els.cueInfoOrigText.parentElement.classList.remove('hidden');
        }
      } else if (this.els.cueInfoOrigText && this.els.cueInfoOrigText.parentElement) {
        this.els.cueInfoOrigText.parentElement.classList.add('hidden');
      }

      this.els.cueInfoModal.classList.remove('hidden');
    }

    close() {
      if (this.els && this.els.cueInfoModal) {
        this.els.cueInfoModal.classList.add('hidden');
      }
    }

    _handleSave() {
      if (!this.activeCue || !this.els.cueInfoTextInput) return;

      const newText = this.els.cueInfoTextInput.value.trim();
      const updatedCue = { ...this.activeCue, text: newText };

      if (this.onSaveCallback) {
        this.onSaveCallback(this.activeCueIndex, updatedCue);
      }

      VideoEditorUI.showToast(`Saved Cue #${this.activeCueIndex + 1}`, 'success');
      this.close();
    }
  }

  window.VideoEditorInspector = new VideoEditorInspectorController();
})();
