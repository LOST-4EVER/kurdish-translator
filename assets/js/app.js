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
    translateBtn: '#translateBtn',
    progressFill: '#progressFill', progressPct: '#progressPct',
    progressDetail: '#progressDetail', lineCount: '#lineCount', cancelBtn: '#cancelBtn',
    downloadBtn: '#downloadBtn', copyBtn: '#copyBtn',
    translateAgainBtn: '#translateAgainBtn', doneFormat: '#doneFormat', doneSize: '#doneSize',
    previewBtn: '#previewBtn',
    previewTab: '#previewTab', tabTranslate: '#tabTranslate', tabPreview: '#tabPreview',
    installBtn: '#installBtn',
    toast: '#toast',
    editorList: '#editorList', editorStatus: '#editorStatus',
    showTimeToggle: '#showTimeToggle', saveEditsToggle: '#saveEditsToggle',
    fsEdit: '#fsEdit', fsScreen: '#fsScreen', fsText: '#fsText', fsCueCount: '#fsCueCount',
    fsToggleBtn: '#fsToggleBtn', fsEditBtn: '#fsEditBtn', fsClose: '#fsClose',
    fsPrevBtn: '#fsPrevBtn', fsNextBtn: '#fsNextBtn',
    fsEditor: '#fsEditor', fsInput: '#fsInput', fsDoneBtn: '#fsDoneBtn',
  });
  const tabButtons = $$('.tab');

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
  const hasArabic = (s) => /[\u0600-\u06FF\u0750-\u077F]/.test(s);

  // ---------- Helpers ----------
  const store = {
    get(key, fallback) { try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch { return fallback; } },
    set(key, val) { try { localStorage.setItem(key, val); } catch {} },
  };
  let toastTimer;
  function toast(msg, isError = false) {
    els.toast.textContent = msg;
    els.toast.classList.toggle('error', isError);
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 3200);
  }

  function showStep(name) {
    STEPS.forEach((s) => els['step' + s[0].toUpperCase() + s.slice(1)].classList.add('hidden'));
    els['step' + name[0].toUpperCase() + name.slice(1)].classList.remove('hidden');
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

  /** Write a user edit into a cue: player screen, dirty flag, debounced download. */
  function applyCueEdit(i, text) {
    if (i < 0 || !workCues[i]) return;
    workCues[i].text = text;
    SubtitlePlayer.updateText(i, stripTags(text));
    dirty = true;
    updateStatus();
    clearTimeout(prepareTimer);
    prepareTimer = setTimeout(prepareDownload, 250);
  }

  function loadPreview(cues = workCues) {
    SubtitlePlayer.load(cues.map((c) => ({ ...c, text: displayText(c.text) })));
    els.previewTab.classList.remove('disabled');
  }

  // ---------- Subtitle editor ----------
  function fmtTime(ms) {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const cs = ms % 1000;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(cs).padStart(3, '0')}`;
  }

  function autoGrow(el) {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  function updateStatus() {
    els.editorStatus.textContent = dirty
      ? (els.saveEditsToggle.checked ? 'Unsaved edits — they go into your download' : 'Edits shown here only — not saved to download')
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
      return;
    }

    const frag = document.createDocumentFragment();
    workCues.forEach((c, i) => {
      const row = document.createElement('div');
      row.className = 'ed-row';
      row.dataset.index = i;

      const meta = document.createElement('div');
      meta.className = 'ed-meta';

      const idx = document.createElement('span');
      idx.className = 'ed-idx';
      idx.textContent = String(i + 1).padStart(2, '0');

      const time = document.createElement('span');
      time.className = 'ed-time';
      time.textContent = `${fmtTime(c.start)} → ${fmtTime(c.end)}`;
      time.classList.toggle('hidden', !showTime);

      meta.appendChild(idx);
      meta.appendChild(time);
      row.appendChild(meta);

      const input = document.createElement('textarea');
      input.className = 'ed-input';
      input.value = displayText(c.text);
      input.setAttribute('dir', dirFor(input.value));
      input.setAttribute('aria-label', `Cue ${i + 1} text`);
      row.appendChild(input);
      frag.appendChild(row);
      autoGrow(input);

      input.addEventListener('input', () => {
        autoGrow(input);
        applyCueEdit(i, input.value);
      });
      input.addEventListener('focus', () => {
        row.classList.add('editing');
        editWasPlaying = SubtitlePlayer.playing;
        SubtitlePlayer.pause();
      });
      input.addEventListener('blur', () => {
        row.classList.remove('editing');
        if (editWasPlaying) SubtitlePlayer.play();
      });

      row.addEventListener('click', (e) => {
        if (e.target.closest('.ed-input')) return;
        SubtitlePlayer.seek(c.start);
        if (!SubtitlePlayer.playing) SubtitlePlayer.play();
      });
    });
    list.appendChild(frag);
  }

  function scrollRowIntoView(row) {
    const list = els.editorList;
    const r = row.getBoundingClientRect();
    const b = list.getBoundingClientRect();
    if (r.top < b.top || r.bottom > b.bottom) {
      row.scrollIntoView({ block: 'center', behavior: 'smooth' });
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
    els.editorList.querySelectorAll('.ed-row.active').forEach((r) => r.classList.remove('active'));
    const row = els.editorList.querySelector(`[data-index="${idx}"]`);
    if (row) { row.classList.add('active'); scrollRowIntoView(row); }
  });

  /** Swap in a fresh cue set (original or translated) and rebuild everything. */
  function updateCues(cues) {
    baseCues = cues.map((c) => ({ ...c }));
    workCues = cues.map((c) => ({ ...c }));
    dirty = false;
    activeIdx = -1;
    if (fsActive) exitFs();
    loadPreview(workCues);
    buildEditor();
    prepareDownload();
    updateStatus();
  }

  // ---------- Fullscreen edit mode ----------
  function updateFsScreen() {
    const cue = activeIdx >= 0 && workCues[activeIdx] ? workCues[activeIdx] : null;
    els.fsText.textContent = cue ? displayText(cue.text) : '';
    els.fsText.setAttribute('dir', cue ? dirFor(cue.text) : 'ltr');
    els.fsCueCount.textContent = cue ? `${cue.index} / ${workCues.length}` : '';
  }

  function syncFsEditor(i) {
    if (i < 0 || !workCues[i]) return;
    fsCueIndex = i;
    els.fsInput.value = displayText(workCues[i].text);
    els.fsInput.setAttribute('dir', dirFor(els.fsInput.value));
  }

  function openFsEditor() {
    const i = activeIdx;
    if (i < 0 || !workCues[i]) return;
    syncFsEditor(i);
    els.fsEditor.classList.remove('hidden');
    editWasPlaying = SubtitlePlayer.playing;
    SubtitlePlayer.pause(); // freeze the cue so you can type without it skipping away
    els.fsInput.focus(); // pops the keyboard so you can tap-edit immediately
  }

  function closeFsEditor() {
    els.fsEditor.classList.add('hidden');
    if (editWasPlaying) SubtitlePlayer.play();
  }

  function enterFs() {
    if (!parsed || !workCues || !workCues.length) { toast('Load a subtitle file first.', true); return; }
    fsActive = true;
    els.fsEdit.classList.remove('hidden');
    updateFsScreen();
  }

  function exitFs() {
    fsActive = false;
    els.fsEdit.classList.add('hidden');
    closeFsEditor();
  }

  function bindFs() {
    els.fsToggleBtn.addEventListener('click', () => (fsActive ? exitFs() : enterFs()));
    els.fsClose.addEventListener('click', exitFs);
    els.fsText.addEventListener('click', openFsEditor); // tap any word → editor at the bottom
    els.fsEditBtn.addEventListener('click', openFsEditor);
    els.fsDoneBtn.addEventListener('click', closeFsEditor);
    els.fsPrevBtn.addEventListener('click', () => SubtitlePlayer.stepCue(-1));
    els.fsNextBtn.addEventListener('click', () => SubtitlePlayer.stepCue(1));

    els.fsInput.addEventListener('input', () => {
      if (fsCueIndex < 0 || !workCues[fsCueIndex]) return;
      applyCueEdit(fsCueIndex, els.fsInput.value);
      updateFsScreen();
    });

    document.addEventListener('keydown', (e) => {
      if (!fsActive) return;
      if (e.key === 'Escape') {
        document.activeElement === els.fsInput ? closeFsEditor() : exitFs();
      }
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
  const encodeBites = (n) => n < 1024 ? `${n} B`
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
      toast('Unsupported file. Use .SRT, .VTT, .ASS, .SSA, .SUB or .SMI', true);
      return;
    }

    let text;
    try { text = await readFileAsText(f); }
    catch { toast('Failed to read file.', true); return; }

    let parsedFile;
    try { parsedFile = SubParser.parse(text); }
    catch { toast('Could not detect subtitle content in this file.', true); return; }
    if (!parsedFile.cues.length) { toast('No subtitles found in this file.', true); return; }

    file = f;
    parsed = parsedFile;
    resultText = null;
    if (resultUrl) { URL.revokeObjectURL(resultUrl); resultUrl = null; }
    els.fileName.textContent = f.name;
    els.fileMeta.textContent = `${parsed.cues.length} lines • ${encodeBites(f.size)} • ${LABEL[parsed.format] || parsed.format.toUpperCase()}`;
    updateCues(parsed.cues);
    // Show the options first so the user picks settings before translating.
    showStep('settings');
  }

  function bindDropzone() {
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
    let dragCounter = 0;
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

    const srcLang = els.srcLang.value;
    const tgtLang = els.tgtLang.value;
    const includeOriginal = els.includeOriginal.checked;
    const accuracy = els.accuracyToggle.checked;
    const isAss = parsed.format === 'ass' || parsed.format === 'ssa';
    const normalize = (c) => (isAss ? c.text.replace(/\\N/g, '\n') : c.text);
    const controller = new AbortController();
    activeController = controller;

    try {
      const lines = parsed.cues.map(normalize);
      const translated = await Translator.translateLines(lines, srcLang, tgtLang, (p, done, total) => {
        if (cancelFlag) return;
        setProgress(p, `Translated ${done} / ${total} lines`);
      }, controller.signal, { accuracy });
      if (cancelFlag) return; // cancelled mid-run: discard results, stay on settings

      const translatedCues = parsed.cues.map((c, i) => {
        const tr = translated[i] && translated[i].trim() ? translated[i].trim() : null;
        // "Include original" stacks the source line above the translation.
        if (includeOriginal && tr && tr !== c.text) return { ...c, text: `${c.text}\n${tr}` };
        return { ...c, text: tr || c.text };
      });

      const finalCues = els.keepOnly.checked
        ? translatedCues.filter((c) => c.text.trim() !== '')
        : translatedCues;

      updateCues(finalCues);
      showStep('done');
    } catch (err) {
      if (cancelFlag) return; // aborted by the user, already handled
      console.error(err);
      toast('Translation failed. Check your internet connection and try again.', true);
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
    resultText = SubParser.serialize(parsed, cues);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = URL.createObjectURL(new Blob([resultText], { type: 'text/plain;charset=utf-8' }));

    const ext = EXT_BY_FORMAT[parsed.format] || 'srt';
    const base = file.name.replace(/\.[^.]+$/, '');
    els.downloadBtn.href = resultUrl;
    els.downloadBtn.download = `${base}.ckb.${ext}`;
    els.doneFormat.textContent = LABEL[parsed.format] || parsed.format.toUpperCase();
    els.doneSize.textContent = `${(resultText.length / 1024).toFixed(1)} KB`;
  }

  // ---------- Wire up ----------
  function bindActions() {
    els.translateBtn.addEventListener('click', startTranslation);

    els.cancelBtn.addEventListener('click', () => {
      cancelFlag = true;
      if (activeController) activeController.abort();
      toast('Cancelled.');
      showStep('settings');
    });

    els.copyBtn.addEventListener('click', async () => {
      if (!resultText) { toast('Nothing to copy yet.', true); return; }
      try {
        await navigator.clipboard.writeText(resultText);
        toast('Copied to clipboard!');
      } catch {
        toast('Copy failed on this device.', true);
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

    // Persist settings between visits.
    els.srcLang.addEventListener('change', () => store.set('srcLang', els.srcLang.value));
    els.keepOnly.addEventListener('change', () => store.set('keepOnly', els.keepOnly.checked ? '1' : '0'));
    els.includeOriginal.addEventListener('change', () => store.set('includeOriginal', els.includeOriginal.checked ? '1' : '0'));
    els.accuracyToggle.addEventListener('change', () => store.set('accuracy', els.accuracyToggle.checked ? '1' : '0'));
  }

  // ---------- Init ----------
  function init() {
    for (const [code, name] of Object.entries(SOURCE_LANGS)) {
      const o = document.createElement('option');
      o.value = code;
      o.textContent = name;
      els.srcLang.appendChild(o);
    }
    bindDropzone();
    bindActions();
    bindFs();
    SubtitlePlayer.init();

    // PWA: register service worker for installability + offline app shell.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }

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
    els.showTimeToggle.checked = store.get('showTime', '1') === '1';
    els.saveEditsToggle.checked = store.get('saveEdits', '1') === '1';
    buildEditor();
  }

  init();
})();
