import { useMemo, useRef, useState } from 'react';
import { TopBar } from '../components/ui.jsx';
import {
  useStore,
  connect,
  disconnect,
  requireConnection,
  importWeightsFile,
  unhideEvent,
  connectCalendar,
  showToast,
  friendlyError,
} from '../store.js';
import { hasCalendarAccess } from '../lib/google-auth.js';
import { goBack } from '../router.js';
import { APP_FOLDER_NAME, APP_VERSION, LOCATION } from '../config.js';
import { formatKoreanDate } from '../lib/dates.js';

export default function SettingsScreen() {
  const { data, connected, connecting, demo } = useStore();
  const stats = useMemo(() => {
    const list = Object.values(data.photos);
    const dates = [...new Set(list.map((p) => p.date))].sort();
    return { photos: list.length, days: dates.length, first: dates[0] };
  }, [data]);

  const weightInput = useRef(null);
  const [showHidden, setShowHidden] = useState(false);
  const weightDays = Object.keys(data.weights || {}).length;
  const hidden = Object.entries(data.hiddenEvents || {}).sort((a, b) => (b[1].date || '').localeCompare(a[1].date || ''));
  const calendarOk = hasCalendarAccess();

  const pickWeightFile = async () => {
    if (await requireConnection()) weightInput.current?.click();
  };

  const onWeightFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const r = await importWeightsFile(file);
      showToast(`몸무게 ${r.days}일 확인 · 새로 ${r.added}일${r.updated ? `, 갱신 ${r.updated}일` : ''}`);
    } catch (err) {
      showToast(friendlyError(err));
    }
  };

  const onUnhide = async (id) => {
    if (!(await requireConnection())) return;
    try {
      await unhideEvent(id);
      showToast('일정을 다시 보여줘요');
    } catch (err) {
      showToast(friendlyError(err));
    }
  };

  const onDisconnect = () => {
    if (!window.confirm('구글 드라이브 연결을 해제할까요?\n드라이브에 저장된 사진과 기록은 그대로 남아 있어요.')) return;
    disconnect();
  };

  return (
    <div className="screen settings">
      <TopBar title="설정" onBack={() => goBack()} />

      <section className="set-group">
        <h2>구글 드라이브</h2>
        <div className="set-row">
          <span>연결 상태</span>
          <span className="val">{demo ? '데모 모드' : connected ? '연결됨' : '연결 안 됨'}</span>
        </div>
        <div className="set-row">
          <span>저장 위치</span>
          <span className="val">내 드라이브 › {APP_FOLDER_NAME}</span>
        </div>
        {!demo && (
          <div className="set-row">
            {connected ? (
              <button className="text-btn danger" onClick={onDisconnect}>
                연결 해제
              </button>
            ) : (
              <button className="text-btn" onClick={() => connect()} disabled={connecting}>
                {connecting ? '연결 중…' : '다시 연결'}
              </button>
            )}
          </div>
        )}
      </section>

      <section className="set-group">
        <h2>기록</h2>
        <div className="set-row">
          <span>착용샷</span>
          <span className="val">
            {stats.photos}장 · {stats.days}일
          </span>
        </div>
        {stats.first && (
          <div className="set-row">
            <span>첫 기록</span>
            <span className="val">{formatKoreanDate(stats.first)}</span>
          </div>
        )}
        <div className="set-row">
          <span>날씨 지역</span>
          <span className="val">{LOCATION.name}</span>
        </div>
      </section>

      <section className="set-group">
        <h2>몸무게</h2>
        <div className="set-row">
          <span>기록</span>
          <span className="val">{weightDays ? `${weightDays}일` : '없음'}</span>
        </div>
        <div className="set-row">
          <button className="text-btn" onClick={pickWeightFile}>
            삼성헬스에서 가져오기
          </button>
          <input ref={weightInput} type="file" accept=".csv,text/csv" hidden onChange={onWeightFile} />
        </div>
        <div className="set-row">
          <span className="val small left">
            삼성헬스 → 설정 → 개인 데이터 다운로드로 받은 파일 중 <b>weight</b>가 들어간 파일을 고르세요. 다시 가져와도
            중복되지 않아요.
          </span>
        </div>
      </section>

      <section className="set-group">
        <h2>일정 (구글 캘린더)</h2>
        <div className="set-row">
          <span>캘린더 읽기</span>
          {demo || calendarOk ? (
            <span className="val">연결됨</span>
          ) : (
            <button className="text-btn" onClick={() => connectCalendar()}>
              연결하기
            </button>
          )}
        </div>
        <div className="set-row">
          <span>숨긴 일정</span>
          <button className="text-btn" disabled={!hidden.length} onClick={() => setShowHidden((v) => !v)}>
            {hidden.length}개 {hidden.length ? (showHidden ? '접기' : '보기') : ''}
          </button>
        </div>
        {showHidden &&
          hidden.map(([id, h]) => (
            <div className="set-row" key={id}>
              <span className="hidden-title">
                {h.title}
                <small>{h.date}</small>
              </span>
              <button className="text-btn" onClick={() => onUnhide(id)}>
                되돌리기
              </button>
            </div>
          ))}
      </section>

      <section className="set-group">
        <h2>앱 정보</h2>
        <div className="set-row">
          <span>버전</span>
          <span className="val">{APP_VERSION}</span>
        </div>
        <div className="set-row">
          <a href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noreferrer">
            개인정보처리방침
          </a>
        </div>
        <div className="set-row">
          <span className="val small">날씨 정보: Open-Meteo.com</span>
        </div>
      </section>
    </div>
  );
}
