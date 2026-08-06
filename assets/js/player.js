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
      if (e.target.closest('select, input, button, textarea, a')) return;
      switch (e.code) {
        case 'Space': e.preventDefault(); toggle(); break;
        case 'ArrowRight': e.preventDefault(); seek(pos + 5000); break;
        case 'ArrowLeft': e.preventDefault(); seek(pos - 5000); break;
        case 'ArrowUp': e.preventDefault(); seek(skipCue(-1)); break;
        case 'ArrowDown': e.preventDefault(); seek(skipCue(1)); break;
      }
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
    total = cues.reduce((max, c) => Math.max(max, c.end), 0);
    buildTimeline();
    pos = 0;
    activeCue = undefined;
    refresh(true);
  }

  function buildTimeline() {
    el.tlCues.innerHTML = '';
    if (!total) return;
    for (const c of cues) {
      const seg = document.createElement('div');
      seg.className = 'tl-seg';
      seg.style.left = `${(c.start / total) * 100}%`;
      seg.style.width = `${Math.max(0.5, ((c.end - c.start) / total) * 100)}%`;
      el.tlCues.appendChild(seg);
    }
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

  function currentCue() {
    return cues.find((c) => pos >= c.start && pos < c.end) || null;
  }

  function refresh(force = false) {
    const cue = currentCue();

    // Only touch the text DOM when the active cue actually changes.
    if (force || cue !== activeCue) {
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

    // Time + timeline update cheaply every frame.
    el.time.textContent = `${fmt(pos)} / ${fmt(total)}`;
    const pct = total ? (pos / total) * 100 : 0;
    el.tlFill.style.width = `${pct}%`;
    el.tlThumb.style.left = `calc(${pct}% - 6px)`;
  }

  function fmt(ms) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  return { init, load, toggle, play, pause, seek, get playing() { return playing; } };
})();
