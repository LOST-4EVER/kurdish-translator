const http = require('node:http');
const https = require('node:https');
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

async function fetchGoogleTranslate(text, sl = 'auto', tl = 'ckb') {
  const hosts = [
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(text)}`,
    `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}&q=${encodeURIComponent(text)}`,
    `https://clients1.google.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(text)}`
  ];

  for (const url of hosts) {
    try {
      const resp = await fetch(url, { method: 'GET' });
      if (resp.ok) {
        const data = await resp.json();
        let translated = '';
        if (typeof data === 'string') {
          translated = data;
        } else if (Array.isArray(data)) {
          if (typeof data[0] === 'string') {
            translated = data[0];
          } else if (Array.isArray(data[0])) {
            if (typeof data[0][0] === 'string') {
              translated = data[0][0];
            } else if (Array.isArray(data[0][0])) {
              translated = data[0].map((seg) => (Array.isArray(seg) && typeof seg[0] === 'string' ? seg[0] : '')).join('');
            }
          }
        }
        if (translated) return translated;
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
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
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
          await handleTranslation(text, sl, tl);
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

  const safePath = path.normalize(reqUrl).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(__dirname, safePath);

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
        'Access-Control-Allow-Origin': '*'
      });
      res.end(content);
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}/`);
});
