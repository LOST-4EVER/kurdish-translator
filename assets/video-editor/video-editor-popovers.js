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
            this.els.videoPlayer.muted = (val === 0);
          }
          this._updateVolumeUI(val, val === 0);
        };
        this.els.volumeSlider.addEventListener('input', updateVol);
        this.els.volumeSlider.addEventListener('change', updateVol);
      }

      if (this.els.muteToggle) {
        this.els.muteToggle.addEventListener('click', () => {
          if (!this.els.videoPlayer) return;
          const isMuted = !this.els.videoPlayer.muted;
          this.els.videoPlayer.muted = isMuted;
          const currentVol = isMuted ? 0 : (this.els.videoPlayer.volume || 1);
          if (this.els.volumeSlider) {
            this.els.volumeSlider.value = isMuted ? 0 : currentVol;
          }
          this._updateVolumeUI(currentVol, isMuted);
        });
      }

      // Volume Quick Presets
      const volPresetBtns = document.querySelectorAll('.vn-vol-preset-btn');
      volPresetBtns.forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const targetVol = parseFloat(e.currentTarget.getAttribute('data-vol'));
          if (isNaN(targetVol)) return;
          if (this.els.videoPlayer) {
            if (targetVol === 0) {
              this.els.videoPlayer.muted = true;
            } else {
              this.els.videoPlayer.muted = false;
              this.els.videoPlayer.volume = targetVol;
            }
          }
          if (this.els.volumeSlider) {
            this.els.volumeSlider.value = targetVol;
          }
          this._updateVolumeUI(targetVol, targetVol === 0);
        });
      });

      // Subtitle Tools Tab Navigation
      if (this.els.subToolsTabBar) {
        this.els.subToolsTabBar.addEventListener('click', (e) => {
          const btn = e.target.closest('.vn-tools-tab-btn');
          if (!btn) return;
          const targetTab = btn.getAttribute('data-tab');
          if (!targetTab) return;

          // Update active button
          this.els.subToolsTabBar.querySelectorAll('.vn-tools-tab-btn').forEach((b) => {
            b.classList.toggle('active', b === btn);
          });

          // Show targeted panel
          const panels = {
            orthography: document.getElementById('vnToolsPanelOrthography'),
            split: document.getElementById('vnToolsPanelSplit'),
            search: document.getElementById('vnToolsPanelSearch'),
            shift: document.getElementById('vnToolsPanelShift'),
          };

          Object.keys(panels).forEach((key) => {
            if (panels[key]) {
              panels[key].classList.toggle('hidden', key !== targetTab);
            }
          });
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

      // Subtitle Tools: Advanced Search & Replace
      const updateSearchPreview = () => {
        const searchVal = this.els.toolSubSearchInput ? this.els.toolSubSearchInput.value : '';
        const replaceVal = this.els.toolSubReplaceInput ? this.els.toolSubReplaceInput.value : '';
        const wholeWords = this.els.toolSubWholeWords ? this.els.toolSubWholeWords.checked : false;
        const matchCase = this.els.toolSubMatchCase ? this.els.toolSubMatchCase.checked : false;
        const scope = this.els.toolSubSearchScope ? this.els.toolSubSearchScope.value : 'all';

        const counterEl = this.els.subSearchMatchCounter;
        const previewArea = this.els.subSearchMatchPreviewArea;

        if (!searchVal || !searchVal.trim()) {
          if (counterEl) { counterEl.style.display = 'none'; }
          if (previewArea) { previewArea.classList.add('hidden'); previewArea.innerHTML = ''; }
          return;
        }

        const cues = VideoEditorState.getCues();
        if (!cues || !cues.length) return;

        let flags = 'g';
        if (!matchCase) flags += 'i';
        let escapedSearch = searchVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (wholeWords) escapedSearch = `\\b${escapedSearch}\\b`;
        
        let regex;
        try {
          regex = new RegExp(escapedSearch, flags);
        } catch (e) {
          return;
        }

        const activeCueIndex = VideoEditorState.activeCueIndex;
        let totalMatches = 0;
        let matchingCues = [];

        cues.forEach((cue, idx) => {
          if (scope === 'active' && idx !== activeCueIndex) return;

          const text = cue.text || '';
          const matches = text.match(regex);
          if (matches && matches.length > 0) {
            totalMatches += matches.length;
            matchingCues.push({ cue, index: idx, matchesCount: matches.length });
          }
        });

        if (counterEl) {
          counterEl.textContent = `${totalMatches} match${totalMatches === 1 ? '' : 'es'} in ${matchingCues.length} cue${matchingCues.length === 1 ? '' : 's'}`;
          counterEl.style.display = 'inline-block';
        }

        if (previewArea) {
          if (matchingCues.length === 0) {
            previewArea.classList.remove('hidden');
            previewArea.innerHTML = `<div style="font-size:0.75rem; color:rgba(255,255,255,0.5); text-align:center; padding:8px;">No matches found for "${searchVal}"</div>`;
            return;
          }

          previewArea.classList.remove('hidden');
          previewArea.innerHTML = matchingCues.map(({ cue, index, matchesCount }) => {
            const timeStr = `${VideoEditorPlayer.formatTime(cue.start)} - ${VideoEditorPlayer.formatTime(cue.end)}`;
            const highlightedText = (cue.text || '').replace(regex, (m) => `<mark style="background:#facc15; color:#000000; padding:0 2px; border-radius:2px; font-weight:700;">${m}</mark>`);
            const origBlock = cue.origText ? `<div style="font-size:0.7rem; color:rgba(255,255,255,0.6); font-style:italic; margin-top:2px;">Orig: ${cue.origText}</div>` : '';

            return `
              <div style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); padding:6px 8px; border-radius:5px; font-size:0.76rem; display:flex; flex-direction:column; gap:3px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span class="cue-badge-pill" style="font-size:0.65rem;">Cue #${index + 1} (${timeStr})</span>
                  <button type="button" class="vn-pop-btn vn-pop-btn-primary btn-replace-single" data-index="${index}" style="height:22px; padding:0 8px; font-size:0.68rem;">Replace</button>
                </div>
                <div dir="auto" style="font-family:'Noto Naskh Arabic', sans-serif; line-height:1.4;">${highlightedText}</div>
                ${origBlock}
              </div>
            `;
          }).join('');

          // Bind individual replace buttons
          previewArea.querySelectorAll('.btn-replace-single').forEach((btn) => {
            btn.addEventListener('click', (e) => {
              const cueIdx = parseInt(e.currentTarget.getAttribute('data-index'), 10);
              const allCues = VideoEditorState.getCues();
              if (isNaN(cueIdx) || !allCues[cueIdx]) return;

              const targetCue = allCues[cueIdx];
              const newText = targetCue.text.replace(regex, replaceVal);
              const updatedCues = [...allCues];
              updatedCues[cueIdx] = { ...targetCue, text: newText };
              VideoEditorState.setCues(updatedCues);
              VideoEditorUI.showToast(`Replaced in Cue #${cueIdx + 1}`, 'success');
              updateSearchPreview();
            });
          });
        }
      };

      if (this.els.toolSubSearchInput) this.els.toolSubSearchInput.addEventListener('input', updateSearchPreview);
      if (this.els.toolSubReplaceInput) this.els.toolSubReplaceInput.addEventListener('input', updateSearchPreview);
      if (this.els.toolSubWholeWords) this.els.toolSubWholeWords.addEventListener('change', updateSearchPreview);
      if (this.els.toolSubMatchCase) this.els.toolSubMatchCase.addEventListener('change', updateSearchPreview);
      if (this.els.toolSubSearchScope) this.els.toolSubSearchScope.addEventListener('change', updateSearchPreview);

      if (this.els.btnToolSearchReplace) {
        this.els.btnToolSearchReplace.addEventListener('click', () => {
          const searchVal = this.els.toolSubSearchInput ? this.els.toolSubSearchInput.value : '';
          const replaceVal = this.els.toolSubReplaceInput ? this.els.toolSubReplaceInput.value : '';
          if (!searchVal || !searchVal.trim()) {
            VideoEditorUI.showToast('Please enter search text', 'info');
            return;
          }
          const cues = VideoEditorState.getCues();
          if (!cues || !cues.length) {
            VideoEditorUI.showToast('No subtitle cues loaded', 'info');
            return;
          }

          const wholeWords = this.els.toolSubWholeWords ? this.els.toolSubWholeWords.checked : false;
          const matchCase = this.els.toolSubMatchCase ? this.els.toolSubMatchCase.checked : false;
          const scope = this.els.toolSubSearchScope ? this.els.toolSubSearchScope.value : 'all';

          let flags = 'g';
          if (!matchCase) flags += 'i';
          let escapedSearch = searchVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          if (wholeWords) escapedSearch = `\\b${escapedSearch}\\b`;
          let regex = new RegExp(escapedSearch, flags);

          let replaceCount = 0;
          const activeCueIndex = VideoEditorState.activeCueIndex;

          const updated = cues.map((c, idx) => {
            if (scope === 'active' && idx !== activeCueIndex) return c;
            if (!c.text || !regex.test(c.text)) return c;
            const newText = c.text.replace(regex, replaceVal);
            replaceCount++;
            return { ...c, text: newText };
          });

          if (replaceCount > 0) {
            VideoEditorState.setCues(updated);
            VideoEditorUI.showToast(`Replaced matches in ${replaceCount} subtitle cue(s)`, 'success');
            updateSearchPreview();
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
      if (this.els.btnToolShiftMinus1000) this.els.btnToolShiftMinus1000.addEventListener('click', () => shiftToolsOffset(-1000));
      if (this.els.btnToolShiftMinus500) this.els.btnToolShiftMinus500.addEventListener('click', () => shiftToolsOffset(-500));
      if (this.els.btnToolShiftMinus100) this.els.btnToolShiftMinus100.addEventListener('click', () => shiftToolsOffset(-100));
      if (this.els.btnToolShiftPlus100) this.els.btnToolShiftPlus100.addEventListener('click', () => shiftToolsOffset(100));
      if (this.els.btnToolShiftPlus500) this.els.btnToolShiftPlus500.addEventListener('click', () => shiftToolsOffset(500));
      if (this.els.btnToolShiftPlus1000) this.els.btnToolShiftPlus1000.addEventListener('click', () => shiftToolsOffset(1000));
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

    _updateVolumeUI(vol, isMuted) {
      const pct = isMuted ? 0 : Math.round(vol * 100);
      if (this.els.volumePercentBadge) {
        this.els.volumePercentBadge.textContent = `${pct}%`;
      }
      if (this.els.muteToggle) {
        this.els.muteToggle.classList.toggle('active', isMuted);
        const muteSpan = document.getElementById('studioMuteEmoji');
        if (muteSpan) {
          if (isMuted || pct === 0) {
            muteSpan.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>`;
          } else {
            muteSpan.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
          }
        }
      }
      // Update preset buttons active state
      document.querySelectorAll('.vn-vol-preset-btn').forEach((btn) => {
        const pVol = parseFloat(btn.getAttribute('data-vol'));
        btn.classList.toggle('active', !isMuted && Math.abs(pVol - vol) < 0.05);
      });
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
        this._positionPopover(popover, triggerBtn, name);
      }
    }

    _positionPopover(popover, triggerBtn, name) {
      if (!popover) return;
      const root = document.querySelector('.vn-studio-root') || document.body;
      const rootRect = root.getBoundingClientRect();

      // Top popover (e.g. More menu) handles its own top styling
      if (popover.classList.contains('vn-popover-top')) return;

      if (triggerBtn) {
        const btnRect = triggerBtn.getBoundingClientRect();
        const btnCenter = btnRect.left + btnRect.width / 2 - rootRect.left;
        const popoverWidth = popover.offsetWidth || 300;
        
        let left = btnCenter - popoverWidth / 2;
        // Clamp within margins
        left = Math.max(10, Math.min(rootRect.width - popoverWidth - 10, left));
        
        popover.style.left = `${left}px`;
        popover.style.transform = 'none';
        popover.style.bottom = '52px';
      } else {
        popover.style.left = '50%';
        popover.style.transform = 'translateX(-50%)';
        popover.style.bottom = '52px';
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
