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
    if (!str) return 0;
    const cleanStr = str.trim();
    let dotIdx = cleanStr.indexOf('.');
    if (dotIdx === -1) dotIdx = cleanStr.indexOf(',');

    let timePart = cleanStr;
    let frac = 0;
    if (dotIdx !== -1) {
      timePart = cleanStr.substring(0, dotIdx);
      const fracPart = cleanStr.substring(dotIdx + 1);
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

    if (firstColon === -1) {
      return (parseInt(timePart, 10) || 0) * 1000 + frac;
    }

    if (secondColon === -1) {
      const m = parseInt(timePart.substring(0, firstColon), 10) || 0;
      const s = parseInt(timePart.substring(firstColon + 1), 10) || 0;
      return m * 60000 + s * 1000 + frac;
    } else {
      const h = parseInt(timePart.substring(0, firstColon), 10) || 0;
      const m = parseInt(timePart.substring(firstColon + 1, secondColon), 10) || 0;
      const s = parseInt(timePart.substring(secondColon + 1), 10) || 0;
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
    const cs = Math.min(99, Math.max(0, Math.floor(t.ms / 10)));
    return `${t.h}:${pad(t.m)}:${pad(t.s)}.${pad(cs, 2)}`;
  }
  function assToMs(str) {
    if (!str) return 0;
    const parts = str.trim().split(':');
    if (parts.length < 3) return 0;
    const h = Number(parts[0]) || 0;
    const m = Number(parts[1]) || 0;
    const [sStr, csStr] = parts[2].split('.');
    const s = Number(sStr) || 0;
    let csMs = 0;
    if (csStr) {
      const num = Number(csStr) || 0;
      if (csStr.length === 1) csMs = num * 100;
      else if (csStr.length === 2) csMs = num * 10;
      else csMs = Math.min(999, num);
    }
    return h * 3600000 + m * 60000 + s * 1000 + csMs;
  }

  // ---------- Format detection ----------
  function detect(content) {
    if (typeof content !== 'string') return 'unknown';
    const t = content.trim();
    if (!t) return 'unknown';
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
  // and ignores WEBVTT headers, cue identifiers/indexes, NOTE comments, STYLE and REGION blocks.
  // A timing line must START with a timecode so subtitle text that merely
  // mentions a time range isn't mistaken for a new cue; a VTT trailer
  // ("align:start position:0%") is allowed after the arrow.
  const TIMECODE_LINE = /^(\d+:\d{2}(?::\d{2})?[,.]\d{1,3})\s*-->\s*(\d+:\d{2}(?::\d{2})?[,.]\d{1,3})(?:\s+(.*))?$/;
  function parseSRTVTT(content) {
    const lines = content.replace(/\r/g, '').split('\n');
    const cues = [];
    let current = null;
    let inHeaderBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // NOTE, STYLE, and REGION blocks end at the first blank line and are never subtitle text
      if (inHeaderBlock) { if (!line) inHeaderBlock = false; continue; }
      const m = line.match(TIMECODE_LINE);
      if (m) {
        if (current) cues.push(current);
        const settings = m[3] ? m[3].trim() : '';
        current = { start: toMs(m[1]), end: toMs(m[2]), settings, text: [] };
        continue;
      }
      if (/^(?:NOTE|STYLE|REGION)\b/i.test(line)) { inHeaderBlock = true; continue; }
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
      if (text) out.push({ index: out.length + 1, start: c.start, end: c.end, settings: c.settings || '', text });
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
    SMI_BLOCK.lastIndex = 0;
    while ((m = SMI_BLOCK.exec(content)) !== null) {
      const start = Number(m[1]);
      if (prev >= 0) {
        cues[prev].end = start;
        prev = -1;
      }
      // First non-empty paragraph; a single-language file has exactly one <P>.
      const para = samiParagraphs(m[2])[0];
      if (!para) continue;
      cues.push({ start, end: 0, text: para });
      prev = cues.length - 1;
    }
    if (prev >= 0 && cues[prev].end === 0) cues[prev].end = cues[prev].start + 3000;
    cues.forEach((c, i) => { c.index = i + 1; });
    return cues;
  }

  // ---------- Main parse ----------
  function parseTXT(content) {
    const lines = content.replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
    const cues = [];
    let curTime = 0;
    lines.forEach((line, i) => {
      cues.push({
        index: i + 1,
        start: curTime,
        end: curTime + 3000,
        text: line
      });
      curTime += 3500;
    });
    return cues;
  }

  function parse(content, formatHint) {
    const raw = typeof content === 'string' ? content : (content != null ? String(content) : '');
    let format = detect(raw);
    if (format === 'unknown' && formatHint) {
      const h = formatHint.toLowerCase().replace(/^\./, '');
      if (['srt', 'vtt', 'ass', 'ssa', 'sub', 'smi', 'txt'].includes(h)) {
        format = h;
      }
    }
    if (format === 'unknown') {
      format = 'srt';
    }
    let result;
    switch (format) {
      case 'vtt': result = { format, cues: parseSRTVTT(raw) }; break;
      case 'srt': result = { format, cues: parseSRTVTT(raw) }; break;
      case 'ass':
      case 'ssa': {
        const { cues, meta } = parseASS(raw);
        result = { format, cues, meta };
        break;
      }
      case 'sub': {
        const { cues, meta } = parseSUB(raw);
        result = { format, cues, meta };
        break;
      }
      case 'smi': result = { format, cues: parseSMI(raw) }; break;
      case 'txt': result = { format, cues: parseTXT(raw) }; break;
      default: result = { format: 'srt', cues: [] }; break;
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

  const DEFAULT_ASS_HEADER = `[Script Info]
Title: Kurdish Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,2,2,10,10,10,1

[Events]`;

  const DEFAULT_SSA_HEADER = `[Script Info]
Title: Kurdish Subtitles
ScriptType: v4.00
WrapStyle: 0

[V4 Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, TertiaryColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, AlphaLevel, Encoding
Style: Default,Arial,20,16777215,65535,0,0,0,0,1,2,2,2,10,10,10,0,1

[Events]`;

  function normalizeTextForStandard(text, cleanTags = true) {
    if (!text) return '';
    let res = text.replace(/\\N/g, '\n').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (cleanTags) {
      // Convert basic ASS inline formatting tags to standard HTML tags
      res = res
        .replace(/\{\\i1\}/gi, '<i>').replace(/\{\\i0\}/gi, '</i>')
        .replace(/\{\\b1\}/gi, '<b>').replace(/\{\\b0\}/gi, '</b>')
        .replace(/\{\\u1\}/gi, '<u>').replace(/\{\\u0\}/gi, '</u>');
      // Strip remaining ASS control override tags (e.g. {\pos(...)}, {\an8}, {\c&H...&})
      res = res.replace(/\{[^{}]*\}/g, '');
    }
    return res;
  }

  function serialize(parsedOrFormat, cues) {
    let parsed = parsedOrFormat;
    let cueList = cues;
    if (Array.isArray(parsedOrFormat)) {
      cueList = parsedOrFormat;
      parsed = typeof cues === 'string' ? { format: cues } : (cues || { format: 'srt' });
    } else {
      parsed = typeof parsedOrFormat === 'string' ? { format: parsedOrFormat } : (parsedOrFormat || { format: 'srt' });
    }
    cueList = cueList || [];
    const fmt = (parsed.format || 'srt').toLowerCase();
    switch (fmt) {
      case 'vtt':
        return 'WEBVTT\n\n' + cueList.map((c) => {
          const s = c.settings ? ' ' + c.settings : '';
          return `${fmtVTT(c.start)} --> ${fmtVTT(c.end)}${s}\n${normalizeTextForStandard(c.text)}`;
        }).join('\n\n') + '\n';
      case 'srt':
        return cueList.map((c, i) => `${i + 1}\n${fmtSRT(c.start)} --> ${fmtSRT(c.end)}\n${normalizeTextForStandard(c.text)}`).join('\n\n') + '\n';
      case 'ass':
      case 'ssa':
        return serializeASS(parsed, cueList);
      case 'sub': {
        const fps = (parsed.meta && parsed.meta.fps) || 23.976;
        const frame = (ms) => Math.round((ms / 1000) * fps);
        const body = cueList.map((c) => `{${frame(c.start)}}{${frame(c.end)}}${normalizeTextForStandard(c.text).replace(/\n/g, '|')}`).join('\n');
        return `{1}{1}${fps.toFixed(3)}\n${body}\n`;
      }
      case 'smi':
        return '<SAMI>\n<HEAD><TITLE>Kurdish subtitles</TITLE></HEAD>\n<BODY>\n' +
          cueList.map((c) => `<SYNC Start=${c.start}><P class=KURD>${escapeXml(normalizeTextForStandard(c.text)).replace(/\n/g, '<br>')}</P></SYNC>`).join('\n') +
          '\n</BODY>\n</SAMI>\n';
      case 'txt':
        return cueList.map((c) => normalizeTextForStandard(c.text)).join('\n\n') + '\n';
      default:
        return cueList.map((c, i) => `${i + 1}\n${fmtSRT(c.start)} --> ${fmtSRT(c.end)}\n${normalizeTextForStandard(c.text)}`).join('\n\n') + '\n';
    }
  }

  function serializeASS(parsed, cues) {
    const meta = parsed.meta || {};
    const isSsa = parsed.format === 'ssa';
    const order = (meta.fields && meta.fields.length) ? meta.fields : ASS_DEFAULT_ORDER;
    const lower = order.map((f) => f.toLowerCase());
    const keyOf = (k) => order[lower.indexOf(k)];

    let cleanHeader = (meta.header || []).filter((l) => !/^\s*Dialogue\s*:/i.test(l));
    const fmtLine = `Format: ${order.join(', ')}`;

    let header;
    const hasScriptInfo = cleanHeader.some((l) => /^\s*\[Script Info\]\s*$/i.test(l));
    const evIdx = cleanHeader.findIndex((l) => /^\s*\[Events\]\s*$/i.test(l));

    if (!hasScriptInfo || evIdx < 0) {
      // Header is missing or incomplete (e.g. converted from SRT/VTT)
      const baseHeader = isSsa ? DEFAULT_SSA_HEADER : DEFAULT_ASS_HEADER;
      header = `${baseHeader}\n${fmtLine}`;
    } else {
      // Place exactly one Format line, right after [Events] (replacing any old one).
      const before = cleanHeader.slice(0, evIdx + 1);
      const after = cleanHeader.slice(evIdx + 1).filter((l) => !/^\s*Format\s*:/i.test(l));
      header = [...before, fmtLine, ...after].join('\n');
    }
    header = header.replace(/\n{3,}/g, '\n\n');

    const lines = [header];
    for (const c of cues) {
      const val = {};
      order.forEach((f) => { val[f] = (c.extra && c.extra[f]) ?? ASS_FALLBACKS[f.toLowerCase()] ?? ''; });
      val[keyOf('start')] = fmtASS(c.start);
      val[keyOf('end')] = fmtASS(c.end);
      const cueNorm = (c.text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\\N/g, '\n');
      val[keyOf('text')] = cueNorm.replace(/\n/g, '\\N');
      lines.push(`Dialogue: ${order.map((f) => val[f]).join(',')}`);
    }
    return lines.join('\n') + '\n';
  }

  function escapeXml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /**
   * Fix overlapping subtitle cue timestamps to prevent visual collisions
   * in video players (e.g. VLC, MPV, PotPlayer, Smart TVs, web/mobile apps)
   * where two cues speaking simultaneously or overlapping in time collide.
   *
   * @param {Array<{index:number,start:number,end:number,text:string,settings?:string,extra?:object}>} cues
   * @param {{mode?: 'trim'|'merge', minDuration?: number, gap?: number}} [options]
   * @returns {{cues: Array, fixedCount: number}}
   */
  function fixOverlaps(cues, options = {}) {
    if (!cues || !cues.length) return { cues: [], fixedCount: 0 };
    const minDur = options.minDuration !== undefined ? options.minDuration : 750;
    const gap = options.gap !== undefined ? options.gap : 40; // 40ms buffer prevents player collision
    const mode = options.mode || 'trim';

    // Clone and ensure sorted by start time
    const sorted = cues.map((c, i) => ({ ...c, originalIndex: i })).sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      return a.end - b.end;
    });

    let fixedCount = 0;
    const result = [];

    for (let i = 0; i < sorted.length; i++) {
      const cur = { ...sorted[i] };
      const next = sorted[i + 1] ? { ...sorted[i + 1] } : null;

      if (next) {
        // Case 1: Identical start time (e.g. 2 speakers starting at the same time across 2 separate cues)
        if (cur.start === next.start && mode === 'merge') {
          // Merge text into a multi-line dual-speaker cue: "- Line1\n- Line2"
          const t1 = (cur.text || '').trim();
          const t2 = (next.text || '').trim();
          const p1 = t1.startsWith('-') || t1.startsWith('—') ? t1 : `- ${t1}`;
          const p2 = t2.startsWith('-') || t2.startsWith('—') ? t2 : `- ${t2}`;
          cur.text = `${p1}\n${p2}`;
          cur.end = Math.max(cur.end, next.end);
          sorted[i + 1] = cur; // carry merged forward
          fixedCount++;
          continue;
        }

        // Case 2: Temporal overlap (cur.end > next.start)
        if (cur.end > next.start) {
          const maxAllowedEnd = Math.max(cur.start + minDur, next.start - gap);
          if (cur.end > maxAllowedEnd) {
            cur.end = maxAllowedEnd;
            fixedCount++;
          }
          // If next cue start is before cur.end after adjustment, nudge next start slightly if safe
          if (next.start < cur.end + gap && next.end > cur.end + gap + minDur) {
            sorted[i + 1].start = cur.end + gap;
            fixedCount++;
          }
        }
      }

      // Ensure minimum readable duration
      if (cur.end <= cur.start) {
        cur.end = cur.start + minDur;
        fixedCount++;
      }

      result.push(cur);
    }

    // Restore original ordering & renumber index
    result.forEach((c, i) => {
      c.index = i + 1;
      delete c.originalIndex;
    });

    result.cues = result;
    result.fixedCount = fixedCount;
    return result;
  }

  return { parse, serialize, fmtSRT, fmtVTT, fmtASS, detect, toMs, splitMs, fixOverlaps };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = SubParser;
