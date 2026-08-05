// dev-server.js
// ============================================================
// 本地开发服务器 —— 零依赖（只用 Node 内置 http/fs/path/url）
//
// 用途：在没装 Vercel CLI 的情况下也能本地跑通手写 OCR。
//       提供静态文件服务 + 代理 /api/ocr 到 api/ocr.js。
//
// 用法：
//   1) 在项目根目录创建 .env.local，填入：
//        TENCENT_SECRET_ID=...
//        TENCENT_SECRET_KEY=...
//   2) node dev-server.js
//   3) 浏览器打开 http://localhost:3000
//
// 注意：仅供本地联调；线上部署仍走 Vercel（已配 vercel 环境变量）。
// ============================================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// ---- 加载 .env.local ----
function loadEnv() {
  const envPath = path.join(__dirname, '.env.local');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
}
loadEnv();

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

// ---- MIME ----
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json'
};

// ---- 静态文件服务 ----
function serveStatic(req, res, filePath) {
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found: ' + req.url);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // /api/* 路由到 api 目录
  if (parsed.pathname.startsWith('/api/')) {
    const apiFile = path.join(ROOT, parsed.pathname + '.js');
    if (!fs.existsSync(apiFile)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'API not found: ' + parsed.pathname }));
      return;
    }
    // 收集 body
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        // 解析 JSON body
        if (req.headers['content-type'] && req.headers['content-type'].includes('json') && body) {
          try { req.body = JSON.parse(body); } catch (_) { req.body = {}; }
        } else {
          req.body = {};
        }
        // 包装 res：兼容 Vercel 风格 (res.status().json()) 与原生 (res.writeHead().end())
        const originalWriteHead = res.writeHead.bind(res);
        let statusCode = 200;
        let ended = false;
        res.status = function (code) {
          statusCode = code;
          return res;
        };
        res.json = function (obj) {
          if (ended) return res;
          ended = true;
          originalWriteHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(obj));
          return res;
        };
        const handler = require(apiFile);
        await handler(req, res);
      } catch (err) {
        console.error('[api error]', err);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Server error: ' + err.message }));
        }
      }
    });
    return;
  }

  // sw.js 必须放在根路径下
  let pathname = parsed.pathname === '/' ? '/index.html' : parsed.pathname;
  const filePath = path.join(ROOT, pathname);
  // 防止路径穿越
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  serveStatic(req, res, filePath);
});

server.listen(PORT, () => {
  console.log(`\n  本地开发服务器已启动`);
  console.log(`  访问: http://localhost:${PORT}`);
  console.log(`  API:  http://localhost:${PORT}/api/ocr`);
  console.log(`  按 Ctrl+C 退出\n`);
  if (!process.env.TENCENT_SECRET_ID || !process.env.TENCENT_SECRET_KEY) {
    console.warn('  ⚠️  未检测到 TENCENT_SECRET_ID / TENCENT_SECRET_KEY');
    console.warn('     请在项目根目录创建 .env.local 并填入密钥后再识别');
    console.warn('     示例：');
    console.warn('       TENCENT_SECRET_ID=AKIDxxxxxxxx');
    console.warn('       TENCENT_SECRET_KEY=xxxxxxxx\n');
  }
});