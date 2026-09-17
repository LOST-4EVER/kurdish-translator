/**
 * player.js — A lightweight subtitle player.
 * Plays cues on a landscape black screen synced to an internal clock,
 * like a video player but for subtitles. No video needed.
 */
const SubtitlePlayer = (() => {
  const _ = (sel) => document.querySelector(sel);
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const hasArabic = (s) => /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(s || '');

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
  let lastPct = -1;     // last timeline progress percentage written to style
  let cursor = -1;      // cached cue index from the last cueAt() lookup
  let fontScale = 1;    // font scale multiplier
  let currentAspectRatio = '16:9';
  let showOrig = false;

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
    el.aspectRatio = _('#aspectRatioSel');
    el.tlTooltip = _('#tlTooltip');

    if (el.aspectRatio) {
      el.aspectRatio.addEventListener('change', (e) => setAspectRatio(e.target.value));
    }
    if (el.play) el.play.addEventListener('click', toggle);
    if (el.restart) el.restart.addEventListener('click', () => seek(0));
    if (el.prevCue) el.prevCue.addEventListener('click', () => stepCue(-1));
    if (el.nextCue) el.nextCue.addEventListener('click', () => stepCue(1));
    if (el.skipBack) el.skipBack.addEventListener('click', () => jump(-5000));
    if (el.skipForward) el.skipForward.addEventListener('click', () => jump(5000));
    if (el.speed) el.speed.addEventListener('change', (e) => setSpeed(e.target.value));

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
        updateScreenDimensions();
        fitText();
      });
      ro.observe(el.screen);
    }

    bindScreenGestures();
  }

  function showScreenRipple(type, clientX, clientY, text = '') {
    if (!el.screen) return;
    const rect = el.screen.getBoundingClientRect();
    if (!rect.width) return;

    const relX = clientX !== undefined ? (clientX - rect.left) : (rect.width / 2);
    const relY = clientY !== undefined ? (clientY - rect.top) : (rect.height / 2);

    const ripple = document.createElement('div');
    ripple.className = `player-gesture-ripple ${type === 'play' || type === 'pause' || type === 'fullscreen' ? 'center-action' : 'side-action'}`;
    ripple.style.left = `${relX}px`;
    ripple.style.top = `${relY}px`;

    let iconSvg = '';
    if (type === 'play') {
      iconSvg = '<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    } else if (type === 'pause') {
      iconSvg = '<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
    } else if (type === 'rewind') {
      iconSvg = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 19 2 12 11 5 11 19"></polygon><polygon points="22 19 13 12 22 5 22 19"></polygon></svg>';
    } else if (type === 'forward') {
      iconSvg = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 19 22 12 13 5 13 19"></polygon><polygon points="2 19 11 12 2 5 2 19"></polygon></svg>';
    } else if (type === 'fullscreen') {
      iconSvg = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
    }

    ripple.innerHTML = `
      ${iconSvg}
      ${text ? `<span class="ripple-label">${text}</span>` : ''}
    `;

    el.screen.appendChild(ripple);
    setTimeout(() => {
      if (ripple && ripple.parentNode) {
        ripple.parentNode.removeChild(ripple);
      }
    }, 620);
  }

  let screenTapTimer = null;
  let lastScreenTapTime = 0;
  let lastScreenTapPos = { x: 0, y: 0 };
  let isScreenScrubbing = false;
  let screenTouchStartX = 0;
  let screenTouchStartMs = 0;
  let screenScrubHud = null;

  function updateScreenScrubHud(targetMs, deltaSec) {
    if (!el.screen) return;
    if (!screenScrubHud) {
      screenScrubHud = document.createElement('div');
      screenScrubHud.className = 'player-scrub-hud';
      el.screen.appendChild(screenScrubHud);
    }
    const sign = deltaSec >= 0 ? '+' : '';
    screenScrubHud.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      <span class="scrub-hud-time">${fmt(targetMs)}</span>
      <span class="scrub-hud-delta">(${sign}${Math.round(deltaSec)}s)</span>
    `;
  }

  function hideScreenScrubHud() {
    if (screenScrubHud) {
      if (screenScrubHud.parentNode) screenScrubHud.parentNode.removeChild(screenScrubHud);
      screenScrubHud = null;
    }
  }

  function bindScreenGestures() {
    if (!el.screen) return;

    el.screen.addEventListener('click', (e) => {
      // Ignore clicks on buttons, inputs or links
      if (e.target.closest('button, select, input, textarea, a')) return;

      const rect = el.screen.getBoundingClientRect();
      if (!rect.width) return;
      const clientX = e.clientX;
      const clientY = e.clientY;
      const relX = (clientX - rect.left) / rect.width;

      const now = performance.now();
      const timeDiff = now - lastScreenTapTime;
      const dist = Math.hypot(clientX - lastScreenTapPos.x, clientY - lastScreenTapPos.y);

      if (timeDiff < 320 && dist < 60) {
        // Double-tap detected
        if (screenTapTimer) {
          clearTimeout(screenTapTimer);
          screenTapTimer = null;
        }
        lastScreenTapTime = 0;

        if (relX < 0.35) {
          jump(-5000);
          showScreenRipple('rewind', clientX, clientY, '-5s');
        } else if (relX > 0.65) {
          jump(5000);
          showScreenRipple('forward', clientX, clientY, '+5s');
        } else {
          if (typeof AppFullscreen !== 'undefined' && AppFullscreen.enterFs) {
            AppFullscreen.enterFs();
            showScreenRipple('fullscreen', clientX, clientY);
          } else {
            toggle();
            showScreenRipple(playing ? 'play' : 'pause', clientX, clientY);
          }
        }
      } else {
        lastScreenTapTime = now;
        lastScreenTapPos = { x: clientX, y: clientY };
        if (screenTapTimer) clearTimeout(screenTapTimer);
        screenTapTimer = setTimeout(() => {
          screenTapTimer = null;
          toggle();
          showScreenRipple(playing ? 'play' : 'pause', clientX, clientY);
        }, 230);
      }
    });

    // Touch horizontal scrub gesture on player screen
    el.screen.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      isScreenScrubbing = false;
      screenTouchStartX = e.touches[0].clientX;
      screenTouchStartMs = pos;
    }, { passive: true });

    el.screen.addEventListener('touchmove', (e) => {
      if (e.touches.length !== 1 || !total) return;
      const dx = e.touches[0].clientX - screenTouchStartX;

      if (!isScreenScrubbing && Math.abs(dx) > 16) {
        isScreenScrubbing = true;
        if (screenTapTimer) {
          clearTimeout(screenTapTimer);
          screenTapTimer = null;
        }
      }

      if (isScreenScrubbing) {
        const rect = el.screen.getBoundingClientRect();
        const scrubSpanSec = Math.min(90, Math.max(15, total / 1000));
        const deltaSec = (dx / (rect.width || 400)) * scrubSpanSec;
        const targetMs = clamp(screenTouchStartMs + (deltaSec * 1000), 0, total);
        updateScreenScrubHud(targetMs, deltaSec);
        seek(targetMs);
      }
    }, { passive: true });

    const endScreenTouch = () => {
      if (isScreenScrubbing) {
        isScreenScrubbing = false;
        hideScreenScrubHud();
      }
    };
    el.screen.addEventListener('touchend', endScreenTouch, { passive: true });
    el.screen.addEventListener('touchcancel', endScreenTouch, { passive: true });
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
    lastPct = -1;
    total = cues.reduce((max, c) => Math.max(max, c.end), 0);
    buildTimeline();
    pos = 0;
    activeCue = undefined;
    refresh(true);
  }

  function buildTimeline() {
    if (!el.tlCues) return;
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
    // Binary search for the rightmost cue whose start time is <= pos
    let lo = 0, hi = cues.length - 1, last = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (cues[mid].start <= pos) {
        last = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    if (last < 0) return [];
    const active = [];
    // Scan backwards from `last` to find all cues that haven't ended yet
    for (let i = last; i >= 0; i--) {
      const c = cues[i];
      if (pos >= c.start && pos < c.end) {
        active.unshift(c);
      } else if (pos - c.start > 120000) {
        // Cues are sorted by start time; subtitles rarely exceed 2 minutes
        break;
      }
    }
    return active;
  }

  /** Extract vertical and horizontal placement from subtitle tags or settings (ASS {\anX}, {\aX}, WebVTT line/align, {\pos}). */
  function getCuePlacement(cue, lineText) {
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

    // Check ASS / SSA / SRT alignment tags: {\an1}..{\an9}, {\a1}..{\a11}
    const anMatch = raw.match(/\{\\an(\d)\}/i);
    const aMatch = raw.match(/\{\\a(\d+)\}/i);
    const posMatch = raw.match(/\{\\pos\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\)\}/i);
    if (posMatch) {
      const x = parseFloat(posMatch[1]);
      const y = parseFloat(posMatch[2]);
      pos = {
        xPct: x > 1 ? (x / 1920) : (x / 100),
        yPct: y > 1 ? (y / 1080) : (y / 100),
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

    // Check WebVTT horizontal alignment
    if (/align:(?:left|start)/i.test(settings)) hAlign = 'left';
    else if (/align:(?:right|end)/i.test(settings)) hAlign = 'right';
    else if (/align:(?:center|middle)/i.test(settings)) hAlign = 'center';

    return { vAlign, hAlign, pos };
  }

  function formatSubtitleHtml(text) {
    if (!text) return '';
    let res = String(text)
      .replace(/\\N/gi, '\n')
      .replace(/\\n/gi, '\n')
      .replace(/\\h/gi, ' ');
    // Convert ASS inline tags to standard HTML tags
    res = res
      .replace(/\{\\i1\}/gi, '<i>').replace(/\{\\i0\}/gi, '</i>')
      .replace(/\{\\b1\}/gi, '<b>').replace(/\{\\b0\}/gi, '</b>')
      .replace(/\{\\u1\}/gi, '<u>').replace(/\{\\u0\}/gi, '</u>')
      .replace(/\{\\(?:c|1c)&H([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})&\}/gi, (_, b, g, r) => `<font color="#${r}${g}${b}">`)
      .replace(/\{[^{}]*\}/g, ''); // strip remaining control tags

    // Sanitize: protect allowed tags <i>, <b>, <u>, <font>, <br>
    const tokens = [];
    res = res.replace(/<\/?(?:i|b|u|font(?:\s+color=["']#[0-9a-fA-F]{3,6}["'])?|br)\s*\/?>/gi, (match) => {
      const idx = tokens.length;
      tokens.push(match);
      return `___TAG_${idx}___`;
    });
    // Escape raw special characters
    res = res.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Restore allowed tags
    res = res.replace(/___TAG_(\d+)___/g, (_, idx) => tokens[parseInt(idx, 10)] || '');
    // Convert newlines to <br> for clean multiline display
    return res.replace(/\n/g, '<br>');
  }

  const SAFE_FONT_RE = /^[a-zA-Z0-9\s,._\-']+$/;
  const SAFE_COLOR_RE = /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[\d.]+\s*)?\)|[a-zA-Z]+)$/;

  let cachedScreenW = 0;
  let cachedScreenH = 0;

  function updateScreenDimensions() {
    if (!el.screen) return;
    cachedScreenW = el.screen.clientWidth || 0;
    cachedScreenH = el.screen.clientHeight || 0;
  }

  function renderScreenCues(screenEl, activeList) {
    if (!screenEl) return;

    let zoneTop = screenEl._zoneTop;
    let zoneMid = screenEl._zoneMid;
    let zoneBottom = screenEl._zoneBottom;

    if (!zoneTop || !zoneTop.parentNode) {
      zoneTop = screenEl.querySelector('.screen-zone.pos-top');
      if (!zoneTop) {
        zoneTop = document.createElement('div');
        zoneTop.className = 'screen-zone pos-top';
        screenEl.appendChild(zoneTop);
      }
      screenEl._zoneTop = zoneTop;
    }
    if (!zoneMid || !zoneMid.parentNode) {
      zoneMid = screenEl.querySelector('.screen-zone.pos-mid');
      if (!zoneMid) {
        zoneMid = document.createElement('div');
        zoneMid.className = 'screen-zone pos-mid';
        screenEl.appendChild(zoneMid);
      }
      screenEl._zoneMid = zoneMid;
    }
    if (!zoneBottom || !zoneBottom.parentNode) {
      zoneBottom = screenEl.querySelector('.screen-zone.pos-bottom');
      if (!zoneBottom) {
        zoneBottom = document.createElement('div');
        zoneBottom.className = 'screen-zone pos-bottom';
        screenEl.appendChild(zoneBottom);
      }
      screenEl._zoneBottom = zoneBottom;
    }

    zoneTop.innerHTML = '';
    zoneMid.innerHTML = '';
    zoneBottom.innerHTML = '';
    const oldAbs = screenEl.querySelectorAll('.screen-text.pos-abs');
    oldAbs.forEach((el) => el.remove());

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
          const plainText = line.replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, '').trim();
          if (!plainText) return;
          const placement = getCuePlacement(c, rawLines[i] || rawLines[0] || '');
          const span = document.createElement('span');
          span.className = 'screen-text';
          span.innerHTML = formatSubtitleHtml(line);
          span.setAttribute('dir', hasArabic(plainText) ? 'rtl' : 'ltr');
          span.style.textAlign = placement.hAlign;
          if (placement.hAlign === 'left') span.style.alignSelf = 'flex-start';
          else if (placement.hAlign === 'right') span.style.alignSelf = 'flex-end';
          else span.style.alignSelf = 'center';
          if (c.fontFamily && SAFE_FONT_RE.test(c.fontFamily)) span.style.fontFamily = c.fontFamily;
          if (c.color && SAFE_COLOR_RE.test(c.color)) span.style.color = c.color;

          if (placement.pos) {
            span.classList.add('pos-abs');
            span.style.position = 'absolute';
            span.style.left = `${Math.round(placement.pos.xPct * 100)}%`;
            span.style.top = `${Math.round(placement.pos.yPct * 100)}%`;
            span.style.transform = 'translate(-50%, -50%)';
            screenEl.appendChild(span);
          } else {
            const targetZone = placement.vAlign === 'top' ? zoneTop : (placement.vAlign === 'mid' ? zoneMid : zoneBottom);
            targetZone.appendChild(span);
          }
        });
      } else {
        const plainText = clean.replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, '').trim();
        if (plainText) {
          const placement = getCuePlacement(c);
          const span = document.createElement('span');
          span.className = 'screen-text';
          span.innerHTML = formatSubtitleHtml(clean);
          span.setAttribute('dir', hasArabic(plainText) ? 'rtl' : 'ltr');
          span.style.textAlign = placement.hAlign;
          if (placement.hAlign === 'left') span.style.alignSelf = 'flex-start';
          else if (placement.hAlign === 'right') span.style.alignSelf = 'flex-end';
          else span.style.alignSelf = 'center';
          if (c.fontFamily && SAFE_FONT_RE.test(c.fontFamily)) span.style.fontFamily = c.fontFamily;
          if (c.color && SAFE_COLOR_RE.test(c.color)) span.style.color = c.color;

          if (placement.pos) {
            span.classList.add('pos-abs');
            span.style.left = `${Math.round(placement.pos.xPct * 100)}%`;
            span.style.top = `${Math.round(placement.pos.yPct * 100)}%`;
            span.style.transform = 'translate(-50%, -50%)';
            screenEl.appendChild(span);
          } else {
            const targetZone = placement.vAlign === 'top' ? zoneTop : (placement.vAlign === 'mid' ? zoneMid : zoneBottom);
            targetZone.appendChild(span);
          }

          // Check if original English/source text should be displayed alongside Kurdish
          const hasOrig = Boolean(showOrig && c.origText && c.origText.trim() && c.origText.trim() !== clean.trim());
          if (hasOrig) {
            const origSpan = document.createElement('span');
            origSpan.className = 'screen-text-orig';
            origSpan.textContent = c.origText.replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, '').trim();
            origSpan.setAttribute('dir', 'ltr');
            span.appendChild(origSpan);
          }
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
          requestAnimationFrame(() => t.classList.add('caption-updated'));
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
    const roundedPct = Math.round(pct * 100) / 100;
    if (roundedPct !== lastPct) {
      lastPct = roundedPct;
      if (el.tlFill) el.tlFill.style.width = `${roundedPct}%`;
      if (el.tlThumb) el.tlThumb.style.left = `${roundedPct}%`;
    }

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

    if (!cachedScreenW || !cachedScreenH) {
      updateScreenDimensions();
    }
    const screenW = cachedScreenW;
    const screenH = cachedScreenH;
    if (!screenW || !screenH) return;

    const base = Math.round(Math.min(screenW * 0.052, screenH * 0.16));
    const targetSize = Math.max(14, Math.round(base * fontScale));

    textEls.forEach((t) => {
      const textLen = (t.textContent || '').length;
      const lineBreaks = (t.innerHTML.match(/<br\s*\/?>/gi) || []).length + 1;
      let size = targetSize;
      if (lineBreaks > 2 || textLen > 70) {
        size = Math.max(13, Math.round(targetSize * 0.82));
      } else if (lineBreaks > 1 || textLen > 45) {
        size = Math.max(14, Math.round(targetSize * 0.9));
      }
      t.style.fontSize = `${size}px`;
    });
  }

  /** Set playback speed with wall-clock compensation to prevent playback position jumps. */
  function setSpeed(newSpeed) {
    const num = Number(newSpeed) || 1;
    if (playing) {
      startPerf = performance.now();
      basePos = pos;
    }
    speed = num;
    if (el.speed && Number(el.speed.value) !== num) {
      el.speed.value = String(num);
    }
  }

  /** Set font scale multiplier for subtitle preview text. */
  function setFontScale(scale) {
    fontScale = Number(scale) || 1;
    fitText();
  }

  /** Set aspect ratio for the preview screen (e.g. 16:9, 9:16, 21:9, 4:3). */
  function setAspectRatio(ratio) {
    currentAspectRatio = ratio || '16:9';
    if (el.screen) el.screen.dataset.ratio = currentAspectRatio;
    if (el.aspectRatio && el.aspectRatio.value !== currentAspectRatio) {
      el.aspectRatio.value = currentAspectRatio;
    }
    fitText();
  }

  /** Toggle or set original source language display */
  function setShowOrig(val) {
    showOrig = Boolean(val);
    refresh(true);
    fitText();
  }

  function getShowOrig() {
    return showOrig;
  }

  return {
    init,
    load,
    loadCues: load,
    toggle,
    play,
    pause,
    seek,
    seekToCue,
    jump,
    stepCue,
    setSpeed,
    updateText,
    fitText,
    setFontScale,
    setAspectRatio,
    setShowOrig,
    getShowOrig,
    formatSubtitleHtml,
    getCuePlacement,
    get aspectRatio() { return currentAspectRatio; },
    setCueCallback,
    setTimeCallback,
    get playing() { return playing; },
    get position() { return pos; },
    get duration() { return total; }
  };
})();
