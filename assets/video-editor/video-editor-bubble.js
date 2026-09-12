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

      // Auto-focus textarea without selecting all text
      setTimeout(() => {
        if (this.els.bubbleTextarea) {
          this.els.bubbleTextarea.focus();
          const len = this.els.bubbleTextarea.value.length;
          this.els.bubbleTextarea.setSelectionRange(len, len);
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

  /**
   * Dedicated Quick Open-Up Subtitle Text Panel for Focused, Fullscreen-Friendly Kurdish Editing.
   */
  class VideoEditorQuickPanelManager {
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

      // Textarea typing with character-level granularity
      if (this.els.quickTextarea) {
        this.els.quickTextarea.addEventListener('input', () => {
          if (this.currentIndex < 0) return;
          const newText = this.els.quickTextarea.value;
          if (window.VideoEditorState) {
            window.VideoEditorState.updateCueText(this.currentIndex, newText);
          }
          this._updateStats();
          this._updateUndoRedoButtons();
          if (typeof this.options.onTextChange === 'function') {
            this.options.onTextChange(this.currentCue, this.currentIndex, newText);
          }
        });

        this.els.quickTextarea.addEventListener('keydown', (e) => {
          // Ctrl+Z or Cmd+Z for granular Undo
          if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
            e.preventDefault();
            this.undo();
          }
          // Ctrl+Y or Cmd+Shift+Z for granular Redo
          else if (((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) || ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z'))) {
            e.preventDefault();
            this.redo();
          }
          // Alt+Left / Alt+Right for Prev/Next cue
          else if (e.altKey && e.key === 'ArrowLeft') {
            e.preventDefault();
            this._navPrev();
          } else if (e.altKey && e.key === 'ArrowRight') {
            e.preventDefault();
            this._navNext();
          }
          // Ctrl+Enter or Escape to save & close
          else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            this.close();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            this.close();
          }
        });
      }

      // Kurdish Character Chips Click
      if (this.els.quickKurdishBar) {
        this.els.quickKurdishBar.addEventListener('click', (e) => {
          const chip = e.target.closest('.vn-kurdish-chip');
          if (chip && chip.dataset.char) {
            e.preventDefault();
            this._insertTextAtCursor(chip.dataset.char);
          }
        });
      }

      // Kurdish Orthography Fix for current cue
      if (this.els.quickFixOrthographyBtn) {
        this.els.quickFixOrthographyBtn.addEventListener('click', () => {
          this._fixCurrentCueOrthography();
        });
      }

      // Insert Line Break
      if (this.els.quickInsertBreakBtn) {
        this.els.quickInsertBreakBtn.addEventListener('click', () => {
          this._insertTextAtCursor('\n');
        });
      }

      // Copy original text
      if (this.els.quickCopyOrigBtn) {
        this.els.quickCopyOrigBtn.addEventListener('click', () => {
          if (this.currentCue && this.currentCue.origText) {
            navigator.clipboard.writeText(stripTags(this.currentCue.origText)).then(() => {
              if (typeof Toast !== 'undefined' && Toast.show) {
                Toast.show('Copied original text', 'success');
              }
            });
          }
        });
      }

      // Close & Done
      if (this.els.quickDoneBtn) {
        this.els.quickDoneBtn.addEventListener('click', () => this.close());
      }
      if (this.els.quickBackdrop) {
        this.els.quickBackdrop.addEventListener('click', () => this.close());
      }

      // Granular Undo Button
      if (this.els.quickUndoBtn) {
        this.els.quickUndoBtn.addEventListener('click', () => this.undo());
      }

      // Granular Redo Button
      if (this.els.quickRedoBtn) {
        this.els.quickRedoBtn.addEventListener('click', () => this.redo());
      }

      // Navigation Prev & Next
      if (this.els.quickPrevBtn) {
        this.els.quickPrevBtn.addEventListener('click', () => this._navPrev());
      }

      if (this.els.quickNextBtn) {
        this.els.quickNextBtn.addEventListener('click', () => this._navNext());
      }

      // Quick Timing Nudge
      if (this.els.quickNudgeMinus) {
        this.els.quickNudgeMinus.addEventListener('click', () => this._nudgeTiming(-100));
      }
      if (this.els.quickNudgePlus) {
        this.els.quickNudgePlus.addEventListener('click', () => this._nudgeTiming(100));
      }

      // Play Cue
      if (this.els.quickPlayBtn) {
        this.els.quickPlayBtn.addEventListener('click', () => {
          if (this.currentCue && typeof this.options.onPlayCue === 'function') {
            this.options.onPlayCue(this.currentCue);
          }
        });
      }

      // Timing Tray Toggle
      if (this.els.quickTimingToggleBtn && this.els.quickTimingTray) {
        this.els.quickTimingToggleBtn.addEventListener('click', () => {
          this.els.quickTimingTray.classList.toggle('hidden');
        });
      }

      // Fine-grained Timing Adjusters
      this._bindTimingBtn(this.els.quickStartMinus500, -500, 'start');
      this._bindTimingBtn(this.els.quickStartMinus100, -100, 'start');
      this._bindTimingBtn(this.els.quickStartPlus100, 100, 'start');
      this._bindTimingBtn(this.els.quickStartPlus500, 500, 'start');

      this._bindTimingBtn(this.els.quickEndMinus500, -500, 'end');
      this._bindTimingBtn(this.els.quickEndMinus100, -100, 'end');
      this._bindTimingBtn(this.els.quickEndPlus100, 100, 'end');
      this._bindTimingBtn(this.els.quickEndPlus500, 500, 'end');

      // Split button
      if (this.els.quickSplitBtn) {
        this.els.quickSplitBtn.addEventListener('click', () => {
          if (typeof this.options.onSplit === 'function') {
            this.options.onSplit(this.currentIndex);
            // Refresh with new cue after split
            const cues = window.VideoEditorState ? window.VideoEditorState.cues : [];
            if (cues[this.currentIndex]) {
              this.open(cues[this.currentIndex], this.currentIndex);
            }
          }
        });
      }

      // Delete button
      if (this.els.quickDeleteBtn) {
        this.els.quickDeleteBtn.addEventListener('click', () => {
          if (this.currentIndex < 0 || !window.VideoEditorState) return;
          const idx = this.currentIndex;
          window.VideoEditorState.deleteCue(idx);
          const cues = window.VideoEditorState.cues;
          if (cues.length > 0) {
            const nextIdx = Math.min(idx, cues.length - 1);
            this.open(cues[nextIdx], nextIdx);
          } else {
            this.close();
          }
          if (typeof Toast !== 'undefined' && Toast.show) {
            Toast.show('Cue deleted', 'info', { subtext: 'Use Undo (Ctrl+Z) to restore' });
          }
        });
      }

      // Formatting Tray Toggle
      if (this.els.quickStyleToggleBtn && this.els.quickFormatTray) {
        this.els.quickStyleToggleBtn.addEventListener('click', () => {
          this.els.quickFormatTray.classList.toggle('hidden');
        });
      }

      // Style options in quick tray
      if (this.els.quickFontFamilySel) {
        this.els.quickFontFamilySel.addEventListener('change', (e) => {
          if (window.VideoEditorState) {
            window.VideoEditorState.setOverlayConfig({ fontFamily: e.target.value });
          }
        });
      }

      if (this.els.quickSizeGroup) {
        this.els.quickSizeGroup.addEventListener('click', (e) => {
          const btn = e.target.closest('.vn-quick-chip');
          if (!btn) return;
          const size = btn.getAttribute('data-size');
          if (size && window.VideoEditorState) {
            window.VideoEditorState.setOverlayConfig({ fontSize: size });
            this._updateSizeChip(size);
          }
        });
      }

      if (this.els.quickColorGroup) {
        this.els.quickColorGroup.addEventListener('click', (e) => {
          const dot = e.target.closest('.vn-color-dot');
          if (!dot) return;
          const color = dot.getAttribute('data-color');
          if (color && window.VideoEditorState) {
            window.VideoEditorState.setOverlayConfig({ color });
            this._updateColorDot(color);
          }
        });
      }

      if (this.els.quickBgSel) {
        this.els.quickBgSel.addEventListener('change', (e) => {
          if (window.VideoEditorState) {
            window.VideoEditorState.setOverlayConfig({ bgColor: e.target.value });
          }
        });
      }

      // Listen to global undoRedoChange events from State
      if (window.VideoEditorState && window.VideoEditorState.on) {
        window.VideoEditorState.on('undoRedoChange', () => {
          this._updateUndoRedoButtons();
          this._syncFromCurrentState();
        });
      }
    }

    open(cue, index) {
      if (!cue || index < 0 || !this.els || !this.els.quickPanel) return;
      this.currentCue = { ...cue };
      this.currentIndex = index;

      if (this.els.quickTextarea) {
        this.els.quickTextarea.value = stripTags(cue.text || '');
        this.els.quickTextarea.setAttribute('dir', hasArabic(cue.text) ? 'rtl' : 'ltr');
      }

      if (this.els.quickOrigBox && this.els.quickOrigText) {
        if (cue.origText) {
          this.els.quickOrigText.textContent = stripTags(cue.origText);
          this.els.quickOrigBox.classList.remove('hidden');
        } else {
          this.els.quickOrigBox.classList.add('hidden');
        }
      }

      this._refreshTimingDisplay(cue);
      this._updateStats();
      this._updateUndoRedoButtons();
      this._syncFormattingUI();

      this.els.quickPanel.classList.remove('hidden');

      setTimeout(() => {
        if (this.els.quickTextarea) {
          this.els.quickTextarea.focus();
          const len = this.els.quickTextarea.value.length;
          this.els.quickTextarea.setSelectionRange(len, len);
        }
      }, 50);
    }

    close() {
      if (this.els && this.els.quickPanel) {
        this.els.quickPanel.classList.add('hidden');
      }
      this.currentIndex = -1;
      this.currentCue = null;
    }

    isOpen() {
      return this.els && this.els.quickPanel && !this.els.quickPanel.classList.contains('hidden');
    }

    undo() {
      if (!window.VideoEditorState || !window.VideoEditorState.canUndo()) return;
      window.VideoEditorState.undo();
      this._syncFromCurrentState();
      this._updateUndoRedoButtons();
    }

    redo() {
      if (!window.VideoEditorState || !window.VideoEditorState.canRedo()) return;
      window.VideoEditorState.redo();
      this._syncFromCurrentState();
      this._updateUndoRedoButtons();
    }

    _syncFromCurrentState() {
      if (!window.VideoEditorState) return;
      const cues = window.VideoEditorState.cues;
      if (this.currentIndex >= 0 && cues[this.currentIndex]) {
        this.currentCue = cues[this.currentIndex];
        if (this.els.quickTextarea && document.activeElement !== this.els.quickTextarea) {
          this.els.quickTextarea.value = stripTags(this.currentCue.text || '');
        } else if (this.els.quickTextarea && this.els.quickTextarea.value !== this.currentCue.text) {
          const selStart = this.els.quickTextarea.selectionStart;
          const selEnd = this.els.quickTextarea.selectionEnd;
          this.els.quickTextarea.value = stripTags(this.currentCue.text || '');
          try {
            this.els.quickTextarea.setSelectionRange(selStart, selEnd);
          } catch (_) {}
        }
        this._refreshTimingDisplay(this.currentCue);
        this._updateStats();
      }
    }

    _updateUndoRedoButtons() {
      if (!this.els) return;
      const canUndo = window.VideoEditorState ? window.VideoEditorState.canUndo() : false;
      const canRedo = window.VideoEditorState ? window.VideoEditorState.canRedo() : false;

      if (this.els.quickUndoBtn) this.els.quickUndoBtn.disabled = !canUndo;
      if (this.els.quickRedoBtn) this.els.quickRedoBtn.disabled = !canRedo;
      if (this.els.undoBtn) this.els.undoBtn.disabled = !canUndo;
      if (this.els.redoBtn) this.els.redoBtn.disabled = !canRedo;
    }

    _navPrev() {
      if (this.currentIndex > 0) {
        const prevIdx = this.currentIndex - 1;
        const cues = window.VideoEditorState ? window.VideoEditorState.cues : [];
        if (cues[prevIdx]) {
          if (typeof this.options.onSeek === 'function') this.options.onSeek(cues[prevIdx].start);
          this.open(cues[prevIdx], prevIdx);
        }
      }
    }

    _navNext() {
      const cues = window.VideoEditorState ? window.VideoEditorState.cues : [];
      if (this.currentIndex < cues.length - 1) {
        const nextIdx = this.currentIndex + 1;
        if (cues[nextIdx]) {
          if (typeof this.options.onSeek === 'function') this.options.onSeek(cues[nextIdx].start);
          this.open(cues[nextIdx], nextIdx);
        }
      }
    }

    _insertTextAtCursor(charToInsert) {
      if (!this.els || !this.els.quickTextarea) return;
      const ta = this.els.quickTextarea;
      const start = ta.selectionStart != null ? ta.selectionStart : ta.value.length;
      const end = ta.selectionEnd != null ? ta.selectionEnd : ta.value.length;
      const text = ta.value;
      ta.value = text.substring(0, start) + charToInsert + text.substring(end);
      const newPos = start + charToInsert.length;
      ta.focus();
      try {
        ta.setSelectionRange(newPos, newPos);
      } catch (_) {}

      // Trigger input event logic
      if (this.currentIndex >= 0 && window.VideoEditorState) {
        window.VideoEditorState.updateCueText(this.currentIndex, ta.value);
      }
      this._updateStats();
      this._updateUndoRedoButtons();
      if (typeof this.options.onTextChange === 'function') {
        this.options.onTextChange(this.currentCue, this.currentIndex, ta.value);
      }
    }

    _fixCurrentCueOrthography() {
      if (!this.els || !this.els.quickTextarea || this.currentIndex < 0) return;
      let text = this.els.quickTextarea.value;
      if (!text.trim()) return;

      if (typeof TranslatorOrthography !== 'undefined') {
        if (typeof TranslatorOrthography.cleanKurdishText === 'function') {
          text = TranslatorOrthography.cleanKurdishText(text);
        }
        if (typeof TranslatorOrthography.normalizeSoraniPunctuation === 'function') {
          text = TranslatorOrthography.normalizeSoraniPunctuation(text);
        }
        if (typeof TranslatorOrthography.naturalizeDialogue === 'function') {
          text = TranslatorOrthography.naturalizeDialogue(text);
        }
      } else {
        // Fallback robust Kurdish punctuation and orthography normalizer
        text = text
          .replace(/[\u064A\u0649]/g, 'ی')
          .replace(/\u0643/g, 'ک')
          .replace(/\u06C1/g, 'ە')
          .replace(/,/g, '،')
          .replace(/;/g, '؛')
          .replace(/\?/g, '؟')
          .replace(/\s+([،؛؟.!])/g, '$1')
          .replace(/([،؛؟])([^\s،؛؟.!])/g, '$1 $2');
      }

      this.els.quickTextarea.value = text;
      if (window.VideoEditorState) {
        window.VideoEditorState.updateCueText(this.currentIndex, text);
      }
      this._updateStats();
      this._updateUndoRedoButtons();
      if (typeof this.options.onTextChange === 'function') {
        this.options.onTextChange(this.currentCue, this.currentIndex, text);
      }
      if (typeof Toast !== 'undefined' && Toast.show) {
        Toast.show('Kurdish orthography polished', 'success');
      }
    }

    _nudgeTiming(deltaMs) {
      if (this.currentIndex < 0 || !window.VideoEditorState || !this.currentCue) return;
      const cue = this.currentCue;
      const newStart = Math.max(0, cue.start + deltaMs);
      const newEnd = Math.max(newStart + 100, cue.end + deltaMs);
      window.VideoEditorState.updateCueTiming(this.currentIndex, newStart, newEnd);
      this.currentCue.start = newStart;
      this.currentCue.end = newEnd;
      this._refreshTimingDisplay(this.currentCue);
      this._updateStats();
      if (typeof this.options.onSeek === 'function') {
        this.options.onSeek(newStart);
      }
    }

    _bindTimingBtn(btn, deltaMs, targetField) {
      if (!btn) return;
      btn.addEventListener('click', () => {
        if (this.currentIndex < 0 || !window.VideoEditorState || !this.currentCue) return;
        const cue = this.currentCue;
        let newStart = cue.start;
        let newEnd = cue.end;

        if (targetField === 'start') {
          newStart = Math.max(0, newStart + deltaMs);
          if (newStart >= newEnd - 100) newStart = newEnd - 100;
        } else if (targetField === 'end') {
          newEnd = Math.max(newStart + 100, newEnd + deltaMs);
        }

        window.VideoEditorState.updateCueTiming(this.currentIndex, newStart, newEnd);
        this.currentCue.start = newStart;
        this.currentCue.end = newEnd;
        this._refreshTimingDisplay(this.currentCue);
        this._updateStats();
        if (typeof this.options.onSeek === 'function') {
          this.options.onSeek(targetField === 'start' ? newStart : newEnd);
        }
      });
    }

    _refreshTimingDisplay(cue) {
      if (!this.els) return;
      const cues = window.VideoEditorState ? window.VideoEditorState.cues : [];
      if (this.els.quickCueBadge) {
        this.els.quickCueBadge.textContent = `Cue #${this.currentIndex + 1} of ${cues.length || 1}`;
      }
      if (this.els.quickTimeTag) {
        const startStr = this._formatTime(cue.start);
        const endStr = this._formatTime(cue.end);
        this.els.quickTimeTag.textContent = `${startStr} ➔ ${endStr}`;
      }
      if (this.els.quickDurTag) {
        const durSec = ((cue.end - cue.start) / 1000).toFixed(2);
        this.els.quickDurTag.textContent = `(${durSec}s)`;
      }
      if (this.els.quickStartVal) {
        this.els.quickStartVal.textContent = this._formatTime(cue.start);
      }
      if (this.els.quickEndVal) {
        this.els.quickEndVal.textContent = this._formatTime(cue.end);
      }
      if (this.els.quickPrevBtn) {
        this.els.quickPrevBtn.disabled = this.currentIndex <= 0;
      }
      if (this.els.quickNextBtn) {
        this.els.quickNextBtn.disabled = this.currentIndex >= cues.length - 1;
      }
    }

    _updateStats() {
      if (!this.els || !this.currentCue) return;
      const text = this.els.quickTextarea ? this.els.quickTextarea.value : (this.currentCue.text || '');
      const rawChars = text.length;
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      const cleanChars = text.replace(/\s+/g, '').length;
      const dur = Math.max(0.3, (this.currentCue.end - this.currentCue.start) / 1000);
      const cps = (cleanChars / dur).toFixed(1);

      if (this.els.quickCharCount) {
        this.els.quickCharCount.textContent = `${rawChars} chars · ${words} words`;
      }

      if (this.els.quickPace) {
        this.els.quickPace.textContent = `${cps} CPS`;
        if (cps > 20) {
          this.els.quickPace.className = 'vn-quick-cps-tag vn-cps-fast';
          this.els.quickPace.title = 'Fast reading pace - consider extending cue duration or splitting';
        } else if (cps < 5) {
          this.els.quickPace.className = 'vn-quick-cps-tag vn-cps-slow';
          this.els.quickPace.title = 'Slow reading pace';
        } else {
          this.els.quickPace.className = 'vn-quick-cps-tag vn-cps-good';
          this.els.quickPace.title = 'Optimal reading pace';
        }
      }
    }

    _syncFormattingUI() {
      if (!window.VideoEditorState || !this.els) return;
      const cfg = window.VideoEditorState.overlayConfig || {};
      if (this.els.quickFontFamilySel && cfg.fontFamily) {
        this.els.quickFontFamilySel.value = cfg.fontFamily;
      }
      if (cfg.fontSize) {
        this._updateSizeChip(cfg.fontSize);
      }
      if (cfg.color) {
        this._updateColorDot(cfg.color);
      }
      if (this.els.quickBgSel && cfg.bgColor) {
        this.els.quickBgSel.value = cfg.bgColor;
      }
    }

    _updateSizeChip(size) {
      if (!this.els || !this.els.quickSizeGroup) return;
      const chips = this.els.quickSizeGroup.querySelectorAll('.vn-quick-chip');
      chips.forEach((c) => {
        c.classList.toggle('active', c.getAttribute('data-size') === String(size));
      });
    }

    _updateColorDot(color) {
      if (!this.els || !this.els.quickColorGroup) return;
      const dots = this.els.quickColorGroup.querySelectorAll('.vn-color-dot');
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
  window.VideoEditorQuickPanel = new VideoEditorQuickPanelManager();
})();
