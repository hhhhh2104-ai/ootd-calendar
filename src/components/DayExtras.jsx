// 상세 화면 사진 아래의 접이식 칸: 일정, 몸무게
// 사생활 보호를 위해 상세 화면을 열 때마다, 그리고 앱이 백그라운드로 가면 항상 접힌다.
import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import {
  useStore,
  loadDayEvents,
  visibleEvents,
  connectCalendar,
  hideEvent,
  setWeight,
  requireConnection,
  showToast,
  friendlyError,
} from '../store.js';
import { AuthError } from '../lib/google-auth.js';
import { CalendarError } from '../lib/calendar.js';

function Fold({ title, children }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') setOpen(false);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
  return (
    <section className={`fold ${open ? 'open' : ''}`}>
      <button className="fold-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>{title}</span>
        <Icon name="chevron-down" size={20} />
      </button>
      {open && <div className="fold-body">{children}</div>}
    </section>
  );
}

// 길게 누르기 (0.55초)
function useLongPress(onLongPress) {
  const timer = useRef(null);
  const start = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(onLongPress, 550);
  };
  const cancel = () => clearTimeout(timer.current);
  return {
    onPointerDown: start,
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e) => e.preventDefault(),
  };
}

function EventRow({ event, date }) {
  const press = useLongPress(async () => {
    if (!window.confirm(`'${event.title}' 일정을 숨길까요?\n설정 → 숨긴 일정에서 되돌릴 수 있어요.`)) return;
    if (!(await requireConnection())) return;
    try {
      await hideEvent(event, date);
      showToast('일정을 숨겼어요');
    } catch (e) {
      showToast(friendlyError(e));
    }
  });
  return (
    <li className="event-row" {...press}>
      {event.title}
    </li>
  );
}

function EventsPanel({ date }) {
  const { data } = useStore();
  const [st, setSt] = useState({ status: 'loading', events: [] });

  const load = async (fresh = false) => {
    setSt((s) => ({ ...s, status: 'loading' }));
    try {
      const events = await loadDayEvents(date, { fresh });
      setSt({ status: 'ok', events });
    } catch (e) {
      if (e instanceof AuthError || (e instanceof CalendarError && e.code === 'no_permission')) {
        setSt({ status: 'need_calendar', events: [] });
      } else {
        setSt({ status: 'error', events: [], message: friendlyError(e) });
      }
    }
  };

  useEffect(() => {
    load();
  }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  const connectNow = async () => {
    if (await connectCalendar()) load(true);
  };

  if (st.status === 'loading') return <p className="fold-muted">불러오는 중…</p>;
  if (st.status === 'need_calendar') {
    return (
      <div className="fold-connect">
        <p className="fold-muted">구글 캘린더를 읽으려면 권한이 필요해요.</p>
        <button className="text-btn" onClick={connectNow}>
          캘린더 연결
        </button>
      </div>
    );
  }
  if (st.status === 'error') return <p className="fold-muted">{st.message}</p>;
  const list = visibleEvents(st.events, data);
  if (!list.length) return <p className="fold-muted">일정 없음</p>;
  return (
    <ul className="event-list">
      {list.map((e) => (
        <EventRow key={e.id} event={e} date={date} />
      ))}
    </ul>
  );
}

function WeightPanel({ date }) {
  const { data } = useStore();
  const w = data.weights?.[date];
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');

  const startEdit = async () => {
    if (!(await requireConnection())) return;
    setValue(w ? String(w.kg) : '');
    setEditing(true);
  };

  const save = async (kg) => {
    try {
      await setWeight(date, kg);
      setEditing(false);
    } catch (e) {
      showToast(friendlyError(e));
    }
  };

  if (editing) {
    const num = parseFloat(value);
    const valid = num >= 20 && num <= 300;
    return (
      <div className="weight-edit">
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          min="20"
          max="300"
          placeholder="예: 55.3"
          value={value}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
        />
        <span className="unit">kg</span>
        <button className="text-btn" disabled={!valid} onClick={() => save(num)}>
          저장
        </button>
        {w && (
          <button className="text-btn danger" onClick={() => save(null)}>
            지우기
          </button>
        )}
        <button className="text-btn muted" onClick={() => setEditing(false)}>
          취소
        </button>
      </div>
    );
  }

  return (
    <div className="weight-view">
      {w ? <span className="weight-value">{w.kg.toFixed(1)} kg</span> : <span className="fold-muted">기록 없음</span>}
      <button className="text-btn" onClick={startEdit}>
        {w ? '수정' : '입력'}
      </button>
    </div>
  );
}

export default function DayExtras({ date }) {
  return (
    <div className="day-extras">
      <Fold title="일정">
        <EventsPanel date={date} />
      </Fold>
      <Fold title="몸무게">
        <WeightPanel date={date} />
      </Fold>
    </div>
  );
}
