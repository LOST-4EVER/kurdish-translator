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

    // Expand British and international English colloquialisms, slang, and dialectal forms into clean expressions
    s = s.replace(/\bbloody\s+hell\b/gi, 'oh goodness')
         .replace(/\bbloody\b/gi, 'damn')
         .replace(/\bbollocks\b/gi, 'nonsense')
         .replace(/\bbugger\s+off\b/gi, 'go away')
         .replace(/\bbugger\b/gi, 'damn')
         .replace(/\bblimey\b/gi, 'my goodness')
         .replace(/\bchuffed\b/gi, 'delighted')
         .replace(/\bgutted\b/gi, 'devastated')
         .replace(/\bdodgy\b/gi, 'suspicious')
         .replace(/\bknackered\b/gi, 'exhausted')
         .replace(/\bcheerio\b/gi, 'goodbye')
         .replace(/\btaking\s+the\s+piss\b/gi, 'making fun')
         .replace(/\bpiss\s+off\b/gi, 'go away')
         .replace(/\bpissed\s+off\b/gi, 'angry')
         .replace(/\binnit\b/gi, 'is it not')
         .replace(/\bquid\b/gi, 'pounds')
         .replace(/\bbloke\b|\bchap\b/gi, 'man')
         .replace(/\blads?\b/gi, (m) => m.toLowerCase().endsWith('s') ? 'boys' : 'boy')
         .replace(/\blasses?\b/gi, (m) => m.toLowerCase().endsWith('s') ? 'girls' : 'girl')
         .replace(/\bcheers\s+mate\b/gi, 'thank you friend')
         .replace(/\bcheers\b/gi, 'thank you')
         .replace(/\bnot\s+my\s+cup\s+of\s+tea\b/gi, 'not something I like')
         .replace(/\bbob['’]?s\s+your\s+uncle\b/gi, 'it is easily done')
         .replace(/\bgive\s+(?:me|us)\s+a\s+bell\b/gi, 'call me')
         .replace(/\bhave\s+a\s+word\b/gi, 'speak briefly')
         .replace(/\bfull\s+of\s+beans\b/gi, 'full of energy')
         .replace(/\bspanner\s+in\s+the\s+works\b/gi, 'unexpected problem')
         .replace(/\ba\s+right\s+mess\b/gi, 'a complete disaster')
         .replace(/\ball\s+to\s+cock\b/gi, 'completely ruined')
         .replace(/\bchuffed\s+to\s+bits\b/gi, 'extremely happy');

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
         .replace(/\balot\b/gi, 'a lot')
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
         .replace(/\bmake\s+yourself\s+at\s+home\b/gi, 'feel comfortable')
         .replace(/\bmind\s+your\s+own\s+business\b/gi, 'do not interfere')
         .replace(/\bon\s+my\s+way\b/gi, 'coming now')
         .replace(/\bgive\s+me\s+a\s+hand\b/gi, 'help me')
         .replace(/\bget\s+out\s+of\s+here\b/gi, 'leave right now')
          .replace(/\bget\s+the\s+hell\s+out\s+(?:of\s+here)?\b/gi, 'leave immediately')
          .replace(/\bget\s+the\s+fuck\s+out\s+(?:of\s+here)?\b/gi, 'leave immediately')
          .replace(/\bsuit\s+yourself\b/gi, 'do as you please')
          .replace(/\bit\s+can['’]?t\s+be\s+helped\b|\bthere['’]?s\s+no\s+helping\s+it\b/gi, 'it cannot be avoided')
          .replace(/\bleave\s+it\s+to\s+me\b/gi, 'leave this to me')
          .replace(/\bdon['’]?t\s+get\s+cocky\b/gi, 'do not be arrogant')
          .replace(/\bdon['’]?t\s+underestimate\s+me\b/gi, 'do not underestimate me')
          .replace(/\bshow\s+me\s+what\s+you(?:['’]?ve)?\s+got\b/gi, 'show me your ability')
          .replace(/\bgive\s+it\s+your\s+all\b/gi, 'try with all your strength')
          .replace(/\b(?:i['’]?ve\s+)?got\s+your\s+back\b/gi, 'I will support you')
          .replace(/\bnot\s+on\s+my\s+watch\b/gi, 'never while I am here')
          .replace(/\bi\s+won['’]?t\s+let\s+you\s+down\b/gi, 'I will not disappoint you')
          .replace(/\bdon['’]?t\s+let\s+me\s+down\b/gi, 'do not disappoint me')
          .replace(/\bi['’]?ll\s+protect\s+you\b/gi, 'I will protect you')
          .replace(/\bwhat\s+a\s+(?:pain|drag)\b/gi, 'how annoying')
          .replace(/\bi\s+(?:have|got)\s+no\s+choice\b/gi, 'I have no other choice')
          .replace(/\bit['’]?s\s+about\s+time\b/gi, 'finally it is time')
          .replace(/\bstand\s+back\b|\bstep\s+back\b/gi, 'step backwards')
          .replace(/\bdon['’]?t\s+be\s+ridiculous\b/gi, 'do not be silly')
          .replace(/\bjust\s+in\s+time\b/gi, 'right on time')
          .replace(/\bit['’]?s\s+not\s+over\s+yet\b/gi, 'it is not finished yet')
          .replace(/\bhold\s+your\s+horses\b/gi, 'wait patiently')
          .replace(/\bmark\s+my\s+words\b/gi, 'remember my words')
          .replace(/\bdon['’]?t\s+get\s+me\s+wrong\b/gi, 'do not misunderstand me')
          .replace(/\bit['’]?s\s+not\s+worth\s+it\b/gi, 'it is not worth it')
          .replace(/\bsave\s+your\s+breath\b/gi, 'save your words')
          .replace(/\bno\s+hard\s+feelings\b/gi, 'do not be upset')
          .replace(/\bspill\s+the\s+beans\b/gi, 'reveal the truth')
          .replace(/\bbreak\s+a\s+leg\b/gi, 'good luck')
          .replace(/\bpiece\s+of\s+cake\b/gi, 'very easy')
          .replace(/\bbite\s+the\s+bullet\b/gi, 'endure the hardship')
          .replace(/\bunder\s+the\s+weather\b/gi, 'feeling unwell')
          .replace(/\bout\s+of\s+my\s+way\b/gi, 'move out of my way')
          .replace(/\bface\s+to\s+face\b/gi, 'directly face to face');

    // Handle character speech interruptions, cut-offs (e.g. "bu-", "wh-", "I-") and stutters (e.g. "b-but", "w-wait")
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
    if (!str) return '';
    let s = str.replace(/\u0643/g, 'ک')   // Arabic Kaf 'ك' -> Kurdish Keheh 'ک'
               .replace(/\u064A/g, 'ی')   // Arabic Yaa 'ي' -> Kurdish Yeh 'ی'
               .replace(/\u0649/g, 'ی')   // Arabic Alef Maksura 'ى' -> 'ی'
               .replace(/\u0629/g, 'ە')   // Arabic Teh Marbuta 'ة' -> Kurdish Small E 'ە'
               .replace(/[\u06BE\u06C1]/g, 'ه'); // Urdu/Arabic Heh variants -> 'ه'

    // Convert Arabic Heh 'ه' to Kurdish Small E 'ە' at word endings where appropriate (after consonants/non-vowels)
    s = s.replace(/([\u0600-\u06ff])ه(?=\s|$|[.,!?;:،؛؟])/g, (m, p) =>
      (p !== 'ئ' && p !== 'ا' && p !== 'و' && p !== 'ۆ' && p !== 'ە' && p !== 'ێ' && p !== 'ڕ' ? p + 'ە' : m)
    );

    // Fundamental Kurdish Sorani rule: All word-initial R letters are trilled Heavy R (ڕ)
    s = s.replace(/(^|[\s،؛؟.\n(«"'\[{<])ر(?=[\u0600-\u06ff])/gu, '$1ڕ');

    // Specific Kurdish words starting with / containing Heavy R (ڕ)
    s = s.replace(/(^|\s)رویشت(ن|م|ی|ین|ن|ووە)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕۆیشت$2')
         .replace(/(^|\s)رۆیشت(ن|م|ی|ین|ن|ووە)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕۆیشت$2')
         .replace(/(^|\s)رۆشت(ن|م|ی|ین|ن|ووە)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕۆیشت$2')
         .replace(/(^|\s)رۆ(م|یت|ات|ین|ن)(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕۆ$2')
         .replace(/(^|\s)راست(ە|ی|ەقینە|ەوخۆ|ەکان|کردنەوە|ییەکەی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕاست$2')
         .replace(/(^|\s)رێگ(ە|ا|ای|اکە|ایەک|ەی|اکان)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕێگ$2')
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
         .replace(/(^|\s)مەرۆ(ن)?(?=\s|$|[.,!?;:،؛؟])/g, '$1مەڕۆ$2')
         .replace(/(^|\s)دەرۆ(م|یت|ات|ین|ن)?(?=\s|$|[.,!?;:،؛؟])/g, '$1دەڕۆ$2')
         .replace(/(^|\s)دەروات(?=\s|$|[.,!?;:،؛؟])/g, '$1دەڕوات')
         .replace(/(^|\s)نەروات(?=\s|$|[.,!?;:،؛؟])/g, '$1نەڕوات')
         .replace(/(^|\s)نەرۆ(م|یت|ات|ین|ن)?(?=\s|$|[.,!?;:،؛؟])/g, '$1نەڕۆ$2')
         .replace(/(^|\s)کوری(?=\s|$|[.,!?;:،؛؟])/g, '$1کوڕی')
         .replace(/(^|\s)کور(?=\s|$|[.,!?;:،؛؟])/g, '$1کوڕ')
         .replace(/(^|\s)بریار(دان|ەکان|ی|م|ت)?(?=\s|$|[.,!?;:،؛؟])/g, '$1بڕیار$2')
         .replace(/(^|\s)بروانە(?=\s|$|[.,!?;:،؛؟])/g, '$1بڕوانە')
         .replace(/(^|\s)بروام(?=\s|$|[.,!?;:،؛؟])/g, '$1بڕوام')
         .replace(/(^|\s)بروابکە(?=\s|$|[.,!?;:،؛؟])/g, '$1بڕوابکە')
         .replace(/(^|\s)بروا(?=\s|$|[.,!?;:،؛؟])/g, '$1بڕوا')
         .replace(/(^|\s)بروانامە(کان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1بڕوانامە$2')
         .replace(/(^|\s)زور(?=\s|$|[.,!?;:،؛؟])/g, '$1زۆر')
         .replace(/گۆرانکاری/g, 'گۆڕانکاری')
         .replace(/سپاس/g, 'سوپاس');

    // Sorani Kurdish Velarized L (ڵ) corrections
    s = s.replace(/(^|\s)مال(ی|ەوە|مان|تان|یان|ەکەم|ەکان)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ماڵ$2')
         .replace(/(^|\s)بەلێ(م)?(?=\s|$|[.,!?;:،؛؟])/g, '$1بەڵێ$2')
         .replace(/(^|\s)دەلێ(ت|م|ن|یت|ین)(?=\s|$|[.,!?;:،؛؟])/g, '$1دەڵێ$2')
         .replace(/(^|\s)بلێ(ن|م|یت|ین)?(?=\s|$|[.,!?;:،؛؟])/g, '$1بڵێ$2')
         .replace(/(^|\s)گول(م|ەکان|ی|زار)?(?=\s|$|[.,!?;:،؛؟])/g, '$1گوڵ$2')
         .replace(/(^|\s)سال(ان|ی|ە|انە|ێک|ەکان)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ساڵ$2')
         .replace(/خۆشحال(ی|ییە| بووم|م)?/g, 'خۆشحاڵ$1')
         .replace(/(^|\s)مندال(ان|ەکە|م|ی|بوون|ەکان)?(?=\s|$|[.,!?;:،؛؟])/g, '$1منداڵ$2')
         .replace(/(^|\s)سلاو(تان|ی|ت)?(?=\s|$|[.,!?;:،؛؟])/g, '$1سڵاو$2')
         .replace(/(^|\s)گەلا(کان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1گەڵا$2')
         .replace(/(^|\s)کەلەک(ەم|ی|ە)?(?=\s|$|[.,!?;:،؛؟])/g, '$1کەڵەک$2')
         .replace(/(^|\s)چۆل(ە|ی|کردن|ەوانی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1چۆڵ$2')
         .replace(/(^|\s)تەلە(ی|کان|کە)?(?=\s|$|[.,!?;:،؛؟])/g, '$1تەڵە$2')
         .replace(/(^|\s)خال(ی|م|ەکان|ۆ)?(?=\s|$|[.,!?;:،؛؟])/g, '$1خاڵ$2')
         .replace(/(^|\s)تال(ە|ی|تر|ەکان)?(?=\s|$|[.,!?;:،؛؟])/g, '$1تاڵ$2')
         .replace(/(^|\s)پیالە(ی|یک|کان)?(?=\s|$|[.,!?;:،؛؟])/g, '$1پیاڵە$2')
         .replace(/(^|\s)دل(م|ت|ی|خۆش|تەنگ|نیام|نیابە|نیا|سۆز|پاک|داری)?(?=\s|$|[.,!?;:،؛؟])/g, '$1دڵ$2')
         .replace(/(^|\s)پۆلا(?=\s|$|[.,!?;:،؛؟])/g, '$1پۆڵا')
         .replace(/(^|\s)قولپ(?=\s|$|[.,!?;:،؛؟])/g, '$1قوڵپ')
         .replace(/(^|\s)کەلەشێر(?=\s|$|[.,!?;:،؛؟])/g, '$1کەڵەشێر')
         .replace(/(^|\s)کەلک(?=\s|$|[.,!?;:،؛؟])/g, '$1کەڵک')
         .replace(/(^|\s)کەلەپوور(?=\s|$|[.,!?;:،؛؟])/g, '$1کەڵەپوور')
         .replace(/(^|\s)خەلوز(?=\s|$|[.,!?;:،؛؟])/g, '$1خەڵووز')
         .replace(/(^|\s)چەپەل(?=\s|$|[.,!?;:،؛؟])/g, '$1چەپەڵ')
         .replace(/(^|\s)بالا(بەرز)?(?=\s|$|[.,!?;:،؛؟])/g, '$1باڵا$2')
         .replace(/(^|\s)قەلا(کان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1قەڵا$2')
         .replace(/(^|\s)چەپلە(?=\s|$|[.,!?;:،؛؟])/g, '$1چەپڵە')
         .replace(/(^|\s)کۆمەل(گا|ایەتی|ەکان|ی|ە)?(?=\s|$|[.,!?;:،؛؟])/g, '$1کۆمەڵ$2')
         .replace(/(^|\s)ئالۆز(ی|تر)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ئاڵۆز$2')
         .replace(/(^|\s)هەلە(کان|ی|یە)?(?=\s|$|[.,!?;:،؛؟])/g, '$1هەڵە$2')
         .replace(/(^|\s)تێکەل(کردن|او)?(?=\s|$|[.,!?;:،؛؟])/g, '$1تێکەڵ$2')
         .replace(/(^|\s)گەلالە(?=\s|$|[.,!?;:،؛؟])/g, '$1گەڵاڵە')
         .replace(/(^|\s)کۆلان(ەکان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1کۆڵان$2')
         .replace(/(^|\s)قوول(ی|تر|ایی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1قووڵ$2')
         .replace(/(^|\s)قول(ی|تر|ایی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1قووڵ$2')
         .replace(/(^|\s)بالندە(کان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1باڵندە$2')
         .replace(/(^|\s)ئالا(کان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1ئاڵا$2')
         .replace(/(^|\s)خەلک(ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1خەڵک$2')
         .replace(/(^|\s)خەلات(کردن|ەکان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1خەڵات$2')
         .replace(/(^|\s)بەلگە(نامە|کان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1بەڵگە$2')
         .replace(/(^|\s)بەلێن(دان|ەکان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1بەڵێن$2')
         .replace(/(^|\s)شەپۆل(ەکان|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1شەپۆڵ$2')
         .replace(/(^|\s)خۆل(ەمێش|ی)?(?=\s|$|[.,!?;:،؛؟])/g, '$1خۆڵ$2')
         .replace(/(^|\s)قەلەم(?=\s|$|[.,!?;:،؛؟])/g, '$1قەڵەم')
         .replace(/(^|\s)کەلەگا(?=\s|$|[.,!?;:،؛؟])/g, '$1کەڵەگا')
         .replace(/(^|\s)تۆپەل(?=\s|$|[.,!?;:،؛؟])/g, '$1تۆپەڵ')
         .replace(/(^|\s)چقل(?=\s|$|[.,!?;:،؛؟])/g, '$1چقڵ')
         .replace(/(^|\s)هەلبژاردن(?=\s|$|[.,!?;:،؛؟])/g, '$1هەڵبژاردن')
         .replace(/(^|\s)هەلسان(?=\s|$|[.,!?;:،؛؟])/g, '$1هەڵسان')
         .replace(/(^|\s)هەلگرتن(?=\s|$|[.,!?;:،؛؟])/g, '$1هەڵگرتن')
         .replace(/(^|\s)هەلهاتن(?=\s|$|[.,!?;:،؛؟])/g, '$1هەڵهاتن')
         .replace(/(^|\s)هەلمەت(?=\s|$|[.,!?;:،؛؟])/g, '$1هەڵمەت')
         .replace(/(^|\s)هەلوێست(?=\s|$|[.,!?;:،؛؟])/g, '$1هەڵوێست')
         .replace(/(^|\s)هەلکەوتوو(?=\s|$|[.,!?;:،؛؟])/g, '$1هەڵکەوتوو')
         .replace(/(^|\s)هەلچوون(?=\s|$|[.,!?;:،؛؟])/g, '$1هەڵچوون')
         .replace(/(^|\s)هەلسەنگاندن(?=\s|$|[.,!?;:،؛؟])/g, '$1هەڵسەنگاندن')
         .replace(/(^|\s)هەلوەشاندنەوە(?=\s|$|[.,!?;:،؛؟])/g, '$1هەڵوەشاندنەوە');

    return s;
  }

  /** Rejoin split Sorani Kurdish verbal affixes & compound preverbs. */
  function rejoinVerbalAffixes(str) {
    if (!str) return '';
    return str
      .replace(/(^|\s)دە\s+(بێت|بم|بیت|بین|بن|زانم|زانی|زانێت|زانین|زانن|کات|کەم|کەیت|کەین|کەن|توانی|توانم|توانێت|توانین|توانن|چێت|چم|چیت|چین|چن|ڕۆم|رۆم|ڕۆیت|رۆیت|ڕوات|روات|ڕۆین|رۆین|ڕۆن|رۆن|ڵێت|ڵێم|ڵێیت|ڵێین|ڵێن|هێنێت|هێنم|هێنیت|هێنین|هێنن|یەوێت|خوات|خۆم|خۆین|خۆن|کراو|بینم|بینێت|بینین|بینن|وەستێت|گەڕێتەوە|نووسێت|نووسم|نووسین|دات|دەین|دەکان|بەن|بەین|دێت|دەبێتەوە|فرۆشێت|کڕێت|ژیم|ژیت|ژی|ژیین|ژین|مرێت|بیستێت|گرێت|بەستێت|گەین|کەویت|بارێت|گۆڕێت|بەخشێت|شارێتەوە|ڕژێت|نێرێت|ناسێت|کوژێت|پارێزێت|سووتێت|تەقێت|ترسێت|فڕێت|پشکنێت|ڕوانێت)(?=\s|$|[.,!?;:،؛؟])/g, '$1دە$2')
      .replace(/(^|\s)ئە\s+(بێت|بم|بیت|بین|بن|زانم|زانی|زانێت|کات|کەم|کەیت|کەین|چێت|چم|چیت|چین|ڕۆم|ڕۆیت|ڕوات|ڕۆین|ڵێت|ڵێم|هێنێت|هێنم|یەوێت|خوات|خۆم|بینم|بینێت|دات|دێت)(?=\s|$|[.,!?;:،؛؟])/g, '$1ئە$2')
      .replace(/(^|\s)نا\s+(زانم|زانی|زانێت|زانین|زانن|کات|کەم|کەیت|کەن|ناکەین|بێت|بم|بیت|بین|بن|کرێت|کرێن|توانی|توانم|توانێت|توانین|توانن|چێت|چم|چیت|چین|چن|ڵێم|ڵێت|ڵێن|گەڕێتەوە|بینم|بینێت|وێت|نامەوێت|ناوێت|خۆم|خوات|دات|نادەم|دەین|کەوم|کەوێت|ڕوات|روات|مرێت|بیستم|بیستێت|ڕۆم|ڕۆیت|ڕۆین|ڕۆن|نووسم|فرۆشم|کڕم|گەم|گۆڕێت|ناسم|کوژم|پارێزم)(?=\s|$|[.,!?;:،؛؟])/g, '$1نا$2')
      .replace(/(^|\s)نە\s+(بێت|کات|کرێت|بوو|بووم|بوویت|بووین|بوون|ڕۆیشت|رویشت|هات|هاتم|هاتیت|هاتین|هاتن|زانی|زانیم|زانیت|توانی|دیت|کرد|کردم|کردت|کردمان|چوو|چووم|چوویت|چووین|چوون|گەیی|گەیشت|دەبوو|بینرا|خورا|کوژرا|شکێنرا|خوێندەوە|فرۆشت|ناسرا|دۆزرایەوە)(?=\s|$|[.,!?;:،؛؟])/g, '$1نە$2')
      .replace(/(^|\s)مە\s+(کە|ڕۆ|رۆ|کەیت|بۆوە|چۆ|چن|بڕۆ|برۆ|گەڕێ|بە|بن|کەن|ترسە|ترسن|گری|گرین|شکێنە|کوژە|خۆ|خۆن|دە|دەن|هێنە|نووسە|گرە|بڕە|خوێنەوە|بەخشە|شارەوە|دەستنیشانکە)(?=\s|$|[.,!?;:،؛؟])/g, '$1مە$2')
      .replace(/(^|\s)بی\s+(کە|بە|بینە|گەیەنە|خۆ|نووسە|هێنە|بەخشە|پارێزە|کوژە|دە|خوێنەوە|شکێنە|دۆزەرەوە|پشکنە|گرە)(?=\s|$|[.,!?;:،؛؟])/g, '$1بی$2')
      .replace(/(^|\s)تێ\s+(دەگەم|بگە|دەگەیت|دەگەن|دەگەین|پەڕی|پەڕین|ناگەم|پەڕیوە|گەیشتم|گەیشتین)(?=\s|$|[.,!?;:،؛؟])/g, '$1تێ$2')
      .replace(/(^|\s)ڕێ\s+(گرتن|دەگرێت|بگرە|ناگرێت|بگرن|کەوتن|کەوتین|کەوتنەوە|کەوتووە)(?=\s|$|[.,!?;:،؛؟])/g, '$1ڕێ$2')
      .replace(/(^|\s)پێ\s+(دان|دەدات|دەڵێت|دەبەخشێت|بڵێ|بڵێن|بدە|نادەم|نادات|بەخشی|مبڵێ|یبڵێ|مانبڵێ|یانبڵێ|موایە|مباشە|مخۆشە|تانخۆشە)(?=\s|$|[.,!?;:،؛؟])/g, '$1پێ$2')
      .replace(/(^|\s)وەر\s+(بگرە|گرتن|دەگرێت|ناگرێت|مەگرە|گیرا|گیراوە)(?=\s|$|[.,!?;:،؛؟])/g, '$1وەر$2')
      .replace(/(^|\s)دەر\s+(کەوت|کەوتن|چوون|چوونی|بێنە|هێنانی|دەچێت|دەخات|دەکەوێت|کەوتووە|هێنان)(?=\s|$|[.,!?;:،؛؟])/g, '$1دەر$2')
      .replace(/(^|\s)دا\s+(نیشە|دەنیشێت|پۆشە|خستن|داخە|دابخە|گرتن|بەزین|بەزی|مەپۆشە|نان)(?=\s|$|[.,!?;:،؛؟])/g, '$1دا$2')
      .replace(/(^|\s)[هھ]ەڵ\s+(بگرە|ستە|دەستێت|گرتن|گرە|بژێرە|بڕژێ|کشان|واسە|مەگرە|سان|دڕین|سوڕان|قووڵین|مژین)(?=\s|$|[.,!?;:،؛؟])/g, '$1هەڵ$2')
      .replace(/(^|\s)دەست\s+(پێکرد|پێبکە|پێدەکات|پێکردن|پێ بگە|بەردار|نیشان|پێکە)(?=\s|$|[.,!?;:،؛؟])/g, '$1دەست$2')
      .replace(/(^|\s)لێ\s+(پرسینەوە|کردنەوە|گەڕێ|دەگەڕێت|بدە|دایت|ستاندن|بوردن|دەبورێت)(?=\s|$|[.,!?;:،؛؟])/g, '$1لێ$2')
      .replace(/([\p{L}\u0600-\u06FF]+)\s+تر(?=\s|$|[.,!?;:،؛؟])/gu, '$1تر')
      .replace(/([\p{L}\u0600-\u06FF]+)\s+ترین(?=\s|$|[.,!?;:،؛؟])/gu, '$1ترین')
      .replace(/([\p{L}\u0600-\u06FF]+)\s+ەوە(?=\s|$|[.,!?;:،؛؟])/gu, '$1ەوە')
      .replace(/([\p{L}\u0600-\u06FF]+)\s+یش(?=\s|$|[.,!?;:،؛؟])/gu, '$1یش')
      .replace(/([\p{L}\u0600-\u06FF]+)\s+(مان|تان|یان|ەکەم|ەکەت|ەکەی|ەکەمان|ەکەتان|ەکەیان|ەکان)(?=\s|$|[.,!?;:،؛؟])/gu, '$1$2');
  }

  /** Naturalize machine-translated subtitle dialogue for fluent Sorani Kurdish. */
  function naturalizeDialogue(str) {
    if (!str) return '';
    let res = str
      // Remove mechanical, non-dialogue question particle "ئایا" at start of sentences
      .replace(/(^|[\s،؛؟.\n])ئایا\s+/g, '$1')
      .replace(/ئۆ خوای من/g, 'ئەی خوایە')
      .replace(/خوای من/g, 'ئەی خوایە')
      .replace(/ئەی خوای گەورە/g, 'ئەی خوایە')
      .replace(/ئۆهـ خوای من/g, 'ئەی خوایە')
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
      .replace(/(^|[\s،؛؟.\n])تۆ لە کوێیت(?=\s|$|[.,!?;:،؛؟])/g, '$1لەکوێیت')
      .replace(/(^|[\s،؛؟.\n])لە کوێیت تۆ(?=\s|$|[.,!?;:،؛؟])/g, '$1لەکوێیت')
      .replace(/(^|[\s،؛؟.\n])چۆنیت تۆ(?=\s|$|[.,!?;:،؛؟])/g, '$1چۆنیت')
      .replace(/(^|[\s،؛؟.\n])تۆ چۆنیت(?=\s|$|[.,!?;:،؛؟])/g, '$1چۆنیت')
      .replace(/(^|[\s،؛؟.\n])تۆ کێیت(?=\s|$|[.,!?;:،؛؟])/g, '$1کێیت')
      .replace(/(^|[\s،؛؟.\n])کێیت تۆ(?=\s|$|[.,!?;:،؛؟])/g, '$1کێیت')
      .replace(/بەخێر بێیت/g, 'بەخێربێیت')
      .replace(/بەخێر بێن/g, 'بەخێربێن')
      .replace(/دەستت خۆش بێت/g, 'دەستت خۆش')
      .replace(/خۆشحاڵ بووم بتبینم/g, 'خۆشحاڵ بووم بە بینینت')
      .replace(/ڕۆژ باش/g, 'ڕۆژباش')
      .replace(/شەو باش/g, 'شەوباش')
      .replace(/بەیانی باش/g, 'بەیانیباش')
      .replace(/ماڵ ئاوا/g, 'ماڵئاوا')
      .replace(/سوپاس گوزارم/g, 'سوپاسگوزارم')
      .replace(/لە دەست دان/g, 'لەدەستدان')
      .replace(/لە بیر کردن/g, 'لەبیرکردن')
      .replace(/لە یاد کردن/g, 'لەیادکردن')
      .replace(/لە ناو بردن/g, 'لەناوبردن')
      .replace(/لە خەو هەڵسان/g, 'لەخەوهەڵسان')

      // Drop redundant subjective pronouns in conversational Sorani Kurdish
      .replace(/(^|[\s،؛؟.\n])من نازانم(?=\s|$|[.,!?;:،؛؟])/g, '$1نازانم')
      .replace(/(^|[\s،؛؟.\n])من دەزانم(?=\s|$|[.,!?;:،؛؟])/g, '$1دەزانم')
      .replace(/(^|[\s،؛؟.\n])من دەبێت(?=\s|$|[.,!?;:،؛؟])/g, '$1دەبێت')
      .replace(/(^|[\s،؛؟.\n])من دڵنیام(?=\s|$|[.,!?;:،؛؟])/g, '$1دڵنیام')
      .replace(/(^|[\s،؛؟.\n])من پێم وایە(?=\s|$|[.,!?;:،؛؟])/g, '$1پێم وایە')
      .replace(/(^|[\s،؛؟.\n])من دەمەوێت(?=\s|$|[.,!?;:،؛؟])/g, '$1دەمەوێت')
      .replace(/(^|[\s،؛؟.\n])تۆ دەتوانیت(?=\s|$|[.,!?;:،؛؟])/g, '$1دەتوانیت')
      .replace(/(^|[\s،؛؟.\n])ئێمە دەتوانین(?=\s|$|[.,!?;:،؛؟])/g, '$1دەتوانین')

      // Fix machine-translated word-for-word idioms into fluid Sorani dialogue
      .replace(/ئەوەیە بۆچی/g, 'بۆیە')
      .replace(/ئەوەیە چۆن/g, 'ئاوا')
      .replace(/ئەوەیە کاتێک/g, 'ئەو کاتەی')
      .replace(/ئەوەیە لە کوێ/g, 'لەوێیە کە')
      .replace(/هیچ شتێک نییە/g, 'هیچ نییە')
      .replace(/چاوەڕێ بە/g, 'بۆستە')
      .replace(/هێمن بە/g, 'هێمن ببەوە')
      .replace(/لێ ى/g, 'لێی')
      .replace(/پێ ى/g, 'پێی')
      .replace(/تێ ى/g, 'تێی')
      .replace(/بۆ ى/g, 'بۆیی')
      .replace(/پێ م/g, 'پێم')
      .replace(/لێ م/g, 'لێم')
      .replace(/تێ م/g, 'تێم')
      .replace(/بۆ م/g, 'بۆم')
      .replace(/خۆت لە ماڵەوە بکە/g, 'ماڵی خۆتە')
      .replace(/وەک ماڵی خۆت ڕەفتار بکە/g, 'وەک ماڵی خۆت تەماشای بکە')
      .replace(/وەک ماڵی خۆت سەیر بکە/g, 'وەک ماڵی خۆت تەماشای بکە')
      .replace(/پشوویەکم پێ بدە/g, 'دە لێم گەڕێ')
      .replace(/لەسەر جەستەی مردووم/g, 'تەنها لەسەر تەرمەکەم')
      .replace(/تۆ دەبێت گاڵتەم پێبکەیت/g, 'گاڵتەم لەگەڵ دەکەیت؟')
      .replace(/تۆ دەبێت گاڵتە بکەیت/g, 'گاڵتەم لەگەڵ دەکەیت؟')
      .replace(/هەرگیز لە پێش چاوم ڕوونادات/g, 'تا من لێرەبم مەحاڵە')
      .replace(/لە پێش چاوی مندا نا/g, 'تا من لێرەبم مەحاڵە')
      .replace(/چاوەڕێم بە/g, 'چاوەڕێم بکە')
      .replace(/گوێت لە منە/g, 'گوێت لێمە')
      .replace(/گوێت لە من نییە/g, 'گوێت لێم نییە')
      .replace(/سەرت لە کڵاوی خۆت بێت/g, 'دەست لە کارمەوە مەدە')
      .replace(/تەنها بۆ یەک سات/g, 'تەنها بۆ ساتێک')
      .replace(/لە لایەن/g, 'لەلایەن')
      .replace(/لە کاتێکدا/g, 'لەکاتێکدا')
      .replace(/لە هەمان کاتدا/g, 'لەهەمان کاتدا')
      .replace(/لە شوێنی/g, 'لەشوێنی')
      .replace(/پشت بەستن/g, 'پشتبەستن')
      .replace(/خۆ ڕاگرتن/g, 'خۆڕاگرتن')
      .replace(/خۆ بەدەستەوەدان/g, 'خۆبەدەستەوەدان')
      .replace(/سەر سووڕمان/g, 'سەرسوڕمان')
      .replace(/دەست بەجێ/g, 'دەستبەجێ')
      .replace(/جێ بەجێ/g, 'جێبەجێ')
      .replace(/ڕێ پێ دان/g, 'ڕێپێدان')
      .replace(/تێ پەڕین/g, 'تێپەڕین')
      .replace(/ڕوو بەڕوو/g, 'ڕووبەڕوو')
      .replace(/دوور کەوتنەوە/g, 'دوورکەوتنەوە')
      .replace(/نزیک بوونەوە/g, 'نزیکبوونەوە')
      .replace(/کۆ بوونەوە/g, 'کۆبوونەوە')
      .replace(/بڵاو بوونەوە/g, 'بڵاوبوونەوە')
      .replace(/بەردەوام بوون/g, 'بەردەوامبوون')
      .replace(/سەر لێ شێواو/g, 'سەرلێشێواو')
      .replace(/دڵ تەنگ/g, 'دڵتەنگ')
      .replace(/دڵ خۆش/g, 'دڵخۆش')
      .replace(/چاوەڕوان نەکراو/g, 'چاوەڕواننەکراو')
      .replace(/جێگەی سەرنج/g, 'جێگای سەرنج')
      .replace(/جێگەی شانازی/g, 'جێگای شانازی')
      .replace(/چی ڕوودەدات لێرە/g, 'چی ڕوودەدات لێرە؟')
      .replace(/پەلە مەکە/g, 'هێمن بە')
      .replace(/دەستبەردار بە/g, 'دەستبەرداربە')
      .replace(/دەست بەردار بە/g, 'دەستبەرداربە')
      .replace(/نازانم چی بڵێم/g, 'نازانم چی بڵێم')
      .replace(/بە هیچ جۆرێک/g, 'بەهیچ جۆرێک')
      .replace(/ئاگاداری خۆت بە/g, 'ئاگات لە خۆت بێت')
      .replace(/ئاگاداربە/g, 'ئاگات لە خۆت بێت');

    return res;
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
    if (typeof TranslatorDict !== 'undefined' && TranslatorDict.cleanUntranslatedEnglish) {
      res = TranslatorDict.cleanUntranslatedEnglish(res);
    }
    return res;
  }

  /**
   * Check for advanced English phrases in source text and return alternative translations.
   */
  function getAdvancedAlternatives(englishText) {
    if (!englishText) return [];
    if (typeof TranslatorDict !== 'undefined' && TranslatorDict.findMatches) {
      return TranslatorDict.findMatches(englishText);
    }
    const lower = englishText.toLowerCase();
    const found = [];
    const lex = (typeof TranslatorDict !== 'undefined' && TranslatorDict.LEXICON) ? TranslatorDict.LEXICON : ADVANCED_SUBTITLE_LEXICON;
    for (const [expr, data] of Object.entries(lex)) {
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
    const latinWords = text.match(/\b[a-zA-Z]{2,}\b/g);
    if (latinWords && !text.includes('{\\')) {
      const filtered = latinWords.filter((w) => !/^(WEBVTT|NOTE|STYLE|ASS|SSA|pos|an\d|fs|fn|c|b|i|u|s|k|kf|ko|q|r)$/i.test(w));
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
          fixAvailable: true,
        });
        penalties += Math.min(30, filtered.length * 15);
      }
    }

    // 2. Check for Arabic letter relics (Kaf ك, Yaa ي, Teh Marbuta ة, decorative Tatweel ـ)
    const arabicRelics = [];
    if (/[\u0643]/.test(text)) arabicRelics.push('ك');
    if (/[\u064A\u0649]/.test(text)) arabicRelics.push('ي/ى');
    if (/[\u0629]/.test(text)) arabicRelics.push('ة');
    // Flag Tatweel only if not used as a speech cut-off / stutter connector (e.g. بـ-)
    if (/\u0640(?![-—–])/.test(text)) arabicRelics.push('ـ');

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
    if (typeof TranslatorDict !== 'undefined') {
      if (TranslatorDict.handleSpeechCutoffs) improved = TranslatorDict.handleSpeechCutoffs(improved);
      if (TranslatorDict.cleanUntranslatedEnglish) improved = TranslatorDict.cleanUntranslatedEnglish(improved);
    }
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
   *  - clean up leftover untranslated English words and handle speech cut-offs
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

      // Speech interruptions & English cleanup
      if (typeof TranslatorDict !== 'undefined') {
        if (TranslatorDict.handleSpeechCutoffs) t = TranslatorDict.handleSpeechCutoffs(t);
        if (TranslatorDict.cleanUntranslatedEnglish) t = TranslatorDict.cleanUntranslatedEnglish(t);
      }

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
    const client = 'dict-chrome-ex';
    const params = new URLSearchParams({
      client,
      sl: srcLang,
      tl: tgtLang,
      q: text,
    });
    const scoped = scopedSignal(signal);
    try {
      const res = await fetch(`${host}?${params.toString()}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json, text/plain, */*' },
        signal: scoped.signal,
      });
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
      if (rawText.startsWith('<')) {
        const err = new Error('HTML response received instead of JSON');
        err.status = 429;
        err.wait = backoffMs(attempt);
        throw err;
      }
      const data = JSON.parse(rawText);
      if (typeof data === 'string' && data) return data;
      if (Array.isArray(data)) {
        if (typeof data[0] === 'string') return data.join('\n');
        if (Array.isArray(data[0])) return data[0].map((s) => (Array.isArray(s) ? s[0] : s || '')).join('');
      }
      throw new Error('Empty Google /t response');
    } finally {
      scoped.cleanup();
    }
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
      const res = await fetch(`${host}?${params.toString()}`, { method: 'GET', headers: { 'Accept': 'application/json, text/plain, */*' }, signal: scoped.signal });
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
      if (rawText.startsWith('<')) {
        const err = new Error('HTML response from Google /single');
        err.status = 429;
        err.wait = backoffMs(attempt);
        throw err;
      }
      const data = JSON.parse(rawText);
      if (typeof data === 'string' && data) return data;
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const out = data[0].map((seg) => (Array.isArray(seg) ? seg[0] : '')).join('');
        if (out) return out;
      } else if (data && Array.isArray(data.sentences)) {
        const out = data.sentences.map((s) => s.trans || '').join('');
        if (out) return out;
      } else if (Array.isArray(data) && typeof data[0] === 'string') {
        return data.join('\n');
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
