/**
 * translator.js — Batch translation engine using Google Translate's free
 * web endpoint (no API key, no backend). Works on GitHub Pages.
 *
 * Batching: we send many subtitle lines joined by "\n" in one request, then
 * split the returned string back into lines. Much faster than one call per cue.
 */
const Translator = (() => {
  const ENDPOINT = 'https://translate.googleapis.com/translate_a/single';

  // Keep requests modest to avoid timeouts on mobile networks.
  const BATCH_LINES = 40;
  const MAX_CHARS_PER_REQUEST = 3500;
  const DELAY_MS = 250;         // polite spacing between batches
  const MAX_ATTEMPTS = 4;       // retries per chunk

  // Sentinel protecting internal line breaks inside a cue so cue boundaries
  // (joined with "\n") stay unambiguous after translation. Contains no regex
  // metacharacters and is used with a literal split/join.
  const NL_SENTINEL = '§§';

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const restoreNewlines = (s) => s.split(NL_SENTINEL).join('\n');

  /**
   * Translate an array of strings.
   * @param {string[]} lines source lines
   * @param {string} srcLang source lang code ('auto' allowed)
   * @param {string} tgtLang target lang code
   * @param {(progress:number)=>void} [onProgress] 0..1
   * @returns {Promise<string[]>} translated lines (same length)
   */
  async function translateLines(lines, srcLang, tgtLang, onProgress) {
    const results = new Array(lines.length).fill('');
    const batches = buildBatches(lines);
    const total = batches.length || 1;

    for (let b = 0; b < batches.length; b++) {
      const batch = batches[b];
      const query = batch.map((o) => o.text).join('\n');

      try {
        const translated = await translateChunk(query, srcLang, tgtLang);
        splitTranslated(translated, batch.length).forEach((part, k) => {
          results[batch[k].index] = restoreNewlines(part);
        });
      } catch {
        // Batch failed — fall back to one request per line.
        for (const o of batch) {
          try { results[o.index] = restoreNewlines(await translateChunk(o.text, srcLang, tgtLang)); }
          catch { results[o.index] = o.text; }
        }
      }

      if (onProgress) onProgress((b + 1) / total);
      if (b < batches.length - 1) await sleep(DELAY_MS);
    }

    if (onProgress) onProgress(1);
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
      current.push({ index, text: text.replace(/\r?\n/g, NL_SENTINEL) });
      chars += text.length;
    });

    if (current.length) batches.push(current);
    return batches;
  }

  /** Translate one chunk, retrying with exponential backoff. */
  async function translateChunk(text, srcLang, tgtLang) {
    const params = new URLSearchParams({ client: 'gtx', sl: srcLang, tl: tgtLang, dt: 't', q: text });
    const url = `${ENDPOINT}?${params.toString()}`;
    let lastErr;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const out = data[0].map((seg) => seg[0]).join('');
        if (out) return out;
        throw new Error('Empty response');
      } catch (err) {
        lastErr = err;
        if (attempt < MAX_ATTEMPTS - 1) await sleep(600 * 2 ** attempt + Math.random() * 400);
      }
    }
    throw lastErr;
  }

  /**
   * Reconstruct per-line results from a batch response. Google usually keeps
   * our "\n" separators; if it merges lines we align by padding the tail.
   */
  function splitTranslated(translated, expectedCount) {
    const parts = translated.split('\n').slice(0, expectedCount).map((s) => s.trim());
    while (parts.length < expectedCount) parts.push('');
    return parts;
  }

  return { translateLines };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Translator;
