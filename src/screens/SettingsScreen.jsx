import { useMemo } from 'react';
import { TopBar } from '../components/ui.jsx';
import { useStore, connect, disconnect } from '../store.js';
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
