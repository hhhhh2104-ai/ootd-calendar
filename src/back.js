// 안드로이드 뒤로가기 처리
// - 아래에서 올라오는 메뉴가 열려 있으면: 메뉴만 닫는다
// - 캘린더 첫 화면에서 누르면: "앱을 종료할까요?" 안내 팝업을 띄운다
//   (웹앱은 스스로 창을 닫을 수 없어서, 팝업이 뜬 상태에서 뒤로가기를 한 번 더 누르면 종료된다)
//
// 첫 화면의 뒤로가기는 크롬의 '뒤로가기 감시(CloseWatcher)'로 받는다.
//   화면을 누르기 전이라도 뒤로가기 한 번은 앱이 받을 수 있게 크롬이 허락해 주는 기능이다.
//   이 기능이 없는 구형 크롬에서는, 화면을 처음 누를 때 기록을 한 칸 깔아 두는 예전 방식을 쓴다.
// 메뉴는 열 때마다 같은 주소로 기록을 한 칸 쌓고, 뒤로가기로 그 칸이 빠지면 메뉴를 닫는다.
import { useEffect, useRef } from 'react';

const HAS_CLOSE_WATCHER = typeof window !== 'undefined' && typeof window.CloseWatcher === 'function';

const overlays = []; // 열린 메뉴들 (위에 열린 것이 끝)
const pendingPops = []; // 앱이 직접 history.back() 한 뒤 실행할 일
let exitHandler = null;
let promptOpen = false;
let rootUrl = null; // (예전 방식) '계속 쓰기'를 누르면 돌아갈 첫 화면 주소
let rootWatcher = null;

function showPrompt() {
  promptOpen = true;
  exitHandler?.();
}

// ----- 뒤로가기 감시 방식 -----

function atRoot() {
  return (
    (history.state?.ootdDepth || 0) === 0 &&
    !history.state?.ootdOverlay &&
    overlays.length === 0 &&
    pendingPops.length === 0 &&
    !promptOpen
  );
}

// 첫 화면에 있을 때만 감시를 켜 둔다 (다른 화면이나 메뉴에서는 평소처럼 기록으로 뒤로 간다)
function syncRootWatcher() {
  if (!HAS_CLOSE_WATCHER) return;
  const want = atRoot();
  if (want && !rootWatcher) {
    try {
      const w = new window.CloseWatcher();
      w.onclose = () => {
        if (rootWatcher === w) rootWatcher = null;
        showPrompt();
      };
      rootWatcher = w;
    } catch {}
  } else if (!want && rootWatcher) {
    const w = rootWatcher;
    rootWatcher = null;
    w.destroy();
  }
}

// ----- 예전 방식 (구형 크롬) -----

function pushRoot(url) {
  history.pushState({ ootdDepth: 0 }, '', url || location.href);
  window.dispatchEvent(new Event('ootd:route'));
}

export function initBack(onExitRequest) {
  exitHandler = onExitRequest;
  if (!history.state || history.state.ootdDepth === undefined) {
    history.replaceState({ ootdDepth: 0, ootdBase: true }, '', location.href);
  }
  if (!HAS_CLOSE_WATCHER) {
    // 크롬은 사용자가 화면을 누르기 전에 쌓은 기록을 뒤로가기에서 건너뛰므로,
    // 첫 화면 칸은 화면을 처음 누를 때 쌓는다.
    window.addEventListener(
      'pointerdown',
      () => {
        if (history.state?.ootdBase && !promptOpen) pushRoot();
      },
      true,
    );
  }
  window.addEventListener('popstate', () => {
    handlePop();
    syncRootWatcher();
  });
  window.addEventListener('ootd:route', syncRootWatcher);
  syncRootWatcher();
}

function handlePop() {
  if (pendingPops.length) {
    const fn = pendingPops.shift();
    if (fn) fn();
    return;
  }
  if (overlays.length) {
    const top = overlays.pop();
    top.done = true;
    top.close();
    return;
  }
  if (promptOpen) return;
  if (!HAS_CLOSE_WATCHER && history.state?.ootdBase) showPrompt();
}

export function setRootUrl(url) {
  rootUrl = url;
}

function popEntry(entry, then) {
  const i = overlays.indexOf(entry);
  if (i >= 0) overlays.splice(i, 1);
  entry.done = true;
  pendingPops.push(then || null);
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

// 종료 팝업에서 '계속 쓰기'
export function cancelExit() {
  promptOpen = false;
  if (HAS_CLOSE_WATCHER) syncRootWatcher();
  else pushRoot(rootUrl);
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
    syncRootWatcher();
    return () => {
      // 화면에서 직접 닫았으면 쌓아 둔 기록 칸을 뺀다
      if (!entry.done) popEntry(entry);
    };
  }, [open]);
}
