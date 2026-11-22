import { useStore, connect } from '../store.js';
import { APP_FOLDER_NAME } from '../config.js';

export default function WelcomeScreen() {
  const { connecting, error } = useStore();
  return (
    <div className="welcome">
      <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" />
      <h1>OOTD 캘린더</h1>
      <p>매일 입은 옷을 캘린더에 기록해요.</p>
      <p className="sub">
        사진은 내 구글 드라이브의 <b>'{APP_FOLDER_NAME}'</b> 폴더에 저장돼요.
      </p>
      <button className="primary" onClick={() => connect()} disabled={connecting}>
        {connecting ? '연결 중…' : '구글 계정으로 시작하기'}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
