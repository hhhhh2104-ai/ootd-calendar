// 천안 날씨 (Open-Meteo, 무료/가입 불필요)
import { LOCATION } from '../config.js';
import { todayStr, daysBetween } from './dates.js';

// 오늘부터 15일 뒤까지 예보 제공 (총 16일)
export const FORECAST_DAYS_AHEAD = 15;
// 최근 날짜는 예보 API, 그보다 오래된 날짜는 과거 기록 API 사용
const RECENT_DAYS = 80;

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';

async function query(base, start, end) {
  const p = new URLSearchParams({
    latitude: String(LOCATION.latitude),
    longitude: String(LOCATION.longitude),
    daily: 'weather_code,temperature_2m_max,temperature_2m_min',
    timezone: LOCATION.timezone,
    start_date: start,
    end_date: end,
  });
  const res = await fetch(`${base}?${p}`);
  if (!res.ok) throw new Error(`날씨를 불러오지 못했어요 (${res.status})`);
  const j = await res.json();
  const d = j.daily || {};
  const out = {};
  (d.time || []).forEach((t, i) => {
    const code = d.weather_code?.[i];
    const max = d.temperature_2m_max?.[i];
    const min = d.temperature_2m_min?.[i];
    if (code == null || max == null || min == null) return;
    out[t] = { code, max: Math.round(max), min: Math.round(min) };
  });
  return out;
}

// 여러 날짜의 날씨를 한 번에 가져온다. 결과: { 'YYYY-MM-DD': { code, max, min } }
export async function fetchWeather(dates) {
  const today = todayStr();
  const recent = [];
  const old = [];
  for (const d of new Set(dates)) {
    const diff = daysBetween(today, d);
    if (diff > FORECAST_DAYS_AHEAD) continue;
    (diff >= -RECENT_DAYS ? recent : old).push(d);
  }
  const out = {};
  const run = async (base, list) => {
    if (!list.length) return;
    list.sort();
    const r = await query(base, list[0], list[list.length - 1]);
    for (const d of list) if (r[d]) out[d] = r[d];
  };
  const results = await Promise.allSettled([run(FORECAST_URL, recent), run(ARCHIVE_URL, old)]);
  if (!Object.keys(out).length) {
    const fail = results.find((r) => r.status === 'rejected');
    if (fail) throw fail.reason;
  }
  return out;
}

// WMO 날씨 코드 → 아이콘
const ICONS = [
  [[0], '☀️', '맑음'],
  [[1], '🌤️', '대체로 맑음'],
  [[2], '⛅', '구름 조금'],
  [[3], '☁️', '흐림'],
  [[45, 48], '🌫️', '안개'],
  [[51, 53, 55, 56, 57], '🌦️', '이슬비'],
  [[61, 63, 65, 66, 67, 80, 81, 82], '🌧️', '비'],
  [[71, 73, 75, 77, 85, 86], '🌨️', '눈'],
  [[95, 96, 99], '⛈️', '뇌우'],
];

export function weatherInfo(code) {
  const hit = ICONS.find(([codes]) => codes.includes(code));
  return hit ? { icon: hit[1], label: hit[2] } : { icon: '🌡️', label: '날씨' };
}
