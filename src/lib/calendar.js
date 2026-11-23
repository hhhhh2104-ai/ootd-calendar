// 구글 캘린더 일정 읽기 (기본 캘린더, 읽기 전용)
import { getValidToken, clearToken, AuthError } from './google-auth.js';
import { addDays } from './dates.js';

const API = 'https://www.googleapis.com/calendar/v3';

export class CalendarError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code; // no_permission | api_disabled | failed
    this.name = 'CalendarError';
  }
}

// 그날(한국 시간) 걸쳐 있는 일정. 결과: [{ id, title, allDay }]
export async function fetchDayEvents(date) {
  const token = getValidToken();
  if (!token) throw new AuthError('need_auth');
  const p = new URLSearchParams({
    timeMin: `${date}T00:00:00+09:00`,
    timeMax: `${addDays(date, 1)}T00:00:00+09:00`,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
    timeZone: 'Asia/Seoul',
  });
  const res = await fetch(`${API}/calendars/primary/events?${p}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    clearToken();
    throw new AuthError('need_auth');
  }
  if (!res.ok) {
    let reason = '';
    let message = '';
    try {
      const j = await res.json();
      reason = j?.error?.errors?.[0]?.reason || j?.error?.status || '';
      message = j?.error?.message || '';
    } catch {}
    if (/accessNotConfigured|SERVICE_DISABLED/i.test(reason) || /has not been used|is disabled/i.test(message)) {
      throw new CalendarError('api_disabled', message);
    }
    if (res.status === 403) throw new CalendarError('no_permission', message);
    throw new CalendarError('failed', message || `캘린더 오류 (${res.status})`);
  }
  const j = await res.json();
  return (j.items || [])
    .filter((e) => e.status !== 'cancelled')
    .filter((e) => !(e.attendees || []).some((a) => a.self && a.responseStatus === 'declined'))
    .map((e) => ({ id: e.id, title: (e.summary || '').trim(), allDay: !!e.start?.date }));
}
