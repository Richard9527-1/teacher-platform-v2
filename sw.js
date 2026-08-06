// Service Worker
// 注意：每次改动前端代码后，请把 CACHE_NAME 的版本号 +1，
// 否则浏览器会一直用旧缓存，导致"代码改了但页面没变"。
const CACHE_NAME = 'yuwen-v7';

// 预缓存清单：仅放首屏必需资源。
// 教材详情分片（data/texts/detail-*.js）不预缓存，
// 由 fetch 处理器在实际懒加载时按「网络优先 + 回填缓存」策略自动收录，
// 这样离线时已看过的篇目仍可访问，又不会在安装阶段拖慢首屏。
const urls = [
  'index.html',
  'css/style.css',
  'js/app.js',
  'js/modules/text-loader.js',
  'data/texts-index.js',
  'manifest.json'
];

self.addEventListener('install', e => {
  self.skipWaiting(); // 新版本立即接管，不用等所有标签页关闭
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urls))
  );
});

// 激活时清掉所有旧版本缓存
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  // 接口请求（/api/*）与非 GET 请求：永远走网络，绝不缓存
  if (req.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return; // 交给浏览器默认处理
  }

  // 其余静态资源：网络优先，成功则顺便更新缓存；离线时回退缓存
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.ok && url.origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
