/**
 * translator.js — Batch translation engine using Google Translate's free
 * web endpoint (no API key, no backend). Works on GitHub Pages.
 *
 * Batching: we send many subtitle lines joined by "\n" in a single request,
 * then split the returned array back into lines. This is far faster and
 * cheaper than one request per cue.
 */
const Translator = (() => {
  const ENDPOINT = 'https://translate.googleapis.com/translate_a/single';

  // Keep requests modest to avoid timeouts on mobile networks.
  const BATCH_LINES = 40;
  const MAX_CHARS_PER_REQUEST = 3500;
  const DELAY_MS = 250; // polite spacing between batches

  // Sentinel used to protect internal line breaks inside a cue so that cue
  // boundaries (joined with "\n") stay unambiguous after translation.
  // Chosen to contain no regex metacharacters; used with literal replaceAll.
  const NL_SENTINEL = '§§';

  /**
   * Translate an array of strings.
   * @param {string[]} lines source lines
   * @param {string} srcLang source lang code ('auto' allowed)
   * @param {string} tgtLang target lang code
   * @param {function(progress:number):void} [onProgress]
   * @returns {Promise<string[]>} translated lines (same length)
   */
  async function translateLines(lines, srcLang, tgtLang, onProgress) {
    const results = new Array(lines.length).fill('');
    const indexes = lines.map((l, i) => ({ text: l, i }))
      .filter((o) => o.text.trim() !== '')
      .map((o) => ({ ...o, text: o.text.replace(/\r?\n/g, NL_SENTINEL) }));

    const batches = [];
    let current = { items: [], chars: 0 };
    for (const item of indexes) {
      if (current.items.length >= BATCH_LINES || current.chars + item.text.length > MAX_CHARS_PER_REQUEST) {
        if (current.items.length) batches.push(current);
        current = { items: [], chars: 0 };
      }
      current.items.push(item);
      current.chars += item.text.length;
    }
    if (current.items.length) batches.push(current);

    let done = 0;
    const total = batches.length || 1;

    for (let b = 0; b < batches.length; b++) {
      const batch = batches[b];
      const query = batch.items.map((o) => o.text).join('\n');
      try {
        const translated = await translateChunk(query, srcLang, tgtLang);
        const parts = splitTranslated(translated, batch.items.length);
        batch.items.forEach((o, k) => { results[o.i] = parts[k].split(NL_SENTINEL).join('\n'); });
      } catch (err) {
        // Fallback: translate each line individually on batch failure.
        for (let k = 0; k < batch.items.length; k++) {
          const o = batch.items[k];
          try { results[o.i] = (await translateChunk(o.text, srcLang, tgtLang)).split(NL_SENTINEL).join('\n'); }
          catch { results[o.i] = o.text.split(NL_SENTINEL).join('\n'); }
        }
      }
      done++;
      if (onProgress) onProgress(done / total);
      if (b < batches.length - 1) await sleep(DELAY_MS);
    }

    if (onProgress) onProgress(1);
    return results;
  }

  async function translateChunk(text, srcLang, tgtLang) {
    const params = new URLSearchParams({
      client: 'gtx',
      sl: srcLang,
      tl: tgtLang,
      dt: 't',
      q: text,
    });
    // Retry with exponential backoff to ride out transient errors/rate limits.
    const MAX_ATTEMPTS = 4;
    let lastErr;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const out = data[0].map((seg) => seg[0]).join('');
        if (out) return out;
        throw new Error('Empty response');
      } catch (err) {
        lastErr = err;
        if (attempt < MAX_ATTEMPTS - 1) await sleep(600 * Math.pow(2, attempt) + Math.random() * 400);
      }
    }
    throw lastErr;
  }

  /**
   * The endpoint joins our "\n" separated lines and returns them as segments.
   * Reconstruct them. If we can't match, fall back to treating newlines as separators.
   */
  function splitTranslated(translated, expectedCount) {
    const byNewline = translated.split('\n');
    if (byNewline.length >= expectedCount) {
      // Trim but preserve emptiness for the tail.
      const trimmed = byNewline.slice(0, expectedCount).map((s) => s.trim());
      while (trimmed.length < expectedCount) trimmed.push('');
      return trimmed;
    }
    // Sometimes Google merges — do our best to pad/align.
    const parts = translated.split('\n');
    while (parts.length < expectedCount) parts.push('');
    return parts;
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  return { translateLines };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Translator;
