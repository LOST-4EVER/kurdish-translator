/**
 * parser.js — Parse and serialize subtitle files.
 * Supported formats: SRT, VTT, ASS, SSA, SUB (MicroDVD), SMI (SAMI).
 * Client-side only. No dependencies.
 *
 * Cue model: { index, start (ms), end (ms), text }
 */
const SubParser = (() => {
  // ---------- Regex ----------
  const TIMECODE = /(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})/;
  const ASS_TIMECODE = /(\d+:\d{2}:\d{2}\.\d{2})/;
  const SUB_LINE = /^\{(\d+)\}\{(\d+)\}(.*)$/;
  const SMI_SYNC = /<SYNC[^>]*?\bStart\s*=\s*"?(\d+)"?[^>]*>(.*?)<\/SYNC>/gi;

  // ---------- Time helpers ----------
  const pad = (n, len = 2) => String(n).padStart(len, '0');

  function splitMs(ms) {
    return {
      h: Math.floor(ms / 3600000),
      m: Math.floor((ms % 3600000) / 60000),
      s: Math.floor((ms % 60000) / 1000),
      ms: ms % 1000,
    };
  }

  function toMs(str) {
    const [time, fracRaw = '0'] = str.replace(',', '.').split('.');
    const frac = Number(fracRaw.padEnd(3, '0').slice(0, 3));
    const [h, m, s] = time.split(':').map(Number);
    return h * 3600000 + m * 60000 + s * 1000 + frac;
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
    if (/\[Events\]/i.test(t) && /^Dialogue:/m.test(t)) {
      return /ScriptType[^\n]*v4\.00\+/i.test(t) ? 'ass' : 'ssa';
    }
    if (/^\{\d+\}\{\d+\}/m.test(t)) return 'sub';
    if (/<sync[ >]/i.test(t)) return 'smi';
    if (TIMECODE.test(t)) return 'srt';
    return 'unknown';
  }

  // ---------- SRT / VTT ----------
  function parseSRTVTT(content, isVtt) {
    const cues = [];
    const blocks = content.replace(/\r/g, '').split(/\n{2,}/);
    for (const block of blocks) {
      const lines = block.split('\n').filter((l) => l.trim() !== '');
      const timeIdx = lines.findIndex((l) => TIMECODE.test(l));
      const match = timeIdx >= 0 ? lines[timeIdx].match(TIMECODE) : null;
      if (!match) continue;

      const text = lines.slice(timeIdx + 1)
        .join('\n')
        .replace(/^NOTE[^\n]*\n?/, '')
        .trim();
      if (!text) continue;

      cues.push({
        index: cues.length + 1,
        start: toMs(match[1]),
        end: toMs(match[2]),
        text,
      });
    }
    return cues;
  }

  // ---------- ASS / SSA ----------
  function parseASS(content) {
    const header = [];
    const fields = [];
    const cues = [];
    let inEvents = false;

    for (const line of content.replace(/\r/g, '').split('\n')) {
      if (/^\s*\[Events\]\s*$/i.test(line)) { inEvents = true; header.push(line); continue; }
      if (/^\s*\[[^\]]+\]\s*$/.test(line)) { inEvents = false; header.push(line); continue; }

      if (!inEvents) { header.push(line); continue; }

      const fm = line.match(/^\s*Format\s*:\s*(.*)$/i);
      if (fm) { fields.push(...fm[1].split(',').map((s) => s.trim())); header.push(line); continue; }

      const dm = line.match(/^\s*Dialogue\s*:\s*(.*)$/i);
      if (dm) {
        const parts = splitAss(dm[1]);
        const map = {};
        fields.forEach((f, i) => { map[f.toLowerCase()] = parts[i] ?? ''; });
        const t0 = (map.start || '').match(ASS_TIMECODE);
        const t1 = (map.end || '').match(ASS_TIMECODE);
        const text = (map.text || '').trim();
        if (!t0 || !t1 || !text) continue;
        cues.push({ index: cues.length + 1, start: assToMs(t0[1]), end: assToMs(t1[1]), text });
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
      const text = m && m[3].trim();
      if (!text) continue;
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
  function parseSMI(content) {
    const cues = [];
    let prev = -1;
    let m;
    while ((m = SMI_SYNC.exec(content)) !== null) {
      const start = Number(m[1]);
      const text = m[2]
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!text) continue;
      if (prev >= 0) cues[prev].end = start;
      cues.push({ start, end: 0, text });
      prev = cues.length - 1;
    }
    if (prev >= 0 && cues[prev].end === 0) cues[prev].end = cues[prev].start + 3000;
    cues.forEach((c, i) => { c.index = i + 1; });
    return cues;
  }

  // ---------- Main parse ----------
  function parse(content) {
    const format = detect(content);
    switch (format) {
      case 'vtt': return { format, cues: parseSRTVTT(content, true) };
      case 'srt': return { format, cues: parseSRTVTT(content, false) };
      case 'ass':
      case 'ssa': {
        const { cues, meta } = parseASS(content);
        return { format, cues, meta };
      }
      case 'sub': {
        const { cues, meta } = parseSUB(content);
        return { format, cues, meta };
      }
      case 'smi': return { format, cues: parseSMI(content) };
      default: throw new Error('Unsupported subtitle format');
    }
  }

  // ---------- Serialize ----------
  const ASS_DEFAULT_ORDER = ['Layer', 'Start', 'End', 'Style', 'Name', 'MarginL', 'MarginR', 'MarginV', 'Effect', 'Text'];
  const ASS_FALLBACKS = { layer: '0', style: 'Default', name: '', marginl: '0', marginr: '0', marginv: '0', effect: '' };

  function serialize(parsed, cues) {
    switch (parsed.format) {
      case 'vtt':
        return 'WEBVTT\n\n' + cues.map((c) => `${fmtVTT(c.start)} --> ${fmtVTT(c.end)}\n${c.text}`).join('\n\n') + '\n';
      case 'srt':
        return cues.map((c) => `${c.index}\n${fmtSRT(c.start)} --> ${fmtSRT(c.end)}\n${c.text}`).join('\n\n') + '\n';
      case 'ass':
      case 'ssa':
        return serializeASS(parsed, cues);
      case 'sub': {
        const fps = (parsed.meta && parsed.meta.fps) || 23.976;
        const frame = (ms) => Math.round((ms / 1000) * fps);
        const body = cues.map((c) => `{${frame(c.start)}}{${frame(c.end)}}${c.text}`).join('\n');
        return `{1}{1}${fps.toFixed(3)}\n${body}\n`;
      }
      case 'smi':
        return '<SAMI>\n<HEAD><TITLE>Kurdish subtitles</TITLE></HEAD>\n<BODY>\n' +
          cues.map((c) => `<SYNC Start=${c.start}><P class=KURD>${escapeXml(c.text)}</P></SYNC>`).join('\n') +
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

    const cleanHeader = (meta.header || []).filter((l) => !/^\s*Dialogue\s*:/i.test(l)).join('\n');
    const fmtLine = `Format: ${order.join(', ')}`;
    const header = cleanHeader.trim()
      ? cleanHeader.replace(/Format:[^\n]*/i, fmtLine).replace(/\n{3,}/g, '\n\n')
      : fmtLine;

    const lines = [header];
    for (const c of cues) {
      const val = {};
      order.forEach((f) => { val[f] = ASS_FALLBACKS[f.toLowerCase()] ?? ''; });
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

  return { parse, serialize };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = SubParser;
