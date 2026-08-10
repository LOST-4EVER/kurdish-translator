/**
 * parser.js — Parse and serialize subtitle files.
 * Supported formats: SRT, VTT, ASS, SSA, SUB (MicroDVD), SMI (SAMI).
 * Client-side only. No dependencies.
 *
 * Cue model: { index, start (ms), end (ms), text }
 */
const SubParser = (() => {
  // ---------- Regex ----------
  // WebVTT allows both mm:ss.mmm and hh:mm:ss.mmm (hours optional).
  const TIMECODE = /(\d{1,2}:\d{2}(?::\d{2})?[,.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}(?::\d{2})?[,.]\d{1,3})/;
  const ASS_TIMECODE = /(\d+:\d{2}:\d{2}\.\d{2})/;
  const SUB_LINE = /^\{(\d+)\}\{(\d+)\}(.*)$/;

  // ---------- Time helpers ----------
  const pad = (n, len = 2) => String(n).padStart(len, '0');

  function splitMs(ms) {
    const val = Math.max(0, ms);
    return {
      h: Math.floor(val / 3600000),
      m: Math.floor((val % 3600000) / 60000),
      s: Math.floor((val % 60000) / 1000),
      ms: val % 1000,
    };
  }

  // ⚡ Bolt: Highly-optimized toMs to avoid array allocation, string splitting, and regex.
  function toMs(str) {
    let dotIdx = str.indexOf('.');
    if (dotIdx === -1) dotIdx = str.indexOf(',');

    let timePart = str;
    let frac = 0;
    if (dotIdx !== -1) {
      timePart = str.substring(0, dotIdx);
      const fracPart = str.substring(dotIdx + 1);
      const len = fracPart.length;
      if (len === 3) {
        frac = parseInt(fracPart, 10);
      } else if (len === 2) {
        frac = parseInt(fracPart, 10) * 10;
      } else if (len === 1) {
        frac = parseInt(fracPart, 10) * 100;
      } else if (len > 3) {
        frac = parseInt(fracPart.substring(0, 3), 10);
      }
    }

    const firstColon = timePart.indexOf(':');
    const secondColon = timePart.indexOf(':', firstColon + 1);

    if (secondColon === -1) {
      const m = parseInt(timePart.substring(0, firstColon), 10);
      const s = parseInt(timePart.substring(firstColon + 1), 10);
      return m * 60000 + s * 1000 + frac;
    } else {
      const h = parseInt(timePart.substring(0, firstColon), 10);
      const m = parseInt(timePart.substring(firstColon + 1, secondColon), 10);
      const s = parseInt(timePart.substring(secondColon + 1), 10);
      return h * 3600000 + m * 60000 + s * 1000 + frac;
    }
  }

  function fmtSRT(ms) {
    const t = splitMs(ms);
    return `${pad(t.h)}:${pad(t.m)}:${pad(t.s)},${pad(t.ms, 3)}`;
  }
  function fmtVTT(ms) {
    const t = splitMs(ms);
    return `${pad(t.h)}:${pad(t.m)}:${pad(t.s)}.${pad(t.ms, 3)}`;
  }
  function fmtASS(ms) {
    const t = splitMs(ms);
    return `${t.h}:${pad(t.m)}:${pad(t.s)}.${pad(Math.floor(t.ms / 10), 2)}`;
  }
  function assToMs(str) {
    const [h, m, rest] = str.split(':');
    const [s, cs] = rest.split('.');
    return Number(h) * 3600000 + Number(m) * 60000 + Number(s) * 1000 + Number(cs) * 10;
  }

  // ---------- Format detection ----------
  function detect(content) {
    const t = content.trim();
    if (/^WEBVTT/i.test(t)) return 'vtt';
    // ASS/SSA files always carry a [Script Info] section; requiring it avoids
    // misdetecting dialogue inside other formats that mentions [Events].
    if (/\[Script Info\]/i.test(t) && /\[Events\]/i.test(t) && /^\s*Dialogue\s*:/m.test(t)) {
      return /ScriptType[^\n]*v4\.00\+/i.test(t) ? 'ass' : 'ssa';
    }
    // MicroDVD files start with a frame pair on their very first line (either
    // the fps header "{1}{1}23.976" or the first cue).
    if (/^\{\d+\}\{\d+\}/.test(t.split('\n')[0])) return 'sub';
    if (/<SYNC\b[^>]*\bStart\s*=/i.test(t)) return 'smi';
    if (TIMECODE.test(t)) return 'srt';
    return 'unknown';
  }

  // ---------- SRT / VTT ----------
  // Line-based parser: works whether or not cues are separated by blank lines,
  // and ignores the WEBVTT header, cue identifiers/indexes and NOTE comments.
  // A timing line must START with a timecode so subtitle text that merely
  // mentions a time range isn't mistaken for a new cue; a VTT trailer
  // ("align:start position:0%") is allowed after the arrow.
  const TIMECODE_LINE = /^(\d{1,2}:\d{2}(?::\d{2})?[,.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}(?::\d{2})?[,.]\d{1,3})(?:\s+.*)?$/;
  function parseSRTVTT(content) {
    const lines = content.replace(/\r/g, '').split('\n');
    const cues = [];
    let current = null;
    let inNote = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // NOTE blocks end at the first blank line and are never subtitle text,
      // even when a comment contains a timecode.
      if (inNote) { if (!line) inNote = false; continue; }
      const m = line.match(TIMECODE_LINE);
      if (m) {
        if (current) cues.push(current);
        current = { start: toMs(m[1]), end: toMs(m[2]), text: [] };
        continue;
      }
      if (/^NOTE\b/i.test(line)) { inNote = true; continue; }
      if (!current || !line) continue;
      // A line immediately followed by a timing line is a cue identifier/index.
      const next = lines[i + 1];
      if (next && TIMECODE_LINE.test(next.trim())) continue;
      // In blank-line-separated SRT the index ("1") is alone on its line, with
      // the blank cue separator between it and the timing line. Skip those too.
      const after = lines[i + 2];
      if (!next && /^\d+$/.test(line) && after && TIMECODE_LINE.test(after.trim())) continue;
      current.text.push(line);
    }
    if (current) cues.push(current);

    const out = [];
    for (const c of cues) {
      const text = c.text.join('\n').trim();
      if (text) out.push({ index: out.length + 1, start: c.start, end: c.end, text });
    }
    return out;
  }

  // ---------- ASS / SSA ----------
  function parseASS(content) {
    const header = [];
    // Fall back to the standard field order when a file omits the Format line.
    let fields = ASS_DEFAULT_ORDER.slice();
    const cues = [];
    let inEvents = false;

    for (const line of content.replace(/\r/g, '').split('\n')) {
      // Blank lines separate sections (and the file's trailing newline leaves
      // one); keep them out of the header so serialization round-trips cleanly.
      if (!line.trim()) continue;
      if (/^\s*\[Events\]\s*$/i.test(line)) { inEvents = true; header.push(line); continue; }
      if (/^\s*\[[^\]]+\]\s*$/.test(line)) { inEvents = false; header.push(line); continue; }

      if (!inEvents) { header.push(line); continue; }

      const fm = line.match(/^\s*Format\s*:\s*(.*)$/i);
      if (fm) { fields = fm[1].split(',').map((s) => s.trim()); header.push(line); continue; }

      const dm = line.match(/^\s*Dialogue\s*:\s*(.*)$/i);
      if (dm) {
        const parts = splitAss(dm[1]);
        const map = {};
        // The Text field is last and may itself contain commas. If splitting
        // produced more parts than fields, fold the extras back into Text.
        const textField = fields.findIndex((f) => f.toLowerCase() === 'text');
        if (parts.length > fields.length && textField >= 0) {
          parts[textField] = parts.slice(textField).join(',');
          parts.length = fields.length;
        }
        fields.forEach((f, i) => { map[f.toLowerCase()] = parts[i] ?? ''; });
        const t0 = (map.start || '').match(ASS_TIMECODE);
        const t1 = (map.end || '').match(ASS_TIMECODE);
        const text = (map.text || '').trim();
        if (!t0 || !t1 || !text) continue;
        // Keep the original per-cue field values (Style, Layer, margins…) so
        // serialization can round-trip them instead of resetting to defaults.
        const extra = {};
        fields.forEach((f, i) => { if (f.toLowerCase() !== 'text') extra[f] = parts[i] ?? ''; });
        cues.push({ index: cues.length + 1, start: assToMs(t0[1]), end: assToMs(t1[1]), text, extra });
        continue;
      }

      header.push(line); // stray event lines (Comment: etc.)
    }

    return { cues, meta: { header, fields } };
  }

  // Split ASS Dialogue payload on commas, keeping commas inside {...} and \N intact.
  function splitAss(str) {
    const out = [];
    let cur = '';
    let depth = 0;
    for (const ch of str) {
      if (ch === '{') depth++;
      if (ch === '}') depth = Math.max(0, depth - 1);
      if (ch === ',' && depth === 0) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  }

  // ---------- MicroDVD SUB ----------
  function parseSUB(content) {
    const lines = content.replace(/\r/g, '').split('\n');
    let fps = 23.976;
    const first = lines[0] && lines[0].trim();
    const fpsMatch = first && first.match(/^\{\d+\}\{\d+\}\s*(\d+(?:\.\d+)?)\s*$/);
    if (fpsMatch && Number(fpsMatch[1]) > 0) {
      fps = Number(fpsMatch[1]);
      lines.shift();
    }

    const cues = [];
    for (const line of lines) {
      const m = line.match(SUB_LINE);
      let text = m && m[3].trim();
      if (!text) continue;
      // Pipe '|' is MicroDVD's line-break marker; keep control codes {...} as-is.
      text = text.replace(/\|/g, '\n');
      cues.push({
        index: cues.length + 1,
        start: Math.round((Number(m[1]) / fps) * 1000),
        end: Math.round((Number(m[2]) / fps) * 1000),
        text,
      });
    }
    return { cues, meta: { fps } };
  }

  // ---------- SAMI SMI ----------
  // A <SYNC Start=...> block runs until the next <SYNC> (or </BODY>/EOF);
  // many real SAMI files omit </SYNC> tags, so we must not rely on them.
  const SMI_BLOCK = /<SYNC\b[^>]*?\bStart\s*=\s*"?(\d+)"?[^>]*>([\s\S]*?)(?=<SYNC\b|<\/BODY>|$)/gi;

  // Extract the text of each <P> paragraph in a SYNC block, decoding HTML.
  // Only the first non-empty paragraph is needed (single-language files have
  // one <P>; bilingual ones repeat the same text), so stop as soon as we have it.
  function samiParagraphs(content) {
    const blocks = content.split(/<P\b[^>]*>/i);
    for (let i = 0; i < blocks.length; i++) {
      const text = blocks[i]
        .replace(/<\/P\s*>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/[ \t]+/g, ' ')
        .replace(/ +\n/g, '\n')
        .replace(/\n[ \t]*\n+/g, '\n')
        .trim();
      if (text) return [text];
    }
    return [];
  }

  function parseSMI(content) {
    const cues = [];
    let prev = -1;
    let m;
    while ((m = SMI_BLOCK.exec(content)) !== null) {
      const start = Number(m[1]);
      // First non-empty paragraph; a single-language file has exactly one <P>.
      const para = samiParagraphs(m[2])[0];
      if (!para) continue;
      if (prev >= 0) cues[prev].end = start;
      cues.push({ start, end: 0, text: para });
      prev = cues.length - 1;
    }
    if (prev >= 0 && cues[prev].end === 0) cues[prev].end = cues[prev].start + 3000;
    cues.forEach((c, i) => { c.index = i + 1; });
    return cues;
  }

  // ---------- Main parse ----------
  function parse(content) {
    const format = detect(content);
    let result;
    switch (format) {
      case 'vtt': result = { format, cues: parseSRTVTT(content) }; break;
      case 'srt': result = { format, cues: parseSRTVTT(content) }; break;
      case 'ass':
      case 'ssa': {
        const { cues, meta } = parseASS(content);
        result = { format, cues, meta };
        break;
      }
      case 'sub': {
        const { cues, meta } = parseSUB(content);
        result = { format, cues, meta };
        break;
      }
      case 'smi': result = { format, cues: parseSMI(content) }; break;
      default: throw new Error('Unsupported subtitle format');
    }
    if (result && Array.isArray(result.cues)) {
      result.cues.sort((a, b) => a.start - b.start);
      result.cues.forEach((cue, index) => {
        cue.index = index + 1;
      });
    }
    return result;
  }

  // ---------- Serialize ----------
  const ASS_DEFAULT_ORDER = ['Layer', 'Start', 'End', 'Style', 'Name', 'MarginL', 'MarginR', 'MarginV', 'Effect', 'Text'];
  const ASS_FALLBACKS = { layer: '0', style: 'Default', name: '', marginl: '0', marginr: '0', marginv: '0', effect: '' };

  function serialize(parsed, cues) {
    switch (parsed.format) {
      case 'vtt':
        return 'WEBVTT\n\n' + cues.map((c) => `${fmtVTT(c.start)} --> ${fmtVTT(c.end)}\n${c.text}`).join('\n\n') + '\n';
      case 'srt':
        return cues.map((c, i) => `${i + 1}\n${fmtSRT(c.start)} --> ${fmtSRT(c.end)}\n${c.text}`).join('\n\n') + '\n';
      case 'ass':
      case 'ssa':
        return serializeASS(parsed, cues);
      case 'sub': {
        const fps = (parsed.meta && parsed.meta.fps) || 23.976;
        const frame = (ms) => Math.round((ms / 1000) * fps);
        const body = cues.map((c) => `{${frame(c.start)}}{${frame(c.end)}}${c.text.replace(/\n/g, '|')}`).join('\n');
        return `{1}{1}${fps.toFixed(3)}\n${body}\n`;
      }
      case 'smi':
        return '<SAMI>\n<HEAD><TITLE>Kurdish subtitles</TITLE></HEAD>\n<BODY>\n' +
          cues.map((c) => `<SYNC Start=${c.start}><P class=KURD>${escapeXml(c.text).replace(/\n/g, '<br>')}</P></SYNC>`).join('\n') +
          '\n</BODY>\n</SAMI>\n';
      default:
        throw new Error('Unsupported format for serialization');
    }
  }

  function serializeASS(parsed, cues) {
    const meta = parsed.meta || {};
    const order = (meta.fields && meta.fields.length) ? meta.fields : ASS_DEFAULT_ORDER;
    const lower = order.map((f) => f.toLowerCase());
    const keyOf = (k) => order[lower.indexOf(k)];

    const cleanHeader = (meta.header || []).filter((l) => !/^\s*Dialogue\s*:/i.test(l));
    const fmtLine = `Format: ${order.join(', ')}`;
    // Place exactly one Format line, right after [Events] (replacing any old one).
    const evIdx = cleanHeader.findIndex((l) => /^\s*\[Events\]\s*$/i.test(l));
    let header;
    if (evIdx >= 0) {
      const before = cleanHeader.slice(0, evIdx + 1);
      const after = cleanHeader.slice(evIdx + 1).filter((l) => !/^\s*Format\s*:/i.test(l));
      header = [...before, fmtLine, ...after].join('\n');
    } else {
      header = cleanHeader.filter((l) => !/^\s*Format\s*:/i.test(l)).join('\n');
      header = header.trim() ? `${header}\n${fmtLine}` : fmtLine;
    }
    header = header.replace(/\n{3,}/g, '\n\n');

    const lines = [header];
    for (const c of cues) {
      const val = {};
      order.forEach((f) => { val[f] = (c.extra && c.extra[f]) ?? ASS_FALLBACKS[f.toLowerCase()] ?? ''; });
      val[keyOf('start')] = fmtASS(c.start);
      val[keyOf('end')] = fmtASS(c.end);
      val[keyOf('text')] = c.text.replace(/\n/g, '\\N');
      lines.push(`Dialogue: ${order.map((f) => val[f]).join(',')}`);
    }
    return lines.join('\n') + '\n';
  }

  function escapeXml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return { parse, serialize, fmtSRT, fmtVTT };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = SubParser;
