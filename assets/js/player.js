/**
 * player.js — A lightweight subtitle player.
 * Plays cues on a landscape black screen synced to an internal clock,
 * like a video player but for subtitles. No video needed.
 */
const SubtitlePlayer = (() => {
  let cues = [];
  let total = 0;          // ms duration
  let pos = 0;            // current ms
  let playing = false;
  let speed = 1;
  let raf = null;
  let startPerf = 0;      // performance.now() at play start
  let basePos = 0;        // position when play started

  const el = {};
  const _ = (s) => document.querySelector(s);

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
      const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      seek(ratio * total);
    });
    el.tl.addEventListener('pointerdown', (e) => {
      if (playing) pause();
    });
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space') { e.preventDefault(); toggle(); }
    });
  }

  function load(newCues) {
    stop();
    cues = newCues || [];
    total = cues.reduce((m, c) => Math.max(m, c.end), 0);
    buildTimeline();
    pos = 0;
    updateText();
    updateTime();
    updateTimeline();
    renderScreen();
  }

  function buildTimeline() {
    el.tlCues.innerHTML = '';
    if (!total) return;
    for (const c of cues) {
      const seg = document.createElement('div');
      seg.className = 'tl-seg';
      const start = Math.max(0, (c.start / total) * 100);
      const end = Math.min(100, (c.end / total) * 100);
      seg.style.left = start + '%';
      seg.style.width = Math.max(0.5, end - start) + '%';
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
  function stop() { pause(); pos = 0; updateText(); }

  function toggle() { playing ? pause() : play(); }

  function tick(now) {
    if (!playing) return;
    pos = basePos + (now - startPerf) * speed;
    if (pos >= total) {
      pos = total;
      pause();
      updateText();
    } else {
      updateText();
    }
    updateTime();
    updateTimeline();
    raf = requestAnimationFrame(tick);
  }

  function seek(ms) {
    pos = Math.min(total, Math.max(0, ms));
    if (playing) { startPerf = performance.now(); basePos = pos; }
    updateText();
    updateTime();
    updateTimeline();
  }

  function currentCue() {
    if (!cues.length) return null;
    return cues.find((c) => pos >= c.start && pos < c.end) || null;
  }

  function updateText() {
    const cue = currentCue();
    if (cue) {
      el.text.textContent = cue.text;
      el.empty.style.display = 'none';
      el.text.style.display = 'block';
    } else {
      el.text.textContent = '';
      el.text.style.display = 'none';
      el.empty.style.display = cues.length ? 'none' : 'block';
      if (cues.length) el.empty.textContent = '';
    }
  }

  function fmt(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  }
  function updateTime() {
    el.time.textContent = `${fmt(pos)} / ${fmt(total)}`;
  }
  function updateTimeline() {
    const pct = total ? (pos / total) * 100 : 0;
    el.tlFill.style.width = pct + '%';
    el.tlThumb.style.left = 'calc(' + pct + '% - 6px)';
  }

  function renderScreen() {
    // Called after loading a file so the empty state updates correctly.
    updateText();
  }

  return { init, load, toggle, play, pause, seek, get playing() { return playing; } };
})();
