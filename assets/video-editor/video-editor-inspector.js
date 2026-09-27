/**
 * video-editor-inspector.js — Subtitle Cue Diagnostics & Inline Inspector Modal for Video Studio.
 * Computes deep reading metrics (CPS, WPM, duration, word/char counts) and enables
 * immediate Kurdish dialogue refinement.
 */
(() => {
  'use strict';

  const isRtlText = (str) => (!str || !str.trim() || /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(str));
  const stripTags = (str) => (str || '').replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, '').trim();
  const MAX_AUTO_HEIGHT_PX = 320;

  class VideoEditorInspectorController {
    constructor() {
      this.els = null;
      this.activeCue = null;
      this.activeCueIndex = -1;
      this.onSaveCallback = null;
      this.onJumpCallback = null;
      // The untouched text the editor opened with, so dismissing the modal
      // never counts as an edit.
      this._originalText = '';
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
        this.els.cueInfoSaveBtn.addEventListener('click', () => this.save());
      }
      if (this.els.cueInfoJumpBtn) {
        this.els.cueInfoJumpBtn.addEventListener('click', () => {
          if (this.activeCue && this.onJumpCallback) {
            this.onJumpCallback(this.activeCue.start);
            this.close();
          }
        });
      }
      if (this.els.cueInfoTextInput) {
        this.els.cueInfoTextInput.addEventListener('input', () => {
          this._autoGrow();
          this._updateDirtyState();
        });
        // Enter inserts a newline in a textarea, so save needs a modifier.
        this.els.cueInfoTextInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            this.save();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
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

      // Metrics are computed from the visible text, but the editor must show
      // and receive the *raw* text: the cue can carry {\anN}, {\pos()} or
      // <i>/<b> markup, and editing a stripped copy would silently delete it
      // the next time the modal was dismissed.
      const raw = cue.text == null ? '' : String(cue.text);
      this._originalText = raw;
      const cleanText = stripTags(raw);
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

      const isArabic = isRtlText(cleanText);
      if (this.els.cueInfoScriptVal) {
        this.els.cueInfoScriptVal.textContent = isArabic ? 'Kurdish Sorani' : 'Latin / English';
      }

      if (this.els.cueInfoTextInput) {
        this.els.cueInfoTextInput.value = raw;
        this.els.cueInfoTextInput.setAttribute('dir', isArabic ? 'rtl' : 'ltr');
        this._autoGrow();
      }

      if (cue.origText && this.els.cueInfoOrigText) {
        this.els.cueInfoOrigText.textContent = cue.origText;
        if (this.els.cueInfoOrigText.parentElement) {
          this.els.cueInfoOrigText.parentElement.classList.remove('hidden');
        }
      } else if (this.els.cueInfoOrigText && this.els.cueInfoOrigText.parentElement) {
        this.els.cueInfoOrigText.parentElement.classList.add('hidden');
      }

      this._updateDirtyState();
      this.els.cueInfoModal.classList.remove('hidden');

      // Let the browser paint the modal before moving focus into it.
      if (this.els.cueInfoTextInput) {
        requestAnimationFrame(() => {
          if (!this.activeCue) return;
          this.els.cueInfoTextInput.focus();
          this.els.cueInfoTextInput.select();
        });
      }
    }

    _autoGrow() {
      const input = this.els && this.els.cueInfoTextInput;
      if (!input) return;
      input.style.height = 'auto';
      input.style.height = `${Math.min(MAX_AUTO_HEIGHT_PX, input.scrollHeight)}px`;
    }

    _isDirty() {
      const input = this.els && this.els.cueInfoTextInput;
      if (!input) return false;
      return input.value !== this._originalText;
    }

    _updateDirtyState() {
      const btn = this.els && this.els.cueInfoSaveBtn;
      if (!btn) return;
      btn.disabled = !this._isDirty();
      btn.title = this._isDirty()
        ? 'Save Changes (Ctrl+Enter)'
        : 'No changes to save';
    }

    /** Commit the edited text, if it actually changed. */
    save() {
      if (!this.activeCue || !this.els.cueInfoTextInput) return;

      const input = this.els.cueInfoTextInput;
      const newText = input.value;
      if (newText === this._originalText) {
        this.close();
        return;
      }

      const updatedCue = { ...this.activeCue, text: newText };
      if (this.onSaveCallback) {
        this.onSaveCallback(this.activeCueIndex, updatedCue);
      }
      VideoEditorUI.showToast(`Saved Cue #${this.activeCueIndex + 1}`, 'success');
      this._hide();
    }

    /** Dismiss without writing anything back. */
    close() {
      this._hide();
    }

    _hide() {
      if (this.els && this.els.cueInfoModal) {
        this.els.cueInfoModal.classList.add('hidden');
      }
      this.activeCue = null;
      this.activeCueIndex = -1;
      this._originalText = '';
      if (this.els && this.els.cueInfoTextInput) {
        this.els.cueInfoTextInput.value = '';
      }
    }
  }

  window.VideoEditorInspector = new VideoEditorInspectorController();
})();
