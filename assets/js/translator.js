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

  const BATCH_LINES = 32;
  const MAX_CHARS_PER_REQUEST = 2800;
  const DELAY_MS = 60;
  const MAX_ATTEMPTS = 6;
  const REQUEST_TIMEOUT_MS = 8000;

  // In-memory line translation cache for instant 0ms duplicate resolution
  const TRANSLATION_CACHE = new Map();
  const MAX_CACHE_SIZE = 3000;

  function setTranslationCache(k, val) {
    if (!k) return;
    if (TRANSLATION_CACHE.size >= MAX_CACHE_SIZE) {
      const firstKey = TRANSLATION_CACHE.keys().next().value;
      TRANSLATION_CACHE.delete(firstKey);
    }
    TRANSLATION_CACHE.set(k, val);
  }

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
    const cleanup = () => {
      if (signal) signal.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      clearTimeout(timer);
      cleanup();
      resolve();
    };
    timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
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
      const origLine = origLines[i] !== undefined ? origLines[i] : '';
      let line = String(tLine || '').trim();
      if (!origLine) return line;

      // Extract leading formatting & alignment tags from origLine (even if before/after a dash)
      let leadTags = '';
      const leadTagBeforeDash = origLine.match(/^\s*((?:\{[^}]+\}|<[a-zA-Z0-9]+(?:\s+[^>]+)?>\s*)+)/);
      const leadTagAfterDash = origLine.match(/^\s*[-—–]\s*((?:\{[^}]+\}|<[a-zA-Z0-9]+(?:\s+[^>]+)?>\s*)+)/);
      const dashBeforeTag = Boolean(leadTagAfterDash);

      if (leadTagBeforeDash) {
        leadTags = leadTagBeforeDash[1].trim();
      } else if (leadTagAfterDash) {
        leadTags = leadTagAfterDash[1].trim();
      }

      // Check if original line had a dialogue hyphen/dash
      const hadDash = /^\s*[-—–]/.test(origLine) || /^\s*\{[^}]+\}\s*[-—–]/.test(origLine);

      // Strip leadTags wherever they landed in translated line (e.g. pushed to end by BiDi reordering)
      if (leadTags) {
        const escaped = leadTags.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        line = line.replace(new RegExp(escaped, 'g'), '').trim();
      }

      // Handle trailing tags: HTML closing tags </font>, </i>, </b>
      const trailTagMatch = origLine.match(/((?:<\/[a-z0-9]+>\s*)+)$/i);
      let trailTags = '';
      if (trailTagMatch) {
        trailTags = trailTagMatch[1].trim();
        const escaped = trailTags.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        line = line.replace(new RegExp(escaped, 'g'), '').trim();
      }

      // Strip any misplaced trailing dash that flipped to the end in RTL
      if (hadDash) {
        line = line.replace(/\s*[-—–]$/, '').trim();
        line = line.replace(/^[-—–]\s*/, '').trim();
      }

      // Reassemble cleanly preserving whether dash preceded tags or vice versa
      if (dashBeforeTag) {
        line = (hadDash ? '- ' : '') + (leadTags ? leadTags : '') + line + trailTags;
      } else {
        line = (leadTags ? leadTags : '') + (hadDash ? '- ' : '') + line + trailTags;
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
    [/\bdon['’]?t\s+worry\b|\bno\s+worries\b/gi, 'do not worry'],
    [/\btake\s+it\s+easy\b/gi, 'relax'],
    [/\bmake\s+sure\b/gi, 'ensure'],
    [/\bmake\s+yourself\s+at\s+home\b/gi, 'feel comfortable'],
    [/\bmind\s+your\s+own\s+business\b/gi, 'do not interfere'],
    [/\bon\s+my\s+way\b/gi, 'coming now'],
    [/\bgive\s+me\s+a\s+hand\b/gi, 'help me'],
    [/\bget\s+out\s+of\s+here\b/gi, 'leave right now'],
    [/\bright\s+away\b|\bstraight\s+away\b/gi, 'immediately'],
    [/\bright\s+now\b/gi, 'immediately'],
    [/\ball\s+right\b|\balright\b/gi, 'okay'],
    [/\bno\s+longer\b|\bnot\s+anymore\b/gi, 'no longer'],
    [/\bso\s+far\b/gi, 'until now'],
    [/\bas\s+well\s+as\b/gi, 'in addition to'],
    [/\bin\s+front\s+of\b/gi, 'before'],
    [/\bdue\s+to\b|\bbecause\s+of\b/gi, 'owing to'],
    [/\baccording\s+to\b/gi, 'based on'],
    [/\bas\s+soon\s+as\b/gi, 'promptly when'],
    [/\bas\s+long\s+as\b/gi, 'provided that'],
    [/\bas\s+if\b|\bas\s+though\b/gi, 'seemingly like'],
    [/\bat\s+least\b/gi, 'minimum'],
    [/\bat\s+most\b/gi, 'maximum'],
    [/\bat\s+all\b/gi, 'in any way'],
    [/\ball\s+of\s+a\s+sudden\b/gi, 'suddenly'],
    [/\bout\s+of\s+the\s+blue\b/gi, 'unexpectedly'],
    [/\bout\s+of\s+order\b/gi, 'broken'],
    [/\bout\s+of\s+date\b/gi, 'expired'],
    [/\bout\s+of\s+reach\b/gi, 'inaccessible'],
    [/\bout\s+of\s+stock\b/gi, 'unavailable'],
    [/\bup\s+to\s+date\b/gi, 'modern'],
    [/\bface\s+to\s+face\b/gi, 'in person'],
    [/\bside\s+by\s+side\b/gi, 'together'],
    [/\bstep\s+by\s+step\b|\blittle\s+by\s+little\b/gi, 'gradually'],
    [/\bonce\s+in\s+a\s+while\b|\bfrom\s+time\s+to\s+time\b/gi, 'occasionally'],
    [/\bmore\s+or\s+less\b/gi, 'approximately'],
    [/\bsooner\s+or\s+later\b/gi, 'eventually'],
    [/\bupside\s+down\b/gi, 'inverted'],
    [/\binside\s+out\b/gi, 'reversed'],
    [/\bsafe\s+and\s+sound\b/gi, 'unharmed'],
    [/\bfirst\s+of\s+all\b/gi, 'primarily'],
    [/\blast\s+but\s+not\s+least\b/gi, 'finally'],
    [/\bby\s+accident\b/gi, 'unintentionally'],
    [/\bon\s+purpose\b/gi, 'intentionally'],
    [/\bin\s+fact\b|\bas\s+a\s+matter\s+of\s+fact\b/gi, 'actually'],
    [/\bfor\s+instance\b|\bfor\s+example\b/gi, 'such as'],
    [/\bin\s+advance\b/gi, 'beforehand'],
    [/\bin\s+charge\s+of\b/gi, 'responsible for'],
    [/\bin\s+spite\s+of\b/gi, 'despite'],
    [/\beach\s+other\b|\bone\s+another\b/gi, 'mutually each other'],
    // Contextual Phrasal Verbs (Word before / after affects meaning)
    [/\blook\s+after\b/gi, 'take care of'],
    [/\blooks\s+after\b/gi, 'takes care of'],
    [/\blooking\s+after\b/gi, 'taking care of'],
    [/\blooked\s+after\b/gi, 'took care of'],
    [/\blook\s+for\b/gi, 'search for'],
    [/\blooks\s+for\b/gi, 'searches for'],
    [/\blooking\s+for\b/gi, 'searching for'],
    [/\blooked\s+for\b/gi, 'searched for'],
    [/\blook\s+forward\s+to\b/gi, 'eagerly await'],
    [/\blooking\s+forward\s+to\b/gi, 'eagerly awaiting'],
    [/\blook\s+down\s+on\b/gi, 'disrespect'],
    [/\blooks\s+down\s+on\b/gi, 'disrespects'],
    [/\blook\s+up\s+to\b/gi, 'admire and respect'],
    [/\blooks\s+up\s+to\b/gi, 'admires and respects'],
    [/\blook\s+into\b/gi, 'investigate'],
    [/\blooking\s+into\b/gi, 'investigating'],
    [/\bgive\s+up\b/gi, 'surrender'],
    [/\bgives\s+up\b/gi, 'surrenders'],
    [/\bgiving\s+up\b/gi, 'surrendering'],
    [/\bgave\s+up\b/gi, 'surrendered'],
    [/\bgive\s+in\b/gi, 'yield'],
    [/\bgives\s+in\b/gi, 'yields'],
    [/\bgiving\s+in\b/gi, 'yielding'],
    [/\bgave\s+in\b/gi, 'yielded'],
    [/\bgive\s+away\b/gi, 'donate'],
    [/\bgives\s+away\b/gi, 'donates'],
    [/\bgive\s+back\b/gi, 'return'],
    [/\bgives\s+back\b/gi, 'returns'],
    [/\btake\s+care\s+of\b/gi, 'protect and care for'],
    [/\btakes\s+care\s+of\b/gi, 'protects and cares for'],
    [/\btaking\s+care\s+of\b/gi, 'protecting and caring for'],
    [/\btook\s+care\s+of\b/gi, 'protected and cared for'],
    [/\btake\s+off\b/gi, 'depart'],
    [/\btakes\s+off\b/gi, 'departs'],
    [/\btaking\s+off\b/gi, 'departing'],
    [/\btook\s+off\b/gi, 'departed'],
    [/\btake\s+over\b/gi, 'seize control'],
    [/\btakes\s+over\b/gi, 'seizes control'],
    [/\btaking\s+over\b/gi, 'seizing control'],
    [/\btook\s+over\b/gi, 'seized control'],
    [/\btake\s+on\b/gi, 'challenge'],
    [/\btakes\s+on\b/gi, 'challenges'],
    [/\btake\s+part\s+in\b/gi, 'participate in'],
    [/\btakes\s+part\s+in\b/gi, 'participates in'],
    [/\btaking\s+part\s+in\b/gi, 'participating in'],
    [/\btook\s+part\s+in\b/gi, 'participated in'],
    [/\btake\s+place\b/gi, 'occur'],
    [/\btakes\s+place\b/gi, 'occurs'],
    [/\btook\s+place\b/gi, 'occurred'],
    [/\btake\s+for\s+granted\b/gi, 'undervalue'],
    [/\btake\s+advantage\s+of\b/gi, 'exploit'],
    [/\bget\s+rid\s+of\b/gi, 'eliminate'],
    [/\bgetting\s+rid\s+of\b/gi, 'eliminating'],
    [/\bgot\s+rid\s+of\b/gi, 'eliminated'],
    [/\bget\s+away\s+with\b/gi, 'escape punishment for'],
    [/\bget\s+over\b/gi, 'recover from'],
    [/\bgot\s+over\b/gi, 'recovered from'],
    [/\bget\s+along\s+with\b/gi, 'be friendly with'],
    [/\bgets\s+along\s+with\b/gi, 'is friendly with'],
    [/\bget\s+used\s+to\b/gi, 'become accustomed to'],
    [/\bgetting\s+used\s+to\b/gi, 'becoming accustomed to'],
    [/\bgot\s+used\s+to\b/gi, 'became accustomed to'],
    [/\bget\s+lost\b/gi, 'go away'],
    [/\bget\s+out\s+of\b/gi, 'leave'],
    [/\bgot\s+out\s+of\b/gi, 'left'],
    [/\bturn\s+on\b/gi, 'activate'],
    [/\bturns\s+on\b/gi, 'activates'],
    [/\bturning\s+on\b/gi, 'activating'],
    [/\bturned\s+on\b/gi, 'activated'],
    [/\bturn\s+off\b/gi, 'deactivate'],
    [/\bturns\s+off\b/gi, 'deactivates'],
    [/\bturning\s+off\b/gi, 'deactivating'],
    [/\bturned\s+off\b/gi, 'deactivated'],
    [/\bturn\s+down\b/gi, 'reject'],
    [/\bturns\s+down\b/gi, 'rejects'],
    [/\bturning\s+down\b/gi, 'rejecting'],
    [/\bturned\s+down\b/gi, 'rejected'],
    [/\bturn\s+out\b/gi, 'become clear'],
    [/\bturns\s+out\b/gi, 'becomes clear'],
    [/\bturned\s+out\b/gi, 'became clear'],
    [/\bturn\s+into\b/gi, 'transform into'],
    [/\bturns\s+into\b/gi, 'transforms into'],
    [/\bturning\s+into\b/gi, 'transforming into'],
    [/\bturned\s+into\b/gi, 'transformed into'],
    [/\bturn\s+around\b/gi, 'reverse direction'],
    [/\bbreak\s+down\b/gi, 'stop functioning'],
    [/\bbreaks\s+down\b/gi, 'stops functioning'],
    [/\bbreaking\s+down\b/gi, 'stopping functioning'],
    [/\bbroke\s+down\b/gi, 'stopped functioning'],
    [/\bbreak\s+up\b/gi, 'separate'],
    [/\bbreaks\s+up\b/gi, 'separates'],
    [/\bbreaking\s+up\b/gi, 'separating'],
    [/\bbroke\s+up\b/gi, 'separated'],
    [/\bbreak\s+out\b/gi, 'escape'],
    [/\bbreaks\s+out\b/gi, 'escapes'],
    [/\bbreaking\s+out\b/gi, 'escaping'],
    [/\bbroke\s+out\b/gi, 'escaped'],
    [/\bbreak\s+into\b|\bbreak\s+in\b/gi, 'enter forcefully'],
    [/\brun\s+out\s+of\b/gi, 'exhaust supply of'],
    [/\bruns\s+out\s+of\b/gi, 'exhausts supply of'],
    [/\brunning\s+out\s+of\b/gi, 'exhausting supply of'],
    [/\bran\s+out\s+of\b/gi, 'exhausted supply of'],
    [/\brun\s+into\b/gi, 'encounter unexpectedly'],
    [/\bruns\s+into\b/gi, 'encounters unexpectedly'],
    [/\bran\s+into\b/gi, 'encountered unexpectedly'],
    [/\brun\s+away\b/gi, 'flee'],
    [/\bruns\s+away\b/gi, 'flees'],
    [/\brunning\s+away\b/gi, 'fleeing'],
    [/\bran\s+away\b/gi, 'fled'],
    [/\brun\s+over\b|\bran\s+over\b/gi, 'hit with vehicle'],
    [/\bhold\s+back\b|\bheld\s+back\b/gi, 'restrain'],
    [/\bhold\s+up\b|\bheld\s+up\b/gi, 'delay'],
    [/\bcome\s+across\b|\bcame\s+across\b/gi, 'find by chance'],
    [/\bcome\s+up\s+with\b|\bcame\s+up\s+with\b/gi, 'devise'],
    [/\bcome\s+back\b/gi, 'return'],
    [/\bcomes\s+back\b/gi, 'returns'],
    [/\bcoming\s+back\b/gi, 'returning'],
    [/\bcame\s+back\b/gi, 'returned'],
    [/\bcome\s+true\b|\bcame\s+true\b/gi, 'become reality'],
    [/\bput\s+off\b|\bputting\s+off\b/gi, 'postpone'],
    [/\bput\s+up\s+with\b/gi, 'tolerate'],
    [/\bput\s+out\b|\bputting\s+out\b/gi, 'extinguish'],
    [/\bput\s+on\b|\bputting\s+on\b/gi, 'wear'],
    [/\bkeep\s+up\s+with\b/gi, 'stay equal with'],
    [/\bkeep\s+away\s+from\b/gi, 'stay away from'],
    [/\bkeep\s+in\s+touch\b/gi, 'remain in contact'],
    [/\bkeep\s+calm\b/gi, 'remain calm'],
    [/\bpass\s+away\b|\bpasses\s+away\b|\bpassed\s+away\b/gi, 'die'],
    [/\bpass\s+out\b|\bpasses\s+out\b|\bpassed\s+out\b/gi, 'lose consciousness'],
    [/\bcall\s+off\b|\bcalls\s+off\b|\bcalled\s+off\b/gi, 'cancel'],
    [/\bcall\s+for\b|\bcalls\s+for\b/gi, 'demand'],
    [/\bbring\s+up\b|\bbrought\s+up\b/gi, 'mention'],
    [/\bbring\s+about\b|\bbrought\s+about\b/gi, 'cause'],
    [/\bcarry\s+on\b|\bcarried\s+on\b/gi, 'continue'],
    [/\bcarry\s+out\b|\bcarried\s+out\b/gi, 'perform'],
    [/\bdrop\s+by\b|\bdrop\s+in\b/gi, 'visit briefly'],
    [/\bdrop\s+out\b|\bdropped\s+out\b/gi, 'withdraw'],
    [/\bstand\s+for\b|\bstands\s+for\b/gi, 'represent'],
    [/\bstand\s+by\b|\bstands\s+by\b/gi, 'support'],
    [/\bstand\s+up\b|\bstands\s+up\b/gi, 'rise'],
    [/\bmake\s+fun\s+of\b/gi, 'mock'],
    [/\bmake\s+up\s+for\b/gi, 'compensate for'],
    [/\bset\s+up\b|\bsetting\s+up\b/gi, 'establish'],
    [/\bblow\s+up\b|\bblew\s+up\b/gi, 'explode'],
    [/\bcheck\s+out\b|\bchecked\s+out\b/gi, 'inspect'],
    [/\bchill\s+out\b/gi, 'relax'],
    [/\bfreak\s+out\b|\bfreaked\s+out\b/gi, 'panic'],
    [/\bhang\s+out\b/gi, 'spend time together'],
    [/\bback\s+off\b/gi, 'retreat'],
    [/\bcut\s+it\s+out\b/gi, 'stop doing that'],
    [/\bscrew\s+up\b|\bscrewed\s+up\b/gi, 'ruin everything'],
    [/\bmess\s+up\b|\bmessed\s+up\b/gi, 'make a mistake'],
    [/\bwork\s+out\b|\bworked\s+out\b/gi, 'resolve successfully'],
    [/\bfigure\s+out\b|\bfigured\s+out\b/gi, 'understand'],
    [/\bfind\s+out\b|\bfound\s+out\b/gi, 'discover'],
    [/\bhear\s+out\b|\bheard\s+out\b/gi, 'listen completely'],
    [/\bpay\s+attention\b/gi, 'listen carefully'],
    [/\bpay\s+off\b|\bpaid\s+off\b/gi, 'yield results'],
    [/\bcatch\s+up\s+with\b/gi, 'reach'],
    [/\bpull\s+over\b/gi, 'stop vehicle'],
    [/\bpull\s+off\b/gi, 'accomplish'],
    [/\bpull\s+through\b/gi, 'survive and recover'],
    [/\bshow\s+up\b|\bshowed\s+up\b/gi, 'arrive'],
    [/\bpoint\s+out\b|\bpointed\s+out\b/gi, 'indicate'],
    [/\bfall\s+apart\b|\bfell\s+apart\b/gi, 'break into pieces'],
    [/\blet\s+down\b/gi, 'disappoint'],
    [/\blet\s+go\s+of\b/gi, 'release'],
    [/\bdeal\s+with\b|\bdealt\s+with\b/gi, 'handle'],
    [/\bend\s+up\b|\bended\s+up\b/gi, 'finally become'],
    [/\bsort\s+out\b|\bsorted\s+out\b/gi, 'resolve'],
    [/\bstick\s+with\b/gi, 'stay with'],
    [/\bspeak\s+up\b/gi, 'speak louder'],
    [/\bsettle\s+down\b/gi, 'calm down'],
    [/\bcheer\s+up\b/gi, 'become happier'],
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
    [/\bout\s+of\s+(?:the\s+blue|nowhere)\b/gi, 'suddenly'],
    [/\bpiece\s+of\s+cake\b/gi, 'very easy'],
    [/\bcold\s+feet\b/gi, 'fear'],
    [/\bunder\s+the\s+weather\b/gi, 'unwell'],
    [/\bspill\s+the\s+beans\b/gi, 'reveal the truth'],
    [/\bbite\s+the\s+bullet\b/gi, 'endure the hardship'],
    [/\bbreak\s+a\s+leg\b/gi, 'good luck'],
    [/\bgive\s+me\s+a\s+break\b/gi, 'leave me alone'],
    [/\bcut\s+(?:me\s+)?some\s+slack\b/gi, 'be lenient'],
    [/\bsuit\s+yourself\b/gi, 'as you wish'],
    [/\btake\s+your\s+time\b/gi, 'do not rush'],
    [/\bmake\s+sense\b/gi, 'is logical'],
    [/\bdoesn['’]?t\s+make\s+sense\b/gi, 'is meaningless'],
    [/\bin\s+that\s+case\b/gi, 'then'],
    [/\bno\s+big\s+deal\b/gi, 'not important'],
    [/\bsounds\s+good\b/gi, 'agreed'],
    [/\blet\s+me\s+know\b/gi, 'inform me'],
    [/\bhang\s+in\s+there\b/gi, 'stay strong'],
    [/\bget\s+out\s+of\s+my\s+sight\b/gi, 'go away from me'],
    [/\bare\s+you\s+out\s+of\s+your\s+mind\b/gi, 'are you crazy'],
    [/\bwhat\s+brings\s+you\s+here\b/gi, 'why are you here'],
    [/\bwhat['’]?s\s+the\s+matter\b/gi, 'what is wrong'],
    [/\blong\s+story\s+short\b/gi, 'in brief'],
    [/\bmake\s+it\s+count\b/gi, 'make it effective'],
    [/\bwe\s+got\s+company\b/gi, 'enemies are arriving'],
    [/\bheads\s+up\b/gi, 'be careful'],
    [/\bstay\s+alert\b/gi, 'stay watchful'],
    [/\bkeep\s+your\s+eyes\s+peeled\b/gi, 'watch carefully'],
    [/\btake\s+cover\b/gi, 'protect yourself in shelter'],
    [/\bget\s+down\b/gi, 'duck down'],
    [/\bstay\s+low\b/gi, 'stay low down'],
    [/\bwe['’]?re\s+surrounded\b/gi, 'we are surrounded by enemies'],
    [/\bno\s+way\s+out\b/gi, 'there is no exit'],
    [/\bbuy\s+(?:us\s+)?some\s+time\b/gi, 'delay them for time'],
    [/\bhold\s+them\s+off\b/gi, 'prevent them from advancing'],
    [/\bgive\s+them\s+hell\b/gi, 'destroy them fiercely'],
    [/\bstand\s+your\s+ground\b/gi, 'do not retreat'],
    [/\bnot\s+on\s+my\s+watch\b/gi, 'I will never allow it'],
    [/\bover\s+my\s+dead\s+body\b/gi, 'never while I live'],
    [/\bcut\s+the\s+crap\b/gi, 'stop talking nonsense'],
    [/\bspill\s+it\b/gi, 'say it right now'],
    [/\bon\s+thin\s+ice\b/gi, 'in great danger'],
    [/\bcall\s+it\s+a\s+day\b/gi, 'finish work for today'],
    [/\bcut\s+to\s+the\s+chase\b/gi, 'go straight to the point'],
    [/\bback\s+to\s+square\s+one\b/gi, 'back to the beginning'],
    [/\bburning\s+bridges\b/gi, 'destroying all relations'],
    [/\belephant\s+in\s+the\s+room\b/gi, 'the obvious unmentioned problem'],
    [/\bplay\s+with\s+fire\b/gi, 'take dangerous risks'],
    [/\blast\s+straw\b/gi, 'the final unbearable thing'],
    [/\boff\s+the\s+hook\b/gi, 'free from blame or trouble'],
    [/\bon\s+cloud\s+nine\b/gi, 'extremely happy'],
    [/\bonce\s+in\s+a\s+blue\s+moon\b/gi, 'very rarely'],
    [/\bsee\s+eye\s+to\s+eye\b/gi, 'agree completely'],
    [/\bspill\s+the\s+tea\b/gi, 'tell all the gossip'],
    [/\bup\s+in\s+the\s+air\b/gi, 'not yet decided'],
    [/\bweather\s+the\s+storm\b/gi, 'survive the difficulty'],
    [/\byou\s+can\s+say\s+that\s+again\b/gi, 'you are totally right'],
    [/\byour\s+guess\s+is\s+as\s+good\s+as\s+mine\b/gi, 'I know as little as you'],
    [/\bfor\s+(?:god['’]?s|goodness['’]?|heaven['’]?s)\s+sake\b/gi, 'please'],
    [/\brest\s+in\s+peace\b/gi, 'may their soul rest in peace'],
    [/\b(?:i\s+don['’]?t\s+care|who\s+cares)\b/gi, 'it does not matter'],
    [/\bnone\s+of\s+your\s+business\b/gi, 'not your concern'],
    [/\bstand\s+down\b/gi, 'stop fighting'],
    [/\btake\s+cover\b/gi, 'find cover'],
    [/\bopen\s+fire\b/gi, 'start shooting'],
    [/\bhold\s+your\s+fire\b/gi, 'do not shoot'],
    [/\bsecure\s+the\s+perimeter\b/gi, 'secure the area'],
    [/\benemy\s+spotted\b/gi, 'enemy seen'],
    [/\bstay\s+alert\b/gi, 'be alert'],
    [/\bincoming\b/gi, 'danger incoming'],
    [/\bhands\s+where\s+i\s+can\s+see\s+them\b/gi, 'raise your hands'],
    [/\bdon['’]?t\s+move\s+a\s+muscle\b/gi, 'do not move'],
    [/\byou\s+haven['’]?t\s+seen\s+anything\s+yet\b/gi, 'you have not seen my real power'],
    [/\bi\s+will\s+surpass\s+my\s+limits\b/gi, 'I will become stronger'],
    [/\bi\s+cannot\s+lose\b/gi, 'I will not lose'],
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

  const getDict = () => {
    if (typeof TranslatorDict !== 'undefined') return TranslatorDict;
    if (typeof require !== 'undefined') {
      try { return require('./translator-dict.js'); } catch {}
    }
    return null;
  };

  function matchSingleLineLexicon(str, dict) {
    if (!str || typeof str !== 'string') return null;
    let prefix = '';
    let body = str.trim();
    if (body.startsWith('- ')) {
      prefix = '- ';
      body = body.slice(2).trim();
    }

    const clean = body
      .toLowerCase()
      .replace(/[,،\-—–]/g, ' ')
      .replace(/[.!?؟؛…"'«»()[\]{}]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (clean && dict.LEXICON && dict.LEXICON[clean]) {
      let res = dict.LEXICON[clean].kurdish;
      if (body.endsWith('?') || body.endsWith('؟')) {
        if (!res.endsWith('؟') && !res.endsWith('?')) res += '؟';
      } else if (body.endsWith('!')) {
        if (!res.endsWith('!')) res += '!';
      }
      return prefix + res;
    }
    return null;
  }

  function lookupLexicon(rawText) {
    if (!rawText || typeof rawText !== 'string') return null;
    const dict = getDict();
    if (!dict || !dict.LEXICON) return null;

    const sublines = rawText.split(/\r?\n/);
    if (sublines.length > 1) {
      const translatedSublines = [];
      for (const line of sublines) {
        if (!line.trim()) {
          translatedSublines.push('');
          continue;
        }
        const subResult = matchSingleLineLexicon(line, dict);
        if (!subResult) return null;
        translatedSublines.push(subResult);
      }
      return translatedSublines.join('\n');
    }
    return matchSingleLineLexicon(rawText, dict);
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

    // Normalize parameters if optional arguments were shifted or passed in inverted order
    if (typeof onProgress === 'object' && onProgress !== null && !(onProgress instanceof AbortSignal)) {
      options = onProgress;
      onProgress = null;
    } else if (onProgress instanceof AbortSignal) {
      signal = onProgress;
      onProgress = null;
    }
    if (signal && !(signal instanceof AbortSignal) && typeof signal === 'object') {
      options = signal;
      signal = null;
    }
    const progressCb = typeof onProgress === 'function' ? onProgress : null;

    const opts = typeof options === 'object' && options !== null ? options : {};
    const isArabic = ARABIC_SCRIPT.has(tgtLang);
    const useKurdishDigits = !!opts.kurdishDigits;

    const results = new Array(lines.length).fill('');
    let lexiconMatchedCount = 0;

    let anyTranslated = false;
    let sawHardFail = false;
    let failedLines = 0;

    // Instant idiomatic lexicon and translation cache matching
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      if (!raw || !raw.trim()) continue;
      const cleanKey = `${srcLang}:${tgtLang}:${raw.trim()}`;
      if (tgtLang === 'ckb') {
        const matched = lookupLexicon(raw);
        if (matched) {
          results[i] = postprocessSorani(matched, { kurdishDigits: useKurdishDigits });
          lexiconMatchedCount++;
          anyTranslated = true;
          continue;
        }
      }
      if (TRANSLATION_CACHE.has(cleanKey)) {
        results[i] = TRANSLATION_CACHE.get(cleanKey);
        lexiconMatchedCount++;
        anyTranslated = true;
      }
    }

    const batches = buildBatches(lines, srcLang, tgtLang, results);
    const totalLines = lines.filter((l) => l && l.trim()).length || 1;
    const mainFraction = opts.accuracy ? 0.8 : 1.0;

    const origNorm = lines.map((l) => normalizeText(l || '', isArabic, useKurdishDigits));

    let doneLines = lexiconMatchedCount;
    let retryTotal = 0;

    const flags = { anyTranslated, sawHardFail, failedLines };

    for (let b = 0; b < batches.length; b++) {
      throwIfAborted(signal);
      const batch = batches[b];
      const joined = batch.map((item) => item.text).join('\n' + BATCH_SEP + '\n');

      try {
        const translatedJoined = await translateChunk(joined, srcLang, tgtLang, signal);
        flags.anyTranslated = true;
        const split = splitBatch(translatedJoined, batch.length);

        if (split.length === batch.length) {
          batch.forEach((item, i) => {
            let restored = restoreNewlines(restore(split[i].trim(), item.toks));
            restored = cleanLeftoverTokens(restored);
            let norm = (tgtLang === 'ckb')
              ? postprocessSorani(restored, { kurdishDigits: useKurdishDigits })
              : normalizeText(restored, isArabic, useKurdishDigits);
            norm = fixPlacementAndTagOrder(norm, item.raw);
            results[item.index] = norm;

            if (item.raw && item.raw.trim()) {
              const k = `${srcLang}:${tgtLang}:${item.raw.trim()}`;
              setTranslationCache(k, norm);
            }
          });
        } else {
          // Merged batch fallback: translate line-by-line
          for (let item of batch) {
            throwIfAborted(signal);
            try {
              const single = await translateChunk(item.text, srcLang, tgtLang, signal);
              let restored = restoreNewlines(restore(single.trim(), item.toks));
              restored = cleanLeftoverTokens(restored);
              let norm = (tgtLang === 'ckb')
                ? postprocessSorani(restored, { kurdishDigits: useKurdishDigits })
                : normalizeText(restored, isArabic, useKurdishDigits);
              norm = fixPlacementAndTagOrder(norm, item.raw);
              results[item.index] = norm;

              if (item.raw && item.raw.trim()) {
                const k = `${srcLang}:${tgtLang}:${item.raw.trim()}`;
                setTranslationCache(k, norm);
              }
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
            let norm = (tgtLang === 'ckb')
              ? postprocessSorani(restored, { kurdishDigits: useKurdishDigits })
              : normalizeText(restored, isArabic, useKurdishDigits);
            norm = fixPlacementAndTagOrder(norm, item.raw);
            results[item.index] = norm;

            if (item.raw && item.raw.trim()) {
              const k = `${srcLang}:${tgtLang}:${item.raw.trim()}`;
              setTranslationCache(k, norm);
            }
          } catch {
            results[item.index] = item.raw;
            flags.failedLines++;
          }
        }
      }

      doneLines += batch.length;
      if (opts.onBatch) opts.onBatch(results, doneLines, totalLines);
      if (progressCb) progressCb(mainFraction * (doneLines / totalLines), doneLines, totalLines);
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
          let restored = restoreNewlines(restore(t.trim(), p.toks));
          restored = cleanLeftoverTokens(restored);
          let norm = (tgtLang === 'ckb')
            ? postprocessSorani(restored, { kurdishDigits: useKurdishDigits })
            : normalizeText(restored, isArabic, useKurdishDigits);
          norm = fixPlacementAndTagOrder(norm, lines[i]);
          if (norm && norm !== origNorm[i]) {
            results[i] = norm;
            if (lines[i] && lines[i].trim()) {
              const k = `${srcLang}:${tgtLang}:${lines[i].trim()}`;
              setTranslationCache(k, norm);
            }
            if (opts.onBatch) opts.onBatch(results, doneLines + k + 1, totalLines + retryTotal);
          }
        } catch {}
        if (progressCb) progressCb(mainFraction + (1 - mainFraction) * (k + 1) / Math.max(1, retryTotal), doneLines + k + 1, totalLines + retryTotal);
      }
    }

    if (progressCb) progressCb(1, totalLines + retryTotal, totalLines + retryTotal);
    results.failedCount = failedLines;

    if (isArabic && opts.contextAware !== false) {
      const orth = getOrthography();
      if (orth && orth.resolveDialogueContext) {
        const harmonized = orth.resolveDialogueContext(results, lines, { kurdishDigits: useKurdishDigits });
        for (let i = 0; i < results.length; i++) {
          if (harmonized[i]) results[i] = harmonized[i];
        }
      }
    }

    return results;
  }

  function buildBatches(lines, srcLang, tgtLang, results = []) {
    const batches = [];
    let current = [];
    let chars = 0;

    lines.forEach((text, index) => {
      if (!text.trim()) return;
      if (results && results[index]) return; // Skip lines already matched by exact lexicon
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

  const CLIENTS = ['gtx', 'dict-chrome-ex', 'tw-ob'];

  // On static hosting (GitHub Pages, S3, etc.) there is no /api/translate
  // backend, so probing it on every chunk wastes one doomed round-trip per
  // batch. Detect static hosting once; the probe is skipped there.
  let STATIC_HOST_NO_PROXY = false;
  try {
    STATIC_HOST_NO_PROXY = typeof location !== 'undefined' &&
      (/\.github\.io$/.test(location.hostname) ||
       /\.pages\.dev$/.test(location.hostname) ||
       /\.netlify\.app$/.test(location.hostname) ||
       /\.vercel\.app$/.test(location.hostname) ||
       /\.s3[.-]/.test(location.hostname) ||
       /\.amazonaws\.com$/.test(location.hostname) ||
       /^file:/.test(location.protocol));
  } catch {}

  async function fetchServerProxy(text, srcLang, tgtLang, signal) {
    if (STATIC_HOST_NO_PROXY) return null;
    if (typeof window === 'undefined' || !window.location || !window.location.origin) return null;
    const scoped = scopedSignal(signal);
    try {
      let res;
      if (text.length > 200 || text.includes('\n') || text.includes(BATCH_SEP)) {
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
      if (typeof data[0] === 'string') return decodeHtmlEntities(data.join(''));
      if (Array.isArray(data[0])) {
        const text = data[0]
          .map((seg) => {
            if (typeof seg === 'string') return seg;
            if (Array.isArray(seg) && typeof seg[0] === 'string') return seg[0];
            return '';
          })
          .join('');
        if (text) return decodeHtmlEntities(text);
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
      let res;
      if (text.length > 800) {
        res = await fetch(host, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
          body: params.toString(),
          signal: scoped.signal
        });
      } else {
        res = await fetch(`${host}?${params.toString()}`, { method: 'GET', signal: scoped.signal });
      }
      if (res.status === 414) {
        res = await fetch(host, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
          body: params.toString(),
          signal: scoped.signal
        });
      }
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
    if (!text || !text.trim()) return '';

    let lastErr;
    try {
      const proxyResult = await fetchServerProxy(text, srcLang, tgtLang, signal);
      if (proxyResult) {
        return proxyResult;
      }
    } catch {}

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      throwIfAborted(signal);
      try {
        let result = '';
        if (attempt < 3) {
          try {
            result = await fetchGoogle(text, srcLang, tgtLang, signal, attempt);
          } catch (googleErr) {
            if (googleErr.status === 429 && googleErr.wait) {
              await sleep(Math.min(googleErr.wait, 2000), signal);
            }
            try {
              result = await fetchGoogleT(text, srcLang, tgtLang, signal, attempt);
            } catch {}
            if (!result) throw googleErr;
          }
        } else if (attempt === 3) {
          try {
            result = await fetchGoogleT(text, srcLang, tgtLang, signal, attempt);
          } catch {
            try { result = await fetchGoogle(text, srcLang, tgtLang, signal, attempt + 1); } catch {}
          }
        } else if (attempt === 4) {
          try {
            result = await fetchLingva(text, srcLang, tgtLang, signal, attempt);
          } catch {
            try { result = await fetchGoogle(text, srcLang, tgtLang, signal, attempt + 1); } catch {}
          }
        } else {
          try {
            result = await fetchMyMemory(text, srcLang, tgtLang, signal);
          } catch {
            try { result = await fetchGoogle(text, srcLang, tgtLang, signal, 0); } catch {}
          }
        }

        if (result) {
          return result;
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

  function splitBatch(translated, expectedCount) {
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

    if (expectedCount && parts.length !== expectedCount) {
      if (parts.length === expectedCount + 1 && parts[parts.length - 1].trim() === '') {
        parts.pop();
      } else if (parts.length === expectedCount + 1 && parts[0].trim() === '') {
        parts.shift();
      }
    }

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

  async function translateSingleLine(line, srcLang = 'auto', tgtLang = 'ckb', options = {}, signal = null) {
    if (!line || !line.trim()) return '';
    if (options instanceof AbortSignal) {
      signal = options;
      options = {};
    }
    const res = await translateLines([line], srcLang, tgtLang, null, signal, options);
    return (res && res[0]) ? res[0] : line;
  }

  return {
    translateLines,
    translateSingleLine,
    lookupLexicon,
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
    resolveDialogueContext: (res, orig, opts) => {
      const orth = getOrthography();
      return orth && orth.resolveDialogueContext ? orth.resolveDialogueContext(res, orig, opts) : res;
    },
  };
})();

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined' && typeof window === 'undefined') module.exports = Translator;
