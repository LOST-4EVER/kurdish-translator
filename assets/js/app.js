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
    kurdishDigitsToggle: '#kurdishDigitsToggle', fixOverlapToggle: '#fixOverlapToggle',
    addBomToggle: '#addBomToggle', crlfToggle: '#crlfToggle',
    openAdvModalBtn: '#openAdvModalBtn', closeAdvModalBtn: '#closeAdvModalBtn',
    doneAdvModalBtn: '#doneAdvModalBtn', advModalBackdrop: '#advModalBackdrop',
    advActiveBadge: '#advActiveBadge',
    edQualityCheckBtn: '#edQualityCheckBtn', edQualityBadge: '#edQualityBadge',
    qualityModalBackdrop: '#qualityModalBackdrop', qualityModalCard: '#qualityModalCard',
    closeQualityModalBtn: '#closeQualityModalBtn', doneQualityModalBtn: '#doneQualityModalBtn',
    qualityScoreVal: '#qualityScoreVal', qualityIssuesCount: '#qualityIssuesCount',
    qualityOverlapCount: '#qualityOverlapCount', qualityAdvancedCount: '#qualityAdvancedCount',
    fixAllQualityBtn: '#fixAllQualityBtn', fixOverlapsNowBtn: '#fixOverlapsNowBtn',
    qualityCategoryTabs: '#qualityCategoryTabs', qualitySearchInput: '#qualitySearchInput',
    qualitySearchClear: '#qualitySearchClear',
    qTabAllCount: '#qTabAllCount', qTabOrthoCount: '#qTabOrthoCount',
    qTabPrefixCount: '#qTabPrefixCount', qTabTimingCount: '#qTabTimingCount',
    qTabIdiomsCount: '#qTabIdiomsCount',
    qualityIssuesList: '#qualityIssuesList',
    exportFormatSel: '#exportFormatSel', langToggleBtn: '#langToggleBtn',
    translateBtn: '#translateBtn',
    progressFill: '#progressFill', progressPct: '#progressPct', progressSpeed: '#progressSpeed',
    progressDetail: '#progressDetail', lineCount: '#lineCount', cancelBtn: '#cancelBtn',
    liveCaption: '#liveCaption', liveOrigCaption: '#liveOrigCaption', liveTimecode: '#liveTimecode',
    livePlaceholder: '#livePlaceholder', liveFeed: '#liveFeed',
    downloadBtn: '#downloadBtn', edDownloadBtn: '#edDownloadBtn', copyBtn: '#copyBtn',
    translateAgainBtn: '#translateAgainBtn', doneFormat: '#doneFormat', doneSize: '#doneSize',
    previewBtn: '#previewBtn',
    previewTab: '#previewTab', tabTranslate: '#tabTranslate', tabPreview: '#tabPreview',
    installBtn: '#installBtn',
    toast: '#toast',
    editorList: '#editorList', editorStatus: '#editorStatus',
    edSearchInput: '#edSearchInput', edSearchCount: '#edSearchCount', edSearchClearBtn: '#edSearchClearBtn',
    edSearchNav: '#edSearchNav', edSearchPrevBtn: '#edSearchPrevBtn', edSearchNextBtn: '#edSearchNextBtn',
    edCount: '#edCount', undoBtn: '#undoBtn', redoBtn: '#redoBtn',
    showTimeToggle: '#showTimeToggle', saveEditsToggle: '#saveEditsToggle',
    syncVideoToggle: '#syncVideoToggle',
    skipBackBtn: '#skipBackBtn', skipForwardBtn: '#skipForwardBtn',
    fontSizeSel: '#fontSizeSel', fsFontSizeSel: '#fsFontSizeSel',
    fsEdit: '#fsEdit', fsScreen: '#fsScreen', fsCueCount: '#fsCueCount',
    fsToggleBtn: '#fsToggleBtn', fsEditBtn: '#fsEditBtn', fsClose: '#fsClose',
    fsPrevBtn: '#fsPrevBtn', fsNextBtn: '#fsNextBtn',
    fsUndoBtn: '#fsUndoBtn', fsRedoBtn: '#fsRedoBtn',
    fsEdUndoBtn: '#fsEdUndoBtn', fsEdRedoBtn: '#fsEdRedoBtn',
    fsPlayBtn: '#fsPlayBtn', fsRestartBtn: '#fsRestartBtn', fsSpeedSel: '#fsSpeedSel',
    fsSkipBackBtn: '#fsSkipBackBtn', fsSkipForwardBtn: '#fsSkipForwardBtn',
    fsTimeline: '#fsTimeline', fsTlFill: '#fsTlFill', fsTlThumb: '#fsTlThumb', fsTlTooltip: '#fsTlTooltip',
    fsEditor: '#fsEditor', fsInput: '#fsInput', fsDoneBtn: '#fsDoneBtn', fsEdPolishBtn: '#fsEdPolishBtn',
    fsCharCount: '#fsCharCounter', fsPrevCueNavBtn: '#fsEdPrevCueBtn', fsNextCueNavBtn: '#fsEdNextCueBtn',
    fsRewindFeedback: '#fsRewindFeedback', fsForwardFeedback: '#fsForwardFeedback',
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

  function updateTourTriggerBtnState() {
    if (!els.tourTriggerBtn) return;
    const dict = dicts[currentUiLang] || dicts.en;
    if (file && !isDemoLoaded) {
      els.tourTriggerBtn.disabled = true;
      els.tourTriggerBtn.classList.add('disabled');
      els.tourTriggerBtn.title = dict.tourDisabledTitle || (currentUiLang === 'ckb' ? 'ڕێبەر بەردەست نییە کاتێک فایلەکەت بارکراوە' : 'Guide is disabled while your file is loaded');
    } else {
      els.tourTriggerBtn.disabled = false;
      els.tourTriggerBtn.classList.remove('disabled');
      els.tourTriggerBtn.title = dict.tourGuide || (currentUiLang === 'ckb' ? 'ڕێبەری بەکارهێنان' : 'Welcome Tour');
    }
  }

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

    updateTourTriggerBtnState();

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
  const getStepEl = (s) => els['step' + s[0].toUpperCase() + s.slice(1)] || $(`#step${s[0].toUpperCase() + s.slice(1)}`);

  function showStep(name) {
    STEPS.forEach((s) => {
      const stepEl = getStepEl(s);
      if (stepEl && stepEl.classList) stepEl.classList.add('hidden');
    });
    const target = getStepEl(name);
    if (target && target.classList) {
      target.classList.remove('hidden');
      target.style.animation = 'none';
      void target.offsetWidth; // trigger reflow for smooth re-entry animation
      target.style.animation = '';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setProgress(fraction, detail) {
    const pct = Math.round(fraction * 100);
    if (els.progressFill) els.progressFill.style.width = pct + '%';
    if (els.progressPct) els.progressPct.textContent = pct + '%';
    if (detail && els.progressDetail) els.progressDetail.textContent = detail;
  }

  const stripTags = (text) => text.replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, '');
  // ASS/SSA line breaks are stored as \N; render them as real newlines.
  const displayText = (text) => stripTags(text).replace(/\\N/g, '\n');
  const dirFor = (text) => (hasArabic(text) ? 'rtl' : 'ltr');

  /** Extract vertical and horizontal placement from subtitle tags or settings (ASS {\anX}, {\aX}, WebVTT line/align). */
  function getCuePlacement(cue, lineText) {
    if (!cue && !lineText) return { vAlign: 'bottom', hAlign: 'center' };
    const raw = lineText !== undefined ? String(lineText) : (cue ? (cue.rawText || cue.text || '') : '');
    const settings = (cue && cue.settings) || '';

    let vAlign = 'bottom';
    let hAlign = 'center';

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

    if (/align:(?:left|start)/i.test(settings)) hAlign = 'left';
    else if (/align:(?:right|end)/i.test(settings)) hAlign = 'right';
    else if (/align:(?:center|middle)/i.test(settings)) hAlign = 'center';

    return { vAlign, hAlign };
  }

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
      if (els.livePlaceholder) els.livePlaceholder.classList.add('hidden');

      const cue = parsed && parsed.cues ? parsed.cues[latestIdx] : null;

      // Render Original Source Line
      if (els.liveOrigCaption && cue) {
        const origText = liveSource[latestIdx] || cue.text || '';
        els.liveOrigCaption.textContent = displayText(origText);
        els.liveOrigCaption.classList.remove('hidden');
      }

      // Render Kurdish Translated Line
      if (els.liveCaption) {
        els.liveCaption.textContent = displayText(latest);
        els.liveCaption.setAttribute('dir', dirFor(latest));
        els.liveCaption.classList.remove('hidden');
        els.liveCaption.classList.remove('live-pop');
        void els.liveCaption.offsetWidth; // trigger reflow for animation restart
        els.liveCaption.classList.add('live-pop');
      }

      // Render Timecode Badge
      if (els.liveTimecode && cue) {
        const startStr = typeof SubParser !== 'undefined' ? SubParser.fmtSRT(cue.start) : '00:00';
        const endStr = typeof SubParser !== 'undefined' ? SubParser.fmtSRT(cue.end) : '00:00';
        els.liveTimecode.textContent = `${startStr} ➔ ${endStr}`;
      }
    }

    // Render Stream Feed Cards
    if (els.liveFeed) {
      els.liveFeed.innerHTML = '';
      const recentIndices = liveItems.slice(-6);
      const frag = document.createDocumentFragment();

      recentIndices.forEach((i) => {
        const cue = parsed && parsed.cues ? parsed.cues[i] : null;
        const card = document.createElement('div');
        card.className = 'live-feed-card';

        const head = document.createElement('div');
        head.className = 'live-feed-card-head';

        const numPill = document.createElement('span');
        numPill.className = 'live-feed-cue-num';
        numPill.textContent = `#${i + 1}`;

        const timePill = document.createElement('span');
        timePill.className = 'live-feed-cue-time';
        timePill.textContent = cue ? typeof SubParser !== 'undefined' ? SubParser.fmtSRT(cue.start) : '' : '';

        head.appendChild(numPill);
        if (timePill.textContent) head.appendChild(timePill);

        const origLine = document.createElement('div');
        origLine.className = 'live-feed-orig';
        origLine.textContent = displayText(liveSource[i] || (cue ? cue.text : ''));

        const kurdLine = document.createElement('div');
        kurdLine.className = 'live-feed-kurdish';
        kurdLine.setAttribute('dir', dirFor(results[i]));
        kurdLine.textContent = displayText(results[i]);

        card.appendChild(head);
        card.appendChild(origLine);
        card.appendChild(kurdLine);
        frag.appendChild(card);
      });

      els.liveFeed.appendChild(frag);
    }
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
    if (typeof Translator !== 'undefined' && Translator.normalizeForSearch) {
      workCues[i]._normText = Translator.normalizeForSearch(text);
    } else {
      workCues[i]._normText = (text || '').toLowerCase();
    }
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
    if (typeof SubtitlePlayer !== 'undefined' && SubtitlePlayer.load) {
      SubtitlePlayer.load(cues.map((c) => ({ ...c, text: displayText(c.text), rawText: c.text, settings: c.settings || '' })));
    }
    if (els.previewTab) els.previewTab.classList.remove('disabled');
  }

  // ---------- Subtitle editor ----------
  function autoGrow(el) {
    if (!el || el.scrollHeight === 0) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  function updateStatus() {
    if (!els.editorStatus) return;
    const saveEditsChecked = els.saveEditsToggle ? els.saveEditsToggle.checked : true;
    els.editorStatus.textContent = dirty
      ? (saveEditsChecked ? 'Your edits will appear in the download' : 'Edits appear here only — not in the download')
      : 'Synced with the preview — edits apply live';
  }

  function buildEditor() {
    const list = els.editorList;
    if (!list) return;
    list.innerHTML = '';
    const showTime = els.showTimeToggle ? els.showTimeToggle.checked : true;

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
      const startStr = SubParser.fmtSRT(c.start);
      const endStr = SubParser.fmtSRT(c.end);
      time.innerHTML = `<span class="ed-time-start">${startStr}</span><span class="ed-time-sep">➔</span><span class="ed-time-end">${endStr}</span>`;
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

  let searchMatchIndices = [];
  let currentSearchMatchPos = -1;

  function updateSearchBadge(matchCount, currentPos) {
    const badge = els.edSearchCount;
    const nav = els.edSearchNav;
    if (!badge) return;

    if (matchCount === 0) {
      const zero = (currentUiLang === 'ckb' ? '٠' : '0');
      badge.textContent = zero;
      badge.classList.remove('hidden');
      if (nav) nav.classList.add('hidden');
      return;
    }

    const pos = currentPos >= 0 ? currentPos + 1 : 1;
    let label = `${pos} / ${matchCount}`;
    if (currentUiLang === 'ckb' || (els.kurdishDigitsToggle && els.kurdishDigitsToggle.checked)) {
      label = Translator.normalizeDigits(label);
    }
    badge.textContent = label;
    badge.classList.remove('hidden');
    if (nav) nav.classList.remove('hidden');
  }

  function goToSearchMatch(index, scroll = true) {
    if (!searchMatchIndices || searchMatchIndices.length === 0) return;
    currentSearchMatchPos = (index + searchMatchIndices.length) % searchMatchIndices.length;
    const cueIdx = searchMatchIndices[currentSearchMatchPos];

    if (rowEls) {
      rowEls.forEach((row, i) => {
        if (!row) return;
        if (i === cueIdx) {
          row.classList.add('search-current-match');
          if (scroll) {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        } else {
          row.classList.remove('search-current-match');
        }
      });
    }

    updateSearchBadge(searchMatchIndices.length, currentSearchMatchPos);

    if (els.syncVideoToggle && els.syncVideoToggle.checked && SubtitlePlayer && typeof SubtitlePlayer.seekToCue === 'function') {
      SubtitlePlayer.seekToCue(cueIdx);
    }
  }

  function nextSearchMatch() {
    if (searchMatchIndices.length === 0) return;
    goToSearchMatch(currentSearchMatchPos + 1);
  }

  function prevSearchMatch() {
    if (searchMatchIndices.length === 0) return;
    goToSearchMatch(currentSearchMatchPos - 1);
  }

  function filterEditor() {
    if (!els.edSearchInput) return;
    const rawQuery = els.edSearchInput.value.trim();
    const clearBtn = els.edSearchClearBtn;
    const countBadge = els.edSearchCount;
    const nav = els.edSearchNav;

    searchMatchIndices = [];
    currentSearchMatchPos = -1;

    if (!rawQuery) {
      if (clearBtn) clearBtn.classList.add('hidden');
      if (countBadge) countBadge.classList.add('hidden');
      if (nav) nav.classList.add('hidden');
      if (rowEls) {
        rowEls.forEach((row) => {
          if (row) {
            row.classList.remove('search-hidden', 'search-matched', 'search-current-match');
          }
        });
      }
      return;
    }

    if (clearBtn) clearBtn.classList.remove('hidden');

    const normQuery = typeof Translator !== 'undefined' && Translator.normalizeForSearch
      ? Translator.normalizeForSearch(rawQuery)
      : rawQuery.toLowerCase();
    const lowerQuery = rawQuery.toLowerCase();

    if (rowEls && workCues) {
      workCues.forEach((cue, i) => {
        const row = rowEls[i];
        if (!row) return;
        const text = cue.text || '';
        const normText = cue._normText !== undefined ? cue._normText : (
          typeof Translator !== 'undefined' && Translator.normalizeForSearch
            ? (cue._normText = Translator.normalizeForSearch(text))
            : text.toLowerCase()
        );
        const lowerText = text.toLowerCase();
        const time = `${SubParser.fmtSRT(cue.start)} ${SubParser.fmtSRT(cue.end)}`.toLowerCase();
        const cueNum = String(i + 1);

        const matches =
          normText.includes(normQuery) ||
          lowerText.includes(lowerQuery) ||
          time.includes(normQuery) ||
          time.includes(lowerQuery) ||
          cueNum === rawQuery ||
          `#${cueNum}` === rawQuery;

        if (matches) {
          searchMatchIndices.push(i);
          row.classList.remove('search-hidden');
          row.classList.add('search-matched');
        } else {
          row.classList.add('search-hidden');
          row.classList.remove('search-matched', 'search-current-match');
        }
      });
    }

    if (searchMatchIndices.length > 0) {
      goToSearchMatch(0, false);
    } else {
      updateSearchBadge(0, -1);
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
  if (typeof SubtitlePlayer !== 'undefined' && SubtitlePlayer.setCueCallback) {
    SubtitlePlayer.setCueCallback((cue, idx) => {
      activeIdx = idx;
      if (fsActive) {
        updateFsScreen();
        // Keep the fullscreen editor synced to the playing cue unless the user
        // is actively typing in it.
        if (els.fsEditor && !els.fsEditor.classList.contains('hidden') && document.activeElement !== els.fsInput && fsCueIndex !== idx) {
          syncFsEditor(idx);
        }
        return; // normal editor-list highlight is hidden behind the overlay
      }
      if (!cue || idx < 0) return;
      if (document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('ed-input')) return;
      if (lastActiveRow && lastActiveRow.classList) lastActiveRow.classList.remove('active');
      if (!rowEls || !rowEls[idx]) return;
      const row = rowEls[idx];
      if (row && row.classList) {
        row.classList.add('active');
        lastActiveRow = row;
        scrollRowIntoView(row);
      }
    });
  }

  if (typeof SubtitlePlayer !== 'undefined' && SubtitlePlayer.setTimeCallback) {
    SubtitlePlayer.setTimeCallback(() => {
      if (fsActive) {
        updateFsScreen();
      }
    });
  }

  /** Swap in a fresh cue set (original or translated) and rebuild everything. */
  function updateCues(cues) {
    baseCues = cues.map((c) => ({ ...c }));
    workCues = cues.map((c) => {
      const copy = { ...c };
      if (typeof Translator !== 'undefined' && Translator.normalizeForSearch) {
        copy._normText = Translator.normalizeForSearch(c.text || '');
      } else {
        copy._normText = (c.text || '').toLowerCase();
      }
      return copy;
    });
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
    runQualityInspection();
  }

  // ---------- Fullscreen edit mode ----------

  function updateFontSize(val) {
    store.set('fontSize', val);
    if (els.fontSizeSel) els.fontSizeSel.value = val;
    if (els.fsFontSizeSel) els.fsFontSizeSel.value = val;
    SubtitlePlayer.setFontScale(val);
    if (fsActive) fitFsText();
  }

  /** Shrink the fullscreen subtitle text until it fits the visible screen area without clipping. */
  function fitFsText() {
    const screen = els.fsScreen;
    if (!screen || !fsActive) return;
    const textEls = screen.querySelectorAll('.fs-text');
    if (!textEls.length) return;

    const screenW = screen.clientWidth;
    const screenH = screen.clientHeight;
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
      const raw = String(c.rawText || c.text || '');
      const clean = String(c.text || '').replace(/\\N/g, '\n');
      const lines = clean.split('\n');
      const rawLines = raw.split(/\\N|\n/);

      if (lines.length > 1 && (raw.includes('\\an') || raw.includes('\\a') || raw.includes('<top>'))) {
        lines.forEach((line, i) => {
          const stripped = line.replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, '').trim();
          if (!stripped) return;
          const placement = getCuePlacement(c, rawLines[i] || rawLines[0] || '');
          const span = document.createElement('span');
          span.className = 'fs-text';
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
          span.className = 'fs-text';
          span.textContent = stripped;
          span.setAttribute('dir', hasArabic(stripped) ? 'rtl' : 'ltr');
          span.style.textAlign = placement.hAlign;

          const targetZone = placement.vAlign === 'top' ? zoneTop : (placement.vAlign === 'mid' ? zoneMid : zoneBottom);
          targetZone.appendChild(span);
        }
      }
    });
  }

  function updateFsScreen() {
    const currentPos = typeof SubtitlePlayer !== 'undefined' ? SubtitlePlayer.position : 0;
    const currentDuration = typeof SubtitlePlayer !== 'undefined' ? SubtitlePlayer.duration : 0;
    let activeList = [];
    if (typeof SubtitlePlayer !== 'undefined' && workCues && workCues.length) {
      activeList = workCues.filter((c) => currentPos >= c.start && currentPos < c.end);
    }
    if (!activeList.length && activeIdx >= 0 && workCues && workCues[activeIdx]) {
      activeList = [workCues[activeIdx]];
    } else if (!activeList.length && workCues && workCues.length) {
      let nearest = workCues[0];
      for (let k = 0; k < workCues.length; k++) {
        if (workCues[k].start <= currentPos) nearest = workCues[k];
        else break;
      }
      if (nearest) activeList = [nearest];
    }

    const primaryCue = activeList[0] || (workCues ? workCues[0] : null);
    if (primaryCue && workCues) {
      const idx = workCues.indexOf(primaryCue);
      if (idx >= 0) activeIdx = idx;
    }

    renderFsCues(els.fsScreen, activeList);

    if (els.fsCueCount) {
      els.fsCueCount.textContent = primaryCue && workCues ? `Cue ${primaryCue.index} / ${workCues.length}` : 'Cue 0 / 0';
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

    // Update Fullscreen Timeline Scrubber
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
    if (i < 0 || !workCues || !workCues[i]) return;
    fsCueIndex = i;
    if (els.fsInput) {
      els.fsInput.value = displayText(workCues[i].text);
      els.fsInput.setAttribute('dir', dirFor(els.fsInput.value));
      updateFsCharCount();
    }
  }

  function updateFsCharCount() {
    if (els.fsCharCount && els.fsInput) {
      const len = els.fsInput.value.length;
      els.fsCharCount.textContent = `${len} chars`;
    }
  }

  let fsInitialText = '';

  function openFsEditor() {
    const i = activeIdx >= 0 ? activeIdx : 0;
    if (i < 0 || !workCues || !workCues[i]) return;
    syncFsEditor(i);
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
    if (fsCueIndex >= 0 && els.fsInput && els.fsInput.value !== fsInitialText) {
      pushUndoState();
    }
    if (els.fsEditor) els.fsEditor.classList.add('hidden');
    if (editWasPlaying && typeof SubtitlePlayer !== 'undefined' && SubtitlePlayer.play) SubtitlePlayer.play();
    editWasPlaying = false;
    fitFsText();
  }

  function enterFs() {
    if (!parsed || !workCues || !workCues.length) { toast('Load a subtitle file first.', true); return; }
    fsActive = true;
    if (els.fsEdit) els.fsEdit.classList.remove('hidden');
    const pos = typeof SubtitlePlayer !== 'undefined' ? SubtitlePlayer.position : 0;
    let i = workCues.findIndex((c) => pos >= c.start && pos < c.end);
    if (i < 0) {
      i = activeIdx >= 0 ? activeIdx : 0;
      if (typeof SubtitlePlayer !== 'undefined' && SubtitlePlayer.seek && workCues[i]) {
        SubtitlePlayer.seek(workCues[i].start);
      }
    } else {
      activeIdx = i;
    }
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
    if (els.fsEdit) els.fsEdit.classList.add('hidden');
    closeFsEditor();
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }

  function triggerGestureFeedback(type) {
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

  function polishKurdishText(all = false) {
    if (!workCues || !workCues.length) return;
    if (typeof Translator === 'undefined' || !Translator.postprocessSorani) return;

    if (all) {
      workCues = workCues.map((cue) => ({
        ...cue,
        text: Translator.postprocessSorani(cue.text || '', { fixPunct: true })
      }));
      pushUndoState();
      buildEditor();
      if (typeof SubtitlePlayer !== 'undefined') SubtitlePlayer.updateText(workCues);
      prepareDownload();
      updateFsScreen();
      toast(currentUiLang === 'ckb' ? 'هەموو دێڕەکان بە ستاندارد ڕێکخران!' : 'All lines polished with Kurdish Sorani typography!');
    } else {
      const idx = fsActive ? (fsCueIndex >= 0 ? fsCueIndex : activeIdx) : activeIdx;
      if (idx >= 0 && workCues[idx]) {
        const polished = Translator.postprocessSorani(workCues[idx].text || '', { fixPunct: true });
        applyCueEdit(idx, polished);
        if (els.fsInput) els.fsInput.value = polished;
        updateFsScreen();
        toast(currentUiLang === 'ckb' ? 'دێڕەکە ڕێکخرا!' : 'Line polished!');
      }
    }
  }

  function bindFs() {
    if (els.fsToggleBtn) els.fsToggleBtn.addEventListener('click', () => (fsActive ? exitFs() : enterFs()));
    if (els.fsClose) els.fsClose.addEventListener('click', exitFs);

    // Gestures on Fullscreen Screen Stage
    let lastTapTime = 0;
    let lastTapX = 0;

    if (els.fsScreen) {
      els.fsScreen.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.fs-btn, button, select, input, textarea')) return;
        const now = Date.now();
        const rect = els.fsScreen.getBoundingClientRect();
        const tapXRatio = (e.clientX - rect.left) / rect.width;

        if (now - lastTapTime < 320 && Math.abs(e.clientX - lastTapX) < 80) {
          // Double Tap Triggered
          if (tapXRatio < 0.35) {
            // Double Tap Left: Skip Back 5s
            SubtitlePlayer.jump(-5000);
            updateFsScreen();
            triggerGestureFeedback('rewind');
          } else if (tapXRatio > 0.65) {
            // Double Tap Right: Skip Forward 5s
            SubtitlePlayer.jump(5000);
            updateFsScreen();
            triggerGestureFeedback('forward');
          } else {
            // Double Tap Center: Toggle Play
            SubtitlePlayer.toggle();
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
        // Single tap opens/focuses the quick edit drawer
        setTimeout(() => {
          if (Date.now() - lastTapTime >= 300) {
            openFsEditor();
          }
        }, 320);
      });
    }

    if (els.fsEditBtn) els.fsEditBtn.addEventListener('click', openFsEditor);
    if (els.fsDoneBtn) els.fsDoneBtn.addEventListener('click', closeFsEditor);
    if (els.fsPrevBtn) els.fsPrevBtn.addEventListener('click', () => { SubtitlePlayer.stepCue(-1); updateFsScreen(); });
    if (els.fsNextBtn) els.fsNextBtn.addEventListener('click', () => { SubtitlePlayer.stepCue(1); updateFsScreen(); });
    if (els.fsRestartBtn) els.fsRestartBtn.addEventListener('click', () => { SubtitlePlayer.seek(0); updateFsScreen(); });

    if (els.fsPrevCueNavBtn) {
      els.fsPrevCueNavBtn.addEventListener('click', () => {
        if (fsCueIndex > 0) {
          syncFsEditor(fsCueIndex - 1);
          SubtitlePlayer.seek(workCues[fsCueIndex].start);
          updateFsScreen();
        }
      });
    }
    if (els.fsNextCueNavBtn) {
      els.fsNextCueNavBtn.addEventListener('click', () => {
        if (workCues && fsCueIndex < workCues.length - 1) {
          syncFsEditor(fsCueIndex + 1);
          SubtitlePlayer.seek(workCues[fsCueIndex].start);
          updateFsScreen();
        }
      });
    }

    if (els.fsPlayBtn) els.fsPlayBtn.addEventListener('click', () => { SubtitlePlayer.toggle(); updateFsScreen(); });
    if (els.fsSkipBackBtn) {
      els.fsSkipBackBtn.addEventListener('click', () => {
        SubtitlePlayer.jump(-5000);
        updateFsScreen();
        triggerGestureFeedback('rewind');
      });
    }
    if (els.fsSkipForwardBtn) {
      els.fsSkipForwardBtn.addEventListener('click', () => {
        SubtitlePlayer.jump(5000);
        updateFsScreen();
        triggerGestureFeedback('forward');
      });
    }
    if (els.fsSpeedSel) {
      els.fsSpeedSel.addEventListener('change', (e) => {
        if (typeof SubtitlePlayer !== 'undefined' && els.speedSel) {
          els.speedSel.value = e.target.value;
          els.speedSel.dispatchEvent(new Event('change'));
        }
      });
    }

    if (els.fsUndoBtn) els.fsUndoBtn.addEventListener('click', performUndo);
    if (els.fsRedoBtn) els.fsRedoBtn.addEventListener('click', performRedo);
    if (els.fsEdUndoBtn) els.fsEdUndoBtn.addEventListener('click', performUndo);
    if (els.fsEdRedoBtn) els.fsEdRedoBtn.addEventListener('click', performRedo);
    if (els.fsEdPolishBtn) els.fsEdPolishBtn.addEventListener('click', () => polishKurdishText(false));

    if (els.fsFontSizeSel) {
      els.fsFontSizeSel.addEventListener('change', (e) => {
        updateFontSize(e.target.value);
      });
    }

    // Fullscreen Scrubber Timeline Interaction
    const handleFsScrub = (e) => {
      if (!els.fsTimeline) return;
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
        if (SubtitlePlayer.playing) SubtitlePlayer.pause();
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
          if (!SubtitlePlayer.duration) return;
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
        if (fsCueIndex < 0 || !workCues || !workCues[fsCueIndex]) return;
        applyCueEdit(fsCueIndex, els.fsInput.value);
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

  // ---------- Tabs ----------
  function switchTab(name) {
    if (name === 'preview' && !parsed) {
      toast('Load a subtitle file first.', true);
      return; // don't switch to an empty preview tab
    }
    tabButtons.forEach((b) => {
      if (b && b.classList) b.classList.toggle('active', b.dataset.tab === name);
    });
    if (els.tabTranslate && els.tabTranslate.classList) els.tabTranslate.classList.toggle('hidden', name !== 'translate');
    if (els.tabPreview && els.tabPreview.classList) els.tabPreview.classList.toggle('hidden', name !== 'preview');
    if (name === 'preview') {
      if (typeof SubtitlePlayer !== 'undefined' && SubtitlePlayer.fitText) {
        requestAnimationFrame(() => SubtitlePlayer.fitText());
      }
    } else {
      if (typeof SubtitlePlayer !== 'undefined' && SubtitlePlayer.pause) {
        SubtitlePlayer.pause(); // stop playback off-screen
      }
    }
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

    if (isTourOpen) {
      closeTour(false);
    }

    file = f;
    parsed = parsedFile;
    isDemoLoaded = false;
    resultText = null;
    if (resultUrl) { URL.revokeObjectURL(resultUrl); resultUrl = null; }
    els.fileName.textContent = f.name;
    els.fileMeta.textContent = `${parsed.cues.length} lines • ${formatSize(f.size)} • ${LABEL[parsed.format] || parsed.format.toUpperCase()}`;
    updateCues(parsed.cues);
    updateTourTriggerBtnState();

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
    if (els.cancelBtn && els.cancelBtn.classList) els.cancelBtn.classList.remove('hidden');
    if (els.translateBtn) els.translateBtn.disabled = true;
    setProgress(0, 'Preparing…');
    if (els.lineCount) els.lineCount.textContent = `${parsed.cues.length} lines`;

    if (typeof Toast !== 'undefined') {
      Toast.show(
        currentUiLang === 'ckb' ? '⚡ وەرگێڕان دەستی پێکرد!' : '⚡ Translation started!',
        'translating',
        { subtext: currentUiLang === 'ckb' ? 'تکایە چاوەڕێ بکە... وەرگێڕانی کوردی لە ئارادایە' : 'Google AI is translating your subtitles to Kurdish Sorani...' }
      );
    }

    const srcLang = els.srcLang ? els.srcLang.value : 'auto';
    const tgtLang = els.tgtLang ? els.tgtLang.value : 'ckb';
    const includeOriginal = els.includeOriginal ? els.includeOriginal.checked : false;
    const accuracy = els.accuracyToggle ? els.accuracyToggle.checked : false;
    const kurdishDigits = els.kurdishDigitsToggle ? els.kurdishDigitsToggle.checked : false;
    const isAss = parsed.format === 'ass' || parsed.format === 'ssa';
    const normalize = (c) => (isAss ? c.text.replace(/\\N/g, '\n') : c.text);
    const controller = new AbortController();
    activeController = controller;

    // Combine the translated lines back into cues: stack the source line above
    // the translation when requested, optionally drop empty cues, and renumber.
    const applyTranslation = (translated) => {
      const translatedCues = parsed.cues.map((c, i) => {
        const tr = translated[i] && translated[i].trim() ? translated[i].trim() : null;
        // Compare against the normalized source so ASS \N cues match correctly.
        if (includeOriginal && tr && tr !== normalize(c)) return { ...c, text: `${c.text}\n${tr}` };
        return { ...c, text: tr || c.text };
      });
      const keepOnlyChecked = els.keepOnly ? els.keepOnly.checked : false;
      const finalCues = keepOnlyChecked
        ? translatedCues.filter((c) => c.text.trim() !== '')
        : translatedCues;
      finalCues.forEach((c, i) => { c.index = i + 1; });
      return finalCues;
    };

    try {
      const lines = parsed.cues.map(normalize);
      liveSource = lines;
      liveOrder = lines.map((l, i) => (l && l.trim() ? i : -1)).filter((i) => i >= 0);
      liveDone = 0;
      liveItems = [];
      cachedLiveTexts = null;
      if (els.liveCaption && els.liveCaption.classList) els.liveCaption.classList.add('hidden');
      if (els.liveOrigCaption && els.liveOrigCaption.classList) els.liveOrigCaption.classList.add('hidden');
      if (els.livePlaceholder && els.livePlaceholder.classList) els.livePlaceholder.classList.remove('hidden');
      if (els.liveTimecode) els.liveTimecode.textContent = '00:00.000';
      if (els.progressSpeed) els.progressSpeed.textContent = '⚡ Processing…';
      if (els.liveFeed) els.liveFeed.innerHTML = '';

      const startMs = Date.now();
      const translated = await Translator.translateLines(lines, srcLang, tgtLang, (p, done, total) => {
        if (cancelFlag) return;
        const elapsedSec = (Date.now() - startMs) / 1000;
        const speed = elapsedSec > 0.3 && done > 0 ? Math.round(done / elapsedSec) : 0;
        const remainingSec = speed > 0 ? Math.ceil((total - done) / speed) : 0;

        if (els.progressSpeed) {
          if (speed > 0) {
            els.progressSpeed.textContent = `⚡ ${speed} lines/sec • ~${remainingSec}s left`;
          } else {
            els.progressSpeed.textContent = `⚡ Streaming…`;
          }
        }
        if (els.lineCount) els.lineCount.textContent = `${done} / ${total} lines`;
        setProgress(p, `Translated ${done} / ${total} lines`);
      }, controller.signal, {
        accuracy,
        kurdishDigits,
        onBatch: (results, done) => { if (!cancelFlag) renderLive(results, done); }
      });
      if (cancelFlag) return; // cancelled mid-run: discard results, stay on settings

      let finalCues = applyTranslation(translated);
      const fixOverlapChecked = els.fixOverlapToggle ? els.fixOverlapToggle.checked : true;
      if (fixOverlapChecked && typeof SubParser !== 'undefined' && SubParser.fixOverlaps) {
        finalCues = SubParser.fixOverlaps(finalCues, { mode: 'trim', minDurationMs: 600, gapMs: 20 });
      }

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
        updateCues(applyTranslation(err.results));
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

  function cleanBaseName(filename) {
    if (!filename) return 'subtitle';
    let name = filename.replace(/\.[^.]+$/, '');
    // Strip language tags and duplicate extension markers
    name = name.replace(/\.(en|eng|english|ckb|ku|kur|kurdish|sor|sorani|ar|arabic|fa|farsi|persian|es|spanish|fr|french|de|german|ru|russian|tr|turkish|it|pt|ja|zh|ko|hi|ur|ps|sv|no|da|nl|pl|uk|el|he|id)$/i, '');
    return name || 'subtitle';
  }

  function prepareDownload() {
    if (!parsed || !file) return;
    // Edits are included in the output only when "Save edits" is on.
    let cues = els.saveEditsToggle.checked ? workCues : baseCues;

    const fixOverlapChecked = els.fixOverlapToggle ? els.fixOverlapToggle.checked : true;
    if (fixOverlapChecked && typeof SubParser !== 'undefined' && SubParser.fixOverlaps) {
      cues = SubParser.fixOverlaps(cues, { mode: 'trim', minDurationMs: 600, gapMs: 20 });
    }

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
    const base = cleanBaseName(file.name);
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

  // ---------- Line Quality & Advanced Expression Inspector ----------
  let currentQualityFilter = 'all';
  let currentQualityQuery = '';
  let lastQualityIssues = [];

  function openQualityModal() {
    if (!els.qualityModalBackdrop) return;
    currentQualityFilter = 'all';
    currentQualityQuery = '';
    if (els.qualitySearchInput) els.qualitySearchInput.value = '';
    if (els.qualitySearchClear) els.qualitySearchClear.classList.add('hidden');
    if (els.qualityCategoryTabs) {
      els.qualityCategoryTabs.querySelectorAll('.quality-tab').forEach((tab) => {
        tab.classList.toggle('active', tab.dataset.filter === 'all');
      });
    }
    runQualityInspection();
    els.qualityModalBackdrop.classList.remove('hidden');
  }

  function closeQualityModal() {
    if (els.qualityModalBackdrop) {
      els.qualityModalBackdrop.classList.add('hidden');
    }
  }

  function runQualityInspection() {
    const cues = workCues || (parsed && parsed.cues) || [];
    if (!cues.length) {
      if (els.qualityScoreVal) els.qualityScoreVal.textContent = '100%';
      if (els.qualityIssuesCount) els.qualityIssuesCount.textContent = '0';
      if (els.qualityOverlapCount) els.qualityOverlapCount.textContent = '0';
      if (els.qualityAdvancedCount) els.qualityAdvancedCount.textContent = '0';
      if (els.qTabAllCount) els.qTabAllCount.textContent = '0';
      if (els.qTabOrthoCount) els.qTabOrthoCount.textContent = '0';
      if (els.qTabPrefixCount) els.qTabPrefixCount.textContent = '0';
      if (els.qTabTimingCount) els.qTabTimingCount.textContent = '0';
      if (els.qTabIdiomsCount) els.qTabIdiomsCount.textContent = '0';
      if (els.qualityIssuesList) {
        els.qualityIssuesList.innerHTML = `<div class="char-empty-msg" style="padding: 2.5rem 1rem; text-align: center; color: var(--text-muted);">
          ${currentUiLang === 'ckb' ? 'هیچ فایلی ژێرنووس بارنەکراوە.' : 'No subtitles loaded yet. Upload a file to inspect line quality.'}
        </div>`;
      }
      return;
    }

    let totalScore = 0;
    const issuesFound = [];
    let overlapCount = 0;
    let advancedCount = 0;
    let orthoCount = 0;
    let prefixCount = 0;
    let timingCount = 0;
    let idiomsLineCount = 0;

    // Check dialogue overlap
    for (let i = 0; i < cues.length - 1; i++) {
      if (cues[i].end > cues[i + 1].start) {
        overlapCount++;
      }
    }

    cues.forEach((cue, index) => {
      const kurdText = cue.text || '';
      const srcText = (liveSource && liveSource[index]) || (parsed && parsed.cues && parsed.cues[index] && parsed.cues[index].text) || kurdText;
      const res = (typeof Translator !== 'undefined' && Translator.checkLineQuality)
        ? Translator.checkLineQuality(srcText, kurdText)
        : { score: 100, issues: [], issueDetails: [], suggestions: [] };
      const advAlts = (typeof Translator !== 'undefined' && Translator.getAdvancedAlternatives)
        ? Translator.getAdvancedAlternatives(srcText)
        : [];

      // Check if this cue has an overlap with next cue
      const hasOverlap = index < cues.length - 1 && cue.end > cues[index + 1].start;
      if (hasOverlap) {
        res.issues.push(currentUiLang === 'ckb' ? 'تێکەڵبوونی کات لەگەڵ دێڕی دواتر (Overlap)' : 'Timing overlap with next line');
        res.score = Math.max(10, res.score - 15);
      }

      // Determine categories for this line
      const categories = new Set();
      if (res.issueDetails && res.issueDetails.length > 0) {
        res.issueDetails.forEach((d) => {
          if (d.category) categories.add(d.category);
        });
      }
      res.issues.forEach((iss) => {
        if (/ڕێنووس|پیت|Arabic|letter|alphabet|glyph|tatweel|hamza/i.test(iss)) categories.add('orthography');
        else if (/پێشگر|دیالۆگ|prefix|affix|verbal|dialogue/i.test(iss)) categories.add('prefix');
        else if (/کات|overlap|duration|timing|length|درێژی/i.test(iss)) categories.add('timing');
      });
      if (hasOverlap) categories.add('timing');
      if (advAlts.length > 0) {
        categories.add('idioms');
        advancedCount += advAlts.length;
      }

      totalScore += res.score;

      const hasLineIssues = res.issues.length > 0 || advAlts.length > 0 || hasOverlap;
      if (hasLineIssues) {
        if (categories.has('orthography')) orthoCount++;
        if (categories.has('prefix')) prefixCount++;
        if (categories.has('timing')) timingCount++;
        if (categories.has('idioms')) idiomsLineCount++;

        issuesFound.push({
          index: index + 1,
          cueIndex: index,
          start: cue.start,
          end: cue.end,
          srcText,
          kurdText,
          score: res.score,
          issues: res.issues,
          issueDetails: res.issueDetails || [],
          categories: Array.from(categories),
          suggestions: res.suggestions,
          advancedAlternatives: advAlts,
          hasOverlap: hasOverlap
        });
      }
    });

    const avgScore = Math.max(10, Math.min(100, Math.round(totalScore / Math.max(1, cues.length))));
    if (els.qualityScoreVal) els.qualityScoreVal.textContent = `${avgScore}%`;
    if (els.edQualityBadge) {
      els.edQualityBadge.textContent = `${avgScore}%`;
      els.edQualityBadge.classList.toggle('warning', avgScore < 85 && avgScore >= 60);
      els.edQualityBadge.classList.toggle('alert', avgScore < 60);
    }
    if (els.qualityIssuesCount) els.qualityIssuesCount.textContent = String(issuesFound.length);
    if (els.qualityOverlapCount) els.qualityOverlapCount.textContent = String(overlapCount);
    if (els.qualityAdvancedCount) els.qualityAdvancedCount.textContent = String(advancedCount);

    if (els.qTabAllCount) els.qTabAllCount.textContent = String(issuesFound.length);
    if (els.qTabOrthoCount) els.qTabOrthoCount.textContent = String(orthoCount);
    if (els.qTabPrefixCount) els.qTabPrefixCount.textContent = String(prefixCount);
    if (els.qTabTimingCount) els.qTabTimingCount.textContent = String(timingCount);
    if (els.qTabIdiomsCount) els.qTabIdiomsCount.textContent = String(idiomsLineCount);

    lastQualityIssues = issuesFound;
    renderQualityIssuesList(issuesFound);
  }

  function renderQualityIssuesList(issues) {
    if (!els.qualityIssuesList) return;
    els.qualityIssuesList.innerHTML = '';

    const listToRender = issues || lastQualityIssues || [];

    if (!listToRender.length) {
      els.qualityIssuesList.innerHTML = `<div class="char-empty-msg" style="padding: 2.5rem 1rem; text-align: center; color: var(--text-muted);">
        <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🎉</div>
        <div style="font-weight: 600; font-size: 1.1rem; color: var(--text-primary); margin-bottom: 0.25rem;">
          ${currentUiLang === 'ckb' ? 'هەموو دێڕەکان بێ کێشەن و ستانداردن!' : 'All Lines Look Great!'}
        </div>
        <div>${currentUiLang === 'ckb' ? 'هیچ کێشەیەکی ڕێزمانی، پیت، یان تێکەڵبوونی کات نەدۆزرایەوە.' : 'No punctuation anomalies, raw Arabic glyphs, or dialogue overlaps detected.'}</div>
      </div>`;
      return;
    }

    const query = (currentQualityQuery || '').trim().toLowerCase();
    const filterCat = currentQualityFilter || 'all';

    let visibleCount = 0;
    const frag = document.createDocumentFragment();

    listToRender.forEach((item) => {
      // Category filter check
      if (filterCat !== 'all') {
        if (filterCat === 'orthography' && !item.categories.includes('orthography')) return;
        if (filterCat === 'prefix' && !item.categories.includes('prefix')) return;
        if (filterCat === 'timing' && !item.categories.includes('timing')) return;
        if (filterCat === 'idioms' && !item.categories.includes('idioms')) return;
      }

      // Search query check
      if (query) {
        const textMatch = item.srcText.toLowerCase().includes(query) || item.kurdText.toLowerCase().includes(query);
        const issueMatch = item.issues.some((iss) => iss.toLowerCase().includes(query));
        const altMatch = (item.advancedAlternatives || []).some((alt) => alt.kurdish.toLowerCase().includes(query) || (alt.context && alt.context.toLowerCase().includes(query)));
        if (!textMatch && !issueMatch && !altMatch) return;
      }

      visibleCount++;

      const card = document.createElement('div');
      card.className = 'quality-issue-card';
      card.dataset.cueIndex = String(item.cueIndex);
      card.dataset.categories = item.categories.join(' ');

      const timeFmt = (typeof SubParser !== 'undefined') ? `${SubParser.fmtSRT(item.start)} ➔ ${SubParser.fmtSRT(item.end)}` : '';

      let tagsHtml = item.issues.map((iss) => {
        let tagClass = 'quality-issue-tag';
        if (/overlap|timing|تێکەڵبوونی/i.test(iss)) tagClass += ' warning';
        else if (/character|name|ناو/i.test(iss)) tagClass += ' info';
        return `<span class="${tagClass}">${iss}</span>`;
      }).join('');

      if (item.advancedAlternatives && item.advancedAlternatives.length > 0) {
        tagsHtml += `<span class="quality-issue-tag idiom">
          ⚡ ${currentUiLang === 'ckb' ? 'دەستەواژەی پێشکەوتوو' : 'Advanced Expressions'}
        </span>`;
      }

      let altsHtml = '';
      if (item.advancedAlternatives && item.advancedAlternatives.length > 0) {
        altsHtml = `
          <div class="quality-alts-box" style="margin-top: 0.75rem; padding: 0.6rem 0.75rem; background: var(--surface-secondary, rgba(255,255,255,0.04)); border-radius: 8px; border: 1px dashed var(--border-color, rgba(255,255,255,0.15));">
            <div style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted, #94a3b8); margin-bottom: 0.4rem;">
              💡 ${currentUiLang === 'ckb' ? 'پێشنیارە گونجاوەکانی کوردی (کلیک بکە بۆ جێبەجێکردن):' : 'Natural Kurdish alternatives (click to apply):'}
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 0.4rem;">
              ${item.advancedAlternatives.map((alt) => `
                <button type="button" class="alt-chip-btn" data-cue-index="${item.cueIndex}" data-rep="${alt.kurdish.replace(/"/g, '&quot;')}" style="font-size: 0.8rem; padding: 0.35rem 0.65rem; background: var(--bg-surface, #1e293b); border: 1px solid var(--accent-primary, #6366f1); border-radius: 6px; color: var(--accent-primary, #818cf8); cursor: pointer; display: inline-flex; align-items: center; gap: 0.35rem; transition: all 0.15s ease;">
                  <span style="font-weight: bold;">+</span>
                  <span dir="rtl" style="font-weight: 600; font-family: 'Noto Naskh Arabic', sans-serif;">${alt.kurdish}</span>
                  ${alt.context ? `<span style="font-size: 0.7rem; opacity: 0.75;">(${alt.context})</span>` : ''}
                </button>
              `).join('')}
            </div>
          </div>
        `;
      }

      card.innerHTML = `
        <div class="quality-issue-head" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-weight: 700; font-size: 0.85rem; color: var(--accent-primary, #818cf8);">#${item.index}</span>
            <span style="font-size: 0.75rem; font-family: monospace; color: var(--text-muted, #94a3b8);">${timeFmt}</span>
          </div>
          <div style="display: flex; gap: 0.4rem; align-items: center;">
            <button type="button" class="quick-fix-row-btn btn-xs" data-cue-index="${item.cueIndex}" style="font-size: 0.75rem; padding: 0.3rem 0.6rem; background: var(--accent-primary, #6366f1); color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; transition: opacity 0.15s ease;">
              ⚡ ${currentUiLang === 'ckb' ? 'چاکسازی خۆکار' : 'Auto Polish'}
            </button>
            <button type="button" class="goto-cue-btn btn-xs" data-cue-index="${item.cueIndex}" style="font-size: 0.75rem; padding: 0.3rem 0.6rem; background: var(--surface-secondary, rgba(255,255,255,0.06)); color: var(--text-primary, #f8fafc); border: 1px solid var(--border-color, rgba(255,255,255,0.12)); border-radius: 4px; cursor: pointer;">
              ${currentUiLang === 'ckb' ? 'دەستکاری' : 'Edit'}
            </button>
          </div>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 0.6rem;">
          ${tagsHtml}
        </div>
        <div class="quality-texts" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; font-size: 0.85rem;">
          <div style="padding: 0.6rem; background: var(--surface-secondary, rgba(255,255,255,0.03)); border-radius: 6px; border: 1px solid var(--border-color, rgba(255,255,255,0.1)); color: var(--text-muted, #94a3b8); word-break: break-word;">
            <div style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; margin-bottom: 0.25rem; letter-spacing: 0.5px;">Original</div>
            <div style="line-height: 1.4;">${displayText(item.srcText)}</div>
          </div>
          <div style="padding: 0.6rem; background: var(--bg-surface, rgba(0,0,0,0.25)); border-radius: 6px; border: 1px solid var(--border-color, rgba(255,255,255,0.1)); word-break: break-word;" dir="rtl">
            <div style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; margin-bottom: 0.25rem; color: var(--text-muted, #94a3b8); letter-spacing: 0.5px;" dir="ltr">Kurdish Sorani</div>
            <div class="kurd-val-text" style="font-family: 'Noto Naskh Arabic', 'Vazirmatn', sans-serif; font-size: 14px; line-height: 1.5; color: var(--text-primary, #f8fafc);">${displayText(item.kurdText)}</div>
          </div>
        </div>
        ${altsHtml}
      `;

      frag.appendChild(card);
    });

    if (visibleCount === 0) {
      els.qualityIssuesList.innerHTML = `<div class="char-empty-msg" style="padding: 2.5rem 1rem; text-align: center; color: var(--text-muted);">
        ${currentUiLang === 'ckb' ? 'هیچ ئەنجامێک نەدۆزرایەوە بۆ ئەم فلتەرە.' : 'No issues found matching current filter/search.'}
      </div>`;
      return;
    }

    els.qualityIssuesList.appendChild(frag);

    // Bind event handlers inside list
    els.qualityIssuesList.querySelectorAll('.alt-chip-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cIdx = parseInt(btn.dataset.cueIndex, 10);
        const rep = btn.dataset.rep;
        if (!isNaN(cIdx) && rep && workCues && workCues[cIdx]) {
          applyCueEdit(cIdx, rep);
          btn.style.background = 'var(--accent-primary, #6366f1)';
          btn.style.color = '#fff';
          btn.textContent = '✓ Applied';
          setTimeout(() => runQualityInspection(), 250);
        }
      });
    });

    els.qualityIssuesList.querySelectorAll('.quick-fix-row-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cIdx = parseInt(btn.dataset.cueIndex, 10);
        if (!isNaN(cIdx) && workCues && workCues[cIdx]) {
          const kurdDigitsVal = els.kurdishDigitsToggle ? els.kurdishDigitsToggle.checked : false;
          const polished = Translator.postprocessSorani(workCues[cIdx].text, {
            kurdishDigits: kurdDigitsVal
          });
          applyCueEdit(cIdx, polished);
          btn.textContent = '✓ Fixed';
          btn.disabled = true;
          setTimeout(() => runQualityInspection(), 250);
        }
      });
    });

    els.qualityIssuesList.querySelectorAll('.goto-cue-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cIdx = parseInt(btn.dataset.cueIndex, 10);
        closeQualityModal();
        switchTab('preview');
        setTimeout(() => {
          if (rowEls && rowEls[cIdx]) {
            rowEls[cIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
            const input = rowEls[cIdx].querySelector('.ed-input');
            if (input) input.focus();
          }
        }, 150);
      });
    });
  }

  function filterQualityList() {
    if (els.qualitySearchInput) {
      currentQualityQuery = els.qualitySearchInput.value;
      if (els.qualitySearchClear) {
        els.qualitySearchClear.classList.toggle('hidden', !currentQualityQuery);
      }
    }
    renderQualityIssuesList(lastQualityIssues);
  }

  function fixAllQuality() {
    if (!workCues || !workCues.length) {
      toast(currentUiLang === 'ckb' ? 'هیچ ژێرنووسێک نییە بۆ چاکسازی.' : 'No subtitles to polish.', true);
      return;
    }

    const kurdDigitsVal = els.kurdishDigitsToggle ? els.kurdishDigitsToggle.checked : false;

    // 1. Polish all Kurdish text
    workCues = workCues.map((c) => {
      const pol = Translator.postprocessSorani(c.text, {
        kurdishDigits: kurdDigitsVal
      });
      return { ...c, text: pol };
    });

    if (baseCues) {
      baseCues = baseCues.map((c) => {
        const pol = Translator.postprocessSorani(c.text, {
          kurdishDigits: kurdDigitsVal
        });
        return { ...c, text: pol };
      });
    }

    // 2. Fix all dialogue overlaps
    if (typeof SubParser !== 'undefined' && SubParser.fixOverlaps) {
      workCues = SubParser.fixOverlaps(workCues, { mode: 'trim', minDurationMs: 600, gapMs: 20 });
      if (baseCues) {
        baseCues = SubParser.fixOverlaps(baseCues, { mode: 'trim', minDurationMs: 600, gapMs: 20 });
      }
    }

    dirty = true;
    updateStatus();
    buildEditor();
    if (typeof SubtitlePlayer !== 'undefined') {
      SubtitlePlayer.load(workCues);
    }
    prepareDownload();
    runQualityInspection();

    const dict = dicts[currentUiLang] || dicts.en;
    toast(
      currentUiLang === 'ckb'
        ? '🎉 هەموو دێڕەکان بە ستانداردی کوردی چاککران و کاتەکان ڕێکخران!'
        : '🎉 Auto-polished all lines and resolved dialogue overlaps!'
    );
  }

  function fixDialogueOverlapsNow() {
    if (!workCues || !workCues.length) {
      toast(currentUiLang === 'ckb' ? 'هیچ ژێرنووسێک بارنەکراوە.' : 'No subtitles loaded.', true);
      return;
    }

    if (typeof SubParser !== 'undefined' && SubParser.fixOverlaps) {
      workCues = SubParser.fixOverlaps(workCues, { mode: 'trim', minDurationMs: 600, gapMs: 20 });
      if (baseCues) {
        baseCues = SubParser.fixOverlaps(baseCues, { mode: 'trim', minDurationMs: 600, gapMs: 20 });
      }
    }

    dirty = true;
    updateStatus();
    buildEditor();
    if (typeof SubtitlePlayer !== 'undefined') {
      SubtitlePlayer.load(workCues);
    }
    prepareDownload();
    runQualityInspection();

    toast(
      currentUiLang === 'ckb'
        ? '✓ کاتی ژێرنووسە تێکەڵبووەکان بە سەرکەوتوویی ڕێکخرانەوە!'
        : '✓ Dialogue overlaps resolved and timed cleanly!'
    );
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



    if (els.fixOverlapToggle) {
      els.fixOverlapToggle.addEventListener('change', () => {
        store.set('fix_overlap', els.fixOverlapToggle.checked ? '1' : '0');
        prepareDownload();
        runQualityInspection();
      });
    }

    // Quality Inspection modal bindings
    if (els.edQualityCheckBtn) els.edQualityCheckBtn.addEventListener('click', openQualityModal);
    if (els.closeQualityModalBtn) els.closeQualityModalBtn.addEventListener('click', closeQualityModal);
    if (els.doneQualityModalBtn) els.doneQualityModalBtn.addEventListener('click', closeQualityModal);
    if (els.fixAllQualityBtn) els.fixAllQualityBtn.addEventListener('click', fixAllQuality);
    if (els.fixOverlapsNowBtn) els.fixOverlapsNowBtn.addEventListener('click', fixDialogueOverlapsNow);

    if (els.qualityCategoryTabs) {
      els.qualityCategoryTabs.querySelectorAll('.quality-tab').forEach((tab) => {
        tab.addEventListener('click', () => {
          els.qualityCategoryTabs.querySelectorAll('.quality-tab').forEach((t) => t.classList.remove('active'));
          tab.classList.add('active');
          currentQualityFilter = tab.dataset.filter || 'all';
          renderQualityIssuesList(lastQualityIssues);
        });
      });
    }

    if (els.qualitySearchInput) {
      els.qualitySearchInput.addEventListener('input', () => {
        filterQualityList();
      });
    }

    if (els.qualitySearchClear) {
      els.qualitySearchClear.addEventListener('click', () => {
        if (els.qualitySearchInput) {
          els.qualitySearchInput.value = '';
          els.qualitySearchInput.focus();
        }
        filterQualityList();
      });
    }

    if (els.qualityModalBackdrop) {
      els.qualityModalBackdrop.addEventListener('click', (e) => {
        if (e.target === els.qualityModalBackdrop) closeQualityModal();
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && els.qualityModalBackdrop && !els.qualityModalBackdrop.classList.contains('hidden')) {
        closeQualityModal();
      }
    });

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
        updateFontSize(e.target.value);
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
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        // Quick find shortcut: focus the editor search bar if on the preview tab or if cues are loaded
        if (els.edSearchInput && ((els.tabPreview && !els.tabPreview.classList.contains('hidden')) || (parsed && parsed.cues && parsed.cues.length))) {
          e.preventDefault();
          if (els.tabPreview && els.tabPreview.classList.contains('hidden')) {
            switchTab('preview');
          }
          els.edSearchInput.focus();
          els.edSearchInput.select();
        }
      }
    });

    let rowInitialText = '';

    // ⚡ Bolt: Event delegation for subtitle editor list to avoid O(N) event listeners.
    // We attach unified handlers on the container instead of separate handlers on each row.
    if (els.editorList) {
      els.editorList.addEventListener('input', (e) => {
        const input = e.target;
        if (!input || !input.classList || !input.classList.contains('ed-input')) return;
        const row = input.closest('.ed-row');
        if (!row) return;
        const i = parseInt(row.dataset.index, 10);
        autoGrow(input);
        applyCueEdit(i, input.value);
      });

      els.editorList.addEventListener('focusin', (e) => {
        const input = e.target;
        if (!input || !input.classList || !input.classList.contains('ed-input')) return;
        const row = input.closest('.ed-row');
        if (!row) return;
        rowInitialText = input.value;
        if (row.classList) row.classList.add('editing');
        if (els.syncVideoToggle && els.syncVideoToggle.checked) {
          const i = parseInt(row.dataset.index, 10);
          const c = workCues && workCues[i];
          if (c && typeof SubtitlePlayer !== 'undefined') {
            SubtitlePlayer.seek(c.start);
            editWasPlaying = SubtitlePlayer.playing;
            SubtitlePlayer.pause();
          }
        }
      });

      els.editorList.addEventListener('focusout', (e) => {
        const input = e.target;
        if (!input || !input.classList || !input.classList.contains('ed-input')) return;
        const row = input.closest('.ed-row');
        if (!row) return;
        if (row.classList) row.classList.remove('editing');
        const i = parseInt(row.dataset.index, 10);
        if (input.value !== rowInitialText) {
          pushUndoState();
        }
        if (els.syncVideoToggle && els.syncVideoToggle.checked && editWasPlaying && typeof SubtitlePlayer !== 'undefined') {
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
        const c = workCues && workCues[i];
        if (!c) return;
        if (els.syncVideoToggle && els.syncVideoToggle.checked && typeof SubtitlePlayer !== 'undefined') {
          SubtitlePlayer.seek(c.start);
          if (!SubtitlePlayer.playing) SubtitlePlayer.play();
        }
      });

      els.editorList.addEventListener('keydown', (e) => {
        const input = e.target;
        if (!input || !input.classList || !input.classList.contains('ed-input')) return;
        if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
          e.preventDefault();
          input.blur();
        }
      });
    }

    if (els.edSearchInput) {
      els.edSearchInput.addEventListener('input', filterEditor);
      els.edSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (e.shiftKey) {
            prevSearchMatch();
          } else {
            nextSearchMatch();
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          els.edSearchInput.value = '';
          filterEditor();
          els.edSearchInput.blur();
        }
      });
    }
    if (els.edSearchPrevBtn) {
      els.edSearchPrevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        prevSearchMatch();
      });
    }
    if (els.edSearchNextBtn) {
      els.edSearchNextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        nextSearchMatch();
      });
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

  const TOUR_STEP_ICONS = [
    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>`,
    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>`,
    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline></svg>`
  ];

  const TOUR_STEPS = [
    {
      targetSel: '#dropzone',
      titleKey: 'tourStep1Title',
      textKey: 'tourStep1Text',
      badge: '1 / 5',
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
      badge: '2 / 5',
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
      badge: '3 / 5',
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
      badge: '4 / 5',
      showPrev: true,
      nextKey: 'tourNext',
      ensureTab: 'preview',
      onEnter: () => {
        if (!parsed) loadDemoForTour();
        switchTab('preview');
      }
    },
    {
      targetSel: '#edQualityCheckBtn',
      titleKey: 'tourStep5Title',
      textKey: 'tourStep5Text',
      badge: '5 / 5',
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
    if (file && !isDemoLoaded) {
      // If user's own file is loaded, don't allow openTour
      return;
    }
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
    
    // Only reset the app state when closing the tour if the demo was loaded.
    // If the user had their own file uploaded, we must keep it intact!
    if (isDemoLoaded) {
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
    updateTourTriggerBtnState();
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
    
    // Update icon badge
    const iconBadge = $('#tourIconBadge');
    if (iconBadge && TOUR_STEP_ICONS[index]) {
      iconBadge.innerHTML = TOUR_STEP_ICONS[index];
    }

    // Update dots
    const dots = $$('.tour-dot');
    dots.forEach((dot, dIdx) => {
      dot.classList.toggle('active', dIdx === index);
    });

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
      const cardWidth = 360;
      const cardHeight = els.tourCard.offsetHeight || 210;

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

    // Direct dot navigation click
    $$('.tour-dot').forEach((dot) => {
      dot.addEventListener('click', (e) => {
        const targetStep = parseInt(e.currentTarget.dataset.step, 10);
        if (!isNaN(targetStep) && targetStep >= 0 && targetStep < TOUR_STEPS.length) {
          renderTourStep(targetStep);
        }
      });
    });
  }

  function setupPWA() {
    // 1. Service Worker Registration & Update Notification
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').then((reg) => {
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                toast(
                  currentUiLang === 'ckb'
                    ? 'نۆژەنکردنەوەی نوێ ئامادەیە! لاپەڕەکە نوێبکەرەوە.'
                    : 'A new update is available! Reload to use the latest version.'
                );
              }
            });
          }
        });
      }).catch((err) => {
        console.warn('Service Worker registration failed:', err);
      });
    }

    // 2. Install Prompt & App Installed Handler
    let deferredInstall = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstall = e;
      if (els.installBtn) els.installBtn.hidden = false;
    });

    if (els.installBtn) {
      els.installBtn.addEventListener('click', async () => {
        if (!deferredInstall) return;
        deferredInstall.prompt();
        const { outcome } = await deferredInstall.userChoice;
        if (outcome === 'accepted') {
          toast(currentUiLang === 'ckb' ? 'سوپاس بۆ دابەزاندنی بەرنامەکە!' : 'Thank you for installing Kurdî Subtitles!');
        }
        deferredInstall = null;
        els.installBtn.hidden = true;
      });
    }

    window.addEventListener('appinstalled', () => {
      deferredInstall = null;
      if (els.installBtn) els.installBtn.hidden = true;
      toast(currentUiLang === 'ckb' ? 'بەرنامەکە بەسەرکەوتوویی دابەزێنرا!' : 'App installed successfully!');
    });

    // 3. Web Share Target Handler (Receiving files shared directly from mobile/desktop folder/share menu)
    if (window.location.search.includes('shared=1')) {
      fetch('./shared-subtitle-data')
        .then((res) => {
          if (!res.ok) return null;
          const headerFilename = res.headers.get('X-Shared-Filename');
          const fileName = headerFilename ? decodeURIComponent(headerFilename) : 'shared_subtitle.srt';
          return res.blob().then((blob) => new File([blob], fileName, { type: blob.type || 'text/plain' }));
        })
        .then((fileObj) => {
          if (fileObj) {
            const cleanUrl = window.location.pathname + window.location.hash;
            window.history.replaceState({}, '', cleanUrl);
            handleFile(fileObj);
            toast(currentUiLang === 'ckb' ? 'فایلی هاوبەشکراو بەسەرکەوتوویی بارکرا!' : 'Shared file loaded successfully!');
          }
        })
        .catch((err) => console.error('Error loading shared file:', err));
    }

    // 4. File Handling API (Opening subtitle files directly from OS/File Explorer)
    if ('launchQueue' in window && 'files' in window.LaunchParams.prototype) {
      window.launchQueue.setConsumer(async (launchParams) => {
        if (!launchParams.files || !launchParams.files.length) return;
        try {
          const fileHandle = launchParams.files[0];
          const fileData = await fileHandle.getFile();
          handleFile(fileData);
          toast(currentUiLang === 'ckb' ? 'فایلی کراوە بەسەرکەوتوویی بارکرا!' : 'Opened file loaded successfully!');
        } catch (err) {
          console.error('File Handling API error:', err);
        }
      });
    }
  }

  // ---------- Init ----------
  function init() {
    if (els.previewTab && els.previewTab.classList) els.previewTab.classList.add('disabled'); // enabled once a file is loaded
    if (els.srcLang) {
      for (const [code, name] of Object.entries(SOURCE_LANGS)) {
        const o = document.createElement('option');
        o.value = code;
        o.textContent = name;
        els.srcLang.appendChild(o);
      }
    }
    bindDropzone();
    bindActions();
    bindFs();
    bindTour();
    if (typeof SubtitlePlayer !== 'undefined' && SubtitlePlayer.init) {
      SubtitlePlayer.init();
    }

    setupPWA();

    // Warm the translation endpoint so the first real request isn't a cold one
    // (Google sometimes throttles the first hit and answers on a warm retry).
    if (typeof Translator !== 'undefined' && Translator.warmup) {
      Translator.warmup();
    }

    if (els.srcLang) els.srcLang.value = store.get('srcLang', 'auto');
    if (els.keepOnly) els.keepOnly.checked = store.get('keepOnly', '0') === '1';
    if (els.includeOriginal) els.includeOriginal.checked = store.get('includeOriginal', '0') === '1';
    if (els.accuracyToggle) els.accuracyToggle.checked = store.get('accuracy', '0') === '1';
    if (els.kurdishDigitsToggle) els.kurdishDigitsToggle.checked = store.get('kurdishDigits', '0') === '1';
    if (els.fixOverlapToggle) els.fixOverlapToggle.checked = store.get('fix_overlap', '1') !== '0';
    if (els.addBomToggle) els.addBomToggle.checked = store.get('addBom', '0') === '1';
    if (els.crlfToggle) els.crlfToggle.checked = store.get('useCrlf', '0') === '1';
    if (els.showTimeToggle) els.showTimeToggle.checked = store.get('showTime', '1') === '1';
    if (els.saveEditsToggle) els.saveEditsToggle.checked = store.get('saveEdits', '1') === '1';
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
        if (els.editorList) {
          const inputs = els.editorList.querySelectorAll('.ed-input');
          inputs.forEach((input) => autoGrow(input));
        }
        if (fsActive) fitFsText();
      }, 100);
    });
  }

  init();
})();
