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

      // Close buttons inside popovers
      if (this.els.closeStylePop) this.els.closeStylePop.addEventListener('click', () => this.closeAll());
      if (this.els.closeSyncPop) this.els.closeSyncPop.addEventListener('click', () => this.closeAll());
      if (this.els.closeSpeedPop) this.els.closeSpeedPop.addEventListener('click', () => this.closeAll());
      if (this.els.closeVolumePop) this.els.closeVolumePop.addEventListener('click', () => this.closeAll());

      // Click outside to dismiss popovers
      document.addEventListener('click', (e) => {
        if (this.activePopover && !e.target.closest('.vn-popover') && !e.target.closest('.vn-tool-btn') && !e.target.closest('#studioSyncPillBtn')) {
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
            bgColor: this.els.subBgSel ? this.els.subBgSel.value : 'rgba(0, 0, 0, 0.75)',
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
