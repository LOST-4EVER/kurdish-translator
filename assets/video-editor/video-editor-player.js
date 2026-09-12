/**
 * video-editor-player.js — HTML5 Video Player Controller & Transport for Video Studio.
 * Manages video loading (MOV, MP4, WebM), playhead seeking, aspect ratios,
 * and high-performance synthetic test streams.
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
      this.currentPlaybackRate = 1.0;
      this._queuedSeekSec = null;
      this._seekHandlerBound = false;
    }

    init(els, options = {}) {
      this.els = els;
      this.onTimeUpdateCallback = options.onTimeUpdate;
      this.onMetadataLoadedCallback = options.onMetadataLoaded;
      this.onVideoLoadedCallback = options.onVideoLoaded;
      this._syncRaf = null;
      this._rvfcId = null;

      this._bindPlayerEvents();
    }

    _bindPlayerEvents() {
      const player = this.els.videoPlayer;
      if (!player) return;

      player.addEventListener('click', () => this.togglePlay());

      const onPlayStart = () => {
        this._updatePlayIcon(true);
        this._startPlaybackSync();
      };
      const onPlayStop = () => {
        this._updatePlayIcon(false);
        this._stopPlaybackSync();
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
      };

      player.addEventListener('loadedmetadata', updateMeta);
      player.addEventListener('durationchange', updateMeta);
      player.addEventListener('canplay', updateMeta);

      player.onerror = () => {
        const err = player.error;
        console.warn('Video element playback error:', err);
        if (this.videoFile) {
          VideoEditorUI.showToast(
            'Unable to decode video stream in this browser.',
            'error',
            'Try MP4 (H.264 / AAC) or WebM.'
          );
        }
      };

      // Standard timeupdate fallback for low-spec devices
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

    _startPlaybackSync() {
      this._stopPlaybackSync();
      const player = this.els.videoPlayer;
      if (!player) return;

      const loop = () => {
        if (!player || player.paused || player.ended) {
          this._syncRaf = null;
          return;
        }
        const curMs = (player.currentTime || 0) * 1000;
        const durMs = (player.duration || 0) * 1000;
        this.updateTimeDisplay(curMs, durMs);
        if (this.onTimeUpdateCallback) {
          this.onTimeUpdateCallback(curMs, durMs);
        }

        this._syncRaf = requestAnimationFrame(loop);
      };

      this._syncRaf = requestAnimationFrame(loop);
    }

    _stopPlaybackSync() {
      if (this._syncRaf) {
        cancelAnimationFrame(this._syncRaf);
        this._syncRaf = null;
      }
      if (this._rvfcId && this.els.videoPlayer && 'cancelVideoFrameCallback' in this.els.videoPlayer) {
        try {
          this.els.videoPlayer.cancelVideoFrameCallback(this._rvfcId);
        } catch {}
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
      const player = this.els.videoPlayer;
      if (player) {
        try { player.pause(); } catch {}
      }

      if (this.videoUrl) {
        URL.revokeObjectURL(this.videoUrl);
      }

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

      VideoEditorUI.showToast(
        `Loaded video: ${file.name} (${ext.toUpperCase()})`,
        'success',
        'Ready for playback & subtitle synchronization.'
      );
      return true;
    }

    togglePlay() {
      const player = this.els.videoPlayer;
      if (!player) return;

      if (player.paused || player.ended) {
        player.play().catch((err) => console.warn('Playback prevented:', err));
      } else {
        player.pause();
      }
    }

    seekTo(timeMs, immediate = false) {
      const player = this.els.videoPlayer;
      const targetSec = Math.max(0, timeMs / 1000);
      const durMs = (player && player.duration) ? player.duration * 1000 : 0;

      // Latency-free instant UI and subtitle update
      this.updateTimeDisplay(timeMs, durMs);
      if (this.onTimeUpdateCallback) {
        this.onTimeUpdateCallback(timeMs, durMs);
      }

      if (!player) return;

      // Direct frame-accurate seeking ensures precise subtitle alignment
      if (immediate || !player.seeking) {
        player.currentTime = targetSec;
      } else {
        // Queue latest seek target if video decoder is busy
        this._queuedSeekSec = targetSec;
        if (!this._seekHandlerBound) {
          this._seekHandlerBound = true;
          player.addEventListener('seeked', () => {
            if (this._queuedSeekSec !== null && this._queuedSeekSec !== undefined) {
              const sec = this._queuedSeekSec;
              this._queuedSeekSec = null;
              player.currentTime = sec;
            }
          }, { passive: true });
        }
      }
    }

    stepSeconds(delta) {
      if (!this.els.videoPlayer) return;
      const targetSec = Math.max(0, this.els.videoPlayer.currentTime + delta);
      this.seekTo(targetSec * 1000);
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
      this.els.viewportWrapper.setAttribute('data-ratio', ratio);
    }

    toggleFullscreen() {
      const stage = this.els.playerStage;
      if (!stage) return;
      if (!document.fullscreenElement) {
        stage.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }

    _updatePlayIcon(isPlaying) {
      if (this.els.playIcon && this.els.pauseIcon) {
        this.els.playIcon.classList.toggle('hidden', isPlaying);
        this.els.pauseIcon.classList.toggle('hidden', !isPlaying);
      }
    }

    updateTimeDisplay(currentMs, totalMs) {
      if (this.els.timeDisplay) {
        const curStr = this.formatTime(currentMs, false);
        const totStr = this.formatTime(totalMs, false);
        this.els.timeDisplay.textContent = `${curStr} / ${totStr}`;
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
     * Generate a lightweight client-side Canvas video for instant testing.
     */
    generateSampleVideo() {
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext('2d');

      const stream = canvas.captureStream(30);
      const durationMs = 12000;
      const startTime = performance.now();

      // Audio Tone
      let audioCtx = null;
      let osc = null;
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const dest = audioCtx.createMediaStreamDestination();
        osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        gain.gain.value = 0.05;
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.connect(gain);
        gain.connect(dest);
        osc.start();
        const audioTrack = dest.stream.getAudioTracks()[0];
        if (audioTrack) stream.addTrack(audioTrack);
      } catch {}

      const chunks = [];
      let mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';

      const rec = new MediaRecorder(stream, { mimeType });
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      rec.onstop = () => {
        if (osc) {
          try { osc.stop(); } catch {}
        }
        if (audioCtx) {
          try { audioCtx.close(); } catch {}
        }
        const blob = new Blob(chunks, { type: 'video/webm' });
        const sampleFile = new File([blob], 'sample_kurdish_preview.webm', { type: 'video/webm' });
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

        // Clean dark obsidian solid background (No gradients)
        ctx.fillStyle = '#0f0e17';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Accent card border
        ctx.strokeStyle = 'rgba(234, 179, 8, 0.4)';
        ctx.lineWidth = 4;
        ctx.strokeRect(40, 40, canvas.width - 80, canvas.height - 80);

        // Ambient rings
        ctx.strokeStyle = 'rgba(234, 179, 8, 0.25)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        const cx = canvas.width / 2 + Math.sin(frame * 0.04) * 60;
        const cy = canvas.height / 2 + Math.cos(frame * 0.04) * 30;
        ctx.arc(cx, cy, 150, 0, Math.PI * 2);
        ctx.stroke();

        // Titles
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 38px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('VN Subtitle Studio Preview', canvas.width / 2, canvas.height / 2 - 25);

        ctx.font = '24px "Noto Naskh Arabic", sans-serif';
        ctx.fillStyle = '#fde047';
        ctx.fillText('تاقیکردنەوەی ڤیدیۆ و هاوتاکردنی ژێرنووسی کوردی', canvas.width / 2, canvas.height / 2 + 25);

        const sec = (elapsed / 1000).toFixed(1);
        ctx.font = '16px monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillText(`TIME: ${sec}s / ${(durationMs / 1000).toFixed(0)}s`, canvas.width / 2, canvas.height / 2 + 75);

        requestAnimationFrame(render);
      };

      requestAnimationFrame(render);
      VideoEditorUI.showToast('Rendering cinematic sample video...', 'info');
    }
  }

  window.VideoEditorPlayer = new VideoEditorPlayerController();
})();
