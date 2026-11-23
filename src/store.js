// 앱 상태와 저장 동작을 한곳에서 관리한다
import { useSyncExternalStore } from 'react';
import { emptyData, normalizeData, newId, nextOrder } from './lib/data.js';
import { getValidToken, requestToken, preloadGis, revokeToken, AuthError } from './lib/google-auth.js';
import { createDriveBackend } from './lib/drive-backend.js';
import { DriveError } from './lib/drive.js';
import { makePhotoVersions } from './lib/image.js';
import { putPhoto, forgetPhoto, setPhotoLoader, clearPhotoCache } from './lib/photo-cache.js';
import { fetchWeather, FORECAST_DAYS_AHEAD } from './lib/weather.js';
import { todayStr, daysBetween } from './lib/dates.js';
import { cachedHolidays, needsRefresh, refreshHolidays } from './lib/holidays.js';
import { hasCalendarAccess } from './lib/google-auth.js';
import { fetchDayEvents, CalendarError } from './lib/calendar.js';
import { isExcludedTitle } from './lib/event-filter.js';
import { parseSamsungWeightCsv, mergeWeights } from './lib/weights.js';

const DATA_CACHE_KEY = 'ootd.data';

let state = {
  phase: 'loading', // loading | welcome | ready
  data: emptyData(),
  connected: false,
  connecting: false,
  demo: false,
  error: null,
  busy: null,
  toast: null,
  addSheet: null,
  exitPrompt: false,
  holidays: cachedHolidays(), // { 'YYYY-MM-DD': '설날' }
};
const listeners = new Set();

function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(l) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function getState() {
  return state;
}

export function useStore() {
  return useSyncExternalStore(subscribe, getState);
}

// ----- 화면 보조 상태 -----

export function showToast(msg) {
  setState({ toast: { msg, id: Date.now() + Math.random() } });
}

export function clearToast() {
  setState({ toast: null });
}

export function showExitPrompt() {
  setState({ exitPrompt: true, addSheet: null });
}

export function hideExitPrompt() {
  setState({ exitPrompt: false });
}

let pendingUpload = null;
export function setPendingUpload(p) {
  pendingUpload = p;
}
export function getPendingUpload() {
  return pendingUpload;
}
export function clearPendingUpload() {
  pendingUpload = null;
}

// ----- 오류 문구 -----

export function friendlyError(e) {
  if (e instanceof AuthError) {
    switch (e.code) {
      case 'need_auth':
        return '구글 드라이브 연결이 필요해요';
      case 'scope_denied':
        return '구글 드라이브 접근 권한에 체크해야 사진을 저장할 수 있어요';
      case 'access_denied':
        return '구글 로그인을 취소했어요';
      case 'popup_closed':
        return '로그인 창이 닫혔어요. 다시 시도해 주세요';
      case 'popup_failed_to_open':
        return '로그인 창을 열지 못했어요. 다시 눌러 주세요';
      case 'gis_load_failed':
        return '구글 로그인을 불러오지 못했어요. 인터넷 연결을 확인해 주세요';
      default:
        return `구글 로그인에 실패했어요 (${e.code})`;
    }
  }
  if (e instanceof CalendarError) {
    if (e.code === 'api_disabled') return '구글 클라우드에서 Google Calendar API를 켜 주세요';
    if (e.code === 'no_permission') return '캘린더 읽기 권한이 필요해요';
    return `캘린더를 불러오지 못했어요 (${e.message})`;
  }
  if (e instanceof DriveError) {
    if (e.status === 403) return `구글 드라이브가 요청을 거절했어요 (${e.message || 403})`;
    if (e.status === 404) return '드라이브에서 파일을 찾지 못했어요';
    return `구글 드라이브 오류가 생겼어요 (${e.status})`;
  }
  if (e?.name === 'TypeError' && /fetch|network|load failed/i.test(e.message || '')) {
    return '인터넷 연결을 확인해 주세요';
  }
  return e?.message || '문제가 생겼어요';
}

function noteAuthError(e) {
  if (e instanceof AuthError && e.code === 'need_auth') setState({ connected: false });
}

// ----- 저장소 -----

let backend = null;
setPhotoLoader((id) => (backend ? backend.downloadPhoto(id) : Promise.reject(new AuthError('need_auth'))));

function readCachedData() {
  try {
    const raw = localStorage.getItem(DATA_CACHE_KEY);
    return raw ? normalizeData(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeCachedData(data) {
  if (state.demo) return;
  try {
    localStorage.setItem(DATA_CACHE_KEY, JSON.stringify(data));
  } catch {}
}

async function syncFromBackend() {
  await backend.init();
  const data = normalizeData(await backend.loadData());
  writeCachedData(data);
  setState({ phase: 'ready', data, connected: true, error: null });
  tidyPhotoFolder();
}

// 예전에 'OOTD 캘린더' 바로 아래에 올린 사진을 '사진' 폴더로 옮긴다 (앱을 열 때 뒤에서 한 번)
let tidyStarted = false;
function tidyPhotoFolder() {
  if (tidyStarted || state.demo || !backend?.movePhotosIntoFolder) return;
  tidyStarted = true;
  backend
    .movePhotosIntoFolder()
    .then((n) => {
      if (n) showToast(`사진 ${n}장을 '사진' 폴더로 정리했어요`);
    })
    .catch(() => {
      tidyStarted = false; // 다음에 다시 시도
    });
}

let started = false;
export async function startApp() {
  if (started) return;
  started = true;

  if (import.meta.env.DEV && new URLSearchParams(location.search).has('demo')) {
    const { createDemoBackend } = await import('./lib/demo-backend.js');
    backend = await createDemoBackend();
    setState({ demo: true });
    await syncFromBackend();
    return;
  }

  backend = createDriveBackend();
  preloadGis().catch(() => {});
  const cached = readCachedData();
  if (getValidToken()) {
    if (cached) setState({ phase: 'ready', data: cached, connected: true });
    try {
      await syncFromBackend();
    } catch (e) {
      noteAuthError(e);
      if (cached) {
        setState({ connected: !!getValidToken() && state.connected });
        showToast(friendlyError(e));
      } else {
        setState({ phase: 'welcome', error: e instanceof AuthError ? null : friendlyError(e) });
      }
    }
  } else if (cached) {
    setState({ phase: 'ready', data: cached, connected: false });
  } else {
    setState({ phase: 'welcome' });
  }
}

// 버튼을 누른 직후에 불러야 한다 (구글 로그인 창이 뜰 수 있음)
export async function connect() {
  if (state.connecting) return false;
  setState({ connecting: true, error: null });
  try {
    await requestToken();
    await syncFromBackend();
    return true;
  } catch (e) {
    const msg = friendlyError(e);
    setState({ error: msg });
    if (state.phase === 'ready') showToast(msg);
    return false;
  } finally {
    setState({ connecting: false });
  }
}

// 저장이 필요한 동작 전에 버튼 클릭에서 부른다. 연결돼 있으면 바로 true.
export async function requireConnection() {
  if (state.demo) return true;
  if (getValidToken()) {
    if (state.connected) return true;
    try {
      await syncFromBackend();
      return true;
    } catch (e) {
      noteAuthError(e);
      if (!(e instanceof AuthError)) {
        showToast(friendlyError(e));
        return false;
      }
    }
  }
  return connect();
}

function assertConnected() {
  if (state.demo) return;
  if (!getValidToken()) {
    setState({ connected: false });
    throw new AuthError('need_auth');
  }
}

export async function disconnect() {
  revokeToken();
  try {
    localStorage.removeItem(DATA_CACHE_KEY);
  } catch {}
  await clearPhotoCache();
  setState({ phase: 'welcome', data: emptyData(), connected: false, error: null });
}

// 드라이브의 최신 데이터를 읽고 → 고치고 → 저장 (순서대로 하나씩)
let queue = Promise.resolve();
function enqueue(fn) {
  const p = queue.then(fn, fn);
  queue = p.catch(() => {});
  return p;
}

function mutate(fn) {
  return enqueue(async () => {
    assertConnected();
    try {
      const latest = normalizeData(await backend.loadData());
      const result = fn(latest);
      latest.updatedAt = new Date().toISOString();
      await backend.saveData(latest);
      writeCachedData(latest);
      setState({ data: latest });
      return result;
    } catch (e) {
      noteAuthError(e);
      throw e;
    }
  });
}

// ----- 착용샷 -----

export function openAddSheet(opts = {}) {
  return requireConnection().then((ok) => {
    if (ok) setState({ addSheet: { date: opts.date || null, fromDay: opts.fromDay || null } });
  });
}

export function closeAddSheet() {
  setState({ addSheet: null });
}

// 사진 1장을 줄이고, 큰 사진과 썸네일을 동시에 올린다
async function uploadVersions(date, file) {
  const { full, thumb } = await makePhotoVersions(file);
  const base = `${date}_${newId().slice(0, 8)}`;
  const [fileId, thumbId] = await Promise.all([
    backend.uploadPhoto(`${base}.jpg`, full.blob),
    backend.uploadPhoto(`${base}_썸네일.jpg`, thumb.blob, { thumb: true }),
  ]);
  // 폰 임시 저장은 기다리지 않는다
  putPhoto(fileId, full.blob).catch(() => {});
  putPhoto(thumbId, thumb.blob).catch(() => {});
  return { fileId, thumbId, width: full.width, height: full.height };
}

const UPLOAD_CONCURRENCY = 3;

// items: [{ file, date }]. onItemDone(완료 개수, 전체 개수, 완료된 항목 번호)
// 실패하면 오류의 doneIndices 에 올라간 항목 번호가 들어 있다.
export async function addPhotos(items, onItemDone) {
  assertConnected();

  // 같은 날 사진은 고른 순서대로 정렬되도록 순서 번호를 미리 정한다
  const baseOrder = {};
  for (const it of items) {
    if (!(it.date in baseOrder)) baseOrder[it.date] = nextOrder(state.data, it.date);
  }

  const pending = [];
  const doneIndices = [];
  let next = 0;
  let firstError = null;

  const flush = async () => {
    if (!pending.length) return;
    const batch = pending.splice(0);
    await mutate((d) => {
      for (const r of batch) d.photos[r.id] = r;
    });
  };

  const uploadOne = async (i) => {
    const it = items[i];
    const v = await uploadVersions(it.date, it.file);
    pending.push({
      id: newId(),
      date: it.date,
      ...v,
      order: baseOrder[it.date] + i,
      createdAt: new Date().toISOString(),
    });
    doneIndices.push(i);
    onItemDone?.(doneIndices.length, items.length, i);
    if (pending.length >= 10) await flush();
  };

  const worker = async () => {
    while (!firstError && next < items.length) {
      const i = next++;
      try {
        await uploadOne(i);
      } catch (e) {
        if (!firstError) firstError = e;
      }
    }
  };

  try {
    await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, items.length) }, worker));
  } finally {
    await flush();
  }

  ensureWeather(items.map((i) => i.date));
  if (firstError) {
    firstError.doneIndices = doneIndices;
    throw firstError;
  }
  return doneIndices.length;
}

export async function deletePhoto(id) {
  const rec = state.data.photos[id];
  if (!rec) return;
  assertConnected();
  setState({ busy: '삭제하는 중…' });
  try {
    await mutate((d) => {
      delete d.photos[id];
      for (const [k, v] of Object.entries(d.outfitItems)) if (v.photoId === id) delete d.outfitItems[k];
    });
    for (const fid of [rec.fileId, rec.thumbId].filter(Boolean)) {
      try {
        await backend.trash(fid);
      } catch {}
      forgetPhoto(fid);
    }
  } finally {
    setState({ busy: null });
  }
}

export async function changePhotoDate(id, date) {
  assertConnected();
  setState({ busy: '날짜를 바꾸는 중…' });
  try {
    await mutate((d) => {
      const p = d.photos[id];
      if (!p) throw new Error('사진을 찾지 못했어요');
      p.date = date;
      p.order = nextOrder(d, date);
      p.updatedAt = new Date().toISOString();
    });
  } finally {
    setState({ busy: null });
  }
  ensureWeather([date]);
}

export async function replacePhoto(id, file) {
  assertConnected();
  const rec = state.data.photos[id];
  if (!rec) throw new Error('사진을 찾지 못했어요');
  setState({ busy: '사진을 바꾸는 중…' });
  try {
    const v = await uploadVersions(rec.date, file);
    let old = null;
    await mutate((d) => {
      const p = d.photos[id];
      if (!p) throw new Error('사진을 찾지 못했어요');
      old = [p.fileId, p.thumbId];
      Object.assign(p, { ...v, updatedAt: new Date().toISOString() });
    });
    for (const fid of (old || []).filter(Boolean)) {
      try {
        await backend.trash(fid);
      } catch {}
      forgetPhoto(fid);
    }
  } finally {
    setState({ busy: null });
  }
}

// ----- 일정 (구글 캘린더) -----

const eventCache = new Map(); // date -> { at, events }
const EVENT_CACHE_MS = 5 * 60 * 1000;

const DEMO_EVENTS = [
  { id: 'demo-1', title: '7시 운동', allDay: false },
  { id: 'demo-2', title: '우가 카페', allDay: false },
  { id: 'demo-3', title: '5시 네일', allDay: false },
  { id: 'demo-4', title: '수질 교육 청주', allDay: true },
  { id: 'demo-5', title: '6시 불당동', allDay: false },
];

// 그날 일정 (거르기 전 전체). 연결이 안 돼 있으면 AuthError / CalendarError
export async function loadDayEvents(date, { fresh = false } = {}) {
  const hit = eventCache.get(date);
  if (!fresh && hit && Date.now() - hit.at < EVENT_CACHE_MS) return hit.events;
  let events;
  if (state.demo) {
    await new Promise((r) => setTimeout(r, 200));
    events = DEMO_EVENTS.map((e) => ({ ...e, id: `${e.id}-${date}` }));
  } else {
    if (!hasCalendarAccess()) throw new AuthError('need_calendar');
    events = await fetchDayEvents(date);
  }
  eventCache.set(date, { at: Date.now(), events });
  return events;
}

export function visibleEvents(events, data) {
  return events.filter((e) => !isExcludedTitle(e.title) && !data.hiddenEvents?.[e.id]);
}

// 버튼을 누른 직후에 부른다 (캘린더 권한 동의 화면)
export async function connectCalendar() {
  if (state.demo) return true;
  eventCache.clear();
  return connect();
}

export async function hideEvent(event, date) {
  assertConnected();
  await mutate((d) => {
    d.hiddenEvents[event.id] = { title: event.title, date, hiddenAt: new Date().toISOString() };
  });
}

export async function unhideEvent(id) {
  assertConnected();
  await mutate((d) => {
    delete d.hiddenEvents[id];
  });
}

// ----- 몸무게 -----

export async function importWeightsFile(file) {
  assertConnected();
  const text = await file.text();
  const imported = parseSamsungWeightCsv(text);
  const days = Object.keys(imported).length;
  if (!days) throw new Error('파일에 몸무게 기록이 없어요');
  setState({ busy: '몸무게를 가져오는 중…' });
  try {
    const result = await mutate((d) => mergeWeights(d.weights, imported));
    return { days, ...result };
  } finally {
    setState({ busy: null });
  }
}

// kg 가 null 이면 그날 기록을 지운다
export async function setWeight(date, kg) {
  assertConnected();
  await mutate((d) => {
    if (kg == null) delete d.weights[date];
    else d.weights[date] = { kg: Math.round(kg * 10) / 10, time: null, source: 'manual' };
  });
}

// ----- 공휴일 -----

const holidayInflight = new Set();

export async function ensureHolidays(years) {
  for (const y of new Set(years)) {
    if (holidayInflight.has(y) || !needsRefresh(y)) continue;
    holidayInflight.add(y);
    try {
      if (await refreshHolidays(y)) setState({ holidays: cachedHolidays() });
    } catch {
      // 못 받으면 저장된 목록(없으면 검은색)으로 보여준다
    } finally {
      holidayInflight.delete(y);
    }
  }
}

// ----- 날씨 -----

const weatherInflight = new Set();

export async function ensureWeather(dates) {
  const today = todayStr();
  const need = [...new Set(dates)].filter((d) => {
    if (weatherInflight.has(d)) return false;
    if (daysBetween(today, d) > FORECAST_DAYS_AHEAD) return false;
    const w = state.data.weather[d];
    if (!w) return true;
    if (w.final) return false;
    return w.fetchedOn !== today || d < today;
  });
  if (!need.length) return;
  need.forEach((d) => weatherInflight.add(d));
  try {
    const got = await fetchWeather(need);
    const entries = {};
    for (const [d, w] of Object.entries(got)) entries[d] = { ...w, final: d < today, fetchedOn: today };
    if (!Object.keys(entries).length) return;
    if (state.demo || (state.connected && getValidToken())) {
      try {
        await mutate((data) => {
          Object.assign(data.weather, entries);
        });
        return;
      } catch {}
    }
    // 연결이 끊겨 있으면 화면에만 보여주고, 다음에 다시 저장한다
    setState({ data: { ...state.data, weather: { ...state.data.weather, ...entries } } });
  } catch {
    // 날씨를 못 가져와도 다른 기능에는 영향 없음
  } finally {
    need.forEach((d) => weatherInflight.delete(d));
  }
}
