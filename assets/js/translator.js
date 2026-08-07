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
    'https://translate.google.com/translate_a/single',
  ];

  // Keep requests modest to avoid timeouts on mobile networks.
  const BATCH_LINES = 40;
  const MAX_CHARS_PER_REQUEST = 3500;
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
  const BATCH_SEP_RE = /^[ \t]*\u0001[ \t]*$/;

  // Control chars wrapping markup placeholders. Google leaves control chars
  // verbatim, so subtitle formatting (SRT/VTT HTML tags, ASS/MicroDVD {..}
  // codes) survives translation instead of being stripped or reordered.
  const P_OPEN = '\u0002';
  const P_CLOSE = '\u0003';
  const P_RE = new RegExp(P_OPEN + '(\\d+)' + P_CLOSE, 'g');
  const MARKUP_RE = /\{[^}]*\}|<[^>]*>/g;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const restoreNewlines = (s) => s.split(NL_SENTINEL).join('\n');

  /** Replace subtitle markup with control-char placeholders so Google keeps it. */
  function protect(text) {
    const toks = [];
    const out = text.replace(MARKUP_RE, (m) => {
      const id = toks.length;
      toks.push(m);
      return P_OPEN + id + P_CLOSE;
    });
    return { text: out, toks };
  }
  /** Put the original markup back in place of the placeholders. */
  const restore = (s, toks) => s.replace(P_RE, (_, id) => (toks[id] !== undefined ? toks[id] : ''));

  // Arabic-script targets (Sorani/Kurdish) should use the Arabic punctuation.
  const ARABIC_SCRIPT = new Set(['ckb', 'ku', 'kmr', 'fa', 'ar', 'ur', 'ps']);

  /**
   * Clean up Google's typography for a subtitle line, applying Sorani Kurdish
   * conventions (r12a orthography notes / Kurdish Academy):
   *  - remove stray space before punctuation  ("word !" -> "word!")
   *  - pull punctuation that landed on its own line up to the previous line
   *  - use the Arabic script marks: comma "،", semicolon "؛", question "؟"
   *    (period "." and exclamation "!" stay ASCII)
   */
  function normalizeText(text, isArabic) {
    let t = text
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      .replace(/\s+([.,!?;:،؛؟]+)/g, '$1')
      .replace(/\n([.,!?;:،؛؟]+)/g, '$1');
    if (isArabic) {
      t = t.replace(/,/g, '،')
           .replace(/;/g, '؛')
           .replace(/\?/g, '؟')
           .replace(/\u0643/g, '\u06A9') // Arabic Kaf 'ك' -> Kurdish/Persian Kaf 'ک'
           .replace(/\u064A/g, '\u06CC'); // Arabic Yaa 'ي' -> Kurdish/Persian Yeh 'ی'
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
    const batches = buildBatches(lines);
    const total = batches.length || 1;
    const totalLines = batches.reduce((n, b) => n + b.length, 0);
    const isArabic = ARABIC_SCRIPT.has(tgtLang);
    // Normalized originals, used to detect lines Google returned verbatim.
    const origNorm = lines.map((l) => normalizeText(restoreNewlines((l || '').replace(/\r/g, '')), isArabic));
    let doneLines = 0;
    let anyTranslated = false;
    let sawHardFail = false;

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
          const norm = normalizeText(restoreNewlines(restore(part, batch[k].toks).trim()), isArabic);
          results[batch[k].index] = norm;
          if (norm && norm !== origNorm[batch[k].index]) anyTranslated = true;
        });
      } catch (err) {
        if (signal && signal.aborted) throw err;
        // Batch failed — fall back to one request per line.
        for (const o of batch) {
          throwIfAborted(signal);
          try {
            const norm = normalizeText(restoreNewlines(restore(await translateChunk(o.text, srcLang, tgtLang, signal), o.toks).trim()), isArabic);
            results[o.index] = norm;
            if (norm && norm !== origNorm[o.index]) anyTranslated = true;
          } catch (e) {
            if (e && e.hard) sawHardFail = true;
            results[o.index] = normalizeText(restoreNewlines(restore(o.text, o.toks)), isArabic);
          }
        }
      }

      doneLines += batch.length;
      if (opts.onBatch) opts.onBatch(results, doneLines, totalLines); // feed the live preview
      if (onProgress) onProgress((b + 1) / total, doneLines, totalLines);
      if (b < batches.length - 1) await sleep(DELAY_MS);
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
        if (normalizeText(results[i], isArabic) !== origNorm[i]) continue; // actually translated
        if (!/\p{L}/u.test(orig)) continue;                     // pure numbers / punctuation
        retries.push(i);
      }
      const retryTotal = retries.length;
      for (let k = 0; k < retryTotal; k++) {
        const i = retries[k];
        throwIfAborted(signal);
        const p = protect(lines[i]);
        try {
          const t = await translateChunk(p.text, srcLang, tgtLang, signal);
          const norm = normalizeText(restoreNewlines(restore(t, p.toks).trim()), isArabic);
          if (norm && norm !== origNorm[i]) { results[i] = norm; if (opts.onBatch) opts.onBatch(results, doneLines + k + 1, totalLines + retryTotal); }
        } catch { /* keep the previous result */ }
        if (onProgress) onProgress((doneLines + k + 1) / (totalLines + retryTotal), doneLines + k + 1, totalLines + retryTotal);
      }
    }

    if (onProgress) onProgress(1, totalLines + (opts.accuracy ? retryTotal : 0), totalLines + (opts.accuracy ? retryTotal : 0));
    return results;
  }

  /**
   * Group non-empty lines into batches capped by line count and character count.
   * @returns {Array<Array<{index:number,text:string}>>}
   */
  function buildBatches(lines) {
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
      current.push({ index, text: c.text, toks: c.toks });
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

  /** Translate one chunk, retrying with exponential backoff across hosts. */
  async function translateChunk(text, srcLang, tgtLang, signal) {
    const params = new URLSearchParams({ client: 'gtx', sl: srcLang, tl: tgtLang, dt: 't', q: text });
    let lastErr;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const host = ENDPOINTS[attempt % ENDPOINTS.length];
      const url = `${host}?${params.toString()}`;
      const scoped = scopedSignal(signal);
      try {
        const res = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' }, signal: scoped.signal });
        if (res.status === 429) {
          // Throttled. Wait for the server's Retry-After (or a backoff) and
          // keep trying — this is the common failure on datacenter IPs.
          const retryAfter = Number(res.headers.get('retry-after'));
          const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoffMs(attempt);
          lastErr = new Error(`HTTP 429 (throttled), retrying in ${Math.round(wait / 1000)}s`);
          await sleep(wait);
          continue;
        }
        if (!res.ok) { const e = new Error(`HTTP ${res.status}`); e.hard = res.status >= 500; throw e; }
        const data = await res.json();
        // Google returns data[0] as an array of [translation, original, ...].
        // Guard the shape so an unexpected payload falls back cleanly.
        if (!Array.isArray(data) || !Array.isArray(data[0])) throw new Error('Unexpected response');
        const out = data[0].map((seg) => (Array.isArray(seg) ? seg[0] : '')).join('');
        if (out) return out;
        throw new Error('Empty response');
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
        if (attempt < MAX_ATTEMPTS - 1) await sleep(backoffMs(attempt));
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
      if (BATCH_SEP_RE.test(line)) { parts.push(cur.join('\n')); cur = []; }
      else cur.push(line);
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

  return { translateLines, warmup, normalizeText };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Translator;
