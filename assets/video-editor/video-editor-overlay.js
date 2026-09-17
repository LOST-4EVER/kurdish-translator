/**
 * video-editor-overlay.js — Subtitle Overlay & Text Shower Renderer for Video Studio.
 * Renders Kurdish Sorani typography directly over the video viewport and updates
 * the interactive Text Shower strip above the timeline.
 */
(() => {
  'use strict';

  const isRtlText = (str) => (!str || !str.trim() || /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(str));
  const stripTags = (str) => {
    if (!str) return '';
    return str
      .replace(/\\N/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\\h/g, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\{[^}]*\}/g, '')
      .trim();
  };

  const extractPlacement = (cue, lineText) => {
    if (!cue && !lineText) return { vAlign: 'bottom', hAlign: 'center', pos: null };
    const raw = lineText !== undefined ? String(lineText) : (cue ? (cue.rawText || cue.text || '') : '');
    const settings = (cue && cue.settings) || '';

    let vAlign = 'bottom';
    let hAlign = 'center';
    let pos = null;

    if (cue && (cue.placement === 'top' || cue.placement === 'mid' || cue.placement === 'center')) {
      vAlign = cue.placement === 'center' ? 'mid' : cue.placement;
    }
    if (cue && cue.align) {
      hAlign = cue.align;
    }

    const posMatch = raw.match(/\{\\pos\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\)\}/i);
    const anMatch = raw.match(/\{\\an(\d)\}/i);
    const aMatch = raw.match(/\{\\a(\d+)\}/i);

    if (posMatch) {
      const x = parseFloat(posMatch[1]);
      const y = parseFloat(posMatch[2]);
      pos = {
        xPct: x > 1 ? Math.min(95, Math.max(5, (x / 1920) * 100)) : (x * 100),
        yPct: y > 1 ? Math.min(95, Math.max(5, (y / 1080) * 100)) : (y * 100),
      };
      if (y < 260) vAlign = 'top';
      else if (y > 540) vAlign = 'bottom';
      else vAlign = 'mid';

      if (x < 420) hAlign = 'left';
      else if (x > 860) hAlign = 'right';
      else hAlign = 'center';
    } else if (anMatch) {
      const num = parseInt(anMatch[1], 10);
      if (num >= 7 && num <= 9) vAlign = 'top';
      else if (num >= 4 && num <= 6) vAlign = 'mid';
      else vAlign = 'bottom';

      if (num === 1 || num === 4 || num === 7) hAlign = 'left';
      else if (num === 3 || num === 6 || num === 9) hAlign = 'right';
      else hAlign = 'center';
    } else if (aMatch) {
      const num = parseInt(aMatch[1], 10);
      if (num >= 5 && num <= 7) vAlign = 'top';
      else if (num >= 9 && num <= 11) vAlign = 'mid';
      else vAlign = 'bottom';

      if (num === 1 || num === 5 || num === 9) hAlign = 'left';
      else if (num === 3 || num === 7 || num === 11) hAlign = 'right';
      else hAlign = 'center';
    } else if (/<top>/i.test(raw) || /line:(?:0|1|2|3|4|5|10|15|20)%/i.test(settings) || /line:[0-3]\b/i.test(settings)) {
      vAlign = 'top';
    } else if (/<mid>/i.test(raw) || /line:(?:40|45|50|55|60)%/i.test(settings)) {
      vAlign = 'mid';
    }

    if (/align:(?:left|start)/i.test(settings)) hAlign = 'left';
    else if (/align:(?:right|end)/i.test(settings)) hAlign = 'right';
    else if (/align:(?:center|middle)/i.test(settings)) hAlign = 'center';

    return { vAlign, hAlign, pos };
  };

  class VideoEditorOverlayRenderer {
    constructor() {
      this.els = null;
      this.options = {};
      this._isDragging = false;
      this._hasMoved = false;
      this._startX = 0;
      this._startY = 0;
      this._startXPct = 50;
      this._startYPct = 88;
      this._currentXPct = 50;
      this._currentYPct = 88;
      this._lastRenderedCueHash = null;
      this._lastShowerHash = null;
    }

    init(els, options = {}) {
      this.els = els;
      this.options = options;
      this._lastRenderedCueHash = null;
      this._lastShowerHash = null;

      this._bindGestureEvents();
    }

    _bindGestureEvents() {
      const container = this.els?.videoOverlayContainer;
      const viewport = this.els?.viewportWrapper || document.getElementById('studioViewportWrapper');
      if (!container || !viewport) return;

      const guideX = document.getElementById('studioSnapGuideX');
      const guideY = document.getElementById('studioSnapGuideY');

      const activePointers = new Map();

      const getTouchCentroid = (e) => {
        if (e && e.touches && e.touches.length >= 2) {
          return {
            x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
            y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
            count: e.touches.length
          };
        }
        if (activePointers.size >= 2) {
          let sumX = 0;
          let sumY = 0;
          activePointers.forEach((p) => {
            sumX += p.x;
            sumY += p.y;
          });
          return {
            x: sumX / activePointers.size,
            y: sumY / activePointers.size,
            count: activePointers.size
          };
        }
        return null;
      };

      const onPointerDown = (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        e.stopPropagation();

        activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });

        const isTouchDevice = e.pointerType === 'touch' || (e.touches && e.touches.length > 0);
        const isHandleTouch = Boolean(e.target && e.target.closest('.vn-sub-drag-indicator'));
        const centroid = getTouchCentroid(e);

        if (isTouchDevice) {
          if (!centroid && !isHandleTouch) {
            // Single finger tap/touch on text - prepare for quick editor open
            this._isDragging = false;
            this._hasMoved = false;
            return;
          }
          this._isDragging = true;
          this._hasMoved = isHandleTouch;
          this._startX = centroid ? centroid.x : e.clientX;
          this._startY = centroid ? centroid.y : e.clientY;
        } else {
          // Desktop / Mouse
          this._isDragging = true;
          this._hasMoved = false;
          this._startX = e.clientX;
          this._startY = e.clientY;
        }

        const vpRect = viewport.getBoundingClientRect();
        const cRect = container.getBoundingClientRect();

        const cCenterX = cRect.left + cRect.width / 2;
        const cCenterY = cRect.top + cRect.height / 2;
        this._startXPct = Math.min(95, Math.max(5, ((cCenterX - vpRect.left) / vpRect.width) * 100));
        this._startYPct = Math.min(95, Math.max(5, ((cCenterY - vpRect.top) / vpRect.height) * 100));
        this._currentXPct = this._startXPct;
        this._currentYPct = this._startYPct;

        try {
          container.setPointerCapture(e.pointerId);
        } catch (_) {}
      };

      const onPointerMove = (e) => {
        if (activePointers.has(e.pointerId)) {
          activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
        }

        const isTouchDevice = e.pointerType === 'touch' || (e.touches && e.touches.length > 0);
        const centroid = getTouchCentroid(e);

        if (isTouchDevice && !centroid) {
          // If 2-finger touch released down to 1 finger during drag, stop dragging
          if (this._isDragging) {
            this._isDragging = false;
            container.classList.remove('is-dragging');
            if (guideX) guideX.classList.add('hidden');
            if (guideY) guideY.classList.add('hidden');
          }
          return;
        }

        if (!this._isDragging) return;

        const currentX = centroid ? centroid.x : e.clientX;
        const currentY = centroid ? centroid.y : e.clientY;

        const dx = currentX - this._startX;
        const dy = currentY - this._startY;

        if (!this._hasMoved && Math.hypot(dx, dy) > 4) {
          this._hasMoved = true;
          container.classList.add('is-dragging');
          const safeOverlay = document.getElementById('studioSafeZonesOverlay');
          if (safeOverlay) safeOverlay.classList.remove('hidden');
        }

        if (!this._hasMoved) return;

        const vpRect = viewport.getBoundingClientRect();
        if (!vpRect.width || !vpRect.height) return;

        let rawXPct = this._startXPct + (dx / vpRect.width) * 100;
        let rawYPct = this._startYPct + (dy / vpRect.height) * 100;

        let isSnappedX = false;
        if (Math.abs(rawXPct - 50) < 2.5) {
          rawXPct = 50;
          isSnappedX = true;
        } else if (Math.abs(rawXPct - 10) < 2.5) {
          rawXPct = 10;
          isSnappedX = true;
        } else if (Math.abs(rawXPct - 90) < 2.5) {
          rawXPct = 90;
          isSnappedX = true;
        }

        let isSnappedY = false;
        if (Math.abs(rawYPct - 50) < 2.5) {
          rawYPct = 50;
          isSnappedY = true;
        } else if (Math.abs(rawYPct - 88) < 2.5) {
          rawYPct = 88;
          isSnappedY = true;
        } else if (Math.abs(rawYPct - 12) < 2.5) {
          rawYPct = 12;
          isSnappedY = true;
        }

        if ((isSnappedX || isSnappedY) && !this._lastSnapped) {
          window.VideoEditorHardware?.haptic(12);
        }
        this._lastSnapped = isSnappedX || isSnappedY;

        if (guideX) {
          if (isSnappedX) guideX.classList.remove('hidden');
          else guideX.classList.add('hidden');
        }

        if (guideY) {
          if (isSnappedY) guideY.classList.remove('hidden');
          else guideY.classList.add('hidden');
        }

        this._currentXPct = Math.min(94, Math.max(6, rawXPct));
        this._currentYPct = Math.min(94, Math.max(6, rawYPct));

        container.style.left = `${this._currentXPct.toFixed(1)}%`;
        container.style.top = `${this._currentYPct.toFixed(1)}%`;
        container.style.bottom = 'auto';
        container.style.transform = 'translate(-50%, -50%)';
        container.classList.remove('pos-bottom', 'pos-center', 'pos-top');
      };

      const onPointerUp = (e) => {
        activePointers.delete(e.pointerId);

        if (!this._isDragging && !this._hasMoved) {
          // Single-finger tap: open quick editor bubble
          if (typeof this.options.onOverlayClick === 'function') {
            this.options.onOverlayClick();
          }
          return;
        }

        if (activePointers.size > 0 && (e.pointerType === 'touch' || e.touches?.length)) return;

        this._isDragging = false;
        this._lastSnapped = false;
        container.classList.remove('is-dragging');

        const safeOverlay = document.getElementById('studioSafeZonesOverlay');
        if (safeOverlay) safeOverlay.classList.add('hidden');

        if (guideX) guideX.classList.add('hidden');
        if (guideY) guideY.classList.add('hidden');

        try {
          if (container.hasPointerCapture(e.pointerId)) {
            container.releasePointerCapture(e.pointerId);
          }
        } catch (_) {}

        if (this._hasMoved) {
          const customPos = {
            xPct: Math.round(this._currentXPct * 10) / 10,
            yPct: Math.round(this._currentYPct * 10) / 10
          };

          if (window.VideoEditorState) {
            window.VideoEditorState.setOverlayConfig({ customPos });
          }
          if (typeof this.options.onPositionChange === 'function') {
            this.options.onPositionChange(customPos);
          }
        }
      };

      const onPointerCancel = (e) => {
        activePointers.delete(e.pointerId);
        this._isDragging = false;
        this._hasMoved = false;
        container.classList.remove('is-dragging');
        if (guideX) guideX.classList.add('hidden');
        if (guideY) guideY.classList.add('hidden');
      };

      container.addEventListener('pointerdown', onPointerDown);
      container.addEventListener('pointermove', onPointerMove);
      container.addEventListener('pointerup', onPointerUp);
      container.addEventListener('pointercancel', onPointerCancel);

      // Double-click to reset position back to bottom
      container.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        if (window.VideoEditorState) {
          window.VideoEditorState.setOverlayConfig({
            position: 'bottom',
            customPos: null
          });
          this.applyStyling(window.VideoEditorState.overlayConfig);
          if (typeof this.options.onPositionChange === 'function') {
            this.options.onPositionChange(null);
          }
        }
      });
    }

    renderActiveCue(cue, config) {
      if (!cue || !this.els || !this.els.videoOverlayText) {
        this.clearOverlay();
        return;
      }

      const cfg = config || {};
      const kurdishText = stripTags(cue.text || '');
      const origText = cue.origText || '';
      const customPosStr = cfg.customPos ? `${cfg.customPos.xPct}_${cfg.customPos.yPct}` : '';
      const cuePosStr = cue.pos ? `${cue.pos.x}_${cue.pos.y}` : '';
      const renderHash = `${kurdishText}|${origText}|${cfg.showOrig}|${cfg.position}|${customPosStr}|${cuePosStr}|${cue.fontFamily || cfg.fontFamily}|${cue.color || cfg.color}|${cue.fontSize || cfg.fontSize}|${this._isDragging}`;

      if (this._lastRenderedCueHash === renderHash && this.els.videoOverlayContainer && !this.els.videoOverlayContainer.classList.contains('hidden')) {
        return;
      }
      this._lastRenderedCueHash = renderHash;

      this.els.videoOverlayText.textContent = kurdishText;
      this.els.videoOverlayText.setAttribute('dir', isRtlText(kurdishText) ? 'rtl' : 'ltr');

      // Check if original English/source text should be displayed alongside Kurdish
      const hasOrig = Boolean(cfg.showOrig && origText.trim() && origText.trim() !== kurdishText.trim());
      if (hasOrig && this.els.videoOverlayOrig) {
        const origClean = stripTags(origText);
        this.els.videoOverlayOrig.textContent = origClean;
        this.els.videoOverlayOrig.setAttribute('dir', isRtlText(origClean) ? 'rtl' : 'ltr');
        this.els.videoOverlayOrig.classList.remove('hidden');
      } else if (this.els.videoOverlayOrig) {
        this.els.videoOverlayOrig.classList.add('hidden');
      }

      const container = this.els.videoOverlayContainer;
      const textEl = this.els.videoOverlayText;
      const placement = extractPlacement(cue);

      // Handle format-specific or cue-specific placement (from ASS, VTT, SUB, SAMI)
      if (container && !this._isDragging) {
        if (placement.pos) {
          container.style.left = `${placement.pos.xPct}%`;
          container.style.top = `${placement.pos.yPct}%`;
          container.style.bottom = 'auto';
          container.style.transform = 'translate(-50%, -50%)';
          container.classList.remove('pos-bottom', 'pos-center', 'pos-top');
        } else if (cue.pos && typeof cue.pos.x === 'number' && typeof cue.pos.y === 'number') {
          const xPct = cue.pos.x > 1 ? Math.min(95, Math.max(5, (cue.pos.x / 1920) * 100)) : (cue.pos.x * 100);
          const yPct = cue.pos.y > 1 ? Math.min(95, Math.max(5, (cue.pos.y / 1080) * 100)) : (cue.pos.y * 100);
          container.style.left = `${xPct}%`;
          container.style.top = `${yPct}%`;
          container.style.bottom = 'auto';
          container.style.transform = 'translate(-50%, -50%)';
          container.classList.remove('pos-bottom', 'pos-center', 'pos-top');
        } else if (placement.vAlign === 'top') {
          container.style.left = placement.hAlign === 'left' ? '8%' : (placement.hAlign === 'right' ? 'auto' : '50%');
          container.style.right = placement.hAlign === 'right' ? '8%' : 'auto';
          container.style.top = '';
          container.style.bottom = '';
          container.style.transform = placement.hAlign === 'center' ? 'translateX(-50%)' : 'none';
          container.classList.remove('pos-bottom', 'pos-center');
          container.classList.add('pos-top');
        } else if (placement.vAlign === 'mid') {
          container.style.left = placement.hAlign === 'left' ? '8%' : (placement.hAlign === 'right' ? 'auto' : '50%');
          container.style.right = placement.hAlign === 'right' ? '8%' : 'auto';
          container.style.top = '';
          container.style.bottom = '';
          container.style.transform = placement.hAlign === 'center' ? 'translate(-50%, -50%)' : 'translateY(-50%)';
          container.classList.remove('pos-bottom', 'pos-top');
          container.classList.add('pos-center');
        } else if (cfg.customPos && typeof cfg.customPos.xPct === 'number' && typeof cfg.customPos.yPct === 'number') {
          container.style.left = `${cfg.customPos.xPct}%`;
          container.style.top = `${cfg.customPos.yPct}%`;
          container.style.bottom = 'auto';
          container.style.transform = 'translate(-50%, -50%)';
          container.classList.remove('pos-bottom', 'pos-center', 'pos-top');
        } else {
          const pos = cfg.position || 'bottom';
          container.classList.remove('pos-bottom', 'pos-center', 'pos-top', 'pos-bottom-left', 'pos-bottom-right', 'pos-top-left', 'pos-top-right', 'pos-mid-left', 'pos-mid-right');
          if (pos === 'center') {
            container.style.left = '50%';
            container.style.right = 'auto';
            container.style.top = '50%';
            container.style.bottom = 'auto';
            container.style.transform = 'translate(-50%, -50%)';
          } else if (pos === 'mid-left') {
            container.style.left = '8%';
            container.style.right = 'auto';
            container.style.top = '50%';
            container.style.bottom = 'auto';
            container.style.transform = 'translateY(-50%)';
          } else if (pos === 'mid-right') {
            container.style.left = 'auto';
            container.style.right = '8%';
            container.style.top = '50%';
            container.style.bottom = 'auto';
            container.style.transform = 'translateY(-50%)';
          } else if (pos === 'top') {
            container.style.left = '50%';
            container.style.right = 'auto';
            container.style.top = '8%';
            container.style.bottom = 'auto';
            container.style.transform = 'translateX(-50%)';
          } else if (pos === 'top-left') {
            container.style.left = '8%';
            container.style.right = 'auto';
            container.style.top = '8%';
            container.style.bottom = 'auto';
            container.style.transform = 'none';
          } else if (pos === 'top-right') {
            container.style.left = 'auto';
            container.style.right = '8%';
            container.style.top = '8%';
            container.style.bottom = 'auto';
            container.style.transform = 'none';
          } else if (pos === 'bottom-left') {
            container.style.left = '8%';
            container.style.right = 'auto';
            container.style.top = 'auto';
            container.style.bottom = '8%';
            container.style.transform = 'none';
          } else if (pos === 'bottom-right') {
            container.style.left = 'auto';
            container.style.right = '8%';
            container.style.top = 'auto';
            container.style.bottom = '8%';
            container.style.transform = 'none';
          } else {
            container.style.left = '50%';
            container.style.right = 'auto';
            container.style.top = 'auto';
            container.style.bottom = '8%';
            container.style.transform = 'translateX(-50%)';
          }
          container.classList.add(`pos-${pos}`);
        }
      }

      if (textEl) {
        textEl.style.textAlign = placement.hAlign;
      }

      // Cue-specific font and color
      if (textEl) {
        textEl.style.fontFamily = cue.fontFamily || cfg.fontFamily || "'Noto Naskh Arabic', 'Vazirmatn', sans-serif";
        textEl.style.color = cue.color || cfg.color || '#ffffff';
        if (cue.fontSize) {
          textEl.style.fontSize = `clamp(0.85rem, ${(cue.fontSize / 18) * 3.2}cqi, 4.5rem)`;
        } else {
          const baseRem = parseFloat(cfg.fontSize) || 1.25;
          textEl.style.fontSize = `clamp(0.85rem, ${baseRem * 3.2}cqi, 4.5rem)`;
        }
      }

      if (container) {
        container.classList.remove('hidden');
      }
    }

    clearOverlay() {
      this._lastRenderedCueHash = null;
      if (this.els && this.els.videoOverlayContainer) {
        this.els.videoOverlayContainer.classList.add('hidden');
      }
      if (this.els && this.els.videoOverlayText) {
        this.els.videoOverlayText.textContent = '';
      }
    }

    applyStyling(config) {
      if (!this.els) return;
      const container = this.els.videoOverlayContainer;
      const textEl = this.els.videoOverlayText;
      const origEl = this.els.videoOverlayOrig;
      if (!container || !textEl) return;

      if (!this._isDragging) {
        if (config.customPos && typeof config.customPos.xPct === 'number' && typeof config.customPos.yPct === 'number') {
          container.style.left = `${config.customPos.xPct}%`;
          container.style.top = `${config.customPos.yPct}%`;
          container.style.bottom = 'auto';
          container.style.transform = 'translate(-50%, -50%)';
          container.classList.remove('pos-bottom', 'pos-center', 'pos-top');
        } else {
          const pos = config.position || 'bottom';
          container.classList.remove('pos-bottom', 'pos-center', 'pos-top', 'pos-bottom-left', 'pos-bottom-right', 'pos-top-left', 'pos-top-right', 'pos-mid-left', 'pos-mid-right');
          if (pos === 'center') {
            container.style.left = '50%';
            container.style.right = 'auto';
            container.style.top = '50%';
            container.style.bottom = 'auto';
            container.style.transform = 'translate(-50%, -50%)';
          } else if (pos === 'mid-left') {
            container.style.left = '8%';
            container.style.right = 'auto';
            container.style.top = '50%';
            container.style.bottom = 'auto';
            container.style.transform = 'translateY(-50%)';
          } else if (pos === 'mid-right') {
            container.style.left = 'auto';
            container.style.right = '8%';
            container.style.top = '50%';
            container.style.bottom = 'auto';
            container.style.transform = 'translateY(-50%)';
          } else if (pos === 'top') {
            container.style.left = '50%';
            container.style.right = 'auto';
            container.style.top = '8%';
            container.style.bottom = 'auto';
            container.style.transform = 'translateX(-50%)';
          } else if (pos === 'top-left') {
            container.style.left = '8%';
            container.style.right = 'auto';
            container.style.top = '8%';
            container.style.bottom = 'auto';
            container.style.transform = 'none';
          } else if (pos === 'top-right') {
            container.style.left = 'auto';
            container.style.right = '8%';
            container.style.top = '8%';
            container.style.bottom = 'auto';
            container.style.transform = 'none';
          } else if (pos === 'bottom-left') {
            container.style.left = '8%';
            container.style.right = 'auto';
            container.style.top = 'auto';
            container.style.bottom = '8%';
            container.style.transform = 'none';
          } else if (pos === 'bottom-right') {
            container.style.left = 'auto';
            container.style.right = '8%';
            container.style.top = 'auto';
            container.style.bottom = '8%';
            container.style.transform = 'none';
          } else {
            container.style.left = '50%';
            container.style.right = 'auto';
            container.style.top = 'auto';
            container.style.bottom = '8%';
            container.style.transform = 'translateX(-50%)';
          }
          container.classList.add(`pos-${pos}`);
        }
      }

      const effect = config.effect || 'shadow';
      container.classList.remove('effect-shadow', 'effect-outline', 'effect-glow', 'effect-cinema', 'effect-box', 'effect-none');
      container.classList.add(`effect-${effect}`);
      if (effect === 'outline') {
        textEl.style.textShadow = '-1.5px -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 1.5px 0 #000, 1.5px 1.5px 0 #000, 0 2px 4px rgba(0,0,0,0.9)';
        textEl.style.webkitTextStroke = '1.5px #000000';
      } else if (effect === 'glow') {
        textEl.style.textShadow = '0 0 10px rgba(250, 204, 21, 0.85), 0 0 22px rgba(250, 204, 21, 0.5), 0 2px 4px rgba(0,0,0,0.9)';
        textEl.style.webkitTextStroke = '0px transparent';
      } else if (effect === 'cinema') {
        textEl.style.textShadow = '0 3px 6px rgba(0, 0, 0, 0.95), 0 0 12px rgba(0, 0, 0, 0.9), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000';
        textEl.style.webkitTextStroke = '1px #000000';
      } else if (effect === 'box') {
        textEl.style.textShadow = '0 1px 3px rgba(0, 0, 0, 0.8)';
        textEl.style.webkitTextStroke = '0px transparent';
        if (!config.bgColor || config.bgColor === 'transparent') {
          container.style.backgroundColor = 'rgba(0, 0, 0, 0.78)';
        }
      } else if (effect === 'none') {
        textEl.style.textShadow = 'none';
        textEl.style.webkitTextStroke = '0px transparent';
      } else {
        textEl.style.textShadow = '0 2px 4px rgba(0, 0, 0, 0.95), 0 0 8px rgba(0, 0, 0, 0.9)';
        textEl.style.webkitTextStroke = '0px transparent';
      }

      const baseRem = parseFloat(config.fontSize) || 1.25;
      textEl.style.fontSize = `clamp(0.85rem, ${baseRem * 3.2}cqi, 4.5rem)`;
      if (config.fontFamily) {
        textEl.style.fontFamily = config.fontFamily;
      }
      textEl.style.color = config.color || '#ffffff';
      container.style.backgroundColor = config.bgColor || 'transparent';

      if (origEl) {
        origEl.style.fontSize = `clamp(0.65rem, ${baseRem * 2.3}cqi, 3rem)`;
      }
    }

    updateTextShower(cue, idx, nearestCue = null) {
      if (!this.els || !this.els.textShowerCard) return;

      const showerHash = cue
        ? `cue_${idx}_${cue.text}_${cue.origText || ''}_${cue.start}_${cue.end}`
        : (nearestCue ? `next_${nearestCue.index}_${nearestCue.cue.text}` : 'none');

      if (this._lastShowerHash === showerHash) return;
      this._lastShowerHash = showerHash;

      if (cue) {
        const text = stripTags(cue.text || '');
        if (this.els.textShowerNum) this.els.textShowerNum.textContent = `#${idx + 1}`;
        if (this.els.textShowerText) {
          const cfg = (window.VideoEditorState && window.VideoEditorState.overlayConfig) || {};
          const hasOrig = Boolean(cfg.showOrig && cue.origText && cue.origText.trim() && cue.origText.trim() !== text.trim());
          if (hasOrig) {
            const safeText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const safeOrig = stripTags(cue.origText).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const kDir = isRtlText(text) ? 'rtl' : 'ltr';
            const oDir = isRtlText(cue.origText) ? 'rtl' : 'ltr';
            this.els.textShowerText.innerHTML = `<div class="vn-shower-kurdish" dir="${kDir}">${safeText}</div><div class="vn-shower-orig" dir="${oDir}"><span class="vn-shower-orig-tag">EN</span> <span>${safeOrig}</span></div>`;
            this.els.textShowerText.setAttribute('dir', kDir);
          } else {
            this.els.textShowerText.textContent = text;
            this.els.textShowerText.setAttribute('dir', isRtlText(text) ? 'rtl' : 'ltr');
          }
        }

        // Reading Pace
        const charCount = text.replace(/\s+/g, '').length;
        const dur = Math.max(0.3, (cue.end - cue.start) / 1000);
        const cps = (charCount / dur).toFixed(1);

        if (this.els.textShowerPace) {
          this.els.textShowerPace.textContent = `${cps} CPS`;
          this.els.textShowerPace.classList.remove('hidden');
        }
      } else {
        if (nearestCue) {
          if (this.els.textShowerNum) this.els.textShowerNum.textContent = `Next #${nearestCue.index + 1}`;
          if (this.els.textShowerText) {
            const nextTxt = stripTags(nearestCue.cue.text);
            this.els.textShowerText.textContent = nextTxt;
            this.els.textShowerText.setAttribute('dir', hasArabic(nextTxt) ? 'rtl' : 'ltr');
          }
        } else {
          if (this.els.textShowerNum) this.els.textShowerNum.textContent = 'No Subtitle';
          if (this.els.textShowerText) {
            this.els.textShowerText.textContent = 'Scrub timeline or click "Apply Subtitles" to load translated cues';
            this.els.textShowerText.removeAttribute('dir');
          }
        }
        if (this.els.textShowerPace) this.els.textShowerPace.classList.add('hidden');
      }
    }
  }

  window.VideoEditorOverlay = new VideoEditorOverlayRenderer();
})();
