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
  const ASS_TIMECODE = /(\d+:\d{2}:\d{2}[.,]\d{1,3})/;
  const SUB_LINE = /^\{(\d+)\}\{(\d+)\}(.*)$/;

  // ---------- Time helpers ----------
  const pad = (n, len = 2) => String(n).padStart(len, '0');

  function splitMs(ms) {
    const val = Math.round(Math.max(0, Number(ms) || 0));
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
    const [sStr, csStr] = parts[2].split(/[.,]/);
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
    let lastWasBlank = true;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // NOTE, STYLE, and REGION blocks end at the first blank line and are never subtitle text
      if (inHeaderBlock) { if (!line) inHeaderBlock = false; continue; }
      const m = line.match(TIMECODE_LINE);
      if (m) {
        if (current) cues.push(current);
        const settings = m[3] ? m[3].trim() : '';
        current = { start: toMs(m[1]), end: toMs(m[2]), rawStart: m[1], rawEnd: m[2], settings, text: [] };
        lastWasBlank = false;
        continue;
      }
      if (/^(?:NOTE|STYLE|REGION)\b/i.test(line)) { inHeaderBlock = true; continue; }
      if (!line) {
        lastWasBlank = true;
        continue;
      }
      if (!current) {
        lastWasBlank = false;
        continue;
      }

      // Determine if this line is an index or cue identifier for the NEXT cue:
      // In WebVTT / SRT, an identifier only appears before the timecode line.
      // If current cue has no text yet, this line MUST be its subtitle payload.
      const next = lines[i + 1] ? lines[i + 1].trim() : '';
      if (next && TIMECODE_LINE.test(next)) {
        const isNumericIndex = /^\d+$/.test(line);
        const isSimpleId = isNumericIndex || (/^[\w.-]+$/.test(line) && !/^[a-zA-Z]+$/.test(line));
        const isId = lastWasBlank || (current.text.length > 0 && isSimpleId);
        if (isId) {
          lastWasBlank = false;
          continue;
        }
      }

      // In blank-line-separated SRT where index "1" has blank line between it and timecode
      const after = lines[i + 2] ? lines[i + 2].trim() : '';
      if (!next && /^\d+$/.test(line) && after && TIMECODE_LINE.test(after)) {
        lastWasBlank = false;
        continue;
      }

      current.text.push(line);
      lastWasBlank = false;
    }
    if (current) cues.push(current);

    const out = [];
    for (const c of cues) {
      const text = c.text.join('\n').trim();
      if (text) {
        let placement = 'bottom';
        let align = 'center';
        let fontFamily = null;
        let color = null;

        // WebVTT settings
        const settings = c.settings || '';
        if (settings) {
          const lineM = settings.match(/line:(-?\d+(?:\.\d+)?%?)/i);
          if (lineM) {
            const val = parseFloat(lineM[1]);
            if (val <= 28) placement = 'top';
            else if (val >= 38 && val <= 62) placement = 'center';
          }
          const alignM = settings.match(/align:(start|left|center|end|right)/i);
          if (alignM) {
            const a = alignM[1].toLowerCase();
            align = a === 'start' ? 'left' : (a === 'end' ? 'right' : a);
          }
        }

        // SRT / text inline formatting tags
        const anM = text.match(/\{\\an([1-9])\}/i) || text.match(/\{\\a([1-9]|1[01])\}/i);
        if (anM) {
          const aNum = parseInt(anM[1], 10);
          if (aNum === 7 || aNum === 8 || aNum === 9 || aNum === 5 || aNum === 6) placement = 'top';
          else if (aNum === 4 || aNum === 5 || aNum === 6 || aNum === 9 || aNum === 10 || aNum === 11) placement = 'center';
          if (aNum === 1 || aNum === 4 || aNum === 7) align = 'left';
          else if (aNum === 3 || aNum === 6 || aNum === 9) align = 'right';
        }

        const fontM = text.match(/<font\b[^>]*\bface=["']([^"']+)["']/i);
        if (fontM) fontFamily = fontM[1].trim();
        const colorM = text.match(/<font\b[^>]*\bcolor=["']([^"']+)["']/i);
        if (colorM) color = colorM[1].trim();

        out.push({
          index: out.length + 1,
          start: c.start,
          end: c.end,
          rawStart: c.rawStart,
          rawEnd: c.rawEnd,
          settings,
          text,
          placement,
          align,
          fontFamily,
          color,
        });
      }
    }
    return out;
  }

  // ---------- ASS / SSA ----------
  function parseASS(content) {
    const header = [];
    // Fall back to the standard field order when a file omits the Format line.
    let fields = ASS_DEFAULT_ORDER.slice();
    let styleFields = [];
    const stylesMap = {};
    const cues = [];
    let inEvents = false;
    let inStyles = false;

    for (const line of content.replace(/\r/g, '').split('\n')) {
      // Blank lines separate sections (and the file's trailing newline leaves
      // one); keep them out of the header so serialization round-trips cleanly.
      if (!line.trim()) continue;
      if (/^\s*\[Events\]\s*$/i.test(line)) { inEvents = true; inStyles = false; header.push(line); continue; }
      if (/^\s*\[(?:V4\+?\s*Styles|Styles)\]\s*$/i.test(line)) { inStyles = true; inEvents = false; header.push(line); continue; }
      if (/^\s*\[[^\]]+\]\s*$/.test(line)) { inEvents = false; inStyles = false; header.push(line); continue; }

      if (inStyles) {
        header.push(line);
        const sf = line.match(/^\s*Format\s*:\s*(.*)$/i);
        if (sf) {
          styleFields = sf[1].split(',').map((s) => s.trim());
          continue;
        }
        const sm = line.match(/^\s*Style\s*:\s*(.*)$/i);
        if (sm && styleFields.length) {
          const parts = sm[1].split(',').map((s) => s.trim());
          const sMap = {};
          styleFields.forEach((f, idx) => { sMap[f.toLowerCase()] = parts[idx] || ''; });
          const name = (sMap.name || '').toLowerCase();
          if (name) {
            stylesMap[name] = {
              fontName: sMap.fontname || null,
              fontSize: sMap.fontsize || null,
              alignment: parseInt(sMap.alignment, 10) || 2,
              primaryColor: sMap.primarycolour || null,
            };
          }
        }
        continue;
      }

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

        // Extract style & placement attributes
        const styleKey = (map.style || 'default').trim().toLowerCase();
        const styleDef = stylesMap[styleKey] || {};

        let placement = 'bottom';
        let align = 'center';
        let fontFamily = styleDef.fontName || null;
        let fontSize = styleDef.fontSize ? parseFloat(styleDef.fontSize) : null;
        let color = null;
        let pos = null;

        // Base alignment from style definition
        const styleAlign = styleDef.alignment || 2;
        if (styleAlign === 7 || styleAlign === 8 || styleAlign === 9) placement = 'top';
        else if (styleAlign === 4 || styleAlign === 5 || styleAlign === 6) placement = 'center';
        if (styleAlign === 1 || styleAlign === 4 || styleAlign === 7) align = 'left';
        else if (styleAlign === 3 || styleAlign === 6 || styleAlign === 9) align = 'right';

        // Override tags inside text: {\pos(x,y)}, {\an1-9}, {\fnFont}, {\fsSize}, {\c&H...&}
        const posM = text.match(/\{\\pos\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)\}/i);
        if (posM) {
          pos = { x: parseFloat(posM[1]), y: parseFloat(posM[2]) };
          placement = 'custom';
        }

        const anM = text.match(/\{\\an([1-9])\}/i);
        if (anM) {
          const aNum = parseInt(anM[1], 10);
          if (aNum >= 7) placement = 'top';
          else if (aNum >= 4) placement = 'center';
          else placement = 'bottom';

          if (aNum === 1 || aNum === 4 || aNum === 7) align = 'left';
          else if (aNum === 3 || aNum === 6 || aNum === 9) align = 'right';
          else align = 'center';
        }

        const fnM = text.match(/\{\\fn([^\}]+)\}/i);
        if (fnM) fontFamily = fnM[1].trim();

        const fsM = text.match(/\{\\fs(\d+(?:\.\d+)?)\}/i);
        if (fsM) fontSize = parseFloat(fsM[1]);

        const cM = text.match(/\{\\(?:1c|c)&H([0-9a-fA-F]{6,8})&?\}/i);
        if (cM) {
          const hex = cM[1];
          // In ASS, color is &HBBGGRR&
          if (hex.length >= 6) {
            const b = hex.slice(0, 2);
            const g = hex.slice(2, 4);
            const r = hex.slice(4, 6);
            color = `#${r}${g}${b}`;
          }
        }

        const cleanText = normalizeTextForStandard(text, true);

        cues.push({
          index: cues.length + 1,
          start: assToMs(t0[1]),
          end: assToMs(t1[1]),
          rawStart: t0[1],
          rawEnd: t1[1],
          text: cleanText || text,
          rawAssText: text,
          extra,
          placement,
          align,
          pos,
          fontFamily,
          fontSize,
          color,
          style: map.style || '',
        });
        continue;
      }

      header.push(line); // stray event lines (Comment: etc.)
    }

    return { cues, meta: { header, fields, styles: stylesMap } };
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
    const fpsMatch = first && first.match(/^\{(?:0|1)\}\{(?:0|1)\}\s*(?:FPS\s*=\s*|FPS\s*:\s*)?(\d+(?:\.\d+)?)\s*$/i);
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

      // MicroDVD position {P:x,y}, font {f:name}, size {s:size}, color {c:$bbggrr}
      let placement = 'bottom';
      let align = 'center';
      let pos = null;
      let fontFamily = null;
      let fontSize = null;
      let color = null;

      const posM = text.match(/\{P:(\d+),(\d+)\}/i);
      if (posM) {
        pos = { x: parseInt(posM[1], 10), y: parseInt(posM[2], 10) };
        placement = 'custom';
      }
      const fnM = text.match(/\{f:([^}]+)\}/i);
      if (fnM) fontFamily = fnM[1].trim();
      const fsM = text.match(/\{s:(\d+)\}/i);
      if (fsM) fontSize = parseInt(fsM[1], 10);
      const cM = text.match(/\{c:\$([0-9a-fA-F]{6})\}/i);
      if (cM) {
        const hex = cM[1];
        const b = hex.slice(0, 2);
        const g = hex.slice(2, 4);
        const r = hex.slice(4, 6);
        color = `#${r}${g}${b}`;
      }

      const cleanText = text
        .replace(/\{[PfsYc]:[^}]*\}/gi, '')
        .replace(/\{y:i\}/gi, '')
        .replace(/\{y:b\}/gi, '')
        .replace(/\{y:u\}/gi, '')
        .replace(/\{[^{}]*\}/g, '')
        .trim();

      cues.push({
        index: cues.length + 1,
        start: Math.round((Number(m[1]) / fps) * 1000),
        end: Math.round((Number(m[2]) / fps) * 1000),
        text: cleanText || text,
        rawSubText: text,
        placement,
        align,
        pos,
        fontFamily,
        fontSize,
        color,
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

      const rawBlock = m[2] || '';
      let fontFamily = null;
      let color = null;
      let placement = 'bottom';
      const fnM = rawBlock.match(/<FONT\b[^>]*\bFACE=["']([^"']+)["']/i);
      if (fnM) fontFamily = fnM[1].trim();
      const cM = rawBlock.match(/<FONT\b[^>]*\bCOLOR=["']([^"']+)["']/i);
      if (cM) color = cM[1].trim();
      if (/class=["']?[^"'>]*\btop\b/i.test(rawBlock) || /text-align:\s*top/i.test(rawBlock)) {
        placement = 'top';
      } else if (/class=["']?[^"'>]*\b(?:mid|center)\b/i.test(rawBlock)) {
        placement = 'center';
      }

      cues.push({ start, end: 0, text: para, placement, fontFamily, color });
      prev = cues.length - 1;
    }
    if (prev >= 0 && cues[prev].end === 0) cues[prev].end = cues[prev].start + 3000;
    cues.forEach((c, i) => { c.index = i + 1; });
    return cues;
  }

  // ---------- Transcript / Plain TXT ----------
  const TXT_TIMECODE_PREFIX = /^(?:\[?(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?)\]?)\s*(?:[-–—:]\s*)?(.*)$/;
  const YOUTUBE_TIMESTAMP_ONLY = /^\d{1,2}:\d{2}(?::\d{2})?$/;

  function parseTXT(content) {
    const rawLines = content.replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
    if (!rawLines.length) return [];

    // Check if lines are formatted like YouTube transcripts: Timestamp on line 1, text on line 2
    let isAlternatingYoutube = false;
    if (rawLines.length >= 2 && YOUTUBE_TIMESTAMP_ONLY.test(rawLines[0]) && !YOUTUBE_TIMESTAMP_ONLY.test(rawLines[1])) {
      isAlternatingYoutube = true;
    }

    if (isAlternatingYoutube) {
      const cues = [];
      for (let i = 0; i < rawLines.length; i += 2) {
        const timeStr = rawLines[i];
        const textStr = rawLines[i + 1] || '';
        const start = toMs(timeStr);
        const nextTimeStr = rawLines[i + 2];
        const nextStart = nextTimeStr ? toMs(nextTimeStr) : start + 3500;
        const end = Math.max(start + 500, nextStart - 50);
        if (textStr) {
          cues.push({ index: cues.length + 1, start, end, text: textStr });
        }
      }
      if (cues.length) return cues;
    }

    // Check if lines have inline timestamp prefix: [00:01:23] Text or 01:23 - Text
    let timestampCount = 0;
    for (let i = 0; i < Math.min(rawLines.length, 10); i++) {
      if (TXT_TIMECODE_PREFIX.test(rawLines[i])) timestampCount++;
    }

    if (timestampCount >= 2) {
      const parsedItems = [];
      for (const line of rawLines) {
        const m = line.match(TXT_TIMECODE_PREFIX);
        if (m && m[2]) {
          parsedItems.push({ start: toMs(m[1]), text: m[2].trim() });
        } else if (parsedItems.length && line) {
          parsedItems[parsedItems.length - 1].text += '\n' + line;
        }
      }
      if (parsedItems.length) {
        parsedItems.sort((a, b) => a.start - b.start);
        const cues = [];
        for (let i = 0; i < parsedItems.length; i++) {
          const cur = parsedItems[i];
          const next = parsedItems[i + 1];
          const end = next ? Math.max(cur.start + 500, next.start - 50) : cur.start + 3500;
          cues.push({ index: i + 1, start: cur.start, end, text: cur.text });
        }
        return cues;
      }
    }

    // Fallback: Plain text file without timestamps
    const cues = [];
    let curTime = 0;
    rawLines.forEach((line, i) => {
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
      if (result.format !== 'ass' && result.format !== 'ssa') {
        result.cues.sort((a, b) => a.start - b.start);
      }
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
YCbCr Matrix: None
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Noto Naskh Arabic,48,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3.2,1.8,2,40,40,35,178
Style: Top,Noto Naskh Arabic,44,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3.2,1.8,8,40,40,35,178
Style: Sign,Noto Sans Arabic,40,&H00E0D4FF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,2.8,1.2,5,30,30,25,178
Style: Narration,Noto Naskh Arabic,44,&H00EFEFEF,&H000000FF,&H00000000,&H80000000,0,-1,0,0,100,100,0,0,1,3.0,1.5,2,40,40,35,178
Style: Italics,Noto Naskh Arabic,46,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,-1,0,0,100,100,0,0,1,3.2,1.8,2,40,40,35,178

[Events]`;

  const DEFAULT_SSA_HEADER = `[Script Info]
Title: Kurdish Subtitles
ScriptType: v4.00
WrapStyle: 0
PlayResX: 1920
PlayResY: 1080

[V4 Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, TertiaryColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, AlphaLevel, Encoding
Style: Default,Noto Naskh Arabic,48,16777215,65535,0,0,-1,0,1,3.2,1.8,2,40,40,35,0,178
Style: Top,Noto Naskh Arabic,44,16777215,65535,0,0,-1,0,1,3.2,1.8,8,40,40,35,0,178

[Events]`;

  function normalizeTextForStandard(text, cleanTags = true) {
    if (!text) return '';
    let res = String(text)
      .replace(/\\N/gi, '\n')
      .replace(/\\n/gi, '\n')
      .replace(/\\h/gi, ' ')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
    if (cleanTags) {
      // Strip drawing commands like {\p1}...{\p0}
      res = res.replace(/\{\\p\d+\}[\s\S]*?(\{\\p0\}|$)/gi, '');
      // Convert basic ASS inline formatting tags to standard HTML tags
      res = res
        .replace(/\{\\i1\}/gi, '<i>').replace(/\{\\i0\}/gi, '</i>')
        .replace(/\{\\b1\}/gi, '<b>').replace(/\{\\b0\}/gi, '</b>')
        .replace(/\{\\u1\}/gi, '<u>').replace(/\{\\u0\}/gi, '</u>');
      // Convert ASS colors {\c&HBBGGRR&} or {\1c&HBBGGRR&} to <font color="#RRGGBB">
      res = res.replace(/\{\\(?:c|1c)&H([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})&\}/gi, (m, b, g, r) => {
        return `<font color="#${r}${g}${b}">`;
      });
      // Strip remaining ASS control override tags (e.g. {\pos(...)}, {\an8}, {\fad(...)})
      res = res.replace(/\{[^{}]*\}/g, '');
    }
    return res.trim();
  }

  function normalizeTextForASS(text, settings = '', rawText = '') {
    if (!text) return '';
    let res = String(text)
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
    // Convert HTML formatting to ASS tags
    res = res
      .replace(/<i>([\s\S]*?)<\/i>/gi, '{\\i1}$1{\\i0}')
      .replace(/<b>([\s\S]*?)<\/b>/gi, '{\\b1}$1{\\b0}')
      .replace(/<u>([\s\S]*?)<\/u>/gi, '{\\u1}$1{\\u0}')
      .replace(/<font\s+color=["']#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})["']>([\s\S]*?)<\/font>/gi, (m, r, g, b, inner) => {
        return `{\\c&H${b}${g}${r}&}${inner}{\\c}`;
      })
      .replace(/<[^>]+>/g, ''); // strip any remaining non-supported HTML tags

    // Preserve or synthesize placement override if converting from WebVTT or top-aligned cues
    const combined = `${settings} ${rawText} ${text}`;
    const hasExistingAlign = /\{\\a(?:n\d+|\d+)\}/i.test(res);
    if (!hasExistingAlign) {
      const isTop = /line:(?:0|1|2|3|4|5|10|15|20)%/i.test(settings) || /line:[0-3]\b/i.test(settings) || /<top>/i.test(combined) || /\{\\an[789]\}/i.test(rawText);
      const isMid = /line:(?:40|45|50|55|60)%/i.test(settings) || /<mid>/i.test(combined) || /\{\\an[456]\}/i.test(rawText);
      const isLeft = /align:(?:left|start)/i.test(settings);
      const isRight = /align:(?:right|end)/i.test(settings);

      if (isTop) {
        const alignTag = isLeft ? '{\\an7}' : (isRight ? '{\\an9}' : '{\\an8}');
        res = alignTag + res;
      } else if (isMid) {
        const alignTag = isLeft ? '{\\an4}' : (isRight ? '{\\an6}' : '{\\an5}');
        res = alignTag + res;
      } else if (isLeft) {
        res = '{\\an1}' + res;
      } else if (isRight) {
        res = '{\\an3}' + res;
      }
    }

    return res.replace(/\n/g, '\\N');
  }

  function normalizeTextForSUB(text) {
    if (!text) return '';
    let res = String(text)
      .replace(/\\N/gi, '|')
      .replace(/\\n/gi, '|')
      .replace(/\r\n/g, '|')
      .replace(/\r/g, '|')
      .replace(/\n/g, '|');

    // Convert HTML tags to MicroDVD syntax codes
    res = res
      .replace(/<i>([\s\S]*?)<\/i>/gi, '{y:i}$1')
      .replace(/<b>([\s\S]*?)<\/b>/gi, '{y:b}$1')
      .replace(/<u>([\s\S]*?)<\/u>/gi, '{y:u}$1')
      .replace(/<font\s+color=["']#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})["']>([\s\S]*?)<\/font>/gi, (m, r, g, b, inner) => {
        return `{c:$${b}${g}${r}}${inner}`;
      })
      .replace(/<[^>]+>/g, '');

    return res.trim();
  }

  function normalizeTextForSAMI(text) {
    if (!text) return '';
    let s = normalizeTextForStandard(text, true);
    // Protect supported HTML tags (i, b, u, font), escape the rest
    const supported = [];
    s = s.replace(/<\/?(?:i|b|u|font\b[^>]*)\/?>/gi, (tag) => {
      const idx = supported.length;
      supported.push(tag);
      return `___SAMI_TAG_${idx}___`;
    });
    s = escapeXml(s);
    s = s.replace(/___SAMI_TAG_(\d+)___/g, (_, idx) => supported[parseInt(idx, 10)] || '');
    return s.replace(/\n/g, '<br>');
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
      case 'vtt': {
        const header = 'WEBVTT\n\nSTYLE\n::cue {\n  font-family: \'Noto Naskh Arabic\', \'Vazirmatn\', \'Noto Sans Arabic\', \'Segoe UI\', Tahoma, sans-serif;\n  font-size: 100%;\n}\n\n';
        const body = cueList.map((c) => {
          let s = c.settings ? ' ' + c.settings.trim() : '';
          if (!s) {
            const placement = getPlacementZone(c);
            if (placement === 'top') {
              s = ' line:10% position:50% align:center';
            } else if (placement === 'mid') {
              s = ' line:50% position:50% align:center';
            }
          }
          const startStr = (c.rawStart && !c._shifted && /^\d+:\d{2}(?::\d{2})?\.\d{3}$/.test(c.rawStart)) ? c.rawStart : fmtVTT(c.start);
          const endStr = (c.rawEnd && !c._shifted && /^\d+:\d{2}(?::\d{2})?\.\d{3}$/.test(c.rawEnd)) ? c.rawEnd : fmtVTT(c.end);
          return `${startStr} --> ${endStr}${s}\n${normalizeTextForStandard(c.text)}`;
        }).join('\n\n') + '\n';
        return header + body;
      }
      case 'srt':
        return cueList.map((c, i) => {
          const startStr = (c.rawStart && !c._shifted && /^\d{2}:\d{2}:\d{2},\d{3}$/.test(c.rawStart)) ? c.rawStart : fmtSRT(c.start);
          const endStr = (c.rawEnd && !c._shifted && /^\d{2}:\d{2}:\d{2},\d{3}$/.test(c.rawEnd)) ? c.rawEnd : fmtSRT(c.end);
          return `${i + 1}\n${startStr} --> ${endStr}\n${normalizeTextForStandard(c.text)}`;
        }).join('\n\n') + '\n';
      case 'ass':
      case 'ssa':
        return serializeASS(parsed, cueList);
      case 'sub': {
        const fps = (parsed.meta && parsed.meta.fps) || 23.976;
        const frame = (ms) => Math.round((ms / 1000) * fps);
        const body = cueList.map((c) => `{${frame(c.start)}}{${frame(c.end)}}${normalizeTextForSUB(c.text)}`).join('\n');
        return `{1}{1}${fps.toFixed(3)}\n${body}\n`;
      }
      case 'smi':
        return '<SAMI>\n<HEAD><TITLE>Kurdish Subtitles</TITLE>\n<STYLE TYPE="text/css">\n<!--\nP { font-family: \'Noto Naskh Arabic\', \'Vazirmatn\', \'Noto Sans Arabic\', sans-serif; font-size: 24pt; text-align: center; color: #FFFFFF; direction: rtl; }\n.KURD { Name: Kurdish; lang: ckb; SAMIType: CC; }\n-->\n</STYLE>\n</HEAD>\n<BODY>\n' +
          cueList.map((c) => `<SYNC Start=${c.start}><P class=KURD>${normalizeTextForSAMI(c.text)}</P></SYNC>`).join('\n') +
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
    const keyOf = (k) => {
      const idx = lower.indexOf(k);
      return idx !== -1 ? order[idx] : k;
    };

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
      // Ensure Kurdish font name and encoding (178) is set on existing Styles in header
      const latinFonts = /\b(?:Arial|Calibri|Helvetica|Verdana|Tahoma|Times New Roman|Comic Sans MS|Trebuchet MS|Impact|Courier New|Consolas|Lucida Sans|Segoe UI|Roboto|Open Sans|Inter|Geist)\b/i;
      cleanHeader = cleanHeader.map((line) => {
        if (/^\s*Style\s*:/i.test(line)) {
          let updated = line;
          // Upgrade Latin-only fonts to Noto Naskh Arabic for proper Kurdish cursive rendering
          if (latinFonts.test(updated) && !/Noto Naskh Arabic|Noto Sans Arabic|Vazirmatn|Unikurd/i.test(updated)) {
            updated = updated.replace(latinFonts, 'Noto Naskh Arabic');
          }
          // If style specifies Western encoding (1 or 0) or misses 178, upgrade to 178 (Arabic/Kurdish charset)
          if (/,(?:0|1)$/.test(updated)) {
            updated = updated.replace(/,(?:0|1)$/, ',178');
          }
          return updated;
        }
        return line;
      });

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
      val[keyOf('start')] = (c.rawStart && !c._shifted && /^\d+:\d{2}:\d{2}\.\d{2}$/.test(c.rawStart)) ? c.rawStart : fmtASS(c.start);
      val[keyOf('end')] = (c.rawEnd && !c._shifted && /^\d+:\d{2}:\d{2}\.\d{2}$/.test(c.rawEnd)) ? c.rawEnd : fmtASS(c.end);
      val[keyOf('text')] = normalizeTextForASS(c.text, c.settings, c.rawText);
      lines.push(`Dialogue: ${order.map((f) => val[f]).join(',')}`);
    }
    return lines.join('\n') + '\n';
  }

  function escapeXml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /** Extract vertical placement zone: 'top', 'mid', 'bottom' */
  function getPlacementZone(cue) {
    if (!cue) return 'bottom';
    if (cue.placement === 'top' || cue.placement === 'mid' || cue.placement === 'center') {
      return cue.placement === 'center' ? 'mid' : cue.placement;
    }
    const raw = String(cue.rawText || cue.text || '');
    const settings = String(cue.settings || '');
    if (/\{\\an[789]\}/i.test(raw) || /\{\\a[567]\}/i.test(raw) || /<top>/i.test(raw) || /line:(?:0|1|2|3|4|5|10|15|20|25)%/i.test(settings)) {
      return 'top';
    }
    if (/\{\\an[456]\}/i.test(raw) || /\{\\a[9]|\\a1[01]\}/i.test(raw) || /<mid>/i.test(raw) || /line:(?:40|45|50|55|60)%/i.test(settings)) {
      return 'mid';
    }
    return 'bottom';
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
    // If format is ASS or SSA, subtitles can naturally layer simultaneously, so skip overlap shifting
    if (options.format === 'ass' || options.format === 'ssa') {
      const res = cues.map((c, i) => ({ ...c, index: i + 1 }));
      res.cues = res;
      res.fixedCount = 0;
      return res;
    }
    const minDur = options.minDuration !== undefined ? options.minDuration : (options.minDurationMs !== undefined ? options.minDurationMs : 600);
    const gap = options.gap !== undefined ? options.gap : (options.gapMs !== undefined ? options.gapMs : 20); // 20ms buffer
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

      // Ensure minimum readable duration if end was invalid or missing
      if (cur.end <= cur.start) {
        cur.end = cur.start + minDur;
        cur._shifted = true;
        fixedCount++;
      }

      if (next) {
        const curZone = getPlacementZone(cur);
        const nextZone = getPlacementZone(next);
        const diffScreenZones = curZone !== nextZone;

        // Case 1: Identical start time (e.g. 2 speakers starting at the same time across 2 separate cues)
        if (cur.start === next.start && mode === 'merge' && !diffScreenZones) {
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
        // Cap cur.end so it does not collide with next.start, but NEVER alter next.start so lip-sync is 100% original.
        if (cur.end > next.start && !diffScreenZones) {
          const maxAllowedEnd = Math.max(cur.start + 100, next.start - gap);
          if (cur.end > maxAllowedEnd) {
            cur.end = maxAllowedEnd;
            cur._shifted = true;
            fixedCount++;
          }
        }
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

  /**
   * Shift all cue timestamps forward (+) or backward (-) by deltaMs.
   * Ensures start >= 0 and end > start.
   */
  function timeShiftCues(cues, deltaMs) {
    if (!cues || !Array.isArray(cues) || !deltaMs) return cues;
    return cues.map((c) => {
      const start = Math.max(0, (c.start || 0) + deltaMs);
      const minEnd = start + 200;
      const end = Math.max(minEnd, (c.end || 0) + deltaMs);
      return { ...c, start, end, _shifted: true };
    });
  }

  function validateCues(cues) {
    if (!Array.isArray(cues)) return [];
    return cues.filter((cue) => {
      if (!cue || typeof cue !== 'object') return false;
      if (typeof cue.start !== 'number' || isNaN(cue.start) || cue.start < 0) return false;
      if (typeof cue.end !== 'number' || isNaN(cue.end) || cue.end < cue.start) return false;
      if (typeof cue.text !== 'string') cue.text = '';
      return true;
    });
  }

  return { parse, serialize, fmtSRT, fmtVTT, fmtASS, detect, toMs, splitMs, fixOverlaps, timeShiftCues, validateCues };
})();

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined' && typeof window === 'undefined') module.exports = SubParser;
