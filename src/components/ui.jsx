import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { useStore, clearToast, connect, hideExitPrompt } from '../store.js';
import { useBackClose, cancelExit, useBackLog, logBack, getPromptBackCount } from '../back.js';
import { formatKoreanDate } from '../lib/dates.js';
import { TABS, APP_VERSION } from '../config.js';
import { navigate } from '../router.js';

export function TopBar({ title, onBack, right = null }) {
  return (
    <header className="topbar">
      <button className="icon-btn" aria-label="뒤로" onClick={onBack}>
        <Icon name="chevron-left" size={28} />
      </button>
      <h1>{title}</h1>
      <div className="topbar-right">{right}</div>
    </header>
  );
}

export function Sheet({ open, onClose, title, children }) {
  useBackClose(open, onClose);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {title && <div className="sheet-title">{title}</div>}
        {children}
      </div>
    </div>
  );
}

// 날짜를 한국식으로 보여주고, 누르면 달력이 열린다
export function DateField({ value, onChange }) {
  return (
    <label className="date-field">
      <span>{formatKoreanDate(value)}</span>
      <Icon name="chevron-down" size={16} />
      <input
        type="date"
        value={value}
        onClick={(e) => {
          try {
            e.currentTarget.showPicker();
          } catch {}
        }}
        onChange={(e) => e.target.value && onChange(e.target.value)}
      />
    </label>
  );
}

export function Toast() {
  const { toast } = useStore();
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(clearToast, 2800);
    return () => clearTimeout(t);
  }, [toast]);
  if (!toast) return null;
  return (
    <div className="toast" role="status" key={toast.id}>
      {toast.msg}
    </div>
  );
}

export function BusyOverlay() {
  const { busy } = useStore();
  if (!busy) return null;
  return (
    <div className="overlay">
      <div className="progress-card">
        <div className="spinner" />
        <p>{busy}</p>
      </div>
    </div>
  );
}

// 첫 화면에서 뒤로가기를 누르면 뜨는 종료 확인 팝업
// (이 팝업이 떠 있을 때 뒤로가기를 한 번 더 누르면 앱이 닫힌다)
export function ExitDialog() {
  const { exitPrompt } = useStore();
  const [hint, setHint] = useState(false);
  const log = useBackLog();
  useEffect(() => {
    if (!exitPrompt) setHint(false);
  }, [exitPrompt]);
  if (!exitPrompt) return null;

  const stay = () => {
    hideExitPrompt();
    cancelExit();
  };
  const exit = () => {
    logBack('window.close()');
    window.close();
    // 브라우저가 창 닫기를 막으면 안내 문구를 보여준다
    setTimeout(() => {
      logBack(`after close: closed=${window.closed}`);
      setHint(true);
    }, 300);
  };

  return (
    <div className="dialog-backdrop" onClick={stay}>
      <div className="dialog" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <p className="dialog-title">앱을 종료할까요?</p>
        {hint && <p className="dialog-hint">뒤로가기를 한 번 더 누르면 종료돼요</p>}
        <div className="dialog-actions">
          <button onClick={stay}>취소</button>
          <button className="strong" onClick={exit}>
            종료
          </button>
        </div>
        {/* 진단 정보 (뒤로가기 문제 확인용, 원인 찾으면 지운다) */}
        <pre className="diag">
          {`v${APP_VERSION} · 팝업 후 뒤로가기 ${getPromptBackCount()}회 · len ${history.length}\n`}
          {log.slice(-16).join('\n')}
        </pre>
      </div>
    </div>
  );
}

export function ConnectBanner() {
  const { connecting } = useStore();
  return (
    <div className="connect-banner">
      <span>구글 드라이브 연결이 끊겼어요</span>
      <button onClick={() => connect()} disabled={connecting}>
        {connecting ? '연결 중…' : '다시 연결'}
      </button>
    </div>
  );
}

// 하단 탭 (탭이 2개 이상이 되면 나타난다: 옷장, 통계 추가 대비)
export function BottomNav({ active }) {
  if (TABS.length < 2) return null;
  return (
    <nav className="bottom-nav">
      {TABS.map((t) => (
        <button
          key={t.key}
          className={t.key === active ? 'active' : ''}
          onClick={() => navigate(t.path, { replace: true })}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
