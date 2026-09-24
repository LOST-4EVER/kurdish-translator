const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT) || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

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

function extractTranslationFromGoogle(data) {
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

const SERVER_TRANSLATION_CACHE = new Map();
const MAX_SERVER_CACHE_SIZE = 5000;

async function fetchGoogleTranslate(text, sl = 'auto', tl = 'ckb') {
  if (!text || !text.trim()) return '';

  const cacheKey = `${sl}:${tl}:${text}`;
  if (SERVER_TRANSLATION_CACHE.has(cacheKey)) {
    return SERVER_TRANSLATION_CACHE.get(cacheKey);
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9,ckb;q=0.8,ku;q=0.7',
    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
  };

  // 1. Try POST with form-urlencoded body
  const postEndpoints = [
    'https://translate.googleapis.com/translate_a/single',
    'https://clients1.google.com/translate_a/single',
    'https://clients2.google.com/translate_a/single',
    'https://clients3.google.com/translate_a/single',
    'https://clients5.google.com/translate_a/single'
  ];

  const clients = ['gtx', 'dict-chrome-ex', 'tw-ob'];

  for (const client of clients) {
    const params = new URLSearchParams({
      client,
      sl,
      tl,
      dt: 't',
      ie: 'UTF-8',
      oe: 'UTF-8',
      q: text
    });

    for (const endpoint of postEndpoints) {
      try {
        const resp = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: params.toString()
        });
        if (resp.ok) {
          const data = await resp.json();
          const translated = extractTranslationFromGoogle(data);
          if (translated) {
            if (SERVER_TRANSLATION_CACHE.size >= MAX_SERVER_CACHE_SIZE) {
              const firstKey = SERVER_TRANSLATION_CACHE.keys().next().value;
              SERVER_TRANSLATION_CACHE.delete(firstKey);
            }
            SERVER_TRANSLATION_CACHE.set(cacheKey, translated);
            return translated;
          }
        }
      } catch {}
    }
  }

  // 2. Fallback to GET endpoints
  const getEndpoints = [
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}&dt=t&ie=UTF-8&oe=UTF-8&q=${encodeURIComponent(text)}`,
    `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}&q=${encodeURIComponent(text)}`,
    `https://clients1.google.com/translate_a/t?client=tw-ob&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}&q=${encodeURIComponent(text)}`
  ];

  for (const url of getEndpoints) {
    try {
      const resp = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': '*/*'
        }
      });
      if (resp.ok) {
        const data = await resp.json();
        const translated = extractTranslationFromGoogle(data);
        if (translated) {
          if (SERVER_TRANSLATION_CACHE.size >= MAX_SERVER_CACHE_SIZE) {
            const firstKey = SERVER_TRANSLATION_CACHE.keys().next().value;
            SERVER_TRANSLATION_CACHE.delete(firstKey);
          }
          SERVER_TRANSLATION_CACHE.set(cacheKey, translated);
          return translated;
        }
      }
    } catch {}
  }

  // 3. Fallback to Lingva Translate instances
  const lingvaInstances = [
    'https://lingva.ml/api/v1',
    'https://translate.plausibility.cloud/api/v1',
    'https://lingva.garudalinux.org/api/v1'
  ];

  for (const instance of lingvaInstances) {
    try {
      const from = sl === 'auto' ? 'auto' : sl;
      const url = `${instance}/${encodeURIComponent(from)}/${encodeURIComponent(tl)}/${encodeURIComponent(text)}`;
      const resp = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' }
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.translation) {
          if (SERVER_TRANSLATION_CACHE.size >= MAX_SERVER_CACHE_SIZE) {
            const firstKey = SERVER_TRANSLATION_CACHE.keys().next().value;
            SERVER_TRANSLATION_CACHE.delete(firstKey);
          }
          SERVER_TRANSLATION_CACHE.set(cacheKey, data.translation);
          return data.translation;
        }
      }
    } catch {}
  }

  throw new Error('All translation providers failed');
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
      'Access-Control-Max-Age': '86400'
    });
    res.end();
    return;
  }

  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  // Handle Server-Side Translation API Proxy
  if (pathname === '/api/translate') {
    let text = urlObj.searchParams.get('q') || urlObj.searchParams.get('text') || '';
    let sl = urlObj.searchParams.get('sl') || 'auto';
    let tl = urlObj.searchParams.get('tl') || 'ckb';

    const handleTranslation = async (qText, qSl, qTl) => {
      try {
        const translated = await fetchGoogleTranslate(qText, qSl, qTl);
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ translation: translated, text: qText }));
      } catch (err) {
        res.writeHead(502, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ error: err.message || 'Translation error' }));
      }
    };

    if (req.method === 'POST') {
      let body = '';
      let size = 0;
      let responded = false; // guard against double response on malformed chunks
      req.on('data', (chunk) => {
        size += chunk.length;
        if (size > 512 * 1024) {
          responded = true;
          res.writeHead(413, { 'Content-Type': 'text/plain' });
          res.end('Payload too large');
          req.destroy();
          return;
        }
        body += chunk;
      });
      req.on('end', async () => {
        if (responded) return;
        try {
          if (body) {
            if (body.startsWith('{')) {
              const json = JSON.parse(body);
              text = json.q || json.text || text;
              sl = json.sl || sl;
              tl = json.tl || tl;
            } else {
              const params = new URLSearchParams(body);
              text = params.get('q') || params.get('text') || text;
              sl = params.get('sl') || sl;
              tl = params.get('tl') || tl;
            }
          }
          await handleTranslation(text, sl, tl);
        } catch {
          if (!res.headersSent) await handleTranslation(text, sl, tl);
        }
      });
      return;
    }

    await handleTranslation(text, sl, tl);
    return;
  }

  let reqUrl = pathname;
  if (reqUrl === '/') {
    reqUrl = '/index.html';
  }

  // Prevent directory traversal attacks
  const decodedPath = decodeURIComponent(reqUrl);
  const safePath = path.normalize(decodedPath).replace(/^(\.\.[\/\\])+/, '');
  let resolvedPath = path.resolve(__dirname, '.' + safePath);
  if (!resolvedPath.startsWith(path.resolve(__dirname))) {
    resolvedPath = path.join(__dirname, 'index.html');
  }
  let filePath = resolvedPath;

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(__dirname, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
        return;
      }

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
      });
      res.end(content);
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}/`);
});
