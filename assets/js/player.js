/**
 * player.js — A lightweight subtitle player.
 * Plays cues on a landscape black screen synced to an internal clock,
 * like a video player but for subtitles. No video needed.
 */
const SubtitlePlayer = (() => {
  const _ = (sel) => document.querySelector(sel);

  let cues = [];
  let total = 0;        // ms duration
  let pos = 0;          // current ms
  let playing = false;
  let speed = 1;
  let raf = null;
  let startPerf = 0;    // performance.now() at play start
  let basePos = 0;      // position when play started

  const el = {};

  function init() {
    el.screen = _('#playerScreen');
    el.text = _('#playerText');
    el.empty = _('#playerEmpty');
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
      const ratio = clamp((e.clientX - rect.left) / rect.width, 0, 1);
      seek(ratio * total);
    });
    el.tl.addEventListener('pointerdown', () => { if (playing) pause(); });

    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space') { e.preventDefault(); toggle(); }
    });
  }

  function load(newCues) {
    stop();
    cues = newCues || [];
    total = cues.reduce((max, c) => Math.max(max, c.end), 0);
    buildTimeline();
    pos = 0;
    refresh();
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
    refresh();
  }

  function currentCue() {
    return cues.find((c) => pos >= c.start && pos < c.end) || null;
  }

  function refresh() {
    const cue = currentCue();
    const hasCues = cues.length > 0;

    el.text.textContent = cue ? cue.text : '';
    el.text.style.display = cue ? 'block' : 'none';
    el.empty.style.display = hasCues ? 'none' : 'block';

    el.time.textContent = `${fmt(pos)} / ${fmt(total)}`;

    const pct = total ? (pos / total) * 100 : 0;
    el.tlFill.style.width = `${pct}%`;
    el.tlThumb.style.left = `calc(${pct}% - 6px)`;
  }

  function fmt(ms) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  return { init, load, toggle, play, pause, seek, get playing() { return playing; } };
})();
