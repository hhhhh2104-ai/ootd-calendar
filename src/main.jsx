import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { initBack } from './back.js';
import { showExitPrompt } from './store.js';
import './styles.css';

initBack(showExitPrompt);

createRoot(document.getElementById('root')).render(<App />);

// 배포된 앱에서만 서비스 워커 등록 (홈 화면 설치, 빠른 실행용)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .catch(() => {});
  });
}
