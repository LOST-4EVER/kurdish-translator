/**
 * video-editor-player.js — High-Performance HTML5 Video Player & Gesture Engine for Video Studio.
 * Features frame-accurate playback, requestVideoFrameCallback hardware sync,
 * multi-touch gestures (tap-to-play, double-tap seek, touch-scrubbing), and pristine video quality.
 */
(() => {
  'use strict';

  class VideoEditorPlayerController {
    constructor() {
      this.videoFile = null;
      this.videoUrl = null;
      this.els = null;
      this.onTimeUpdateCallback = null;
      this.onMetadataLoadedCallback = null;
      this.onVideoLoadedCallback = null;
      this.currentPlaybackRate = 1.0;
      this._syncRaf = null;
      this._rvfcId = null;
      this._lastSyncedMs = -1;
      this._tapTimer = null;
      this._lastTapTime = 0;
      this._lastTapPos = { x: 0, y: 0 };
      this._isScrubbingTouch = false;
      this._touchStartX = 0;
      this._touchStartTimeMs = 0;
      this._touchScrubHud = null;
    }

    init(els, options = {}) {
      this.els = els;
      this.onTimeUpdateCallback = options.onTimeUpdate;
      this.onMetadataLoadedCallback = options.onMetadataLoaded;
      this.onVideoLoadedCallback = options.onVideoLoaded;

      this._bindPlayerEvents();
      this._bindGestureAndTouchSystem();
      this._bindFullscreenHud();
    }

    _bindFullscreenHud() {
      const stage = this.els.playerStage;
      if (!stage) return;

      this._fsHudIdleTimer = null;

      const onFsChange = () => {
        const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
        stage.classList.toggle('is-fullscreen', isFs);

        const fsBtn = this.els.fsBtn || document.getElementById('studioFsBtn');
        if (fsBtn) {
          if (isFs) {
            fsBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path></svg>';
            fsBtn.setAttribute('title', 'Exit Fullscreen (Esc)');
          } else {
            fsBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>';
            fsBtn.setAttribute('title', 'Fullscreen player (F)');
          }
        }

        const hud = document.getElementById('studioFsControlsHud');
        if (hud) {
          hud.classList.toggle('hidden', !isFs);
          if (isFs) {
            this._showFsHud();
          } else {
            stage.classList.remove('cursor-hidden');
          }
        }
      };

      document.addEventListener('fullscreenchange', onFsChange);
      document.addEventListener('webkitfullscreenchange', onFsChange);

      stage.addEventListener('mousemove', () => {
        if (document.fullscreenElement || document.webkitFullscreenElement) {
          this._showFsHud();
        }
      });

      stage.addEventListener('dblclick', (e) => {
        if (e.target && e.target.closest('button, input, select, textarea, .vn-sub-drag-indicator, .vn-subtitle-overlay, .vn-fs-hud, .vn-empty-box')) return;
        this.toggleFullscreen();
      });

      // HUD Buttons
      const hudPlayBtn = document.getElementById('studioFsHudPlayBtn');
      if (hudPlayBtn) {
        hudPlayBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.togglePlay();
          this._showFsHud();
        });
      }

      const hudBackBtn = document.getElementById('studioFsHudBackBtn');
      if (hudBackBtn) {
        hudBackBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.stepSeconds(-5);
          this._showFsHud();
        });
      }

      const hudFwdBtn = document.getElementById('studioFsHudFwdBtn');
      if (hudFwdBtn) {
        hudFwdBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.stepSeconds(5);
          this._showFsHud();
        });
      }

      const hudExitBtn = document.getElementById('studioFsHudExitBtn');
      if (hudExitBtn) {
        hudExitBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleFullscreen();
        });
      }
    }

    _showFsHud() {
      const hud = document.getElementById('studioFsControlsHud');
      const stage = this.els.playerStage;
      if (stage) stage.classList.remove('cursor-hidden');
      if (!hud) return;
      hud.classList.remove('hidden', 'hud-idle');

      if (this._fsHudIdleTimer) {
        clearTimeout(this._fsHudIdleTimer);
      }
      this._fsHudIdleTimer = setTimeout(() => {
        if (document.fullscreenElement || document.webkitFullscreenElement) {
          hud.classList.add('hud-idle');
          if (stage) stage.classList.add('cursor-hidden');
        }
      }, 2600);
    }

    _bindPlayerEvents() {
      const player = this.els.videoPlayer;
      if (!player) return;

      const onPlayStart = () => {
        this._updatePlayIcon(true);
        this._startPlaybackSync();
        if (window.VideoEditorHardware) {
          window.VideoEditorHardware.requestWakeLock('playback');
        }
      };
      const onPlayStop = () => {
        this._updatePlayIcon(false);
        this._stopPlaybackSync();
        if (window.VideoEditorHardware) {
          window.VideoEditorHardware.releaseWakeLock('playback');
        }
      };

      player.addEventListener('play', onPlayStart);
      player.addEventListener('pause', onPlayStop);
      player.addEventListener('ended', onPlayStop);

      const updateMeta = () => {
        let durMs = (player.duration || 0) * 1000;
        if (isNaN(durMs) || !isFinite(durMs) || durMs <= 0) {
          durMs = 0;
        }
        const curMs = (player.currentTime || 0) * 1000;
        this.updateTimeDisplay(curMs, durMs);
        if (this.onMetadataLoadedCallback && durMs > 0) {
          this.onMetadataLoadedCallback(durMs);
        }

        // Hide loading overlay and calculate video specs badge & native aspect ratio
        this.hideLoadingOverlay();
        this.hideErrorOverlay();
        this._updateSpecsBadge();

        const selRatio = this.els.aspectRatioSel ? this.els.aspectRatioSel.value : 'original';
        this.setAspectRatio(selRatio || 'original');
      };

      player.addEventListener('loadedmetadata', updateMeta);
      player.addEventListener('durationchange', updateMeta);
      player.addEventListener('canplay', () => {
        updateMeta();
        this.hideLoadingOverlay();
      });

      player.addEventListener('waiting', () => {
        const hasVideo = !!(this.videoFile && this.videoUrl && player.src && player.readyState >= 2);
        if (hasVideo && !player.paused && !player.ended) {
          this.showLoadingOverlay('Buffering...', 'Fetching media stream frames');
        } else {
          this.hideLoadingOverlay();
        }
      });

      player.addEventListener('playing', () => {
        this.hideLoadingOverlay();
      });

      player.onerror = () => {
        const err = player.error;
        console.warn('Video element playback error:', err);
        this.hideLoadingOverlay();
        if (this.videoFile) {
          const ext = '.' + (this.videoFile.name || '').split('.').pop().toLowerCase();
          if ((ext === '.mkv' || ext === '.webm') && !this._mkvFallbackAttempted) {
            this._mkvFallbackAttempted = true;
            try {
              if (this.videoUrl) URL.revokeObjectURL(this.videoUrl);
              const webmBlob = new Blob([this.videoFile], { type: 'video/webm' });
              this.videoUrl = URL.createObjectURL(webmBlob);
              player.src = this.videoUrl;
              player.load();
              return;
            } catch (_) {}
          }
          this.showErrorOverlay(
            `Unable to decode video (${ext.toUpperCase()})`,
            'This video format or audio codec is not supported natively by your browser engine. Try converted MP4 (H.264 / AAC) or WebM.'
          );
        }
      };

      // Standard fallback timeupdate
      player.addEventListener('timeupdate', () => {
        if (!this._syncRaf && !this._rvfcId) {
          const curMs = (player.currentTime || 0) * 1000;
          const durMs = (player.duration || 0) * 1000;
          this.updateTimeDisplay(curMs, durMs);
          if (this.onTimeUpdateCallback) {
            this.onTimeUpdateCallback(curMs, durMs);
          }
        }
      });
    }

    /**
     * Unified Gesture Engine:
     * - Single click / tap on video: Play/Pause toggle with center animated ripple
     * - Double tap Left (x < 35%): Rewind 5s (-5s ripple)
     * - Double tap Right (x > 65%): Forward 5s (+5s ripple)
     * - Double tap Center (35% - 65%): Toggle Fullscreen
     * - Horizontal touch drag: Live playhead scrubbing with HUD preview
     */
    _bindGestureAndTouchSystem() {
      const viewport = this.els.viewportWrapper || document.getElementById('studioViewportWrapper');
      const stage = this.els.playerStage || document.getElementById('studioPlayerStage');
      const player = this.els.videoPlayer;
      if (!viewport) return;

      let holdBoostTimer = null;
      let isHoldBoosting = false;
      let prevPlaybackRate = 1.0;
      let verticalSwipeMode = null; // 'volume' | 'brightness'
      let touchStartY = 0;
      let startVolume = 1;
      let currentBrightness = 100;
      let pinchActive = false;
      let initialPinchDist = 0;
      let currentVideoScale = 1;

      const showBoostHud = (active) => {
        let badge = document.getElementById('studioSpeedBoostBadge');
        if (!badge) {
          badge = document.createElement('div');
          badge.id = 'studioSpeedBoostBadge';
          badge.className = 'vn-speed-boost-badge';
          badge.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
            <span>2× Speed Boost</span>
          `;
          viewport.appendChild(badge);
        }
        badge.classList.toggle('active', !!active);
      };

      const startHoldBoost = () => {
        if (!player || player.paused || isHoldBoosting) return;
        isHoldBoosting = true;
        prevPlaybackRate = player.playbackRate || 1.0;
        player.playbackRate = 2.0;
        showBoostHud(true);
        if (window.VideoEditorHardware) {
          window.VideoEditorHardware.haptic(20);
        }
      };

      const endHoldBoost = () => {
        if (holdBoostTimer) {
          clearTimeout(holdBoostTimer);
          holdBoostTimer = null;
        }
        if (isHoldBoosting) {
          isHoldBoosting = false;
          showBoostHud(false);
          if (player) {
            player.playbackRate = prevPlaybackRate || 1.0;
          }
        }
      };

      const handlePointerOrClick = (e) => {
        // Ignore clicks on subtitle overlay, HUD, or corner buttons
        if (
          e.target.closest('#studioSubtitleOverlay') ||
          e.target.closest('.vn-fs-hud') ||
          e.target.closest('.vn-fs-corner-btn') ||
          e.target.closest('.vn-empty-dropzone') ||
          e.target.closest('.vn-video-error-overlay') ||
          e.target.closest('.vn-video-loading-overlay')
        ) {
          return;
        }

        const rect = viewport.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : rect.left + rect.width / 2);
        const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : rect.top + rect.height / 2);
        const relX = (clientX - rect.left) / rect.width;

        const now = performance.now();
        const timeSinceLastTap = now - this._lastTapTime;
        const distFromLastTap = Math.hypot(clientX - this._lastTapPos.x, clientY - this._lastTapPos.y);

        if (timeSinceLastTap < 320 && distFromLastTap < 45) {
          // Double tap detected!
          if (this._tapTimer) {
            clearTimeout(this._tapTimer);
            this._tapTimer = null;
          }
          this._lastTapTime = 0;

          if (relX < 0.35) {
            // Left double-tap: Rewind 5s
            this.stepSeconds(-5);
            this._showGestureRipple('rewind', clientX, clientY, '-5s');
          } else if (relX > 0.65) {
            // Right double-tap: Forward 5s
            this.stepSeconds(5);
            this._showGestureRipple('forward', clientX, clientY, '+5s');
          } else {
            // Center double-tap: Fullscreen
            this.toggleFullscreen();
            this._showGestureRipple('center', clientX, clientY);
          }
        } else {
          // First tap: set timer for single tap action
          this._lastTapTime = now;
          this._lastTapPos = { x: clientX, y: clientY };

          if (this._tapTimer) clearTimeout(this._tapTimer);
          this._tapTimer = setTimeout(() => {
            this._tapTimer = null;
            this.togglePlay();
          }, 240);
        }
      };

      viewport.addEventListener('click', handlePointerOrClick);

      // Long press hold-to-boost for mouse/pointer
      viewport.addEventListener('pointerdown', (e) => {
        if (e.target.closest('#studioSubtitleOverlay') || e.target.closest('.vn-fs-hud') || e.target.closest('.vn-fs-corner-btn')) return;
        if (player && !player.paused) {
          holdBoostTimer = setTimeout(() => {
            startHoldBoost();
          }, 380);
        }
      }, { passive: true });

      const onPointerRelease = () => {
        endHoldBoost();
      };
      viewport.addEventListener('pointerup', onPointerRelease, { passive: true });
      viewport.addEventListener('pointercancel', onPointerRelease, { passive: true });
      viewport.addEventListener('pointerleave', onPointerRelease, { passive: true });

      // Multi-touch gestures (Pinch-to-zoom, Vertical swipe Volume/Brightness, Horizontal Scrub)
      viewport.addEventListener('touchstart', (e) => {
        if (e.target.closest('#studioSubtitleOverlay') || e.target.closest('.vn-fs-hud') || e.target.closest('.vn-fs-corner-btn')) return;

        if (e.touches.length === 2) {
          pinchActive = true;
          this._isScrubbingTouch = false;
          verticalSwipeMode = null;
          endHoldBoost();
          const t1 = e.touches[0];
          const t2 = e.touches[1];
          initialPinchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
          return;
        }

        if (e.touches.length === 1) {
          this._isScrubbingTouch = false;
          verticalSwipeMode = null;
          this._touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
          this._touchStartTimeMs = this.els.videoPlayer ? this.els.videoPlayer.currentTime * 1000 : 0;
          startVolume = player ? player.volume : 1;

          if (player && !player.paused) {
            holdBoostTimer = setTimeout(() => {
              startHoldBoost();
            }, 380);
          }
        }
      }, { passive: true });

      viewport.addEventListener('touchmove', (e) => {
        if (pinchActive && e.touches.length === 2) {
          const t1 = e.touches[0];
          const t2 = e.touches[1];
          const curDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
          if (initialPinchDist > 10 && player) {
            const scale = Math.max(1, Math.min(3, (curDist / initialPinchDist)));
            currentVideoScale = scale;
            player.style.transform = scale > 1 ? `scale(${scale.toFixed(2)})` : '';
          }
          return;
        }

        if (e.touches.length !== 1 || !this.els.videoPlayer || !this.els.videoPlayer.duration) return;

        const dx = e.touches[0].clientX - this._touchStartX;
        const dy = e.touches[0].clientY - touchStartY;

        if (Math.abs(dx) > 12 || Math.abs(dy) > 12) {
          endHoldBoost();
        }

        const rect = viewport.getBoundingClientRect();
        const relX = (this._touchStartX - rect.left) / rect.width;

        // Determine swipe axis
        if (!this._isScrubbingTouch && !verticalSwipeMode) {
          if (Math.abs(dx) > 18 && Math.abs(dx) > Math.abs(dy) * 1.3) {
            this._isScrubbingTouch = true;
            if (this._tapTimer) {
              clearTimeout(this._tapTimer);
              this._tapTimer = null;
            }
          } else if (Math.abs(dy) > 18 && Math.abs(dy) > Math.abs(dx) * 1.3) {
            verticalSwipeMode = relX > 0.5 ? 'volume' : 'brightness';
            if (this._tapTimer) {
              clearTimeout(this._tapTimer);
              this._tapTimer = null;
            }
          }
        }

        if (this._isScrubbingTouch) {
          const durMs = this.els.videoPlayer.duration * 1000;
          const deltaSec = (dx / rect.width) * Math.min(60, durMs / 1000);
          const targetMs = Math.max(0, Math.min(durMs, this._touchStartTimeMs + deltaSec * 1000));

          this._updateTouchScrubHud(targetMs, deltaSec);
          this.seekTo(targetMs, true);
        } else if (verticalSwipeMode === 'volume' && player) {
          const deltaPct = -(dy / (rect.height * 0.7));
          const newVol = Math.max(0, Math.min(1, startVolume + deltaPct));
          player.volume = newVol;
          this._showLevelHud('volume', Math.round(newVol * 100));
        } else if (verticalSwipeMode === 'brightness' && stage) {
          const deltaPct = -(dy / (rect.height * 0.7)) * 100;
          currentBrightness = Math.max(25, Math.min(150, 100 + deltaPct));
          stage.style.filter = currentBrightness !== 100 ? `brightness(${currentBrightness}%)` : '';
          this._showLevelHud('brightness', Math.round(currentBrightness));
        }
      }, { passive: true });

      const onTouchEnd = () => {
        endHoldBoost();
        if (pinchActive) {
          pinchActive = false;
        }
        if (this._isScrubbingTouch) {
          this._isScrubbingTouch = false;
          this._hideTouchScrubHud();
        }
        if (verticalSwipeMode) {
          verticalSwipeMode = null;
          this._hideLevelHud();
        }
      };

      viewport.addEventListener('touchend', onTouchEnd, { passive: true });
      viewport.addEventListener('touchcancel', onTouchEnd, { passive: true });
    }

    _showLevelHud(type, val) {
      const viewport = this.els.viewportWrapper || document.getElementById('studioViewportWrapper');
      if (!viewport) return;

      let hud = document.getElementById('studioLevelHud');
      if (!hud) {
        hud = document.createElement('div');
        hud.id = 'studioLevelHud';
        hud.className = 'vn-level-hud';
        viewport.appendChild(hud);
      }

      const icon = type === 'volume'
        ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>'
        : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line></svg>';

      hud.innerHTML = `
        <span class="vn-level-hud-icon">${icon}</span>
        <span class="vn-level-hud-val">${type === 'volume' ? 'Vol' : 'Bright'} ${val}%</span>
        <div class="vn-level-hud-track"><div class="vn-level-hud-fill" style="width:${Math.min(100, val)}%"></div></div>
      `;
      hud.classList.remove('hidden');
    }

    _hideLevelHud() {
      const hud = document.getElementById('studioLevelHud');
      if (hud) {
        setTimeout(() => {
          hud.classList.add('hidden');
        }, 600);
      }
    }

    _showGestureRipple(type, clientX, clientY, text = '') {
      const viewport = this.els.viewportWrapper || document.getElementById('studioViewportWrapper');
      if (!viewport) return;

      const ripple = document.createElement('div');
      ripple.className = `vn-gesture-ripple ${type === 'center' ? 'center-action' : 'side-action'}`;

      const rect = viewport.getBoundingClientRect();
      const left = clientX - rect.left;
      const top = clientY - rect.top;

      ripple.style.left = `${left}px`;
      ripple.style.top = `${top}px`;

      if (type === 'rewind') {
        ripple.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="11 17 6 12 11 7"></polyline><polyline points="18 17 13 12 18 7"></polyline></svg><span>${text}</span>`;
      } else if (type === 'forward') {
        ripple.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="13 17 18 12 13 7"></polyline><polyline points="6 17 11 12 6 7"></polyline></svg><span>${text}</span>`;
      } else if (type === 'play') {
        ripple.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>`;
      } else if (type === 'pause') {
        ripple.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;
      } else {
        ripple.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>`;
      }

      viewport.appendChild(ripple);
      setTimeout(() => {
        if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
      }, 700);

      if (window.VideoEditorHardware) {
        window.VideoEditorHardware.haptic(15);
      }
    }

    _updateTouchScrubHud(targetMs, deltaSec) {
      const viewport = this.els.viewportWrapper || document.getElementById('studioViewportWrapper');
      if (!viewport) return;

      if (!this._touchScrubHud) {
        this._touchScrubHud = document.createElement('div');
        this._touchScrubHud.className = 'vn-touch-scrub-hud';
        viewport.appendChild(this._touchScrubHud);
      }

      const sign = deltaSec >= 0 ? '+' : '';
      const formattedTime = this.formatTime(targetMs, false);
      this._touchScrubHud.innerHTML = `
        <span class="vn-touch-scrub-delta">${sign}${deltaSec.toFixed(1)}s</span>
        <span>·</span>
        <span>${formattedTime}</span>
      `;
    }

    _hideTouchScrubHud() {
      if (this._touchScrubHud) {
        if (this._touchScrubHud.parentNode) {
          this._touchScrubHud.parentNode.removeChild(this._touchScrubHud);
        }
        this._touchScrubHud = null;
      }
    }

    showLoadingOverlay(title = 'Loading Video...', sub = 'Decoding media stream & metadata') {
      if (!this.videoFile && !this.videoUrl) {
        this.hideLoadingOverlay();
        return;
      }
      const overlay = document.getElementById('studioVideoLoadingOverlay');
      const t = document.getElementById('studioVideoLoadingText');
      const s = document.getElementById('studioVideoLoadingSub');
      if (t && title) t.textContent = title;
      if (s && sub) s.textContent = sub;
      if (overlay) overlay.classList.remove('hidden');
    }

    hideLoadingOverlay() {
      const overlay = document.getElementById('studioVideoLoadingOverlay');
      if (overlay) overlay.classList.add('hidden');
    }

    showErrorOverlay(title, msg) {
      const overlay = document.getElementById('studioVideoErrorOverlay');
      const t = document.getElementById('studioVideoErrorTitle');
      const m = document.getElementById('studioVideoErrorMsg');
      if (t && title) t.textContent = title;
      if (m && msg) m.textContent = msg;
      if (overlay) overlay.classList.remove('hidden');
    }

    hideErrorOverlay() {
      const overlay = document.getElementById('studioVideoErrorOverlay');
      if (overlay) overlay.classList.add('hidden');
    }

    _updateSpecsBadge() {
      const player = this.els.videoPlayer;
      const badge = document.getElementById('studioVideoSpecsBadge');
      const resSpan = document.getElementById('studioVideoSpecRes');
      const fmtSpan = document.getElementById('studioVideoSpecFmt');
      if (!player || !badge || !resSpan || !fmtSpan) return;

      const w = player.videoWidth;
      const h = player.videoHeight;
      if (w > 0 && h > 0) {
        let label = `${h}p`;
        if (h >= 2160 || w >= 3840) label = '4K UHD';
        else if (h >= 1440 || w >= 2560) label = '1440p QHD';
        else if (h >= 1080 || w >= 1920) label = '1080p FHD';
        else if (h >= 720 || w >= 1280) label = '720p HD';
        else label = `${w}x${h}`;

        const fileExt = (this.videoFile ? this.videoFile.name.split('.').pop() : 'video').toUpperCase();
        resSpan.textContent = label;
        fmtSpan.textContent = fileExt;
        badge.classList.remove('hidden');
      }
    }

    _startPlaybackSync() {
      this._stopPlaybackSync();
      const player = this.els.videoPlayer;
      if (!player) return;

      const syncTick = (now, metadata) => {
        if (!player || player.paused || player.ended) {
          this._stopPlaybackSync();
          return;
        }

        const curMs = metadata && typeof metadata.mediaTime === 'number'
          ? metadata.mediaTime * 1000
          : (player.currentTime || 0) * 1000;
        const durMs = (player.duration || 0) * 1000;

        // Synchronize at optimal display refresh rate without DOM thrashing
        if (Math.abs(curMs - this._lastSyncedMs) >= 15) {
          this._lastSyncedMs = curMs;
          this.updateTimeDisplay(curMs, durMs);
          if (this.onTimeUpdateCallback) {
            this.onTimeUpdateCallback(curMs, durMs);
          }
        }

        // Hardware video frame callback where supported (Chrome/Edge/Safari 15.4+)
        if ('requestVideoFrameCallback' in player) {
          this._rvfcId = player.requestVideoFrameCallback(syncTick);
        } else {
          this._syncRaf = requestAnimationFrame(syncTick);
        }
      };

      if ('requestVideoFrameCallback' in player) {
        this._rvfcId = player.requestVideoFrameCallback(syncTick);
      } else {
        this._syncRaf = requestAnimationFrame(syncTick);
      }
    }

    _stopPlaybackSync() {
      if (this._syncRaf) {
        cancelAnimationFrame(this._syncRaf);
        this._syncRaf = null;
      }
      if (this._rvfcId && this.els.videoPlayer && 'cancelVideoFrameCallback' in this.els.videoPlayer) {
        try {
          this.els.videoPlayer.cancelVideoFrameCallback(this._rvfcId);
        } catch (_) {}
        this._rvfcId = null;
      }
    }

    loadVideoFile(file) {
      if (!file) return false;

      const validExtensions = ['.mov', '.mp4', '.webm', '.m4v', '.mkv', '.avi'];
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      const mime = file.type || '';

      const isVideo = mime.startsWith('video/') || validExtensions.includes(ext);
      if (!isVideo) {
        VideoEditorUI.showToast('Please select a valid video file (.mov, .mp4, .webm).', 'error');
        return false;
      }

      this._stopPlaybackSync();
      this._mkvFallbackAttempted = false;
      const player = this.els.videoPlayer;
      if (player) {
        try { player.pause(); } catch (_) {}
      }

      if (this.videoUrl) {
        URL.revokeObjectURL(this.videoUrl);
      }

      this.hideErrorOverlay();
      this.showLoadingOverlay('Loading Video...', `Decoding ${file.name} (${ext.toUpperCase()})`);

      this.videoFile = file;
      this.videoUrl = URL.createObjectURL(file);

      if (player) {
        player.src = this.videoUrl;
        player.playbackRate = this.currentPlaybackRate || 1.0;
        player.defaultPlaybackRate = this.currentPlaybackRate || 1.0;
        player.preservesPitch = true;
        player.mozPreservesPitch = true;
        player.webkitPreservesPitch = true;
        player.load();
      }

      if (this.els.videoPlaceholder) this.els.videoPlaceholder.classList.add('hidden');
      if (this.els.videoPlayer) this.els.videoPlayer.classList.remove('hidden');

      if (this.els.videoFilename) {
        this.els.videoFilename.textContent = file.name;
        this.els.videoFilename.title = file.name;
      }

      if (typeof this.onVideoLoadedCallback === 'function') {
        this.onVideoLoadedCallback(file);
      }

      this._extractAndDecodeAudioWaveform(file);

      VideoEditorUI.showToast(
        `Loaded video: ${file.name} (${ext.toUpperCase()})`,
        'success',
        'Ready for playback & subtitle synchronization.'
      );
      return true;
    }

    _extractAndDecodeAudioWaveform(file) {
      if (!file) return;
      // For large video files (> 35MB), avoid reading hundreds of megabytes into ArrayBuffer/AudioContext
      if (file.size > 35 * 1024 * 1024) {
        if (window.VideoEditor && window.VideoEditor.timeline) {
          window.VideoEditor.timeline.setAudioData(null);
        }
        return;
      }
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        const audioCtx = new AudioContextClass();
        const reader = new FileReader();
        reader.onload = () => {
          const arrayBuffer = reader.result;
          if (!arrayBuffer) {
            try { audioCtx.close(); } catch (_) {}
            return;
          }
          audioCtx.decodeAudioData(arrayBuffer, (decodedBuffer) => {
            try { audioCtx.close(); } catch (_) {}
            if (window.VideoEditor && window.VideoEditor.timeline) {
              window.VideoEditor.timeline.setAudioData(decodedBuffer);
            }
          }, () => {
            try { audioCtx.close(); } catch (_) {}
          });
        };
        reader.onerror = () => {
          try { audioCtx.close(); } catch (_) {}
        };
        reader.readAsArrayBuffer(file);
      } catch (_) {}
    }

    play() {
      const player = this.els.videoPlayer;
      const hasVideo = !!(player && (this.videoFile || this.videoUrl) && player.src && player.readyState >= 1);
      if (!hasVideo) {
        this.hideLoadingOverlay();
        this._startSimulatedPlayback();
        return Promise.resolve();
      }
      return player.play().catch((err) => {
        console.warn('Playback prevented:', err);
      });
    }

    pause() {
      this._stopSimulatedPlayback();
      const player = this.els.videoPlayer;
      if (!player) return;
      player.pause();
    }

    togglePlay() {
      const player = this.els.videoPlayer;
      const hasVideo = !!(player && (this.videoFile || this.videoUrl) && player.src && player.readyState >= 1);
      const viewport = this.els.viewportWrapper || document.getElementById('studioViewportWrapper');
      const rect = viewport ? viewport.getBoundingClientRect() : { left: 0, top: 0, width: 200, height: 200 };
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      if (!hasVideo) {
        this.hideLoadingOverlay();
        if (this._simulatedPlaying) {
          this._stopSimulatedPlayback();
          this._showGestureRipple('pause', centerX, centerY);
        } else {
          this._startSimulatedPlayback();
          this._showGestureRipple('play', centerX, centerY);
        }
        return;
      }

      if (player.paused || player.ended) {
        player.play().then(() => {
          this._showGestureRipple('play', centerX, centerY);
        }).catch((err) => {
          console.warn('Playback prevented:', err);
        });
      } else {
        player.pause();
        this._showGestureRipple('pause', centerX, centerY);
      }
    }

    _startSimulatedPlayback() {
      this._stopSimulatedPlayback();
      this._simulatedPlaying = true;
      this._simulatedLastTime = performance.now();
      if (this.els.playPauseBtn) {
        this.els.playPauseBtn.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1.5"></rect>
            <rect x="14" y="4" width="4" height="16" rx="1.5"></rect>
          </svg>
        `;
        this.els.playPauseBtn.setAttribute('aria-label', 'Pause');
      }

      const tick = () => {
        if (!this._simulatedPlaying) return;
        const now = performance.now();
        const deltaMs = (now - this._simulatedLastTime) * (this.currentPlaybackRate || 1);
        this._simulatedLastTime = now;
        const durMs = (window.VideoEditor && window.VideoEditor.timeline ? window.VideoEditor.timeline.duration : 10000) || 10000;
        this._simulatedCurrentMs = Math.min(durMs, (this._simulatedCurrentMs || 0) + deltaMs);

        this.updateTimeDisplay(this._simulatedCurrentMs, durMs);
        if (this.onTimeUpdateCallback) {
          this.onTimeUpdateCallback(this._simulatedCurrentMs, durMs);
        }

        if (this._simulatedCurrentMs >= durMs) {
          this._stopSimulatedPlayback();
          return;
        }

        this._simulatedRaf = requestAnimationFrame(tick);
      };

      this._simulatedRaf = requestAnimationFrame(tick);
    }

    _stopSimulatedPlayback() {
      this._simulatedPlaying = false;
      if (this._simulatedRaf) {
        cancelAnimationFrame(this._simulatedRaf);
        this._simulatedRaf = null;
      }
      if (this.els.playPauseBtn) {
        this.els.playPauseBtn.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        `;
        this.els.playPauseBtn.setAttribute('aria-label', 'Play');
      }
    }

    seekTo(timeMs, immediate = false) {
      const player = this.els.videoPlayer;
      const hasVideo = !!(player && (this.videoFile || this.videoUrl) && player.src && player.readyState >= 1);
      const durMs = (hasVideo && player.duration) ? player.duration * 1000 : (window.VideoEditor && window.VideoEditor.timeline ? window.VideoEditor.timeline.duration : 0);
      const clampedMs = Math.max(0, durMs > 0 ? Math.min(durMs, timeMs) : timeMs);
      const targetSec = clampedMs / 1000;

      this._simulatedCurrentMs = clampedMs;

      // Latency-free instant UI and subtitle update
      this.updateTimeDisplay(clampedMs, durMs);
      if (this.onTimeUpdateCallback) {
        this.onTimeUpdateCallback(clampedMs, durMs);
      }

      if (!hasVideo) {
        this.hideLoadingOverlay();
        return;
      }

      // Direct frame-accurate seeking
      try {
        player.currentTime = targetSec;
      } catch (_) {}
    }

    stepSeconds(delta) {
      const player = this.els.videoPlayer;
      if (!player) return;
      const curMs = (player.currentTime || 0) * 1000;
      const durMs = (player.duration || 0) * 1000;
      const targetMs = Math.max(0, Math.min(durMs || Infinity, curMs + delta * 1000));

      if (window.VideoEditorHardware) {
        window.VideoEditorHardware.haptic(12);
      }
      this.seekTo(targetMs);
    }

    setPlaybackRate(rate) {
      this.currentPlaybackRate = rate;
      if (this.els.videoPlayer) {
        this.els.videoPlayer.playbackRate = rate;
        this.els.videoPlayer.defaultPlaybackRate = rate;
        this.els.videoPlayer.preservesPitch = true;
        this.els.videoPlayer.mozPreservesPitch = true;
        this.els.videoPlayer.webkitPreservesPitch = true;
      }
      if (this.els.speedLabel) {
        this.els.speedLabel.textContent = `${rate.toFixed(1)}×`;
      }
      if (window.VideoEditorPopovers && window.VideoEditorPopovers.updateSpeedDisplay) {
        window.VideoEditorPopovers.updateSpeedDisplay(rate);
      }
    }

    setAspectRatio(ratio) {
      if (!this.els.viewportWrapper) return;
      const player = this.els.videoPlayer;
      if (ratio === 'original' || ratio === 'auto') {
        if (player && player.videoWidth > 0 && player.videoHeight > 0) {
          this.els.viewportWrapper.style.setProperty('--vn-video-aspect', `${player.videoWidth} / ${player.videoHeight}`);
        } else {
          this.els.viewportWrapper.style.setProperty('--vn-video-aspect', '16 / 9');
        }
        this.els.viewportWrapper.setAttribute('data-ratio', 'original');
      } else {
        this.els.viewportWrapper.setAttribute('data-ratio', ratio);
      }
    }

    toggleFullscreen() {
      const stage = this.els.playerStage;
      if (!stage) return;
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (stage.requestFullscreen) {
          stage.requestFullscreen().catch(() => {});
        } else if (stage.webkitRequestFullscreen) {
          stage.webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      }
    }

    _updatePlayIcon(isPlaying) {
      if (this.els.playIcon && this.els.pauseIcon) {
        this.els.playIcon.classList.toggle('hidden', isPlaying);
        this.els.pauseIcon.classList.toggle('hidden', !isPlaying);
      }
      const hudPlay = document.querySelector('.vn-fs-hud-play-icon');
      const hudPause = document.querySelector('.vn-fs-hud-pause-icon');
      if (hudPlay && hudPause) {
        hudPlay.classList.toggle('hidden', isPlaying);
        hudPause.classList.toggle('hidden', !isPlaying);
      }
    }

    updateTimeDisplay(currentMs, totalMs) {
      const curStr = this.formatTime(currentMs, false);
      const totStr = this.formatTime(totalMs, false);
      const formatted = `${curStr} / ${totStr}`;
      if (this.els.timeDisplay) {
        this.els.timeDisplay.textContent = formatted;
      }
      const hudTime = document.getElementById('studioFsHudTime');
      if (hudTime) {
        hudTime.textContent = formatted;
      }
    }

    formatTime(ms, includeMillis = true) {
      if (isNaN(ms) || ms < 0) ms = 0;
      const totalSec = Math.floor(ms / 1000);
      const m = Math.floor(totalSec / 60);
      const s = totalSec % 60;
      const millis = Math.floor(ms % 1000);

      const sPad = String(s).padStart(2, '0');
      if (includeMillis) {
        const mPad = String(m).padStart(2, '0');
        const msPad = String(millis).padStart(3, '0');
        return `${mPad}:${sPad}.${msPad}`;
      }
      return `${m}:${sPad}`;
    }

    /**
     * Generate a crisp 1080p canvas video stream for zero-latency testing.
     */
    generateSampleVideo() {
      const canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1080;
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      const stream = canvas.captureStream(60);
      const durationMs = 15000;
      const startTime = performance.now();

      // Audio Tone
      let audioCtx = null;
      let osc = null;
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const dest = audioCtx.createMediaStreamDestination();
        osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        gain.gain.value = 0.04;
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.connect(gain);
        gain.connect(dest);
        osc.start();
        const audioTrack = dest.stream.getAudioTracks()[0];
        if (audioTrack) stream.addTrack(audioTrack);
      } catch (_) {}

      const chunks = [];
      let mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';

      const rec = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 12000000 // 12 Mbps crystal clear
      });

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      rec.onstop = () => {
        if (osc) {
          try { osc.stop(); } catch (_) {}
        }
        if (audioCtx) {
          try { audioCtx.close(); } catch (_) {}
        }
        const blob = new Blob(chunks, { type: 'video/webm' });
        const sampleFile = new File([blob], 'sample_kurdish_preview_1080p.webm', { type: 'video/webm' });
        this.loadVideoFile(sampleFile);
      };

      rec.start();

      let frame = 0;
      const render = () => {
        frame++;
        const elapsed = performance.now() - startTime;
        if (elapsed >= durationMs) {
          rec.stop();
          return;
        }

        // Crisp obsidian solid background
        ctx.fillStyle = '#0a0910';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Grid accents
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.lineWidth = 1;
        const step = 80;
        for (let x = 0; x < canvas.width; x += step) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height);
          ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += step) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvas.width, y);
          ctx.stroke();
        }

        // Crisp accent border
        ctx.strokeStyle = 'rgba(234, 179, 8, 0.5)';
        ctx.lineWidth = 6;
        ctx.strokeRect(60, 60, canvas.width - 120, canvas.height - 120);

        // Animated orbital circles
        ctx.strokeStyle = 'rgba(234, 179, 8, 0.35)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        const cx = canvas.width / 2 + Math.sin(frame * 0.03) * 90;
        const cy = canvas.height / 2 + Math.cos(frame * 0.03) * 45;
        ctx.arc(cx, cy, 220, 0, Math.PI * 2);
        ctx.stroke();

        // High contrast typography
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 54px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Kurdish Subtitle Studio · 1080p 60fps', canvas.width / 2, canvas.height / 2 - 40);

        ctx.font = 'bold 36px "Noto Naskh Arabic", sans-serif';
        ctx.fillStyle = '#fde047';
        ctx.fillText('تاقیکردنەوەی کوالێتی بەرز و هاوتاکردنی دەقی کوردی سۆرانی', canvas.width / 2, canvas.height / 2 + 35);

        const sec = (elapsed / 1000).toFixed(2);
        ctx.font = '700 24px monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fillText(`PLAYHEAD: ${sec}s / ${(durationMs / 1000).toFixed(1)}s · 1920×1080`, canvas.width / 2, canvas.height / 2 + 105);

        requestAnimationFrame(render);
      };

      requestAnimationFrame(render);
      VideoEditorUI.showToast('Rendering crystal-clear 1080p sample video...', 'info');
    }
  }

  window.VideoEditorPlayer = new VideoEditorPlayerController();
})();
