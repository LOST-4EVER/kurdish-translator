/**
 * video-editor-popovers.js — Bottom Toolbar Popovers Manager for Video Studio.
 * Handles interactive flyout panels for Style, Sync, Speed, and Volume.
 */
(() => {
  'use strict';

  class VideoEditorPopoversManager {
    constructor() {
      this.els = null;
      this.activePopover = null;
      this.onStyleChangeCallback = null;
      this.onSyncChangeCallback = null;
      this.onSpeedChangeCallback = null;
    }

    init(els, options = {}) {
      this.els = els;
      this.onStyleChangeCallback = options.onStyleChange;
      this.onSyncChangeCallback = options.onSyncChange;
      this.onSpeedChangeCallback = options.onSpeedChange;

      this._bindTriggers();
      this._bindControls();
    }

    _bindTriggers() {
      if (this.els.toolStyleBtn) {
        this.els.toolStyleBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggle('style', this.els.toolStyleBtn);
        });
      }
      if (this.els.toolSyncBtn) {
        this.els.toolSyncBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggle('sync', this.els.toolSyncBtn);
        });
      }
      if (this.els.syncPillBtn) {
        this.els.syncPillBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggle('sync', this.els.syncPillBtn);
        });
      }
      if (this.els.toolSpeedBtn) {
        this.els.toolSpeedBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggle('speed', this.els.toolSpeedBtn);
        });
      }
      if (this.els.toolVolumeBtn) {
        this.els.toolVolumeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggle('volume', this.els.toolVolumeBtn);
        });
      }
      if (this.els.toolSubToolsBtn) {
        this.els.toolSubToolsBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggle('tools', this.els.toolSubToolsBtn);
        });
      }
      if (this.els.moreBtn) {
        this.els.moreBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggle('more', this.els.moreBtn);
        });
      }

      // Close buttons inside popovers
      if (this.els.closeStylePop) this.els.closeStylePop.addEventListener('click', () => this.closeAll());
      if (this.els.closeSyncPop) this.els.closeSyncPop.addEventListener('click', () => this.closeAll());
      if (this.els.closeSpeedPop) this.els.closeSpeedPop.addEventListener('click', () => this.closeAll());
      if (this.els.closeVolumePop) this.els.closeVolumePop.addEventListener('click', () => this.closeAll());
      if (this.els.closeSubToolsPop) this.els.closeSubToolsPop.addEventListener('click', () => this.closeAll());
      if (this.els.closeMorePop) this.els.closeMorePop.addEventListener('click', () => this.closeAll());

      // Mobile More Menu Actions
      if (this.els.moreImportSubBtn) {
        this.els.moreImportSubBtn.addEventListener('click', () => {
          this.closeAll();
          if (this.els.subFileInput) this.els.subFileInput.click();
        });
      }
      if (this.els.moreChangeVideoBtn) {
        this.els.moreChangeVideoBtn.addEventListener('click', () => {
          this.closeAll();
          if (this.els.videoFileInput) this.els.videoFileInput.click();
        });
      }
      if (this.els.moreSampleVideoBtn) {
        this.els.moreSampleVideoBtn.addEventListener('click', () => {
          this.closeAll();
          if (this.els.btnSampleVideo) this.els.btnSampleVideo.click();
        });
      }
      if (this.els.moreHelpBtn) {
        this.els.moreHelpBtn.addEventListener('click', () => {
          this.closeAll();
          if (this.els.helpModal) this.els.helpModal.classList.remove('hidden');
        });
      }

      // Click outside to dismiss popovers
      document.addEventListener('click', (e) => {
        if (this.activePopover && !e.target.closest('.vn-popover') && !e.target.closest('.vn-tool-btn') && !e.target.closest('#studioSyncPillBtn') && !e.target.closest('#studioMoreBtn')) {
          this.closeAll();
        }
      });
    }

    _bindControls() {
      // Style Controls
      const emitStyle = () => {
        if (this.onStyleChangeCallback) {
          this.onStyleChangeCallback({
            fontFamily: this.els.subFontFamilySel ? this.els.subFontFamilySel.value : "'Noto Naskh Arabic', serif",
            fontSize: this.els.subFontSel ? this.els.subFontSel.value : '1.25',
            position: this.els.subPosSel ? this.els.subPosSel.value : 'bottom',
            color: this.els.subColorSel ? this.els.subColorSel.value : '#ffffff',
            bgColor: this.els.subBgSel ? this.els.subBgSel.value : 'transparent',
            showOrig: this.els.subShowOrigToggle ? this.els.subShowOrigToggle.checked : false,
          });
        }
      };

      if (this.els.subFontFamilySel) {
        this.els.subFontFamilySel.addEventListener('change', emitStyle);
      }
      if (this.els.subFontSel) {
        this.els.subFontSel.addEventListener('change', emitStyle);
        this.els.subFontSel.addEventListener('input', emitStyle);
      }
      if (this.els.subPosSel) this.els.subPosSel.addEventListener('change', emitStyle);
      if (this.els.subColorSel) {
        this.els.subColorSel.addEventListener('change', emitStyle);
        this.els.subColorSel.addEventListener('input', emitStyle);
      }
      if (this.els.subBgSel) {
        this.els.subBgSel.addEventListener('change', emitStyle);
        this.els.subBgSel.addEventListener('input', emitStyle);
      }
      if (this.els.subShowOrigToggle) this.els.subShowOrigToggle.addEventListener('change', emitStyle);

      // Sync Controls
      const shiftOffset = (delta) => {
        if (this.onSyncChangeCallback) {
          this.onSyncChangeCallback(delta, false);
        }
      };
      if (this.els.offsetMinus500) this.els.offsetMinus500.addEventListener('click', () => shiftOffset(-500));
      if (this.els.offsetMinus100) this.els.offsetMinus100.addEventListener('click', () => shiftOffset(-100));
      if (this.els.offsetPlus100) this.els.offsetPlus100.addEventListener('click', () => shiftOffset(100));
      if (this.els.offsetPlus500) this.els.offsetPlus500.addEventListener('click', () => shiftOffset(500));
      if (this.els.offsetReset) {
        this.els.offsetReset.addEventListener('click', () => {
          if (this.onSyncChangeCallback) this.onSyncChangeCallback(0, true);
        });
      }

      // Speed Controls (with event delegation for rock-solid click handling)
      const speedGrid = document.querySelector('#vnSpeedPopover .vn-speed-grid') || document.querySelector('.vn-speed-grid');
      if (speedGrid) {
        speedGrid.addEventListener('click', (e) => {
          const chip = e.target.closest('.vn-speed-chip');
          if (!chip) return;
          const val = parseFloat(chip.dataset.speed);
          if (!isNaN(val) && val > 0) {
            if (this.onSpeedChangeCallback) this.onSpeedChangeCallback(val);
            this.updateSpeedDisplay(val);
          }
        });
      } else {
        const speedChips = document.querySelectorAll('.vn-speed-chip');
        speedChips.forEach((chip) => {
          chip.addEventListener('click', () => {
            const val = parseFloat(chip.dataset.speed);
            if (!isNaN(val) && val > 0) {
              if (this.onSpeedChangeCallback) this.onSpeedChangeCallback(val);
              this.updateSpeedDisplay(val);
            }
          });
        });
      }

      // Volume Controls
      if (this.els.volumeSlider) {
        const updateVol = (e) => {
          const val = parseFloat(e.target.value);
          if (this.els.videoPlayer) {
            this.els.videoPlayer.volume = val;
            this.els.videoPlayer.muted = false;
          }
        };
        this.els.volumeSlider.addEventListener('input', updateVol);
        this.els.volumeSlider.addEventListener('change', updateVol);
      }
      if (this.els.muteToggle) {
        this.els.muteToggle.addEventListener('click', () => {
          if (!this.els.videoPlayer) return;
          this.els.videoPlayer.muted = !this.els.videoPlayer.muted;
          this.els.muteToggle.classList.toggle('active', this.els.videoPlayer.muted);
        });
      }

      // Subtitle Tools: Auto-Split Long Lines
      if (this.els.btnToolAutoSplit) {
        this.els.btnToolAutoSplit.addEventListener('click', () => {
          const cues = VideoEditorState.getCues();
          if (!cues || !cues.length) {
            VideoEditorUI.showToast('No subtitle cues loaded to split', 'info');
            return;
          }
          let modifiedCount = 0;
          const updated = cues.map((c) => {
            if (!c.text || c.text.includes('\n') || c.text.length < 36) return c;
            // Split line at conjunction or comma
            const splitText = (typeof TranslatorOrthography !== 'undefined' && TranslatorOrthography.splitLongKurdishLine)
              ? TranslatorOrthography.splitLongKurdishLine(c.text)
              : c.text;
            if (splitText !== c.text) {
              modifiedCount++;
              return { ...c, text: splitText };
            }
            return c;
          });
          if (modifiedCount > 0) {
            VideoEditorState.setCues(updated);
            VideoEditorUI.showToast(`Auto-split ${modifiedCount} long subtitle cue(s) into balanced lines`, 'success');
          } else {
            VideoEditorUI.showToast('All subtitle lines are already well-balanced', 'info');
          }
        });
      }

      // Subtitle Tools: Fix Kurdish Orthography
      if (this.els.btnToolCleanOrthography) {
        this.els.btnToolCleanOrthography.addEventListener('click', () => {
          const cues = VideoEditorState.getCues();
          if (!cues || !cues.length) {
            VideoEditorUI.showToast('No subtitle cues loaded', 'info');
            return;
          }
          let modifiedCount = 0;
          const updated = cues.map((c) => {
            if (!c.text) return c;
            const cleaned = (typeof TranslatorOrthography !== 'undefined' && TranslatorOrthography.normalizeText)
              ? TranslatorOrthography.normalizeText(c.text)
              : c.text;
            if (cleaned !== c.text) {
              modifiedCount++;
              return { ...c, text: cleaned };
            }
            return c;
          });
          VideoEditorState.setCues(updated);
          VideoEditorUI.showToast(`Normalized Kurdish orthography & punctuation in ${modifiedCount} cue(s)`, 'success');
        });
      }

      // Subtitle Tools: Search & Replace
      if (this.els.btnToolSearchReplace) {
        this.els.btnToolSearchReplace.addEventListener('click', () => {
          const searchVal = this.els.toolSubSearchInput ? this.els.toolSubSearchInput.value.trim() : '';
          const replaceVal = this.els.toolSubReplaceInput ? this.els.toolSubReplaceInput.value : '';
          if (!searchVal) {
            VideoEditorUI.showToast('Please enter search text', 'info');
            return;
          }
          const cues = VideoEditorState.getCues();
          if (!cues || !cues.length) {
            VideoEditorUI.showToast('No subtitle cues loaded', 'info');
            return;
          }
          let replaceCount = 0;
          const updated = cues.map((c) => {
            if (!c.text || !c.text.includes(searchVal)) return c;
            const newText = c.text.replaceAll(searchVal, replaceVal);
            replaceCount++;
            return { ...c, text: newText };
          });
          if (replaceCount > 0) {
            VideoEditorState.setCues(updated);
            VideoEditorUI.showToast(`Replaced in ${replaceCount} subtitle cue(s)`, 'success');
          } else {
            VideoEditorUI.showToast(`"${searchVal}" not found in subtitle cues`, 'info');
          }
        });
      }

      // Subtitle Tools: Batch Shift
      const shiftToolsOffset = (delta) => {
        if (this.els.toolSubShiftInput) {
          const cur = parseInt(this.els.toolSubShiftInput.value, 10) || 0;
          this.els.toolSubShiftInput.value = cur + delta;
        }
      };
      if (this.els.btnToolShiftMinus500) this.els.btnToolShiftMinus500.addEventListener('click', () => shiftToolsOffset(-500));
      if (this.els.btnToolShiftMinus100) this.els.btnToolShiftMinus100.addEventListener('click', () => shiftToolsOffset(-100));
      if (this.els.btnToolShiftPlus100) this.els.btnToolShiftPlus100.addEventListener('click', () => shiftToolsOffset(100));
      if (this.els.btnToolShiftPlus500) this.els.btnToolShiftPlus500.addEventListener('click', () => shiftToolsOffset(500));
      if (this.els.btnToolApplyShift) {
        this.els.btnToolApplyShift.addEventListener('click', () => {
          const shiftMs = parseInt(this.els.toolSubShiftInput ? this.els.toolSubShiftInput.value : '0', 10) || 0;
          if (shiftMs === 0) {
            VideoEditorUI.showToast('Shift offset is 0ms', 'info');
            return;
          }
          const cues = VideoEditorState.getCues();
          if (!cues || !cues.length) {
            VideoEditorUI.showToast('No subtitle cues loaded', 'info');
            return;
          }
          const updated = cues.map((c) => ({
            ...c,
            start: Math.max(0, (c.start !== undefined ? c.start : (c.startTime || 0)) + shiftMs),
            end: Math.max(100, (c.end !== undefined ? c.end : (c.endTime || 0)) + shiftMs),
            rawStart: null,
            rawEnd: null,
            _shifted: true,
          }));
          VideoEditorState.setCues(updated);
          VideoEditorUI.showToast(`Shifted all subtitles by ${shiftMs > 0 ? '+' : ''}${shiftMs}ms`, 'success');
        });
      }
    }

    updateSpeedDisplay(rate) {
      const speedChips = document.querySelectorAll('.vn-speed-chip');
      speedChips.forEach((c) => {
        const chipSpeed = parseFloat(c.dataset.speed);
        c.classList.toggle('active', Math.abs(chipSpeed - rate) < 0.01);
      });
    }

    toggle(name, triggerBtn) {
      const popover = this.els.popovers[name];
      if (!popover) return;

      const isCurrentlyOpen = this.activePopover === name;
      this.closeAll();

      if (!isCurrentlyOpen) {
        popover.classList.remove('hidden');
        if (triggerBtn) triggerBtn.classList.add('active');
        this.activePopover = name;
      }
    }

    closeAll() {
      Object.values(this.els.popovers).forEach((pop) => {
        if (pop) pop.classList.add('hidden');
      });
      document.querySelectorAll('.vn-tool-btn').forEach((b) => b.classList.remove('active'));
      if (this.els.syncPillBtn) this.els.syncPillBtn.classList.remove('active');
      this.activePopover = null;
    }

    updateSyncDisplay(syncOffsetMs) {
      const sign = syncOffsetMs > 0 ? '+' : '';
      if (this.els.syncOffsetDisplay) {
        this.els.syncOffsetDisplay.textContent = `${sign}${syncOffsetMs}ms`;
      }
      if (this.els.syncBigDisplay) {
        this.els.syncBigDisplay.textContent = `${sign}${syncOffsetMs} ms`;
      }
      if (this.els.syncPillBtn) {
        this.els.syncPillBtn.classList.toggle('offset-active', syncOffsetMs !== 0);
      }
    }
  }

  window.VideoEditorPopovers = new VideoEditorPopoversManager();
})();
