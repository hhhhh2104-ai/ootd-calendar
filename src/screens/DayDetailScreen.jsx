import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import PhotoImg from '../components/PhotoImg.jsx';
import WeatherBadge from '../components/WeatherBadge.jsx';
import { TopBar, Sheet } from '../components/ui.jsx';
import {
  useStore,
  ensureWeather,
  ensureHolidays,
  openAddSheet,
  requireConnection,
  deletePhoto,
  changePhotoDate,
  replacePhoto,
  showToast,
  friendlyError,
} from '../store.js';
import { goBack, navigate } from '../router.js';
import { photosOnDate } from '../lib/data.js';
import { formatKoreanDate, formatMonthDay, formatMonthLong, parseDateStr } from '../lib/dates.js';

export default function DayDetailScreen({ date, initialIndex = 0 }) {
  const { data, holidays } = useStore();
  const photos = useMemo(() => photosOnDate(data, date), [data, date]);
  const holiday = holidays[date];
  const [idx, setIdx] = useState(initialIndex);
  const [menu, setMenu] = useState(false);
  const trackRef = useRef(null);
  const replaceRef = useRef(null);
  const d = parseDateStr(date);
  const cur = Math.max(0, Math.min(idx, photos.length - 1));
  const current = photos[cur];

  useEffect(() => {
    ensureWeather([date]);
    ensureHolidays([Number(date.slice(0, 4))]);
  }, [date]);

  useLayoutEffect(() => {
    const el = trackRef.current;
    if (el && initialIndex > 0) el.scrollLeft = initialIndex * el.clientWidth;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    setIdx(Math.round(el.scrollLeft / el.clientWidth));
  };

  const openMenu = async () => {
    if (await requireConnection()) setMenu(true);
  };

  const run = async (fn, okMsg) => {
    setMenu(false);
    try {
      await fn();
      if (okMsg) showToast(okMsg);
    } catch (e) {
      showToast(friendlyError(e));
    }
  };

  const onDelete = () => {
    if (!current) return;
    if (!window.confirm('이 사진을 삭제할까요?\n구글 드라이브 휴지통으로 옮겨져요.')) return;
    run(() => deletePhoto(current.id), '삭제했어요');
  };

  const onChangeDate = (newDate) => {
    if (!current || !newDate || newDate === date) return;
    const id = current.id;
    run(async () => {
      await changePhotoDate(id, newDate);
      navigate(`/day/${newDate}`, { replace: true });
    }, `${formatMonthDay(newDate)}로 옮겼어요`);
  };

  const onReplace = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !current) return;
    const id = current.id;
    run(() => replacePhoto(id, file), '사진을 바꿨어요');
  };

  return (
    <div className="screen day">
      <TopBar
        title={formatMonthLong({ y: d.getFullYear(), m: d.getMonth() + 1 })}
        onBack={() => goBack(`/?m=${date.slice(0, 7)}`)}
      />

      <div className="day-head">
        <span className="day-title">
          {formatKoreanDate(date)}
          {holiday && <span className="holiday-name">{holiday}</span>}
        </span>
        <WeatherBadge date={date} />
      </div>

      {photos.length > 0 ? (
        <div className="carousel-wrap">
          <div className="carousel" ref={trackRef} onScroll={onScroll}>
            {photos.map((p) => (
              <div className="slide" key={p.id}>
                <PhotoImg fileId={p.fileId} previewId={p.thumbId} fit="contain" />
              </div>
            ))}
          </div>
          {photos.length > 1 && (
            <span className="counter">
              {cur + 1} / {photos.length}
            </span>
          )}
        </div>
      ) : (
        <div className="day-empty">이 날의 착용샷이 없어요</div>
      )}

      {/* 나중에: 그날 입은 옷 목록이 여기에 들어간다 (data.outfitItems) */}

      {photos.length > 0 && (
        <div className="day-tools">
          <button className="icon-btn" aria-label="사진 메뉴" onClick={openMenu}>
            <Icon name="more" />
          </button>
        </div>
      )}

      <div className="day-add">
        <button className="pill" onClick={() => openAddSheet({ date, fromDay: date })}>
          <Icon name="calendar-plus" size={22} strokeWidth={1.7} />
          {formatMonthDay(date)}에 새 데일리룩 추가
        </button>
      </div>

      <Sheet open={menu} onClose={() => setMenu(false)} title={photos.length > 1 ? `${cur + 1}번째 사진` : '이 사진'}>
        <label className="sheet-item">
          <Icon name="calendar" />
          날짜 바꾸기
          <input type="date" value={date} onChange={(e) => onChangeDate(e.target.value)} />
        </label>
        <button className="sheet-item" onClick={() => replaceRef.current?.click()}>
          <Icon name="swap" />
          사진 바꾸기
        </button>
        <button className="sheet-item danger" onClick={onDelete}>
          <Icon name="trash" />
          삭제
        </button>
        <input ref={replaceRef} type="file" accept="image/*" hidden onChange={onReplace} />
      </Sheet>
    </div>
  );
}
