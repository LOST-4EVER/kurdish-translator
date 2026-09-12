/**
 * timeline.js — VN-style compact multi-track timeline for Video Studio.
 * Features left track header icons (🎵+, [T]+, 🖼+, 🎬+, 🔊),
 * golden Kurdish subtitle cue blocks with text preview, video filmstrip clip,
 * full-height scrubber needle, time ruler with tick dots, and zero-lag seeking.
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
      this._pendingSeekRaf = null;
      this._pendingSeekTime = null;

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
            <div class="vn-track-header-item vn-hdr-text" title="Subtitle / Kurdish Text Track">
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
          this._stopEdgeAutoScroll();
          try {
            this.dom.viewport.releasePointerCapture(upEvent.pointerId);
          } catch {}
          this.dom.viewport.removeEventListener('pointermove', onPointerMove);
          this.dom.viewport.removeEventListener('pointerup', onPointerUp);
          this.dom.viewport.removeEventListener('pointercancel', onPointerUp);

          // Flush any final seek immediately on release
          if (this._pendingSeekTime !== null && typeof this.options.onSeek === 'function') {
            this.options.onSeek(this._pendingSeekTime);
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

      // Mouse wheel zoom with Ctrl/Cmd or horizontal scroll
      this.dom.viewport.addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const factor = e.deltaY < 0 ? 1.15 : 0.85;
          this.setZoom(this.zoom * factor);
        }
      }, { passive: false });

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

    setZoom(pixelsPerSecond) {
      const clamped = Math.max(
        this.options.minPixelsPerSecond,
        Math.min(this.options.maxPixelsPerSecond, pixelsPerSecond)
      );
      if (Math.abs(clamped - this.zoom) < 0.5) return;
      this.zoom = clamped;

      this._updateDimensions();
      this._renderRuler();
      this._renderCues();
      this._updatePlayhead();
    }

    zoomToFit() {
      if (!this.duration) return;
      const availableWidth = this.dom.viewport.clientWidth - 60;
      if (availableWidth <= 100) return;
      const durationSeconds = this.duration / 1000;
      const fitZoom = availableWidth / durationSeconds;
      this.setZoom(fitZoom);
    }

    setHasVideo(hasVideo, videoName = '') {
      this.hasVideo = !!hasVideo;
      this.videoName = videoName || '';
      if (this.dom.videoClipBox) {
        if (this.hasVideo) {
          this.dom.videoClipBox.classList.remove('hidden');
          if (this.dom.videoEmptyTrack) this.dom.videoEmptyTrack.classList.add('hidden');
          if (this.dom.clipTitle) this.dom.clipTitle.textContent = this.videoName || 'Video Track';
        } else {
          this.dom.videoClipBox.classList.add('hidden');
          if (this.dom.videoEmptyTrack) this.dom.videoEmptyTrack.classList.remove('hidden');
        }
      }
      this._updateDimensions();
    }

    _updateDimensions() {
      const durationSeconds = Math.max(1, (this.duration || 10000) / 1000);
      if (this.dom.viewport) {
        this._cachedViewportWidth = this.dom.viewport.clientWidth;
      }
      this.trackWidth = Math.max(this._cachedViewportWidth || 800, durationSeconds * this.zoom);
      this.dom.scrollCanvas.style.width = `${this.trackWidth}px`;

      // Update video clip box width only when a video is loaded
      if (this.dom.videoClipBox) {
        if (this.hasVideo) {
          const clipWidth = durationSeconds * this.zoom;
          this.dom.videoClipBox.style.width = `${clipWidth}px`;
        } else {
          this.dom.videoClipBox.style.width = '0px';
        }
      }
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

      // Determine tick intervals (e.g. 20:16, 20:18 with small dots like VN)
      let majorInterval = 2; // default 2 seconds
      if (this.zoom < 25) {
        majorInterval = 10;
      } else if (this.zoom < 45) {
        majorInterval = 5;
      } else if (this.zoom > 100) {
        majorInterval = 1;
      }

      const totalSec = Math.ceil(this.duration / 1000);
      const startSec = Math.max(0, Math.floor((scrollLeft - 20) / this.zoom));
      const endSec = Math.min(totalSec, Math.ceil((scrollLeft + canvasWidth + 20) / this.zoom));

      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.font = '10px "Inter", -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (let s = startSec; s <= endSec; s += 1) {
        const x = (s * this.zoom) - scrollLeft;
        if (x < -20 || x > canvasWidth + 20) continue;
        const isMajor = s % majorInterval === 0;

        if (isMajor) {
          const timeStr = this.formatTimecode(s * 1000, false);
          ctx.fillText(timeStr, x, 11);
        } else {
          // VN-style subtle dot
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

        const isArabic = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(cue.text || '');
        if (isArabic) pill.classList.add('rtl-cue');

        const cleanText = (cue.text || '').replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, '').trim();

        pill.innerHTML = `
          <div class="vn-cue-handle left-handle" data-handle="left" title="Drag to trim start time"></div>
          <div class="vn-cue-pill-inner">
            <span class="vn-cue-text">${cleanText}</span>
          </div>
          <div class="vn-cue-handle right-handle" data-handle="right" title="Drag to trim end time"></div>
        `;
        pill.title = `#${idx + 1} [${this.formatTimecode(cue.start)} ➔ ${this.formatTimecode(cue.end)}]: ${cleanText}`;

        let isDraggingPill = false;
        let startX = 0;
        let handleType = 'move';
        let origStart = cue.start;
        let origEnd = cue.end;

        pill.addEventListener('pointerdown', (e) => {
          if (e.button !== 0) return;
          e.stopPropagation();

          const handleEl = e.target.closest('.vn-cue-handle');
          handleType = handleEl ? handleEl.dataset.handle : 'move';
          startX = e.clientX;
          origStart = cue.start;
          origEnd = cue.end;
          isDraggingPill = false;

          const onPointerMove = (moveEvent) => {
            const dx = moveEvent.clientX - startX;
            if (!isDraggingPill && Math.abs(dx) > 3) {
              isDraggingPill = true;
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
            pill.style.left = `${leftPx}px`;
            pill.style.width = `${widthPx}px`;

            cue._tempStart = newStart;
            cue._tempEnd = newEnd;
          };

          const onPointerUp = (upEvent) => {
            pill.removeEventListener('pointermove', onPointerMove);
            pill.removeEventListener('pointerup', onPointerUp);
            pill.removeEventListener('pointercancel', onPointerUp);
            pill.classList.remove('is-dragging');
            try {
              if (pill.hasPointerCapture(upEvent.pointerId)) {
                pill.releasePointerCapture(upEvent.pointerId);
              }
            } catch (_) {}

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

        pill.addEventListener('dblclick', (e) => {
          e.stopPropagation();
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

    _updatePlayhead() {
      const currentSec = this.currentTime / 1000;
      const x = currentSec * this.zoom;

      // Sub-pixel threshold check to skip redundant DOM updates
      if (Math.abs(x - this._lastPlayheadX) >= 0.25) {
        this._lastPlayheadX = x;
        this.dom.needle.style.transform = `translate3d(${x}px, 0, 0)`;

        const roundedSec = Math.floor(this.currentTime / 250);
        if (roundedSec !== this._lastRoundedSec) {
          this._lastRoundedSec = roundedSec;
          this.dom.needleTime.textContent = this.formatTimecode(this.currentTime);
        }

        if (this.duration > 0 && this.dom.audioBarFill) {
          const pct = Math.min(100, (this.currentTime / this.duration) * 100);
          const intPct = Math.round(pct);
          if (intPct !== this._lastIntPct) {
            this._lastIntPct = intPct;
            this.dom.audioBarFill.style.width = `${pct}%`;
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
      this.container.innerHTML = '';
    }
  }

  window.StudioTimeline = StudioTimeline;
})();
