// 서비스 워커: 앱 화면 파일을 저장해 두고 빠르게 연다.
// 사진(ootd-photos-v1)은 앱이 직접 관리하므로 여기서 지우지 않는다.
const SHELL_CACHE = 'ootd-shell-v1';
const PHOTO_CACHE = 'ootd-photos-v1';
const SCOPE = self.registration.scope;
const INDEX_URL = new URL('./', SCOPE).toString();
const SHELL = ['./', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'].map((p) =>
  new URL(p, SCOPE).toString(),
);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== PHOTO_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !req.url.startsWith(SCOPE)) return;
  // 새 버전 확인 요청은 저장본을 쓰지 않는다
  if (url.searchParams.has('ootd-check')) return;

  // 앱 화면: 인터넷이 되면 항상 최신(10분 캐시도 거치지 않음), 안 되면 저장본
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' }))
        .then((res) => {
          if (res.ok && url.href.split(/[?#]/)[0] === INDEX_URL) {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(INDEX_URL, copy));
          }
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match(INDEX_URL))),
    );
    return;
  }

  // 그 밖의 파일: 저장본을 먼저 쓰고, 뒤에서 새로 받아 둔다
  event.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    }),
  );
});
