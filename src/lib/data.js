// 구글 드라이브의 ootd-data.json 한 파일에 저장되는 데이터 구조
//
// {
//   version: 1,
//   photos: {            // 착용샷
//     [id]: { id, date: 'YYYY-MM-DD', fileId, thumbId, width, height, order, createdAt, updatedAt? }
//   },
//   weather: {           // 날짜별 천안 날씨
//     'YYYY-MM-DD': { code, max, min, final, fetchedOn }
//   },
//   weights: {           // 날짜별 몸무게 (그날 첫 측정값)
//     'YYYY-MM-DD': { kg, time: 'HH:MM', source: 'samsung' | 'manual' }
//   },
//   hiddenEvents: {      // 앱에서 숨긴 구글 캘린더 일정
//     [eventId]: { title, date, hiddenAt }
//   },
//   clothes: {}, outfitItems: {},  // (사용 안 함) 옷장 기능은 하지 않기로 함
//   updatedAt
// }

export const DATA_VERSION = 1;

export function emptyData() {
  return {
    version: DATA_VERSION,
    photos: {},
    weather: {},
    weights: {},
    hiddenEvents: {},
    clothes: {},
    outfitItems: {},
    updatedAt: null,
  };
}

export function normalizeData(raw) {
  const base = emptyData();
  if (!raw || typeof raw !== 'object') return base;
  return {
    ...base,
    ...raw,
    photos: raw.photos || {},
    weather: raw.weather || {},
    weights: raw.weights || {},
    hiddenEvents: raw.hiddenEvents || {},
    clothes: raw.clothes || {},
    outfitItems: raw.outfitItems || {},
  };
}

function byOrder(a, b) {
  return (a.order ?? 0) - (b.order ?? 0) || String(a.createdAt).localeCompare(String(b.createdAt));
}

export function photosOnDate(data, date) {
  return Object.values(data.photos).filter((p) => p.date === date).sort(byOrder);
}

export function groupPhotosByDate(data) {
  const map = new Map();
  for (const p of Object.values(data.photos)) {
    if (!map.has(p.date)) map.set(p.date, []);
    map.get(p.date).push(p);
  }
  for (const arr of map.values()) arr.sort(byOrder);
  return map;
}

export function nextOrder(data, date) {
  let max = -1;
  for (const p of Object.values(data.photos)) {
    if (p.date === date && (p.order ?? 0) > max) max = p.order ?? 0;
  }
  return max + 1;
}

export function newId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
