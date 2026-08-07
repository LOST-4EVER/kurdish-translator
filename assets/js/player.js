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
    el.time = _('#timeDisplay');
    el.speed = _('#speedSel');

    el.play.addEventListener('click', toggle);
    el.restart.addEventListener('click', () => seek(0));
    el.speed.addEventListener('change', (e) => { speed = Number(e.target.value); });

    el.tl.addEventListener('click', (e) => {
      const rect = el.tl.getBoundingClientRect();
      seek(clamp((e.clientX - rect.left) / rect.width, 0, 1) * total);
    });
    el.tl.addEventListener('pointerdown', () => { if (playing) pause(); });

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

  function play() {
    if (!cues.length || pos >= total) seek(0);
    if (playing) return;
    playing = true;
    startPerf = performance.now();
    basePos = pos;
    el.play.textContent = '⏸';
    el.screen.classList.add('live');
    raf = requestAnimationFrame(tick);
  }

  function pause() {
    playing = false;
    el.play.textContent = '▶';
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
    if (pos >= total) { pos = total; pause(); }
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
  let cursor = -1;
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
    el.tlThumb.style.left = `calc(${pct}% - 6px)`;

    if (changed && onCue) onCue(cue, idx);
  }

  /** Replace the text of cue at an array index (used by the live editor). */
  function updateText(index, text) {
    if (!cues[index]) return;
    cues[index].text = text;
    if (activeCue === cues[index]) refresh(true);
  }

  /** Seek to the previous (-1) or next (+1) cue from the current position. */
  function stepCue(dir) {
    if (!cues.length) return;
    seek(skipCue(dir));
  }

  /** Register a callback fired with (cue, index) whenever playback moves to a cue. */
  function setCueCallback(fn) { onCue = fn; }

  function fmt(ms) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  return { init, load, toggle, play, pause, seek, stepCue, updateText, setCueCallback, get playing() { return playing; }, get position() { return pos; } };
})();
