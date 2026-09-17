/**
 * timeline.js — VN-style compact multi-track timeline for Video Studio.
 * Features left track header icons, golden Kurdish subtitle cue blocks
 * with text preview, video filmstrip clip, full-height scrubber needle,
 * time ruler with tick dots, and zero-lag seeking.
 */
(() => {
  'use strict';

  class StudioTimeline {
    constructor(containerEl, options = {}) {
      this.container = typeof containerEl === 'string' ? document.querySelector(containerEl) : containerEl;
      if (!this.container) {
        console.error('StudioTimeline: Container element not found');
        return;
      }

      this.options = Object.assign({
        pixelsPerSecond: 48, // Base zoom scale
        minPixelsPerSecond: 10,
        maxPixelsPerSecond: 240,
        onSeek: null,
        onCueSelect: null,
        onCueDoubleClick: null,
        onCueEdit: null,
        onCueDelete: null,
        onCueSplit: null,
        onHeaderClick: null,
      }, options);

      this.duration = 0;      // Total duration in ms
      this.currentTime = 0;   // Current playhead in ms
      this.cues = [];         // Array of subtitle cues
      this.activeCueIndex = -1;
      this.zoom = this.options.pixelsPerSecond;
      this.isDragging = false;
      this.trackWidth = 0;
      this.hasVideo = false;
      this.videoName = '';

      // Ultra-smooth playhead performance caching
      this._cuePillMap = new Map();
      this._canvasLeft = 0;
      this._lastPlayheadX = -1;
      this._lastRoundedSec = -1;
      this._lastIntPct = -1;
      this._pendingSeekRaf = null;
      this._pendingSeekTime = null;
      this._holdPopupEl = null;
      this._activeHoldPill = null;

      this._initDOM();
      this._bindEvents();
    }

    _initDOM() {
      this.container.innerHTML = `
        <div class="vn-timeline-wrapper">
          <!-- Left Track Headers (Multi-track control column) -->
          <div class="vn-track-headers-col">
            <div class="vn-track-header-item vn-hdr-music" title="Audio / Music Track">
              <span class="vn-hdr-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg></span>
            </div>
            <div class="vn-track-header-item vn-hdr-text" title="Subtitle / Kurdish Text Track (Click to Add Cue)">
              <span class="vn-hdr-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg></span>
            </div>
            <div class="vn-track-header-item vn-hdr-sticker" title="Overlay &amp; Sticker Track">
              <span class="vn-hdr-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg></span>
            </div>
            <div class="vn-track-header-item vn-hdr-video" title="Main Video Track">
              <span class="vn-hdr-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line></svg></span>
            </div>
            <div class="vn-track-header-item vn-hdr-audio" title="Audio Track &amp; Volume">
              <span class="vn-hdr-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg></span>
            </div>
            <div class="vn-track-header-item vn-hdr-ruler-spacer"></div>
          </div>

          <!-- Timeline Viewport -->
          <div class="vn-timeline-viewport" tabindex="0" role="slider" aria-label="Video Timeline" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
            <div class="vn-timeline-scroll-canvas">
              <!-- 1. Music Track (Auxiliary) -->
              <div class="vn-lane vn-lane-music">
                <div class="vn-lane-music-bg"></div>
              </div>

              <!-- 2. Subtitle Cues Track (Golden blocks with Kurdish text preview) -->
              <div class="vn-lane vn-lane-subtitles">
                <div class="vn-cues-layer"></div>
              </div>

              <!-- 3. Picture-in-picture / Sticker Track -->
              <div class="vn-lane vn-lane-sticker">
                <div class="vn-lane-sticker-line"></div>
              </div>

              <!-- 4. Video Track (Filmstrip with yellow clip border) -->
              <div class="vn-lane vn-lane-video">
                <div class="vn-video-empty-track" id="vnVideoEmptyTrack">
                  <span class="vn-video-empty-track-text">No video loaded · Drag &amp; drop video here or click Video +</span>
                </div>
                <div class="vn-video-clip-box hidden" id="vnVideoClipBox">
                  <div class="vn-filmstrip-frames" id="vnFilmstripFrames">
                    <span class="vn-clip-title" id="vnClipTitle">Video Track</span>
                  </div>
                  <div class="vn-clip-handle left-handle"></div>
                  <div class="vn-clip-handle right-handle"></div>
                </div>
              </div>

              <!-- 5. Audio Waveform Lane -->
              <div class="vn-lane vn-lane-audio">
                <canvas class="vn-audio-waveform-canvas" id="vnAudioWaveformCanvas"></canvas>
                <div class="vn-audio-bar-fill" id="vnAudioBarFill"></div>
              </div>

              <!-- Bottom Time Ruler with dot ticks (VN Style) -->
              <div class="vn-lane vn-lane-ruler" title="Click to seek playhead">
                <canvas class="vn-ruler-canvas"></canvas>
              </div>

              <!-- Full-Height Scrubber Needle -->
              <div class="vn-needle-scrubber">
                <div class="vn-needle-head">
                  <span class="vn-needle-time">0:00</span>
                </div>
                <div class="vn-needle-line"></div>
              </div>

              <!-- Hover Time Preview Indicator -->
              <div class="vn-hover-indicator hidden">
                <div class="vn-hover-line"></div>
                <div class="vn-hover-tooltip">00:00</div>
              </div>
            </div>
          </div>
        </div>
      `;

      this.dom = {
        viewport: this.container.querySelector('.vn-timeline-viewport'),
        scrollCanvas: this.container.querySelector('.vn-timeline-scroll-canvas'),
        cuesLayer: this.container.querySelector('.vn-cues-layer'),
        videoClipBox: this.container.querySelector('#vnVideoClipBox'),
        videoEmptyTrack: this.container.querySelector('#vnVideoEmptyTrack'),
        clipTitle: this.container.querySelector('#vnClipTitle'),
        filmstripFrames: this.container.querySelector('#vnFilmstripFrames'),
        audioWaveformCanvas: this.container.querySelector('#vnAudioWaveformCanvas'),
        audioBarFill: this.container.querySelector('#vnAudioBarFill'),
        rulerCanvas: this.container.querySelector('.vn-ruler-canvas'),
        rulerLane: this.container.querySelector('.vn-lane-ruler'),
        needle: this.container.querySelector('.vn-needle-scrubber'),
        needleTime: this.container.querySelector('.vn-needle-time'),
        hoverIndicator: this.container.querySelector('.vn-hover-indicator'),
        hoverTooltip: this.container.querySelector('.vn-hover-tooltip'),
      };
    }

    _bindEvents() {
      // Track Header Clicks
      const headers = this.container.querySelectorAll('.vn-track-header-item');
      headers.forEach((hdr) => {
        hdr.addEventListener('click', (e) => {
          e.stopPropagation();
          let type = null;
          if (hdr.classList.contains('vn-hdr-music')) type = 'music';
          else if (hdr.classList.contains('vn-hdr-text')) type = 'text';
          else if (hdr.classList.contains('vn-hdr-sticker')) type = 'sticker';
          else if (hdr.classList.contains('vn-hdr-video')) type = 'video';
          else if (hdr.classList.contains('vn-hdr-audio')) type = 'audio';

          if (type && typeof this.options.onHeaderClick === 'function') {
            this.options.onHeaderClick(type);
          }
        });
      });

      // Cache container left offset
      const updateCanvasBounds = () => {
        if (this.dom && this.dom.scrollCanvas) {
          const rect = this.dom.scrollCanvas.getBoundingClientRect();
          this._canvasLeft = rect.left;
        }
      };

      const getPointerX = (evt) => {
        if (!evt) return 0;
        if (typeof evt.clientX === 'number' && evt.clientX > 0) return evt.clientX;
        if (evt.touches && evt.touches[0] && typeof evt.touches[0].clientX === 'number') return evt.touches[0].clientX;
        if (evt.changedTouches && evt.changedTouches[0] && typeof evt.changedTouches[0].clientX === 'number') return evt.changedTouches[0].clientX;
        return evt.clientX || 0;
      };

      // Scrubber Interaction (pointer down on needle, ruler, or canvas)
      const onPointerDown = (e) => {
        if (e.button !== undefined && e.button !== 0) return; // Primary pointer/touch only
        this.isDragging = true;
        if (this.dom.needle) this.dom.needle.classList.add('dragging');
        if (window.VideoEditorHardware && window.VideoEditorHardware.haptic) {
          window.VideoEditorHardware.haptic(15);
        }
        this._lastPointerX = getPointerX(e);
        try {
          this.dom.viewport.setPointerCapture(e.pointerId);
        } catch (_) {}

        updateCanvasBounds();
        this._handleScrubEvent(e);
        this._startEdgeAutoScroll();

        const onPointerMove = (moveEvent) => {
          if (!this.isDragging) return;
          this._lastPointerX = getPointerX(moveEvent);
          this._handleScrubEvent(moveEvent);
        };

        const onPointerUp = (upEvent) => {
          this.isDragging = false;
          if (this.dom.needle) this.dom.needle.classList.remove('dragging');
          this._stopEdgeAutoScroll();
          try {
            this.dom.viewport.releasePointerCapture(upEvent.pointerId);
          } catch {}
          this.dom.viewport.removeEventListener('pointermove', onPointerMove);
          this.dom.viewport.removeEventListener('pointerup', onPointerUp);
          this.dom.viewport.removeEventListener('pointercancel', onPointerUp);

          // Flush any final seek immediately on release with immediate precision
          if (this._pendingSeekTime !== null && typeof this.options.onSeek === 'function') {
            this.options.onSeek(this._pendingSeekTime, true);
            this._pendingSeekTime = null;
          }
        };

        this.dom.viewport.addEventListener('pointermove', onPointerMove, { passive: true });
        this.dom.viewport.addEventListener('pointerup', onPointerUp);
        this.dom.viewport.addEventListener('pointercancel', onPointerUp);
      };

      if (this.dom.needle) {
        this.dom.needle.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          onPointerDown(e);
        });
      }

      this.dom.scrollCanvas.addEventListener('pointerdown', (e) => {
        // If clicked on a cue block, let the cue click handler handle selection
        if (e.target.closest('.vn-cue-pill')) return;
        onPointerDown(e);
      });

      // Update ruler position on viewport scroll (zero-cost virtualized ruler)
      let scrollRaf = null;
      this.dom.viewport.addEventListener('scroll', () => {
        if (!scrollRaf) {
          scrollRaf = requestAnimationFrame(() => {
            scrollRaf = null;
            this._renderRuler();
          });
        }
      }, { passive: true });

      // Mouse wheel zoom with Ctrl/Cmd or horizontal timeline scrolling (prevents scrolling outside the timeline)
      this.dom.viewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.ctrlKey || e.metaKey) {
          const viewportRect = this.dom.viewport.getBoundingClientRect();
          const clientOffset = e.clientX - viewportRect.left;
          const focalSec = (this.dom.viewport.scrollLeft + clientOffset) / Math.max(1, this.zoom);
          const factor = e.deltaY < 0 ? 1.15 : 0.85;
          this.setZoom(this.zoom * factor, focalSec);
        } else {
          // Translate vertical or horizontal wheel delta strictly into timeline horizontal scrolling
          const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
          this.dom.viewport.scrollLeft += delta;
        }
      }, { passive: false });

      // Multi-touch pinch-to-zoom gesture engine
      let touchPinchActive = false;
      let initialPinchDist = 0;
      let initialPinchZoom = this.zoom;
      let pinchFocalSec = 0;
      let pinchClientOffset = 0;

      this.dom.viewport.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
          touchPinchActive = true;
          this.isDragging = false;
          this._stopEdgeAutoScroll();
          const t1 = e.touches[0];
          const t2 = e.touches[1];
          initialPinchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
          initialPinchZoom = this.zoom;
          const viewportRect = this.dom.viewport.getBoundingClientRect();
          const midX = (t1.clientX + t2.clientX) / 2;
          pinchClientOffset = midX - viewportRect.left;
          pinchFocalSec = (this.dom.viewport.scrollLeft + pinchClientOffset) / Math.max(1, this.zoom);
        }
      }, { passive: false });

      this.dom.viewport.addEventListener('touchmove', (e) => {
        if (touchPinchActive && e.touches.length === 2) {
          e.preventDefault();
          const t1 = e.touches[0];
          const t2 = e.touches[1];
          const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
          if (initialPinchDist > 8) {
            const scale = currentDist / initialPinchDist;
            this.setZoom(initialPinchZoom * scale, pinchFocalSec);
          }
        }
      }, { passive: false });

      const endTouchPinch = () => {
        touchPinchActive = false;
      };
      this.dom.viewport.addEventListener('touchend', endTouchPinch, { passive: true });
      this.dom.viewport.addEventListener('touchcancel', endTouchPinch, { passive: true });

      // Double-tap on ruler/canvas toggles between fit-to-view and detail zoom
      let lastRulerTapTime = 0;
      let lastRulerTapX = 0;
      if (this.dom.rulerCanvas) {
        this.dom.rulerCanvas.addEventListener('pointerdown', (e) => {
          const now = performance.now();
          if (now - lastRulerTapTime < 340 && Math.abs(e.clientX - lastRulerTapX) < 45) {
            lastRulerTapTime = 0;
            if (this.zoom > 50) {
              this.zoomToFit();
            } else {
              const viewportRect = this.dom.viewport.getBoundingClientRect();
              const focalSec = (this.dom.viewport.scrollLeft + (e.clientX - viewportRect.left)) / Math.max(1, this.zoom);
              this.setZoom(80, focalSec);
            }
          } else {
            lastRulerTapTime = now;
            lastRulerTapX = e.clientX;
          }
        });
      }

      // Prevent outer page scrolling from wheel gestures inside the timeline container
      if (this.container) {
        this.container.addEventListener('wheel', (e) => {
          if (!e.target.closest('.vn-popover') && !e.target.closest('.vn-quick-panel')) {
            e.stopPropagation();
          }
        }, { passive: true });
      }

      // Hover indicator
      this.dom.viewport.addEventListener('pointermove', (e) => {
        if (this.isDragging || !this.duration) {
          this.dom.hoverIndicator.classList.add('hidden');
          return;
        }
        const viewportRect = this.dom.viewport.getBoundingClientRect();
        const clientX = (e.clientX - viewportRect.left) + this.dom.viewport.scrollLeft;
        if (clientX < 0 || clientX > this.trackWidth) {
          this.dom.hoverIndicator.classList.add('hidden');
          return;
        }
        const timeMs = Math.max(0, Math.min(this.duration, (clientX / this.zoom) * 1000));
        this.dom.hoverIndicator.style.transform = `translate3d(${clientX}px, 0, 0)`;
        this.dom.hoverTooltip.textContent = this.formatTimecode(timeMs);
        this.dom.hoverIndicator.classList.remove('hidden');
      }, { passive: true });

      this.dom.viewport.addEventListener('pointerleave', () => {
        this.dom.hoverIndicator.classList.add('hidden');
      });

      // Double click on empty subtitle lane space to add a new cue at clicked timestamp
      const subLane = this.container.querySelector('.vn-lane-subtitles');
      if (subLane) {
        subLane.addEventListener('dblclick', (e) => {
          if (e.target.closest('.vn-cue-pill')) return;
          const rect = this.dom.scrollCanvas ? this.dom.scrollCanvas.getBoundingClientRect() : this.dom.viewport.getBoundingClientRect();
          const clickX = (e.clientX - rect.left);
          const clickTimeMs = Math.max(0, Math.min(this.duration || Infinity, (clickX / Math.max(1, this.zoom)) * 1000));
          if (typeof this.options.onCueAddRequested === 'function') {
            this.options.onCueAddRequested(clickTimeMs);
          } else if (typeof this.options.onHeaderClick === 'function') {
            this.setTime(clickTimeMs, false);
            this.options.onHeaderClick('text');
          }
        });
      }

      // Global outside dismiss handler for hold popup
      const dismissHoldPopup = (e) => {
        if (!this._holdPopupEl) return;
        if (e && e.target && (e.target.closest('.vn-cue-hold-popup') || e.target.closest('.vn-cue-pill.hold-active'))) {
          return;
        }
        this._hideCueHoldPopup();
      };

      document.addEventListener('pointerdown', dismissHoldPopup, true);
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this._holdPopupEl) {
          this._hideCueHoldPopup();
        }
      });
      this.dom.viewport.addEventListener('scroll', () => {
        if (this._holdPopupEl) this._hideCueHoldPopup();
      }, { passive: true });

      // Resize observer
      if (window.ResizeObserver) {
        new ResizeObserver(() => {
          this._updateDimensions();
          this._renderRuler();
          updateCanvasBounds();
        }).observe(this.dom.viewport);
      }
    }

    _startEdgeAutoScroll() {
      if (this._edgeScrollRaf) return;
      const loop = () => {
        if (!this.isDragging || this._lastPointerX === undefined) {
          this._stopEdgeAutoScroll();
          return;
        }
        const viewportRect = this.dom.viewport.getBoundingClientRect();
        const relX = this._lastPointerX - viewportRect.left;
        const edgeThreshold = 48;
        let deltaScroll = 0;

        if (relX < edgeThreshold && this.dom.viewport.scrollLeft > 0) {
          const factor = (edgeThreshold - relX) / edgeThreshold;
          deltaScroll = -Math.round(factor * 20);
        } else if (relX > viewportRect.width - edgeThreshold) {
          const maxScroll = Math.max(0, this.trackWidth - viewportRect.width);
          if (this.dom.viewport.scrollLeft < maxScroll) {
            const factor = (relX - (viewportRect.width - edgeThreshold)) / edgeThreshold;
            deltaScroll = Math.round(factor * 20);
          }
        }

        if (deltaScroll !== 0) {
          this.dom.viewport.scrollLeft += deltaScroll;
          const clientX = (this._lastPointerX - viewportRect.left) + this.dom.viewport.scrollLeft;
          const targetTimeMs = Math.max(0, Math.min(this.duration || Infinity, (clientX / this.zoom) * 1000));
          this.setTime(targetTimeMs, true);

          this._pendingSeekTime = targetTimeMs;
          if (!this._pendingSeekRaf) {
            this._pendingSeekRaf = requestAnimationFrame(() => {
              this._pendingSeekRaf = null;
              if (this._pendingSeekTime !== null && typeof this.options.onSeek === 'function') {
                this.options.onSeek(this._pendingSeekTime);
                this._pendingSeekTime = null;
              }
            });
          }
        }
        this._edgeScrollRaf = requestAnimationFrame(loop);
      };
      this._edgeScrollRaf = requestAnimationFrame(loop);
    }

    _stopEdgeAutoScroll() {
      if (this._edgeScrollRaf) {
        cancelAnimationFrame(this._edgeScrollRaf);
        this._edgeScrollRaf = null;
      }
    }

    _handleScrubEvent(e) {
      if (!e) return;
      const getPointerX = (evt) => {
        if (!evt) return 0;
        if (typeof evt.clientX === 'number' && evt.clientX > 0) return evt.clientX;
        if (evt.touches && evt.touches[0] && typeof evt.touches[0].clientX === 'number') return evt.touches[0].clientX;
        if (evt.changedTouches && evt.changedTouches[0] && typeof evt.changedTouches[0].clientX === 'number') return evt.changedTouches[0].clientX;
        return evt.clientX || 0;
      };
      const viewportRect = this.dom.viewport.getBoundingClientRect();
      const relativeX = getPointerX(e) - viewportRect.left;
      const clientX = relativeX + this.dom.viewport.scrollLeft;
      const targetTimeMs = Math.max(0, Math.min(this.duration || Infinity, (clientX / this.zoom) * 1000));

      // 1. Update playhead needle visually immediately at 60/120Hz
      this.setTime(targetTimeMs, true);

      // 2. Throttle video element seek via RAF to avoid choking video decoders
      this._pendingSeekTime = targetTimeMs;
      if (!this._pendingSeekRaf) {
        this._pendingSeekRaf = requestAnimationFrame(() => {
          this._pendingSeekRaf = null;
          if (this._pendingSeekTime !== null && typeof this.options.onSeek === 'function') {
            this.options.onSeek(this._pendingSeekTime);
            this._pendingSeekTime = null;
          }
        });
      }
    }

    setDuration(durationMs) {
      this.duration = Math.max(0, durationMs || 0);
      this._updateDimensions();
      this._renderRuler();
      this._renderCues();
      this._updatePlayhead();
    }

    setTime(timeMs, isInternal = false) {
      this.currentTime = Math.max(0, Math.min(this.duration || Infinity, timeMs || 0));
      this._updatePlayhead();
      this._updateActiveCue();

      if (!isInternal && !this.isDragging) {
        this._ensurePlayheadInView();
      }
    }

    setCues(cues) {
      this.cues = Array.isArray(cues) ? cues : [];
      this._renderCues();
      this._updateActiveCue();
    }

    updateCue(index, cue) {
      if (!this.cues || index < 0 || index >= this.cues.length) return;
      if (cue) {
        this.cues[index] = { ...this.cues[index], ...cue };
      }
      const targetCue = this.cues[index];
      const pill = this._cuePillMap.get(index);
      if (pill && targetCue) {
        const startSec = (targetCue.start || 0) / 1000;
        const endSec = Math.max(startSec + 0.1, (targetCue.end || (targetCue.start + 1000)) / 1000);
        const durationSec = endSec - startSec;
        const leftPx = startSec * this.zoom;
        const widthPx = Math.max(12, durationSec * this.zoom);

        pill.style.left = `${leftPx}px`;
        pill.style.width = `${widthPx}px`;

        const cleanText = (targetCue.text || '').replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, '').trim();
        const textSpan = pill.querySelector('.vn-cue-text');
        if (textSpan) {
          textSpan.textContent = cleanText || 'نووسینی نوێ';
        }
        const durSpan = pill.querySelector('.vn-cue-dur-tag');
        if (durSpan) {
          durSpan.textContent = `${durationSec.toFixed(1)}s`;
        }
        const idxSpan = pill.querySelector('.vn-cue-idx-tag');
        if (idxSpan) {
          idxSpan.textContent = `#${index + 1}`;
        }

        pill.title = `#${index + 1} [${this.formatTimecode(targetCue.start)} → ${this.formatTimecode(targetCue.end)}]: ${cleanText}`;
      } else {
        this._renderCues();
      }
      this._updateActiveCue();
    }

    updateCueText(index, text) {
      if (!this.cues || index < 0 || index >= this.cues.length) return;
      this.cues[index].text = text;
      this.updateCue(index, { text });
    }

    getMinZoom() {
      const durationSeconds = Math.max(1, (this.duration || 10000) / 1000);
      const viewportWidth = Math.max(200, (this.dom.viewport ? this.dom.viewport.clientWidth : 800) - 40);
      // Min zoom allows fitting the whole media in the viewport (or a sensible floor)
      const fitZoom = viewportWidth / durationSeconds;
      return Math.max(0.5, Math.min(fitZoom, 80));
    }

    getMaxZoom() {
      const minZoom = this.getMinZoom();
      return Math.max(minZoom * 6, 240);
    }

    setZoom(pixelsPerSecond, focalSec = null) {
      const oldZoom = this.zoom;
      const minZoom = this.getMinZoom();
      const maxZoom = this.getMaxZoom();
      const clamped = Math.max(minZoom, Math.min(maxZoom, pixelsPerSecond));
      if (Math.abs(clamped - oldZoom) < 0.1) return;

      let focalOffset = 0;
      if (focalSec !== null && this.dom.viewport) {
        const currentFocalPx = focalSec * oldZoom;
        focalOffset = currentFocalPx - this.dom.viewport.scrollLeft;
      }

      this.zoom = clamped;

      this._updateDimensions();
      this._renderRuler();
      this._renderCues();
      this._updatePlayhead();

      if (focalSec !== null && this.dom.viewport) {
        const newFocalPx = focalSec * clamped;
        this.dom.viewport.scrollLeft = Math.max(0, newFocalPx - focalOffset);
      }
    }

    zoomToFit() {
      const fitZoom = this.getMinZoom();
      this.setZoom(fitZoom);
      if (this.dom.viewport) {
        this.dom.viewport.scrollLeft = 0;
      }
    }

    zoomIn() {
      const focalSec = (this.dom.viewport ? this.dom.viewport.scrollLeft + this.dom.viewport.clientWidth / 2 : 0) / Math.max(1, this.zoom);
      this.setZoom(this.zoom * 1.3, focalSec);
    }

    zoomOut() {
      const focalSec = (this.dom.viewport ? this.dom.viewport.scrollLeft + this.dom.viewport.clientWidth / 2 : 0) / Math.max(1, this.zoom);
      this.setZoom(this.zoom / 1.3, focalSec);
    }

    resetZoom() {
      this.zoomToFit();
    }

    setHasVideo(hasVideo, videoName = '', videoEl = null) {
      this.hasVideo = !!hasVideo;
      this.videoName = videoName || '';
      this._videoSourceEl = videoEl;
      if (this.dom.videoClipBox) {
        if (this.hasVideo) {
          this.dom.videoClipBox.classList.remove('hidden');
          if (this.dom.videoEmptyTrack) this.dom.videoEmptyTrack.classList.add('hidden');
          if (this.dom.clipTitle) this.dom.clipTitle.textContent = this.videoName || 'Video Track';
          this._generateFilmstripThumbnails();
        } else {
          this.dom.videoClipBox.classList.add('hidden');
          if (this.dom.videoEmptyTrack) this.dom.videoEmptyTrack.classList.remove('hidden');
          this._clearFilmstripThumbnails();
        }
      }
      this._updateDimensions();
    }

    _clearFilmstripThumbnails() {
      if (this._activeFilmstripVideo) {
        try {
          this._activeFilmstripVideo.pause();
          this._activeFilmstripVideo.src = '';
          this._activeFilmstripVideo.load();
        } catch (_) {}
        this._activeFilmstripVideo = null;
      }
      if (this.dom.filmstripFrames) {
        const title = this.dom.clipTitle;
        this.dom.filmstripFrames.innerHTML = '';
        if (title) this.dom.filmstripFrames.appendChild(title);
      }
      this._filmstripThumbnails = [];
    }

    _generateFilmstripThumbnails() {
      this._clearFilmstripThumbnails();
      if (!this.hasVideo || !this.duration || this.duration <= 0) return;
      const container = this.dom.filmstripFrames;
      if (!container) return;

      const video = this._videoSourceEl || (window.VideoEditorPlayer && window.VideoEditorPlayer.els ? window.VideoEditorPlayer.els.videoPlayer : null);
      if (!video || !video.src) return;

      const durationSec = this.duration / 1000;
      if (durationSec <= 0) return;

      const numThumbnails = Math.min(16, Math.max(4, Math.floor((this.trackWidth || 800) / 100)));
      const intervalSec = durationSec / numThumbnails;

      // Create a single high-performance canvas to avoid DOM explosion and base64 memory bloat
      const stripCanvas = document.createElement('canvas');
      stripCanvas.className = 'vn-filmstrip-canvas';
      stripCanvas.style.cssText = 'position:absolute; inset:0; width:100%; height:100%; pointer-events:none; opacity:0.65; border-radius:3px; object-fit:cover;';
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const canvasW = Math.min(2048, Math.round((this.trackWidth || 800) * dpr));
      const canvasH = Math.round(36 * dpr);
      stripCanvas.width = canvasW;
      stripCanvas.height = canvasH;

      const ctx = stripCanvas.getContext('2d');
      if (!ctx) return;

      const title = this.dom.clipTitle;
      container.innerHTML = '';
      container.appendChild(stripCanvas);
      if (title) container.appendChild(title);

      const offVideo = document.createElement('video');
      this._activeFilmstripVideo = offVideo;
      offVideo.muted = true;
      offVideo.playsInline = true;
      offVideo.crossOrigin = 'anonymous';
      offVideo.preload = 'metadata';
      offVideo.src = video.src;

      let currentIdx = 0;
      const thumbW = canvasW / numThumbnails;

      const cleanup = () => {
        if (this._activeFilmstripVideo === offVideo) {
          this._activeFilmstripVideo = null;
        }
        try {
          offVideo.src = '';
          offVideo.load();
        } catch (_) {}
      };

      const captureNext = () => {
        if (currentIdx >= numThumbnails || !this.hasVideo || this._activeFilmstripVideo !== offVideo) {
          cleanup();
          return;
        }
        const targetTime = Math.min(durationSec - 0.05, currentIdx * intervalSec);
        try {
          offVideo.currentTime = targetTime;
        } catch (_) {
          cleanup();
        }
      };

      const onSeeked = () => {
        if (this._activeFilmstripVideo !== offVideo) {
          cleanup();
          return;
        }
        try {
          const destX = currentIdx * thumbW;
          ctx.drawImage(offVideo, destX, 0, thumbW, canvasH);
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(destX + thumbW, 0);
          ctx.lineTo(destX + thumbW, canvasH);
          ctx.stroke();
        } catch (_) {}
        currentIdx++;
        captureNext();
      };

      offVideo.addEventListener('seeked', onSeeked, { passive: true });
      offVideo.addEventListener('error', () => cleanup(), { once: true });
      offVideo.addEventListener('loadeddata', () => {
        captureNext();
      }, { once: true });

      try {
        offVideo.load();
      } catch (_) {
        cleanup();
      }
    }

    setAudioData(audioData) {
      this.audioData = audioData;
      this._renderAudioWaveform();
    }

    _renderAudioWaveform() {
      const canvas = this.dom.audioWaveformCanvas;
      if (!canvas) return;

      const durationSeconds = Math.max(1, (this.duration || 10000) / 1000);
      const width = Math.max(20, Math.round(durationSeconds * this.zoom));
      const height = 24;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const safeCanvasWidth = Math.min(4096, Math.round(width * dpr));

      canvas.width = safeCanvasWidth;
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const scaleX = safeCanvasWidth / (width || 1);
      ctx.scale(scaleX, dpr);
      ctx.clearRect(0, 0, width, height);

      const barWidth = 2;
      const barGap = 1;
      const numBars = Math.floor(width / (barWidth + barGap));
      if (numBars <= 0) return;

      let buckets;
      if (this.audioData && window.WasmEngine) {
        buckets = window.WasmEngine.generateWaveformBuckets(this.audioData, numBars);
      } else {
        buckets = new Float32Array(numBars);
        for (let i = 0; i < numBars; i++) {
          buckets[i] = 0.08 + 0.04 * Math.sin(i * 0.15);
        }
      }

      const centerY = height / 2;
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#38bdf8');
      grad.addColorStop(0.5, '#818cf8');
      grad.addColorStop(1, '#c084fc');

      ctx.fillStyle = grad;

      for (let i = 0; i < numBars; i++) {
        const amp = Math.max(0.06, buckets[i] || 0.06);
        const barH = Math.max(2, Math.round(amp * (height - 6)));
        const x = i * (barWidth + barGap);
        const y = centerY - barH / 2;
        ctx.fillRect(x, y, barWidth, barH);
      }
    }

    _updateDimensions() {
      const durationSeconds = Math.max(1, (this.duration || 10000) / 1000);
      const viewportWidth = (this.dom.viewport ? this.dom.viewport.clientWidth : 800) || 800;
      this._cachedViewportWidth = viewportWidth;

      const contentWidth = Math.round(durationSeconds * this.zoom);
      this.trackWidth = Math.max(viewportWidth, contentWidth);
      if (this.dom.scrollCanvas) {
        this.dom.scrollCanvas.style.width = `${this.trackWidth}px`;
      }

      // Update video clip box width only when a video is loaded
      if (this.dom.videoClipBox) {
        if (this.hasVideo) {
          this.dom.videoClipBox.style.width = `${contentWidth}px`;
        } else {
          this.dom.videoClipBox.style.width = '0px';
        }
      }

      this._renderAudioWaveform();
    }

    _renderRuler() {
      const canvas = this.dom.rulerCanvas;
      if (!canvas) return;

      const dpr = window.devicePixelRatio || 1;
      const scrollLeft = (this.dom.viewport ? this.dom.viewport.scrollLeft : 0) || 0;
      const viewportWidth = (this._cachedViewportWidth || (this.dom.viewport ? this.dom.viewport.clientWidth : 800)) || 800;

      // Virtualized viewport-window rendering for ultra-fast zero-lag 60fps performance
      const canvasWidth = Math.min(this.trackWidth, viewportWidth + 300);
      const height = 22;

      canvas.width = canvasWidth * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${canvasWidth}px`;
      canvas.style.height = `${height}px`;
      canvas.style.position = 'absolute';
      canvas.style.left = `${scrollLeft}px`;
      canvas.style.top = '0';

      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, canvasWidth, height);

      // Adaptive intervals based on zoom level
      const intervals = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600];
      let majorInterval = intervals[0];
      for (let i = 0; i < intervals.length; i++) {
        if (intervals[i] * this.zoom >= 50) {
          majorInterval = intervals[i];
          break;
        }
      }

      const totalSec = Math.ceil((this.duration || 10000) / 1000);
      const startSec = Math.max(0, Math.floor((scrollLeft - 20) / this.zoom));
      const endSec = Math.min(totalSec, Math.ceil((scrollLeft + canvasWidth + 20) / this.zoom));

      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.font = '10px "Inter", -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const step = majorInterval >= 10 ? Math.max(1, Math.floor(majorInterval / 5)) : 1;

      for (let s = startSec - (startSec % step); s <= endSec; s += step) {
        if (s < 0 || s > totalSec) continue;
        const x = (s * this.zoom) - scrollLeft;
        if (x < -20 || x > canvasWidth + 20) continue;
        const isMajor = s % majorInterval === 0;

        if (isMajor) {
          const timeStr = this.formatTimecode(s * 1000, false);
          ctx.fillText(timeStr, x, 11);
        } else if (this.zoom * step >= 8) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.beginPath();
          ctx.arc(x, 11, 1.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        }
      }
    }

    _renderCues() {
      const layer = this.dom.cuesLayer;
      if (!layer) return;
      layer.innerHTML = '';
      this._cuePillMap.clear();

      if (!this.cues || !this.cues.length) return;

      const frag = document.createDocumentFragment();

      this.cues.forEach((cue, idx) => {
        const startSec = (cue.start || 0) / 1000;
        const endSec = Math.max(startSec + 0.1, (cue.end || (cue.start + 1000)) / 1000);
        const durationSec = endSec - startSec;

        const leftPx = startSec * this.zoom;
        const widthPx = Math.max(12, durationSec * this.zoom);

        const pill = document.createElement('div');
        pill.className = 'vn-cue-pill';
        pill.dataset.index = idx;
        pill.style.left = `${leftPx}px`;
        pill.style.width = `${widthPx}px`;

        const cleanText = (cue.text || '').replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, '').trim();

        const durText = `${durationSec.toFixed(1)}s`;
        pill.innerHTML = `
          <div class="vn-cue-handle left-handle" data-handle="left" title="Drag to trim start time"></div>
          <div class="vn-cue-pill-inner">
            <span class="vn-cue-idx-tag">#${idx + 1}</span>
            <span class="vn-cue-text">${cleanText || 'نووسینی نوێ'}</span>
            <span class="vn-cue-dur-tag">${durText}</span>
          </div>
          <div class="vn-cue-handle right-handle" data-handle="right" title="Drag to trim end time"></div>
        `;
        pill.title = `#${idx + 1} [${this.formatTimecode(cue.start)} → ${this.formatTimecode(cue.end)}]: ${cleanText}`;

        let isDraggingPill = false;
        let startX = 0;
        let startY = 0;
        let handleType = 'move';
        let origStart = cue.start;
        let origEnd = cue.end;
        let holdTimer = null;
        let holdTriggered = false;

        const clearHoldTimer = () => {
          if (holdTimer) {
            clearTimeout(holdTimer);
            holdTimer = null;
          }
        };

        pill.addEventListener('pointerdown', (e) => {
          if (e.button !== 0) return;
          e.stopPropagation();

          const handleEl = e.target.closest('.vn-cue-handle');
          handleType = handleEl ? handleEl.dataset.handle : 'move';
          startX = e.clientX;
          startY = e.clientY;
          origStart = cue.start;
          origEnd = cue.end;
          isDraggingPill = false;
          holdTriggered = false;

          clearHoldTimer();
          // Start long-press hold timer (420ms) if not clicking a trim handle
          if (!handleEl) {
            holdTimer = setTimeout(() => {
              if (isDraggingPill) return;
              holdTriggered = true;
              if (window.VideoEditorHardware && window.VideoEditorHardware.haptic) {
                window.VideoEditorHardware.haptic(25);
              }
              this._showCueHoldPopup(cue, idx, pill);
            }, 420);
          }

          const onPointerMove = (moveEvent) => {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;

            if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
              clearHoldTimer();
            }

            if (!isDraggingPill && Math.abs(dx) > 4) {
              isDraggingPill = true;
              this._hideCueHoldPopup();
              pill.classList.add('is-dragging');
              try { pill.setPointerCapture(moveEvent.pointerId); } catch (_) {}
            }
            if (!isDraggingPill) return;

            const deltaSec = dx / this.zoom;
            const deltaMs = deltaSec * 1000;

            let newStart = origStart;
            let newEnd = origEnd;

            if (handleType === 'left') {
              newStart = Math.max(0, Math.min(origEnd - 100, origStart + deltaMs));
            } else if (handleType === 'right') {
              newEnd = Math.max(origStart + 100, Math.min(this.duration || Infinity, origEnd + deltaMs));
            } else {
              const dur = origEnd - origStart;
              newStart = Math.max(0, origStart + deltaMs);
              newEnd = newStart + dur;
              if (this.duration && newEnd > this.duration) {
                newEnd = this.duration;
                newStart = Math.max(0, newEnd - dur);
              }
            }

            const leftPx = (newStart / 1000) * this.zoom;
            const widthPx = Math.max(12, ((newEnd - newStart) / 1000) * this.zoom);

            // Magnetic snapping against playhead needle and neighboring cues
            const SNAP_PX = 7;
            const snapThresholdMs = (SNAP_PX / Math.max(1, this.zoom)) * 1000;
            const snapTargets = [this.currentTime, 0];
            if (idx > 0 && this.cues[idx - 1]) {
              snapTargets.push(this.cues[idx - 1].end);
            }
            if (idx < this.cues.length - 1 && this.cues[idx + 1]) {
              snapTargets.push(this.cues[idx + 1].start);
            }

            let snapped = false;
            const checkSnap = (val) => {
              for (const target of snapTargets) {
                if (Math.abs(val - target) <= snapThresholdMs) {
                  return target;
                }
              }
              return val;
            };

            if (handleType === 'left') {
              const tentativeStart = checkSnap(newStart);
              if (tentativeStart !== newStart && tentativeStart < newEnd - 100) {
                newStart = tentativeStart;
                snapped = true;
              }
            } else if (handleType === 'right') {
              const tentativeEnd = checkSnap(newEnd);
              if (tentativeEnd !== newEnd && tentativeEnd > newStart + 100) {
                newEnd = tentativeEnd;
                snapped = true;
              }
            } else {
              const dur = newEnd - newStart;
              const tentativeStart = checkSnap(newStart);
              if (tentativeStart !== newStart) {
                newStart = tentativeStart;
                newEnd = newStart + dur;
                snapped = true;
              } else {
                const tentativeEnd = checkSnap(newEnd);
                if (tentativeEnd !== newEnd) {
                  newEnd = tentativeEnd;
                  newStart = Math.max(0, newEnd - dur);
                  snapped = true;
                }
              }
            }

            if (snapped && !pill._isSnapped) {
              pill._isSnapped = true;
              pill.classList.add('snapped');
              if (window.VideoEditorHardware && window.VideoEditorHardware.haptic) {
                window.VideoEditorHardware.haptic(15);
              }
            } else if (!snapped && pill._isSnapped) {
              pill._isSnapped = false;
              pill.classList.remove('snapped');
            }

            const finalLeftPx = (newStart / 1000) * this.zoom;
            const finalWidthPx = Math.max(12, ((newEnd - newStart) / 1000) * this.zoom);
            pill.style.left = `${finalLeftPx}px`;
            pill.style.width = `${finalWidthPx}px`;

            cue._tempStart = newStart;
            cue._tempEnd = newEnd;
          };

          const onPointerUp = (upEvent) => {
            clearHoldTimer();
            pill._isSnapped = false;
            pill.classList.remove('snapped');
            pill.removeEventListener('pointermove', onPointerMove);
            pill.removeEventListener('pointerup', onPointerUp);
            pill.removeEventListener('pointercancel', onPointerUp);
            pill.classList.remove('is-dragging');
            try {
              if (pill.hasPointerCapture(upEvent.pointerId)) {
                pill.releasePointerCapture(upEvent.pointerId);
              }
            } catch (_) {}

            if (holdTriggered) {
              return;
            }

            if (isDraggingPill) {
              const finalStart = cue._tempStart !== undefined ? cue._tempStart : cue.start;
              const finalEnd = cue._tempEnd !== undefined ? cue._tempEnd : cue.end;
              delete cue._tempStart;
              delete cue._tempEnd;

              if (window.VideoEditorState) {
                window.VideoEditorState.updateCueTiming(idx, finalStart, finalEnd);
              }
            } else {
              // Simple click: select & seek playhead
              this.activeCueIndex = idx;
              this.setTime(cue.start, true);
              this._updateActiveCue();
              if (typeof this.options.onCueSelect === 'function') {
                this.options.onCueSelect(cue, idx);
              }
            }
          };

          pill.addEventListener('pointermove', onPointerMove);
          pill.addEventListener('pointerup', onPointerUp);
          pill.addEventListener('pointercancel', onPointerUp);
        });

        pill.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          clearHoldTimer();
          if (window.VideoEditorHardware && window.VideoEditorHardware.haptic) {
            window.VideoEditorHardware.haptic(25);
          }
          this._showCueHoldPopup(cue, idx, pill);
        });

        pill.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          clearHoldTimer();
          this.activeCueIndex = idx;
          this.setTime(cue.start, true);
          this._updateActiveCue();
          if (typeof this.options.onCueDoubleClick === 'function') {
            this.options.onCueDoubleClick(cue, idx);
          }
        });

        this._cuePillMap.set(idx, pill);
        frag.appendChild(pill);
      });

      layer.appendChild(frag);
    }

    _showCueHoldPopup(cue, idx, pill) {
      this._hideCueHoldPopup();
      if (!cue || !pill || !this.dom.scrollCanvas) return;

      this._activeHoldPill = pill;
      pill.classList.add('hold-active');

      const popup = document.createElement('div');
      popup.className = 'vn-cue-hold-popup';
      popup.id = 'vnCueHoldPopup';

      const isArabic = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(cue.text || '');
      const cleanText = (cue.text || '').replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, '').trim();

      popup.innerHTML = `
        <div class="vn-hold-popup-header">
          <span class="vn-hold-popup-tag">#${idx + 1}</span>
          <span class="vn-hold-popup-time">${this.formatTimecode(cue.start, false)} <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:-1px; margin:0 3px;"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg> ${this.formatTimecode(cue.end, false)}</span>
        </div>
        <div class="vn-hold-popup-text" dir="ltr">${cleanText || '—'}</div>
        <div class="vn-hold-popup-actions">
          <button type="button" class="vn-hold-btn vn-hold-btn-edit" data-action="edit" title="Edit subtitle text">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            <span>Edit</span>
          </button>
          <button type="button" class="vn-hold-btn vn-hold-btn-split" data-action="split" title="Split cue at current playhead">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><line x1="20" y1="4" x2="8.12" y2="15.88"></line><line x1="14.47" y1="14.48" x2="20" y2="20"></line><line x1="8.12" y1="8.12" x2="12" y2="12"></line></svg>
            <span>Split</span>
          </button>
          <button type="button" class="vn-hold-btn vn-hold-btn-duplicate" data-action="duplicate" title="Duplicate cue">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            <span>Copy</span>
          </button>
          <button type="button" class="vn-hold-btn vn-hold-btn-nudge-prev" data-action="nudge-prev" title="Nudge timing -100ms">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="15 18 9 12 15 6"></polyline></svg>
            <span>-0.1s</span>
          </button>
          <button type="button" class="vn-hold-btn vn-hold-btn-nudge-next" data-action="nudge-next" title="Nudge timing +100ms">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="9 18 15 12 9 6"></polyline></svg>
            <span>+0.1s</span>
          </button>
          <button type="button" class="vn-hold-btn vn-hold-btn-delete" data-action="delete" title="Delete subtitle cue">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            <span>Delete</span>
          </button>
        </div>
      `;

      // Mount into scrollCanvas for native scrolling synchronization
      this.dom.scrollCanvas.appendChild(popup);
      this._holdPopupEl = popup;

      // Calculate anchor positioning
      const viewportRect = this.dom.viewport.getBoundingClientRect();
      const pillRect = pill.getBoundingClientRect();
      const scrollCanvasRect = this.dom.scrollCanvas.getBoundingClientRect();

      const pillLeftInCanvas = pillRect.left - scrollCanvasRect.left;
      const pillTopInCanvas = pillRect.top - scrollCanvasRect.top;
      const popupWidth = popup.offsetWidth || 192;
      const popupHeight = popup.offsetHeight || 98;

      let targetLeft = pillLeftInCanvas + (pillRect.width / 2) - (popupWidth / 2);
      // Clamp horizontally within viewport
      const minLeft = this.dom.viewport.scrollLeft + 8;
      const maxLeft = this.dom.viewport.scrollLeft + viewportRect.width - popupWidth - 8;
      targetLeft = Math.max(minLeft, Math.min(maxLeft, targetLeft));

      let targetTop = pillTopInCanvas - popupHeight - 8;
      if (targetTop < 4) {
        targetTop = pillTopInCanvas + pillRect.height + 8;
        popup.classList.add('placement-bottom');
      } else {
        popup.classList.add('placement-top');
      }

      popup.style.left = `${Math.round(targetLeft)}px`;
      popup.style.top = `${Math.round(targetTop)}px`;

      // Prevent click inside from closing immediately
      popup.addEventListener('pointerdown', (e) => e.stopPropagation());

      popup.querySelectorAll('.vn-hold-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const action = btn.dataset.action;
          this._hideCueHoldPopup();

          if (action === 'edit') {
            if (typeof this.options.onCueEdit === 'function') {
              this.options.onCueEdit(cue, idx);
            }
          } else if (action === 'delete') {
            if (typeof this.options.onCueDelete === 'function') {
              this.options.onCueDelete(cue, idx);
            }
          } else if (action === 'split') {
            if (typeof this.options.onCueSplit === 'function') {
              this.options.onCueSplit(cue, idx);
            }
          } else if (action === 'duplicate') {
            if (typeof this.options.onCueDuplicate === 'function') {
              this.options.onCueDuplicate(cue, idx);
            }
          } else if (action === 'nudge-prev') {
            if (typeof this.options.onCueNudge === 'function') {
              this.options.onCueNudge(cue, idx, -100);
            }
          } else if (action === 'nudge-next') {
            if (typeof this.options.onCueNudge === 'function') {
              this.options.onCueNudge(cue, idx, 100);
            }
          }
        });
      });
    }

    _hideCueHoldPopup() {
      if (this._holdPopupEl) {
        if (this._holdPopupEl.parentNode) {
          this._holdPopupEl.parentNode.removeChild(this._holdPopupEl);
        }
        this._holdPopupEl = null;
      }
      if (this._activeHoldPill) {
        this._activeHoldPill.classList.remove('hold-active');
        this._activeHoldPill = null;
      }
    }

    _updatePlayhead() {
      const currentSec = this.currentTime / 1000;
      const x = currentSec * this.zoom;

      // Sub-pixel threshold check to skip redundant DOM updates
      if (Math.abs(x - this._lastPlayheadX) >= 0.25) {
        this._lastPlayheadX = x;
        this.dom.needle.style.transform = `translate3d(${x}px, 0, 0)`;

        if (this.isDragging) {
          this.dom.needleTime.textContent = this.formatTimecode(this.currentTime, true);
        } else {
          const roundedSec = Math.floor(this.currentTime / 100);
          if (roundedSec !== this._lastRoundedSec) {
            this._lastRoundedSec = roundedSec;
            this.dom.needleTime.textContent = this.formatTimecode(this.currentTime, false);
          }
        }

        if (this.duration > 0 && this.dom.audioBarFill) {
          const contentWidth = Math.round((this.duration / 1000) * this.zoom);
          const fillPx = Math.min(contentWidth, currentSec * this.zoom);
          this.dom.audioBarFill.style.width = `${fillPx}px`;
          const intPct = Math.round(Math.min(100, (this.currentTime / this.duration) * 100));
          if (intPct !== this._lastIntPct) {
            this._lastIntPct = intPct;
            this.dom.viewport.setAttribute('aria-valuenow', intPct);
          }
        }
      }
    }

    _findCueIndexAtTime(timeMs) {
      const cues = this.cues;
      if (!cues || !cues.length) return -1;
      let low = 0;
      let high = cues.length - 1;
      while (low <= high) {
        const mid = (low + high) >> 1;
        const c = cues[mid];
        if (timeMs >= c.start && timeMs <= c.end) return mid;
        if (timeMs < c.start) high = mid - 1;
        else low = mid + 1;
      }
      return -1;
    }

    _updateActiveCue() {
      // 1. Fast check if current active cue is still active
      let activeIdx = -1;
      if (this.activeCueIndex >= 0 && this.activeCueIndex < this.cues.length) {
        const c = this.cues[this.activeCueIndex];
        if (c && this.currentTime >= c.start && this.currentTime <= c.end) {
          activeIdx = this.activeCueIndex;
        }
      }
      // 2. Binary search fallback O(log N)
      if (activeIdx === -1) {
        activeIdx = this._findCueIndexAtTime(this.currentTime);
      }

      if (activeIdx !== this.activeCueIndex) {
        // Remove active class from old cue pill (O(1))
        if (this.activeCueIndex !== -1) {
          const oldPill = this._cuePillMap.get(this.activeCueIndex);
          if (oldPill) oldPill.classList.remove('active');
        }
        this.activeCueIndex = activeIdx;
        // Add active class to new cue pill (O(1))
        if (activeIdx !== -1) {
          const newPill = this._cuePillMap.get(activeIdx);
          if (newPill) newPill.classList.add('active');
        }
      }
    }

    _ensurePlayheadInView() {
      const currentSec = this.currentTime / 1000;
      const playheadX = currentSec * this.zoom;
      const scrollLeft = this.dom.viewport.scrollLeft;
      const viewportWidth = this._cachedViewportWidth || this.dom.viewport.clientWidth || 800;

      if (playheadX > scrollLeft + viewportWidth - 50) {
        this.dom.viewport.scrollLeft = Math.max(0, playheadX - Math.round(viewportWidth * 0.25));
      } else if (playheadX < scrollLeft) {
        this.dom.viewport.scrollLeft = Math.max(0, playheadX - 40);
      }
    }

    formatTimecode(ms, includeMillis = true) {
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
      const mPad = String(m).padStart(2, '0');
      return `${mPad}:${sPad}`;
    }

    handleResize() {
      this._updateDimensions();
      this._renderRuler();
      if (this.dom && this.dom.scrollCanvas) {
        this._canvasLeft = this.dom.scrollCanvas.getBoundingClientRect().left;
      }
      this._updatePlayhead();
    }

    destroy() {
      this._stopEdgeAutoScroll();
      if (this._pendingSeekRaf) {
        cancelAnimationFrame(this._pendingSeekRaf);
        this._pendingSeekRaf = null;
      }
      this._hideCueHoldPopup();
      if (this.container) {
        this.container.innerHTML = '';
      }
    }
  }

  window.StudioTimeline = StudioTimeline;
})();
