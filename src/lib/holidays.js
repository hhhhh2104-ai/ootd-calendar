// 대한민국 공휴일 (공공데이터포털 특일 정보를 정리한 holidays-kr 목록)
// 폰에 저장해 두고 7일마다 새로 받는다 → 앱을 열자마자 빨간색으로 보이고, 임시공휴일도 반영된다.

const CACHE_KEY = 'ootd.holidays';
const REFRESH_MS = 7 * 24 * 60 * 60 * 1000;
const url = (year) => `https://holidays.hyunbin.page/${year}.json`;

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY)) || {};
  } catch {
    return {};
  }
}

function writeCache(cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

// 저장된 모든 해의 공휴일: { 'YYYY-MM-DD': '설날' }
export function cachedHolidays() {
  const out = {};
  for (const entry of Object.values(readCache())) {
    for (const [date, names] of Object.entries(entry?.data || {})) {
      out[date] = Array.isArray(names) ? names.join(', ') : String(names);
    }
  }
  return out;
}

export function needsRefresh(year) {
  const entry = readCache()[year];
  return !entry || Date.now() - (entry.fetchedAt || 0) > REFRESH_MS;
}

// 한 해의 공휴일을 받아서 저장한다. 바뀐 게 있으면 true.
export async function refreshHolidays(year) {
  const res = await fetch(url(year));
  let data = null;
  if (res.ok) data = await res.json();
  else if (res.status !== 404) throw new Error(`holidays ${res.status}`);
  const cache = readCache();
  const before = JSON.stringify(cache[year]?.data ?? null);
  cache[year] = { fetchedAt: Date.now(), data };
  writeCache(cache);
  return before !== JSON.stringify(data);
}
