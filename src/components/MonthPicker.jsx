import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { Sheet } from './ui.jsx';
import { currentMonth } from '../lib/dates.js';

export default function MonthPicker({ open, value, onClose, onSelect }) {
  const [year, setYear] = useState(value.y);
  useEffect(() => {
    if (open) setYear(value.y);
  }, [open, value.y]);
  const now = currentMonth();

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="mp-year">
        <button className="icon-btn" aria-label="이전 해" onClick={() => setYear((y) => y - 1)}>
          <Icon name="chevron-left" />
        </button>
        <span>{year}년</span>
        <button className="icon-btn" aria-label="다음 해" onClick={() => setYear((y) => y + 1)}>
          <Icon name="chevron-right" />
        </button>
      </div>
      <div className="mp-grid">
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
          const sel = year === value.y && m === value.m;
          const isNow = year === now.y && m === now.m;
          return (
            <button
              key={m}
              className={`${sel ? 'sel' : ''} ${isNow ? 'now' : ''}`}
              onClick={() => onSelect({ y: year, m })}
            >
              {m}월
            </button>
          );
        })}
      </div>
      <div className="mp-foot">
        <button className="chip" onClick={() => onSelect(now)}>
          이번 달로 가기
        </button>
      </div>
    </Sheet>
  );
}
