/**
 * video-editor.js — Master Coordinator for VN Subtitle Studio.
 * Integrates modular subsystems: UI Loader, State Manager, HTML5 Player Controller,
 * Kurdish Overlay Renderer, Cue Inspector, Popovers Manager, Burn Engine, and Multi-Track Timeline.
 */
(() => {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  class VideoStudioApp {
    constructor() {
      this.isStudioActive = false;
      this.previousTab = 'translate';
      this.timeline = null;
      this.els = null;
      this.isInitialized = false;

      // Auto-mount UI on DOM ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.init());
      } else {
        setTimeout(() => this.init(), 0);
      }
    }

    async init() {
      if (this.isInitialized) return;

      // 1. Mount UI template
      this.els = await VideoEditorUI.mount();

      // 2. Initialize Player Controller
      VideoEditorPlayer.init(this.els, {
        onMetadataLoaded: (durMs) => {
          if (this.timeline) {
            this.timeline.setDuration(durMs);
            this.timeline.zoomToFit();
          }
        },
        onTimeUpdate: (curMs) => {
          this._handleVideoTimeUpdate(curMs);
        },
      });

      // 3. Initialize Overlay Renderer
      VideoEditorOverlay.init(this.els);
      VideoEditorOverlay.applyStyling(VideoEditorState.overlayConfig);

      // 4. Initialize Cue Inspector
      VideoEditorInspector.init(this.els, {
        onSave: (idx, updatedCue) => {
          VideoEditorState.updateCue(idx, updatedCue);
          if (this.timeline) this.timeline.setCues(VideoEditorState.getCues());
          VideoEditorOverlay.updateTextShower(updatedCue, idx);
          VideoEditorOverlay.renderActiveCue(updatedCue, VideoEditorState.overlayConfig);
        },
        onJump: (timeMs) => {
          this.seekTo(timeMs);
        },
      });

      // 5. Initialize Popovers Manager
      VideoEditorPopovers.init(this.els, {
        onStyleChange: (cfg) => {
          VideoEditorState.setOverlayConfig(cfg);
          VideoEditorOverlay.applyStyling(cfg);
          VideoEditorOverlay.renderActiveCue(VideoEditorState.activeCue, cfg);
        },
        onSyncChange: (delta, isReset) => {
          const newOffset = isReset ? 0 : VideoEditorState.syncOffsetMs + delta;
          VideoEditorState.setSyncOffset(newOffset);
          VideoEditorPopovers.updateSyncDisplay(newOffset);
          const curMs = this.els.videoPlayer ? this.els.videoPlayer.currentTime * 1000 : 0;
          this._handleVideoTimeUpdate(curMs);
        },
        onSpeedChange: (rate) => {
          VideoEditorPlayer.setPlaybackRate(rate);
        },
      });

      // 6. Initialize Video Burn Engine
      VideoEditorBurner.init(this.els);

      // 7. Bind Primary UI Events
      this._bindEvents();

      // 8. Setup App Cues Availability Watcher
      this._setupFileWatcher();

      this.isInitialized = true;
    }

    _bindEvents() {
      // Header Back & Help
      if (this.els.btnBackToApp) {
        this.els.btnBackToApp.addEventListener('click', () => this.exitStudioMode());
      }
      if (this.els.helpBtn) {
        this.els.helpBtn.addEventListener('click', () => {
          VideoEditorUI.showToast(
            'Shortcuts: Space (Play/Pause), ←/→ (Step 1s), Shift+←/→ (Step 5s), Esc (Exit)',
            'info',
            'VN Studio Shortcuts'
          );
        });
      }

      // Aspect Ratio Selector
      if (this.els.aspectRatioSel) {
        this.els.aspectRatioSel.addEventListener('change', (e) => {
          VideoEditorPlayer.setAspectRatio(e.target.value);
        });
      }

      // Video File Input & Dropzone
      if (this.els.btnBrowseVideo && this.els.videoFileInput) {
        this.els.btnBrowseVideo.addEventListener('click', () => this.els.videoFileInput.click());
      }
      if (this.els.toolVideoChangeBtn && this.els.videoFileInput) {
        this.els.toolVideoChangeBtn.addEventListener('click', () => this.els.videoFileInput.click());
      }
      if (this.els.videoFileInput) {
        this.els.videoFileInput.addEventListener('change', (e) => {
          if (e.target.files && e.target.files[0]) {
            VideoEditorPlayer.loadVideoFile(e.target.files[0]);
            e.target.value = '';
          }
        });
      }

      // Drag and drop video on dropzone and entire player stage
      const dropTargets = [this.els.videoDropzone, this.els.playerStage, this.els.viewportWrapper].filter(Boolean);
      dropTargets.forEach((target) => {
        ['dragenter', 'dragover'].forEach((eventName) => {
          target.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.els.videoDropzone) this.els.videoDropzone.classList.add('drag-over');
          });
        });
        ['dragleave', 'dragexit'].forEach((eventName) => {
          target.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.els.videoDropzone) this.els.videoDropzone.classList.remove('drag-over');
          });
        });
        target.addEventListener('drop', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (this.els.videoDropzone) this.els.videoDropzone.classList.remove('drag-over');
          if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
            VideoEditorPlayer.loadVideoFile(e.dataTransfer.files[0]);
          }
        });
      });

      // Try Sample Video Button
      if (this.els.btnSampleVideo) {
        this.els.btnSampleVideo.addEventListener('click', () => {
          VideoEditorPlayer.generateSampleVideo();
        });
      }

      // Fullscreen
      if (this.els.fsBtn) {
        this.els.fsBtn.addEventListener('click', () => VideoEditorPlayer.toggleFullscreen());
      }

      // Transport Buttons
      if (this.els.playPauseBtn) {
        this.els.playPauseBtn.addEventListener('click', () => VideoEditorPlayer.togglePlay());
      }
      if (this.els.stepBackBtn) {
        this.els.stepBackBtn.addEventListener('click', () => this._stepCue(-1));
      }
      if (this.els.stepForwardBtn) {
        this.els.stepForwardBtn.addEventListener('click', () => this._stepCue(1));
      }

      // Undo / Redo
      if (this.els.undoBtn) {
        this.els.undoBtn.addEventListener('click', () => this.undo());
      }
      if (this.els.redoBtn) {
        this.els.redoBtn.addEventListener('click', () => this.redo());
      }

      // Text Shower Click -> Inspect
      if (this.els.textShowerCard) {
        this.els.textShowerCard.addEventListener('click', () => {
          if (VideoEditorState.activeCue) {
            VideoEditorInspector.open(
              VideoEditorState.activeCue,
              VideoEditorState.activeCueIndex,
              VideoEditorState.getCues().length
            );
          } else {
            const nearest = this._getNearestCue();
            if (nearest) {
              VideoEditorInspector.open(nearest.cue, nearest.index, VideoEditorState.getCues().length);
            }
          }
        });
      }

      // Toolbar Edit / Inspect Button
      if (this.els.toolInspectBtn) {
        this.els.toolInspectBtn.addEventListener('click', () => {
          const cue = VideoEditorState.activeCue || (this._getNearestCue() && this._getNearestCue().cue);
          const idx = VideoEditorState.activeCueIndex >= 0 ? VideoEditorState.activeCueIndex : (this._getNearestCue() && this._getNearestCue().index);
          if (cue) {
            VideoEditorInspector.open(cue, idx, VideoEditorState.getCues().length);
          } else {
            VideoEditorUI.showToast('No cue active to inspect.', 'info');
          }
        });
      }

      // Toolbar Split Button
      if (this.els.toolSplitBtn) {
        this.els.toolSplitBtn.addEventListener('click', () => this._splitCurrentCue());
      }

      // Subtitle Sync / Connect
      if (this.els.btnApplyCurrentSubs) {
        this.els.btnApplyCurrentSubs.addEventListener('click', () => this.applyCurrentAppSubtitles());
      }

      // Import Subtitle File
      if (this.els.btnImportSubFile && this.els.subFileInput) {
        this.els.btnImportSubFile.addEventListener('click', () => this.els.subFileInput.click());
      }
      if (this.els.subFileInput) {
        this.els.subFileInput.addEventListener('change', (e) => {
          if (e.target.files && e.target.files[0]) {
            this.importSubtitleFile(e.target.files[0]);
          }
        });
      }

      // Burn / Export Modal
      if (this.els.btnBurnExport) {
        this.els.btnBurnExport.addEventListener('click', () => {
          VideoEditorBurner.openModal(
            !!VideoEditorPlayer.videoFile,
            VideoEditorState.getCues().length
          );
        });
      }

      // Keyboard Shortcuts
      window.addEventListener('keydown', (e) => {
        if (!this.isStudioActive) return;
        const tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

        if (e.code === 'Space') {
          e.preventDefault();
          VideoEditorPlayer.togglePlay();
        } else if (e.code === 'ArrowLeft') {
          e.preventDefault();
          VideoEditorPlayer.stepSeconds(e.shiftKey ? -5 : -1);
        } else if (e.code === 'ArrowRight') {
          e.preventDefault();
          VideoEditorPlayer.stepSeconds(e.shiftKey ? 5 : 1);
        } else if (e.code === 'Escape') {
          if (VideoEditorInspector.els.cueInfoModal && !VideoEditorInspector.els.cueInfoModal.classList.contains('hidden')) {
            VideoEditorInspector.close();
          } else if (VideoEditorBurner.els.burnModal && !VideoEditorBurner.els.burnModal.classList.contains('hidden')) {
            VideoEditorBurner.closeModal();
          } else {
            this.exitStudioMode();
          }
        }
      });
    }

    _findCueIndexAtTime(cues, targetMs) {
      if (!cues || !cues.length) return -1;
      let low = 0;
      let high = cues.length - 1;
      while (low <= high) {
        const mid = (low + high) >> 1;
        const c = cues[mid];
        if (targetMs >= c.start && targetMs <= c.end) {
          return mid;
        }
        if (targetMs < c.start) {
          high = mid - 1;
        } else {
          low = mid + 1;
        }
      }
      return -1;
    }

    _handleVideoTimeUpdate(currentMs) {
      if (this.timeline) {
        this.timeline.setTime(currentMs);
      }

      // Sync active cue with O(log N) binary search
      const adjustedTimeMs = currentMs + VideoEditorState.syncOffsetMs;
      const cues = VideoEditorState.getCues();
      
      // Fast check if current active cue is still active
      let matchingIdx = -1;
      if (VideoEditorState.activeCueIndex >= 0 && VideoEditorState.activeCueIndex < cues.length) {
        const active = cues[VideoEditorState.activeCueIndex];
        if (active && adjustedTimeMs >= active.start && adjustedTimeMs <= active.end) {
          matchingIdx = VideoEditorState.activeCueIndex;
        }
      }
      if (matchingIdx === -1) {
        matchingIdx = this._findCueIndexAtTime(cues, adjustedTimeMs);
      }

      if (matchingIdx !== -1) {
        if (matchingIdx !== VideoEditorState.activeCueIndex) {
          const matchingCue = cues[matchingIdx];
          VideoEditorState.setActiveCue(matchingCue, matchingIdx);
          VideoEditorOverlay.renderActiveCue(matchingCue, VideoEditorState.overlayConfig);
          VideoEditorOverlay.updateTextShower(matchingCue, matchingIdx);
        }
      } else {
        if (VideoEditorState.activeCueIndex !== -1) {
          VideoEditorState.setActiveCue(null, -1);
          VideoEditorOverlay.clearOverlay();
          VideoEditorOverlay.updateTextShower(null, -1, this._getNearestCue());
        }
      }
    }

    _initTimeline() {
      if (this.timeline) return;
      if (typeof StudioTimeline === 'undefined') {
        console.warn('StudioTimeline class not loaded yet.');
        return;
      }
      this.timeline = new StudioTimeline(this.els.timelineContainer, {
        pixelsPerSecond: 48,
        onSeek: (timeMs) => {
          this.seekTo(timeMs);
        },
        onCueSelect: (cue, idx) => {
          VideoEditorState.setActiveCue(cue, idx);
          this.seekTo(cue.start);
          VideoEditorOverlay.updateTextShower(cue, idx);
          VideoEditorOverlay.renderActiveCue(cue, VideoEditorState.overlayConfig);
        },
      });

      const cues = VideoEditorState.getCues();
      if (cues.length > 0) {
        this.timeline.setCues(cues);
      }
    }

    enterStudioMode(previousTabName = 'translate') {
      this.isStudioActive = true;
      this.previousTab = previousTabName;
      document.body.classList.add('studio-mode');

      // Update Navigation Tabs
      $$('.tab').forEach((b) => {
        b.classList.toggle('active', b.dataset.tab === 'video-editor');
      });

      // Show Video Studio section, hide others
      if ($('#tabTranslate')) $('#tabTranslate').classList.add('hidden');
      if ($('#tabPreview')) $('#tabPreview').classList.add('hidden');
      if (this.els.tabVideoEditor) {
        this.els.tabVideoEditor.classList.remove('hidden');
      }

      this._initTimeline();
      this._checkAndSyncSubtitlesQuietly();

      if (this.timeline && this.els.videoPlayer && this.els.videoPlayer.duration) {
        this.timeline.setDuration(this.els.videoPlayer.duration * 1000);
      }
    }

    exitStudioMode(explicitTarget) {
      this.isStudioActive = false;
      document.body.classList.remove('studio-mode');

      if (this.els.videoPlayer) {
        this.els.videoPlayer.pause();
      }

      if (this.els.tabVideoEditor) {
        this.els.tabVideoEditor.classList.add('hidden');
      }

      // Sync any edited cues back to the main app so changes persist across tabs
      const currentCues = VideoEditorState.getCues();
      if (currentCues && currentCues.length && typeof window._updateAppWorkCues === 'function') {
        window._updateAppWorkCues(currentCues);
      }

      const targetTab = explicitTarget || this.previousTab || 'translate';
      if (!explicitTarget && typeof window._switchAppTab === 'function') {
        window._switchAppTab(targetTab);
        return;
      }

      $$('.tab').forEach((b) => {
        b.classList.toggle('active', b.dataset.tab === targetTab);
      });

      if (targetTab === 'preview') {
        if ($('#tabPreview')) $('#tabPreview').classList.remove('hidden');
      } else {
        if ($('#tabTranslate')) $('#tabTranslate').classList.remove('hidden');
      }
    }

    seekTo(timeMs) {
      VideoEditorPlayer.seekTo(timeMs);
      if (this.timeline) {
        this.timeline.setTime(timeMs, true);
      }
    }

    _stepCue(direction) {
      const cues = VideoEditorState.getCues();
      if (!cues.length) return;

      const curMs = (this.els.videoPlayer ? this.els.videoPlayer.currentTime * 1000 : 0) + VideoEditorState.syncOffsetMs;
      if (direction > 0) {
        const next = cues.find((c) => c.start > curMs + 100);
        if (next) this.seekTo(next.start);
      } else {
        const prevs = cues.filter((c) => c.start < curMs - 100);
        if (prevs.length > 0) {
          const prev = prevs[prevs.length - 1];
          this.seekTo(prev.start);
        }
      }
    }

    _splitCurrentCue() {
      const player = this.els.videoPlayer;
      if (!player) return;
      const currentMs = player.currentTime * 1000 + VideoEditorState.syncOffsetMs;

      if (!VideoEditorState.activeCue || currentMs <= VideoEditorState.activeCue.start + 200 || currentMs >= VideoEditorState.activeCue.end - 200) {
        VideoEditorUI.showToast('Position playhead inside an active cue to split it.', 'info');
        return;
      }

      const newCue = VideoEditorState.splitCue(VideoEditorState.activeCueIndex, currentMs);
      if (newCue && this.timeline) {
        this.timeline.setCues(VideoEditorState.getCues());
        VideoEditorUI.showToast(`Split cue at ${VideoEditorPlayer.formatTime(currentMs)}`, 'success');
      }
    }

    undo() {
      if (VideoEditorState.undo()) {
        if (this.timeline) this.timeline.setCues(VideoEditorState.getCues());
        const curMs = this.els.videoPlayer ? this.els.videoPlayer.currentTime * 1000 : 0;
        this._handleVideoTimeUpdate(curMs);
        VideoEditorUI.showToast('Undo performed', 'info');
      } else {
        VideoEditorUI.showToast('Nothing to undo', 'info');
      }
    }

    redo() {
      if (VideoEditorState.redo()) {
        if (this.timeline) this.timeline.setCues(VideoEditorState.getCues());
        const curMs = this.els.videoPlayer ? this.els.videoPlayer.currentTime * 1000 : 0;
        this._handleVideoTimeUpdate(curMs);
        VideoEditorUI.showToast('Redo performed', 'info');
      } else {
        VideoEditorUI.showToast('Nothing to redo', 'info');
      }
    }

    applyCurrentAppSubtitles() {
      let appCues = null;
      if (window._getAppWorkCues && typeof window._getAppWorkCues === 'function') {
        appCues = window._getAppWorkCues();
      }

      if (!appCues || !appCues.length) {
        VideoEditorUI.showToast('Please translate or open a subtitle file in the main app first.', 'info');
        return;
      }

      VideoEditorState.setCues(appCues);
      if (this.timeline) {
        this.timeline.setCues(VideoEditorState.getCues());
      }
      if (this.els.appliedSubsBadge) {
        this.els.appliedSubsBadge.textContent = `${appCues.length} Cues`;
      }

      VideoEditorUI.showToast(
        `Applied ${appCues.length} Kurdish subtitle cues!`,
        'success',
        'Subtitles are now synced with video playback.'
      );

      if (!VideoEditorPlayer.videoFile && appCues.length > 0 && this.timeline) {
        const lastCue = appCues[appCues.length - 1];
        this.timeline.setDuration(lastCue.end + 2000);
      }
    }

    _checkAndSyncSubtitlesQuietly() {
      if (VideoEditorState.getCues().length > 0) return;
      if (window._getAppWorkCues && typeof window._getAppWorkCues === 'function') {
        const appCues = window._getAppWorkCues();
        if (appCues && appCues.length > 0) {
          VideoEditorState.setCues(appCues, false);
          if (this.timeline) this.timeline.setCues(appCues);
          if (this.els.appliedSubsBadge) {
            this.els.appliedSubsBadge.textContent = `${appCues.length} Cues`;
          }
        }
      }
    }

    async importSubtitleFile(file) {
      if (!file) return;
      try {
        const text = await file.text();
        if (typeof SubParser !== 'undefined') {
          const parsed = SubParser.parse(text);
          if (parsed && parsed.cues && parsed.cues.length > 0) {
            VideoEditorState.setCues(parsed.cues);
            if (this.timeline) this.timeline.setCues(parsed.cues);
            if (this.els.appliedSubsBadge) {
              this.els.appliedSubsBadge.textContent = `${parsed.cues.length} Cues`;
            }
            VideoEditorUI.showToast(`Imported ${parsed.cues.length} cues from ${file.name}`, 'success');
            return;
          }
        }
        VideoEditorUI.showToast('Could not parse subtitle file format.', 'error');
      } catch (err) {
        VideoEditorUI.showToast(`Failed to read subtitle file: ${err.message}`, 'error');
      }
    }

    _setupFileWatcher() {
      const checkAndGlow = () => {
        let hasCues = false;
        let count = 0;
        if (window._getAppWorkCues && typeof window._getAppWorkCues === 'function') {
          const appCues = window._getAppWorkCues();
          if (appCues && appCues.length > 0) {
            hasCues = true;
            count = appCues.length;
          }
        }

        if (this.els && this.els.btnApplyCurrentSubs) {
          if (hasCues) {
            this.els.btnApplyCurrentSubs.classList.add('glowing');
            this.els.btnApplyCurrentSubs.title = `${count} Kurdish subtitles ready in app! Click to connect.`;
            if (this.els.appliedSubsBadge) {
              this.els.appliedSubsBadge.textContent = `${count} Ready`;
            }
          } else {
            this.els.btnApplyCurrentSubs.classList.remove('glowing');
            if (this.els.appliedSubsBadge && (!VideoEditorState.getCues() || VideoEditorState.getCues().length === 0)) {
              this.els.appliedSubsBadge.textContent = 'No Subtitle';
            }
          }
        }
      };

      checkAndGlow();
      setInterval(checkAndGlow, 2000);
    }

    _getNearestCue() {
      const cues = VideoEditorState.getCues();
      if (!cues || !cues.length) return null;
      const currentMs = (this.els.videoPlayer ? this.els.videoPlayer.currentTime * 1000 : 0) + VideoEditorState.syncOffsetMs;

      for (let i = 0; i < cues.length; i++) {
        if (cues[i].start >= currentMs) {
          return { cue: cues[i], index: i };
        }
      }
      return { cue: cues[cues.length - 1], index: cues.length - 1 };
    }
  }

  window.VideoStudio = new VideoStudioApp();
})();
