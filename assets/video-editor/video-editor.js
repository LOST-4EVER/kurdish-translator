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
        onVideoLoaded: (file) => {
          if (this.timeline) {
            this.timeline.setHasVideo(true, file ? file.name : 'Video Track');
          }
        },
      });

      // 3. Initialize Overlay Renderer
      VideoEditorOverlay.init(this.els, {
        onOverlayClick: () => {
          const cue = VideoEditorState.activeCue || (this._getNearestCue() && this._getNearestCue().cue);
          const idx = VideoEditorState.activeCueIndex >= 0 ? VideoEditorState.activeCueIndex : (this._getNearestCue() && this._getNearestCue().index);
          if (cue && idx >= 0) {
            VideoEditorBubble.open(cue, idx);
          }
        },
        onPositionChange: (pos) => {
          if (pos) {
            VideoEditorUI.showToast(`Subtitle position set to ${pos.xPct}% , ${pos.yPct}%`, 'info');
          } else {
            VideoEditorUI.showToast('Subtitle position reset to default bottom', 'info');
          }
        },
      });
      VideoEditorOverlay.applyStyling(VideoEditorState.overlayConfig);

      // 4. Initialize Bubble Editor
      if (typeof VideoEditorBubble !== 'undefined') {
        VideoEditorBubble.init(this.els, {
          onTextChange: (cue, idx, text) => {
            if (this.timeline) this.timeline.setCues(VideoEditorState.getCues());
            VideoEditorOverlay.renderActiveCue(cue, VideoEditorState.overlayConfig);
            VideoEditorOverlay.updateTextShower(cue, idx);
          },
          onSplit: (idx) => {
            this._splitCurrentCue();
          },
        });
      }

      // 5. Initialize Cue Inspector Modal
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

      // 6. Initialize Popovers Manager
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

      // 7. Initialize Video Burn Engine
      VideoEditorBurner.init(this.els);

      // 8. Bind Primary UI Events
      this._bindEvents();

      // 9. Setup App Cues Availability Watcher
      this._setupFileWatcher();

      // 10. Listen to cues changes to keep Original Text toggle state synchronized
      VideoEditorState.on('cuesChange', () => this._syncOrigToggleUI());
      this._syncOrigToggleUI();

      this.isInitialized = true;
    }

    _syncOrigToggleUI() {
      const cues = VideoEditorState.getCues();
      const hasTrans = Boolean(cues && cues.length && cues.some((c) => c.origText && c.origText.trim() && c.origText.trim() !== (c.text || '').trim()));
      const showOrig = Boolean(VideoEditorState.overlayConfig && VideoEditorState.overlayConfig.showOrig);

      if (this.els.quickOrigBtn) {
        this.els.quickOrigBtn.classList.toggle('disabled', !hasTrans);
        this.els.quickOrigBtn.classList.toggle('active', hasTrans && showOrig);
        if (hasTrans) {
          this.els.quickOrigBtn.title = showOrig
            ? 'Original text enabled (Click to hide original)'
            : 'Click to show original text alongside Kurdish';
        } else {
          this.els.quickOrigBtn.title = 'Original text is only available for subtitles translated within the app.';
        }
      }

      const styleToggle = document.getElementById('studioSubShowOrigToggle');
      if (styleToggle) {
        styleToggle.disabled = !hasTrans;
        styleToggle.checked = hasTrans && showOrig;
      }
    }

    _bindEvents() {
      // Header Back & Help
      if (this.els.btnBackToApp) {
        this.els.btnBackToApp.addEventListener('click', () => this.exitStudioMode());
      }
      if (this.els.helpBtn) {
        this.els.helpBtn.addEventListener('click', () => {
          if (this.els.helpModal) {
            this.els.helpModal.classList.remove('hidden');
          } else {
            VideoEditorUI.showToast(
              'Shortcuts: Space (Play/Pause), ←/→ (Step 1s), Shift+←/→ (Step 5s), Esc (Close)',
              'info',
              'VN Studio Shortcuts'
            );
          }
        });
      }
      if (this.els.helpCloseBtn) {
        this.els.helpCloseBtn.addEventListener('click', () => {
          if (this.els.helpModal) this.els.helpModal.classList.add('hidden');
        });
      }
      if (this.els.helpDoneBtn) {
        this.els.helpDoneBtn.addEventListener('click', () => {
          if (this.els.helpModal) this.els.helpModal.classList.add('hidden');
        });
      }

      // Auxiliary File Inputs
      if (this.els.musicFileInput) {
        this.els.musicFileInput.addEventListener('change', (e) => {
          if (e.target.files && e.target.files[0]) {
            const musicFile = e.target.files[0];
            VideoEditorUI.showToast(`Selected audio track: ${musicFile.name}`, 'success');
          }
        });
      }
      if (this.els.stickerFileInput) {
        this.els.stickerFileInput.addEventListener('change', (e) => {
          if (e.target.files && e.target.files[0]) {
            const stickerFile = e.target.files[0];
            VideoEditorUI.showToast(`Watermark / sticker ready: ${stickerFile.name}`, 'success');
          }
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
      const handleIncomingVideo = (file) => {
        if (!file) return;
        const isMov = /\.mov$/i.test(file.name) || file.type === 'video/quicktime';
        const isMkv = /\.mkv$/i.test(file.name) || file.type.includes('matroska');
        if ((isMkv || isMov) && (window.MkvImporter || window.MovImporter)) {
          const importer = window.MkvImporter || window.MovImporter;
          importer.inspectAndShow(file);
          return;
        }
        VideoEditorPlayer.loadVideoFile(file);
      };

      if (this.els.videoFileInput) {
        this.els.videoFileInput.addEventListener('change', (e) => {
          if (e.target.files && e.target.files[0]) {
            handleIncomingVideo(e.target.files[0]);
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
            handleIncomingVideo(e.dataTransfer.files[0]);
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

      // Quick Original English Text Toggle (Transport Bar)
      if (this.els.quickOrigBtn) {
        this.els.quickOrigBtn.addEventListener('click', () => {
          const cues = VideoEditorState.getCues();
          const hasTrans = Boolean(cues && cues.length && cues.some((c) => c.origText && c.origText.trim() && c.origText.trim() !== (c.text || '').trim()));
          if (!hasTrans) {
            VideoEditorUI.showToast(
              'Original text is only available for subtitles translated within the app.',
              'info'
            );
            return;
          }
          const currentShow = !!(VideoEditorState.overlayConfig && VideoEditorState.overlayConfig.showOrig);
          const nextShow = !currentShow;
          VideoEditorState.setOverlayConfig({ showOrig: nextShow });
          this._syncOrigToggleUI();
          VideoEditorOverlay.renderActiveCue(VideoEditorState.activeCue, VideoEditorState.overlayConfig);
          try {
            localStorage.setItem('kurdish_translator_studio_show_orig', nextShow ? '1' : '0');
          } catch (_) {}
          VideoEditorUI.showToast(
            nextShow ? 'Showing original text alongside Kurdish' : 'Showing Kurdish subtitles only',
            'info'
          );
        });
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

      // Text Shower Click -> Quick Bubble Editor
      if (this.els.textShowerCard) {
        this.els.textShowerCard.addEventListener('click', () => {
          const cue = VideoEditorState.activeCue || (this._getNearestCue() && this._getNearestCue().cue);
          const idx = VideoEditorState.activeCueIndex >= 0 ? VideoEditorState.activeCueIndex : (this._getNearestCue() && this._getNearestCue().index);
          if (cue && idx >= 0) {
            VideoEditorBubble.open(cue, idx);
          } else {
            VideoEditorUI.showToast('No active subtitle. Click + on Kurdish track to create one.', 'info');
          }
        });
      }

      // Toolbar Edit / Inspect Button
      if (this.els.toolInspectBtn) {
        this.els.toolInspectBtn.addEventListener('click', () => {
          const cue = VideoEditorState.activeCue || (this._getNearestCue() && this._getNearestCue().cue);
          const idx = VideoEditorState.activeCueIndex >= 0 ? VideoEditorState.activeCueIndex : (this._getNearestCue() && this._getNearestCue().index);
          if (cue && idx >= 0) {
            VideoEditorBubble.open(cue, idx);
          } else {
            VideoEditorUI.showToast('No cue active to edit. Position playhead and click + on text track.', 'info');
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

      // Layout Vertical Resizer
      this._bindResizer();

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
        } else if (e.code === 'KeyS') {
          e.preventDefault();
          this._splitCurrentCue();
        } else if (e.code === 'Escape') {
          if (typeof VideoEditorPopovers !== 'undefined' && VideoEditorPopovers.closeAll && Object.values(this.els.popovers || {}).some((p) => p && !p.classList.contains('hidden'))) {
            VideoEditorPopovers.closeAll();
          } else if (VideoEditorBubble.isOpen && typeof VideoEditorBubble.isOpen === 'function' && VideoEditorBubble.isOpen()) {
            VideoEditorBubble.close();
          } else if (this.els.helpModal && !this.els.helpModal.classList.contains('hidden')) {
            this.els.helpModal.classList.add('hidden');
          } else if (VideoEditorInspector.els && VideoEditorInspector.els.cueInfoModal && !VideoEditorInspector.els.cueInfoModal.classList.contains('hidden')) {
            VideoEditorInspector.close();
          } else if (VideoEditorBurner.els && VideoEditorBurner.els.burnModal && !VideoEditorBurner.els.burnModal.classList.contains('hidden')) {
            VideoEditorBurner.closeModal();
          } else {
            this.exitStudioMode();
          }
        }
      });
    }

    _bindResizer() {
      const resizer = this.els.studioResizerBar;
      const timelineSection = this.els.timelineSection || document.getElementById('studioTimelineSection');
      if (!resizer || !timelineSection) return;

      // Restore stored height preference if available
      try {
        const savedHeight = localStorage.getItem('vn_studio_timeline_height');
        if (savedHeight) {
          const h = parseInt(savedHeight, 10);
          if (!isNaN(h) && h >= 90 && h <= Math.min(window.innerHeight * 0.65, 450)) {
            timelineSection.style.height = `${h}px`;
            timelineSection.style.flex = `0 0 ${h}px`;
          }
        }
      } catch (err) {
        // Ignore storage access errors
      }

      let isResizing = false;
      let startY = 0;
      let startHeight = 0;

      const onPointerDown = (e) => {
        isResizing = true;
        startY = e.clientY;
        startHeight = timelineSection.getBoundingClientRect().height;
        resizer.classList.add('is-resizing');
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';

        if (resizer.setPointerCapture) {
          try {
            resizer.setPointerCapture(e.pointerId);
          } catch (_) {}
        }
        e.preventDefault();
      };

      const onPointerMove = (e) => {
        if (!isResizing) return;
        const dy = startY - e.clientY; // Dragging upwards increases timeline height
        const targetHeight = startHeight + dy;
        const minHeight = 90;
        const maxHeight = Math.max(minHeight, Math.min(window.innerHeight * 0.65, 450));
        const clampedHeight = Math.max(minHeight, Math.min(targetHeight, maxHeight));

        timelineSection.style.height = `${clampedHeight}px`;
        timelineSection.style.flex = `0 0 ${clampedHeight}px`;

        if (this.timeline && typeof this.timeline.handleResize === 'function') {
          this.timeline.handleResize();
        }
      };

      const onPointerUp = (e) => {
        if (!isResizing) return;
        isResizing = false;
        resizer.classList.remove('is-resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        if (resizer.releasePointerCapture) {
          try {
            resizer.releasePointerCapture(e.pointerId);
          } catch (_) {}
        }

        const finalHeight = timelineSection.getBoundingClientRect().height;
        try {
          localStorage.setItem('vn_studio_timeline_height', Math.round(finalHeight));
        } catch (_) {}

        if (this.timeline && typeof this.timeline.handleResize === 'function') {
          this.timeline.handleResize();
        }
      };

      resizer.addEventListener('pointerdown', onPointerDown);
      resizer.addEventListener('pointermove', onPointerMove);
      resizer.addEventListener('pointerup', onPointerUp);
      resizer.addEventListener('pointercancel', onPointerUp);

      // Double-click to reset to default 148px
      resizer.addEventListener('dblclick', () => {
        const defaultHeight = 148;
        timelineSection.style.height = `${defaultHeight}px`;
        timelineSection.style.flex = `0 0 ${defaultHeight}px`;
        try {
          localStorage.setItem('vn_studio_timeline_height', defaultHeight);
        } catch (_) {}
        if (this.timeline && typeof this.timeline.handleResize === 'function') {
          this.timeline.handleResize();
        }
        VideoEditorUI.showToast('Timeline height reset to default', 'info');
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
          VideoEditorBubble.open(cue, idx);
        },
        onHeaderClick: (trackType) => {
          this._handleTrackHeaderClick(trackType);
        },
      });

      const cues = VideoEditorState.getCues();
      if (cues.length > 0) {
        this.timeline.setCues(cues);
      }

      if (VideoEditorPlayer.videoFile) {
        this.timeline.setHasVideo(true, VideoEditorPlayer.videoFile.name);
      } else {
        this.timeline.setHasVideo(false);
      }
    }

    _handleTrackHeaderClick(trackType) {
      if (trackType === 'text') {
        const curMs = this.els.videoPlayer ? this.els.videoPlayer.currentTime * 1000 : 0;
        const newCue = VideoEditorState.addCue(curMs, curMs + 2500, 'دەقی ژێرنووسی نوێ');
        if (this.timeline) this.timeline.setCues(VideoEditorState.getCues());
        const cues = VideoEditorState.getCues();
        const idx = cues.findIndex((c) => c === newCue);
        VideoEditorState.setActiveCue(newCue, idx);
        VideoEditorOverlay.renderActiveCue(newCue, VideoEditorState.overlayConfig);
        VideoEditorOverlay.updateTextShower(newCue, idx);
        VideoEditorBubble.open(newCue, idx);
        VideoEditorUI.showToast('Added new Kurdish cue at current playhead', 'success');
      } else if (trackType === 'video') {
        if (this.els.videoFileInput) this.els.videoFileInput.click();
      } else if (trackType === 'music') {
        if (this.els.musicFileInput) this.els.musicFileInput.click();
      } else if (trackType === 'sticker') {
        if (this.els.stickerFileInput) this.els.stickerFileInput.click();
      } else if (trackType === 'audio') {
        VideoEditorPopovers.toggle('volume');
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
