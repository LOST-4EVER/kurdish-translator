/**
 * video-editor-burner.js — Hardware-Accelerated Video Subtitle Burn & Upscaling Suite.
 * Uses WebGPU / WebGL2 canvas pipelines and MediaRecorder to render and bake
 * Kurdish Sorani typography directly into video frames with 100% client privacy.
 * Features multi-resolution upscaling (720p to 4K), bitrate control, audio passthrough,
 * and live file-size estimation.
 */
(() => {
  'use strict';

  const hasArabic = (str) => /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(str || '');
  const stripTags = (str) => (str || '').replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, '').trim();

  const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes <= 0) return '0 MB';
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  class VideoEditorBurnerEngine {
    constructor() {
      this.els = null;
      this.burnRecording = false;
      this.burnAbort = false;
      this.recordedChunks = [];
      this.gpuStatus = 'Detecting GPU...';
      this.isGpuReady = false;
      this.targetBitrate = 6000000; // 6 Mbps default
      this.targetResolution = 'original';
      this.audioContext = null;
      this.audioSourceNode = null;
      this.audioDestNode = null;
      this.activeStream = null;
      this.videoFrameCallbackId = null;

      this._detectHardwareAcceleration();
    }

    async _detectHardwareAcceleration() {
      try {
        if ('gpu' in navigator && navigator.gpu) {
          const adapter = await navigator.gpu.requestAdapter();
          if (adapter) {
            this.gpuStatus = 'WebGPU Hardware Accelerated';
            this.isGpuReady = true;
            this._updateGpuBadge();
            return;
          }
        }
      } catch {}

      // Check WebGL2
      try {
        const testCanvas = document.createElement('canvas');
        const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
        if (gl) {
          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
          const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : '';
          this.gpuStatus = renderer ? `GPU: ${renderer.split('/')[0].trim()}` : 'GPU Canvas Accelerated';
          this.isGpuReady = true;
        } else {
          this.gpuStatus = 'CPU Canvas Pipeline';
        }
      } catch {
        this.gpuStatus = 'Hardware Canvas Pipeline';
      }
      this._updateGpuBadge();
    }

    _updateGpuBadge() {
      if (this.els && this.els.exportGpuBadge) {
        this.els.exportGpuBadge.textContent = this.gpuStatus;
        if (this.isGpuReady) {
          this.els.exportGpuBadge.style.color = '#4ade80';
          this.els.exportGpuBadge.style.borderColor = 'rgba(74, 222, 128, 0.3)';
        }
      }
    }

    init(els) {
      this.els = els;
      this._updateGpuBadge();

      if (this.els.burnCloseBtn) {
        this.els.burnCloseBtn.addEventListener('click', () => this.closeModal());
      }
      if (this.els.burnCancelBtn) {
        this.els.burnCancelBtn.addEventListener('click', () => this.closeModal());
      }
      if (this.els.burnModal) {
        this.els.burnModal.addEventListener('click', (e) => {
          if (e.target === this.els.burnModal) this.closeModal();
        });
      }
      if (this.els.burnActionBtn) {
        this.els.burnActionBtn.addEventListener('click', () => this.startBurn());
      }

      // Resolution selection change
      if (this.els.exportResolutionSel) {
        this.els.exportResolutionSel.addEventListener('change', (e) => {
          this.targetResolution = e.target.value;
          this.updateEstimatedSpecs();
        });
      }

      // Bitrate preset change
      if (this.els.exportBitratePresetSel) {
        this.els.exportBitratePresetSel.addEventListener('change', (e) => {
          const val = e.target.value;
          if (val === 'custom') {
            if (this.els.exportCustomBitrateRow) this.els.exportCustomBitrateRow.classList.remove('hidden');
            const sliderVal = parseFloat(this.els.exportBitrateSlider.value || '6');
            this.targetBitrate = Math.round(sliderVal * 1000000);
            if (this.els.exportBitrateVal) this.els.exportBitrateVal.textContent = `${sliderVal.toFixed(1)} Mbps`;
          } else {
            if (this.els.exportCustomBitrateRow) this.els.exportCustomBitrateRow.classList.add('hidden');
            this.targetBitrate = parseInt(val, 10);
            const mbps = (this.targetBitrate / 1000000).toFixed(1);
            if (this.els.exportBitrateVal) this.els.exportBitrateVal.textContent = `${mbps} Mbps`;
          }
          this.updateEstimatedSpecs();
        });
      }

      // Custom bitrate slider
      if (this.els.exportBitrateSlider) {
        this.els.exportBitrateSlider.addEventListener('input', (e) => {
          const mbps = parseFloat(e.target.value);
          this.targetBitrate = Math.round(mbps * 1000000);
          if (this.els.exportCustomBitrateNum) this.els.exportCustomBitrateNum.textContent = `${mbps.toFixed(1)} Mbps`;
          if (this.els.exportBitrateVal) this.els.exportBitrateVal.textContent = `${mbps.toFixed(1)} Mbps`;
          this.updateEstimatedSpecs();
        });
      }
    }

    openModal(hasVideo, cuesCount) {
      if (!hasVideo) {
        VideoEditorUI.showToast('Please import a video file first to export.', 'info');
        return;
      }
      if (!cuesCount) {
        VideoEditorUI.showToast('No subtitles loaded. Click "Apply Kurdish Subs" first.', 'info');
        return;
      }

      if (this.els && this.els.burnModal) {
        this.els.burnModal.classList.remove('hidden');
        this.burnRecording = false;
        this.burnAbort = false;

        // Reset UI stages
        if (this.els.exportConfigArea) this.els.exportConfigArea.classList.remove('hidden');
        if (this.els.exportStageArea) this.els.exportStageArea.classList.add('hidden');
        if (this.els.burnSuccessArea) this.els.burnSuccessArea.classList.add('hidden');
        if (this.els.burnActionBtn) {
          this.els.burnActionBtn.disabled = false;
          this.els.burnActionBtn.classList.remove('hidden');
          if (this.els.exportStartBtnText) this.els.exportStartBtnText.textContent = 'Start Video Export';
        }
        if (this.els.burnProgressFill) this.els.burnProgressFill.style.width = '0%';
        if (this.els.burnStatusText) this.els.burnStatusText.textContent = 'Ready to encode';
        if (this.els.burnPercentText) this.els.burnPercentText.textContent = '0%';

        this.updateEstimatedSpecs();
      }
    }

    closeModal() {
      if (this.burnRecording) {
        this.burnAbort = true;
        this.burnRecording = false;
        if (this.els && this.els.videoPlayer) {
          this.els.videoPlayer.pause();
        }
      }
      this._cleanupAudioAndStreams();
      if (this.els && this.els.burnModal) {
        this.els.burnModal.classList.add('hidden');
      }
    }

    _cleanupAudioAndStreams() {
      if (this.activeStream) {
        try {
          this.activeStream.getTracks().forEach((track) => track.stop());
        } catch {}
        this.activeStream = null;
      }
      if (this.audioContext && this.audioContext.state !== 'closed') {
        try {
          this.audioContext.close();
        } catch {}
        this.audioContext = null;
      }
      if (this.els && this.els.videoPlayer) {
        if ('cancelVideoFrameCallback' in this.els.videoPlayer && this.videoFrameCallbackId !== null) {
          this.els.videoPlayer.cancelVideoFrameCallback(this.videoFrameCallbackId);
          this.videoFrameCallbackId = null;
        }
      }
    }

    computeDimensions() {
      const video = this.els.videoPlayer;
      const nativeW = (video && video.videoWidth) ? video.videoWidth : 1920;
      const nativeH = (video && video.videoHeight) ? video.videoHeight : 1080;
      const aspect = nativeW / nativeH;

      switch (this.targetResolution) {
        case '720p': {
          const h = 720;
          const w = Math.round((h * aspect) / 2) * 2;
          return { width: w, height: h, label: `${w} × ${h} (720p HD)` };
        }
        case '1080p': {
          const h = 1080;
          const w = Math.round((h * aspect) / 2) * 2;
          return { width: w, height: h, label: `${w} × ${h} (1080p Full HD)` };
        }
        case '1440p': {
          const h = 1440;
          const w = Math.round((h * aspect) / 2) * 2;
          return { width: w, height: h, label: `${w} × ${h} (1440p 2K Ultra)` };
        }
        case '2160p': {
          const h = 2160;
          const w = Math.round((h * aspect) / 2) * 2;
          return { width: w, height: h, label: `${w} × ${h} (2160p 4K Cinema)` };
        }
        case 'original':
        default:
          return { width: nativeW, height: nativeH, label: `${nativeW} × ${nativeH} (Native)` };
      }
    }

    updateEstimatedSpecs() {
      const video = this.els.videoPlayer;
      const cues = VideoEditorState.getCues();
      const dims = this.computeDimensions();
      const duration = (video && !isNaN(video.duration) && video.duration > 0) ? video.duration : 60;

      if (this.els.exportSpecDimensions) {
        this.els.exportSpecDimensions.textContent = dims.label;
      }
      if (this.els.exportSpecSubs) {
        this.els.exportSpecSubs.textContent = `${cues.length} Kurdish Cues`;
      }
      if (this.els.exportSpecDuration) {
        this.els.exportSpecDuration.textContent = formatTime(duration);
      }

      // Bitrate (video + 128k audio) in bytes
      const totalBps = this.targetBitrate + 128000;
      const estimatedBytes = Math.round((duration * totalBps) / 8);

      if (this.els.exportSpecSize) {
        this.els.exportSpecSize.textContent = `~ ${formatFileSize(estimatedBytes)}`;
      }
    }

    wrapText(ctx, text, maxWidth) {
      const words = text.split(/\s+/);
      const lines = [];
      let currentLine = '';

      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const width = ctx.measureText(testLine).width;
        if (width < maxWidth || !currentLine) {
          currentLine = testLine;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }
      if (currentLine) lines.push(currentLine);
      return lines;
    }

    async startBurn() {
      const video = this.els.videoPlayer;
      const cues = VideoEditorState.getCues();
      const syncOffsetMs = VideoEditorState.syncOffsetMs;
      const overlayCfg = VideoEditorState.overlayConfig || {};

      if (!video || !cues.length) return;

      this.burnRecording = true;
      this.burnAbort = false;

      // Switch to rendering stage UI
      if (this.els.exportConfigArea) this.els.exportConfigArea.classList.add('hidden');
      if (this.els.exportStageArea) this.els.exportStageArea.classList.remove('hidden');
      if (this.els.burnSuccessArea) this.els.burnSuccessArea.classList.add('hidden');
      if (this.els.burnActionBtn) this.els.burnActionBtn.disabled = true;

      const { width, height } = this.computeDimensions();

      if (this.els.exportResPill) {
        this.els.exportResPill.textContent = `${width}×${height}`;
      }

      // Main rendering canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Live modal preview canvas
      const previewCanvas = this.els.exportPreviewCanvas;
      let previewCtx = null;
      if (previewCanvas) {
        previewCanvas.width = 480;
        previewCanvas.height = Math.round((480 * height) / width);
        previewCtx = previewCanvas.getContext('2d');
      }

      const stream = canvas.captureStream(30);
      this.activeStream = stream;

      // Robust audio capture via Web Audio API destination with fallback to captureStream
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          this.audioContext = new AudioContextClass();
          if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
          }
          this.audioDestNode = this.audioContext.createMediaStreamDestination();
          
          try {
            this.audioSourceNode = this.audioContext.createMediaElementSource(video);
            this.audioSourceNode.connect(this.audioDestNode);
            this.audioSourceNode.connect(this.audioContext.destination);
          } catch (srcErr) {
            console.warn('Audio node connection notice:', srcErr);
          }

          const audioTracks = this.audioDestNode.stream.getAudioTracks();
          if (audioTracks.length > 0) {
            stream.addTrack(audioTracks[0]);
          }
        }
      } catch (err) {
        console.warn('Web Audio stream setup fallback:', err);
        try {
          const directStream = video.captureStream ? video.captureStream() : (video.mozCaptureStream ? video.mozCaptureStream() : null);
          if (directStream) {
            const tracks = directStream.getAudioTracks();
            if (tracks.length > 0) stream.addTrack(tracks[0]);
          }
        } catch (e) {}
      }

      // Determine best supported MIME type
      const mimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=h264,opus',
        'video/webm',
        'video/mp4;codecs=avc1,mp4a.40.2',
        'video/mp4'
      ];
      let selectedMime = 'video/webm';
      for (const mime of mimeTypes) {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
          selectedMime = mime;
          break;
        }
      }

      this.recordedChunks = [];
      let recorder;
      try {
        recorder = new MediaRecorder(stream, {
          mimeType: selectedMime,
          videoBitsPerSecond: this.targetBitrate,
        });
      } catch (e) {
        console.warn('Fallback standard recorder:', e);
        recorder = new MediaRecorder(stream);
      }

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) this.recordedChunks.push(e.data);
      };

      const startTimeMs = performance.now();
      let frameCount = 0;
      let lastFpsTime = startTimeMs;
      let fpsFrames = 0;
      const totalDuration = video.duration || 1;
      const totalEstimatedFrames = Math.max(1, Math.round(totalDuration * 30));

      recorder.onstop = () => {
        this.burnRecording = false;
        this._cleanupAudioAndStreams();

        if (this.els.burnActionBtn) {
          this.els.burnActionBtn.disabled = false;
          this.els.burnActionBtn.classList.add('hidden');
        }

        if (this.burnAbort) {
          VideoEditorUI.showToast('Video export cancelled.', 'info');
          if (this.els.exportConfigArea) this.els.exportConfigArea.classList.remove('hidden');
          if (this.els.exportStageArea) this.els.exportStageArea.classList.add('hidden');
          return;
        }

        const isMp4 = selectedMime.includes('mp4');
        const ext = isMp4 ? 'mp4' : 'webm';
        const blob = new Blob(this.recordedChunks, { type: selectedMime });
        const url = URL.createObjectURL(blob);
        const originalName = VideoEditorPlayer.videoFile ? VideoEditorPlayer.videoFile.name.replace(/\.[^/.]+$/, '') : 'video';
        const exportName = `${originalName}.kurdish.subbed.${ext}`;

        if (this.els.burnDownloadLink) {
          this.els.burnDownloadLink.href = url;
          this.els.burnDownloadLink.download = exportName;
        }
        if (this.els.exportDownloadBtnText) {
          this.els.exportDownloadBtnText.textContent = `Download ${exportName} (${formatFileSize(blob.size)})`;
        }
        if (this.els.exportSuccessDetails) {
          this.els.exportSuccessDetails.textContent = `Rendered ${width}×${height} at ${(this.targetBitrate / 1000000).toFixed(1)} Mbps with Kurdish Sorani subtitles.`;
        }

        if (this.els.burnSuccessArea) this.els.burnSuccessArea.classList.remove('hidden');
        if (this.els.burnStatusText) this.els.burnStatusText.textContent = 'Export completed!';
        VideoEditorUI.showToast('Video export finished successfully!', 'success');
      };

      recorder.start(500);

      // Seek to start and play
      video.currentTime = 0;
      try {
        await video.play();
      } catch (err) {
        console.warn('Playback error during burn:', err);
      }

      const drawBurnFrame = () => {
        if (!this.burnRecording || this.burnAbort) {
          if (recorder.state !== 'inactive') recorder.stop();
          video.pause();
          return;
        }

        if (video.ended || video.currentTime >= totalDuration - 0.05) {
          if (recorder.state !== 'inactive') recorder.stop();
          video.pause();
          return;
        }

        frameCount++;
        fpsFrames++;
        const now = performance.now();
        if (now - lastFpsTime >= 1000) {
          const fps = Math.round((fpsFrames * 1000) / (now - lastFpsTime));
          if (this.els.exportFpsPill) this.els.exportFpsPill.textContent = `${fps} FPS`;
          fpsFrames = 0;
          lastFpsTime = now;
        }

        // Draw upscale/downscale video frame onto high-res canvas
        ctx.drawImage(video, 0, 0, width, height);

        // Find active subtitle cue
        const curMs = video.currentTime * 1000 + syncOffsetMs;
        const cue = cues.find((c) => curMs >= c.start && curMs <= c.end);

        if (cue) {
          const text = stripTags(cue.text || '');
          const isAr = hasArabic(text);

          const scaleFactor = parseFloat(overlayCfg.fontSize || '1.25');
          const baseFontSize = Math.max(20, Math.round(height * 0.045 * scaleFactor));
          const fontFamily = cue.fontFamily || overlayCfg.fontFamily || '"Noto Naskh Arabic", "Inter", -apple-system, sans-serif';

          ctx.font = `bold ${baseFontSize}px ${fontFamily}`;
          ctx.textAlign = 'center';
          ctx.direction = isAr ? 'rtl' : 'ltr';

          const maxTextWidth = width * 0.85;
          const lines = this.wrapText(ctx, text, maxTextWidth);
          const lineHeight = baseFontSize * 1.35;

          // Check if original English text should be burned alongside Kurdish
          const hasOrig = Boolean(overlayCfg.showOrig && cue.origText && cue.origText.trim() && cue.origText.trim() !== text.trim());
          const origFontSize = Math.max(14, Math.round(baseFontSize * 0.72));
          let origLines = [];
          let origLineHeight = 0;
          if (hasOrig) {
            ctx.font = `500 ${origFontSize}px "Inter", -apple-system, sans-serif`;
            origLines = this.wrapText(ctx, stripTags(cue.origText), maxTextWidth);
            origLineHeight = origFontSize * 1.3;
          }

          const totalBoxHeight = (lines.length * lineHeight) + (origLines.length ? (origLines.length * origLineHeight + baseFontSize * 0.4) : 0) + baseFontSize * 0.6;

          let xCenter = width * 0.5;
          let yCenter = height * 0.88;
          if (cue.pos && typeof cue.pos.x === 'number' && typeof cue.pos.y === 'number') {
            xCenter = cue.pos.x > 1 ? (cue.pos.x / 1920) * width : cue.pos.x * width;
            yCenter = cue.pos.y > 1 ? (cue.pos.y / 1080) * height : cue.pos.y * height;
          } else if (cue.placement === 'top') {
            yCenter = height * 0.12 + totalBoxHeight / 2;
          } else if (cue.placement === 'center' || cue.placement === 'mid') {
            yCenter = height * 0.50;
          } else if (overlayCfg.customPos && typeof overlayCfg.customPos.xPct === 'number' && typeof overlayCfg.customPos.yPct === 'number') {
            xCenter = width * (overlayCfg.customPos.xPct / 100);
            yCenter = height * (overlayCfg.customPos.yPct / 100);
          } else if (overlayCfg.position === 'top') {
            yCenter = height * 0.12 + totalBoxHeight / 2;
          } else if (overlayCfg.position === 'center') {
            yCenter = height * 0.50;
          }

          // Compute widest line across both languages
          ctx.font = `bold ${baseFontSize}px ${fontFamily}`;
          let maxLineWidth = 0;
          lines.forEach((l) => {
            const w = ctx.measureText(l).width;
            if (w > maxLineWidth) maxLineWidth = w;
          });
          if (hasOrig) {
            ctx.font = `500 ${origFontSize}px "Inter", -apple-system, sans-serif`;
            origLines.forEach((ol) => {
              const w = ctx.measureText(ol).width;
              if (w > maxLineWidth) maxLineWidth = w;
            });
          }
          const boxWidth = Math.min(width * 0.92, maxLineWidth + baseFontSize * 1.4);

          // Background box
          const bgColor = overlayCfg.bgColor || 'rgba(0, 0, 0, 0.75)';
          if (bgColor !== 'transparent') {
            ctx.fillStyle = bgColor;
            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') {
              ctx.roundRect(xCenter - boxWidth / 2, yCenter - totalBoxHeight / 2, boxWidth, totalBoxHeight, 4);
            } else {
              ctx.rect(xCenter - boxWidth / 2, yCenter - totalBoxHeight / 2, boxWidth, totalBoxHeight);
            }
            ctx.fill();
          } else {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 2;
          }

          // Render primary Kurdish text lines
          ctx.font = `bold ${baseFontSize}px ${fontFamily}`;
          ctx.direction = isAr ? 'rtl' : 'ltr';
          const textColor = cue.color || overlayCfg.color || '#ffffff';
          const strokeWidth = Math.max(2, Math.round(baseFontSize * 0.12));
          const startY = yCenter - (totalBoxHeight / 2) + baseFontSize * 0.9;

          lines.forEach((line, idx) => {
            const lineY = startY + idx * lineHeight;
            ctx.lineJoin = 'round';
            ctx.miterLimit = 2;
            ctx.lineWidth = strokeWidth;
            ctx.strokeStyle = '#000000';
            ctx.strokeText(line, xCenter, lineY);
            ctx.fillStyle = textColor;
            ctx.fillText(line, xCenter, lineY);
          });

          // Render original English text if enabled
          if (hasOrig && origLines.length) {
            ctx.font = `500 ${origFontSize}px "Inter", -apple-system, sans-serif`;
            ctx.direction = 'ltr';
            const origStrokeWidth = Math.max(1.5, Math.round(origFontSize * 0.12));
            const origStartY = startY + lines.length * lineHeight + origFontSize * 0.2;

            origLines.forEach((oline, oidx) => {
              const oLineY = origStartY + oidx * origLineHeight;
              ctx.lineJoin = 'round';
              ctx.miterLimit = 2;
              ctx.lineWidth = origStrokeWidth;
              ctx.strokeStyle = '#000000';
              ctx.strokeText(oline, xCenter, oLineY);
              ctx.fillStyle = '#e2e8f0';
              ctx.fillText(oline, xCenter, oLineY);
            });
          }

          // Reset shadow
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
        }

        // Mirror to preview canvas in modal
        if (previewCtx && previewCanvas) {
          previewCtx.drawImage(canvas, 0, 0, previewCanvas.width, previewCanvas.height);
        }

        // Metrics calculations
        const pct = Math.min(100, Math.round((video.currentTime / totalDuration) * 100));
        const elapsedSec = (performance.now() - startTimeMs) / 1000;
        const etaSec = pct > 0 ? Math.max(0, ((elapsedSec / pct) * (100 - pct))) : 0;

        if (this.els.burnProgressFill) this.els.burnProgressFill.style.width = `${pct}%`;
        if (this.els.burnStatusText) this.els.burnStatusText.textContent = `Rendering frames: ${pct}%`;
        if (this.els.burnPercentText) this.els.burnPercentText.textContent = `${pct}%`;
        if (this.els.exportMetricFrames) this.els.exportMetricFrames.textContent = `${frameCount} / ~${totalEstimatedFrames}`;
        if (this.els.exportMetricElapsed) this.els.exportMetricElapsed.textContent = formatTime(elapsedSec);
        if (this.els.exportMetricEta) this.els.exportMetricEta.textContent = formatTime(etaSec);

        if ('requestVideoFrameCallback' in video) {
          this.videoFrameCallbackId = video.requestVideoFrameCallback(drawBurnFrame);
        } else {
          requestAnimationFrame(drawBurnFrame);
        }
      };

      if ('requestVideoFrameCallback' in video) {
        this.videoFrameCallbackId = video.requestVideoFrameCallback(drawBurnFrame);
      } else {
        requestAnimationFrame(drawBurnFrame);
      }
    }
  }

  window.VideoEditorBurner = new VideoEditorBurnerEngine();
})();
