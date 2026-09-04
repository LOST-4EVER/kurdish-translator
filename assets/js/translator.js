/**
 * translator.js — Multi-provider batch translation engine using Google Translate,
 * Lingva Translate instances, and MyMemory APIs (no API key required, 100% free,
 * works directly on GitHub Pages and offline-ready PWA).
 *
 * Provides deep British English colloquialism & idiom normalizers, multi-engine
 * fallback routing, cinema dialogue naturalization, and Kurdish Sorani orthography.
 */
const Translator = (() => {
  // Primary Google free endpoints with proven high stability & CORS compatibility
  const GOOGLE_T_ENDPOINTS = [
    'https://clients5.google.com/translate_a/t',
    'https://clients1.google.com/translate_a/t',
    'https://clients2.google.com/translate_a/t',
    'https://clients3.google.com/translate_a/t',
    'https://clients4.google.com/translate_a/t',
    'https://translate.googleapis.com/translate_a/t',
  ];

  const GOOGLE_ENDPOINTS = [
    'https://translate.googleapis.com/translate_a/single',
    'https://clients5.google.com/translate_a/single',
    'https://clients1.google.com/translate_a/single',
    'https://clients2.google.com/translate_a/single',
    'https://clients3.google.com/translate_a/single',
    'https://clients4.google.com/translate_a/single',
    'https://clients5.google.com/translate_a/t',
    'https://clients1.google.com/translate_a/t',
    'https://translate.googleapis.com/translate_a/t',
  ];

  // Secondary public privacy-friendly Lingva Translate instances
  const LINGVA_INSTANCES = [
    'https://lingva.ml/api/v1',
    'https://translate.plausibility.cloud/api/v1',
    'https://lingva.garudalinux.org/api/v1',
    'https://lingva.lunar.icu/api/v1',
  ];

  // MyMemory Translation API endpoint
  const MYMEMORY_ENDPOINT = 'https://api.mymemory.translated.net/get';

  const BATCH_LINES = 20;
  const MAX_CHARS_PER_REQUEST = 1600;
  const DELAY_MS = 120;
  const MAX_ATTEMPTS = 6;
  const REQUEST_TIMEOUT_MS = 8000;

  // Sentinel protecting internal line breaks inside a cue
  const NL_SENTINEL = '§§';

  // Control character that delimits lines inside a batch request
  const BATCH_SEP = '\u0001';
  const BATCH_SEP_RE = /^[ \t\u200e\u200f.,!?;:،؛؟]*\u0001[ \t\u200e\u200f.,!?;:،؛؟]*$/;

  // Subtitle markup tag regex
  const MARKUP_RE = /\{[^}]*\}|<[^>]*>/g;

  // Abort-aware delay
  const sleep = (ms, signal) => new Promise((resolve) => {
    if (!signal) { setTimeout(resolve, ms); return; }
    if (signal.aborted) { resolve(); return; }
    let timer;
    const onAbort = () => { clearTimeout(timer); resolve(); };
    timer = setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve(); }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });

  const restoreNewlines = (s) =>
    s.replace(/[\s\u200e\u200f]*§[\s\u200e\u200f]*§[\s\u200e\u200f]*/g, '\n')
     .replace(/[\s\u200e\u200f]*§[\s\u200e\u200f]*/g, '\n');

  /** Replace subtitle markup with bracketed tokens so translation engines keep them verbatim. */
  function protect(text) {
    const toks = [];
    const out = text.replace(MARKUP_RE, (m) => {
      const id = toks.length;
      toks.push(m);
      return '[T' + id + ']';
    });
    return { text: out, toks };
  }

  /** Put the original markup back in place of bracketed tokens. */
  function cleanLeftoverTokens(text) {
    if (!text) return '';
    return text
      .replace(/\[\s*(?:T|t|W|w|P|p|Z|z|X|x|ت|تاک|تی|تۆ|پی|پێ|ٹی|ز|زێد|و)\s*[-_:]?\s*[\d\u0660-\u0669\u06f0-\u06f9]*\s*\]/gi, '')
      .replace(/\(\s*(?:T|t|W|w|P|p|Z|z|X|x|ت|تاک|تی|تۆ|پی|پێ|ٹی|ز|زێد|و)\s*[-_:]?\s*[\d\u0660-\u0669\u06f0-\u06f9]*\s*\)/gi, '')
      .replace(/\{\s*(?:T|t|W|w|P|p|Z|z|X|x|ت|تاک|تی|تۆ|پی|پێ|ٹی|ز|زێد|و)\s*[-_:]?\s*[\d\u0660-\u0669\u06f0-\u06f9]*\s*\}/gi, '')
      .replace(/\b(?:T|t|W|w|P|p|Z|z|X|x)\s*[-_:]?\s*[\d\u0660-\u0669\u06f0-\u06f9]+\b/gi, '')
      .replace(/(?:^|[\s،؛؟.,!?:])(?:[تپو][0-9\u0660-\u0669\u06f0-\u06f9]+)(?=[\s،؛؟.,!?:]|$)/g, ' ')
      .replace(/(^|[\s،؛؟.\n])[WwPpTt](?=[\s،؛؟.,!?:-]|$)/g, '$1')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }

  function restore(s, toks) {
    if (!s) return '';
    if (!toks || !toks.length) return cleanLeftoverTokens(s);

    let res = s.replace(/(?:\[|\(|\{)\s*(?:T|t|W|w|P|p|Z|z|X|x|ت|تاک|تی|تۆ|پی|پێ|ٹی|ز|زێد|و|پ)\s*[-_:]?\s*([\d\u0660-\u0669\u06f0-\u06f9]+)\s*(?:\]|\)|\})|\b(?:T|t|W|w|P|p|Z|z|X|x)\s*[-_:]?\s*([\d\u0660-\u0669\u06f0-\u06f9]+)\b|(?:^|[\s،؛؟.,!?:])([تپو])\s*[-_:]?\s*([\d\u0660-\u0669\u06f0-\u06f9]+)(?=[\s،؛؟.,!?:]|$)/gi, (fullMatch, n1, n2, prefix, n3) => {
      const numStr = n1 || n2 || n3;
      if (!numStr) return '';
      const ascii = numStr.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
                          .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
      const id = parseInt(ascii, 10);
      return toks[id] !== undefined ? toks[id] : '';
    });

    if (toks.length === 1 && !res.includes(toks[0])) {
      const singleMatch = res.match(/(?:\[|\(|\{)\s*(?:T|t|W|w|P|p|و|ت|پ)\s*(?:\]|\)|\})/i);
      if (singleMatch) {
        res = res.replace(singleMatch[0], toks[0]);
      }
    }

    return cleanLeftoverTokens(res);
  }

  function fixPlacementAndTagOrder(text, originalText) {
    if (!text || !originalText) return text || '';
    const origLines = originalText.split('\n');
    const transLines = text.split('\n');

    const fixed = transLines.map((tLine, i) => {
      const origLine = origLines[i] || origLines[0] || '';
      let line = tLine;

      const leadTagMatch = origLine.match(/^((?:\{[^}]+\}|<[^>]+>\s*)+)/);
      if (leadTagMatch) {
        const leadTags = leadTagMatch[1].trim();
        if (/^\{[^{}]*\\(?:an?\d|pos|move|fad|org|c&|1c&|3c&|4c&|fn|fs|b\d|i\d|shad|bord)[^{}]*\}/i.test(leadTags) || /^<(?:top|font\b)/i.test(leadTags)) {
          if (!line.startsWith(leadTags)) {
            let stripped = line;
            const escaped = leadTags.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            stripped = stripped.replace(new RegExp(escaped, 'g'), '').trim();
            line = leadTags + (stripped ? (leadTags.startsWith('{') ? stripped : ' ' + stripped) : '');
          }
        }
      }

      const trailTagMatch = origLine.match(/((?:<\/[a-z0-9]+>\s*)+)$/i);
      if (trailTagMatch) {
        const trailTags = trailTagMatch[1].trim();
        if (!line.endsWith(trailTags)) {
          let stripped = line;
          const escaped = trailTags.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          stripped = stripped.replace(new RegExp(escaped, 'g'), '').trim();
          line = (stripped ? stripped + ' ' : '') + trailTags;
        }
      }
      return line.trim();
    });

    return fixed.join('\n').trim();
  }

  const ARABIC_SCRIPT = new Set(['ckb', 'fa', 'ar', 'ur', 'ps']);

  // Table-driven English colloquial & spoken contraction replacements
  const PREPROCESS_REPLACEMENTS = [
    // Multi-speaker dialogue hyphens
    [/(?:^|\n)\s*[-—–]\s*([^\n]+?)\s+[-—–]\s*([^\n]+)/g, '- $1\n- $2'],
    // Gerund colloquialisms: lookin' -> looking
    [/\b([a-zA-Z]{2,})in['’](?=\s|[.,!?;:'"()[\]{}<>]|$)/gi, '$1ing'],
    // British & slang terms
    [/\bbloody\s+hell\b/gi, 'oh goodness'],
    [/\bbloody\b/gi, 'damn'],
    [/\bbollocks\b/gi, 'nonsense'],
    [/\bbugger\s+off\b/gi, 'go away'],
    [/\bbugger\b/gi, 'damn'],
    [/\bblimey\b/gi, 'my goodness'],
    [/\bchuffed\b/gi, 'delighted'],
    [/\bgutted\b/gi, 'devastated'],
    [/\bdodgy\b/gi, 'suspicious'],
    [/\bknackered\b/gi, 'exhausted'],
    [/\bcheerio\b/gi, 'goodbye'],
    [/\btaking\s+the\s+piss\b/gi, 'making fun'],
    [/\bpiss\s+off\b/gi, 'go away'],
    [/\bpissed\s+off\b/gi, 'angry'],
    [/\binnit\b/gi, 'is it not'],
    [/\bquid\b/gi, 'pounds'],
    [/\bbloke\b|\bchap\b/gi, 'man'],
    [/\bcheers\s+mate\b/gi, 'thank you friend'],
    [/\bcheers\b/gi, 'thank you'],
    // Common spoken contractions & abbreviations
    [/\bgonna\b/gi, 'going to'],
    [/\bwanna\b/gi, 'want to'],
    [/\bgotta\b/gi, 'have to'],
    [/\bwoulda\b/gi, 'would have'],
    [/\bcoulda\b/gi, 'could have'],
    [/\bshoulda\b/gi, 'should have'],
    [/\bmusta\b/gi, 'must have'],
    [/\bkinda\b/gi, 'kind of'],
    [/\bsorta\b/gi, 'sort of'],
    [/\blotta\b/gi, 'lot of'],
    [/\balot\b/gi, 'a lot'],
    [/\basap\b/gi, 'as soon as possible'],
    [/\bfyi\b/gi, 'for your information'],
    [/\bbtw\b/gi, 'by the way'],
    [/\btbh\b/gi, 'to be honest'],
    [/\bdunno\b/gi, 'do not know'],
    [/\bi['’]?mma\b/gi, 'I am going to'],
    [/\bain['’]?t\b/gi, 'is not'],
    [/\bwhatcha\b/gi, 'what are you'],
    [/\bgotcha\b/gi, 'I understand'],
    [/\bgimme\b/gi, 'give me'],
    [/\blemme\b/gi, 'let me'],
    [/\boutta\b/gi, 'out of'],
    [/\by['’]?all\b/gi, 'you all'],
    [/\bcuz\b|\bcoz\b/gi, 'because'],
    [/\bc['’]mon\b/gi, 'come on'],
    [/\bw\/\b/gi, 'with'],
    [/\bw\/o\b/gi, 'without'],
    [/\bpls\b|\bplz\b/gi, 'please'],
    [/\bthx\b|\bty\b/gi, 'thank you'],
    [/\bthru\b/gi, 'through'],
    [/\btil\b|\btill\b/gi, 'until'],
    [/\byeah\b|\byep\b|\byup\b/gi, 'yes'],
    [/\bnope\b|\bnah\b/gi, 'no'],
    [/\bwhat['’]?s\s+up\b|\bwassup\b|\bsup\b/gi, 'hello, how are you'],
    [/\bno\s+way\b/gi, 'that is impossible'],
    [/\bnever\s+mind\b/gi, 'do not worry'],
    [/\bhang\s+on\b|\bhold\s+on\b/gi, 'wait a moment'],
    [/\bshut\s+up\b/gi, 'be quiet'],
    [/\blook\s+out\b|\bwatch\s+out\b/gi, 'be careful'],
    [/\btake\s+care\b/gi, 'stay safe'],
    [/\bhurry\s+up\b/gi, 'hurry'],
    [/\bcalm\s+down\b/gi, 'relax'],
    [/\bof\s+course\b/gi, 'certainly'],
    [/\bgood\s+luck\b/gi, 'best wishes'],
    [/\boh\s+my\s+god\b|\bmy\s+god\b|\bomg\b/gi, 'oh God'],
    [/\bwhat\s+the\s+hell\b|\bwhat\s+the\s+heck\b/gi, 'what is happening'],
    [/\bare\s+you\s+kidding(\s+me)?\b/gi, 'are you joking'],
    [/\bthank\s+goodness\b|\bthank\s+god\b/gi, 'thank God'],
    [/\bfor\s+real\b/gi, 'seriously'],
    [/\blong\s+time\s+no\s+see\b/gi, 'it has been a long time'],
    [/\bmy\s+bad\b/gi, 'my mistake'],
    [/\bno\s+problem\b/gi, 'no problem'],
    [/\byou\s+are\s+welcome\b/gi, 'you are welcome'],
    [/\bdon['’]?t\s+worry\b/gi, 'do not worry'],
    [/\btake\s+it\s+easy\b/gi, 'relax'],
    [/\bmake\s+yourself\s+at\s+home\b/gi, 'feel comfortable'],
    [/\bmind\s+your\s+own\s+business\b/gi, 'do not interfere'],
    [/\bon\s+my\s+way\b/gi, 'coming now'],
    [/\bgive\s+me\s+a\s+hand\b/gi, 'help me'],
    [/\bget\s+out\s+of\s+here\b/gi, 'leave right now'],
    // Combat & Tactical
    [/\block\s+and\s+load\b/gi, 'prepare weapons'],
    [/\bfire\s+in\s+the\s+hole\b/gi, 'danger explosive'],
    [/\bcode\s+red\b/gi, 'high emergency'],
    [/\ball\s+clear\b/gi, 'all safe'],
    [/\bcease\s*fire\b/gi, 'stop shooting'],
    [/\bon\s+my\s+mark\b/gi, 'on my signal'],
    [/\babort\s+mission\b/gi, 'cancel mission'],
    [/\bcover\s+me\b/gi, 'protect me'],
    [/\bwatch\s+your\s+back\b/gi, 'be careful behind you'],
    [/\b(?:i['’]?ve\s+)?got\s+your\s+back\b/gi, 'I will protect you'],
    [/\bdrop\s+your\s+weapons?\b/gi, 'put down your weapon'],
    [/\bfall\s+back\b/gi, 'retreat now'],
    [/\bkeep\s+moving\b/gi, 'continue moving'],
    // Anime & dialogue tropes
    [/\bi\s+will\s+never\s+forgive\s+you\b/gi, 'I will never forgive you'],
    [/\byou['’]?re\s+wide\s+open\b/gi, 'you have no defense'],
    [/\bis\s+that\s+all\s+you(?:['’]?ve)?\s+got\b/gi, 'is that all your power'],
    [/\bi\s+won['’]?t\s+give\s+up\b/gi, 'I will never surrender'],
    [/\bprepare\s+to\s+die\b/gi, 'prepare for your death'],
    [/\bthis\s+is\s+the\s+end\s+for\s+you\b/gi, 'this is your end'],
    [/\bwhat\s+are\s+you\s+planning\b/gi, 'what is your plan'],
    [/\bhow\s+dare\s+you\b/gi, 'how do you dare'],
    [/\bshow\s+no\s+mercy\b/gi, 'show no mercy'],
    [/\bbelieve\s+in\s+yourself\b/gi, 'trust in yourself'],
    [/\bi\s+swear\s+to\s+god\b/gi, 'I swear to God'],
    // Character stutters: b-but -> but
    [/\bb[-—–]but\b/gi, 'but'],
    [/\bw[-—–]what\b/gi, 'what'],
    [/\bw[-—–]wait\b/gi, 'wait'],
    [/\bn[-—–]no\b/gi, 'no'],
    [/\by[-—–]yes\b/gi, 'yes'],
    [/\bi[-—–]i\b/gi, 'I'],
    [/\bs[-—–]sorry\b/gi, 'sorry'],
    [/\bp[-—–]please\b/gi, 'please'],
  ];

  /** Preprocess source text to improve translation accuracy for English to Kurdish Sorani. */
  function preprocessSource(text, srcLang, tgtLang) {
    if (tgtLang !== 'ckb' || (srcLang !== 'en' && srcLang !== 'en-GB' && srcLang !== 'auto')) return text;
    let s = text;
    PREPROCESS_REPLACEMENTS.forEach(([pattern, replacement]) => {
      s = s.replace(pattern, replacement);
    });
    return s;
  }

  const getOrthography = () => {
    if (typeof TranslatorOrthography !== 'undefined') return TranslatorOrthography;
    if (typeof require !== 'undefined') {
      try { return require('./translator-orthography.js'); } catch {}
    }
    return null;
  };

  function normalizeDigits(str, useKurdishDigits) {
    const ortho = getOrthography();
    if (ortho && ortho.normalizeDigits) return ortho.normalizeDigits(str, useKurdishDigits);
    if (!str) return '';
    return !useKurdishDigits
      ? str.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      : str.replace(/[0-9]/g, (d) => String.fromCharCode(0x0660 + Number(d)));
  }

  function normalizeSoraniAlphabet(str) {
    const ortho = getOrthography();
    if (ortho && ortho.normalizeSoraniAlphabet) return ortho.normalizeSoraniAlphabet(str);
    return str || '';
  }

  function rejoinVerbalAffixes(str) {
    const ortho = getOrthography();
    if (ortho && ortho.rejoinVerbalAffixes) return ortho.rejoinVerbalAffixes(str);
    return str || '';
  }

  function naturalizeDialogue(str) {
    const ortho = getOrthography();
    if (ortho && ortho.naturalizeDialogue) return ortho.naturalizeDialogue(str);
    return str || '';
  }

  function postprocessSorani(text, options = {}) {
    const ortho = getOrthography();
    if (ortho && ortho.postprocessSorani) return ortho.postprocessSorani(text, options);
    return normalizeText(text, true, !!options.kurdishDigits);
  }

  function getAdvancedAlternatives(englishText) {
    const ortho = getOrthography();
    if (ortho && ortho.getAdvancedAlternatives) return ortho.getAdvancedAlternatives(englishText);
    return [];
  }

  function checkLineQuality(cue, originalText) {
    const ortho = getOrthography();
    if (ortho && ortho.checkLineQuality) return ortho.checkLineQuality(cue, originalText);
    return { score: 100, issues: [], suggestions: [], improvedText: cue ? cue.text : '' };
  }

  function normalizeForSearch(text) {
    const ortho = getOrthography();
    if (ortho && ortho.normalizeForSearch) return ortho.normalizeForSearch(text);
    return (text || '').toLowerCase().trim();
  }

  function normalizeText(text, cleanPunctuation = true, useKurdishDigits = false) {
    const ortho = getOrthography();
    if (ortho && ortho.normalizeText) return ortho.normalizeText(text, cleanPunctuation, useKurdishDigits);
    if (!text) return '';
    let s = text.replace(/[\u200E\u200F\u202A-\u202E]/g, '');
    s = normalizeSoraniAlphabet(s);
    s = rejoinVerbalAffixes(s);
    s = naturalizeDialogue(s);
    s = normalizeDigits(s, useKurdishDigits);
    if (cleanPunctuation) {
      s = s.replace(/,/g, '،')
           .replace(/;/g, '؛')
           .replace(/\?/g, '؟')
           .replace(/\s+([،؛?.!])/g, '$1')
           .replace(/\n\s*([،؛?.!])/g, '$1')
           .replace(/([،؛؟])([^\s\n])/g, '$1 $2')
           .replace(/[ \t]{2,}/g, ' ')
           .trim();
    }
    return s;
  }

  /**
   * Translate an array of subtitle lines into the target language with progress callbacks.
   */
  async function translateLines(lines, srcLang = 'auto', tgtLang = 'ckb', onProgress, signal, options = {}) {
    if (!Array.isArray(lines) || !lines.length) return [];
    const opts = typeof options === 'object' && options !== null ? options : {};
    const isArabic = ARABIC_SCRIPT.has(tgtLang);
    const useKurdishDigits = !!opts.kurdishDigits;

    const batches = buildBatches(lines, srcLang, tgtLang);
    const totalLines = lines.filter((l) => l && l.trim()).length || 1;
    const mainFraction = opts.accuracy ? 0.8 : 1.0;
    const results = new Array(lines.length).fill('');

    const origNorm = lines.map((l) => normalizeText(l || '', isArabic, useKurdishDigits));

    let doneLines = 0;
    let retryTotal = 0;
    let anyTranslated = false;
    let sawHardFail = false;
    let failedLines = 0;

    const flags = { anyTranslated, sawHardFail, failedLines };

    for (let b = 0; b < batches.length; b++) {
      throwIfAborted(signal);
      const batch = batches[b];
      const joined = batch.map((item) => item.text).join('\n' + BATCH_SEP + '\n');

      try {
        const translatedJoined = await translateChunk(joined, srcLang, tgtLang, signal);
        flags.anyTranslated = true;
        const split = splitBatch(translatedJoined);

        if (split.length === batch.length) {
          batch.forEach((item, i) => {
            let restored = restoreNewlines(restore(split[i].trim(), item.toks));
            restored = cleanLeftoverTokens(restored);
            let norm = normalizeText(restored, isArabic, useKurdishDigits);
            norm = fixPlacementAndTagOrder(norm, item.raw);
            results[item.index] = norm;
          });
        } else {
          // Merged batch fallback: translate line-by-line
          for (let item of batch) {
            throwIfAborted(signal);
            try {
              const single = await translateChunk(item.text, srcLang, tgtLang, signal);
              let restored = restoreNewlines(restore(single.trim(), item.toks));
              restored = cleanLeftoverTokens(restored);
              let norm = normalizeText(restored, isArabic, useKurdishDigits);
              norm = fixPlacementAndTagOrder(norm, item.raw);
              results[item.index] = norm;
            } catch {
              results[item.index] = item.raw;
              flags.failedLines++;
            }
          }
        }
      } catch (err) {
        if (signal && signal.aborted) throw err;
        flags.sawHardFail = true;
        for (let item of batch) {
          throwIfAborted(signal);
          try {
            const single = await translateChunk(item.text, srcLang, tgtLang, signal);
            flags.anyTranslated = true;
            let restored = restoreNewlines(restore(single.trim(), item.toks));
            restored = cleanLeftoverTokens(restored);
            let norm = normalizeText(restored, isArabic, useKurdishDigits);
            norm = fixPlacementAndTagOrder(norm, item.raw);
            results[item.index] = norm;
          } catch {
            results[item.index] = item.raw;
            flags.failedLines++;
          }
        }
      }

      doneLines += batch.length;
      if (opts.onBatch) opts.onBatch(results, doneLines, totalLines);
      if (onProgress) onProgress(mainFraction * (doneLines / totalLines), doneLines, totalLines);
      if (b < batches.length - 1) await sleep(DELAY_MS, signal);
    }

    anyTranslated = flags.anyTranslated;
    sawHardFail = flags.sawHardFail;
    failedLines = flags.failedLines;

    if (!anyTranslated && sawHardFail) throw new Error('Translation unavailable (network error)');

    // Accuracy pass
    if (opts.accuracy) {
      const retries = [];
      for (let i = 0; i < lines.length; i++) {
        const orig = lines[i] || '';
        if (!orig.trim()) continue;
        if (!results[i]) continue;
        if (normalizeText(results[i], isArabic, useKurdishDigits) !== origNorm[i]) continue;
        if (!/\p{L}/u.test(orig)) continue;
        retries.push(i);
      }
      retryTotal = retries.length;
      for (let k = 0; k < retryTotal; k++) {
        const i = retries[k];
        throwIfAborted(signal);
        const p = protect(lines[i]);
        const prep = preprocessSource(p.text, srcLang, tgtLang);
        try {
          const t = await translateChunk(prep, srcLang, tgtLang, signal);
          let norm = normalizeText(restoreNewlines(restore(t, p.toks).trim()), isArabic, useKurdishDigits);
          norm = fixPlacementAndTagOrder(norm, lines[i]);
          if (norm && norm !== origNorm[i]) {
            results[i] = norm;
            if (opts.onBatch) opts.onBatch(results, doneLines + k + 1, totalLines + retryTotal);
          }
        } catch {}
        if (onProgress) onProgress(mainFraction + (1 - mainFraction) * (k + 1) / Math.max(1, retryTotal), doneLines + k + 1, totalLines + retryTotal);
      }
    }

    if (onProgress) onProgress(1, totalLines + retryTotal, totalLines + retryTotal);
    results.failedCount = failedLines;
    return results;
  }

  function buildBatches(lines, srcLang, tgtLang) {
    const batches = [];
    let current = [];
    let chars = 0;

    lines.forEach((text, index) => {
      if (!text.trim()) return;
      if (current.length >= BATCH_LINES || chars + text.length > MAX_CHARS_PER_REQUEST) {
        batches.push(current);
        current = [];
        chars = 0;
      }
      const c = protect(text.replace(/\r?\n/g, NL_SENTINEL));
      const prep = preprocessSource(c.text, srcLang, tgtLang);
      current.push({ index, text: prep, toks: c.toks, raw: text });
      chars += text.length;
    });

    if (current.length) batches.push(current);
    return batches;
  }

  function scopedSignal(signal) {
    const ctrl = new AbortController();
    const onAbort = () => ctrl.abort();
    if (signal) {
      if (signal.aborted) ctrl.abort();
      else signal.addEventListener('abort', onAbort, { once: true });
    }
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    return {
      signal: ctrl.signal,
      cleanup() {
        clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', onAbort);
      }
    };
  }

  const CLIENTS = ['gtx', 'dict-chrome-ex', 'tw-ob', 't'];

  async function fetchServerProxy(text, srcLang, tgtLang, signal) {
    if (typeof window === 'undefined' || !window.location || !window.location.origin) return null;
    const scoped = scopedSignal(signal);
    try {
      let res;
      if (text.length > 400) {
        res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: text, sl: srcLang, tl: tgtLang }),
          signal: scoped.signal
        });
      } else {
        const params = new URLSearchParams({ sl: srcLang, tl: tgtLang, q: text });
        res = await fetch(`/api/translate?${params.toString()}`, { method: 'GET', signal: scoped.signal });
      }
      if (res && res.ok) {
        const data = await res.json();
        if (data && data.translation) return data.translation;
      }
    } catch {
    } finally {
      scoped.cleanup();
    }
    return null;
  }

  async function fetchGoogleT(text, srcLang, tgtLang, signal, attempt = 0) {
    const host = GOOGLE_T_ENDPOINTS[attempt % GOOGLE_T_ENDPOINTS.length];
    const client = CLIENTS[attempt % CLIENTS.length] || 'dict-chrome-ex';
    const params = new URLSearchParams({ client, sl: srcLang, tl: tgtLang, q: text });
    const scoped = scopedSignal(signal);
    try {
      const res = await fetch(`${host}?${params.toString()}`, { method: 'GET', signal: scoped.signal });
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get('retry-after'));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoffMs(attempt);
        const err = new Error('HTTP 429 (throttled)');
        err.status = 429;
        err.wait = wait;
        throw err;
      }
      if (!res.ok) throw new Error(`Google /t HTTP ${res.status}`);
      const rawText = await res.text();
      if (rawText.startsWith('<') && !rawText.startsWith('<?xml')) {
        const err = new Error('HTML response received instead of JSON');
        err.status = 429;
        err.wait = backoffMs(attempt);
        throw err;
      }
      const data = JSON.parse(rawText);
      const parsed = parseGoogleResponse(data);
      if (parsed) return parsed;
      throw new Error('Empty Google /t response');
    } finally {
      scoped.cleanup();
    }
  }

  function parseGoogleResponse(data) {
    if (!data) return '';
    if (typeof data === 'string') return decodeHtmlEntities(data);
    if (Array.isArray(data)) {
      if (typeof data[0] === 'string') return decodeHtmlEntities(data[0]);
      if (Array.isArray(data[0])) {
        if (typeof data[0][0] === 'string') {
          const text = data[0].map((seg) => (Array.isArray(seg) && typeof seg[0] === 'string' ? seg[0] : '')).join('');
          if (text) return decodeHtmlEntities(text);
          return decodeHtmlEntities(data[0][0]);
        }
        if (Array.isArray(data[0][0])) {
          const text = data[0].map((seg) => (Array.isArray(seg) && typeof seg[0] === 'string' ? seg[0] : '')).join('');
          if (text) return decodeHtmlEntities(text);
        }
      }
    }
    if (data && Array.isArray(data.sentences)) {
      const text = data.sentences.map((s) => s.trans || '').join('');
      if (text) return decodeHtmlEntities(text);
    }
    return '';
  }

  function decodeHtmlEntities(str) {
    if (!str || typeof str !== 'string') return str || '';
    return str
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec));
  }

  async function fetchGoogle(text, srcLang, tgtLang, signal, attempt = 0) {
    const host = GOOGLE_ENDPOINTS[attempt % GOOGLE_ENDPOINTS.length];
    const client = CLIENTS[attempt % CLIENTS.length] || 'gtx';
    const isSingle = host.includes('/single');
    const params = new URLSearchParams({ client, sl: srcLang, tl: tgtLang, q: text });
    if (isSingle) {
      params.set('dt', 't');
      params.set('ie', 'UTF-8');
      params.set('oe', 'UTF-8');
    }
    const scoped = scopedSignal(signal);
    try {
      const res = await fetch(`${host}?${params.toString()}`, { method: 'GET', signal: scoped.signal });
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get('retry-after'));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoffMs(attempt);
        const err = new Error('HTTP 429 (throttled)');
        err.status = 429;
        err.wait = wait;
        throw err;
      }
      if (!res.ok) {
        const e = new Error(`HTTP ${res.status}`);
        e.hard = res.status >= 500;
        throw e;
      }
      const rawText = await res.text();
      if (rawText.startsWith('<') && !rawText.startsWith('<?xml')) {
        const err = new Error('HTML response from Google /single');
        err.status = 429;
        err.wait = backoffMs(attempt);
        throw err;
      }
      const data = JSON.parse(rawText);
      const parsed = parseGoogleResponse(data);
      if (parsed) return parsed;
      throw new Error('Empty or unexpected response from Google');
    } finally {
      scoped.cleanup();
    }
  }

  async function fetchLingva(text, srcLang, tgtLang, signal, attempt = 0) {
    const instance = LINGVA_INSTANCES[attempt % LINGVA_INSTANCES.length];
    const from = srcLang === 'auto' ? 'auto' : srcLang;
    const url = `${instance}/${encodeURIComponent(from)}/${encodeURIComponent(tgtLang)}/${encodeURIComponent(text)}`;
    const scoped = scopedSignal(signal);
    try {
      const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' }, signal: scoped.signal });
      if (!res.ok) throw new Error(`Lingva instance HTTP ${res.status}`);
      const data = await res.json();
      if (data && data.translation) return data.translation;
      throw new Error('Empty Lingva translation response');
    } finally {
      scoped.cleanup();
    }
  }

  async function fetchMyMemory(text, srcLang, tgtLang, signal) {
    const langpair = `${srcLang === 'auto' ? 'en' : srcLang}|${tgtLang}`;
    const params = new URLSearchParams({ q: text, langpair });
    const scoped = scopedSignal(signal);
    try {
      const res = await fetch(`${MYMEMORY_ENDPOINT}?${params.toString()}`, { method: 'GET', headers: { Accept: 'application/json' }, signal: scoped.signal });
      if (!res.ok) throw new Error(`MyMemory HTTP ${res.status}`);
      const data = await res.json();
      if (data && data.responseData && data.responseData.translatedText) {
        return data.responseData.translatedText;
      }
      throw new Error('Empty MyMemory translation response');
    } finally {
      scoped.cleanup();
    }
  }

  async function translateChunk(text, srcLang, tgtLang, signal) {
    let lastErr;
    try {
      const proxyResult = await fetchServerProxy(text, srcLang, tgtLang, signal);
      if (proxyResult) return proxyResult;
    } catch {}

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      throwIfAborted(signal);
      try {
        if (attempt < 3) {
          try {
            return await fetchGoogle(text, srcLang, tgtLang, signal, attempt);
          } catch (googleErr) {
            if (googleErr.status === 429 && googleErr.wait) {
              await sleep(Math.min(googleErr.wait, 2000), signal);
            }
            try {
              return await fetchGoogleT(text, srcLang, tgtLang, signal, attempt);
            } catch {}
            throw googleErr;
          }
        } else if (attempt === 3) {
          try {
            return await fetchGoogleT(text, srcLang, tgtLang, signal, attempt);
          } catch {
            try { return await fetchGoogle(text, srcLang, tgtLang, signal, attempt + 1); } catch {}
          }
        } else if (attempt === 4) {
          try {
            return await fetchLingva(text, srcLang, tgtLang, signal, attempt);
          } catch {
            try { return await fetchGoogle(text, srcLang, tgtLang, signal, attempt + 1); } catch {}
          }
        } else {
          try {
            return await fetchMyMemory(text, srcLang, tgtLang, signal);
          } catch {
            try { return await fetchGoogle(text, srcLang, tgtLang, signal, 0); } catch {}
          }
        }
      } catch (err) {
        if (signal && signal.aborted) throw err;
        if (err instanceof TypeError) err.hard = true;
        if (err && err.name === 'AbortError') err.hard = true;
        if (!(err instanceof Error)) err = new Error(String(err && err.message));
        lastErr = err;
        if (attempt < MAX_ATTEMPTS - 1) await sleep(backoffMs(attempt), signal);
      }
    }
    throw lastErr;
  }

  function backoffMs(attempt) {
    return Math.min(250 * 2 ** attempt + Math.random() * 200, 2500);
  }

  function splitBatch(translated) {
    const parts = [];
    let cur = [];
    for (const line of translated.split('\n')) {
      if (BATCH_SEP_RE.test(line)) {
        parts.push(cur.join('\n'));
        cur = [];
      } else if (line.includes(BATCH_SEP)) {
        const sub = line.split(BATCH_SEP);
        for (let s = 0; s < sub.length; s++) {
          if (s > 0) { parts.push(cur.join('\n')); cur = []; }
          let item = sub[s].replace(/^[ \t\u200e\u200f]+|[ \t\u200e\u200f]+$/g, '').trim();
          if (s > 0) item = item.replace(/^[.,!?;:،؛؟]+\s*/, '');
          if (item) cur.push(item);
        }
      } else {
        cur.push(line);
      }
    }
    parts.push(cur.join('\n'));
    return parts;
  }

  function throwIfAborted(signal) {
    if (signal && signal.aborted) {
      const err = new Error('Translation cancelled');
      err.name = 'AbortError';
      throw err;
    }
  }

  async function warmup() {
    const params = new URLSearchParams({ client: 'dict-chrome-ex', sl: 'en', tl: 'ckb', q: 'hi' });
    try {
      await fetch(`${GOOGLE_ENDPOINTS[0]}?${params.toString()}`, { method: 'GET', headers: { Accept: 'application/json' } });
    } catch {}
  }

  return {
    translateLines,
    warmup,
    normalizeText,
    normalizeDigits,
    normalizeSoraniAlphabet,
    rejoinVerbalAffixes,
    preprocessSource,
    protect,
    restore,
    cleanLeftoverTokens,
    fixPlacementAndTagOrder,
    naturalizeDialogue,
    normalizeForSearch,
    checkLineQuality,
    getAdvancedAlternatives,
    postprocessSorani,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Translator;
