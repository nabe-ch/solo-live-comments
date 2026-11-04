// 2回目から速く開くための保存の仕組み（声の認識そのものは、通信が必要）
const CACHE = 'solo-live-comments';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // 版番号つきのファイルは中身が変わらないので、保存したものを使う
  if (url.searchParams.has('v')) {
    e.respondWith(caches.open(CACHE).then(async (cache) => {
      const saved = await cache.match(e.request);
      if (saved) return saved;
      const res = await fetch(e.request);
      if (res.ok) {
        // 同じファイルの古い版は消す
        await cache.delete(e.request, { ignoreSearch: true });
        await cache.put(e.request, res.clone());
      }
      return res;
    }));
    return;
  }
  // ページ本体などは、新しいものを優先する。通信できないときだけ保存したものを使う
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    try {
      const res = await fetch(e.request);
      if (res.ok) await cache.put(e.request, res.clone());
      return res;
    } catch (err) {
      const saved = await cache.match(e.request, { ignoreSearch: true });
      if (saved) return saved;
      throw err;
    }
  }));
});
