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
  function restore(s, toks) {
    if (!toks || !toks.length) return s;
    return s.replace(/(?:\[|\()\s*(?:T|t|ت|تی|تاک)\s*[-_]?\s*([\d\u0660-\u0669\u06f0-\u06f9]+)\s*(?:\]|\))|\b(?:T|t|ت|تی|تاک)\s*[-_]?\s*([\d\u0660-\u0669\u06f0-\u06f9]+)\b/gi, (_, n1, n2) => {
      const numStr = n1 || n2;
      const ascii = numStr.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
                          .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
      const id = parseInt(ascii, 10);
      return toks[id] !== undefined ? toks[id] : '';
    });
  }

  // Arabic-script targets (Sorani Kurdish, Farsi, Arabic, Urdu, Pashto)
  const ARABIC_SCRIPT = new Set(['ckb', 'fa', 'ar', 'ur', 'ps']);

  /** Preprocess source text to improve translation accuracy for English to Kurdish Sorani. */
  function preprocessSource(text, srcLang, tgtLang) {
    if (tgtLang !== 'ckb' || (srcLang !== 'en' && srcLang !== 'auto')) return text;
    let s = text;

    // Expand informal contractions and colloquial slang
    s = s.replace(/\bgonna\b/gi, 'going to')
         .replace(/\bwanna\b/gi, 'want to')
         .replace(/\bgotta\b/gi, 'have to')
         .replace(/\bkinda\b/gi, 'kind of')
         .replace(/\bsorta\b/gi, 'sort of')
         .replace(/\bdunno\b/gi, 'do not know')
         .replace(/\bimma\b/gi, 'I am going to')
         .replace(/\bain'?t\b/gi, 'is not')
         .replace(/\bwhatcha\b/gi, 'what are you')
         .replace(/\bgotcha\b/gi, 'I understand')
         .replace(/\bgimme\b/gi, 'give me')
         .replace(/\blemme\b/gi, 'let me')
         .replace(/\boutta\b/gi, 'out of')
         .replace(/\by'?all\b/gi, 'you all')
         .replace(/\b'cause\b/gi, 'because')
         .replace(/\bcuz\b/gi, 'because');

    // Subtitle idioms and common film dialogue expressions
    s = s.replace(/\bhold on a sec(ond)?\b/gi, 'wait a moment')
         .replace(/\bhang on a sec(ond)?\b/gi, 'wait a moment')
         .replace(/\bgive me a sec(ond)?\b/gi, 'wait a moment')
         .replace(/\bhold on\b/gi, 'wait')
         .replace(/\bhang on\b/gi, 'wait')
         .replace(/\bwhat'?s up\b/gi, 'how are you')
         .replace(/\bwhat is up\b/gi, 'how are you')
         .replace(/\bwhat'?s wrong\b/gi, 'what is the problem')
         .replace(/\bwhat is wrong\b/gi, 'what is the problem')
         .replace(/\bwhat'?s going on\b/gi, 'what is happening')
         .replace(/\bnever mind\b/gi, 'it is not important')
         .replace(/\bcut it out\b/gi, 'stop it')
         .replace(/\bpiece of cake\b/gi, 'very easy')
         .replace(/\bmy bad\b/gi, 'my mistake')
         .replace(/\bno big deal\b/gi, 'not important')
         .replace(/\bchill out\b/gi, 'calm down')
         .replace(/\btake your time\b/gi, 'do not rush')
         .replace(/\bshut up\b/gi, 'be quiet')
         .replace(/\byou'?re welcome\b/gi, 'you are welcome')
         .replace(/\bcheck it out\b/gi, 'look at this')
         .replace(/\bcheck this out\b/gi, 'look at this')
         .replace(/\bno way\b/gi, 'it is impossible')
         .replace(/\bcome on\b/gi, 'come on')
         .replace(/\bc'mon\b/gi, 'come on')
         .replace(/\bdon'?t worry\b/gi, 'do not worry')
         .replace(/\bare you kidding\b/gi, 'are you joking')
         .replace(/\bare you serious\b/gi, 'are you serious')
         .replace(/\boh my god\b/gi, 'oh god')
         .replace(/\boh my goodness\b/gi, 'oh god')
         .replace(/\bmy god\b/gi, 'oh god')
         .replace(/\bby the way\b/gi, 'incidentally')
         .replace(/\bfor real\b/gi, 'really')
         .replace(/\bmake sure\b/gi, 'ensure')
         .replace(/\bcalm down\b/gi, 'be calm')
         .replace(/\bhurry up\b/gi, 'hurry up')
         .replace(/\blook out\b/gi, 'be careful')
         .replace(/\bwatch out\b/gi, 'be careful')
         .replace(/\bwatch your back\b/gi, 'be careful')
         .replace(/\bkeep an eye on\b/gi, 'watch carefully')
         .replace(/\bstep aside\b/gi, 'move aside')
         .replace(/\bhands up\b/gi, 'raise your hands')
         .replace(/\bget down\b/gi, 'duck down')
         .replace(/\bgood job\b/gi, 'well done')
         .replace(/\bway to go\b/gi, 'well done')
         .replace(/\byou bet\b/gi, 'of course')
         .replace(/\bfair enough\b/gi, 'acceptable')
         .replace(/\bfor God'?s sake\b/gi, 'please')
         .replace(/\bGod damn it\b/gi, 'damn it')
         .replace(/\bI got this\b/gi, 'I can do this')
         .replace(/\byou got this\b/gi, 'you can do this')
         .replace(/\bhang in there\b/gi, 'stay strong')
         .replace(/\blook after\b/gi, 'take care of')
         .replace(/\bfreak out\b/gi, 'panic')
         .replace(/\bgive up\b/gi, 'surrender')
         .replace(/\bmake sense\b/gi, 'is logical')
         .replace(/\bright now\b/gi, 'immediately')
         .replace(/\bas soon as possible\b/gi, 'quickly')
         .replace(/\basap\b/gi, 'quickly')
         .replace(/\bno problem\b/gi, 'no problem')
         .replace(/\bno sweat\b/gi, 'no problem')
         .replace(/\bdon'?t mention it\b/gi, 'you are welcome')
         .replace(/\bI don'?t care\b/gi, 'it is not important to me')
         .replace(/\bwho cares\b/gi, 'who cares')
         .replace(/\bso what\b/gi, 'what does it matter')
         .replace(/\bare you out of your mind\b/gi, 'are you crazy')
         .replace(/\bare you nuts\b/gi, 'are you crazy')
         .replace(/\bare you insane\b/gi, 'are you crazy')
         .replace(/\bcut to the chase\b/gi, 'get to the point')
         .replace(/\bbreak a leg\b/gi, 'good luck')
         .replace(/\bout of nowhere\b/gi, 'suddenly')
         .replace(/\ball of a sudden\b/gi, 'suddenly')
         .replace(/\blet me know\b/gi, 'inform me')
         .replace(/\bI have no idea\b/gi, 'I do not know')
         .replace(/\bno clue\b/gi, 'I do not know')
         .replace(/\bit'?s up to you\b/gi, 'it is your decision')
         .replace(/\btrust me\b/gi, 'trust me')
         .replace(/\bcount on me\b/gi, 'trust me');
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

    // Convert Arabic Heh 'ه' to Kurdish Small E 'ە' at word endings where appropriate
    s = s.replace(/([\u0600-\u06ff])ه(?=\s|$|[.,!?;:،؛؟])/g, (m, p) =>
      (p !== 'ئ' && p !== 'ا' && p !== 'و' && p !== 'ۆ' ? p + 'ە' : m)
    );

    // Sorani Kurdish Heavy R (ڕ) conversions for words starting with R or standard roots
    s = s.replace(/(^|\s)رویشت(ن|م|ی|ین|ن|ووە)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕۆیشت$2')
         .replace(/(^|\s)رۆیشت(ن|م|ی|ین|ن|ووە)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕۆیشت$2')
         .replace(/(^|\s)رۆشت(ن|م|ی|ین|ن|ووە)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕۆیشت$2')
         .replace(/(^|\s)رۆ(م|یت|ات|ین|ن)(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕۆ$2')
         .replace(/(^|\s)راست(ە|ی|ەقینە|ەوخۆ|ەکان|کردنەوە)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕاست$2')
         .replace(/(^|\s)رێگ(ە|ا|ای|اکە|ایەک|ەی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕێگ$2')
         .replace(/(^|\s)رۆژ(انە|گار|باش|نامە|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕۆژ$2')
         .replace(/(^|\s)رەنگ(ە|ی|اوڕەنگ)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕەنگ$2')
         .replace(/(^|\s)رێز(لێنان|م|ت|تان)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕێز$2')
         .replace(/(^|\s)روون(کردنەوە|اک|اکی|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕوون$2')
         .replace(/(^|\s)رەش(ی|بین)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕەش$2')
         .replace(/(^|\s)روو(داو|دات|دەدات|ی|خسار|خاو|بەڕوو)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕوو$2')
         .replace(/(^|\s)راپۆرت(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕاپۆرت')
         .replace(/(^|\s)راگەیاندن(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕاگەیاندن')
         .replace(/(^|\s)رێنمایی(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕێنمایی')
         .replace(/(^|\s)رێژە(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕێژە')
         .replace(/(^|\s)رزگار(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕزگار')
         .replace(/(^|\s)رازی(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕازی')
         .replace(/(^|\s)رێبوار(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕێبوار')
         .replace(/(^|\s)رابردوو(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕابردوو')
         .replace(/(^|\s)رێپێدان(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕێپێدان')
         .replace(/(^|\s)رەوانە(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕەوانە')
         .replace(/(^|\s)رەوشت(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕەوشت')
         .replace(/(^|\s)رەخنە(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕەخنە')
         .replace(/(^|\s)روانین(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕوانین')
         .replace(/(^|\s)راهێنان(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕاهێنان')
         .replace(/(^|\s)راکردن(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕاکردن')
         .replace(/(^|\s)راگرتن(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕاگرتن')
         .replace(/(^|\s)رێکخستن(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕێکخستن');

    // Sorani Kurdish Velarized L (ڵ) corrections
    s = s.replace(/(^|\s)مال(ی|ەوە|مان|تان|یان|ەکەم|ەکان)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ماڵ$2')
         .replace(/(^|\s)بەلێ(م)?(?=\s|$|[.,!?;:،؛؟])/g, '$1بەڵێ$2')
         .replace(/(^|\s)دەلێ(ت|م|ن|یت|ین)(?=\s|$|[.,!?;:،؛؟])/g, '$1دەڵێ$2')
         .replace(/(^|\s)بلێ(ن|م|یت)?(?=\s|$|[.,!?;:،؛؟])/g, '$1بڵێ$2')
         .replace(/(^|\s)گول(م|ەکان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1گوڵ$2')
         .replace(/(^|\s)سال(ان|ی|ە|انە)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ساڵ$2')
         .replace(/خۆشحال(ی|ییە| بووم)?/g, 'خۆشحاڵ$1')
         .replace(/(^|\s)مندال(ان|ەکە|م|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1منداڵ$2')
         .replace(/(^|\s)سلاو(تان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1سڵاو$2')
         .replace(/(^|\s)گەلا(کان)?(?=\s|$|[.,!?;:،؛؟])/g, '$1گەڵا$2')
         .replace(/(^|\s)کەلەک(ەم)?(?=\s|$|[.,!?;:،؛؟])/g, '$1کەڵەک$2')
         .replace(/(^|\s)چۆل(ە|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1چۆڵ$2')
         .replace(/(^|\s)تەلە(ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1تەڵە$2')
         .replace(/(^|\s)خال(ی|م)?(?=\s|$|[.,!?;:،؛؟])/g, '$1خاڵ$2')
         .replace(/(^|\s)تال(ە|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1تاڵ$2')
         .replace(/(^|\s)پیالە(ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1پیاڵە$2')
         .replace(/(^|\s)دل(م|ت|ی|خۆش|تەنگ|نیام|نیابە|نیا)?(?=\s|$|[.,!?;:،؛؟])/g, '$1دڵ$2')
         .replace(/(^|\s)پۆلا(?=\s|$|[.,!?;:،؛؟])/g, '$1پۆڵا')
         .replace(/(^|\s)قولپ(?=\s|$|[.,!?;:،؛؟])/g, '$1قوڵپ')
         .replace(/(^|\s)کەلەشێر(?=\s|$|[.,!?;:،؛؟])/g, '$1کەڵەشێر')
         .replace(/(^|\s)کەلک(?=\s|$|[.,!?;:،؛؟])/g, '$1کەڵک')
         .replace(/(^|\s)بالا(?=\s|$|[.,!?;:،؛؟])/g, '$1باڵا')
         .replace(/(^|\s)قەلا(?=\s|$|[.,!?;:،؛؟])/g, '$1قەڵا')
         .replace(/(^|\s)چەپلە(?=\s|$|[.,!?;:،؛؟])/g, '$1چەپڵە')
         .replace(/(^|\s)کۆمەل(?=\s|$|[.,!?;:،؛؟])/g, '$1کۆمەڵ')
         .replace(/(^|\s)ئالۆز(?=\s|$|[.,!?;:،؛؟])/g, '$1ئاڵۆز')
         .replace(/(^|\s)هەلە(?=\s|$|[.,!?;:،؛؟])/g, '$1هەڵە')
         .replace(/گۆرانکاری/g, 'گۆڕانکاری')
         .replace(/سپاس/g, 'سوپاس');

    return s;
  }

  /** Rejoin split Sorani Kurdish verbal affixes & compound preverbs. */
  function rejoinVerbalAffixes(str) {
    return str
      .replace(/(^|\s)دە\s+(بێت|زانم|زانی|زانێت|زانین|زانن|کات|کەم|کەیت|کەین|کەن|توانی|توانم|توانێت|توانین|توانن|چێت|ڕۆم|رۆم|ڕۆیت|رۆیت|ڕوات|روات|ڕۆین|رۆین|ڕۆن|رۆن|ڵێت|ڵێم|ڵێیت|ڵێین|ڵێن|هێنێت|هێنم|یەوێت|خوات|خۆم|کراو|بینم|بینێت|بینین|بینن|وەستێت|گەڕێتەوە|نووسێت|دات|دەین|دەکان|بەن|بەین|دێت|دەبێتەوە|فرۆشێت|کڕێت|ژیم|ژیت|ژی|ژیین|ژین|مرێت|بیستێت|گرێت|بەستێت|گەین|کەویت)(?=\s|$|[.,!?;:،؛؟])/g, '$1دە$2')
      .replace(/(^|\s)نا\s+(زانم|زانی|زانێت|زانین|زانن|کات|کەم|کەیت|کەن|بێت|کرێت|کرێن|توانی|توانم|توانێت|توانین|توانن|چێت|ڵێم|ڵێت|گەڕێتەوە|بینم|بینێت|وێت|خۆم|خوات|دات|دەین|کەوم|ڕوات|روات)(?=\s|$|[.,!?;:،؛؟])/g, '$1نا$2')
      .replace(/(^|\s)نە\s+(بێت|کات|کرێت|بوو|ڕۆیشت|رویشت|هات|زانی|توانی|دیت|کرد|چوو|گەیی|دەبوو|بینرا|خورا)(?=\s|$|[.,!?;:،؛؟])/g, '$1نە$2')
      .replace(/(^|\s)مە\s+(کە|ڕۆ|رۆ|کەیت|بۆوە|چۆ|بڕۆ|برۆ|گەڕێ|بە|کەن|ترسە|گری|شکێنە|کوژە)(?=\s|$|[.,!?;:،؛؟])/g, '$1مە$2')
      .replace(/(^|\s)بی\s+(کە|بە|بینە|گەیەنە|خۆ|نووسە|هێنە|بەخشە|پارێزە|کوژە)(?=\s|$|[.,!?;:،؛؟])/g, '$1بی$2')
      .replace(/(^|\s)تێ\s+(دەگەم|بگە|دەگەیت|دەگەن|دەگەین|پەڕی|پەڕین|ناگەم)(?=\s|$|[.,!?;:،؛؟])/g, '$1تێ$2')
      .replace(/(^|\s)ڕێ\s+(گرتن|دەگرێت|بگرە|ناگرێت|بگرن)(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕێ$2')
      .replace(/(^|\s)پێ\s+(دان|دەدات|بڵێ|بڵێن|بدە|نادەم|نادات)(?=\s|$|[.,!?;:،؛؟])/g, '$1پێ$2')
      .replace(/(^|\s)وەر\s+(بگرە|گرتن|دەگرێت|ناگرێت|مەگرە)(?=\s|$|[.,!?;:،؛؟])/g, '$1وەر$2')
      .replace(/(^|\s)دەر\s+(کەوت|کەوتن|چوون|چوونی|بێنە|هێنانی|دەچێت|دەخات)(?=\s|$|[.,!?;:،؛؟])/g, '$1دەر$2')
      .replace(/(^|\s)دا\s+(نیشە|دەنیشێت|پۆشە|خستن|داخە|دابخە|گرتن|بەزین)(?=\s|$|[.,!?;:،؛؟])/g, '$1دا$2')
      .replace(/(^|\s)[هھ]ەڵ\s+(بگرە|ستە|دەستێت|گرتن|گرە|بژێرە|بڕژێ|کشان)(?=\s|$|[.,!?;:،؛؟])/g, '$1هەڵ$2')
      .replace(/(^|\s)دەست\s+(پێکرد|پێبکە|پێدەکات|پێکردن|پێ بگە)(?=\s|$|[.,!?;:،؛؟])/g, '$1دەست$2')
      .replace(/\s+ەوە(?=\s|$|[.,!?;:،؛؟])/g, 'ەوە')
      .replace(/\s+یش(?=\s|$|[.,!?;:،؛؟])/g, 'یش');
  }

  /** Naturalize machine-translated subtitle dialogue for fluent Sorani Kurdish. */
  function naturalizeDialogue(str) {
    return str
      .replace(/^بەخێر\s+بێیت\.?$/gm, 'شایەنی نییە')
      .replace(/^بەخێر\s+بێن\.?$/gm, 'شایەنی نییە')
      .replace(/(^|\s|،|؛)ئایا\s+/g, '$1')
      .replace(/(^|\s)من\s+دەزانم(?=\s|$|[.,!?;:،؛؟])/g, '$1دەزانم')
      .replace(/(^|\s)من\s+نازانم(?=\s|$|[.,!?;:،؛؟])/g, '$1نازانم')
      .replace(/(^|\s)من\s+دەتوانم(?=\s|$|[.,!?;:،؛؟])/g, '$1دەتوانم')
      .replace(/(^|\s)من\s+ناتوانم(?=\s|$|[.,!?;:،؛؟])/g, '$1ناتوانم')
      .replace(/(^|\s)من\s+دەبینم(?=\s|$|[.,!?;:،؛؟])/g, '$1تێدەگەم')
      .replace(/(^|\s)من\s+دەمەوێت(?=\s|$|[.,!?;:،؛؟])/g, '$1دەمەوێت')
      .replace(/(^|\s)من\s+نامەوێت(?=\s|$|[.,!?;:،؛؟])/g, '$1نامەوێت')
      .replace(/(^|\s)من\s+دێم(?=\s|$|[.,!?;:،؛؟])/g, '$1دێم')
      .replace(/(^|\s)من\s+دەچم(?=\s|$|[.,!?;:،؛؟])/g, '$1دەچم')
      .replace(/(^|\s)ئەو\s+دەزانێت(?=\s|$|[.,!?;:،؛؟])/g, '$1دەزانێت')
      .replace(/(^|\s)ئەوان\s+دەزانن(?=\s|$|[.,!?;:،؛؟])/g, '$1دەزانن')
      .replace(/(^|\s)ئێمە\s+دەزانین(?=\s|$|[.,!?;:،؛؟])/g, '$1دەزانین')
      .replace(/ئۆ خوای من/g, 'ئەی خوایە')
      .replace(/خوای من/g, 'ئەی خوایە')
      .replace(/سەیر بکە،/g, 'سەیرکە،')
      .replace(/من زۆر سوپاستان دەکەم/g, 'زۆر سوپاس')
      .replace(/هیچ کێشەیەک نییە/g, 'کێشە نییە')
      .replace(/بە دڵنیاییەوە/g, 'بێگومان')
      .replace(/تۆ چۆنیت/g, 'چۆنیت')
      .replace(/تۆ لە کوێیت/g, 'لەکوێیت')
      .replace(/کێشەیەک نییە/g, 'ئاساییە')
      .replace(/سوپاس بۆ تۆ/g, 'سوپاس')
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

      // Kurdish Punctuation
      t = t.replace(/,/g, '،')
           .replace(/;/g, '؛')
           .replace(/\?/g, '؟');
    }

    return t;
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
          const norm = normalizeText(restoreNewlines(restore(part, batch[k].toks).trim()), isArabic, useKurdishDigits);
          results[batch[k].index] = norm;
          if (norm && norm !== origNorm[batch[k].index]) anyTranslated = true;
        });
      } catch (err) {
        if (signal && signal.aborted) throw err;
        // Batch failed — fall back to one request per line.
        for (const o of batch) {
          throwIfAborted(signal);
          try {
            const norm = normalizeText(restoreNewlines(restore(await translateChunk(o.text, srcLang, tgtLang, signal), o.toks).trim()), isArabic, useKurdishDigits);
            results[o.index] = norm;
            if (norm && norm !== origNorm[o.index]) anyTranslated = true;
          } catch (e) {
            if (e && e.hard) sawHardFail = true;
            failedLines++;
            results[o.index] = normalizeText(restoreNewlines(restore(o.text, o.toks)), isArabic, useKurdishDigits);
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
          const norm = normalizeText(restoreNewlines(restore(t, p.toks).trim()), isArabic, useKurdishDigits);
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
   * @returns {Array<Array<{index:number,text:string}>>}
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
      current.push({ index, text: prep, toks: c.toks });
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

  return { translateLines, warmup, normalizeText, normalizeDigits, preprocessSource };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Translator;
