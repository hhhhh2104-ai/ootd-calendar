import { useEffect } from 'react';
import Icon from './Icon.jsx';
import { useStore, clearToast, connect } from '../store.js';
import { formatKoreanDate } from '../lib/dates.js';
import { TABS } from '../config.js';
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
