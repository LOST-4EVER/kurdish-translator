/**
 * translator.js — Batch translation engine using Google Translate's free
 * web endpoint (no API key, no backend). Works on GitHub Pages.
 *
 * Batching: we send many subtitle lines joined by "\n" in one request, then
 * split the returned string back into lines. Much faster than one call per cue.
 */
const Translator = (() => {
  // Google's free endpoint lives on a few interchangeable hosts. Trying them in
  // order matters: GitHub Pages is served from datacenter IPs that Google
  // throttles more aggressively than home networks, so a second host often
  // still answers when the first keeps returning 429.
  const ENDPOINTS = [
    'https://translate.googleapis.com/translate_a/single',
    'https://clients5.google.com/translate_a/single',
    'https://translate.google.com/translate_a/single',
    'https://clients1.google.com/translate_a/single',
  ];

  // Keep requests modest to avoid timeouts on mobile networks.
  const BATCH_LINES = 35;
  const MAX_CHARS_PER_REQUEST = 2500;
  const DELAY_MS = 250;         // polite spacing between batches
  const MAX_ATTEMPTS = 5;       // retries per chunk
  const REQUEST_TIMEOUT_MS = 25000; // hang-up guard so a stalled socket retries

  // Sentinel protecting internal line breaks inside a cue so cue boundaries
  // stay unambiguous after translation. Contains no regex metacharacters and
  // is used with a literal split/join.
  const NL_SENTINEL = '§§';

  // Control character that delimits lines inside a batch request. Google keeps
  // it verbatim, so line boundaries survive even when it adds or removes plain
  // newlines. Never appears in real subtitle text.
  const BATCH_SEP = '\u0001';
  const BATCH_SEP_RE = /^[ \t\u200e\u200f.,!?;:،؛؟]*\u0001[ \t\u200e\u200f.,!?;:،؛؟]*$/;

  // Placeholder token format: [T0], [T1], etc. Google preserves bracketed tokens
  // verbatim across language pairs (including RTL targets like Kurdish ckb),
  // whereas invisible control chars (\u0002/\u0003) get stripped or mangled.
  const MARKUP_RE = /\{[^}]*\}|<[^>]*>/g;

  // Abort-aware delay: Cancel (or a timed-out scoped signal) wakes the wait
  // immediately, so a long Retry-After/backoff can't outlive the user's choice.
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

  /** Replace subtitle markup with bracketed tokens so Google keeps them verbatim. */
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
            line = leadTags + (stripped ? ' ' + stripped : '');
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

  /** Preprocess source text to improve translation accuracy for English to Kurdish Sorani. */
  function preprocessSource(text, srcLang, tgtLang) {
    if (tgtLang !== 'ckb' || (srcLang !== 'en' && srcLang !== 'auto')) return text;
    let s = text;

    // Expand gerund colloquialisms in subtitle dialogues (e.g., lookin' -> looking, runnin' -> running, doin' -> doing)
    s = s.replace(/\b([a-zA-Z]{2,})in['’](?=\s|[.,!?;:'"()[\]{}<>]|$)/gi, '$1ing');

    // Expand informal contractions and spoken dialogue slang into natural English phrases for accurate translation
    s = s.replace(/\bgonna\b/gi, 'going to')
         .replace(/\bwanna\b/gi, 'want to')
         .replace(/\bgotta\b/gi, 'have to')
         .replace(/\bkinda\b/gi, 'kind of')
         .replace(/\bsorta\b/gi, 'sort of')
         .replace(/\bdunno\b/gi, 'do not know')
         .replace(/\bi['’]?mma\b/gi, 'I am going to')
         .replace(/\bain['’]?t\b/gi, 'is not')
         .replace(/\bwhatcha\b/gi, 'what are you')
         .replace(/\bgotcha\b/gi, 'I understand')
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
         .replace(/\byeah\b|\byep\b|\byup\b/gi, 'yes')
         .replace(/\bnope\b|\bnah\b/gi, 'no')
         .replace(/\bwhat['’]?s\s+up\b|\bwassup\b|\bsup\b/gi, 'hello, how are you')
         .replace(/\bno\s+way\b/gi, 'that is impossible')
         .replace(/\bnever\s+mind\b/gi, 'do not worry')
         .replace(/\bhang\s+on\b|\bhold\s+on\b/gi, 'wait a moment')
         .replace(/\bshut\s+up\b/gi, 'be quiet')
         .replace(/\blook\s+out\b|\bwatch\s+out\b/gi, 'be careful')
         .replace(/\btake\s+care\b/gi, 'stay safe')
         .replace(/\bsee\s+ya\b|\bsee\s+you\b/gi, 'see you later')
         .replace(/\bhurry\s+up\b/gi, 'hurry')
         .replace(/\bcalm\s+down\b/gi, 'relax')
         .replace(/\bof\s+course\b/gi, 'certainly')
         .replace(/\bby\s+the\s+way\b/gi, 'incidentally')
         .replace(/\bgood\s+luck\b/gi, 'best wishes')
         .replace(/\boh\s+my\s+god\b|\bmy\s+god\b|\bomg\b/gi, 'oh God')
         .replace(/\bwhat\s+the\s+hell\b|\bwhat\s+the\s+heck\b/gi, 'what is happening')
         .replace(/\bare\s+you\s+kidding(\s+me)?\b/gi, 'are you joking')
         .replace(/\bare\s+you\s+sure\b/gi, 'are you certain')
         .replace(/\bthank\s+goodness\b|\bthank\s+god\b/gi, 'thank God')
         .replace(/\bgosh\b/gi, 'oh')
         .replace(/\bi['’]?m\s+outta\s+here\b/gi, 'I am leaving now')
         .replace(/\bno\s+biggie\b/gi, 'it is not important')
         .replace(/\bfor\s+real\b/gi, 'seriously')
         .replace(/\bfair\s+enough\b/gi, 'that is acceptable')
         .replace(/\blong\s+time\s+no\s+see\b/gi, 'it has been a long time')
         .replace(/\bmy\s+bad\b/gi, 'my mistake')
         .replace(/\bcatch\s+you\s+later\b/gi, 'see you later')
         .replace(/\bkeep\s+in\s+touch\b/gi, 'stay in contact')
         .replace(/\bwhat['’]?s\s+going\s+on\b/gi, 'what is happening')
         .replace(/\bare\s+you\s+insane\b/gi, 'are you crazy')
         .replace(/\bhow\s+come\b/gi, 'why')
         .replace(/\bso\s+far\s+so\s+good\b/gi, 'everything is going well')
         .replace(/\bmake\s+up\s+your\s+mind\b/gi, 'decide')
         .replace(/\bcount\s+me\s+in\b/gi, 'I will join')
         .replace(/\bnever\s+heard\s+of\s+it\b/gi, 'I do not know it')
         .replace(/\bgive\s+it\s+a\s+shot\b/gi, 'try it')
         .replace(/\bbeat\s+it\b/gi, 'go away')
         .replace(/\bkeep\s+it\s+up\b/gi, 'continue')
         .replace(/\bas\s+far\s+as\s+i\s+know\b/gi, 'as far as I know')
         .replace(/\bby\s+all\s+means\b/gi, 'certainly')
         .replace(/\bi\s+have\s+no\s+idea\b/gi, 'I do not know')
         .replace(/\bno\s+problem\b/gi, 'no problem')
         .replace(/\byou\s+are\s+welcome\b/gi, 'you are welcome')
         .replace(/\bdon['’]?t\s+worry\b/gi, 'do not worry')
         .replace(/\btake\s+it\s+easy\b/gi, 'relax')
         .replace(/\bmake\s+yourself\s+at\s+home\b/gi, 'feel comfortable');

    return s;
  }

  /** Normalize numbers based on preference, preserving HTML/ASS tags & bracket tokens intact. */
  function normalizeDigits(str, useKurdishDigits) {
    if (!useKurdishDigits) {
      return str.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
                .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
    }
    // Only convert digits in plain text, skipping tags and tokens
    return str.replace(/(<[^>]*>|\{[^}]*\}|\[\s*T\s*[\d\u0660-\u0669\u06f0-\u06f9]+\s*\])|([0-9\u06f0-\u06f9]+)/gi, (m, tag, nums) => {
      if (tag) return tag;
      return nums.replace(/[0-9]/g, (d) => String.fromCharCode(0x0660 + Number(d)))
                 .replace(/[\u06f0-\u06f9]/g, (d) => String.fromCharCode(0x0660 + (d.charCodeAt(0) - 0x06f0)));
    });
  }

  /** Normalize Arabic characters to Kurdish Sorani alphabet & orthography conventions. */
  function normalizeSoraniAlphabet(str) {
    let s = str.replace(/\u0643/g, 'ک')   // Arabic Kaf 'ك' -> Kurdish Keheh 'ک'
               .replace(/\u064A/g, 'ی')   // Arabic Yaa 'ي' -> Kurdish Yeh 'ی'
               .replace(/\u0649/g, 'ی')   // Arabic Alef Maksura 'ى' -> 'ی'
               .replace(/\u0629/g, 'ە');  // Arabic Teh Marbuta 'ة' -> Kurdish Small E 'ە'

    // Convert Arabic Heh 'ه' to Kurdish Small E 'ە' at word endings where appropriate (after consonants/non-vowels)
    s = s.replace(/([\u0600-\u06ff])ه(?=\s|$|[.,!?;:،؛؟])/g, (m, p) =>
      (p !== 'ئ' && p !== 'ا' && p !== 'و' && p !== 'ۆ' && p !== 'ە' ? p + 'ە' : m)
    );

    // Sorani Kurdish Heavy R (ڕ) conversions for words starting with R or standard roots
    s = s.replace(/(^|\s)رویشت(ن|م|ی|ین|ن|ووە)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕۆیشت$2')
         .replace(/(^|\s)رۆیشت(ن|م|ی|ین|ن|ووە)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕۆیشت$2')
         .replace(/(^|\s)رۆشت(ن|م|ی|ین|ن|ووە)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕۆیشت$2')
         .replace(/(^|\s)رۆ(م|یت|ات|ین|ن)(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕۆ$2')
         .replace(/(^|\s)راست(ە|ی|ەقینە|ەوخۆ|ەکان|کردنەوە|ییەکەی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕاست$2')
         .replace(/(^|\s)رێگ(ە|ا|ای|اکە|ایەک|ەی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕێگ$2')
         .replace(/(^|\s)رۆژ(انە|گار|باش|نامە|ی|ەکان)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕۆژ$2')
         .replace(/(^|\s)رەنگ(ە|ی|اوڕەنگ|ەکان)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕەنگ$2')
         .replace(/(^|\s)رێز(لێنان|م|ت|تان|گرتن)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕێز$2')
         .replace(/(^|\s)روون(کردنەوە|اک|اکی|ی|کردنەوەی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕوون$2')
         .replace(/(^|\s)رەش(ی|بین|ەبا|ماڵ)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕەش$2')
         .replace(/(^|\s)روو(داو|دات|دەدات|ی|خسار|خاو|بەڕوو|داوەکان)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕوو$2')
         .replace(/(^|\s)راپۆرت(ەکان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕاپۆرت$2')
         .replace(/(^|\s)راگەیاندن(ەکان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕاگەیاندن$2')
         .replace(/(^|\s)راگەیەندراو(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕاگەیەندراو')
         .replace(/(^|\s)رێنمایی(ەکان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕێنمایی$2')
         .replace(/(^|\s)رێژە(ی|یی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕێژە$2')
         .replace(/(^|\s)رزگار(کردن|بوون|بووم)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕزگار$2')
         .replace(/(^|\s)رازی(بوون|م)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕازی$2')
         .replace(/(^|\s)رێبوار(ان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕێبوار$2')
         .replace(/(^|\s)رابردوو(ی|دا)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕابردوو$2')
         .replace(/(^|\s)رێپێدان(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕێپێدان')
         .replace(/(^|\s)رەوانە(کردن|کرا)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕەوانە$2')
         .replace(/(^|\s)رەوشت(ی|ەکان)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕەوشت$2')
         .replace(/(^|\s)رەخنە(گرتن|یەکان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕەخنە$2')
         .replace(/(^|\s)روانین(ەکان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕوانین$2')
         .replace(/(^|\s)راهێنان(ەکان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕاهێنان$2')
         .replace(/(^|\s)راکردن(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕاکردن')
         .replace(/(^|\s)راگرتن(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕاگرتن')
         .replace(/(^|\s)رێکخستن(ەکان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕێکخستن$2')
         .replace(/(^|\s)رێکەوتن(نامە|ەکان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕێکەوتن$2')
         .replace(/(^|\s)رێسا(کان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕێسا$2')
         .replace(/(^|\s)رۆح(ی|مان|تان)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕۆح$2')
         .replace(/(^|\s)رەوش(ی|ەکان)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕەوش$2')
         .replace(/(^|\s)رێبەر(ی|یکردن|ان)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕێبەر$2')
         .replace(/(^|\s)رەگ(ی|ەکان|داکوتان)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕەگ$2')
         .replace(/(^|\s)رووت(ی|کراوە)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕووت$2')
         .replace(/(^|\s)رەق(ی|تر|ەکان)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕەق$2')
         .replace(/(^|\s)رق(م|ت|ی|لێبوونەوە)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕق$2')
         .replace(/(^|\s)رژێم(ی|ەکان)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕژێم$2')
         .replace(/(^|\s)راوەست(ە|ان|ین|ن)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕاوەست$2')
         .replace(/(^|\s)راکە(ن|یت)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕاکە$2')
         .replace(/(^|\s)رێنووس(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕێنووس')
         .replace(/(^|\s)ریش(ەکە|م|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕیش$2')
         .replace(/(^|\s)ریشە(ی|کان)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕیشە$2')
         .replace(/(^|\s)برۆ(ن|یت)?(?=\s|$|[.,!?;:،؛؟])/g, '$1بڕۆ$2')
         .replace(/(^|\s)مەرۆ(ن)?(?=\s|$|[.,!?;:،؛؟])/g, '$1مەڕۆ$2');

    // Sorani Kurdish Velarized L (ڵ) corrections
    s = s.replace(/(^|\s)مال(ی|ەوە|مان|تان|یان|ەکەم|ەکان)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ماڵ$2')
         .replace(/(^|\s)بەلێ(م)?(?=\s|$|[.,!?;:،؛؟])/g, '$1بەڵێ$2')
         .replace(/(^|\s)دەلێ(ت|م|ن|یت|ین)(?=\s|$|[.,!?;:،؛؟])/g, '$1دەڵێ$2')
         .replace(/(^|\s)بلێ(ن|م|یت|ین)?(?=\s|$|[.,!?;:،؛؟])/g, '$1بڵێ$2')
         .replace(/(^|\s)گول(م|ەکان|ی|زار)?(?=\s|$|[.,!?;:،؛؟])/g, '$1گوڵ$2')
         .replace(/(^|\s)سال(ان|ی|ە|انە|ێک)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ساڵ$2')
         .replace(/خۆشحال(ی|ییە| بووم|م)?/g, 'خۆشحاڵ$1')
         .replace(/(^|\s)مندال(ان|ەکە|م|ی|بوون)?(?=\s|$|[.,!?;:،؛؟])/g, '$1منداڵ$2')
         .replace(/(^|\s)سلاو(تان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1سڵاو$2')
         .replace(/(^|\s)گەلا(کان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1گەڵا$2')
         .replace(/(^|\s)کەلەک(ەم|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1کەڵەک$2')
         .replace(/(^|\s)چۆل(ە|ی|کردن)?(?=\s|$|[.,!?;:،؛؟])/g, '$1چۆڵ$2')
         .replace(/(^|\s)تەلە(ی|کان)?(?=\s|$|[.,!?;:،؛؟])/g, '$1تەڵە$2')
         .replace(/(^|\s)خال(ی|م|ەکان)?(?=\s|$|[.,!?;:،؛؟])/g, '$1خاڵ$2')
         .replace(/(^|\s)تال(ە|ی|تر)?(?=\s|$|[.,!?;:،؛؟])/g, '$1تاڵ$2')
         .replace(/(^|\s)پیالە(ی|یک|کان)?(?=\s|$|[.,!?;:،؛؟])/g, '$1پیاڵە$2')
         .replace(/(^|\s)دل(م|ت|ی|خۆش|تەنگ|نیام|نیابە|نیا|سۆز|پاک)?(?=\s|$|[.,!?;:،؛؟])/g, '$1دڵ$2')
         .replace(/(^|\s)پۆلا(?=\s|$|[.,!?;:،؛؟])/g, '$1پۆڵا')
         .replace(/(^|\s)قولپ(?=\s|$|[.,!?;:،؛؟])/g, '$1قوڵپ')
         .replace(/(^|\s)کەلەشێر(?=\s|$|[.,!?;:،؛؟])/g, '$1کەڵەشێر')
         .replace(/(^|\s)کەلک(?=\s|$|[.,!?;:،؛؟])/g, '$1کەڵک')
         .replace(/(^|\s)بالا(?=\s|$|[.,!?;:،؛؟])/g, '$1باڵا')
         .replace(/(^|\s)قەلا(?=\s|$|[.,!?;:،؛؟])/g, '$1قەڵا')
         .replace(/(^|\s)چەپلە(?=\s|$|[.,!?;:،؛؟])/g, '$1چەپڵە')
         .replace(/(^|\s)کۆمەل(گا|ایەتی|ەکان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1کۆمەڵ$2')
         .replace(/(^|\s)ئالۆز(ی|تر)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ئاڵۆز$2')
         .replace(/(^|\s)هەلە(کان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1هەڵە$2')
         .replace(/(^|\s)تێکەل(?=\s|$|[.,!?;:،؛؟])/g, '$1تێکەڵ')
         .replace(/(^|\s)گەلالە(?=\s|$|[.,!?;:،؛؟])/g, '$1گەڵاڵە')
         .replace(/(^|\s)کۆلان(ەکان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1کۆڵان$2')
         .replace(/(^|\s)قوول(ی|تر)?(?=\s|$|[.,!?;:،؛؟])/g, '$1قووڵ$2')
         .replace(/(^|\s)قول(ی|تر)?(?=\s|$|[.,!?;:،؛؟])/g, '$1قووڵ$2')
         .replace(/گۆرانکاری/g, 'گۆڕانکاری')
         .replace(/سپاس/g, 'سوپاس');

    return s;
  }

  /** Rejoin split Sorani Kurdish verbal affixes & compound preverbs. */
  function rejoinVerbalAffixes(str) {
    return str
      .replace(/(^|\s)دە\s+(بێت|بم|بیت|بین|بن|زانم|زانی|زانێت|زانین|زانن|کات|کەم|کەیت|کەین|کەن|توانی|توانم|توانێت|توانین|توانن|چێت|چم|چیت|چین|چن|ڕۆم|رۆم|ڕۆیت|رۆیت|ڕوات|روات|ڕۆین|رۆین|ڕۆن|رۆن|ڵێت|ڵێم|ڵێیت|ڵێین|ڵێن|هێنێت|هێنم|هێنیت|هێنین|هێنن|یەوێت|خوات|خۆم|خۆین|خۆن|کراو|بینم|بینێت|بینین|بینن|وەستێت|گەڕێتەوە|نووسێت|نووسم|نووسین|دات|دەین|دەکان|بەن|بەین|دێت|دەبێتەوە|فرۆشێت|کڕێت|ژیم|ژیت|ژی|ژیین|ژین|مرێت|بیستێت|گرێت|بەستێت|گەین|کەویت|بارێت|گۆڕێت)(?=\s|$|[.,!?;:،؛؟])/g, '$1دە$2')
      .replace(/(^|\s)ئە\s+(بێت|بم|بیت|بین|بن|زانم|زانی|زانێت|کات|کەم|کەیت|کەین|چێت|چم|چیت|چین|ڕۆم|ڕۆیت|ڕوات|ڕۆین|ڵێت|ڵێم|هێنێت|هێنم|یەوێت|خوات|خۆم|بینم|بینێت|دات|دێت)(?=\s|$|[.,!?;:،؛؟])/g, '$1ئە$2')
      .replace(/(^|\s)نا\s+(زانم|زانی|زانێت|زانین|زانن|کات|کەم|کەیت|کەن|ناکەین|بێت|بم|بیت|بین|بن|کرێت|کرێن|توانی|توانم|توانێت|توانین|توانن|چێت|چم|چیت|چین|چن|ڵێم|ڵێت|ڵێن|گەڕێتەوە|بینم|بینێت|وێت|نامەوێت|ناوێت|خۆم|خوات|دات|نادەم|دەین|کەوم|کەوێت|ڕوات|روات|مرێت|بیستم|بیستێت|ڕۆم|ڕۆیت|ڕۆین|ڕۆن)(?=\s|$|[.,!?;:،؛؟])/g, '$1نا$2')
      .replace(/(^|\s)نە\s+(بێت|کات|کرێت|بوو|بووم|بوویت|بووین|بوون|ڕۆیشت|رویشت|هات|هاتم|هاتیت|هاتین|هاتن|زانی|زانیم|زانیت|توانی|دیت|کرد|کردم|کردت|کردمان|چوو|چووم|چوویت|چووین|چوون|گەیی|گەیشت|دەبوو|بینرا|خورا|کوژرا|شکێنرا|خوێندەوە|فرۆشت)(?=\s|$|[.,!?;:،؛؟])/g, '$1نە$2')
      .replace(/(^|\s)مە\s+(کە|ڕۆ|رۆ|کەیت|بۆوە|چۆ|چن|بڕۆ|برۆ|گەڕێ|بە|بن|کەن|ترسە|ترسن|گری|گرین|شکێنە|کوژە|خۆ|خۆن|دە|دەن|هێنە|نووسە|گرە|بڕە|خوێنەوە|بەخشە)(?=\s|$|[.,!?;:،؛؟])/g, '$1مە$2')
      .replace(/(^|\s)بی\s+(کە|بە|بینە|گەیەنە|خۆ|نووسە|هێنە|بەخشە|پارێزە|کوژە|دە|خوێنەوە|شکێنە)(?=\s|$|[.,!?;:،؛؟])/g, '$1بی$2')
      .replace(/(^|\s)تێ\s+(دەگەم|بگە|دەگەیت|دەگەن|دەگەین|پەڕی|پەڕین|ناگەم|پەڕیوە)(?=\s|$|[.,!?;:،؛؟])/g, '$1تێ$2')
      .replace(/(^|\s)ڕێ\s+(گرتن|دەگرێت|بگرە|ناگرێت|بگرن|کەوتن|کەوتین|کەوتنەوە|کەوتووە)(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕێ$2')
      .replace(/(^|\s)پێ\s+(دان|دەدات|دەڵێت|دەبەخشێت|بڵێ|بڵێن|بدە|نادەم|نادات|بەخشی)(?=\s|$|[.,!?;:،؛؟])/g, '$1پێ$2')
      .replace(/(^|\s)وەر\s+(بگرە|گرتن|دەگرێت|ناگرێت|مەگرە|گیرا|گیراوە)(?=\s|$|[.,!?;:،؛؟])/g, '$1وەر$2')
      .replace(/(^|\s)دەر\s+(کەوت|کەوتن|چوون|چوونی|بێنە|هێنانی|دەچێت|دەخات|دەکەوێت|کەوتووە)(?=\s|$|[.,!?;:،؛؟])/g, '$1دەر$2')
      .replace(/(^|\s)دا\s+(نیشە|دەنیشێت|پۆشە|خستن|داخە|دابخە|گرتن|بەزین|بەزی|مەپۆشە)(?=\s|$|[.,!?;:،؛؟])/g, '$1دا$2')
      .replace(/(^|\s)[هھ]ەڵ\s+(بگرە|ستە|دەستێت|گرتن|گرە|بژێرە|بڕژێ|کشان|واسە|مەگرە)(?=\s|$|[.,!?;:،؛؟])/g, '$1هەڵ$2')
      .replace(/(^|\s)دەست\s+(پێکرد|پێبکە|پێدەکات|پێکردن|پێ بگە|بەردار|نیشان|پێکە)(?=\s|$|[.,!?;:،؛؟])/g, '$1دەست$2')
      .replace(/\s+ەوە(?=\s|$|[.,!?;:،؛؟])/g, 'ەوە')
      .replace(/\s+یش(?=\s|$|[.,!?;:،؛؟])/g, 'یش');
  }

  /** Naturalize machine-translated subtitle dialogue for fluent Sorani Kurdish. */
  function naturalizeDialogue(str) {
    if (!str) return '';
    return str
      // Remove mechanical, non-dialogue question particle "ئایا" at start of sentences
      .replace(/(^|[\s،؛؟.\n])ئایا\s+/g, '$1')
      .replace(/ئۆ خوای من/g, 'ئەی خوایە')
      .replace(/خوای من/g, 'ئەی خوایە')
      .replace(/ئەی خوای گەورە/g, 'ئەی خوایە')
      .replace(/سەیر بکە،/g, 'سەیرکە،')
      .replace(/سەیر بکە/g, 'سەیرکە')
      .replace(/من زۆر سوپاستان دەکەم/g, 'زۆر سوپاس')
      .replace(/هیچ کێشەیەک نییە/g, 'کێشە نییە')
      .replace(/کێشەیەک نییە/g, 'کێشە نییە')
      .replace(/بە دڵنیاییەوە/g, 'بێگومان')
      .replace(/سوپاس بۆ تۆ/g, 'سوپاس')
      .replace(/زۆر سوپاس بۆ تۆ/g, 'زۆر سوپاس')
      .replace(/بە ڵێ/g, 'بەڵێ')
      .replace(/بەل ێ/g, 'بەڵێ')
      .replace(/دە ڵێ/g, 'دەڵێ')
      .replace(/سو پاس/g, 'سوپاس')
      .replace(/س ڵاو/g, 'سڵاو')
      .replace(/سڵا و/g, 'سڵاو')
      .replace(/خۆ شحاڵ/g, 'خۆشحاڵ')
      .replace(/خۆش حاڵ/g, 'خۆشحاڵ')
      .replace(/بێ گومان/g, 'بێگومان')
      .replace(/لە کوێ/g, 'لەکوێ')
      .replace(/بۆ چی/g, 'بۆچی')
      .replace(/لە بەر/g, 'لەبەر')
      .replace(/لە گەڵ/g, 'لەگەڵ')
      .replace(/بە تایبەت/g, 'بەتایبەت')
      .replace(/دە بارەی/g, 'دەربارەی')
      .replace(/دەربارە ی/g, 'دەربارەی')
      .replace(/ڕاستە قینە/g, 'ڕاستەقینە')
      .replace(/پێش ئەوە ی/g, 'پێش ئەوەی')
      .replace(/پاش ئەوە ی/g, 'پاش ئەوەی')
      .replace(/هەر چەندە/g, 'هەرچەندە')
      .replace(/هەر وەها/g, 'هەروەها')
      .replace(/هەر یەک/g, 'هەریەک')
      .replace(/هەر ئێستا/g, 'هەرئێستا')
      .replace(/هەر چۆنێک بێت/g, 'هەرچۆنێک بێت')
      .replace(/لە ئێستادا/g, 'لەئێستادا')
      .replace(/لە ڕاستیدا/g, 'لەڕاستیدا')
      .replace(/بە شێوەیەکی گشتی/g, 'بەگشتی')
      .replace(/بە هیچ شێوەیەک/g, 'بەهیچ شێوەیەک')
      .replace(/جێگای داخە/g, 'بەداخەوە')
      .replace(/بەداخەوەم/g, 'بەداخەوە')
      .replace(/تۆ لە کوێیت/g, 'لەکوێیت')
      .replace(/لە کوێیت تۆ/g, 'لەکوێیت')
      .replace(/چۆنیت تۆ/g, 'چۆنیت')
      .replace(/تۆ چۆنیت/g, 'چۆنیت')
      .replace(/تۆ کێیت/g, 'کێیت')
      .replace(/کێیت تۆ/g, 'کێیت')
      .replace(/بەخێر بێیت/g, 'بەخێربێیت')
      .replace(/بەخێر بێن/g, 'بەخێربێن')
      .replace(/دەستت خۆش بێت/g, 'دەستت خۆش')
      .replace(/خۆشحاڵ بووم بتبینم/g, 'خۆشحاڵ بووم بە بینینت');
  }

  /**
   * Clean up Google's typography and grammar for a subtitle line, applying Sorani Kurdish
   * conventions (r12a orthography notes / Kurdish Academy & subtitle natural dialogue):
   *  - remove stray space before punctuation ("word !" -> "word!")
   *  - pull punctuation that landed on its own line up to the previous line
   *  - normalize Eastern numbers to ASCII or Kurdish numbers based on preference
   *  - convert Arabic characters to Kurdish equivalents (Kaf, Yaa, Teh Marbuta, Heh)
   *  - join split Sorani verbal prefixes/affixes
   *  - naturalize subtitle conversational dialogue
   *  - use Arabic script marks: comma "،", semicolon "؛", question "؟"
   */
  function normalizeText(text, isArabic, useKurdishDigits = false) {
    if (!text) return '';
    let t = text
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      .replace(/[ \t]+([.,!?;:،؛؟]+)/g, '$1')
      .replace(/\n+([.,!?;:،؛؟]+)/g, '$1');

    if (isArabic) {
      // Strip Arabic short vowel diacritics / Harakat & Tatweel
      t = t.replace(/[\u064b-\u0652\u0670]/g, '').replace(/\u0640/g, '');

      // Normalize digits
      t = normalizeDigits(t, useKurdishDigits);

      // Kurdish alphabet normalization
      t = normalizeSoraniAlphabet(t);

      // Rejoin split Sorani Kurdish verbal affixes
      t = rejoinVerbalAffixes(t);

      // Naturalize dialogue
      t = naturalizeDialogue(t);

      // Kurdish Punctuation (preserve HTML/ASS tags & bracket tokens)
      t = t.replace(/(<[^>]*>|\{[^}]*\}|\[\s*T\s*[\d\u0660-\u0669\u06f0-\u06f9]+\s*\])|([,;?])/gi, (m, tag, punct) => {
        if (tag) return tag;
        if (punct === ',') return '،';
        if (punct === ';') return '؛';
        if (punct === '?') return '؟';
        return punct;
      });

      // Purge isolated placeholder remnants (like stray 'W', 'w', 'p', 'P', 'T', 't')
      t = t.replace(/(^|[\s،؛؟.\n])[WwPpTt](?=[\s،؛؟.,!?:-]|$)/g, '$1')
           .replace(/[ \t]{2,}/g, ' ');
    }

    return t;
  }

  /**
   * Standardize text for fast, forgiving search matches across Arabic, Persian, Kurdish, and Latin scripts.
   * Strips diacritics, unifies Arabic/Kurdish letter variants (ڵ/ل, ڕ/ر, ێ/ی, ۆ/و, أ/إ/ا, ك/ک, ي/ى/ی, ة/ه/ە), converts numbers to ASCII, and lowercases.
   */
  function normalizeForSearch(str) {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .replace(/[\u064b-\u0652\u0670\u0640]/g, '') // strip Arabic diacritics & tatweel
      .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660)) // Arabic-Indic digits
      .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0)) // Eastern Arabic digits
      .replace(/[\u0622\u0623\u0625\u0626\u0671]/g, 'ا') // آ, أ, إ, ئ, ٱ -> ا
      .replace(/\u0643/g, 'ک') // ك -> ک
      .replace(/[\u064A\u0649\u06CE\u06CC]/g, 'ی') // ي, ى, ێ, ی -> ی
      .replace(/[\u0629\u06BE\u06C1]/g, 'ە') // ة, ھ, ہ -> ە
      .replace(/[\u06B5]/g, 'ل') // ڵ -> ل
      .replace(/[\u0695\u0696]/g, 'ر') // ڕ, ڑ -> ر
      .replace(/[\u06C6\u06C7\u06C8]/g, 'و') // ۆ, ۇ, ۈ -> و
      .replace(/[،,]/g, ' ')
      .replace(/[؟?]/g, ' ')
      .replace(/[؛;]/g, ' ')
      .replace(/[.!:_"-]/g, ' ')
      .replace(/[\u200c\u200d\u200e\u200f]/g, '') // invisible zero-width chars
      .replace(/\s+/g, ' ')
      .trim();
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

    for (let b = 0; b < batches.length; b++) {
      const batch = batches[b];
      throwIfAborted(signal);
      const query = batch.map((o) => o.text).join(`\n${BATCH_SEP}\n`);

      try {
        const translated = await translateChunk(query, srcLang, tgtLang, signal);
        // Google sometimes drops the marker lines. If the response doesn't line
        // up exactly, re-translate one line at a time rather than dropping text.
        const parts = splitBatch(translated);
        if (parts.length !== batch.length) throw new Error('merged batch');
        parts.forEach((part, k) => {
          let norm = normalizeText(restoreNewlines(restore(part, batch[k].toks).trim()), isArabic, useKurdishDigits);
          norm = fixPlacementAndTagOrder(norm, batch[k].raw);
          if (opts.applyNames && opts.charNames && opts.charNames.length) {
            norm = applyCharacterReplacements(norm, opts.charNames, { fuzzyTypo: opts.fuzzyTypo });
          }
          results[batch[k].index] = norm;
          if (norm && norm !== origNorm[batch[k].index]) anyTranslated = true;
        });
      } catch (err) {
        if (signal && signal.aborted) throw err;
        // Batch failed — fall back to one request per line.
        for (const o of batch) {
          throwIfAborted(signal);
          try {
            let norm = normalizeText(restoreNewlines(restore(await translateChunk(o.text, srcLang, tgtLang, signal), o.toks).trim()), isArabic, useKurdishDigits);
            norm = fixPlacementAndTagOrder(norm, o.raw);
            if (opts.applyNames && opts.charNames && opts.charNames.length) {
              norm = applyCharacterReplacements(norm, opts.charNames, { fuzzyTypo: opts.fuzzyTypo });
            }
            results[o.index] = norm;
            if (norm && norm !== origNorm[o.index]) anyTranslated = true;
          } catch (e) {
            if (e && e.hard) sawHardFail = true;
            failedLines++;
            let norm = normalizeText(restoreNewlines(restore(o.text, o.toks)), isArabic, useKurdishDigits);
            norm = fixPlacementAndTagOrder(norm, o.raw);
            if (opts.applyNames && opts.charNames && opts.charNames.length) {
              norm = applyCharacterReplacements(norm, opts.charNames, { fuzzyTypo: opts.fuzzyTypo });
            }
            results[o.index] = norm;
          }
        }
      }

      doneLines += batch.length;
      if (opts.onBatch) opts.onBatch(results, doneLines, totalLines); // feed the live preview
      if (onProgress) onProgress(mainFraction * (b + 1) / total, doneLines, totalLines);
      if (b < batches.length - 1) await sleep(DELAY_MS, signal);
    }

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
    if (failedLines > 0 && anyTranslated) {
      const err = new Error(`${failedLines} line(s) could not be translated and were kept as original text`);
      err.partial = true;
      err.failedCount = failedLines;
      err.results = results;
      throw err;
    }
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

  const CLIENTS = ['gtx', 'dict-chrome-ex', 'dict-chromeex', 'te'];

  /** Translate one chunk, retrying with exponential backoff across hosts. */
  async function translateChunk(text, srcLang, tgtLang, signal) {
    const params = new URLSearchParams({
      client: 'gtx',
      sl: srcLang,
      tl: tgtLang,
      dt: 't',
      ie: 'UTF-8',
      oe: 'UTF-8',
      q: text,
    });
    let lastErr;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const host = ENDPOINTS[attempt % ENDPOINTS.length];
      const client = CLIENTS[attempt % CLIENTS.length];
      params.set('client', client);
      const url = `${host}?${params.toString()}`;
      const scoped = scopedSignal(signal);
      try {
        let res = null;
        // Try POST first for longer text payloads to avoid URL length issues
        if (text.length > 300) {
          try {
            res = await fetch(host, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', 'Accept': 'application/json' },
              body: params.toString(),
              signal: scoped.signal,
            });
          } catch {
            res = null;
          }
        }
        if (!res || (!res.ok && res.status !== 429 && res.status !== 400 && res.status !== 403)) {
          res = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' }, signal: scoped.signal });
        }

        if (res.status === 429) {
          // Throttled. Wait for the server's Retry-After (or a backoff) and
          // keep trying — this is the common failure on datacenter IPs.
          const retryAfter = Number(res.headers.get('retry-after'));
          const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoffMs(attempt);
          lastErr = new Error(`HTTP 429 (throttled), retrying in ${Math.round(wait / 1000)}s`);
          await sleep(wait, signal);
          continue;
        }
        if (!res.ok) { const e = new Error(`HTTP ${res.status}`); e.hard = res.status >= 500; throw e; }
        const data = await res.json();
        // Google returns data[0] as an array of [translation, original, ...],
        // or an object { sentences: [{ trans: '...' }] } depending on client mode.
        if (Array.isArray(data) && Array.isArray(data[0])) {
          const out = data[0].map((seg) => (Array.isArray(seg) ? seg[0] : '')).join('');
          if (out) return out;
        } else if (data && Array.isArray(data.sentences)) {
          const out = data.sentences.map((s) => s.trans || '').join('');
          if (out) return out;
        }
        throw new Error('Empty or unexpected response');
      } catch (err) {
        if (signal && signal.aborted) throw err;
        // A rejected fetch (offline) is a network hard failure, distinct from
        // a Google "unexpected/empty response" which we simply retry.
        if (err instanceof TypeError) err.hard = true;
        // A request aborted by our per-attempt timeout (any AbortError here is
        // ours — a user cancel was rethrown above) means the socket stalled, so
        // count it as a hard failure rather than reporting fake success.
        if (err && err.name === 'AbortError') err.hard = true;
        if (!(err instanceof Error)) { err = new Error(String(err && err.message)); }
        lastErr = err;
        if (attempt < MAX_ATTEMPTS - 1) await sleep(backoffMs(attempt), signal);
      } finally {
        scoped.cleanup();
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
          const item = sub[s].replace(/^[ \t\u200e\u200f.,!?;:،؛؟]+|[ \t\u200e\u200f.,!?;:،؛؟]+$/g, '').trim();
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

  /** Known character name mapping dictionary with Kurdish translation and phonetic pronunciation */
  const KNOWN_CHARACTER_NAMES = {
    john: { kurdish: 'جۆن', pronunciation: 'جۆن (Dzhon)' },
    jhon: { kurdish: 'جۆن', pronunciation: 'جۆن (Dzhon)' },
    johnn: { kurdish: 'جۆن', pronunciation: 'جۆن (Dzhon)' },
    arthur: { kurdish: 'ئارثەر', pronunciation: 'ئارثەر (Ar-ther)' },
    sarah: { kurdish: 'سارا', pronunciation: 'سارا (Sa-rah)' },
    sara: { kurdish: 'سارا', pronunciation: 'سارا (Sa-rah)' },
    mary: { kurdish: 'ماری', pronunciation: 'ماری (Ma-ry)' },
    maria: { kurdish: 'ماریا', pronunciation: 'ماریا (Ma-ri-a)' },
    michael: { kurdish: 'مایکڵ', pronunciation: 'مایکڵ (My-kel)' },
    micheal: { kurdish: 'مایکڵ', pronunciation: 'مایکڵ (My-kel)' },
    david: { kurdish: 'دەیڤد', pronunciation: 'دەیڤد (Day-vid)' },
    peter: { kurdish: 'پیتەر', pronunciation: 'پیتەر (Pee-ter)' },
    alex: { kurdish: 'ئەلێکس', pronunciation: 'ئەلێکس (A-lex)' },
    jack: { kurdish: 'جاک', pronunciation: 'جاک (Jack)' },
    tom: { kurdish: 'تۆم', pronunciation: 'تۆم (Tom)' },
    harry: { kurdish: 'هاری', pronunciation: 'هاری (Har-ry)' },
    james: { kurdish: 'جەیمس', pronunciation: 'جەیمس (James)' },
    robert: { kurdish: 'ڕۆبەرت', pronunciation: 'ڕۆبەرت (Ro-bert)' },
    charlie: { kurdish: 'چارلی', pronunciation: 'چارلی (Char-lie)' },
    daniel: { kurdish: 'دانیال', pronunciation: 'دانیال (Da-ni-al)' },
    emma: { kurdish: 'ئێما', pronunciation: 'ئێما (Em-ma)' },
    oliver: { kurdish: 'ئۆلیڤەر', pronunciation: 'ئۆلیڤەر (O-li-ver)' },
    spongebob: { kurdish: 'سپۆنجبۆب', pronunciation: 'سپۆنجبۆب (Sponge-Bob)' },
    naruto: { kurdish: 'ناروتۆ', pronunciation: 'ناروتۆ (Na-ru-to)' },
    sasuke: { kurdish: 'ساسکێ', pronunciation: 'ساسکێ (Sa-su-ke)' },
    luffy: { kurdish: 'لوفی', pronunciation: 'لوفی (Luf-fy)' },
    goku: { kurdish: 'گۆکو', pronunciation: 'گۆکو (Go-ku)' },
    bruce: { kurdish: 'برووس', pronunciation: 'برووس (Bruce)' },
    clark: { kurdish: 'کلارک', pronunciation: 'کلارک (Clark)' },
    tony: { kurdish: 'تۆنی', pronunciation: 'تۆنی (To-ny)' },
    steve: { kurdish: 'ستێڤ', pronunciation: 'ستێڤ (Steve)' },
    sam: { kurdish: 'سام', pronunciation: 'سام (Sam)' },
    alice: { kurdish: 'ئالیس', pronunciation: 'ئالیس (A-lice)' },
    grace: { kurdish: 'گرەیْس', pronunciation: 'گرەیْس (Grace)' },
  };

  /** Auto-suggest Kurdish name and phonetic pronunciation guide for any character name */
  function suggestKurdishNameAndPronun(origName) {
    if (!origName) return { kurdish: '', pronunciation: '' };
    const clean = origName.trim();
    const lower = clean.toLowerCase();
    if (KNOWN_CHARACTER_NAMES[lower]) {
      return KNOWN_CHARACTER_NAMES[lower];
    }

    let kurdish = clean
      .replace(/ph/gi, 'ف')
      .replace(/sh/gi, 'ش')
      .replace(/ch/gi, 'چ')
      .replace(/th/gi, 'ث')
      .replace(/kh/gi, 'خ')
      .replace(/zh/gi, 'ژ')
      .replace(/ck/gi, 'ک')
      .replace(/ee/gi, 'ی')
      .replace(/oo/gi, 'وو')
      .replace(/ou/gi, 'وو')
      .replace(/ai/gi, 'ەی')
      .replace(/ea/gi, 'ی')
      .replace(/ie/gi, 'ی')
      .replace(/^a/gi, 'ئە')
      .replace(/^e/gi, 'ئێـ')
      .replace(/^i/gi, 'ئیـ')
      .replace(/^o/gi, 'ئۆ')
      .replace(/^u/gi, 'ئوو')
      .replace(/a/gi, 'ا')
      .replace(/b/gi, 'ب')
      .replace(/c/gi, 'ک')
      .replace(/d/gi, 'د')
      .replace(/e/gi, 'ێ')
      .replace(/f/gi, 'ف')
      .replace(/g/gi, 'گ')
      .replace(/h/gi, 'هـ')
      .replace(/i/gi, 'ی')
      .replace(/j/gi, 'ج')
      .replace(/k/gi, 'ک')
      .replace(/l/gi, 'ل')
      .replace(/m/gi, 'م')
      .replace(/n/gi, 'ن')
      .replace(/o/gi, 'ۆ')
      .replace(/p/gi, 'پ')
      .replace(/q/gi, 'ق')
      .replace(/r/gi, 'ڕ')
      .replace(/s/gi, 'س')
      .replace(/t/gi, 'ت')
      .replace(/u/gi, 'وو')
      .replace(/v/gi, 'ڤ')
      .replace(/w/gi, 'و')
      .replace(/x/gi, 'کس')
      .replace(/y/gi, 'ی')
      .replace(/z/gi, 'ز');

    kurdish = kurdish.replace(/اا+/g, 'ا').replace(/یی+/g, 'ی').replace(/وووو+/g, 'وو');
    return { kurdish, pronunciation: `${kurdish} (${clean})` };
  }

  /** Smart recognition scanning subtitle cues for speaker tags and character names */
  function smartRecognizeNamesFromCues(cues) {
    if (!cues || !cues.length) return [];
    const nameCounts = new Map();

    for (const cue of cues) {
      const text = cue.rawText || cue.text || '';
      if (!text) continue;

      const speakerMatches = text.matchAll(/(?:^|[\r\n])(?:\[|\()?([A-Z][a-zA-Z'’-]{2,18})(?:\]|\))?\s*[:\-]/g);
      for (const m of speakerMatches) {
        const name = m[1].trim();
        if (name && !/^(WEBVTT|NOTE|STYLE|REGION|DIALOGUE|START|END)$/i.test(name)) {
          const norm = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
          nameCounts.set(norm, (nameCounts.get(norm) || 0) + 5);
        }
      }

      const wordMatches = text.matchAll(/\b([A-Z][a-z]{2,15})\b/g);
      for (const m of wordMatches) {
        const name = m[1].trim();
        if (!/^(The|And|You|They|What|Where|When|Why|How|This|That|Here|There|With|From|Have|Will|Would|Could|Should|Your|Their|Some|Many|Much|More|Most|Good|Well|Yeah|Okay|Sure|Please|Thank|Thanks|Hello|What's|There's|Here's)$/i.test(name)) {
          nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
        }
      }
    }

    const recognized = [];
    const seenLower = new Set();
    for (const [name, count] of nameCounts.entries()) {
      if (count >= 2 && !seenLower.has(name.toLowerCase())) {
        seenLower.add(name.toLowerCase());
        const suggested = suggestKurdishNameAndPronun(name);
        recognized.push({
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          original: name,
          kurdish: suggested.kurdish,
          pronunciation: suggested.pronunciation,
        });
      }
    }

    return recognized;
  }

  /** Apply character replacements to text across exact matches, speaker tags, and typo variations */
  function applyCharacterReplacements(text, charNames, options = {}) {
    if (!text || !charNames || !charNames.length) return text;
    let result = text;
    const fuzzy = options.fuzzyTypo !== false;

    for (const entry of charNames) {
      if (!entry || !entry.original || !entry.kurdish) continue;
      const orig = entry.original.trim();
      const kurdish = entry.kurdish.trim();
      if (!orig || !kurdish) continue;

      const escaped = orig.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      const speakerRe = new RegExp(`(^|[\\s[\({<"'\`])` + escaped + `([:\\s\\])\}'>"'\`-]|$)`, 'gi');
      result = result.replace(speakerRe, (m, p1, p2) => p1 + kurdish + p2);

      const wordRe = new RegExp(`\\b` + escaped + `\\b`, 'gi');
      result = result.replace(wordRe, kurdish);

      if (fuzzy && orig.length >= 3) {
        const typoPatterns = [];

        for (let i = 0; i < orig.length - 1; i++) {
          const transposed = orig.slice(0, i) + orig[i + 1] + orig[i] + orig.slice(i + 2);
          if (transposed.toLowerCase() !== orig.toLowerCase()) {
            typoPatterns.push(transposed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
          }
        }

        for (let i = 0; i < orig.length; i++) {
          const duped = orig.slice(0, i + 1) + orig[i] + orig.slice(i + 1);
          if (duped.toLowerCase() !== orig.toLowerCase()) {
            typoPatterns.push(duped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
          }
        }

        if (typoPatterns.length > 0) {
          const typoRe = new RegExp(`\\b(?:` + typoPatterns.join('|') + `)\\b`, 'gi');
          result = result.replace(typoRe, kurdish);
        }
      }
    }

    return result;
  }

  /** Prime the connection so the user's first real translation isn't also the
   *  first request to the endpoint. Google sometimes throttles a fresh cold
   *  hit and answers on a warm one; firing a tiny request at page load moves
   *  that cold start off the critical path. Failures here are ignored. */
  async function warmup() {
    const params = new URLSearchParams({ client: 'gtx', sl: 'en', tl: 'ckb', dt: 't', q: 'hi' });
    try {
      await fetch(`${ENDPOINTS[0]}?${params.toString()}`, { method: 'GET', headers: { 'Accept': 'application/json' } });
    } catch {}
  }

  return { translateLines, warmup, normalizeText, normalizeDigits, preprocessSource, protect, restore, cleanLeftoverTokens, fixPlacementAndTagOrder, naturalizeDialogue, normalizeForSearch, suggestKurdishNameAndPronun, smartRecognizeNamesFromCues, applyCharacterReplacements };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Translator;
