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
   * Comprehensive dictionary of Advanced English Expressions, idioms, phrasal verbs,
   * and subtitles colloquialisms with rich, nuanced Kurdish translations and alternatives.
   */
  const ADVANCED_SUBTITLE_LEXICON = {
    'piece of cake': { kurdish: 'کارێکی زۆر ئاسان', context: 'Very easy', alternatives: ['وەک ئاو خواردنەوە', 'زۆر سادەیە'] },
    'break a leg': { kurdish: 'بەهیوای سەرکەوتن', context: 'Good luck', alternatives: ['بەختێکی باش', 'سەرکەوتوو بیت'] },
    'out of the blue': { kurdish: 'لەناکاو', context: 'Unexpectedly', alternatives: ['کتوپڕ', 'بەبێ چاوەڕوانی', 'لە پڕێکدا'] },
    'all of a sudden': { kurdish: 'لەپڕدا', context: 'Suddenly', alternatives: ['لەناکاو', 'کتوپڕ'] },
    'at the end of the day': { kurdish: 'لە کۆتاییدا', context: 'Ultimately', alternatives: ['سەرەنجام', 'لە ئەنجامدا', 'لە دەرئەنجامدا'] },
    'make sense': { kurdish: 'مانای هەیە', context: 'Logical/clear', alternatives: ['لۆژیکییە', 'جێی باوەڕە', 'تێگەیشتنی ئاسانە'] },
    'does not make sense': { kurdish: 'هیچ مانایەکی نییە', context: 'Nonsense', alternatives: ['جێی تێگەیشتن نییە', 'بێ مانایە'] },
    "doesn't make sense": { kurdish: 'هیچ مانایەکی نییە', context: 'Nonsense', alternatives: ['جێی تێگەیشتن نییە', 'بێ مانایە'] },
    'never mind': { kurdish: 'کێشە نییە، لەبیری کە', context: 'Don\'t worry / ignore', alternatives: ['گرنگ نییە', 'بێ خەم بە', 'واز لەوە بێنە'] },
    'as a matter of fact': { kurdish: 'لە ڕاستیدا', context: 'In reality', alternatives: ['بە پێچەوانەوە، لە واقیعدا', 'لە حەقیقەتدا'] },
    'in fact': { kurdish: 'لە ڕاستیدا', context: 'Actually', alternatives: ['بە ڕاستی', 'لە واقیعدا'] },
    'by the way': { kurdish: 'لەم نێوەندەدا / بە بۆنەیەوە', context: 'Incidentally', alternatives: ['بە ڕێکەوت', 'لێرەدا شتێک بڵێم'] },
    'on the other hand': { kurdish: 'لە لایەکی ترەوە', context: 'Conversely', alternatives: ['بە پێچەوانەوە', 'لە ڕوانگەیەکی ترەوە'] },
    'sooner or later': { kurdish: 'زوو بێت یان درەنگ', context: 'Inevitably', alternatives: ['ڕۆژێک لە ڕۆژان', 'لە کۆتاییدا هەر ڕوودەدات'] },
    'take it easy': { kurdish: 'ئارام بە، خەمت نەبێت', context: 'Relax / calm down', alternatives: ['هێمن بەوە', 'ئاسان وەریگرە'] },
    'hang in there': { kurdish: 'خۆڕاگر بە', context: 'Stay strong', alternatives: ['بەردەوام بە و کۆڵ مەدە', 'ئارام بگرە'] },
    'pull yourself together': { kurdish: 'خۆت کۆبکەرەوە', context: 'Control emotions', alternatives: ['ئاگات لە خۆت بێت', 'هێمن بەرەوە'] },
    'call it a day': { kurdish: 'با کۆتایی پێ بهێنین', context: 'Finish work for today', alternatives: ['بۆ ئەمڕۆ بەسە', 'کارەکان کۆتایی پێبهێنین'] },
    'no big deal': { kurdish: 'شتێکی ئەوتۆ نییە', context: 'Not important', alternatives: ['کێشەیەکی گەورە نییە', 'گرنگ نییە'] },
    'fair enough': { kurdish: 'قسەیەکی بەجێیە', context: 'Acceptable point', alternatives: ['قبووڵکراوە', 'پێم باشە'] },
    'for what it is worth': { kurdish: 'ئەگەر سودی هەبێت', context: 'If helpful', alternatives: ['بە ڕای من', 'تەنها بۆ زانیاری'] },
    "for what it's worth": { kurdish: 'ئەگەر سودی هەبێت', context: 'If helpful', alternatives: ['بە ڕای من', 'تەنها بۆ زانیاری'] },
    'ring a bell': { kurdish: 'ئاشنا دیارە', context: 'Sounds familiar', alternatives: ['وەبیرم دێتەوە', 'ناسیاوە', 'ناوی ئاشنایە'] },
    'hands down': { kurdish: 'بێگومان', context: 'Undoubtedly', alternatives: ['بە دڵنیاییەوە', 'بێ ڕکابەر', 'بێ چەندوچۆن'] },
    'keep an eye on': { kurdish: 'ئاگاداری بە', context: 'Watch closely', alternatives: ['چاوێکی لێ بێت', 'چاودێری بکە', 'چاو لەسەر دانێ'] },
    'read between the lines': { kurdish: 'لە مەبەستە شاراوەکە تێبگە', context: 'Hidden meaning', alternatives: ['لە نهێنییەکان تێبگە', 'قووڵتر بیربکەرەوە'] },
    'think outside the box': { kurdish: 'جیاواز بیربکەرەوە', context: 'Creative thinking', alternatives: ['داهێنەرانە بیربکەرەوە', 'لە دەرەوەی چوارچێوە بیربکەرەوە'] },
    'cost an arm and a leg': { kurdish: 'زۆر گرانە', context: 'Very expensive', alternatives: ['نرخێکی خەیاڵیی هەیە', 'بە پارەیەکی زۆرە'] },
    'spill the beans': { kurdish: 'نهێنییەکە ئاشکرا بکە', context: 'Reveal secret', alternatives: ['ڕاستییەکان بدرکێنە', 'قسە بکە'] },
    'safe and sound': { kurdish: 'ساغ و سەلامەت', context: 'Unharmed', alternatives: ['بە سەلامەتی', 'بێ زیان'] },
    'in a nutshell': { kurdish: 'بە کورتی', context: 'Briefly', alternatives: ['بە کورت و پوختی', 'پوختەکەی'] },
    'from scratch': { kurdish: 'لە سەرەتاوە', context: 'From beginning', alternatives: ['لە بنەڕەتەوە', 'لە سفرەوە'] },
    'by all means': { kurdish: 'بێگومان', context: 'Certainly', alternatives: ['بە دڵنیاییەوە', 'بە هەموو شێوەیەک'] },
    'point of view': { kurdish: 'دیدگا', context: 'Perspective', alternatives: ['بۆچوون', 'ڕوانگە', 'تێڕوانین'] },
    'day in and day out': { kurdish: 'ڕۆژ لە دوای ڕۆژ', context: 'Continuously', alternatives: ['بە بەردەوامی', 'هەموو ڕۆژێک'] },
    'time will tell': { kurdish: 'کات هەموو شتێک دەردەخات', context: 'Future will reveal', alternatives: ['ڕۆژگار دەیسەلمێنێت', 'پاشان دەردەکەوێت'] },
    'figure out': { kurdish: 'تێبگە', context: 'Understand/solve', alternatives: ['چارەسەر بدۆزەرەوە', 'پێی بزانیت', 'سەری لێ دەربکەیت'] },
    'come up with': { kurdish: 'بدۆزەرەوە', context: 'Propose/create', alternatives: ['پێشنیار بکە', 'بەرهەم بهێنە'] },
    'call off': { kurdish: 'هەڵوەشاندنەوە', context: 'Cancel', alternatives: ['ڕاگرتن', 'بەتاڵکردنەوە'] },
    'put off': { kurdish: 'دواخستن', context: 'Postpone', alternatives: ['وەپاشخستن', 'پاشخستن'] },
    'look forward to': { kurdish: 'بەپەرۆشەوە چاوەڕێم', context: 'Eagerly anticipate', alternatives: ['بە تامەزرۆییەوە چاوەڕوانی دەکەم', 'چاوەڕوانم'] },
    'bear in mind': { kurdish: 'لەبیرت بێت', context: 'Remember', alternatives: ['لەبەرچاوی بگرە', 'لە یادتبێت'] },
    'take for granted': { kurdish: 'بە ئاسایی وەریگرە', context: 'Underestimate', alternatives: ['قەدری نەزانیت', 'بە کەم سەیریکردن'] },
    'cross the line': { kurdish: 'سنوور بەزاندن', context: 'Go too far', alternatives: ['لە سنوور دەرچوون', 'پێشێلکردن'] },
    'get out of hand': { kurdish: 'لە کۆنتڕۆڵ دەرچوون', context: 'Out of control', alternatives: ['لە دەست دەربچێت', 'ئاڵۆز بوون'] },
    'get rid of': { kurdish: 'ڕزگاربوون لێی', context: 'Eliminate', alternatives: ['خۆ دەربازکردن', 'لە کۆڵکردنەوە', 'فڕێدان'] },
    'hit the road': { kurdish: 'کەوتنە ڕێ', context: 'Depart', alternatives: ['بەڕێکەوتن', 'دەست بە گەشتکردن'] },
    'under the weather': { kurdish: 'تەندروستیم باش نییە', context: 'Feeling unwell', alternatives: ['کەمێک ناڕەحەتم', 'هەست بە نەخۆشی دەکەم'] },
    'bite the bullet': { kurdish: 'بەرگەی بگرە', context: 'Endure difficulty', alternatives: ['سەبر بگرە', 'قبووڵی بکە'] },
    'call it a day': { kurdish: 'بۆ ئەمڕۆ بەسە', context: 'Finish working', alternatives: ['کۆتایی پێبهێنە', 'دەست هەڵگرە'] },
    'face the music': { kurdish: 'ڕووبەڕووی لێکەوتەکان ببەرەوە', context: 'Accept consequences', alternatives: ['باجەکەی بدە', 'ئەنجامەکەی قبووڵ بکە'] },
    'once in a blue moon': { kurdish: 'زۆر بە دەگمەن', context: 'Very rarely', alternatives: ['هەر لە کەونارا جارێک', 'جاروبارێکی کەم'] },
    'see eye to eye': { kurdish: 'هاوڕابوون', context: 'Agree fully', alternatives: ['ڕێککەوتن', 'یەکهەڵوێست بوون'] },
    'speak of the devil': { kurdish: 'ناوی هات و خۆی هات', context: 'Speaking of person', alternatives: ['هەر باسی تۆمان دەکرد'] },
    'burn the midnight oil': { kurdish: 'شەونخوونی کردن', context: 'Work late', alternatives: ['تا درەنگ کارکردن'] },
    'cut corners': { kurdish: 'کەمکردنەوەی کوالیتی', context: 'Rush work cheaply', alternatives: ['ڕێگەی کورت گرتنەبەر'] },
    'on the fence': { kurdish: 'دوودڵ', context: 'Undecided', alternatives: ['بڕیارنەدراو', 'لە نێوان دوو بڕیاردا'] },
    'pull someone leg': { kurdish: 'گاڵتەکردن لەگەڵ کەسێک', context: 'Tease someone', alternatives: ['ڕابواردن', 'فریودانی بە گاڵتە'] },
    "pull someone's leg": { kurdish: 'گاڵتەکردن لەگەڵ کەسێک', context: 'Tease someone', alternatives: ['ڕابواردن', 'فریودانی بە گاڵتە'] },
    'the elephant in the room': { kurdish: 'بابەتە گرنگە پشتگوێخراوەکە', context: 'Obvious problem', alternatives: ['کێشە سەرەکییە نەبینراوەکە'] },
    'through thick and thin': { kurdish: 'لە خۆشی و لە ناخۆشیدا', context: 'In all circumstances', alternatives: ['لە هەموو بارودۆخێکدا'] },
    'actions speak louder than words': { kurdish: 'کردار لە قسە بەهێزترە', context: 'Action over words', alternatives: ['کردار شەرتە نەک قسە'] },
    'better safe than sorry': { kurdish: 'خۆپاراستن لە پەشیمانی باشترە', context: 'Caution is best', alternatives: ['وریا بە'] },
    'easier said than done': { kurdish: 'قسەکردن لە کردار ئاسانترە', context: 'Hard to do', alternatives: ['کرداری قورسە'] },
    'every cloud has a silver lining': { kurdish: 'لە هەموو ناخۆشییەکدا خێرێک هەیە', context: 'Silver lining', alternatives: ['هیوایەک هەیە'] },
    'leave no stone unturned': { kurdish: 'هەموو هەوڵێک بدە', context: 'Search everywhere', alternatives: ['هەموو شوێنێک بگەڕێ'] },
    'look before you leap': { kurdish: 'پێش هەنگاونان بیربکەرەوە', context: 'Think before acting', alternatives: ['بە ژیری مامەڵە بکە'] },
    'no pain no gain': { kurdish: 'بێ ڕەنج کێشان بەرهەم نابێت', context: 'Effort brings results', alternatives: ['هەوڵدان پێویستە'] },
    'practice makes perfect': { kurdish: 'ڕاهێنان دەبێتە هۆی لێهاتوویی', context: 'Practice makes skill', alternatives: ['بە مەشق دەگەیتە ئامانج'] },
    'the early bird catches the worm': { kurdish: 'سەحەرخێز بەختەوەرە', context: 'Early starter wins', alternatives: ['زوو دەستپێکردن سەرکەوتنە'] },
    'time is money': { kurdish: 'کات زێڕە', context: 'Time is valuable', alternatives: ['کات بەنرخە'] },
    'back to square one': { kurdish: 'گەڕانەوە بۆ خاڵی سەرەتا', context: 'Start over', alternatives: ['دەستپێکردنەوە لە سەرەتاوە'] },
    'burn bridges': { kurdish: 'پردەکانی پەیوەندی بپچڕێنە', context: 'Cut all ties', alternatives: ['ڕێگەی گەڕانەوە مەهێڵەرەوە'] },
    'drive someone crazy': { kurdish: 'کەسێک شێت کردن', context: 'Infuriate', alternatives: ['لە هۆش خۆ بردن', 'بێزارکردنی توند'] },
    'curiosity killed the cat': { kurdish: 'زۆرزانی زیانی هەیە', context: 'Excess curiosity', alternatives: ['لە هەموو شت مەکۆڵەرەوە'] },
    'ubiquitous': { kurdish: 'لە هەموو شوێنێک بەربڵاو', context: 'Everywhere', alternatives: ['گشتگیر', 'هەمەلایەنە'] },
    'ephemeral': { kurdish: 'تەمەن کورت و کاتی', context: 'Short-lived', alternatives: ['زووگوزەر', 'نەبڕاوە'] },
    'resilience': { kurdish: 'خۆڕاگری', context: 'Toughness', alternatives: ['پشوودرێژی', 'توانای بەردەوامی'] },
    'paradigm shift': { kurdish: 'گۆڕانکاری بنەڕەتی', context: 'Fundamental change', alternatives: ['وەرچەرخانی مێژوویی', 'سەرلەنوێ داڕشتنەوە'] },
    'meticulous': { kurdish: 'زۆر بە دیقەت و وردبین', context: 'Detailed/careful', alternatives: ['وردکار', 'بە سەلیقە'] },
    'quintessential': { kurdish: 'نموونەی باڵا', context: 'Perfect example', alternatives: ['پوختەی سەرەکی', 'بەرجەستەکەری تەواو'] },
    'serendipity': { kurdish: 'ڕێکەوتی بەختەوەرانە', context: 'Lucky discovery', alternatives: ['دەستکەوتی چاوەڕواننەکراو', 'بەختی چاک'] },
    'inevitable': { kurdish: 'حەتمی و چاوەڕوانکراو', context: 'Unavoidable', alternatives: ['خۆلێلادان مەحاڵ', 'ڕوودانی مسۆگەرە'] },
    'ambiguous': { kurdish: 'ناڕوون و دوومانادار', context: 'Unclear', alternatives: ['تەمومژاوی', 'لێڵ'] },
    'eloquent': { kurdish: 'ڕەوانبێژ و زمانپاراو', context: 'Well-spoken', alternatives: ['قسەزان', 'شیرین زمان'] },
    'profound': { kurdish: 'قووڵ و پڕواتا', context: 'Deep meaning', alternatives: ['کاریگەر', 'بنەڕەتی'] },
    'lucid': { kurdish: 'ڕوون و ئاشکرا', context: 'Clear/bright', alternatives: ['ڕۆشن', 'هۆشیار'] },
    'pragmatic': { kurdish: 'واقیعبین و کردارەکی', context: 'Realistic/practical', alternatives: ['سوودخواز', 'پراکتیکی'] },
    'superfluous': { kurdish: 'زیادە و ناپێویست', context: 'Unnecessary', alternatives: ['بێسوود', 'پێویست پێی نەکراو'] },
  };

  /** Preprocess source text to improve translation accuracy for English to Kurdish Sorani. */
  function preprocessSource(text, srcLang, tgtLang) {
    if (tgtLang !== 'ckb' || (srcLang !== 'en' && srcLang !== 'auto')) return text;
    let s = text;

    // Handle subtitle dialogue multi-speaker hyphens on a single line:
    // e.g. "- Hello! - How are you?" -> "- Hello!\n- How are you?"
    s = s.replace(/(?:^|\n)\s*[-—–]\s*([^\n]+?)\s+[-—–]\s*([^\n]+)/g, '- $1\n- $2');

    // Expand gerund colloquialisms in subtitle dialogues (e.g., lookin' -> looking, runnin' -> running, doin' -> doing)
    s = s.replace(/\b([a-zA-Z]{2,})in['’](?=\s|[.,!?;:'"()[\]{}<>]|$)/gi, '$1ing');

    // Expand informal contractions and spoken dialogue slang into natural English phrases for accurate translation
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
         .replace(/\alot\b/gi, 'a lot')
         .replace(/\binfront\b/gi, 'in front')
         .replace(/\basap\b/gi, 'as soon as possible')
         .replace(/\bfyi\b/gi, 'for your information')
         .replace(/\bbtw\b/gi, 'by the way')
         .replace(/\btbh\b/gi, 'to be honest')
         .replace(/\bimo\b/gi, 'in my opinion')
         .replace(/\bimho\b/gi, 'in my humble opinion')
         .replace(/\baka\b/gi, 'also known as')
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
      .replace(/([\p{L}\u0600-\u06FF]+)\s+تر(?=\s|$|[.,!?;:،؛؟])/gu, '$1تر')
      .replace(/([\p{L}\u0600-\u06FF]+)\s+ترین(?=\s|$|[.,!?;:،؛؟])/gu, '$1ترین')
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
      .replace(/خۆشحاڵم بتبینم/g, 'خۆشحاڵم بە بینینت')
      .replace(/بێ گومان/g, 'بێگومان')
      .replace(/لە کوێ/g, 'لەکوێ')
      .replace(/بۆ چی/g, 'بۆچی')
      .replace(/لە بەر/g, 'لەبەر')
      .replace(/لە گەڵ/g, 'لەگەڵ')
      .replace(/بە تایبەت/g, 'بەتایبەت')
      .replace(/بە ڕاستی/g, 'بەڕاستی')
      .replace(/لە ڕاستیدا/g, 'لەڕاستیدا')
      .replace(/بێ ئەوەی/g, 'بێئەوەی')
      .replace(/لەبەر ئەوەی/g, 'لەبەرئەوەی')
      .replace(/لێ ببوورە/g, 'لێببوورە')
      .replace(/لێ ببوورن/g, 'لێببوورن')
      .replace(/سەر کەوتن/g, 'سەرکەوتن')
      .replace(/سەر دەکەوێت/g, 'سەردەکەوێت')
      .replace(/تێک دان/g, 'تێکدان')
      .replace(/تێک دەدات/g, 'تێکدەدات')
      .replace(/پێک هاتن/g, 'پێکهاتن')
      .replace(/پێک دەهێنێت/g, 'پێکهێنێت')
      .replace(/بە جێ هێشتن/g, 'بەجێهێشتن')
      .replace(/دەست پێ کردن/g, 'دەستپێکردن')
      .replace(/دەست پێ دەکات/g, 'دەستپێدەکات')
      .replace(/چاودێری کردن/g, 'چاودێریکردن')
      .replace(/یارمەتی دان/g, 'یارمەتیدان')
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
   * Postprocess a Kurdish subtitle string:
   * - Normalizes Sorani punctuation & typography (comma, question mark, semicolon).
   * - Replaces raw Arabic letters with Kurdish Sorani equivalents (ك/ي/ة -> ک/ی/ە).
   * - Naturalizes conversational syntax and fixes compound word spacing.
   * - Optionally applies Kurdish digits and character name glossary replacements.
   */
  function postprocessSorani(text, options = {}) {
    if (text == null) return '';
    const str = typeof text === 'string' ? text : String(text);
    if (!str.trim()) return '';
    let res = normalizeText(str, true, !!options.kurdishDigits);
    res = naturalizeDialogue(res);
    return res;
  }

  /**
   * Check for advanced English phrases in source text and return alternative translations.
   */
  function getAdvancedAlternatives(englishText) {
    if (!englishText) return [];
    const lower = englishText.toLowerCase();
    const found = [];
    for (const [expr, data] of Object.entries(ADVANCED_SUBTITLE_LEXICON)) {
      if (lower.includes(expr)) {
        found.push({
          expression: expr,
          kurdish: data.kurdish,
          primary: data.kurdish,
          context: data.context || expr,
          alternatives: data.alternatives || [],
        });
      }
    }
    return found;
  }

  /**
   * Perform line-for-line quality check and Kurdish validation on a subtitle line.
   * Returns a detailed score, detected linguistic or formatting issues, suggestions,
   * detailed issue objects, alternative wordings, and the auto-improved text.
   *
   * @param {string} arg1 The Kurdish translated line (or original line)
   * @param {string} [arg2] The original source line (or Kurdish line)
   * @returns {{score: number, issues: string[], suggestions: string[], issueDetails: Array, alternatives: Array, improvedText: string}}
   */
  function checkLineQuality(arg1, arg2 = '') {
    let kurdishLine = typeof arg1 === 'string' ? arg1 : (arg1 != null ? String(arg1) : '');
    let origLine = typeof arg2 === 'string' ? arg2 : (arg2 != null ? String(arg2) : '');

    // Auto-detect argument order if reversed
    const hasArabic1 = /[\u0600-\u06ff]/.test(kurdishLine);
    const hasArabic2 = /[\u0600-\u06ff]/.test(origLine);
    if (!hasArabic1 && hasArabic2) {
      const tmp = kurdishLine;
      kurdishLine = origLine;
      origLine = tmp;
    }

    const text = (kurdishLine || '').trim();
    if (!text) {
      return { score: 100, issues: [], suggestions: [], issueDetails: [], alternatives: [], improvedText: '' };
    }

    const issues = [];
    const suggestions = [];
    const issueDetails = [];
    let penalties = 0;

    // 1. Check for untranslated Latin / English words
    const latinWords = text.match(/\b[a-zA-Z]{3,}\b/g);
    if (latinWords && !text.includes('{\\')) {
      const filtered = latinWords.filter((w) => !/^(WEBVTT|NOTE|STYLE|ASS|SSA|pos|an\d|fs|fn)$/i.test(w));
      if (filtered.length > 0) {
        const msg = `وشەی وەرنەگێڕدراو یان ئینگلیزی: "${filtered.slice(0, 3).join(', ')}"`;
        issues.push(msg);
        suggestions.push('وشە ئینگلیزییەکان وەربگێڕە بۆ کوردی');
        issueDetails.push({
          id: 'untranslated_words',
          category: 'untranslated',
          severity: 'error',
          title: 'وشەی ئینگلیزی وەرنەگێڕدراو',
          description: msg,
          fixAvailable: false,
        });
        penalties += Math.min(30, filtered.length * 15);
      }
    }

    // 2. Check for Arabic letter relics (Kaf ك, Yaa ي, Teh Marbuta ة, Tatweel ـ)
    const arabicRelics = [];
    if (/[\u0643]/.test(text)) arabicRelics.push('ك');
    if (/[\u064A\u0649]/.test(text)) arabicRelics.push('ي/ى');
    if (/[\u0629]/.test(text)) arabicRelics.push('ة');
    if (/[\u0640]/.test(text)) arabicRelics.push('ـ');

    if (arabicRelics.length > 0) {
      const msg = `پیتە عەرەبییەکان لە جێگەی پیتی کوردی بەکارهاتوون (${arabicRelics.join('، ')})`;
      issues.push(msg);
      suggestions.push('پیتەکان بگۆڕە بۆ (ک، ی، ە)');
      issueDetails.push({
        id: 'arabic_relics',
        category: 'orthography',
        severity: 'warning',
        title: 'پیت و نیشانەی نادروستی عەرەبی',
        description: msg,
        fixAvailable: true,
      });
      penalties += arabicRelics.length * 8;
    }

    // 3. Check for mechanical question starter "ئایا"
    if (/(?:^|[\s\n])ئایا\s+/.test(text)) {
      const msg = 'دەستپێکی ڕستە بە "ئایا" لە ژێرنووسی کوردیدا نەگونجاو و ڕۆبۆتییە';
      issues.push(msg);
      suggestions.push('پیت یان وشەی "ئایا" لاببە بۆ ئەوەی ڕستەکە سروشتی و ڕەوان بێت');
      issueDetails.push({
        id: 'mechanical_aya',
        category: 'dialogue',
        severity: 'warning',
        title: 'دەستپێکی نادروستی "ئایا"',
        description: msg,
        fixAvailable: true,
      });
      penalties += 8;
    }

    // 4. Check for split verbal prefixes (e.g. "دە کات", "نا زانم", "نە بوو", "مە ڕۆ", "تێ دەگەم")
    if (/(?:^|\s)(?:دە|ئە|نا|نە|مە|بی|تێ|ڕێ|پێ|وەر|دەر|دا|هەڵ|دەست)\s+(?:بێت|زانم|زانی|کات|کەم|کەن|چێت|چم|چن|ڵێم|ڵێت|توانم|بوو|کرد|کە|ڕۆ|دەگەم|کەوتن|دان|گرتن)/.test(text)) {
      const msg = 'پێشگرە لێکدراوەکانی کردار لێکجیاکراونەتەوە (وەک: دە کات، نا زانم)';
      issues.push(msg);
      suggestions.push('پێشگرەکە بلکێنە بە کردارەکەوە (دەستکاریکردن بۆ: دەکات، نازانم)');
      issueDetails.push({
        id: 'split_verbal_affix',
        category: 'prefix',
        severity: 'warning',
        title: 'لێکجیابوونەوەی پێشگری کردار',
        description: msg,
        fixAvailable: true,
      });
      penalties += 10;
    }

    // 5. Check punctuation marks
    if (/[?;,]/.test(text) && !text.includes('{\\')) {
      const msg = 'هێماکانی خاڵبەندی بە شێوازی لاتینی ماونەتەوە (?, ;, ,)';
      issues.push(msg);
      suggestions.push('خاڵبەندی کوردی بەکاربهێنە (؟، ؛، ،)');
      issueDetails.push({
        id: 'latin_punctuation',
        category: 'punctuation',
        severity: 'info',
        title: 'خاڵبەندی لاتینی لە دەقی کوردی',
        description: msg,
        fixAvailable: true,
      });
      penalties += 5;
    }

    // 6. Check dual-speaker dialogue formatting
    if (origLine && (origLine.includes('\n-') || origLine.startsWith('- ') || origLine.includes(' - '))) {
      if (!text.includes('-')) {
        const msg = 'هێمای دیالۆگی دوو کەس (-) لە ژێرنووسەکەدا نییە';
        issues.push(msg);
        suggestions.push('هێمای - لە سەرەتای هەر دێڕێکی دیالۆگ دابنێ');
        issueDetails.push({
          id: 'dialogue_hyphen_missing',
          category: 'dialogue',
          severity: 'info',
          title: 'دیالۆگی چەندکەسی',
          description: msg,
          fixAvailable: true,
        });
        penalties += 8;
      }
    }

    // 7. Check for bracket token residue
    if (/\[\s*(?:T|W|p)\d*\s*\]|\b[TWp]\d+\b|[\u0001\u0002\u0003§]/.test(text)) {
      const msg = 'کۆدی کاتی پاشماوەی وەرگێڕان یان نیشانەی کاتی ماوەتەوە';
      issues.push(msg);
      suggestions.push('کۆدەکان پاکبکەرەوە');
      issueDetails.push({
        id: 'token_residue',
        category: 'token',
        severity: 'error',
        title: 'پاشماوەی کۆدی تەکنیکی',
        description: msg,
        fixAvailable: true,
      });
      penalties += 20;
    }

    // 8. Line length / subtitle readability warning (> 42 characters on a single line)
    const lines = text.split('\n');
    const tooLongLine = lines.find((l) => l.length > 42);
    if (tooLongLine) {
      const msg = `درێژی دێڕ زۆرە (${tooLongLine.length} پیت) و خوێندنەوەی لەسەر شاشە گران دەکات`;
      issues.push(msg);
      suggestions.push('دێڕەکە بەسەر دوو دێڕدا دابەش بکە');
      issueDetails.push({
        id: 'line_length',
        category: 'timing',
        severity: 'info',
        title: 'درێژیی دێڕی ژێرنووس',
        description: msg,
        fixAvailable: false,
      });
      penalties += 5;
    }

    // Alternatives check from Advanced Lexicon
    const alternatives = getAdvancedAlternatives(origLine);

    // Compute improved text
    let improved = normalizeSoraniAlphabet(text);
    improved = rejoinVerbalAffixes(improved);
    improved = naturalizeDialogue(improved);
    improved = normalizeText(improved, true, false);
    improved = fixPlacementAndTagOrder(improved, origLine);

    const score = Math.max(15, Math.min(100, 100 - penalties));

    return {
      score,
      issues,
      suggestions,
      issueDetails,
      alternatives,
      improvedText: improved,
    };
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
            results[o.index] = norm;
            if (norm && norm !== origNorm[o.index]) anyTranslated = true;
          } catch (e) {
            if (e && e.hard) sawHardFail = true;
            failedLines++;
            let norm = normalizeText(restoreNewlines(restore(o.text, o.toks)), isArabic, useKurdishDigits);
            norm = fixPlacementAndTagOrder(norm, o.raw);
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
      await fetch(`${ENDPOINTS[0]}?${params.toString()}`, { method: 'GET', headers: { 'Accept': 'application/json' } });
    } catch {}
  }

  return {
    translateLines,
    warmup,
    normalizeText,
    normalizeDigits,
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
