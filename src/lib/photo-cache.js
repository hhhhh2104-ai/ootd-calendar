// 사진을 폰에 임시 저장해서 다음부터 빠르게 보여준다 (원본은 구글 드라이브에 있음)
const CACHE_NAME = 'ootd-photos-v1';
const urls = new Map();
const inflight = new Map();
let loader = null;

export function setPhotoLoader(fn) {
  loader = fn;
}

const keyFor = (id) => `https://ootd.photo-cache/${encodeURIComponent(id)}`;

// 한 번에 4장까지만 내려받기
let active = 0;
const waiters = [];
async function limit(fn) {
  if (active >= 4) await new Promise((r) => waiters.push(r));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    const next = waiters.shift();
    if (next) next();
  }
}

async function openCache() {
  try {
    return await caches.open(CACHE_NAME);
  } catch {
    return null;
  }
}

function respond(blob) {
  return new Response(blob, { headers: { 'Content-Type': blob.type || 'image/jpeg' } });
}

export function peekPhotoUrl(id) {
  return urls.get(id) || null;
}

export function loadPhotoUrl(id) {
  if (urls.has(id)) return Promise.resolve(urls.get(id));
  if (inflight.has(id)) return inflight.get(id);
  const p = (async () => {
    const cache = await openCache();
    let blob = null;
    if (cache) {
      try {
        const hit = await cache.match(keyFor(id));
        if (hit) blob = await hit.blob();
      } catch {}
    }
    if (!blob) {
      if (!loader) throw new Error('no loader');
      blob = await limit(() => loader(id));
      if (cache) {
        try {
          await cache.put(keyFor(id), respond(blob));
        } catch {}
      }
    }
    const url = URL.createObjectURL(blob);
    urls.set(id, url);
    return url;
  })();
  inflight.set(id, p);
  p.then(
    () => inflight.delete(id),
    () => inflight.delete(id),
  );
  return p;
}

export async function putPhoto(id, blob) {
  const old = urls.get(id);
  if (old) URL.revokeObjectURL(old);
  urls.set(id, URL.createObjectURL(blob));
  const cache = await openCache();
  if (cache) {
    try {
      await cache.put(keyFor(id), respond(blob));
    } catch {}
  }
}

export async function forgetPhoto(id) {
  const u = urls.get(id);
  if (u) URL.revokeObjectURL(u);
  urls.delete(id);
  const cache = await openCache();
  if (cache) {
    try {
      await cache.delete(keyFor(id));
    } catch {}
  }
}

export async function clearPhotoCache() {
  for (const u of urls.values()) URL.revokeObjectURL(u);
  urls.clear();
  try {
    await caches.delete(CACHE_NAME);
  } catch {}
}
