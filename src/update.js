// 앱을 백그라운드에서 다시 켤 때 새 버전이 있는지 확인하고, 안전한 화면이면 자동으로 새로고침한다.
import { getState } from './store.js';
import { parseRoute } from './router.js';

const SCRIPT_RE = /assets\/index-[\w-]+\.js/;
let lastCheck = 0;

function currentScript() {
  const el = document.querySelector('script[type="module"][src*="assets/index-"]');
  return el ? (el.getAttribute('src').match(SCRIPT_RE) || [null])[0] : null;
}

function safeToReload() {
  const s = getState();
  const route = parseRoute(location.hash);
  if (!['calendar', 'settings'].includes(route.name)) return false;
  if (s.addSheet || s.busy || s.exitPrompt) return false;
  if (document.querySelector('.sheet, .overlay, .dialog')) return false;
  return true;
}

async function checkForUpdate() {
  if (Date.now() - lastCheck < 30_000) return;
  lastCheck = Date.now();
  const mine = currentScript();
  if (!mine) return;
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}?ootd-check=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const latest = ((await res.text()).match(SCRIPT_RE) || [null])[0];
    if (!latest || latest === mine) return;
    navigator.serviceWorker?.getRegistration().then((r) => r?.update()).catch(() => {});
    if (safeToReload()) location.reload();
    // 안전하지 않은 화면(사진 올리는 중 등)이면 다음에 다시 켤 때 적용
    else lastCheck = 0;
  } catch {}
}

export function initUpdateCheck() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate();
  });
}
