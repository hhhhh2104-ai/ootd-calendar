// 안드로이드 뒤로가기 처리
// - 아래에서 올라오는 메뉴가 열려 있으면: 메뉴만 닫는다
// - 캘린더 첫 화면에서 누르면: "앱을 종료할까요?" 팝업을 띄운다
//
// 방법: 앱을 처음 열 때 기록을 [바닥, 첫 화면] 두 칸으로 만든다. 뒤로가기로 '바닥'에 내려오면 종료 팝업.
//       메뉴를 열 때마다 같은 주소로 기록을 한 칸 쌓고, 뒤로가기로 그 칸이 빠지면 메뉴를 닫는다.
import { useEffect, useRef, useSyncExternalStore } from 'react';

const overlays = []; // 열린 메뉴들 (위에 열린 것이 끝)
const pendingPops = []; // 앱이 직접 history.back() 한 뒤 실행할 일
let exitHandler = null;
let promptOpen = false;
let rootUrl = null; // 종료 팝업에서 '취소'하면 돌아갈 첫 화면 주소

// ----- 진단 기록 (뒤로가기 문제 확인용, 원인 찾으면 지운다) -----
const LOG_KEY = 'ootd.backlog';
let backLog = (() => {
  try {
    return JSON.parse(sessionStorage.getItem(LOG_KEY)) || [];
  } catch {
    return [];
  }
})();
const logListeners = new Set();
let promptBackCount = 0;

function short(st) {
  if (!st) return 'null';
  const parts = [`d${st.ootdDepth ?? '?'}`];
  if (st.ootdBase) parts.push('BASE');
  if (st.ootdOverlay) parts.push('OV');
  return parts.join(' ');
}

export function logBack(msg) {
  const t = new Date();
  const time = `${String(t.getMinutes()).padStart(2, '0')}:${String(t.getSeconds()).padStart(2, '0')}`;
  backLog = [...backLog, `${time} ${msg} | len${history.length} ${short(history.state)}`].slice(-40);
  try {
    sessionStorage.setItem(LOG_KEY, JSON.stringify(backLog));
  } catch {}
  logListeners.forEach((l) => l());
}

export function useBackLog() {
  return useSyncExternalStore(
    (l) => {
      logListeners.add(l);
      return () => logListeners.delete(l);
    },
    () => backLog,
  );
}

export function getPromptBackCount() {
  return promptBackCount;
}

function activation() {
  const ua = navigator.userActivation;
  return ua ? `act${ua.isActive ? 'Y' : 'N'}` : 'act?';
}

function pushRoot(url, why) {
  history.pushState({ ootdDepth: 0 }, '', url || location.href);
  logBack(`push root (${why}) ${activation()}`);
  window.dispatchEvent(new Event('ootd:route'));
}

export function initBack(onExitRequest) {
  exitHandler = onExitRequest;
  const navType = performance.getEntriesByType?.('navigation')?.[0]?.type || '?';
  const standalone = matchMedia('(display-mode: standalone)').matches ? 'app' : 'tab';
  logBack(`load ${navType} ${standalone} before=${short(history.state)}`);
  if (!history.state || history.state.ootdDepth === undefined) {
    history.replaceState({ ootdDepth: 0, ootdBase: true }, '', location.href);
    logBack('base set');
  }
  // 크롬은 사용자가 화면을 누르기 전에 쌓은 기록을 뒤로가기에서 건너뛰므로,
  // 첫 화면 칸은 화면을 처음 누를 때 쌓는다.
  window.addEventListener(
    'pointerdown',
    () => {
      if (history.state?.ootdBase && !promptOpen) pushRoot(null, 'tap');
    },
    true,
  );
  window.addEventListener('popstate', () => {
    if (pendingPops.length) {
      logBack('pop (app)');
      const fn = pendingPops.shift();
      if (fn) fn();
      return;
    }
    if (overlays.length) {
      logBack('pop -> close menu');
      const top = overlays.pop();
      top.done = true;
      top.close();
      return;
    }
    if (promptOpen) {
      promptBackCount++;
      logBack(`pop while prompt #${promptBackCount}`);
      return;
    }
    if (history.state?.ootdBase) {
      logBack('pop -> exit prompt');
      promptOpen = true;
      promptBackCount = 0;
      exitHandler?.();
      return;
    }
    logBack('pop -> page');
  });
  document.addEventListener('visibilitychange', () => logBack(`visibility ${document.visibilityState}`));
}

export function setRootUrl(url) {
  rootUrl = url;
}

function popEntry(entry, then) {
  const i = overlays.indexOf(entry);
  if (i >= 0) overlays.splice(i, 1);
  entry.done = true;
  pendingPops.push(then || null);
  logBack('app back (close menu entry)');
  history.back();
}

// 메뉴가 닫히는 중이면 그게 끝난 뒤에, 메뉴가 열려 있으면 그 기록을 빼고 나서 fn 실행
export function runWhenSettled(fn) {
  if (pendingPops.length) {
    const i = pendingPops.length - 1;
    const prev = pendingPops[i];
    pendingPops[i] = () => {
      if (prev) prev();
      runWhenSettled(fn);
    };
    return;
  }
  if (history.state?.ootdOverlay) {
    const top = overlays[overlays.length - 1];
    if (top) {
      popEntry(top, fn);
      return;
    }
  }
  fn();
}

// 종료 팝업에서 '취소'를 누르면 다시 첫 화면 칸을 쌓는다
export function cancelExit() {
  promptOpen = false;
  pushRoot(rootUrl, 'cancel');
}

// 메뉴(시트)가 열려 있는 동안 뒤로가기를 누르면 onClose 를 부른다
export function useBackClose(open, onClose) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const entry = { done: false, close: () => closeRef.current?.() };
    overlays.push(entry);
    history.pushState({ ootdDepth: history.state?.ootdDepth || 0, ootdOverlay: true }, '', location.href);
    logBack(`push menu ${activation()}`);
    return () => {
      // 화면에서 직접 닫았으면 쌓아 둔 기록 칸을 뺀다
      if (!entry.done) popEntry(entry);
    };
  }, [open]);
}
