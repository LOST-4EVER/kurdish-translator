/**
 * player.js — A lightweight subtitle player.
 * Plays cues on a landscape black screen synced to an internal clock,
 * like a video player but for subtitles. No video needed.
 */
const SubtitlePlayer = (() => {
  const _ = (sel) => document.querySelector(sel);
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const hasArabic = (s) => /[\u0600-\u06FF\u0750-\u077F]/.test(s);

  let cues = [];
  let total = 0;        // ms duration
  let pos = 0;          // current ms
  let playing = false;
  let speed = 1;
  let raf = null;
  let startPerf = 0;    // performance.now() at play start
  let basePos = 0;      // position when play started
  let activeCue = null; // cached cue to avoid redundant DOM writes
  let onCue = null;     // optional callback when the active cue changes
  let lastSec = -1;     // last whole second written to the time readout
  let cursor = -1;      // cached cue index from the last cueAt() lookup
  let fontScale = 1;    // font scale multiplier

  const el = {};

  function init() {
    el.screen = _('#playerScreen');
    el.text = _('#playerText');
    el.empty = _('#playerEmpty');
    el.cueCount = _('#cueCount');
    el.tl = _('#timeline');
    el.tlCues = _('#tlCues');
    el.tlFill = _('#tlFill');
    el.tlThumb = _('#tlThumb');
    el.play = _('#playBtn');
    el.restart = _('#restartBtn');
    el.prevCue = _('#prevCueBtn');
    el.nextCue = _('#nextCueBtn');
    el.skipBack = _('#skipBackBtn');
    el.skipForward = _('#skipForwardBtn');
    el.time = _('#timeDisplay');
    el.speed = _('#speedSel');
    el.tlTooltip = _('#tlTooltip');

    el.play.addEventListener('click', toggle);
    el.restart.addEventListener('click', () => seek(0));
    if (el.prevCue) el.prevCue.addEventListener('click', () => stepCue(-1));
    if (el.nextCue) el.nextCue.addEventListener('click', () => stepCue(1));
    if (el.skipBack) el.skipBack.addEventListener('click', () => jump(-5000));
    if (el.skipForward) el.skipForward.addEventListener('click', () => jump(5000));
    el.speed.addEventListener('change', (e) => { speed = Number(e.target.value); });

    const handleScrub = (e) => {
      const rect = el.tl.getBoundingClientRect();
      seek(clamp((e.clientX - rect.left) / rect.width, 0, 1) * total);
    };

    // Timeline hover timecode tooltip
    if (el.tlTooltip) {
      el.tl.addEventListener('pointermove', (e) => {
        if (!total) { el.tlTooltip.classList.add('hidden'); return; }
        const rect = el.tl.getBoundingClientRect();
        const ratio = clamp((e.clientX - rect.left) / rect.width, 0, 1);
        const hoverMs = ratio * total;
        el.tlTooltip.textContent = fmt(hoverMs);
        el.tlTooltip.style.left = `${ratio * 100}%`;
        el.tlTooltip.classList.remove('hidden');
      });
      el.tl.addEventListener('pointerleave', () => {
        el.tlTooltip.classList.add('hidden');
      });
    }

    el.tl.addEventListener('pointerdown', (e) => {
      el.tl.setPointerCapture(e.pointerId);
      if (playing) pause();
      handleScrub(e);

      const onPointerMove = (moveEvent) => {
        handleScrub(moveEvent);
      };

      const onPointerUp = (upEvent) => {
        el.tl.releasePointerCapture(upEvent.pointerId);
        el.tl.removeEventListener('pointermove', onPointerMove);
        el.tl.removeEventListener('pointerup', onPointerUp);
        el.tl.removeEventListener('pointercancel', onPointerUp);
      };

      el.tl.addEventListener('pointermove', onPointerMove);
      el.tl.addEventListener('pointerup', onPointerUp);
      el.tl.addEventListener('pointercancel', onPointerUp);
    });

    document.addEventListener('keydown', (e) => {
      const t = e.target;
      if (t && t.closest && t.closest('select, input, button, textarea, a')) return;
      switch (e.code) {
        case 'Space': e.preventDefault(); toggle(); break;
        case 'ArrowRight': e.preventDefault(); seek(pos + 5000); break;
        case 'ArrowLeft': e.preventDefault(); seek(pos - 5000); break;
        case 'ArrowUp': e.preventDefault(); seek(skipCue(-1)); break;
        case 'ArrowDown': e.preventDefault(); seek(skipCue(1)); break;
      }
    });

    // rAF stops in a hidden tab but performance.now() keeps running, so wall
    // clock playback would fast-forward through the whole file. Pause instead.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && playing) pause();
    });

    // Auto-fit preview text on container resize (orientation change, tab switch, window resize)
    if (typeof ResizeObserver !== 'undefined' && el.screen) {
      const ro = new ResizeObserver(() => {
        fitText();
      });
      ro.observe(el.screen);
    }
  }

  /** Start time of the previous/next cue relative to the current position. */
  function skipCue(dir) {
    if (!cues.length) return 0;
    const idx = cues.findIndex((c) => pos >= c.start && pos < c.end);
    const next = idx === -1
      ? (dir > 0 ? 0 : cues.length - 1)
      : clamp(idx + dir, 0, cues.length - 1);
    return cues[next].start;
  }

  function load(newCues) {
    stop();
    cues = newCues || [];
    cursor = -1;
    lastSec = -1; // a new file must rewrite the time readout even at 0:00
    total = cues.reduce((max, c) => Math.max(max, c.end), 0);
    buildTimeline();
    pos = 0;
    activeCue = undefined;
    refresh(true);
  }

  function buildTimeline() {
    el.tlCues.innerHTML = '';
    if (!total) return;
    const frag = document.createDocumentFragment();
    for (const c of cues) {
      const seg = document.createElement('div');
      seg.className = 'tl-seg';
      seg.style.left = `${(c.start / total) * 100}%`;
      seg.style.width = `${Math.max(0.5, ((c.end - c.start) / total) * 100)}%`;
      frag.appendChild(seg);
    }
    el.tlCues.appendChild(frag);
  }

  const PLAY_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  const PAUSE_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';

  function play() {
    if (!cues.length || pos >= total) seek(0);
    if (playing) return;
    playing = true;
    startPerf = performance.now();
    basePos = pos;
    el.play.innerHTML = PAUSE_SVG;
    el.play.setAttribute('aria-label', 'Pause');
    el.screen.classList.add('live');
    raf = requestAnimationFrame(tick);
  }

  function pause() {
    playing = false;
    el.play.innerHTML = PLAY_SVG;
    el.play.setAttribute('aria-label', 'Play');
    el.screen.classList.remove('live');
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }

  function stop() {
    pause();
    pos = 0;
  }

  function toggle() { playing ? pause() : play(); }

  function tick(now) {
    if (!playing) return;
    pos = basePos + (now - startPerf) * speed;
    if (pos >= total) { pos = total; pause(); return; }
    refresh();
    raf = requestAnimationFrame(tick);
  }

  function seek(ms) {
    pos = clamp(ms, 0, total);
    if (playing) { startPerf = performance.now(); basePos = pos; }
    refresh(true);
  }

  /** Find the cue active at pos. Cues are sorted by start, so a cached cursor
   *  plus binary search keeps this O(log n) worst-case and O(1) during playback. */
  function cueAt(pos) {
    const cur = cursor >= 0 ? cues[cursor] : null;
    if (cur && pos >= cur.start && pos < cur.end) return cursor; // still in the same cue
    let lo = 0, hi = cues.length - 1, best = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (cues[mid].start <= pos) { best = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    // With several cues sharing one start time, show the earliest of them.
    while (best > 0 && cues[best - 1].start === cues[best].start) best--;
    cursor = best >= 0 && pos < cues[best].end ? best : -1;
    return cursor;
  }

  function refresh(force = false) {
    const idx = cueAt(pos);
    const cue = idx >= 0 ? cues[idx] : null;
    const changed = cue !== activeCue;

    // Only touch the text DOM when the active cue actually changes.
    if (force || changed) {
      activeCue = cue;
      el.text.textContent = cue ? cue.text : '';
      el.text.style.display = cue ? 'block' : 'none';
      el.text.setAttribute('dir', cue && hasArabic(cue.text) ? 'rtl' : 'ltr');
      if (changed && cue) {
        el.text.classList.remove('caption-updated');
        void el.text.offsetWidth;
        el.text.classList.add('caption-updated');
      }
      if (cue) {
        fitText();
      }
      el.empty.style.display = cues.length ? 'none' : 'block';
      if (el.cueCount) {
        el.cueCount.textContent = cues.length ? `${cue ? cue.index : 0} / ${cues.length}` : '';
        el.cueCount.style.display = cues.length ? 'block' : 'none';
      }
    }

    // Time text only changes once a second; the timeline needs each frame.
    const sec = Math.floor(pos / 1000);
    if (sec !== lastSec) {
      lastSec = sec;
      el.time.textContent = `${fmt(pos)} / ${fmt(total)}`;
    }
    const pct = total ? (pos / total) * 100 : 0;
    el.tlFill.style.width = `${pct}%`;
    el.tlThumb.style.left = `${pct}%`;

    if (changed && onCue) onCue(cue, idx);
  }

  /** Replace the text of cue at an array index (used by the live editor). */
  function updateText(index, text) {
    if (!cues[index]) return;
    cues[index].text = text;
    if (activeCue === cues[index]) {
      refresh(true);
      fitText();
    }
  }

  /** Seek relative to current position (e.g. +5000ms or -5000ms). */
  function jump(deltaMs) {
    seek(pos + deltaMs);
  }

  /** Seek to the previous (-1) or next (+1) cue from the current position. */
  function stepCue(dir) {
    if (!cues.length) return;
    seek(skipCue(dir));
  }

  /** Register a callback fired with (cue, index) whenever playback moves to a cue. */
  function setCueCallback(fn) { onCue = fn; }

  function fmt(ms) {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  /** Dynamically scale subtitle preview text so it fits the player screen without clipping. */
  function fitText() {
    if (!el.text || !el.screen) return;
    const text = el.text.textContent;
    if (!text || !text.trim()) {
      el.text.style.fontSize = '';
      return;
    }
    const screenW = el.screen.clientWidth;
    const screenH = el.screen.clientHeight;
    if (!screenW || !screenH) return;

    // Base font size is proportional to player screen dimensions, bounded cleanly
    const base = Math.round(Math.min(
      Math.max(14, screenW * 0.052),
      Math.max(14, screenH * 0.16),
      36
    ));
    let size = Math.round(base * fontScale);
    const maxW = screenW * 0.90;
    const maxH = screenH * 0.88;

    el.text.style.fontSize = `${size}px`;
    // If long multiline text overflows container bounds, iteratively scale down
    while (size > 11 && (el.text.scrollWidth > maxW || el.text.scrollHeight > maxH)) {
      size -= 1;
      el.text.style.fontSize = `${size}px`;
    }
  }

  /** Set font scale multiplier for subtitle preview text. */
  function setFontScale(scale) {
    fontScale = Number(scale) || 1;
    fitText();
  }

  return {
    init,
    load,
    toggle,
    play,
    pause,
    seek,
    jump,
    stepCue,
    updateText,
    fitText,
    setFontScale,
    setCueCallback,
    get playing() { return playing; },
    get position() { return pos; },
    get duration() { return total; }
  };
})();
