import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { TopBar, DateField } from '../components/ui.jsx';
import {
  addPhotos,
  clearPendingUpload,
  friendlyError,
  getPendingUpload,
  requireConnection,
  showToast,
} from '../store.js';
import { goBack, navigate } from '../router.js';
import { readExifDate } from '../lib/image.js';
import { todayStr } from '../lib/dates.js';

const SOURCE_LABEL = {
  preset: '선택한 날짜',
  exif: '촬영일',
  today: '오늘',
  manual: '직접 선택',
};

export default function UploadScreen() {
  const pending = useMemo(() => getPendingUpload(), []);
  const [items, setItems] = useState(() =>
    (pending?.files || []).map((file, i) => ({
      key: `${i}-${file.name}-${file.size}`,
      file,
      url: URL.createObjectURL(file),
      date: pending.date || todayStr(),
      source: pending.date ? 'preset' : 'today',
    })),
  );
  const [progress, setProgress] = useState(null);
  const doneRef = useRef(0);

  useEffect(() => {
    if (!pending) {
      navigate('/', { replace: true });
      return;
    }
    const urls = items.map((it) => it.url);
    let alive = true;
    // 날짜를 정하지 않고 올리면 사진의 촬영일로 날짜를 채운다
    if (!pending.date) {
      items.forEach(async (it) => {
        const d = await readExifDate(it.file);
        if (alive && d) {
          setItems((prev) =>
            prev.map((p) => (p.key === it.key && p.source === 'today' ? { ...p, date: d, source: 'exif' } : p)),
          );
        }
      });
    }
    return () => {
      alive = false;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setDate = (key, date) =>
    setItems((prev) => prev.map((p) => (p.key === key ? { ...p, date, source: 'manual' } : p)));

  const remove = (key) => {
    const next = items.filter((p) => p.key !== key);
    setItems(next);
    if (!next.length) goBack();
  };

  const upload = async () => {
    if (!items.length || progress) return;
    if (!(await requireConnection())) return;
    doneRef.current = 0;
    setProgress({ done: 0, total: items.length });
    try {
      await addPhotos(
        items.map((i) => ({ file: i.file, date: i.date })),
        (done, total) => {
          doneRef.current = done;
          setProgress({ done, total });
        },
      );
      showToast(`${items.length}장을 올렸어요`);
      clearPendingUpload();
      const dates = [...new Set(items.map((i) => i.date))].sort();
      if (dates.length === 1) {
        if (pending.fromDay === dates[0]) goBack();
        else navigate(`/day/${dates[0]}`, { replace: true });
      } else {
        navigate(`/?m=${dates[0].slice(0, 7)}`, { replace: true });
      }
    } catch (e) {
      // 이미 올라간 사진은 목록에서 빼고, 나머지만 다시 올릴 수 있게 한다
      const done = doneRef.current;
      setItems((prev) => prev.slice(done));
      setProgress(null);
      showToast(done ? `${done}장은 올렸어요. ${friendlyError(e)}` : friendlyError(e));
    }
  };

  if (!pending) return null;
  const dateCount = new Set(items.map((i) => i.date)).size;

  return (
    <div className="screen upload">
      <TopBar title="착용샷 올리기" onBack={() => !progress && goBack()} />
      <p className="hint">
        {items.length}장 · {dateCount}개 날짜
        <br />
        {!pending.date && '촬영일이 있는 사진은 그 날짜로 정했어요. '}날짜를 눌러 바꿀 수 있어요.
      </p>
      <ul className="upload-list">
        {items.map((it) => (
          <li key={it.key} className="upload-item">
            <img src={it.url} alt="" loading="lazy" />
            <div className="upload-meta">
              <DateField value={it.date} onChange={(d) => setDate(it.key, d)} />
              <span className="source">{SOURCE_LABEL[it.source]}</span>
            </div>
            <button className="remove" aria-label="빼기" onClick={() => remove(it.key)}>
              <Icon name="x" size={20} />
            </button>
          </li>
        ))}
      </ul>
      <div className="bottom-bar">
        <button className="primary" disabled={!items.length || !!progress} onClick={upload}>
          {items.length}장 올리기
        </button>
      </div>
      {progress && (
        <div className="overlay">
          <div className="progress-card">
            <p>
              사진 올리는 중 {progress.done} / {progress.total}
            </p>
            <div className="bar">
              <span style={{ width: `${(progress.done / progress.total) * 100}%` }} />
            </div>
            <small>앱을 닫지 말고 잠시만 기다려 주세요</small>
          </div>
        </div>
      )}
    </div>
  );
}
