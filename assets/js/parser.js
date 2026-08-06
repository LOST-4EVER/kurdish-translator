/**
 * parser.js — Parse and serialize subtitle files.
 * Supported formats: SRT, VTT, ASS, SSA, SUB (MicroDVD), SMI (SAMI).
 * Works entirely client-side. No external dependencies.
 *
 * Cue model: { index, start (ms), end (ms), text, raw }
 */
const SubParser = (() => {
  // ---------- SRT / VTT ----------
  const TC = /(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})/;

  // ---------- ASS timestamp h:mm:ss.cc ----------
  const ASS_TC = /(\d+:\d{2}:\d{2}\.\d{2})/;

  // ---------- MicroDVD ----------
  const SUB_LINE = /^\{(\d+)\}\{(\d+)\}(.*)$/;

  function toMs(str) {
    let t = str.replace(',', '.');
    const parts = t.split('.');
    let ms = parts.length > 1 ? parts.pop() : '0';
    ms = ms.padEnd(3, '0').slice(0, 3);
    const hms = parts[0].split(':').map(Number);
    while (hms.length < 3) hms.unshift(0);
    return hms[0] * 3600000 + hms[1] * 60000 + hms[2] * 1000 + Number(ms);
  }

  const pad = (n, len = 2) => String(n).padStart(len, '0');

  function fmtSRT(ms) {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const mi = ms % 1000;
    return `${pad(h)}:${pad(m)}:${pad(s)},${pad(mi, 3)}`;
  }
  function fmtVTT(ms) {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const mi = ms % 1000;
    return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(mi, 3)}`;
  }
  function fmtASS(ms) {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const cs = Math.floor((ms % 1000) / 10);
    return `${h}:${pad(m)}:${pad(s)}.${pad(cs, 2)}`;
  }

  // ---------- Format detection ----------
  function detect(content) {
    const t = content.trim();
    if (/^WEBVTT/i.test(t)) return 'vtt';
    if (/\[Events\]/i.test(t) && /^Dialogue:/m.test(t)) return /^ScriptType[^\n]*:?\s*v4\.00\+/im.test(t) ? 'ass' : 'ssa';
    if (/^\{\d+\}\{\d+\}/m.test(t)) return 'sub';
    if (/<sync[ >]/i.test(t)) return 'smi';
    if (TC.test(t)) return 'srt';
    return 'unknown';
  }

  // ---------- SRT / VTT ----------
  function parseSRTVTT(content, isVtt) {
    const cues = [];
    const blocks = content.replace(/\r/g, '').split(/\n{2,}/);
    let idx = 0;
    for (const block of blocks) {
      const lines = block.split('\n').filter((l) => l.trim() !== '');
      if (!lines.length) continue;
      let ti = -1, m = null;
      for (let i = 0; i < lines.length; i++) {
        const mm = lines[i].match(TC);
        if (mm) { ti = i; m = mm; break; }
      }
      if (!m) continue;
      const start = toMs(m[1]);
      const end = toMs(m[2]);
      let text = lines.slice(ti + 1).join('\n').trim();
      // drop VTT header-ish lines
      if (isVtt) {
        const first = lines[0];
        if (/^WEBVTT/i.test(first) || /^NOTE\b/i.test(first)) continue;
      }
      text = text.replace(/^NOTE[^\n]*\n?/, '');
      if (!text) continue;
      idx++;
      cues.push({ index: idx, start, end, text, raw: text });
    }
    return cues;
  }

  // ---------- ASS / SSA ----------
  function parseASS(content) {
    const rawLines = content.replace(/\r/g, '').split('\n');
    const isSsa = !/v4\.00\+/i.test(content);
    const header = [];
    const fmt = [];
    const cues = [];
    let idx = 0;
    let inEvents = false;

    for (const line of rawLines) {
      if (/^\s*\[Events\]\s*$/i.test(line)) { inEvents = true; header.push(line); continue; }
      if (/^\s*\[[^\]]+\]\s*$/.test(line)) { inEvents = false; header.push(line); continue; }
      if (inEvents) {
        const fm = line.match(/^\s*Format\s*:\s*(.*)$/i);
        if (fm) {
          fmt.push(...fm[1].split(',').map((s) => s.trim()));
          header.push(line);
          continue;
        }
        const dm = line.match(/^\s*Dialogue\s*:\s*(.*)$/i);
        if (dm) {
          const fields = splitAss(dm[1]);
          const map = {};
          fmt.forEach((f, i) => { map[f.toLowerCase()] = fields[i] !== undefined ? fields[i] : ''; });
          const text = map.text || '';
          const t0 = (map.start || '').match(ASS_TC);
          const t1 = (map.end || '').match(ASS_TC);
          if (!t0 || !t1) continue;
          const start = assToMs(t0[1]);
          const end = assToMs(t1[1]);
          if (!text.trim()) continue;
          idx++;
          cues.push({ index: idx, start, end, text, raw: text });
          continue;
        }
        header.push(line); // stray event lines like Comment:
      } else {
        header.push(line);
      }
    }

    return { cues, meta: { header, fmt, isSsa } };
  }

  // Split an ASS Dialogue payload on commas, but keep commas inside {...} tags and \N intact.
  function splitAss(str) {
    const out = [];
    let cur = '';
    let depth = 0;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === '{') depth++;
      if (ch === '}') depth = Math.max(0, depth - 1);
      if (ch === ',' && depth === 0) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  }

  function assToMs(str) {
    const [h, m, rest] = str.split(':');
    const [s, cs] = rest.split('.');
    return Number(h) * 3600000 + Number(m) * 60000 + Number(s) * 1000 + Number(cs) * 10;
  }

  // ---------- MicroDVD SUB ----------
  function parseSUB(content) {
    const lines = content.replace(/\r/g, '').split('\n');
    let fps = 23.976;
    const startLine = lines[0] && lines[0].trim();
    if (startLine && /^\{\d+\}\{\d+\}\s*(\d+(\.\d+)?)\s*$/.test(startLine)) {
      const fm = startLine.match(/(\d+(\.\d+)?)\s*$/);
      if (fm && Number(fm[1]) > 0) fps = Number(fm[1]);
      lines.shift();
    }
    const cues = [];
    let idx = 0;
    for (const line of lines) {
      const m = line.match(SUB_LINE);
      if (!m) continue;
      const text = m[3].trim();
      if (!text) continue;
      const startFrame = Number(m[1]);
      const endFrame = Number(m[2]);
      idx++;
      cues.push({
        index: idx,
        start: Math.round(startFrame / fps * 1000),
        end: Math.round(endFrame / fps * 1000),
        text, raw: text,
      });
    }
    return { cues, meta: { fps } };
  }

  // ---------- SAMI SMI ----------
  function parseSMI(content) {
    const cues = [];
    const syncs = content.replace(/\r/g, '');
    const re = /<SYNC[^>]*?\bStart\s*=\s*"?(\d+)"?[^>]*>(.*?)<\/SYNC>/gi;
    let m, prev = null;
    while ((m = re.exec(syncs)) !== null) {
      const start = Number(m[1]);
      let text = m[2].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const end = 0;
      cues.push({ start, end, text, raw: text, _order: cues.length });
      if (prev !== null) { cues[prev].end = start; }
      prev = cues.length - 1;
    }
    if (prev !== null && cues[prev].end === 0) cues[prev].end = cues[prev].start + 3000;
    cues.forEach((c, i) => { c.index = i + 1; });
    return cues;
  }

  // ---------- Main parse ----------
  function parse(content) {
    const format = detect(content);
    if (format === 'vtt') return { format, cues: parseSRTVTT(content, true) };
    if (format === 'srt') return { format, cues: parseSRTVTT(content, false) };
    if (format === 'ass' || format === 'ssa') {
      const { cues, meta } = parseASS(content);
      return { format, cues, meta };
    }
    if (format === 'sub') {
      const { cues, meta } = parseSUB(content);
      return { format, cues, meta };
    }
    if (format === 'smi') {
      return { format, cues: parseSMI(content) };
    }
    throw new Error('Unsupported subtitle format');
  }

  // ---------- Serialize ----------
  function serialize(parsed, cues) {
    const fmt = parsed.format;
    if (fmt === 'vtt') {
      let out = 'WEBVTT\n\n';
      for (const c of cues) out += `${fmtVTT(c.start)} --> ${fmtVTT(c.end)}\n${c.text}\n\n`;
      return out.trimEnd() + '\n';
    }
    if (fmt === 'srt') {
      let out = '';
      for (const c of cues) out += `${c.index}\n${fmtSRT(c.start)} --> ${fmtSRT(c.end)}\n${c.text}\n\n`;
      return out.trimEnd() + '\n';
    }
    if (fmt === 'ass' || fmt === 'ssa') {
      const meta = parsed.meta || { header: [], fmt: [], isSsa: fmt === 'ssa' };
      const header = meta.header || [];
      const clean = header.filter((l) => !/^\s*Dialogue\s*:/i.test(l));
      const order = (meta.fmt && meta.fmt.length)
        ? meta.fmt
        : ['Layer', 'Start', 'End', 'Style', 'Name', 'MarginL', 'MarginR', 'MarginV', 'Effect', 'Text'];
      const fmtLine = `Format: ${order.join(', ')}`;
      const lower = order.map((f) => f.toLowerCase());
      let out = clean.join('\n').replace(/^\s*$/mg, '') + '\n';
      out = out.replace(/Format:\s*[^\n]*/i, fmtLine).replace(/\n{3,}/g, '\n\n');
      const fallbacks = { layer: '0', style: 'Default', name: '', marginl: '0', marginr: '0', marginv: '0', effect: '' };
      for (const c of cues) {
        const val = {};
        order.forEach((f) => { val[f] = fallbacks[f.toLowerCase()] !== undefined ? fallbacks[f.toLowerCase()] : ''; });
        val['Start'] = fmtASS(c.start);
        val['End'] = fmtASS(c.end);
        val['Text'] = c.text.replace(/\n/g, '\\N');
        const keyOf = (k) => order[lower.indexOf(k)];
        val[keyOf('start')] = fmtASS(c.start);
        val[keyOf('end')] = fmtASS(c.end);
        val[keyOf('text')] = c.text.replace(/\n/g, '\\N');
        const parts = order.map((f) => val[f]);
        out += `Dialogue: ${parts.join(',')}\n`;
      }
      return out.trimEnd() + '\n';
    }
    if (fmt === 'sub') {
      const fps = (parsed.meta && parsed.meta.fps) || 23.976;
      const sf = (ms) => Math.round(ms / 1000 * fps);
      let out = `{1}{1}${fps.toFixed(3)}\n`;
      for (const c of cues) out += `{${sf(c.start)}}{${sf(c.end)}}${c.text}\n`;
      return out.trimEnd() + '\n';
    }
    if (fmt === 'smi') {
      let out = '<SAMI>\n<HEAD><TITLE>Kurdish subtitles</TITLE></HEAD>\n<BODY>\n';
      for (const c of cues) {
        out += `<SYNC Start=${c.start}><P class=KURD>${escapeSmi(c.text)}</P></SYNC>\n`;
      }
      out += '</BODY>\n</SAMI>\n';
      return out;
    }
    throw new Error('Unsupported format for serialization');
  }

  function escapeSmi(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return { parse, serialize };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = SubParser;
