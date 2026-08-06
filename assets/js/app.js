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
    no: 'Norwegian', da: 'Danish', pl: 'Polish', uk: 'Ukrainian', gr: 'Greek',
    sq: 'Albanian', ro: 'Romanian', fi: 'Finnish', he: 'Hebrew', id: 'Indonesian',
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
    translateBtn: '#translateBtn',
    progressFill: '#progressFill', progressPct: '#progressPct',
    progressDetail: '#progressDetail', lineCount: '#lineCount', cancelBtn: '#cancelBtn',
    downloadBtn: '#downloadBtn', copyBtn: '#copyBtn',
    translateAgainBtn: '#translateAgainBtn', doneFormat: '#doneFormat', doneSize: '#doneSize',
    previewTab: '#previewTab', tabTranslate: '#tabTranslate', tabPreview: '#tabPreview',
    toast: '#toast',
  });
  const tabButtons = $$('.tab');

  // ---------- State ----------
  let file = null;
  let parsed = null;
  let resultText = null;
  let resultUrl = null;
  let cancelFlag = false;

  // ---------- Helpers ----------
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

  const stripTags = (text) => text.replace(/<[^>]+>/g, '');

  function loadPreview() {
    SubtitlePlayer.load(parsed.cues.map((c) => ({ ...c, text: stripTags(c.text) })));
    els.previewTab.classList.remove('disabled');
  }

  // ---------- Tabs ----------
  function switchTab(name) {
    tabButtons.forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    els.tabTranslate.classList.toggle('hidden', name !== 'translate');
    els.tabPreview.classList.toggle('hidden', name !== 'preview');
    if (name === 'preview' && !parsed) toast('Load a subtitle file first.', true);
  }
  tabButtons.forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));

  // ---------- File handling ----------
  function handleFile(f) {
    if (!f) return;
    const ext = f.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      toast('Unsupported file. Use .SRT, .VTT, .ASS, .SSA, .SUB or .SMI', true);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try { parsed = SubParser.parse(e.target.result); }
      catch { toast('Could not read this subtitle file.', true); return; }

      if (!parsed.cues.length) { toast('No subtitles found in this file.', true); return; }

      file = f;
      resultText = null;
      els.fileName.textContent = f.name;
      els.fileMeta.textContent = `${parsed.cues.length} lines • ${LABEL[parsed.format] || parsed.format.toUpperCase()}`;
      loadPreview();
      showStep('settings');
    };
    reader.onerror = () => toast('Failed to read file.', true);
    reader.readAsText(f, 'UTF-8');
  }

  function bindDropzone() {
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

    els.changeFile.addEventListener('click', () => { els.fileInput.value = ''; els.fileInput.click(); });
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
    const isAss = parsed.format === 'ass' || parsed.format === 'ssa';
    const normalize = (c) => (isAss ? c.text.replace(/\\N/g, '\n') : c.text);

    try {
      const lines = parsed.cues.map(normalize);
      const translated = await Translator.translateLines(lines, srcLang, tgtLang, (p) => {
        if (cancelFlag) return;
        setProgress(p, `Batch ${Math.round(p * 100)}% complete`);
      });

      const translatedCues = parsed.cues.map((c, i) => ({
        ...c,
        text: translated[i] && translated[i].trim() ? translated[i].trim() : c.text,
      }));

      const finalCues = els.keepOnly.checked
        ? translatedCues.filter((c) => c.text.trim() !== '')
        : translatedCues;

      prepareDownload(finalCues);
      showStep('done');
    } catch (err) {
      console.error(err);
      toast('Translation failed. Check your internet connection and try again.', true);
      showStep('settings');
    } finally {
      els.translateBtn.disabled = false;
    }
  }

  function prepareDownload(cues) {
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
      resultText = null;
      showStep('settings');
    });
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
    SubtitlePlayer.init();
  }

  init();
})();
