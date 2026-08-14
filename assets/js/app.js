/**
 * app.js — UI controller: file drop, settings, translation flow, download.
 */
(() => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ---------- Constants ----------
  const STEPS = ['upload', 'settings', 'progress', 'done'];

  const ALLOWED_EXT = ['srt', 'vtt', 'ass', 'ssa', 'sub', 'smi'];
  const LABEL = { srt: 'SRT', vtt: 'VTT', ass: 'ASS', ssa: 'SSA', sub: 'MicroDVD', smi: 'SAMI' };
  const EXT_BY_FORMAT = { srt: 'srt', vtt: 'vtt', ass: 'ass', ssa: 'ssa', sub: 'sub', smi: 'smi' };
  // Per-format MIME so browsers that ignore the `download` attribute fall
  // back to the right extension instead of .txt (text/plain).
  const MIME_BY_FORMAT = {
    srt: 'application/x-subrip;charset=utf-8',
    vtt: 'text/vtt;charset=utf-8',
    ass: 'application/x-ass;charset=utf-8',
    ssa: 'text/x-ssa;charset=utf-8',
    sub: 'application/x-microdvd;charset=utf-8',
    smi: 'application/x-sami;charset=utf-8',
  };

  const SOURCE_LANGS = {
    en: 'English', ar: 'Arabic', tr: 'Turkish', fa: 'Persian (Farsi)',
    de: 'German', fr: 'French', es: 'Spanish', ru: 'Russian', it: 'Italian',
    nl: 'Dutch', pt: 'Portuguese', zh: 'Chinese', ja: 'Japanese', ko: 'Korean',
    hi: 'Hindi', ur: 'Urdu', ps: 'Pashto', az: 'Azerbaijani', sv: 'Swedish',
    no: 'Norwegian', da: 'Danish', pl: 'Polish', uk: 'Ukrainian', el: 'Greek',
    sq: 'Albanian', ro: 'Romanian', fi: 'Finnish', he: 'Hebrew', id: 'Indonesian',
    bn: 'Bengali', ta: 'Tamil', te: 'Telugu', vi: 'Vietnamese', th: 'Thai',
    ms: 'Malay', tl: 'Filipino', sw: 'Swahili', cs: 'Czech', hu: 'Hungarian',
  };

  // ---------- Elements ----------
  const els = {};
  const bind = (map) => { Object.entries(map).forEach(([key, sel]) => { els[key] = $(sel); }); };
  bind({
    stepUpload: '#stepUpload', stepSettings: '#stepSettings',
    stepProgress: '#stepProgress', stepDone: '#stepDone',
    dropzone: '#dropzone', fileInput: '#fileInput',
    fileName: '#fileName', fileMeta: '#fileMeta', changeFile: '#changeFile',
    srcLang: '#srcLang', tgtLang: '#tgtLang', keepOnly: '#keepOnly',
    includeOriginal: '#includeOriginal', accuracyToggle: '#accuracyToggle',
    kurdishDigitsToggle: '#kurdishDigitsToggle', addBomToggle: '#addBomToggle',
    crlfToggle: '#crlfToggle',
    openAdvModalBtn: '#openAdvModalBtn', closeAdvModalBtn: '#closeAdvModalBtn',
    doneAdvModalBtn: '#doneAdvModalBtn', advModalBackdrop: '#advModalBackdrop',
    advActiveBadge: '#advActiveBadge',
    exportFormatSel: '#exportFormatSel', langToggleBtn: '#langToggleBtn',
    translateBtn: '#translateBtn',
    progressFill: '#progressFill', progressPct: '#progressPct',
    progressDetail: '#progressDetail', lineCount: '#lineCount', cancelBtn: '#cancelBtn',
    liveCaption: '#liveCaption', livePlaceholder: '#livePlaceholder', liveFeed: '#liveFeed',
    downloadBtn: '#downloadBtn', edDownloadBtn: '#edDownloadBtn', copyBtn: '#copyBtn',
    translateAgainBtn: '#translateAgainBtn', doneFormat: '#doneFormat', doneSize: '#doneSize',
    previewBtn: '#previewBtn',
    previewTab: '#previewTab', tabTranslate: '#tabTranslate', tabPreview: '#tabPreview',
    installBtn: '#installBtn',
    toast: '#toast',
    editorList: '#editorList', editorStatus: '#editorStatus',
    edSearchInput: '#edSearchInput', edSearchCount: '#edSearchCount', edSearchClearBtn: '#edSearchClearBtn',
    edCount: '#edCount', undoBtn: '#undoBtn', redoBtn: '#redoBtn',
    showTimeToggle: '#showTimeToggle', saveEditsToggle: '#saveEditsToggle',
    syncVideoToggle: '#syncVideoToggle',
    skipBackBtn: '#skipBackBtn', skipForwardBtn: '#skipForwardBtn',
    fontSizeSel: '#fontSizeSel', fsFontSizeSel: '#fsFontSizeSel',
    fsEdit: '#fsEdit', fsText: '#fsText', fsCueCount: '#fsCueCount',
    fsToggleBtn: '#fsToggleBtn', fsEditBtn: '#fsEditBtn', fsClose: '#fsClose',
    fsPrevBtn: '#fsPrevBtn', fsNextBtn: '#fsNextBtn',
    fsUndoBtn: '#fsUndoBtn', fsRedoBtn: '#fsRedoBtn',
    fsEdUndoBtn: '#fsEdUndoBtn', fsEdRedoBtn: '#fsEdRedoBtn',
    fsPlayBtn: '#fsPlayBtn', fsSkipBackBtn: '#fsSkipBackBtn', fsSkipForwardBtn: '#fsSkipForwardBtn',
    fsEditor: '#fsEditor', fsInput: '#fsInput', fsDoneBtn: '#fsDoneBtn',
    tourTriggerBtn: '#tourTriggerBtn', tourOverlay: '#tourOverlay',
    tourBackdrop: '#tourBackdrop', tourHighlight: '#tourHighlight',
    tourCard: '#tourCard', tourStepBadge: '#tourStepBadge',
    tourCloseBtn: '#tourCloseBtn', tourTitle: '#tourTitle',
    tourText: '#tourText', tourSkipBtn: '#tourSkipBtn',
    tourPrevBtn: '#tourPrevBtn', tourNextBtn: '#tourNextBtn',
  });
  const tabButtons = $$('.tab');

  // ---------- Translations Dictionary Fallback ----------
  const dicts = typeof UI_I18N !== 'undefined' ? UI_I18N : {
    en: { brandSub: 'Translate movie, anime & series subtitles' },
    ckb: { brandSub: 'وەرگێڕی ژێرنووسی فیلم، ئەنیمی و زنجیرەکان' }
  };

  let currentUiLang = 'en';

  function applyLanguage(lang) {
    currentUiLang = lang === 'ckb' ? 'ckb' : 'en';
    store.set('app_ui_lang', currentUiLang);
    document.documentElement.lang = currentUiLang;
    document.documentElement.dir = currentUiLang === 'ckb' ? 'rtl' : 'ltr';

    if (els.langToggleBtn) {
      const enSpan = els.langToggleBtn.querySelector('.lang-opt.en');
      const ckbSpan = els.langToggleBtn.querySelector('.lang-opt.ckb');
      if (enSpan) enSpan.classList.toggle('active', currentUiLang === 'en');
      if (ckbSpan) ckbSpan.classList.toggle('active', currentUiLang === 'ckb');
    }

    const dict = dicts[currentUiLang];
    if (!dict) return;

    $$('[data-i18n]').forEach((el) => {
      const key = el.dataset.i18n;
      if (dict[key]) {
        el.textContent = dict[key];
      }
    });

    $$('[data-i18n-placeholder]').forEach((el) => {
      const key = el.dataset.i18nPlaceholder;
      if (dict[key]) {
        el.placeholder = dict[key];
      }
    });

    $$('[data-i18n-title]').forEach((el) => {
      const key = el.dataset.i18nTitle;
      if (dict[key]) {
        el.title = dict[key];
      }
    });

    if (typeof isTourOpen !== 'undefined' && isTourOpen) {
      renderTourStep(currentTourStep);
    }
  }

  // ---------- State ----------
  let file = null;
  let parsed = null;
  let resultText = null;
  let resultUrl = null;
  let cancelFlag = false;
  let activeController = null;
  let workCues = null;  // editable cue set (what the player + editor show)
  let baseCues = null;  // saved cue set (used for download when "Save edits" is off)
  let dirty = false;    // true once the user has edited a line
  let prepareTimer = null;
  let activeIdx = -1;   // cue index currently on screen
  let fsActive = false; // fullscreen edit mode on
  let fsCueIndex = -1;  // cue being edited in fullscreen
  let editWasPlaying = false; // true if the player was running when editing started
  let rowEls = [];      // editor row nodes indexed by cue index (for O(1) highlight)
  let lastActiveRow = null;  // currently highlighted editor row
  let liveSource = [];  // original source lines for the live translation reel
  let liveOrder = [];   // absolute indices of non-empty source lines (translated in this order)
  let liveItems = [];   // absolute indices whose translation changed (in completion order)
  let liveDone = 0;     // how many non-empty lines have been finalized
  let editorObserver = null;
  let copyTimer = null;
  const hasArabic = (s) => /[\u0600-\u06FF\u0750-\u077F]/.test(s);
  // Safari iOS ignores the `download` attribute on blob: URLs; iPadOS
  // identifies itself as a Mac, so detect touch too.
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // ---------- Helpers ----------
  const store = {
    get(key, fallback) { try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch { return fallback; } },
    set(key, val) { try { localStorage.setItem(key, val); } catch {} },
  };
  let toastTimer;
  function toast(msg, isError = false, subtext = '', options = {}) {
    if (typeof Toast !== 'undefined') {
      if (isError) {
        Toast.error(msg, subtext, options.actionLabel, options.onAction);
      } else {
        Toast.show(msg, options.type || 'info', { subtext, actionLabel: options.actionLabel, onAction: options.onAction });
      }
    } else if (els.toast) {
      els.toast.textContent = msg;
      els.toast.classList.toggle('error', isError);
      els.toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => els.toast.classList.remove('show'), 3200);
    }
  }

  // Step cards keyed by step name (avoid string-building element lookups).
  const stepEls = Object.fromEntries(STEPS.map((s) => [s, els['step' + s[0].toUpperCase() + s.slice(1)]]));

  function showStep(name) {
    STEPS.forEach((s) => stepEls[s].classList.add('hidden'));
    const target = stepEls[name];
    if (target) {
      target.classList.remove('hidden');
      target.style.animation = 'none';
      void target.offsetWidth; // trigger reflow for smooth re-entry animation
      target.style.animation = '';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setProgress(fraction, detail) {
    const pct = Math.round(fraction * 100);
    els.progressFill.style.width = pct + '%';
    els.progressPct.textContent = pct + '%';
    if (detail) els.progressDetail.textContent = detail;
  }

  const stripTags = (text) => text.replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, '');
  // ASS/SSA line breaks are stored as \N; render them as real newlines.
  const displayText = (text) => stripTags(text).replace(/\\N/g, '\n');
  const dirFor = (text) => (hasArabic(text) ? 'rtl' : 'ltr');

  /** Render the live translation reel: show the latest line on the mini screen
   *  (like a subtitle) and the last handful of completed lines below it.
   *  Only the non-empty lines finalized since the last call are scanned, so
   *  building a very large file stays O(n) instead of rescanning everything,
   *  and sparse source files (with empty/blank cues) still map correctly. */
  let cachedLiveTexts = null;
  function renderLive(results, doneCount) {
    const upto = Math.min(doneCount || 0, liveOrder.length);
    if (cachedLiveTexts === null) cachedLiveTexts = new Array(results.length).fill(null);
    for (let k = liveDone; k < upto; k++) {
      const i = liveOrder[k];
      const tr = results[i] && results[i].trim();
      const prev = cachedLiveTexts[i];
      cachedLiveTexts[i] = tr || null;
      if (tr && tr !== prev && tr !== (liveSource[i] || '').trim()) liveItems.push(i);
      // Cap liveItems so very large files don't grow this array unbounded.
      if (liveItems.length > 50) liveItems = liveItems.slice(-50);
    }
    liveDone = upto;
    const latestIdx = liveItems[liveItems.length - 1];
    const latest = latestIdx !== undefined ? results[latestIdx] : '';
    if (latest && latest.trim()) {
      els.liveCaption.textContent = displayText(latest);
      els.liveCaption.setAttribute('dir', dirFor(latest));
      els.livePlaceholder.classList.add('hidden');
      els.liveCaption.classList.remove('hidden');
    }
    els.liveFeed.innerHTML = '';
    liveItems.slice(-5).forEach((i) => {
      const row = document.createElement('span');
      row.className = 'live-item';
      row.setAttribute('dir', dirFor(results[i]));
      row.textContent = displayText(results[i]);
      els.liveFeed.appendChild(row);
    });
  }

  let undoStack = [];
  let redoStack = [];
  let lastCommittedState = '';
  let editDebounceTimer = null;

  function initHistory(cues) {
    undoStack = [];
    redoStack = [];
    lastCommittedState = JSON.stringify(cues);
    updateUndoRedoUI();
    checkEditsState();
  }

  function recordPreEditSnapshot() {
    if (!workCues) return;
    const currentJson = JSON.stringify(workCues);
    if (currentJson === lastCommittedState) {
      undoStack.push(JSON.parse(currentJson));
      if (undoStack.length > 60) undoStack.shift();
      redoStack = [];
      updateUndoRedoUI();
    }
  }

  function pushUndoState() {
    clearTimeout(editDebounceTimer);
    if (!workCues) return;
    const currentJson = JSON.stringify(workCues);
    if (currentJson !== lastCommittedState) {
      lastCommittedState = currentJson;
      updateUndoRedoUI();
      checkEditsState();
      prepareDownload();
    }
  }

  function updateUndoRedoUI() {
    const disabled = undoStack.length === 0;
    const redoDisabled = redoStack.length === 0;
    if (els.undoBtn) els.undoBtn.disabled = disabled;
    if (els.redoBtn) els.redoBtn.disabled = redoDisabled;
    if (els.fsUndoBtn) els.fsUndoBtn.disabled = disabled;
    if (els.fsRedoBtn) els.fsRedoBtn.disabled = redoDisabled;
    if (els.fsEdUndoBtn) els.fsEdUndoBtn.disabled = disabled;
    if (els.fsEdRedoBtn) els.fsEdRedoBtn.disabled = redoDisabled;
  }

  function performUndo() {
    if (!undoStack.length) return;
    clearTimeout(editDebounceTimer);
    const currentSnapshot = workCues.map((c) => ({ ...c }));
    redoStack.push(currentSnapshot);
    const prev = undoStack.pop();
    workCues = prev.map((c) => ({ ...c }));
    lastCommittedState = JSON.stringify(workCues);
    dirty = hasEdits();
    updateUndoRedoUI();
    restoreCuesState();
    checkEditsState();
  }

  function performRedo() {
    if (!redoStack.length) return;
    clearTimeout(editDebounceTimer);
    const currentSnapshot = workCues.map((c) => ({ ...c }));
    undoStack.push(currentSnapshot);
    const next = redoStack.pop();
    workCues = next.map((c) => ({ ...c }));
    lastCommittedState = JSON.stringify(workCues);
    dirty = hasEdits();
    updateUndoRedoUI();
    restoreCuesState();
    checkEditsState();
  }

  function hasEdits() {
    if (!baseCues || !workCues) return false;
    if (baseCues.length !== workCues.length) return true;
    for (let i = 0; i < workCues.length; i++) {
      if (workCues[i].text !== baseCues[i].text) return true;
    }
    return false;
  }

  function checkEditsState() {
    const edited = hasEdits();
    dirty = edited;
    if (els.edDownloadBtn) {
      if (edited && parsed) {
        els.edDownloadBtn.style.display = 'inline-flex';
        els.edDownloadBtn.classList.add('has-edits');
      } else {
        els.edDownloadBtn.style.display = 'none';
        els.edDownloadBtn.classList.remove('has-edits');
      }
    }
    updateStatus();
  }

  function restoreCuesState() {
    loadPreview(workCues);
    if (rowEls && rowEls.length === workCues.length) {
      workCues.forEach((c, i) => {
        const row = rowEls[i];
        if (row) {
          const input = row.querySelector('.ed-input');
          if (input) {
            const val = displayText(c.text);
            if (input.value !== val) {
              input.value = val;
              input.setAttribute('dir', dirFor(val));
              autoGrow(input);
            }
          }
        }
      });
    } else {
      buildEditor();
    }
    if (fsActive) {
      updateFsScreen();
      if (fsCueIndex >= 0 && workCues[fsCueIndex] && els.fsInput) {
        els.fsInput.value = displayText(workCues[fsCueIndex].text);
        els.fsInput.setAttribute('dir', dirFor(els.fsInput.value));
      }
    }
    prepareDownload();
  }

  /** Write a user edit into a cue: player screen, dirty flag, debounced download. */
  function applyCueEdit(i, text) {
    if (i < 0 || !workCues || !workCues[i]) return;
    if (workCues[i].text === text) return;

    recordPreEditSnapshot();

    workCues[i].text = text;
    SubtitlePlayer.updateText(i, stripTags(text));
    dirty = true;

    // Keep the main editor list textarea in sync if not the event target
    const row = rowEls ? rowEls[i] : null;
    if (row) {
      const input = row.querySelector('.ed-input');
      const val = displayText(text);
      if (input && input.value !== val) {
        input.value = val;
        input.setAttribute('dir', dirFor(val));
        autoGrow(input);
      }
    }

    if (fsActive && fsCueIndex === i && els.fsInput) {
      const val = displayText(text);
      if (els.fsInput.value !== val) {
        els.fsInput.value = val;
        els.fsInput.setAttribute('dir', dirFor(val));
      }
      updateFsScreen();
    }

    clearTimeout(editDebounceTimer);
    editDebounceTimer = setTimeout(() => {
      lastCommittedState = JSON.stringify(workCues);
      updateUndoRedoUI();
      checkEditsState();
      prepareDownload();
    }, 400);

    checkEditsState();
  }

  function loadPreview(cues = workCues) {
    SubtitlePlayer.load(cues.map((c) => ({ ...c, text: displayText(c.text) })));
    els.previewTab.classList.remove('disabled');
  }

  // ---------- Subtitle editor ----------
  function autoGrow(el) {
    if (el.scrollHeight === 0) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  function updateStatus() {
    els.editorStatus.textContent = dirty
      ? (els.saveEditsToggle.checked ? 'Your edits will appear in the download' : 'Edits appear here only — not in the download')
      : 'Synced with the preview — edits apply live';
  }

  function buildEditor() {
    const list = els.editorList;
    list.innerHTML = '';
    const showTime = els.showTimeToggle.checked;

    if (!workCues || !workCues.length) {
      const empty = document.createElement('p');
      empty.className = 'ed-empty';
      empty.textContent = 'Load a subtitle file to edit it here.';
      list.appendChild(empty);
      if (els.edCount) els.edCount.textContent = '';
      return;
    }
    if (els.edCount) els.edCount.textContent = `· ${workCues.length}`;

    const frag = document.createDocumentFragment();
    const rows = new Array(workCues.length);
    const inputs = new Array(workCues.length);
    workCues.forEach((c, i) => {
      const row = document.createElement('div');
      row.className = 'ed-row';
      row.dataset.index = i;
      rows[i] = row;

      const meta = document.createElement('div');
      meta.className = 'ed-meta';

      const idx = document.createElement('span');
      idx.className = 'ed-idx';
      idx.textContent = String(i + 1).padStart(2, '0');

      const time = document.createElement('span');
      time.className = 'ed-time';
      time.textContent = `${SubParser.fmtSRT(c.start)} → ${SubParser.fmtSRT(c.end)}`;
      time.classList.toggle('hidden', !showTime);

      meta.appendChild(idx);
      meta.appendChild(time);
      row.appendChild(meta);

      const input = document.createElement('textarea');
      input.className = 'ed-input';
      input.value = displayText(c.text);
      input.setAttribute('dir', dirFor(input.value));
      input.setAttribute('aria-label', `Cue ${i + 1} text`);
      inputs[i] = input;
      row.appendChild(input);
      frag.appendChild(row);
    });
    list.appendChild(frag);

    if (editorObserver) {
      editorObserver.disconnect();
    }
    editorObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const input = entry.target;
          autoGrow(input);
          editorObserver.unobserve(input);
        }
      });
    }, {
      root: els.editorList,
      rootMargin: '100px',
    });

    inputs.forEach((input) => {
      editorObserver.observe(input);
    });

    rowEls = rows;
    lastActiveRow = null;
    if (els.edSearchInput && els.edSearchInput.value.trim()) {
      filterEditor();
    }
  }

  function filterEditor() {
    if (!els.edSearchInput) return;
    const query = els.edSearchInput.value.trim().toLowerCase();
    const clearBtn = els.edSearchClearBtn;
    const countBadge = els.edSearchCount;

    if (!query) {
      if (clearBtn) clearBtn.classList.add('hidden');
      if (countBadge) countBadge.classList.add('hidden');
      if (rowEls) {
        rowEls.forEach((row) => {
          if (row) {
            row.classList.remove('search-hidden', 'search-matched');
          }
        });
      }
      return;
    }

    if (clearBtn) clearBtn.classList.remove('hidden');

    let matchCount = 0;
    if (rowEls && workCues) {
      workCues.forEach((cue, i) => {
        const row = rowEls[i];
        if (!row) return;
        const text = (cue.text || '').toLowerCase();
        const time = `${SubParser.fmtSRT(cue.start)} ${SubParser.fmtSRT(cue.end)}`.toLowerCase();
        const matches = text.includes(query) || time.includes(query) || String(i + 1).includes(query);
        if (matches) {
          matchCount++;
          row.classList.remove('search-hidden');
          row.classList.add('search-matched');
        } else {
          row.classList.add('search-hidden');
          row.classList.remove('search-matched');
        }
      });
    }

    if (countBadge) {
      countBadge.textContent = String(matchCount);
      countBadge.classList.remove('hidden');
    }
  }

  let userScrollTimer = null;
  let userIsScrolling = false;

  function scrollRowIntoView(row) {
    const list = els.editorList;
    if (!list || !row) return;
    if (userIsScrolling) return;
    if (els.syncVideoToggle && !els.syncVideoToggle.checked) return;
    const r = row.getBoundingClientRect();
    const b = list.getBoundingClientRect();
    if (r.top < b.top + 8 || r.bottom > b.bottom - 8) {
      row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // Follow playback: highlight + scroll the editor to the cue now on screen.
  SubtitlePlayer.setCueCallback((cue, idx) => {
    activeIdx = idx;
    if (fsActive) {
      updateFsScreen();
      // Keep the fullscreen editor synced to the playing cue unless the user
      // is actively typing in it.
      if (!els.fsEditor.classList.contains('hidden') && document.activeElement !== els.fsInput && fsCueIndex !== idx) {
        syncFsEditor(idx);
      }
      return; // normal editor-list highlight is hidden behind the overlay
    }
    if (!cue || idx < 0) return;
    if (document.activeElement && document.activeElement.classList.contains('ed-input')) return;
    if (lastActiveRow) lastActiveRow.classList.remove('active');
    if (!rowEls || !rowEls[idx]) return;
    const row = rowEls[idx];
    if (row) {
      row.classList.add('active');
      lastActiveRow = row;
      scrollRowIntoView(row);
    }
  });

  /** Swap in a fresh cue set (original or translated) and rebuild everything. */
  function updateCues(cues) {
    baseCues = cues.map((c) => ({ ...c }));
    workCues = cues.map((c) => ({ ...c }));
    undoStack = [];
    redoStack = [];
    updateUndoRedoUI();
    dirty = false;
    activeIdx = -1;
    if (fsActive) exitFs();
    if (els.previewTab) els.previewTab.classList.remove('disabled');
    loadPreview(workCues);
    buildEditor();
    prepareDownload();
    updateStatus();
  }

  // ---------- Fullscreen edit mode ----------

  /** Shrink the fullscreen subtitle text until it fits the visible screen area. */
  function fitFsText() {
    const el = els.fsText;
    const screen = els.fsScreen;
    if (!el || !screen) return;
    const scale = els.fsFontSizeSel ? parseFloat(els.fsFontSizeSel.value) || 1 : 1;
    const base = Math.round(Math.min(Math.max(20, screen.clientWidth * 0.055), 42));
    const availW = screen.clientWidth * 0.94;
    const availH = screen.clientHeight - 90; // leave room for the tap hint
    const prevTrans = el.style.transition;
    el.style.transition = 'none';
    let size = base * scale;
    el.style.fontSize = `${size}px`;
    while (size > 12 && (el.scrollWidth > availW || el.scrollHeight > availH)) {
      size -= 1;
      el.style.fontSize = `${size}px`;
    }
    el.style.transition = prevTrans;
  }

  function updateFsScreen() {
    const cue = activeIdx >= 0 && workCues[activeIdx] ? workCues[activeIdx] : null;
    els.fsText.textContent = cue ? displayText(cue.text) : '';
    els.fsText.setAttribute('dir', cue ? dirFor(cue.text) : 'ltr');
    els.fsCueCount.textContent = cue ? `Cue ${cue.index} / ${workCues.length}` : 'Cue 0 / 0';
    if (els.fsPlayBtn) {
      els.fsPlayBtn.innerHTML = SubtitlePlayer.playing
        ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>'
        : '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
      els.fsPlayBtn.setAttribute('aria-label', SubtitlePlayer.playing ? 'Pause' : 'Play');
    }
    fitFsText();
  }

  function syncFsEditor(i) {
    if (i < 0 || !workCues[i]) return;
    fsCueIndex = i;
    els.fsInput.value = displayText(workCues[i].text);
    els.fsInput.setAttribute('dir', dirFor(els.fsInput.value));
  }

  let fsInitialText = '';

  function openFsEditor() {
    const i = activeIdx;
    if (i < 0 || !workCues[i]) return;
    syncFsEditor(i);
    fsInitialText = els.fsInput.value;
    els.fsEditor.classList.remove('hidden');
    editWasPlaying = SubtitlePlayer.playing;
    SubtitlePlayer.pause(); // freeze the cue so you can type without it skipping away
    els.fsInput.focus(); // pops the keyboard so you can tap-edit immediately
    fitFsText();
  }

  function closeFsEditor() {
    if (fsCueIndex >= 0 && els.fsInput.value !== fsInitialText) {
      pushUndoState();
    }
    els.fsEditor.classList.add('hidden');
    if (editWasPlaying) SubtitlePlayer.play();
    editWasPlaying = false;
    fitFsText();
  }

  function enterFs() {
    if (!parsed || !workCues || !workCues.length) { toast('Load a subtitle file first.', true); return; }
    fsActive = true;
    els.fsEdit.classList.remove('hidden');
    // Show the cue now on screen (falling back to the first cue) so the
    // fullscreen view is never a blank screen, and park the player on it.
    const pos = SubtitlePlayer.position;
    let i = workCues.findIndex((c) => pos >= c.start && pos < c.end);
    if (i < 0) i = activeIdx >= 0 ? activeIdx : 0;
    if (i < 0) i = 0;
    SubtitlePlayer.seek(workCues[i].start);
    updateFsScreen();
    if (els.fsEdit.requestFullscreen) els.fsEdit.requestFullscreen().catch(() => {});
  }

  function exitFs() {
    fsActive = false;
    els.fsEdit.classList.add('hidden');
    closeFsEditor();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }

  function bindFs() {
    els.fsToggleBtn.addEventListener('click', () => (fsActive ? exitFs() : enterFs()));
    els.fsClose.addEventListener('click', exitFs);
    els.fsText.addEventListener('click', openFsEditor); // tap any word → editor at the bottom
    els.fsEditBtn.addEventListener('click', openFsEditor);
    els.fsDoneBtn.addEventListener('click', closeFsEditor);
    els.fsPrevBtn.addEventListener('click', () => SubtitlePlayer.stepCue(-1));
    els.fsNextBtn.addEventListener('click', () => SubtitlePlayer.stepCue(1));

    if (els.fsPlayBtn) els.fsPlayBtn.addEventListener('click', () => { SubtitlePlayer.toggle(); updateFsScreen(); });
    if (els.fsSkipBackBtn) els.fsSkipBackBtn.addEventListener('click', () => SubtitlePlayer.seek(SubtitlePlayer.position - 5000));
    if (els.fsSkipForwardBtn) els.fsSkipForwardBtn.addEventListener('click', () => SubtitlePlayer.seek(SubtitlePlayer.position + 5000));
    if (els.fsUndoBtn) els.fsUndoBtn.addEventListener('click', performUndo);
    if (els.fsRedoBtn) els.fsRedoBtn.addEventListener('click', performRedo);
    if (els.fsEdUndoBtn) els.fsEdUndoBtn.addEventListener('click', performUndo);
    if (els.fsEdRedoBtn) els.fsEdRedoBtn.addEventListener('click', performRedo);

    if (els.fsFontSizeSel) {
      els.fsFontSizeSel.addEventListener('change', (e) => {
        const val = e.target.value;
        if (els.fontSizeSel) els.fontSizeSel.value = val;
        SubtitlePlayer.setFontScale(val);
        fitFsText();
      });
    }

    els.fsInput.addEventListener('input', () => {
      if (fsCueIndex < 0 || !workCues[fsCueIndex]) return;
      applyCueEdit(fsCueIndex, els.fsInput.value);
      updateFsScreen();
    });

    els.fsInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        closeFsEditor();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (!fsActive) return;
      if (e.key === 'Escape') {
        document.activeElement === els.fsInput ? closeFsEditor() : exitFs();
      }
    });

    // Keep state in sync when the browser exits fullscreen natively (Esc).
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement && fsActive) exitFs();
    });
  }

  // ---------- Tabs ----------
  function switchTab(name) {
    if (name === 'preview' && !parsed) {
      toast('Load a subtitle file first.', true);
      return; // don't switch to an empty preview tab
    }
    tabButtons.forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    els.tabTranslate.classList.toggle('hidden', name !== 'translate');
    els.tabPreview.classList.toggle('hidden', name !== 'preview');
    if (name !== 'preview') SubtitlePlayer.pause(); // stop playback off-screen
  }
  tabButtons.forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));

  // ---------- File handling ----------
  const formatSize = (n) => n < 1024 ? `${n} B`
    : n < 1048576 ? `${(n / 1024).toFixed(1)} KB`
    : `${(n / 1048576).toFixed(1)} MB`;

  /** Read a file as text, auto-detecting BOM / UTF-16 / UTF-8 encoding. */
  function readFileAsText(f) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => {
        const bytes = new Uint8Array(reader.result);
        resolve(decodeBytes(bytes));
      };
      reader.readAsArrayBuffer(f);
    });
  }

  function decodeBytes(bytes) {
    let encoding = 'utf-8';
    if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) encoding = 'utf-8';
    else if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) encoding = 'utf-16le';
    else if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) encoding = 'utf-16be';
    else {
      // BOM-less UTF-16: ASCII text stored in UTF-16 has a NUL byte in every
      // other position. If that pattern dominates the buffer, it's UTF-16.
      const sample = Math.min(bytes.length, 2048);
      let nulls = 0;
      for (let i = 0; i < sample; i++) if (bytes[i] === 0) nulls++;
      if (sample > 8 && nulls > sample * 0.3) {
        encoding = bytes[0] === 0 ? 'utf-16be' : 'utf-16le';
      }
    }
    try {
      return new TextDecoder(encoding).decode(bytes).replace(/^\uFEFF/, '');
    } catch {
      return new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
    }
  }

  async function handleFile(f) {
    if (!f) return;
    const ext = f.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      toast(
        currentUiLang === 'ckb' ? 'فایلەکە پشتیوانی نەکراوە.' : 'Unsupported file format',
        true,
        currentUiLang === 'ckb' ? 'تکایە فایلی .SRT, .VTT, .ASS, .SSA, .SUB یان .SMI هەڵبژێرە.' : 'Use .SRT, .VTT, .ASS, .SSA, .SUB or .SMI'
      );
      return;
    }

    let text;
    try { text = await readFileAsText(f); }
    catch { toast(currentUiLang === 'ckb' ? 'خوێندنەوەی فایلەکە سەرکەوتوو نەبوو.' : 'Failed to read file.', true); return; }

    let parsedFile;
    try { parsedFile = SubParser.parse(text); }
    catch { toast(currentUiLang === 'ckb' ? 'هیچ ژێرنووسێک نەدۆزرایەوە.' : 'Could not detect subtitle content.', true); return; }
    if (!parsedFile.cues.length) { toast(currentUiLang === 'ckb' ? 'هیچ دێڕێکی ژێرنووس نییە.' : 'No subtitles found in file.', true); return; }

    file = f;
    parsed = parsedFile;
    isDemoLoaded = false;
    resultText = null;
    if (resultUrl) { URL.revokeObjectURL(resultUrl); resultUrl = null; }
    els.fileName.textContent = f.name;
    els.fileMeta.textContent = `${parsed.cues.length} lines • ${formatSize(f.size)} • ${LABEL[parsed.format] || parsed.format.toUpperCase()}`;
    updateCues(parsed.cues);

    if (typeof Toast !== 'undefined') {
      Toast.success(
        currentUiLang === 'ckb' ? 'فایلەکە بە سەرکەوتوویی بارکرا!' : 'File loaded successfully!',
        `${f.name} (${parsed.cues.length} lines) · ${LABEL[parsed.format] || parsed.format.toUpperCase()}`,
        currentUiLang === 'ckb' ? 'وەرگێڕان' : 'Translate Now',
        () => startTranslation()
      );
    }

    // Show the options first so the user picks settings before translating.
    showStep('settings');
  }

  function bindDropzone() {
    let dragCounter = 0;
    els.dropzone.addEventListener('click', () => els.fileInput.click());
    els.fileInput.addEventListener('change', (e) => { handleFile(e.target.files[0]); e.target.value = ''; });

    // Dropzone highlight
    ['dragenter', 'dragover'].forEach((ev) =>
      els.dropzone.addEventListener(ev, (e) => { e.preventDefault(); els.dropzone.classList.add('dragover'); })
    );
    ['dragleave', 'drop'].forEach((ev) =>
      els.dropzone.addEventListener(ev, (e) => { e.preventDefault(); els.dropzone.classList.remove('dragover'); })
    );
    els.dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation(); // avoid double-handling via the document-level drop
      dragCounter = 0;
      document.body.classList.remove('page-dropping');
      handleFile(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]);
    });
    els.dropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); els.fileInput.click(); }
    });

    els.changeFile.addEventListener('click', () => { els.fileInput.value = ''; els.fileInput.click(); });

    // Whole-page drop target: accept a file dropped anywhere on the page.
    document.addEventListener('dragenter', (e) => {
      if (hasFiles(e)) { e.preventDefault(); dragCounter++; document.body.classList.add('page-dropping'); }
    });
    document.addEventListener('dragover', (e) => {
      if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }
    });
    document.addEventListener('dragleave', () => {
      dragCounter = Math.max(0, dragCounter - 1);
      if (dragCounter === 0) document.body.classList.remove('page-dropping');
    });
    document.addEventListener('drop', (e) => {
      e.preventDefault();
      dragCounter = 0;
      document.body.classList.remove('page-dropping');
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      handleFile(f);
    });
  }

  function hasFiles(e) {
    return !!(e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files'));
  }

  // ---------- Translation ----------
  async function startTranslation() {
    if (!parsed) return;
    cancelFlag = false;
    showStep('progress');
    els.cancelBtn.classList.remove('hidden');
    els.translateBtn.disabled = true;
    setProgress(0, 'Preparing…');
    els.lineCount.textContent = `${parsed.cues.length} lines`;

    if (typeof Toast !== 'undefined') {
      Toast.show(
        currentUiLang === 'ckb' ? '⚡ وەرگێڕان دەستی پێکرد!' : '⚡ Translation started!',
        'translating',
        { subtext: currentUiLang === 'ckb' ? 'تکایە چاوەڕێ بکە... وەرگێڕانی کوردی لە ئارادایە' : 'Google AI is translating your subtitles to Kurdish Sorani...' }
      );
    }

    const srcLang = els.srcLang.value;
    const tgtLang = els.tgtLang.value;
    const includeOriginal = els.includeOriginal.checked;
    const accuracy = els.accuracyToggle.checked;
    const kurdishDigits = els.kurdishDigitsToggle ? els.kurdishDigitsToggle.checked : false;
    const isAss = parsed.format === 'ass' || parsed.format === 'ssa';
    const normalize = (c) => (isAss ? c.text.replace(/\\N/g, '\n') : c.text);
    const controller = new AbortController();
    activeController = controller;

    let lastToastPct = 0;

    try {
      const lines = parsed.cues.map(normalize);
      liveSource = lines;
      liveOrder = lines.map((l, i) => (l && l.trim() ? i : -1)).filter((i) => i >= 0);
      liveDone = 0;
      liveItems = [];
      cachedLiveTexts = null;
      els.liveCaption.classList.add('hidden');
      els.livePlaceholder.classList.remove('hidden');
      els.liveFeed.innerHTML = '';
      const translated = await Translator.translateLines(lines, srcLang, tgtLang, (p, done, total) => {
        if (cancelFlag) return;
        setProgress(p, `Translated ${done} / ${total} lines`);
      }, controller.signal, { accuracy, kurdishDigits, onBatch: (results, done) => { if (!cancelFlag) renderLive(results, done); } });
      if (cancelFlag) return; // cancelled mid-run: discard results, stay on settings

      const translatedCues = parsed.cues.map((c, i) => {
        const tr = translated[i] && translated[i].trim() ? translated[i].trim() : null;
        // "Include original" stacks the source line above the translation.
        if (includeOriginal && tr && tr !== c.text) return { ...c, text: `${c.text}\n${tr}` };
        return { ...c, text: tr || c.text };
      });

      let finalCues = els.keepOnly.checked
        ? translatedCues.filter((c) => c.text.trim() !== '')
        : translatedCues;
      // Renumber after filtering so player + editor indexes stay in sync.
      finalCues.forEach((c, i) => { c.index = i + 1; });

      updateCues(finalCues);
      showStep('done');

      if (typeof Toast !== 'undefined') {
        Toast.success(
          currentUiLang === 'ckb' ? '🎉 وەرگێڕانەکە بە سەرکەوتوویی تەواو بوو!' : '🎉 Translation Complete!',
          currentUiLang === 'ckb' ? 'ژێرنووسەکەت بە زمانی کوردی ئامادەیە. دەتوانیت دابەزێنیت یان لە پیشاندانی ڕاستەوخۆ تەماشای بکەیت.' : 'Your Kurdish Sorani subtitle is ready. Download it or preview live.',
          currentUiLang === 'ckb' ? 'تەماشاکردن' : 'Preview Subtitles',
          () => switchTab('preview')
        );
      }
    } catch (err) {
      if (cancelFlag) return; // aborted by the user, already handled
      console.error(err);
      if (err && err.partial && err.results) {
        // Some lines failed but we have results — show them with a warning.
        const translated = err.results;
        const translatedCues = parsed.cues.map((c, i) => {
          const tr = translated[i] && translated[i].trim() ? translated[i].trim() : null;
          if (includeOriginal && tr && tr !== c.text) return { ...c, text: `${c.text}\n${tr}` };
          return { ...c, text: tr || c.text };
        });
        let finalCues = els.keepOnly.checked
          ? translatedCues.filter((c) => c.text.trim() !== '')
          : translatedCues;
        finalCues.forEach((c, i) => { c.index = i + 1; });
        updateCues(finalCues);
        showStep('done');
        toast(
          currentUiLang === 'ckb' ? 'بەشێک لە دێڕەکان وەرنەگێڕدران' : 'Partial translation complete',
          true,
          `${err.failedCount} line(s) couldn't be translated and were kept as original.`
        );
        return;
      }
      toast(
        currentUiLang === 'ckb' ? 'وەرگێڕانەکە سەرکەوتوو نەبوو' : 'Translation failed',
        true,
        currentUiLang === 'ckb' ? 'تكایە پەیوەندی هێڵەکەت بپشکنە و دووبارە هەوڵبدەرەوە.' : 'Check your internet connection and click Try Again.',
        {
          actionLabel: currentUiLang === 'ckb' ? 'دووبارە هەوڵبدەرەوە' : 'Try Again',
          onAction: () => startTranslation()
        }
      );
      showStep('settings');
    } finally {
      activeController = null;
      els.translateBtn.disabled = false;
    }
  }

  function prepareDownload() {
    if (!parsed || !file) return;
    // Edits are included in the output only when "Save edits" is on.
    const cues = els.saveEditsToggle.checked ? workCues : baseCues;

    // Determine chosen export format
    const formatChoice = els.exportFormatSel ? els.exportFormatSel.value : 'original';
    const chosenFormat = formatChoice === 'original' ? parsed.format : formatChoice;
    const parseObj = chosenFormat === parsed.format ? parsed : { ...parsed, format: chosenFormat };

    let text = SubParser.serialize(parseObj, cues);

    // Apply CRLF line endings if checked
    const useCrlf = els.crlfToggle ? els.crlfToggle.checked : false;
    if (useCrlf) {
      text = text.replace(/\r?\n/g, '\r\n');
    }

    // Apply UTF-8 BOM if toggle is checked
    const useBom = els.addBomToggle ? els.addBomToggle.checked : false;
    if (useBom && !text.startsWith('\uFEFF')) {
      text = '\uFEFF' + text;
    }
    resultText = text;

    if (resultUrl) URL.revokeObjectURL(resultUrl);
    const mime = MIME_BY_FORMAT[chosenFormat] || 'text/plain;charset=utf-8';
    const blob = new Blob([resultText], { type: mime });
    resultUrl = URL.createObjectURL(blob);

    const ext = EXT_BY_FORMAT[chosenFormat] || 'srt';
    const base = file.name.replace(/\.[^.]+$/, '');
    els.downloadBtn.href = resultUrl;
    const tgt = (els.tgtLang && els.tgtLang.value) || 'ckb';
    els.downloadBtn.download = `${base}.${tgt}.${ext}`;
    els.doneFormat.textContent = LABEL[chosenFormat] || chosenFormat.toUpperCase();
    // Report the real file size (UTF-8 bytes), not the string's char count,
    // so it matches what actually downloads.
    els.doneSize.textContent = formatSize(blob.size);

    if (els.edDownloadBtn) {
      els.edDownloadBtn.href = resultUrl;
      els.edDownloadBtn.download = `${base}.${tgt}.${ext}`;
      els.edDownloadBtn.style.display = 'inline-flex';
    }
  }

  function updateAdvBadge() {
    if (!els.advActiveBadge) return;
    let count = 0;
    if (els.addBomToggle && els.addBomToggle.checked) count++;
    if (els.crlfToggle && els.crlfToggle.checked) count++;
    els.advActiveBadge.textContent = String(count);
    if (count > 0) {
      els.advActiveBadge.classList.add('active');
    } else {
      els.advActiveBadge.classList.remove('active');
    }
  }

  // ---------- Wire up ----------
  function bindActions() {
    els.translateBtn.addEventListener('click', startTranslation);

    if (els.langToggleBtn) {
      els.langToggleBtn.addEventListener('click', () => {
        applyLanguage(currentUiLang === 'en' ? 'ckb' : 'en');
      });
    }

    if (els.includeOriginal) {
      els.includeOriginal.addEventListener('change', () => {
        store.set('includeOriginal', els.includeOriginal.checked ? '1' : '0');
        updateAdvBadge();
        prepareDownload();
      });
    }

    if (els.accuracyToggle) {
      els.accuracyToggle.addEventListener('change', () => {
        store.set('accuracy', els.accuracyToggle.checked ? '1' : '0');
        updateAdvBadge();
        prepareDownload();
      });
    }

    if (els.keepOnly) {
      els.keepOnly.addEventListener('change', () => {
        store.set('keepOnly', els.keepOnly.checked ? '1' : '0');
        updateAdvBadge();
        prepareDownload();
      });
    }

    if (els.kurdishDigitsToggle) {
      els.kurdishDigitsToggle.addEventListener('change', () => {
        store.set('kurdishDigits', els.kurdishDigitsToggle.checked ? '1' : '0');
        updateAdvBadge();
        prepareDownload();
      });
    }

    if (els.addBomToggle) {
      els.addBomToggle.addEventListener('change', () => {
        store.set('addBom', els.addBomToggle.checked ? '1' : '0');
        updateAdvBadge();
        prepareDownload();
      });
    }

    if (els.crlfToggle) {
      els.crlfToggle.addEventListener('change', () => {
        store.set('useCrlf', els.crlfToggle.checked ? '1' : '0');
        updateAdvBadge();
        prepareDownload();
      });
    }

    if (els.openAdvModalBtn && els.advModalBackdrop) {
      els.openAdvModalBtn.addEventListener('click', () => {
        els.advModalBackdrop.classList.remove('hidden');
      });
    }

    const closeAdvModal = () => {
      if (els.advModalBackdrop) els.advModalBackdrop.classList.add('hidden');
    };

    if (els.closeAdvModalBtn) els.closeAdvModalBtn.addEventListener('click', closeAdvModal);
    if (els.doneAdvModalBtn) els.doneAdvModalBtn.addEventListener('click', closeAdvModal);

    if (els.advModalBackdrop) {
      els.advModalBackdrop.addEventListener('click', (e) => {
        if (e.target === els.advModalBackdrop) closeAdvModal();
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && els.advModalBackdrop && !els.advModalBackdrop.classList.contains('hidden')) {
        closeAdvModal();
      }
    });

    if (els.exportFormatSel) {
      els.exportFormatSel.addEventListener('change', () => {
        prepareDownload();
      });
    }

    if (els.undoBtn) els.undoBtn.addEventListener('click', performUndo);
    if (els.redoBtn) els.redoBtn.addEventListener('click', performRedo);

    if (els.skipBackBtn) els.skipBackBtn.addEventListener('click', () => SubtitlePlayer.seek(SubtitlePlayer.position - 5000));
    if (els.skipForwardBtn) els.skipForwardBtn.addEventListener('click', () => SubtitlePlayer.seek(SubtitlePlayer.position + 5000));
    if (els.fontSizeSel) {
      els.fontSizeSel.addEventListener('change', (e) => {
        const val = e.target.value;
        SubtitlePlayer.setFontScale(val);
        if (els.fsFontSizeSel) els.fsFontSizeSel.value = val;
        fitFsText();
      });
    }

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        if (activeTag !== 'input' && activeTag !== 'textarea') {
          e.preventDefault();
          performUndo();
        }
      } else if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        if (activeTag !== 'input' && activeTag !== 'textarea') {
          e.preventDefault();
          performRedo();
        }
      }
    });

    let rowInitialText = '';

    // ⚡ Bolt: Event delegation for subtitle editor list to avoid O(N) event listeners.
    // We attach unified handlers on the container instead of separate handlers on each row.
    els.editorList.addEventListener('input', (e) => {
      const input = e.target;
      if (!input || !input.classList.contains('ed-input')) return;
      const row = input.closest('.ed-row');
      if (!row) return;
      const i = parseInt(row.dataset.index, 10);
      autoGrow(input);
      applyCueEdit(i, input.value);
    });

    els.editorList.addEventListener('focusin', (e) => {
      const input = e.target;
      if (!input || !input.classList.contains('ed-input')) return;
      const row = input.closest('.ed-row');
      if (!row) return;
      rowInitialText = input.value;
      row.classList.add('editing');
      if (els.syncVideoToggle && els.syncVideoToggle.checked) {
        const i = parseInt(row.dataset.index, 10);
        const c = workCues[i];
        if (c) {
          SubtitlePlayer.seek(c.start);
          editWasPlaying = SubtitlePlayer.playing;
          SubtitlePlayer.pause();
        }
      }
    });

    els.editorList.addEventListener('focusout', (e) => {
      const input = e.target;
      if (!input || !input.classList.contains('ed-input')) return;
      const row = input.closest('.ed-row');
      if (!row) return;
      row.classList.remove('editing');
      const i = parseInt(row.dataset.index, 10);
      if (input.value !== rowInitialText) {
        pushUndoState();
      }
      if (els.syncVideoToggle && els.syncVideoToggle.checked && editWasPlaying) {
        SubtitlePlayer.play();
      }
      editWasPlaying = false;
    });

    els.editorList.addEventListener('scroll', () => {
      userIsScrolling = true;
      clearTimeout(userScrollTimer);
      userScrollTimer = setTimeout(() => {
        userIsScrolling = false;
      }, 3000);
    }, { passive: true });

    els.editorList.addEventListener('click', (e) => {
      if (e.target.closest('.ed-input')) return;
      const row = e.target.closest('.ed-row');
      if (!row) return;
      const i = parseInt(row.dataset.index, 10);
      const c = workCues[i];
      if (!c) return;
      if (els.syncVideoToggle && els.syncVideoToggle.checked) {
        SubtitlePlayer.seek(c.start);
        if (!SubtitlePlayer.playing) SubtitlePlayer.play();
      }
    });

    els.editorList.addEventListener('keydown', (e) => {
      const input = e.target;
      if (!input || !input.classList.contains('ed-input')) return;
      if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        input.blur();
      }
    });

    if (els.edSearchInput) {
      els.edSearchInput.addEventListener('input', filterEditor);
    }
    if (els.edSearchClearBtn) {
      els.edSearchClearBtn.addEventListener('click', () => {
        if (els.edSearchInput) {
          els.edSearchInput.value = '';
          filterEditor();
          els.edSearchInput.focus();
        }
      });
    }

    // Safari iOS ignores the `download` attribute for blob: URLs and saves
    // the file as .txt. Subtitle text is small, so swap to a data: URL on
    // iOS (within the click gesture) where the filename is honored.
    els.downloadBtn.addEventListener('click', () => {
      if (!resultText || !parsed) return;
      if (isIOS) {
        const formatChoice = els.exportFormatSel ? els.exportFormatSel.value : 'original';
        const chosenFormat = formatChoice === 'original' ? parsed.format : formatChoice;
        const mime = MIME_BY_FORMAT[chosenFormat] || 'text/plain;charset=utf-8';
        els.downloadBtn.href = `data:${mime},${encodeURIComponent(resultText)}`;
      }
      els.downloadBtn.classList.add('downloading');
      const textSpan = els.downloadBtn.querySelector('[data-i18n="btnDownload"]');
      const dict = dicts[currentUiLang] || dicts.en;
      if (textSpan) textSpan.textContent = dict.btnDownloaded || '✓ Saved!';
      if (typeof Toast !== 'undefined') {
        Toast.success(
          currentUiLang === 'ckb' ? 'فایلەکە دابەزێنرا!' : 'File downloaded!',
          currentUiLang === 'ckb' ? 'ژێرنووسە کوردییەکەت بە سەرکەوتوویی پاشەکەوت کرا.' : 'Kurdish subtitle file saved successfully.'
        );
      } else {
        toast(currentUiLang === 'ckb' ? 'فایلەکە بە سەرکەوتوویی دابەزێنرا!' : 'File saved successfully!');
      }
      setTimeout(() => {
        els.downloadBtn.classList.remove('downloading');
        if (textSpan) textSpan.textContent = dict.btnDownload || 'Download';
      }, 2500);
    });

    if (els.edDownloadBtn) {
      els.edDownloadBtn.addEventListener('click', () => {
        if (!resultText || !parsed) return;
        if (isIOS) {
          const formatChoice = els.exportFormatSel ? els.exportFormatSel.value : 'original';
          const chosenFormat = formatChoice === 'original' ? parsed.format : formatChoice;
          const mime = MIME_BY_FORMAT[chosenFormat] || 'text/plain;charset=utf-8';
          els.edDownloadBtn.href = `data:${mime},${encodeURIComponent(resultText)}`;
        }
        if (typeof Toast !== 'undefined') {
          Toast.success(
            currentUiLang === 'ckb' ? 'فایلەکە دابەزێنرا!' : 'File downloaded!',
            currentUiLang === 'ckb' ? 'ژێرنووسە کوردییەکەت بە سەرکەوتوویی پاشەکەوت کرا.' : 'Kurdish subtitle file saved successfully.'
          );
        } else {
          toast(currentUiLang === 'ckb' ? 'فایلەکە بە سەرکەوتوویی دابەزێنرا!' : 'File saved successfully!');
        }
      });
    }

    els.cancelBtn.addEventListener('click', () => {
      cancelFlag = true;
      if (activeController) activeController.abort();
      if (typeof Toast !== 'undefined') {
        Toast.show(
          currentUiLang === 'ckb' ? 'وەرگێڕانەکە هەڵوەشێنرایەوە' : 'Translation cancelled',
          'info',
          { subtext: currentUiLang === 'ckb' ? 'دەتوانیت ڕێکخستنەکان بگوڕیت و هەركات ئارەزووت کرد دەستپێبکەیتەوە.' : 'You can adjust settings and try again whenever you are ready.' }
        );
      } else {
        toast(currentUiLang === 'ckb' ? 'پەشیمان بوویتەوە.' : 'Cancelled.');
      }
      showStep('settings');
    });

    els.copyBtn.addEventListener('click', async () => {
      if (!resultText) { toast(currentUiLang === 'ckb' ? 'هیچ دەقێک نییە بۆ کۆپیکردن.' : 'Nothing to copy yet.', true); return; }
      try {
        await navigator.clipboard.writeText(resultText);
        if (typeof Toast !== 'undefined') {
          Toast.success(
            currentUiLang === 'ckb' ? 'کۆپی کرا بۆ کلیپبۆرد!' : 'Copied to clipboard!',
            currentUiLang === 'ckb' ? 'دەقی ژێرنووسەکە ئامادەیە بۆ بەکارهێنان.' : 'Subtitle text is ready to paste anywhere.'
          );
        } else {
          toast(currentUiLang === 'ckb' ? 'کۆپی کرا بۆ کلیپبۆرد!' : 'Copied to clipboard!');
        }
        const textSpan = els.copyBtn.querySelector('[data-i18n="btnCopy"]');
        const dict = dicts[currentUiLang] || dicts.en;
        if (textSpan) textSpan.textContent = dict.btnCopied || '✓ Copied!';
        els.copyBtn.classList.add('copied');
        clearTimeout(copyTimer);
        copyTimer = setTimeout(() => {
          if (textSpan) textSpan.textContent = dict.btnCopy || 'Copy to clipboard';
          els.copyBtn.classList.remove('copied');
        }, 2200);
      } catch {
        toast(currentUiLang === 'ckb' ? 'کۆپیکردن سەرکەوتوو نەبوو.' : 'Copy failed on this device.', true);
      }
    });

    els.translateAgainBtn.addEventListener('click', () => {
      if (!parsed) return;
      if (resultUrl) { URL.revokeObjectURL(resultUrl); resultUrl = null; }
      resultText = null;
      updateCues(parsed.cues); // revert preview + editor to the original text
      showStep('settings');
    });

    els.previewBtn.addEventListener('click', () => switchTab('preview'));

    // Editor toggles.
    els.showTimeToggle.addEventListener('change', () => {
      store.set('showTime', els.showTimeToggle.checked ? '1' : '0');
      document.querySelectorAll('.ed-time').forEach((t) => t.classList.toggle('hidden', !els.showTimeToggle.checked));
    });

    els.saveEditsToggle.addEventListener('change', () => {
      store.set('saveEdits', els.saveEditsToggle.checked ? '1' : '0');
      prepareDownload();
      updateStatus();
    });

    if (els.syncVideoToggle) {
      els.syncVideoToggle.addEventListener('change', () => {
        store.set('syncVideo', els.syncVideoToggle.checked ? '1' : '0');
      });
    }

    els.srcLang.addEventListener('change', () => store.set('srcLang', els.srcLang.value));
  }

  // ---------- Welcome Tour System with Live Preview Demo ----------
  let currentTourStep = 0;
  let isTourOpen = false;
  let isDemoLoaded = false;

  const DEMO_CUES = [
    { index: 1, start: 800, end: 4200, text: 'Welcome to Kurdish Subtitle Translator!\nبەخێربێن بۆ وەرگێڕی ژێرنووسی کوردی!' },
    { index: 2, start: 4700, end: 8800, text: 'Translate SRT, VTT, ASS, SSA, SUB & SAMI to Kurdish Sorani.\nوەرگێڕانی هەموو جۆرەکانی ژێرنووس بۆ زمانی کوردی سۆرانی.' },
    { index: 3, start: 9300, end: 13800, text: 'Live subtitle player synced with real-time playback.\nپێشاندەری ژێرنووس بە کاتی ڕاستەقینە و هاوکات لەگەڵ مۆڵەتەکان.' },
    { index: 4, start: 14300, end: 19000, text: 'Type to edit cues live, search lines instantly, and download anytime!\nدەستکاری دەقەکان بکە بە ڕاستەوخۆ و بە ئاسانی پاشەکەوتی بکە!' }
  ];

  function loadDemoForTour() {
    isDemoLoaded = true;
    parsed = { format: 'srt', cues: DEMO_CUES.map((c) => ({ ...c })) };
    file = { name: 'demo_movie_subtitles.srt', size: 1420 };
    updateCues(DEMO_CUES);
    showStep('done');
  }

  const TOUR_STEPS = [
    {
      targetSel: '#dropzone',
      titleKey: 'tourStep1Title',
      textKey: 'tourStep1Text',
      badge: '1 / 4',
      showPrev: false,
      nextKey: 'tourNext',
      ensureTab: 'translate',
      onEnter: () => {
        showStep('upload');
        switchTab('translate');
      }
    },
    {
      targetSel: '#stepSettings',
      titleKey: 'tourStep2Title',
      textKey: 'tourStep2Text',
      badge: '2 / 4',
      showPrev: true,
      nextKey: 'tourNext',
      ensureTab: 'translate',
      onEnter: () => {
        if (!parsed) {
          parsed = { format: 'srt', cues: DEMO_CUES.map((c) => ({ ...c })) };
          file = { name: 'demo_movie.srt', size: 1420 };
          els.fileName.textContent = 'demo_movie.srt';
          els.fileMeta.textContent = '4 lines • 1.4 KB • SRT';
          updateCues(DEMO_CUES);
        }
        showStep('settings');
        switchTab('translate');
      }
    },
    {
      targetSel: '.player-card',
      titleKey: 'tourStep3Title',
      textKey: 'tourStep3Text',
      badge: '3 / 4',
      showPrev: true,
      nextKey: 'tourNext',
      ensureTab: 'preview',
      onEnter: () => {
        loadDemoForTour();
        SubtitlePlayer.seek(0);
        SubtitlePlayer.play();
      }
    },
    {
      targetSel: '.editor-card',
      titleKey: 'tourStep4Title',
      textKey: 'tourStep4Text',
      badge: '4 / 4',
      showPrev: true,
      nextKey: 'tourDone',
      ensureTab: 'preview',
      onEnter: () => {
        if (!parsed) loadDemoForTour();
        switchTab('preview');
      }
    }
  ];

  function openTour(stepIndex = 0) {
    if (!els.tourOverlay) return;
    currentTourStep = stepIndex;
    isTourOpen = true;
    els.tourOverlay.classList.remove('hidden');
    els.tourOverlay.setAttribute('aria-hidden', 'false');
    renderTourStep(currentTourStep);
    window.addEventListener('resize', handleTourReposition);
    window.addEventListener('scroll', handleTourReposition, { passive: true });
    window.addEventListener('keydown', handleTourKeydown);
  }

  function closeTour(markSeen = true) {
    if (!els.tourOverlay) return;
    isTourOpen = false;
    els.tourOverlay.classList.add('hidden');
    els.tourOverlay.setAttribute('aria-hidden', 'true');
    window.removeEventListener('resize', handleTourReposition);
    window.removeEventListener('scroll', handleTourReposition);
    window.removeEventListener('keydown', handleTourKeydown);
    if (markSeen) {
      store.set('kurdish_tour_seen', '1');
    }
    
    // Always reset the app state when closing the tour
    file = null;
    parsed = null;
    isDemoLoaded = false;
    baseCues = null;
    workCues = null;
    undoStack = [];
    redoStack = [];
    lastCommittedState = '';
    dirty = false;
    activeIdx = -1;
    
    if (els.fileInput) els.fileInput.value = '';
    if (els.fileName) els.fileName.textContent = '';
    if (els.editorList) els.editorList.innerHTML = '';
    buildEditor();
    
    SubtitlePlayer.pause();
    SubtitlePlayer.seek(0);
    SubtitlePlayer.load([]); // Call load directly to avoid loadPreview enabling the tab
    if (els.previewTab) els.previewTab.classList.add('disabled');
    
    showStep('upload');
    switchTab('translate');
    
    resultText = null;
    if (resultUrl) { URL.revokeObjectURL(resultUrl); resultUrl = null; }
    
    updateUndoRedoUI();
    checkEditsState();
  }

  function renderTourStep(index) {
    if (index < 0 || index >= TOUR_STEPS.length) {
      closeTour(true);
      return;
    }
    currentTourStep = index;
    const step = TOUR_STEPS[index];

    if (step.ensureTab) {
      if (step.ensureTab === 'preview' && !parsed) {
        loadDemoForTour();
      }
      switchTab(step.ensureTab);
    }

    if (step.onEnter) {
      step.onEnter();
    }

    const dict = dicts[currentUiLang] || dicts.en;
    if (els.tourTitle) els.tourTitle.textContent = dict[step.titleKey] || '';
    if (els.tourText) els.tourText.textContent = dict[step.textKey] || '';
    if (els.tourStepBadge) els.tourStepBadge.textContent = step.badge;
    if (els.tourPrevBtn) {
      els.tourPrevBtn.classList.toggle('hidden', !step.showPrev);
      els.tourPrevBtn.textContent = dict.tourPrev || 'Back';
    }
    if (els.tourNextBtn) {
      els.tourNextBtn.textContent = dict[step.nextKey] || (index === TOUR_STEPS.length - 1 ? 'Got it!' : 'Next');
    }
    if (els.tourSkipBtn) {
      els.tourSkipBtn.textContent = dict.tourSkip || 'Skip tour';
    }

    setTimeout(() => {
      positionTourElements(step.targetSel);
    }, 70);
  }

  function positionTourElements(targetSel) {
    const target = $(targetSel);
    if (!target || !els.tourHighlight || !els.tourCard) return;

    const rect = target.getBoundingClientRect();
    const isOutOfView = rect.top < 60 || rect.bottom > (window.innerHeight - 60);
    if (isOutOfView) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => updateTourGeometry(target), 200);
    } else {
      updateTourGeometry(target);
    }
  }

  function updateTourGeometry(target) {
    if (!target || !els.tourHighlight || !els.tourCard) return;
    const rect = target.getBoundingClientRect();
    const pad = 6;
    const isMobile = window.innerWidth <= 640;

    els.tourHighlight.style.top = `${Math.max(0, rect.top - pad)}px`;
    els.tourHighlight.style.left = `${Math.max(0, rect.left - pad)}px`;
    els.tourHighlight.style.width = `${rect.width + pad * 2}px`;
    els.tourHighlight.style.height = `${rect.height + pad * 2}px`;

    if (!isMobile) {
      const cardWidth = 350;
      const cardHeight = els.tourCard.offsetHeight || 190;

      let top = rect.bottom + 14;
      let left = rect.left + (rect.width / 2) - (cardWidth / 2);

      if (top + cardHeight > window.innerHeight - 16) {
        top = Math.max(16, rect.top - cardHeight - 14);
      }

      left = Math.max(16, Math.min(window.innerWidth - cardWidth - 16, left));

      els.tourCard.style.top = `${top}px`;
      els.tourCard.style.left = `${left}px`;
      els.tourCard.style.bottom = 'auto';
      els.tourCard.style.right = 'auto';
    }
  }

  function handleTourReposition() {
    if (!isTourOpen) return;
    const step = TOUR_STEPS[currentTourStep];
    if (step) {
      const target = $(step.targetSel);
      if (target) updateTourGeometry(target);
    }
  }

  function handleTourKeydown(e) {
    if (!isTourOpen) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeTour(true);
    } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
      if (currentTourStep < TOUR_STEPS.length - 1) {
        renderTourStep(currentTourStep + 1);
      } else {
        closeTour(true);
      }
    } else if (e.key === 'ArrowLeft') {
      if (currentTourStep > 0) {
        renderTourStep(currentTourStep - 1);
      }
    }
  }

  function bindTour() {
    if (els.tourTriggerBtn) {
      els.tourTriggerBtn.addEventListener('click', () => {
        openTour(0);
      });
    }
    if (els.tourCloseBtn) {
      els.tourCloseBtn.addEventListener('click', () => closeTour(true));
    }
    if (els.tourSkipBtn) {
      els.tourSkipBtn.addEventListener('click', () => closeTour(true));
    }
    if (els.tourBackdrop) {
      els.tourBackdrop.addEventListener('click', () => closeTour(true));
    }
    if (els.tourPrevBtn) {
      els.tourPrevBtn.addEventListener('click', () => {
        if (currentTourStep > 0) {
          renderTourStep(currentTourStep - 1);
        }
      });
    }
    if (els.tourNextBtn) {
      els.tourNextBtn.addEventListener('click', () => {
        if (currentTourStep < TOUR_STEPS.length - 1) {
          renderTourStep(currentTourStep + 1);
        } else {
          closeTour(true);
        }
      });
    }
  }

  // ---------- Init ----------
  function init() {
    els.previewTab.classList.add('disabled'); // enabled once a file is loaded
    for (const [code, name] of Object.entries(SOURCE_LANGS)) {
      const o = document.createElement('option');
      o.value = code;
      o.textContent = name;
      els.srcLang.appendChild(o);
    }
    bindDropzone();
    bindActions();
    bindFs();
    bindTour();
    SubtitlePlayer.init();

    // PWA: register service worker for installability + offline app shell.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }

    // Warm the translation endpoint so the first real request isn't a cold one
    // (Google sometimes throttles the first hit and answers on a warm retry).
    Translator.warmup();

    // Show an Install button when the browser allows it (Android/desktop).
    let deferredInstall = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstall = e;
      els.installBtn.hidden = false;
    });
    els.installBtn.addEventListener('click', async () => {
      if (!deferredInstall) return;
      deferredInstall.prompt();
      await deferredInstall.userChoice;
      deferredInstall = null;
      els.installBtn.hidden = true;
    });

    els.srcLang.value = store.get('srcLang', 'auto');
    els.keepOnly.checked = store.get('keepOnly', '0') === '1';
    els.includeOriginal.checked = store.get('includeOriginal', '0') === '1';
    els.accuracyToggle.checked = store.get('accuracy', '0') === '1';
    if (els.kurdishDigitsToggle) els.kurdishDigitsToggle.checked = store.get('kurdishDigits', '0') === '1';
    if (els.addBomToggle) els.addBomToggle.checked = store.get('addBom', '0') === '1';
    if (els.crlfToggle) els.crlfToggle.checked = store.get('useCrlf', '0') === '1';
    els.showTimeToggle.checked = store.get('showTime', '1') === '1';
    els.saveEditsToggle.checked = store.get('saveEdits', '1') === '1';
    if (els.syncVideoToggle) els.syncVideoToggle.checked = store.get('syncVideo', '0') === '1';

    updateAdvBadge();

    // Apply initial UI language
    const savedLang = store.get('app_ui_lang', 'en');
    applyLanguage(savedLang);

    buildEditor();

    // Check first-time user and trigger tour gracefully
    if (!store.get('kurdish_tour_seen')) {
      setTimeout(() => {
        if (!file && !isTourOpen) {
          openTour(0);
        }
      }, 550);
    }

    // Handle mobile orientation changes and window resizing for responsive editor rows
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const inputs = els.editorList.querySelectorAll('.ed-input');
        inputs.forEach((input) => autoGrow(input));
        if (fsActive) fitFsText();
      }, 100);
    });
  }

  init();
})();
