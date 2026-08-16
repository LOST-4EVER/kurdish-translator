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
  let onTime = null;    // optional callback on playback time update tick
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

    if (el.play) el.play.addEventListener('click', toggle);
    if (el.restart) el.restart.addEventListener('click', () => seek(0));
    if (el.prevCue) el.prevCue.addEventListener('click', () => stepCue(-1));
    if (el.nextCue) el.nextCue.addEventListener('click', () => stepCue(1));
    if (el.skipBack) el.skipBack.addEventListener('click', () => jump(-5000));
    if (el.skipForward) el.skipForward.addEventListener('click', () => jump(5000));
    if (el.speed) el.speed.addEventListener('change', (e) => { speed = Number(e.target.value); });

    const handleScrub = (e) => {
      if (!el.tl) return;
      const rect = el.tl.getBoundingClientRect();
      seek(clamp((e.clientX - rect.left) / rect.width, 0, 1) * total);
    };

    // Timeline hover timecode tooltip
    if (el.tlTooltip && el.tl) {
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

    if (el.tl) {
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
    }

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
    if (el.play) {
      el.play.innerHTML = PAUSE_SVG;
      el.play.setAttribute('aria-label', 'Pause');
    }
    if (el.screen && el.screen.classList) el.screen.classList.add('live');
    raf = requestAnimationFrame(tick);
  }

  function pause() {
    playing = false;
    if (el.play) {
      el.play.innerHTML = PLAY_SVG;
      el.play.setAttribute('aria-label', 'Play');
    }
    if (el.screen && el.screen.classList) el.screen.classList.remove('live');
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

  /** Find the primary cue index active at pos. */
  function cueAt(pos) {
    const cur = cursor >= 0 ? cues[cursor] : null;
    if (cur && pos >= cur.start && pos < cur.end) return cursor;
    let lo = 0, hi = cues.length - 1, best = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (cues[mid].start <= pos) { best = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    while (best > 0 && cues[best - 1].start === cues[best].start) best--;
    cursor = best >= 0 && pos < cues[best].end ? best : -1;
    return cursor;
  }

  /** Find all cues active at pos (supports simultaneous dialogue across speakers/positions). */
  function cuesAt(pos) {
    if (!cues.length) return [];
    // Binary search for first cue candidate where end > pos
    let lo = 0, hi = cues.length - 1, startIdx = cues.length;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (cues[mid].end > pos) {
        startIdx = mid;
        hi = mid - 1;
      } else {
        lo = mid + 1;
      }
    }
    const active = [];
    for (let i = startIdx; i < cues.length; i++) {
      const c = cues[i];
      if (c.start > pos) break; // Cues are sorted by start time
      if (pos >= c.start && pos < c.end) {
        active.push(c);
      }
    }
    return active;
  }

  /** Extract vertical and horizontal placement from subtitle tags or settings (ASS {\anX}, {\aX}, WebVTT line/align). */
  function getCuePlacement(cue, lineText) {
    if (!cue && !lineText) return { vAlign: 'bottom', hAlign: 'center' };
    const raw = lineText !== undefined ? String(lineText) : (cue ? (cue.rawText || cue.text || '') : '');
    const settings = (cue && cue.settings) || '';

    let vAlign = 'bottom';
    let hAlign = 'center';

    // Check ASS / SSA / SRT alignment tags: {\an1}..{\an9}, {\a1}..{\a11}
    const anMatch = raw.match(/\{\\an(\d)\}/i);
    const aMatch = raw.match(/\{\\a(\d+)\}/i);
    if (anMatch) {
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

    // Check WebVTT horizontal alignment
    if (/align:(?:left|start)/i.test(settings)) hAlign = 'left';
    else if (/align:(?:right|end)/i.test(settings)) hAlign = 'right';
    else if (/align:(?:center|middle)/i.test(settings)) hAlign = 'center';

    return { vAlign, hAlign };
  }

  function renderScreenCues(screenEl, activeList) {
    if (!screenEl) return;

    let zoneTop = screenEl.querySelector('.screen-zone.pos-top');
    let zoneMid = screenEl.querySelector('.screen-zone.pos-mid');
    let zoneBottom = screenEl.querySelector('.screen-zone.pos-bottom');

    if (!zoneTop) {
      zoneTop = document.createElement('div');
      zoneTop.className = 'screen-zone pos-top';
      screenEl.appendChild(zoneTop);
    }
    if (!zoneMid) {
      zoneMid = document.createElement('div');
      zoneMid.className = 'screen-zone pos-mid';
      screenEl.appendChild(zoneMid);
    }
    if (!zoneBottom) {
      zoneBottom = document.createElement('div');
      zoneBottom.className = 'screen-zone pos-bottom';
      screenEl.appendChild(zoneBottom);
    }

    zoneTop.innerHTML = '';
    zoneMid.innerHTML = '';
    zoneBottom.innerHTML = '';

    if (!activeList || !activeList.length) {
      return;
    }

    activeList.forEach((c) => {
      const raw = String(c.rawText || c.text || '');
      const clean = String(c.text || '').replace(/\\N/g, '\n');
      const lines = clean.split('\n');
      const rawLines = raw.split(/\\N|\n/);

      // Handle multiline with distinct tag placement (e.g. {\an8} on line 1, {\an2} on line 2)
      if (lines.length > 1 && (raw.includes('\\an') || raw.includes('\\a') || raw.includes('<top>'))) {
        lines.forEach((line, i) => {
          const stripped = line.replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, '').trim();
          if (!stripped) return;
          const placement = getCuePlacement(c, rawLines[i] || rawLines[0] || '');
          const span = document.createElement('span');
          span.className = 'screen-text';
          span.textContent = stripped;
          span.setAttribute('dir', hasArabic(stripped) ? 'rtl' : 'ltr');
          span.style.textAlign = placement.hAlign;

          const targetZone = placement.vAlign === 'top' ? zoneTop : (placement.vAlign === 'mid' ? zoneMid : zoneBottom);
          targetZone.appendChild(span);
        });
      } else {
        const stripped = clean.replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, '').trim();
        if (stripped) {
          const placement = getCuePlacement(c);
          const span = document.createElement('span');
          span.className = 'screen-text';
          span.textContent = stripped;
          span.setAttribute('dir', hasArabic(stripped) ? 'rtl' : 'ltr');
          span.style.textAlign = placement.hAlign;

          const targetZone = placement.vAlign === 'top' ? zoneTop : (placement.vAlign === 'mid' ? zoneMid : zoneBottom);
          targetZone.appendChild(span);
        }
      }
    });
  }

  let activeCuesKey = '';

  function refresh(force = false) {
    const activeList = cuesAt(pos);
    const primaryCue = activeList[0] || null;
    const primaryIdx = primaryCue ? cues.indexOf(primaryCue) : -1;
    const cuesKey = activeList.map((c) => `${c.index}:${c.text}`).join('|');
    const changed = cuesKey !== activeCuesKey;

    if (force || changed) {
      activeCuesKey = cuesKey;
      activeCue = primaryCue;

      renderScreenCues(el.screen, activeList);

      if (changed && activeList.length && el.screen) {
        const textEls = el.screen.querySelectorAll('.screen-text');
        textEls.forEach((t) => {
          t.classList.remove('caption-updated');
          void t.offsetWidth;
          t.classList.add('caption-updated');
        });
      }

      if (activeList.length) {
        fitText();
      }

      if (el.empty) el.empty.style.display = cues.length && !activeList.length ? 'none' : (cues.length ? 'none' : 'block');
      if (el.cueCount) {
        el.cueCount.textContent = cues.length ? `${primaryCue ? primaryCue.index : 0} / ${cues.length}` : '';
        el.cueCount.style.display = cues.length ? 'block' : 'none';
      }
    }

    // Time text only changes once a second; the timeline needs each frame.
    const sec = Math.floor(pos / 1000);
    if (sec !== lastSec) {
      lastSec = sec;
      if (el.time) el.time.textContent = `${fmt(pos)} / ${fmt(total)}`;
      if (onTime) onTime(pos, total);
    }
    const pct = total ? (pos / total) * 100 : 0;
    if (el.tlFill) el.tlFill.style.width = `${pct}%`;
    if (el.tlThumb) el.tlThumb.style.left = `${pct}%`;

    if (changed && onCue) onCue(primaryCue, primaryIdx, activeList);
  }

  /** Seek to the start timestamp of a specific cue index. */
  function seekToCue(index) {
    if (!cues || !cues[index]) return;
    seek(cues[index].start);
  }

  /** Register a callback fired with (pos, total) on playback time tick. */
  function setTimeCallback(fn) { onTime = fn; }

  /** Replace the text of cue at an array index (used by the live editor). */
  function updateText(index, text) {
    if (!cues[index]) return;
    cues[index].text = text;
    refresh(true);
    fitText();
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

  /** Register a callback fired with (cue, index, activeList) whenever playback moves to a cue. */
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
    if (!el.screen) return;
    const textEls = el.screen.querySelectorAll('.screen-text');
    if (!textEls.length) return;

    const screenW = el.screen.clientWidth;
    const screenH = el.screen.clientHeight;
    if (!screenW || !screenH) return;

    const base = Math.round(Math.min(screenW * 0.052, screenH * 0.16));
    let size = Math.max(14, Math.round(base * fontScale));
    const maxH = Math.max(45, (screenH / Math.max(1, textEls.length)) * 0.85);

    textEls.forEach((t) => {
      t.style.fontSize = `${size}px`;
      let currentSize = size;
      while (currentSize > 12 && (t.offsetHeight > maxH || t.scrollHeight > maxH + 10)) {
        currentSize -= 1;
        t.style.fontSize = `${currentSize}px`;
      }
    });
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
    seekToCue,
    jump,
    stepCue,
    updateText,
    fitText,
    setFontScale,
    setCueCallback,
    setTimeCallback,
    get playing() { return playing; },
    get position() { return pos; },
    get duration() { return total; }
  };
})();
