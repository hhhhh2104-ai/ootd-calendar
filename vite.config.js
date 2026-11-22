import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages 주소(https://hhhhh2104-ai.github.io/ootd-calendar/)에 맞춘 기본 경로
export default defineConfig({
  base: '/ootd-calendar/',
  plugins: [react()],
  server: { port: 5173, strictPort: true },
});
