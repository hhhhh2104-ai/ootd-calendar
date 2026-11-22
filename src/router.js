// 주소 뒤 # 부분으로 화면을 바꾼다. 안드로이드 뒤로가기도 그대로 동작한다.
//   #/?m=2026-11        캘린더
//   #/day/2026-11-22    상세
//   #/upload            사진 올리기
//   #/settings          설정
import { useMemo, useSyncExternalStore } from 'react';
import { isDateStr } from './lib/dates.js';
import { runWhenSettled, setRootUrl, logBack } from './back.js';

const EVT = 'ootd:route';

function subscribe(cb) {
  window.addEventListener('popstate', cb);
  window.addEventListener('hashchange', cb);
  window.addEventListener(EVT, cb);
  return () => {
    window.removeEventListener('popstate', cb);
    window.removeEventListener('hashchange', cb);
    window.removeEventListener(EVT, cb);
  };
}

export function parseRoute(hash) {
  const h = (hash || '').replace(/^#/, '') || '/';
  const [path, qs] = h.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'day' && isDateStr(parts[1])) return { name: 'day', date: parts[1], query };
  if (parts[0] === 'upload') return { name: 'upload', query };
  if (parts[0] === 'settings') return { name: 'settings', query };
  return { name: 'calendar', query };
}

export function useRoute() {
  const hash = useSyncExternalStore(subscribe, () => location.hash);
  return useMemo(() => parseRoute(hash), [hash]);
}

export function navigate(to, { replace = false } = {}) {
  // 메뉴가 열려 있거나 닫히는 중이면 그 기록 정리가 끝난 뒤에 이동한다
  runWhenSettled(() => {
    const depth = history.state?.ootdDepth || 0;
    const url = '#' + to;
    if (replace) {
      history.replaceState({ ootdDepth: depth, ootdBase: history.state?.ootdBase }, '', url);
      if (depth === 0) setRootUrl(location.href);
      logBack(`replace ${to}`);
    } else {
      history.pushState({ ootdDepth: depth + 1 }, '', url);
      logBack(`push ${to}`);
    }
    window.dispatchEvent(new Event(EVT));
  });
}

export function goBack(fallback = '/') {
  runWhenSettled(() => {
    if ((history.state?.ootdDepth || 0) > 0) {
      logBack('app back (screen)');
      history.back();
    } else navigate(fallback, { replace: true });
  });
}
