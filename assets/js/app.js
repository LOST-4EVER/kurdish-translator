/**
 * app.js — UI controller: file drop, settings, translation flow, download.
 */
(() => {
  const $ = (sel) => document.querySelector(sel);

  const els = {
    stepUpload: $('#stepUpload'),
    stepSettings: $('#stepSettings'),
    stepProgress: $('#stepProgress'),
    stepDone: $('#stepDone'),
    dropzone: $('#dropzone'),
    fileInput: $('#fileInput'),
    fileName: $('#fileName'),
    fileMeta: $('#fileMeta'),
    changeFile: $('#changeFile'),
    srcLang: $('#srcLang'),
    tgtLang: $('#tgtLang'),
    keepOnly: $('#keepOnly'),
    translateBtn: $('#translateBtn'),
    progressFill: $('#progressFill'),
    progressPct: $('#progressPct'),
    progressDetail: $('#progressDetail'),
    lineCount: $('#lineCount'),
    cancelBtn: $('#cancelBtn'),
    downloadBtn: $('#downloadBtn'),
    translateAgainBtn: $('#translateAgainBtn'),
    toast: $('#toast'),
  };

  // ---- Language options (translated INTO Kurdish, so source is everything else)
  const LANGS = {
    en: 'English', ar: 'Arabic', tr: 'Turkish', fa: 'Persian (Farsi)',
    de: 'German', fr: 'French', es: 'Spanish', ru: 'Russian', it: 'Italian',
    nl: 'Dutch', pt: 'Portuguese', zh: 'Chinese', ja: 'Japanese', ko: 'Korean',
    hi: 'Hindi', ur: 'Urdu', ps: 'Pashto', az: 'Azerbaijani', sv: 'Swedish',
    no: 'Norwegian', da: 'Danish', pl: 'Polish', uk: 'Ukrainian', gr: 'Greek',
    sq: 'Albanian', ro: 'Romanian', fi: 'Finnish', he: 'Hebrew', id: 'Indonesian',
  };
  for (const [code, name] of Object.entries(LANGS)) {
    const o = document.createElement('option');
    o.value = code; o.textContent = name;
    els.srcLang.appendChild(o);
  }

  let file = null;
  let parsed = null;
  let translatedCues = null;
  let cancelFlag = false;

  // ---- Toast
  let toastTimer;
  function toast(msg, isError = false) {
    els.toast.textContent = msg;
    els.toast.classList.toggle('error', isError);
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 3200);
  }

  // ---- Step navigation
  function showStep(name) {
    els.stepUpload.classList.add('hidden');
    els.stepSettings.classList.add('hidden');
    els.stepProgress.classList.add('hidden');
    els.stepDone.classList.add('hidden');
    els['step' + name[0].toUpperCase() + name.slice(1)].classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---- File handling
  const ALLOWED = ['srt', 'vtt', 'ass', 'ssa', 'sub', 'smi'];
  const EXT_BY_FORMAT = { srt: 'srt', vtt: 'vtt', ass: 'ass', ssa: 'ssa', sub: 'sub', smi: 'smi' };
  const LABEL = { srt: 'SRT', vtt: 'VTT', ass: 'ASS', ssa: 'SSA', sub: 'MicroDVD', smi: 'SAMI' };

  function handleFile(f) {
    if (!f) return;
    const name = f.name.toLowerCase();
    const ext = name.split('.').pop();
    if (!ALLOWED.includes(ext)) {
      toast('Unsupported file. Use .SRT, .VTT, .ASS, .SSA, .SUB or .SMI', true);
      return;
    }
    file = f;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        parsed = SubParser.parse(e.target.result);
      } catch (err) {
        toast('Could not read this subtitle file.', true);
        return;
      }
      if (!parsed.cues.length) {
        toast('No subtitles found in this file.', true);
        return;
      }
      els.fileName.textContent = f.name;
      els.fileMeta.textContent = `${parsed.cues.length} lines • ${LABEL[parsed.format] || parsed.format.toUpperCase()}`;
      showStep('settings');
    };
    reader.onerror = () => toast('Failed to read file.', true);
    reader.readAsText(f, 'UTF-8');
  }

  // ---- Dropzone events
  els.dropzone.addEventListener('click', () => els.fileInput.click());
  els.fileInput.addEventListener('change', (e) => { handleFile(e.target.files[0]); e.target.value = ''; });

  ['dragenter', 'dragover'].forEach((ev) =>
    els.dropzone.addEventListener(ev, (e) => { e.preventDefault(); els.dropzone.classList.add('dragover'); })
  );
  ['dragleave', 'drop'].forEach((ev) =>
    els.dropzone.addEventListener(ev, (e) => { e.preventDefault(); els.dropzone.classList.remove('dragover'); })
  );
  els.dropzone.addEventListener('drop', (e) => {
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    handleFile(f);
  });
  els.dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); els.fileInput.click(); }
  });

  els.changeFile.addEventListener('click', () => {
    els.fileInput.value = '';
    els.fileInput.click();
  });

  // ---- Translate
  els.translateBtn.addEventListener('click', async () => {
    if (!parsed) return;
    cancelFlag = false;
    showStep('progress');
    els.cancelBtn.classList.remove('hidden');
    els.progressFill.style.width = '0%';
    els.progressPct.textContent = '0%';
    els.lineCount.textContent = `${parsed.cues.length} lines`;
    els.translateBtn.disabled = true;

    const srcLang = els.srcLang.value;
    const tgtLang = els.tgtLang.value;
    const keepOnly = els.keepOnly.checked;
    const isAss = parsed.format === 'ass' || parsed.format === 'ssa';

    // ASS uses \N for hard line breaks — normalize to real newlines for the
    // translator's newline protection, and let serialize() convert back.
    const lines = parsed.cues.map((c) => (isAss ? c.text.replace(/\\N/g, '\n') : c.text));

    try {
      translatedCues = parsed.cues.map((c) => ({ ...c }));
      const translated = await Translator.translateLines(lines, srcLang, tgtLang, (p) => {
        if (cancelFlag) return;
        const pct = Math.round(p * 100);
        els.progressFill.style.width = pct + '%';
        els.progressPct.textContent = pct + '%';
        els.progressDetail.textContent = `Batch ${Math.min(Math.floor(p * 100), 100)}% complete`;
      });

      translatedCues.forEach((cue, i) => {
        cue.text = translated[i] && translated[i].trim() ? translated[i].trim() : cue.text;
      });

      if (keepOnly) {
        // "Translate subtitles only" keeps the single-line subtitles that are
        // purely subtitles; here it simply means we drop empty ones.
        translatedCues = translatedCues.filter((c) => c.text.trim() !== '');
      }

      const ext = EXT_BY_FORMAT[parsed.format] || 'srt';
      const blob = new Blob([SubParser.serialize(parsed, translatedCues)], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const base = file.name.replace(/\.([a-z0-9]+)$/i, '');
      els.downloadBtn.href = url;
      els.downloadBtn.download = `${base}.ckb.${ext}`;

      showStep('done');
    } catch (err) {
      console.error(err);
      toast('Translation failed. Check your internet connection and try again.', true);
      showStep('settings');
    } finally {
      els.translateBtn.disabled = false;
    }
  });

  els.cancelBtn.addEventListener('click', () => {
    cancelFlag = true;
    toast('Cancelled.');
    showStep('settings');
  });

  els.translateAgainBtn.addEventListener('click', () => {
    translatedCues = null;
    showStep('settings');
  });
})();
