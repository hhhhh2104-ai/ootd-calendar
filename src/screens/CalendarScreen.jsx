import { useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import PhotoImg from '../components/PhotoImg.jsx';
import MonthPicker from '../components/MonthPicker.jsx';
import { useStore, openAddSheet } from '../store.js';
import { navigate } from '../router.js';
import { groupPhotosByDate } from '../lib/data.js';
import {
  WEEKDAYS,
  buildMonthCells,
  currentMonth,
  formatMonthShort,
  monthKey,
  parseMonthKey,
  shiftMonth,
  todayStr,
} from '../lib/dates.js';

export default function CalendarScreen({ monthParam }) {
  const { data, demo } = useStore();
  const month = parseMonthKey(monthParam) || currentMonth();
  const now = currentMonth();
  const isThisMonth = month.y === now.y && month.m === now.m;
  const today = todayStr();
  const byDate = useMemo(() => groupPhotosByDate(data), [data]);
  const cells = useMemo(() => buildMonthCells(month), [month.y, month.m]);
  const [picker, setPicker] = useState(false);
  const touch = useRef(null);

  const goMonth = (m) => navigate(`/?m=${monthKey(m)}`, { replace: true });

  const onTouchStart = (e) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e) => {
    if (!touch.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.current.x;
    const dy = t.clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) goMonth(shiftMonth(month, dx < 0 ? 1 : -1));
  };

  return (
    <div className="screen calendar">
      <header className="cal-header">
        <button className="month-btn" onClick={() => setPicker(true)}>
          {formatMonthShort(month)}
          <Icon name="chevron-down" size={22} strokeWidth={2.4} />
        </button>
        <div className="cal-actions">
          {demo && <span className="demo-badge">데모</span>}
          {!isThisMonth && (
            <button className="chip" onClick={() => goMonth(now)}>
              오늘
            </button>
          )}
          <button className="icon-btn" aria-label="착용샷 추가" onClick={() => openAddSheet()}>
            <Icon name="plus-square" size={28} strokeWidth={1.8} />
          </button>
          <button className="icon-btn" aria-label="설정" onClick={() => navigate('/settings')}>
            <Icon name="settings" size={26} strokeWidth={1.8} />
          </button>
        </div>
      </header>

      <div className="weekdays">
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>

      <div className="grid" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {cells.map((c, i) => {
          if (!c) return <div key={`e${i}`} className="cell empty" />;
          const photos = byDate.get(c.date);
          const has = !!photos?.length;
          const cls = [
            'cell',
            c.weekday === 0 ? 'sun' : c.weekday === 6 ? 'sat' : '',
            c.date === today ? 'today' : '',
            has ? 'has-photo' : '',
          ].join(' ');
          return (
            <button
              key={c.date}
              className={cls}
              aria-label={`${c.day}일${has ? ` 착용샷 ${photos.length}장` : ''}`}
              onClick={() => (has ? navigate(`/day/${c.date}`) : openAddSheet({ date: c.date }))}
            >
              {has ? (
                <>
                  <PhotoImg fileId={photos[0].thumbId || photos[0].fileId} />
                  {photos.length > 1 && <span className="count">{photos.length}</span>}
                </>
              ) : (
                <span className="num">{c.day}</span>
              )}
            </button>
          );
        })}
      </div>

      <MonthPicker
        open={picker}
        value={month}
        onClose={() => setPicker(false)}
        onSelect={(m) => {
          setPicker(false);
          goMonth(m);
        }}
      />
    </div>
  );
}
