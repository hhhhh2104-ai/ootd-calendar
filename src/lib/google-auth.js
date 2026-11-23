// 구글 로그인 (Google Identity Services 토큰 방식)
import { GOOGLE_CLIENT_ID, DRIVE_SCOPE, CALENDAR_SCOPE } from '../config.js';

const TOKEN_KEY = 'ootd.token';
const GRANTED_KEY = 'ootd.granted';
const CALENDAR_KEY = 'ootd.calendar';

export class AuthError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
    this.name = 'AuthError';
  }
}

let gisPromise = null;

// 구글 로그인 스크립트를 미리 불러 둔다 (버튼을 눌렀을 때 바로 창이 뜨도록)
export function preloadGis() {
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => {
      gisPromise = null;
      reject(new AuthError('gis_load_failed'));
    };
    document.head.appendChild(s);
  });
  return gisPromise;
}

function readToken() {
  try {
    return JSON.parse(localStorage.getItem(TOKEN_KEY));
  } catch {
    return null;
  }
}

export function getValidToken() {
  const t = readToken();
  if (t && t.accessToken && t.expiresAt - 60_000 > Date.now()) return t.accessToken;
  return null;
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

function saveToken(accessToken, expiresIn) {
  try {
    localStorage.setItem(
      TOKEN_KEY,
      JSON.stringify({ accessToken, expiresAt: Date.now() + (Number(expiresIn) || 3600) * 1000 }),
    );
    localStorage.setItem(GRANTED_KEY, '1');
  } catch {}
}

function hasGrantedBefore() {
  try {
    return localStorage.getItem(GRANTED_KEY) === '1';
  } catch {
    return false;
  }
}

// 지금 가진 로그인 토큰에 캘린더 읽기 권한이 들어 있는지
export function hasCalendarAccess() {
  try {
    return !!getValidToken() && localStorage.getItem(CALENDAR_KEY) === '1';
  } catch {
    return false;
  }
}

function saveCalendarFlag(granted) {
  try {
    localStorage.setItem(CALENDAR_KEY, granted ? '1' : '0');
  } catch {}
}

// 버튼을 누른 직후에 불러야 로그인 창이 막히지 않는다
export function requestToken() {
  const run = () =>
    new Promise((resolve, reject) => {
      const oauth2 = window.google.accounts.oauth2;
      const client = oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        // 드라이브(필수) + 캘린더 읽기(선택: 체크하지 않아도 앱은 동작하고 일정만 안 보인다)
        scope: `${DRIVE_SCOPE} ${CALENDAR_SCOPE}`,
        include_granted_scopes: true,
        callback: (resp) => {
          if (resp.error) return reject(new AuthError(resp.error));
          if (!oauth2.hasGrantedAllScopes(resp, DRIVE_SCOPE)) return reject(new AuthError('scope_denied'));
          saveToken(resp.access_token, resp.expires_in);
          saveCalendarFlag(oauth2.hasGrantedAllScopes(resp, CALENDAR_SCOPE));
          resolve(resp.access_token);
        },
        error_callback: (err) => reject(new AuthError(err?.type || 'popup_failed')),
      });
      // 캘린더 권한을 아직 받은 적 없으면 동의 화면을 띄운다
      const known = hasGrantedBefore() && localStorage.getItem(CALENDAR_KEY) === '1';
      client.requestAccessToken({ prompt: known ? '' : 'consent' });
    });
  if (window.google?.accounts?.oauth2) return run();
  return preloadGis().then(run);
}

export function revokeToken() {
  const t = readToken();
  clearToken();
  try {
    localStorage.removeItem(GRANTED_KEY);
    localStorage.removeItem(CALENDAR_KEY);
  } catch {}
  if (t?.accessToken && window.google?.accounts?.oauth2) {
    try {
      window.google.accounts.oauth2.revoke(t.accessToken, () => {});
    } catch {}
  }
}
