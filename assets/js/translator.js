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
    'https://clients5.google.com/translate_a/t',
    'https://clients1.google.com/translate_a/t',
    'https://clients2.google.com/translate_a/t',
    'https://clients3.google.com/translate_a/t',
    'https://clients4.google.com/translate_a/t',
    'https://translate.googleapis.com/translate_a/t',
    'https://clients5.google.com/translate_a/single',
    'https://clients1.google.com/translate_a/single',
  ];

  // Secondary public privacy-friendly Lingva Translate instances (Open-source Google Translate frontends)
  const LINGVA_INSTANCES = [
    'https://lingva.ml/api/v1',
    'https://translate.plausibility.cloud/api/v1',
    'https://lingva.garudalinux.org/api/v1',
    'https://lingva.lunar.icu/api/v1',
  ];

  // MyMemory Translation API endpoint
  const MYMEMORY_ENDPOINT = 'https://api.mymemory.translated.net/get';

  // Keep requests modest to avoid timeouts on mobile networks.
  const BATCH_LINES = 25;
  const MAX_CHARS_PER_REQUEST = 1600;
  const DELAY_MS = 160;         // polite spacing between batches
  const MAX_ATTEMPTS = 6;       // retries across providers
  const REQUEST_TIMEOUT_MS = 25000; // hang-up guard so a stalled socket retries

  // Sentinel protecting internal line breaks inside a cue so cue boundaries
  // stay unambiguous after translation. Contains no regex metacharacters and
  // is used with a literal split/join.
  const NL_SENTINEL = '§§';

  // Control character that delimits lines inside a batch request.
  const BATCH_SEP = '\u0001';
  const BATCH_SEP_RE = /^[ \t\u200e\u200f.,!?;:،؛؟]*\u0001[ \t\u200e\u200f.,!?;:،؛؟]*$/;

  // Placeholder token format: [T0], [T1], etc.
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

  /** Put the original markup back in place of the bracketed tokens. */
  function cleanLeftoverTokens(text) {
    if (!text) return '';
    return text
      // Clean bracketed/parenthesized/braced token remnants like [T0], [W0], [p0], (W1), {T2}, [W], [p], [ و ٠ ]
      .replace(/\[\s*(?:T|t|W|w|P|p|Z|z|X|x|ت|تاک|تی|تۆ|پی|پێ|ٹی|ز|زێد|و)\s*[-_:]?\s*[\d\u0660-\u0669\u06f0-\u06f9]*\s*\]/gi, '')
      .replace(/\(\s*(?:T|t|W|w|P|p|Z|z|X|x|ت|تاک|تی|تۆ|پی|پێ|ٹی|ز|زێد|و)\s*[-_:]?\s*[\d\u0660-\u0669\u06f0-\u06f9]*\s*\)/gi, '')
      .replace(/\{\s*(?:T|t|W|w|P|p|Z|z|X|x|ت|تاک|تی|تۆ|پی|پێ|ٹی|ز|زێد|و)\s*[-_:]?\s*[\d\u0660-\u0669\u06f0-\u06f9]*\s*\}/gi, '')
      // Clean word-boundary token remnants like T0, W0, p0, W1, p1, ت0, پ0, و0
      .replace(/\b(?:T|t|W|w|P|p|Z|z|X|x)\s*[-_:]?\s*[\d\u0660-\u0669\u06f0-\u06f9]+\b/gi, '')
      .replace(/(?:^|[\s،؛؟.,!?:])(?:[تپو][0-9\u0660-\u0669\u06f0-\u06f9]+)(?=[\s،؛؟.,!?:]|$)/g, ' ')
      // Clean isolated stray 'W', 'w', 'p', 'P' letters produced by Google Translate placeholder glitches in Kurdish text
      .replace(/(^|[\s،؛؟.\n])[WwPpTt](?=[\s،؛؟.,!?:-]|$)/g, '$1')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }

  function restore(s, toks) {
    if (!s) return '';
    if (!toks || !toks.length) return cleanLeftoverTokens(s);

    // Match all variations of tokens: [T0], [W0], [p0], (T0), (W0), W0, p0, [ T 0 ], [W:0], [و0], [ت0], [پ0], etc.
    let res = s.replace(/(?:\[|\(|\{)\s*(?:T|t|W|w|P|p|Z|z|X|x|ت|تاک|تی|تۆ|پی|پێ|ٹی|ز|زێد|و|پ)\s*[-_:]?\s*([\d\u0660-\u0669\u06f0-\u06f9]+)\s*(?:\]|\)|\})|\b(?:T|t|W|w|P|p|Z|z|X|x)\s*[-_:]?\s*([\d\u0660-\u0669\u06f0-\u06f9]+)\b|(?:^|[\s،؛؟.,!?:])([تپو])\s*[-_:]?\s*([\d\u0660-\u0669\u06f0-\u06f9]+)(?=[\s،؛؟.,!?:]|$)/gi, (fullMatch, n1, n2, prefix, n3) => {
      const numStr = n1 || n2 || n3;
      if (!numStr) return '';
      const ascii = numStr.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
                          .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
      const id = parseInt(ascii, 10);
      return toks[id] !== undefined ? toks[id] : '';
    });

    // Fallback: If Google stripped the number and output e.g. [T], [W], [p], (W), (p)
    // and there is exactly 1 token remaining, restore it
    if (toks.length === 1 && !res.includes(toks[0])) {
      const singleMatch = res.match(/(?:\[|\(|\{)\s*(?:T|t|W|w|P|p|و|ت|پ)\s*(?:\]|\)|\})/i);
      if (singleMatch) {
        res = res.replace(singleMatch[0], toks[0]);
      }
    }

    return cleanLeftoverTokens(res);
  }

  /**
   * Ensure screen placement override tags (like {\an8}, {\pos(x,y)}) and formatting tags
   * maintain their proper leading/trailing position in the translated line despite RTL reordering.
   */
  function fixPlacementAndTagOrder(text, originalText) {
    if (!text || !originalText) return text || '';

    // Split text and originalText by lines so multi-line cues preserve tag placement per line
    const origLines = originalText.split('\n');
    const transLines = text.split('\n');

    const fixed = transLines.map((tLine, i) => {
      const origLine = origLines[i] || origLines[0] || '';
      let line = tLine;

      // Check for leading ASS/override/position tags in original line: e.g. {\an8}, {\pos(x,y)}, {\c&H...&}, {\a6}, <top>
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

      // Check for trailing closing tags in original line: e.g. </i>, </b>, </u>, </font>
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

  // Arabic-script targets (Sorani Kurdish, Farsi, Arabic, Urdu, Pashto)
  const ARABIC_SCRIPT = new Set(['ckb', 'fa', 'ar', 'ur', 'ps']);

  /**
   * Reference the modularized Kurdish Subtitle Lexicon from TranslatorDict.
   */
  const ADVANCED_SUBTITLE_LEXICON = (typeof TranslatorDict !== 'undefined' && TranslatorDict.LEXICON)
    ? TranslatorDict.LEXICON
    : {
        'fuck': { kurdish: 'نەفرەت', context: 'Expletive', alternatives: ['شەیتان', 'دۆزەخ', 'سەگباب'] },
        'shut up': { kurdish: 'دەمت دابخە', context: 'Silence', alternatives: ['بێدەنگ بە', 'دەنگی خۆت ببڕە'] },
        'never mind': { kurdish: 'کێشە نییە، لەبیری کە', context: "Don't worry", alternatives: ['گرنگ نییە', 'بێ خەم بە'] },
        'get out of here': { kurdish: 'بڕۆ دەرەوە', context: 'Dismissal', alternatives: ['لەبەرچاوم ون بە', 'سەری خۆت هەڵگرە'] },
        'make yourself at home': { kurdish: 'ماڵی خۆتە', context: 'Feel comfortable', alternatives: ['ئاسوودە بە', 'تەواو بە ئاسودەیی بە'] },
      };

  /** Preprocess source text to improve translation accuracy for English to Kurdish Sorani. */
  function preprocessSource(text, srcLang, tgtLang) {
    if (tgtLang !== 'ckb' || (srcLang !== 'en' && srcLang !== 'en-GB' && srcLang !== 'auto')) return text;
    let s = text;

    // Handle subtitle dialogue multi-speaker hyphens on a single line:
    // e.g. "- Hello! - How are you?" -> "- Hello!\n- How are you?"
    s = s.replace(/(?:^|\n)\s*[-—–]\s*([^\n]+?)\s+[-—–]\s*([^\n]+)/g, '- $1\n- $2');

    // Expand gerund colloquialisms in subtitle dialogues (e.g., lookin' -> looking, runnin' -> running, doin' -> doing)
    s = s.replace(/\b([a-zA-Z]{2,})in['’](?=\s|[.,!?;:'"()[\]{}<>]|$)/gi, '$1ing');

    // Expand informal contractions and spoken dialogue slang into standard forms for accurate MT translation
    s = s.replace(/\bgonna\b/gi, 'going to')
         .replace(/\bwanna\b/gi, 'want to')
         .replace(/\bgotta\b/gi, 'have to')
         .replace(/\bwoulda\b/gi, 'would have')
         .replace(/\bcoulda\b/gi, 'could have')
         .replace(/\bshoulda\b/gi, 'should have')
         .replace(/\bmusta\b/gi, 'must have')
         .replace(/\bkinda\b/gi, 'kind of')
         .replace(/\bsorta\b/gi, 'sort of')
         .replace(/\blotta\b/gi, 'lot of')
         .replace(/\balot\b/gi, 'a lot')
         .replace(/\bdunno\b/gi, 'do not know')
         .replace(/\bi['’]?mma\b/gi, 'I am going to')
         .replace(/\bain['’]?t\b/gi, 'is not')
         .replace(/\bgimme\b/gi, 'give me')
         .replace(/\blemme\b/gi, 'let me')
         .replace(/\boutta\b/gi, 'out of')
         .replace(/\by['’]?all\b/gi, 'you all')
         .replace(/(^|\s)['’]cause(?=\s|[.,!?;:'"()[\]{}<>]|$)/gi, '$1because')
         .replace(/\bcuz\b/gi, 'because')
         .replace(/\bcoz\b/gi, 'because')
         .replace(/\bc['’]mon\b/gi, 'come on')
         .replace(/\bw\/\b/gi, 'with')
         .replace(/\bw\/o\b/gi, 'without')
         .replace(/\bu\b/g, 'you')
         .replace(/\br\b/g, 'are')
         .replace(/\bur\b/gi, 'your')
         .replace(/\bpls\b|\bplz\b/gi, 'please')
         .replace(/\bthx\b|\bty\b/gi, 'thank you')
         .replace(/\bthru\b/gi, 'through')
         .replace(/\btil\b|\btill\b/gi, 'until')
         .replace(/(^|\s)['’]em(?=\s|[.,!?;:'"()[\]{}<>]|$)/gi, '$1them')
         .replace(/(^|\s)['’]bout(?=\s|[.,!?;:'"()[\]{}<>]|$)/gi, '$1about')
         .replace(/(^|\s)['’]round(?=\s|[.,!?;:'"()[\]{}<>]|$)/gi, '$1around')
         .replace(/\basap\b/gi, 'as soon as possible')
         .replace(/\bfyi\b/gi, 'for your information')
         .replace(/\bbtw\b/gi, 'by the way')
         .replace(/\btbh\b/gi, 'to be honest')
         .replace(/\bimo\b/gi, 'in my opinion');

    // Handle character speech stutters (e.g. "b-but", "w-wait") cleanly for MT
    s = s.replace(/\bb[-—–]but\b/gi, 'but')
         .replace(/\bw[-—–]what\b/gi, 'what')
         .replace(/\bw[-—–]wait\b/gi, 'wait')
         .replace(/\bn[-—–]no\b/gi, 'no')
         .replace(/\by[-—–]yes\b/gi, 'yes')
         .replace(/\bi[-—–]i\b/gi, 'I')
         .replace(/\bw[-—–]why\b/gi, 'why')
         .replace(/\bh[-—–]how\b/gi, 'how')
         .replace(/\by[-—–]you\b/gi, 'you')
         .replace(/\bs[-—–]sorry\b/gi, 'sorry')
         .replace(/\bp[-—–]please\b/gi, 'please')
         .replace(/\bh[-—–]help\b/gi, 'help');

    return s;
  }

  /** Delegate NLP & Orthography to TranslatorOrthography module when loaded */
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

  function checkLineQuality(arg1, arg2 = '') {
    const ortho = getOrthography();
    if (ortho && ortho.checkLineQuality) return ortho.checkLineQuality(arg1, arg2);
    return { score: 100, issues: [], suggestions: [], issueDetails: [], alternatives: [], improvedText: typeof arg1 === 'string' ? arg1 : '' };
  }

  function normalizeText(text, isArabic, useKurdishDigits = false) {
    const ortho = getOrthography();
    if (ortho && ortho.normalizeText) return ortho.normalizeText(text, isArabic, useKurdishDigits);
    if (!text) return '';
    return text.replace(/[ \t]+([.,!?;:،؛؟]+)/g, '$1');
  }

  function normalizeForSearch(str) {
    const ortho = getOrthography();
    if (ortho && ortho.normalizeForSearch) return ortho.normalizeForSearch(str);
    return (str || '').toLowerCase().trim();
  }

  /**
   * Translate an array of strings.
   * @param {string[]} lines source lines
   * @param {string} srcLang source lang code ('auto' allowed)
   * @param {string} tgtLang target lang code
   * @param {(fraction:number, doneLines:number, totalLines:number)=>void} [onProgress]
   * @param {AbortSignal} [signal] aborts in-flight requests
   * @param {{accuracy?:boolean}} [opts] accuracy re-translates lines left unchanged
   * @returns {Promise<string[]>} translated lines (same length)
   */
  async function translateLines(lines, srcLang, tgtLang, onProgress, signal, opts = {}) {
    const results = new Array(lines.length).fill('');
    const batches = buildBatches(lines, srcLang, tgtLang);
    const total = batches.length || 1;
    const totalLines = batches.reduce((n, b) => n + b.length, 0);
    const isArabic = ARABIC_SCRIPT.has(tgtLang);
    const useKurdishDigits = !!opts.kurdishDigits;
    // Normalized originals, used to detect lines Google returned verbatim.
    const origNorm = lines.map((l) => normalizeText(restoreNewlines((l || '').replace(/\r/g, '')), isArabic, useKurdishDigits));
    let doneLines = 0;
    let anyTranslated = false;
    let sawHardFail = false;
    let failedLines = 0;
    let retryTotal = 0; // accuracy-pass retries, reported in the final progress
    // Reserve the last 10% of the progress bar for the accuracy pass so the bar
    // never jumps backwards when verification begins.
    const mainFraction = opts.accuracy ? 0.9 : 1.0;

    const flags = { anyTranslated: false, sawHardFail: false, failedLines: 0 };

    // Helper: translate a sub-batch recursively, halving on merged/failed batches
    async function processBatch(subBatch) {
      throwIfAborted(signal);
      if (!subBatch || !subBatch.length) return;

      // Fast-path: if the sub-batch contains only non-verbal items (no Unicode letters), pass through directly
      const hasLetters = subBatch.some((o) => /\p{L}/u.test(o.text));
      if (!hasLetters) {
        for (const o of subBatch) {
          let norm = normalizeText(restoreNewlines(restore(o.text, o.toks)), isArabic, useKurdishDigits);
          norm = fixPlacementAndTagOrder(norm, o.raw);
          results[o.index] = norm;
        }
        return;
      }

      if (subBatch.length === 1) {
        const o = subBatch[0];
        try {
          let norm = normalizeText(restoreNewlines(restore(await translateChunk(o.text, srcLang, tgtLang, signal), o.toks).trim()), isArabic, useKurdishDigits);
          norm = fixPlacementAndTagOrder(norm, o.raw);
          results[o.index] = norm;
          if (norm && norm !== origNorm[o.index]) flags.anyTranslated = true;
        } catch (e) {
          if (e && e.hard) flags.sawHardFail = true;
          // Check dictionary fallback first
          let dictMatch = null;
          if (typeof TranslatorDict !== 'undefined' && TranslatorDict.findMatches) {
            const matches = TranslatorDict.findMatches(o.raw);
            if (matches && matches.length && matches[0].kurdish) {
              dictMatch = matches[0].kurdish;
            }
          }
          if (dictMatch) {
            let norm = normalizeText(restoreNewlines(restore(dictMatch, o.toks).trim()), isArabic, useKurdishDigits);
            norm = fixPlacementAndTagOrder(norm, o.raw);
            results[o.index] = norm;
            flags.anyTranslated = true;
          } else {
            flags.failedLines++;
            let norm = normalizeText(restoreNewlines(restore(o.text, o.toks)), isArabic, useKurdishDigits);
            norm = fixPlacementAndTagOrder(norm, o.raw);
            results[o.index] = norm;
          }
        }
        return;
      }

      // Try batch translation
      const query = subBatch.map((o) => o.text).join(`\n${BATCH_SEP}\n`);
      try {
        const translated = await translateChunk(query, srcLang, tgtLang, signal);
        const parts = splitBatch(translated);
        if (parts.length !== subBatch.length) throw new Error('merged batch');
        parts.forEach((part, k) => {
          let norm = normalizeText(restoreNewlines(restore(part, subBatch[k].toks).trim()), isArabic, useKurdishDigits);
          norm = fixPlacementAndTagOrder(norm, subBatch[k].raw);
          results[subBatch[k].index] = norm;
          if (norm && norm !== origNorm[subBatch[k].index]) flags.anyTranslated = true;
        });
      } catch (err) {
        if (signal && signal.aborted) throw err;
        // Batch failed or merged — split in half and resolve sub-batches recursively
        const mid = Math.floor(subBatch.length / 2);
        await processBatch(subBatch.slice(0, mid));
        await processBatch(subBatch.slice(mid));
      }
    }

    for (let b = 0; b < batches.length; b++) {
      const batch = batches[b];
      throwIfAborted(signal);

      await processBatch(batch);

      doneLines += batch.length;
      if (opts.onBatch) opts.onBatch(results, doneLines, totalLines); // feed the live preview
      if (onProgress) onProgress(mainFraction * (b + 1) / total, doneLines, totalLines);
      if (b < batches.length - 1) await sleep(DELAY_MS, signal);
    }

    anyTranslated = flags.anyTranslated;
    sawHardFail = flags.sawHardFail;
    failedLines = flags.failedLines;

    // If the network/API was unreachable for every line, don't hand back the
    // original text as if it were a successful translation.
    if (!anyTranslated && sawHardFail) throw new Error('Translation unavailable (network error)');

    // Optional accuracy pass: Google sometimes echoes a line back verbatim
    // instead of translating it. Retry those individually once.
    if (opts.accuracy) {
      const retries = [];
      for (let i = 0; i < lines.length; i++) {
        const orig = lines[i] || '';
        if (!orig.trim()) continue;
        if (!results[i]) continue;                              // already fell back to original
        if (normalizeText(results[i], isArabic, useKurdishDigits) !== origNorm[i]) continue; // actually translated
        if (!/\p{L}/u.test(orig)) continue;                     // pure numbers / punctuation
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
          if (norm && norm !== origNorm[i]) { results[i] = norm; if (opts.onBatch) opts.onBatch(results, doneLines + k + 1, totalLines + retryTotal); }
        } catch { /* keep the previous result */ }
        if (onProgress) onProgress(mainFraction + (1 - mainFraction) * (k + 1) / Math.max(1, retryTotal), doneLines + k + 1, totalLines + retryTotal);
      }
    }

    if (onProgress) onProgress(1, totalLines + retryTotal, totalLines + retryTotal);
    results.failedCount = failedLines;
    return results;
  }

  /**
   * Group non-empty lines into batches capped by line count and character count.
   * @returns {Array<Array<{index:number,text:string,toks:string[],raw:string}>>}
   */
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

  /** Chain the caller's AbortSignal with a per-attempt timeout so a stalled
   *  request becomes a retryable failure (via abort) instead of hanging. */
  function scopedSignal(signal) {
    const ctrl = new AbortController();
    const onAbort = () => ctrl.abort();
    if (signal) {
      if (signal.aborted) ctrl.abort();
      else signal.addEventListener('abort', onAbort, { once: true });
    }
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    return { signal: ctrl.signal, cleanup() { clearTimeout(timer); signal && signal.removeEventListener('abort', onAbort); } };
  }

  const CLIENTS = ['dict-chrome-ex', 'gtx', 'webapp', 't'];

  /**
   * Fetch from Google Translate lightweight /t endpoint (Highest stability, no 429 throttling).
   */
  async function fetchGoogleT(text, srcLang, tgtLang, signal, attempt = 0) {
    const host = GOOGLE_T_ENDPOINTS[attempt % GOOGLE_T_ENDPOINTS.length];
    const client = CLIENTS[attempt % CLIENTS.length] || 'dict-chrome-ex';
    const params = new URLSearchParams({
      client,
      sl: srcLang,
      tl: tgtLang,
      q: text,
    });
    const scoped = scopedSignal(signal);
    try {
      let res;
      // Use GET for small requests, POST for large requests or retry attempts
      if (text.length < 900 && attempt === 0) {
        res = await fetch(`${host}?${params.toString()}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json, text/plain, */*' },
          signal: scoped.signal,
        });
      } else {
        res = await fetch(host, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
            'Accept': 'application/json, text/plain, */*',
          },
          body: params.toString(),
          signal: scoped.signal,
        });
      }

      if (res.status === 429) {
        const retryAfter = Number(res.headers.get('retry-after'));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoffMs(attempt);
        const err = new Error(`HTTP 429 (throttled)`);
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
      if (typeof data === 'string' && data) return decodeHtmlEntities(data);
      if (Array.isArray(data)) {
        if (typeof data[0] === 'string') return decodeHtmlEntities(data.join('\n'));
        if (Array.isArray(data[0])) return decodeHtmlEntities(data[0].map((s) => (Array.isArray(s) ? s[0] : s || '')).join(''));
      }
      throw new Error('Empty Google /t response');
    } finally {
      scoped.cleanup();
    }
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

  /**
   * Fetch from Google Translate web endpoints (/single).
   */
  async function fetchGoogle(text, srcLang, tgtLang, signal, attempt = 0) {
    const host = GOOGLE_ENDPOINTS[attempt % GOOGLE_ENDPOINTS.length];
    const client = CLIENTS[attempt % CLIENTS.length];
    const params = new URLSearchParams({
      client,
      sl: srcLang,
      tl: tgtLang,
      dt: 't',
      ie: 'UTF-8',
      oe: 'UTF-8',
      q: text,
    });
    const scoped = scopedSignal(signal);
    try {
      let res;
      if (text.length < 900 && attempt === 0) {
        res = await fetch(`${host}?${params.toString()}`, { method: 'GET', headers: { 'Accept': 'application/json, text/plain, */*' }, signal: scoped.signal });
      } else {
        res = await fetch(host, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8', 'Accept': 'application/json, text/plain, */*' },
          body: params.toString(),
          signal: scoped.signal,
        });
      }
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get('retry-after'));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoffMs(attempt);
        const err = new Error(`HTTP 429 (throttled)`);
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
      if (typeof data === 'string' && data) return decodeHtmlEntities(data);
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const out = data[0].map((seg) => (Array.isArray(seg) ? seg[0] : '')).join('');
        if (out) return decodeHtmlEntities(out);
      } else if (data && Array.isArray(data.sentences)) {
        const out = data.sentences.map((s) => s.trans || '').join('');
        if (out) return decodeHtmlEntities(out);
      } else if (Array.isArray(data) && typeof data[0] === 'string') {
        return decodeHtmlEntities(data.join('\n'));
      }
      throw new Error('Empty or unexpected response from Google');
    } finally {
      scoped.cleanup();
    }
  }

  /**
   * Fetch from Lingva Translate API (Privacy-friendly, decentralized Google Translate mirror).
   */
  async function fetchLingva(text, srcLang, tgtLang, signal, attempt = 0) {
    const instance = LINGVA_INSTANCES[attempt % LINGVA_INSTANCES.length];
    const from = srcLang === 'auto' ? 'auto' : srcLang;
    const url = `${instance}/${encodeURIComponent(from)}/${encodeURIComponent(tgtLang)}/${encodeURIComponent(text)}`;
    const scoped = scopedSignal(signal);
    try {
      const res = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' }, signal: scoped.signal });
      if (!res.ok) throw new Error(`Lingva instance HTTP ${res.status}`);
      const data = await res.json();
      if (data && data.translation) return data.translation;
      throw new Error('Empty Lingva translation response');
    } finally {
      scoped.cleanup();
    }
  }

  /**
   * Fetch from MyMemory Translation API (Free tier, great for single phrases & lines).
   */
  async function fetchMyMemory(text, srcLang, tgtLang, signal) {
    const langpair = `${srcLang === 'auto' ? 'en' : srcLang}|${tgtLang}`;
    const params = new URLSearchParams({
      q: text,
      langpair,
    });
    const scoped = scopedSignal(signal);
    try {
      const res = await fetch(`${MYMEMORY_ENDPOINT}?${params.toString()}`, { method: 'GET', headers: { 'Accept': 'application/json' }, signal: scoped.signal });
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

  /** Translate one chunk with multi-provider failover (Google /t -> Google -> Lingva -> MyMemory). */
  async function translateChunk(text, srcLang, tgtLang, signal) {
    let lastErr;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      throwIfAborted(signal);
      try {
        if (attempt < 4) {
          try {
            return await fetchGoogleT(text, srcLang, tgtLang, signal, attempt);
          } catch (googleTErr) {
            if (googleTErr.status === 429 && googleTErr.wait) {
              await sleep(googleTErr.wait, signal);
            }
            try {
              return await fetchGoogle(text, srcLang, tgtLang, signal, attempt);
            } catch {}
            throw googleTErr;
          }
        } else if (attempt === 4) {
          try {
            return await fetchLingva(text, srcLang, tgtLang, signal, attempt);
          } catch {
            return await fetchGoogleT(text, srcLang, tgtLang, signal, attempt);
          }
        } else {
          try {
            return await fetchMyMemory(text, srcLang, tgtLang, signal);
          } catch {
            return await fetchGoogleT(text, srcLang, tgtLang, signal, attempt);
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

  // Jittered exponential backoff that keeps growing so we survive sustained 429s.
  function backoffMs(attempt) {
    return Math.min(900 * 2 ** attempt + Math.random() * 500, 9000);
  }

  /**
   * Reconstruct per-line results from a batch response. Lines are delimited by
   * a standalone BATCH_SEP marker line; any other line — including newlines
   * Google introduces inside a translation — stays attached to the current one.
   */
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

  /** Prime the connection so the user's first real translation isn't also the
   *  first request to the endpoint. Google sometimes throttles a fresh cold
   *  hit and answers on a warm one; firing a tiny request at page load moves
   *  that cold start off the critical path. Failures here are ignored. */
  async function warmup() {
    const params = new URLSearchParams({ client: 'gtx', sl: 'en', tl: 'ckb', dt: 't', q: 'hi' });
    try {
      await fetch(`${GOOGLE_ENDPOINTS[0]}?${params.toString()}`, { method: 'GET', headers: { 'Accept': 'application/json' } });
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
    ADVANCED_SUBTITLE_LEXICON,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Translator;
