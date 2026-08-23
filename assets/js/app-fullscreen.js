/**
 * app-fullscreen.js — Fullscreen Cinema Subtitle Player, Mobile Gestures, Scrubber & Live Editor.
 * Exposes AppFullscreen as a global module.
 */
const AppFullscreen = (() => {
  let appBridge = null;
  let fsActive = false;
  let fsCueIndex = -1;
  let fsInitialText = '';
  let editWasPlaying = false;

  function getElements() {
    return {
      fsEdit: document.getElementById('fsEdit'),
      fsScreen: document.getElementById('fsScreen'),
      fsToggleBtn: document.getElementById('fsToggleBtn'),
      fsClose: document.getElementById('fsClose'),
      fsEditBtn: document.getElementById('fsEditBtn'),
      fsDoneBtn: document.getElementById('fsDoneBtn'),
      fsEditor: document.getElementById('fsEditor'),
      fsInput: document.getElementById('fsInput'),
      fsCharCount: document.getElementById('fsCharCount'),
      fsCueCount: document.getElementById('fsCueCount'),
      fsPlayBtn: document.getElementById('fsPlayBtn'),
      fsPrevBtn: document.getElementById('fsPrevBtn'),
      fsNextBtn: document.getElementById('fsNextBtn'),
      fsRestartBtn: document.getElementById('fsRestartBtn'),
      fsSkipBackBtn: document.getElementById('fsSkipBackBtn'),
      fsSkipForwardBtn: document.getElementById('fsSkipForwardBtn'),
      fsPrevCueNavBtn: document.getElementById('fsPrevCueNavBtn'),
      fsNextCueNavBtn: document.getElementById('fsNextCueNavBtn'),
      fsTimeline: document.getElementById('fsTimeline'),
      fsTlFill: document.getElementById('fsTlFill'),
      fsTlThumb: document.getElementById('fsTlThumb'),
      fsTlTooltip: document.getElementById('fsTlTooltip'),
      fsRewindFeedback: document.getElementById('fsRewindFeedback'),
      fsForwardFeedback: document.getElementById('fsForwardFeedback'),
      fsFontSizeSel: document.getElementById('fsFontSizeSel'),
      fsSpeedSel: document.getElementById('fsSpeedSel'),
      fsUndoBtn: document.getElementById('fsUndoBtn'),
      fsRedoBtn: document.getElementById('fsRedoBtn'),
      fsEdUndoBtn: document.getElementById('fsEdUndoBtn'),
      fsEdRedoBtn: document.getElementById('fsEdRedoBtn'),
      fsEdPolishBtn: document.getElementById('fsEdPolishBtn'),
    };
  }

  function hasArabic(s) {
    return /[\u0600-\u06ff]/.test(s || '');
  }

  function init(bridge) {
    appBridge = bridge;
    bindEvents();
  }

  function fitFsText() {
    const els = getElements();
    if (!els.fsScreen) return;
    const textEls = els.fsScreen.querySelectorAll('.fs-text');
    if (!textEls.length) return;

    const screenW = els.fsScreen.clientWidth;
    const screenH = els.fsScreen.clientHeight;
    if (!screenW || !screenH) return;

    const scale = els.fsFontSizeSel ? (parseFloat(els.fsFontSizeSel.value) || 1) : 1;
    const base = Math.round(Math.min(screenW * 0.055, screenH * 0.12));
    let targetSize = Math.max(16, Math.round(base * scale));

    const isEditorOpen = els.fsEditor && !els.fsEditor.classList.contains('hidden');
    const maxH = isEditorOpen ? Math.max(50, screenH * 0.45) : Math.max(70, screenH * 0.75);

    textEls.forEach((el) => {
      el.style.fontSize = `${targetSize}px`;
      let sz = targetSize;
      while (sz > 14 && (el.offsetHeight > maxH || el.scrollHeight > maxH + 10)) {
        sz -= 1;
        el.style.fontSize = `${sz}px`;
      }
    });
  }

  function renderFsCues(screenEl, activeList) {
    if (!screenEl) return;

    let zoneTop = screenEl.querySelector('.fs-zone.pos-top');
    let zoneMid = screenEl.querySelector('.fs-zone.pos-mid');
    let zoneBottom = screenEl.querySelector('.fs-zone.pos-bottom');

    if (!zoneTop) {
      zoneTop = document.createElement('div');
      zoneTop.className = 'fs-zone pos-top';
      screenEl.appendChild(zoneTop);
    }
    if (!zoneMid) {
      zoneMid = document.createElement('div');
      zoneMid.className = 'fs-zone pos-mid';
      screenEl.appendChild(zoneMid);
    }
    if (!zoneBottom) {
      zoneBottom = document.createElement('div');
      zoneBottom.className = 'fs-zone pos-bottom';
      screenEl.appendChild(zoneBottom);
    }

    zoneTop.innerHTML = '';
    zoneMid.innerHTML = '';
    zoneBottom.innerHTML = '';

    if (!activeList || !activeList.length) return;

    activeList.forEach((c) => {
      const clean = String(c.text || '').replace(/\\N/g, '\n');
      const lines = clean.split('\n');

      lines.forEach((line) => {
        const stripped = line.replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, '').trim();
        if (!stripped) return;

        const span = document.createElement('span');
        span.className = 'fs-text';
        span.textContent = stripped;
        span.setAttribute('dir', hasArabic(stripped) ? 'rtl' : 'ltr');
        span.style.textAlign = 'center';

        zoneBottom.appendChild(span);
      });
    });
  }

  function updateFsScreen() {
    if (!fsActive) return;
    const els = getElements();
    const cues = appBridge ? appBridge.getWorkCues() : [];
    const currentPos = typeof SubtitlePlayer !== 'undefined' ? SubtitlePlayer.position : 0;
    const currentDuration = typeof SubtitlePlayer !== 'undefined' ? SubtitlePlayer.duration : 0;

    let activeList = [];
    if (typeof SubtitlePlayer !== 'undefined' && cues && cues.length) {
      activeList = cues.filter((c) => currentPos >= c.start && currentPos < c.end);
    }
    if (!activeList.length && cues && cues.length) {
      let nearest = cues[0];
      for (let k = 0; k < cues.length; k++) {
        if (cues[k].start <= currentPos) nearest = cues[k];
        else break;
      }
      if (nearest) activeList = [nearest];
    }

    const primaryCue = activeList[0] || (cues ? cues[0] : null);
    renderFsCues(els.fsScreen, activeList);

    if (els.fsCueCount) {
      els.fsCueCount.textContent = primaryCue && cues ? `Cue ${primaryCue.index} / ${cues.length}` : 'Cue 0 / 0';
    }

    const fmtMs = (ms) => {
      const sec = Math.floor(ms / 1000);
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return `${m}:${String(s).padStart(2, '0')}`;
    };

    const fsTimeDisplay = document.querySelector('#fsTimeDisplay');
    if (fsTimeDisplay) {
      fsTimeDisplay.textContent = `${fmtMs(currentPos)} / ${fmtMs(currentDuration)}`;
    }

    // Scrubber timeline updates
    const pct = currentDuration ? (currentPos / currentDuration) * 100 : 0;
    if (els.fsTlFill) els.fsTlFill.style.width = `${pct}%`;
    if (els.fsTlThumb) els.fsTlThumb.style.left = `${pct}%`;

    if (els.fsPlayBtn) {
      const isPlaying = typeof SubtitlePlayer !== 'undefined' && SubtitlePlayer.playing;
      els.fsPlayBtn.innerHTML = isPlaying
        ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>'
        : '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
      els.fsPlayBtn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
    }
    fitFsText();
  }

  function syncFsEditor(i) {
    const cues = appBridge ? appBridge.getWorkCues() : [];
    if (i < 0 || !cues || !cues[i]) return;
    fsCueIndex = i;
    const els = getElements();
    if (els.fsInput) {
      els.fsInput.value = cues[i].text || '';
      els.fsInput.setAttribute('dir', hasArabic(els.fsInput.value) ? 'rtl' : 'ltr');
      updateFsCharCount();
    }
  }

  function updateFsCharCount() {
    const els = getElements();
    if (els.fsCharCount && els.fsInput) {
      const len = els.fsInput.value.length;
      els.fsCharCount.textContent = `${len} chars`;
    }
  }

  function openFsEditor() {
    const cues = appBridge ? appBridge.getWorkCues() : [];
    const i = fsCueIndex >= 0 ? fsCueIndex : 0;
    if (i < 0 || !cues || !cues[i]) return;
    syncFsEditor(i);
    const els = getElements();
    fsInitialText = els.fsInput ? els.fsInput.value : '';
    if (els.fsEditor) els.fsEditor.classList.remove('hidden');
    editWasPlaying = typeof SubtitlePlayer !== 'undefined' && SubtitlePlayer.playing;
    if (typeof SubtitlePlayer !== 'undefined' && SubtitlePlayer.pause) SubtitlePlayer.pause();
    if (els.fsInput) {
      els.fsInput.focus();
      updateFsCharCount();
    }
    fitFsText();
  }

  function closeFsEditor() {
    const els = getElements();
    if (fsCueIndex >= 0 && els.fsInput && els.fsInput.value !== fsInitialText && appBridge) {
      appBridge.pushUndoState();
    }
    if (els.fsEditor) els.fsEditor.classList.add('hidden');
    if (editWasPlaying && typeof SubtitlePlayer !== 'undefined' && SubtitlePlayer.play) SubtitlePlayer.play();
    editWasPlaying = false;
    fitFsText();
  }

  function enterFs() {
    const cues = appBridge ? appBridge.getWorkCues() : [];
    if (!cues || !cues.length) {
      if (typeof Toast !== 'undefined') Toast.show('Load a subtitle file first.', 'warning', 2000);
      return;
    }
    fsActive = true;
    const els = getElements();
    if (els.fsEdit) els.fsEdit.classList.remove('hidden');

    const pos = typeof SubtitlePlayer !== 'undefined' ? SubtitlePlayer.position : 0;
    let i = cues.findIndex((c) => pos >= c.start && pos < c.end);
    if (i < 0) i = 0;
    fsCueIndex = i;

    updateFsScreen();
    requestAnimationFrame(() => fitFsText());

    if (els.fsEdit && els.fsEdit.requestFullscreen) {
      els.fsEdit.requestFullscreen().then(() => {
        fitFsText();
      }).catch(() => {});
    }
  }

  function exitFs() {
    fsActive = false;
    const els = getElements();
    if (els.fsEdit) els.fsEdit.classList.add('hidden');
    closeFsEditor();
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }

  function triggerGestureFeedback(type) {
    const els = getElements();
    const feedbackEl = type === 'rewind' ? els.fsRewindFeedback : els.fsForwardFeedback;
    if (!feedbackEl) return;
    feedbackEl.classList.remove('hidden');
    feedbackEl.style.animation = 'none';
    void feedbackEl.offsetWidth;
    feedbackEl.style.animation = '';
    setTimeout(() => {
      if (feedbackEl) feedbackEl.classList.add('hidden');
    }, 450);
  }

  function polishCurrentLine() {
    const cues = appBridge ? appBridge.getWorkCues() : [];
    if (!cues || !cues.length) return;
    const idx = fsCueIndex >= 0 ? fsCueIndex : 0;
    if (idx >= 0 && cues[idx] && typeof Translator !== 'undefined' && Translator.postprocessSorani) {
      const polished = Translator.postprocessSorani(cues[idx].text || '', { kurdishDigits: false });
      if (appBridge) appBridge.applyCueEdit(idx, polished);
      const els = getElements();
      if (els.fsInput) els.fsInput.value = polished;
      updateFsScreen();
    }
  }

  function bindEvents() {
    const els = getElements();

    if (els.fsToggleBtn) els.fsToggleBtn.addEventListener('click', () => (fsActive ? exitFs() : enterFs()));
    if (els.fsClose) els.fsClose.addEventListener('click', exitFs);

    // Double tap & single tap gestures on video stage
    let lastTapTime = 0;
    let lastTapX = 0;

    if (els.fsScreen) {
      els.fsScreen.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.fs-btn, button, select, input, textarea')) return;
        const now = Date.now();
        const rect = els.fsScreen.getBoundingClientRect();
        const tapXRatio = (e.clientX - rect.left) / rect.width;

        if (now - lastTapTime < 320 && Math.abs(e.clientX - lastTapX) < 80) {
          if (tapXRatio < 0.35) {
            if (typeof SubtitlePlayer !== 'undefined') SubtitlePlayer.jump(-5000);
            updateFsScreen();
            triggerGestureFeedback('rewind');
          } else if (tapXRatio > 0.65) {
            if (typeof SubtitlePlayer !== 'undefined') SubtitlePlayer.jump(5000);
            updateFsScreen();
            triggerGestureFeedback('forward');
          } else {
            if (typeof SubtitlePlayer !== 'undefined') SubtitlePlayer.toggle();
            updateFsScreen();
          }
          lastTapTime = 0;
        } else {
          lastTapTime = now;
          lastTapX = e.clientX;
        }
      });

      els.fsScreen.addEventListener('click', (e) => {
        if (e.target.closest('.fs-btn, button, select, input, textarea')) return;
        setTimeout(() => {
          if (Date.now() - lastTapTime >= 300) {
            openFsEditor();
          }
        }, 320);
      });
    }

    if (els.fsEditBtn) els.fsEditBtn.addEventListener('click', openFsEditor);
    if (els.fsDoneBtn) els.fsDoneBtn.addEventListener('click', closeFsEditor);
    if (els.fsPrevBtn) els.fsPrevBtn.addEventListener('click', () => { if (typeof SubtitlePlayer !== 'undefined') SubtitlePlayer.stepCue(-1); updateFsScreen(); });
    if (els.fsNextBtn) els.fsNextBtn.addEventListener('click', () => { if (typeof SubtitlePlayer !== 'undefined') SubtitlePlayer.stepCue(1); updateFsScreen(); });
    if (els.fsRestartBtn) els.fsRestartBtn.addEventListener('click', () => { if (typeof SubtitlePlayer !== 'undefined') SubtitlePlayer.seek(0); updateFsScreen(); });

    if (els.fsPrevCueNavBtn) {
      els.fsPrevCueNavBtn.addEventListener('click', () => {
        const cues = appBridge ? appBridge.getWorkCues() : [];
        if (fsCueIndex > 0 && cues[fsCueIndex - 1]) {
          syncFsEditor(fsCueIndex - 1);
          if (typeof SubtitlePlayer !== 'undefined') SubtitlePlayer.seek(cues[fsCueIndex].start);
          updateFsScreen();
        }
      });
    }

    if (els.fsNextCueNavBtn) {
      els.fsNextCueNavBtn.addEventListener('click', () => {
        const cues = appBridge ? appBridge.getWorkCues() : [];
        if (cues && fsCueIndex < cues.length - 1) {
          syncFsEditor(fsCueIndex + 1);
          if (typeof SubtitlePlayer !== 'undefined') SubtitlePlayer.seek(cues[fsCueIndex].start);
          updateFsScreen();
        }
      });
    }

    if (els.fsPlayBtn) els.fsPlayBtn.addEventListener('click', () => { if (typeof SubtitlePlayer !== 'undefined') SubtitlePlayer.toggle(); updateFsScreen(); });
    if (els.fsSkipBackBtn) {
      els.fsSkipBackBtn.addEventListener('click', () => {
        if (typeof SubtitlePlayer !== 'undefined') SubtitlePlayer.jump(-5000);
        updateFsScreen();
        triggerGestureFeedback('rewind');
      });
    }
    if (els.fsSkipForwardBtn) {
      els.fsSkipForwardBtn.addEventListener('click', () => {
        if (typeof SubtitlePlayer !== 'undefined') SubtitlePlayer.jump(5000);
        updateFsScreen();
        triggerGestureFeedback('forward');
      });
    }

    if (els.fsEdPolishBtn) els.fsEdPolishBtn.addEventListener('click', polishCurrentLine);

    if (els.fsFontSizeSel) {
      els.fsFontSizeSel.addEventListener('change', () => fitFsText());
    }

    // Scrubber drag & click
    const handleFsScrub = (e) => {
      if (!els.fsTimeline || typeof SubtitlePlayer === 'undefined') return;
      const rect = els.fsTimeline.getBoundingClientRect();
      const clampVal = (v, min, max) => Math.min(max, Math.max(min, v));
      const ratio = clampVal((e.clientX - rect.left) / rect.width, 0, 1);
      const targetMs = ratio * SubtitlePlayer.duration;
      SubtitlePlayer.seek(targetMs);
      updateFsScreen();
    };

    if (els.fsTimeline) {
      els.fsTimeline.addEventListener('pointerdown', (e) => {
        els.fsTimeline.setPointerCapture(e.pointerId);
        if (typeof SubtitlePlayer !== 'undefined' && SubtitlePlayer.playing) SubtitlePlayer.pause();
        handleFsScrub(e);

        const onFsPointerMove = (moveEvent) => handleFsScrub(moveEvent);
        const onFsPointerUp = (upEvent) => {
          els.fsTimeline.releasePointerCapture(upEvent.pointerId);
          els.fsTimeline.removeEventListener('pointermove', onFsPointerMove);
          els.fsTimeline.removeEventListener('pointerup', onFsPointerUp);
        };
        els.fsTimeline.addEventListener('pointermove', onFsPointerMove);
        els.fsTimeline.addEventListener('pointerup', onFsPointerUp);
      });

      if (els.fsTlTooltip) {
        els.fsTimeline.addEventListener('pointermove', (e) => {
          if (typeof SubtitlePlayer === 'undefined' || !SubtitlePlayer.duration) return;
          const rect = els.fsTimeline.getBoundingClientRect();
          const clampVal = (v, min, max) => Math.min(max, Math.max(min, v));
          const ratio = clampVal((e.clientX - rect.left) / rect.width, 0, 1);
          const hoverMs = ratio * SubtitlePlayer.duration;
          const sec = Math.floor(hoverMs / 1000);
          const m = Math.floor(sec / 60);
          const s = sec % 60;
          els.fsTlTooltip.textContent = `${m}:${String(s).padStart(2, '0')}`;
          els.fsTlTooltip.style.left = `${ratio * 100}%`;
          els.fsTlTooltip.classList.remove('hidden');
        });
        els.fsTimeline.addEventListener('pointerleave', () => {
          els.fsTlTooltip.classList.add('hidden');
        });
      }
    }

    if (els.fsInput) {
      els.fsInput.addEventListener('input', () => {
        const cues = appBridge ? appBridge.getWorkCues() : [];
        if (fsCueIndex < 0 || !cues || !cues[fsCueIndex]) return;
        if (appBridge) appBridge.applyCueEdit(fsCueIndex, els.fsInput.value);
        updateFsCharCount();
        updateFsScreen();
      });

      els.fsInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          closeFsEditor();
        }
      });
    }

    document.addEventListener('keydown', (e) => {
      if (!fsActive) return;
      if (e.key === 'Escape') {
        document.activeElement === els.fsInput ? closeFsEditor() : exitFs();
      }
    });

    if (typeof ResizeObserver !== 'undefined' && els.fsScreen) {
      const fsRo = new ResizeObserver(() => {
        if (fsActive) fitFsText();
      });
      fsRo.observe(els.fsScreen);
    }

    const onFullscreenChange = () => {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (fsActive) exitFs();
      } else {
        if (fsActive) {
          requestAnimationFrame(() => fitFsText());
          setTimeout(() => fitFsText(), 100);
        }
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
  }

  return {
    init,
    enter: enterFs,
    exit: exitFs,
    updateScreen: updateFsScreen,
    fitText: fitFsText,
    syncEditor: syncFsEditor,
    isActive: () => fsActive,
  };
})();
