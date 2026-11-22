// PC 미리보기 전용 가짜 저장소 (주소 뒤에 ?demo). 배포된 앱에는 포함되지 않는다.
import { emptyData, newId } from './data.js';
import { todayStr, addDays, parseDateStr } from './dates.js';

const OUTFITS = [
  ['#d9c6a5', '#2b2b2b'],
  ['#c9a99a', '#1f1f2e'],
  ['#8a7fb0', '#1d2438'],
  ['#f1efe9', '#222222'],
  ['#7c7c80', '#3a3a3a'],
  ['#e8c8cf', '#7b5d64'],
  ['#9fb0c7', '#3b4a63'],
  ['#e2d9c8', '#4a3b2f'],
];

function makeImage(top, bottom, label) {
  const c = document.createElement('canvas');
  c.width = 600;
  c.height = 900;
  const g = c.getContext('2d');
  g.fillStyle = '#ece7df';
  g.fillRect(0, 0, 600, 900);
  g.fillStyle = '#cdb89a';
  g.fillRect(0, 720, 600, 180);
  g.fillStyle = top;
  g.beginPath();
  g.roundRect(170, 170, 260, 310, 40);
  g.fill();
  g.fillStyle = bottom;
  g.beginPath();
  g.moveTo(190, 470);
  g.lineTo(410, 470);
  g.lineTo(450, 710);
  g.lineTo(150, 710);
  g.closePath();
  g.fill();
  g.fillStyle = '#222';
  g.fillRect(232, 710, 48, 170);
  g.fillRect(320, 710, 48, 170);
  g.fillStyle = '#e7808f';
  g.fillRect(285, 300, 30, 46);
  g.fillStyle = 'rgba(0,0,0,.45)';
  g.font = 'bold 34px sans-serif';
  g.textAlign = 'center';
  g.fillText(label, 300, 110);
  return new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export async function createDemoBackend() {
  const blobs = new Map();
  let data = emptyData();
  const today = todayStr();
  let n = 0;
  for (let i = 20; i >= 1; i--) {
    const d = addDays(today, -i);
    const wd = parseDateStr(d).getDay();
    if (wd === 0 || wd === 6) continue;
    const [top, bottom] = OUTFITS[n % OUTFITS.length];
    const count = n % 5 === 2 ? 2 : 1;
    for (let k = 0; k < count; k++) {
      const blob = await makeImage(k ? bottom : top, k ? top : bottom, `데모 ${d.slice(5)}${k ? ' (2)' : ''}`);
      const fileId = 'demo-' + newId();
      blobs.set(fileId, blob);
      const id = newId();
      data.photos[id] = {
        id,
        date: d,
        fileId,
        thumbId: fileId,
        width: 600,
        height: 900,
        order: k,
        createdAt: new Date().toISOString(),
      };
    }
    n++;
  }

  return {
    async init() {},
    async loadData() {
      await delay(40);
      return structuredClone(data);
    },
    async saveData(d) {
      await delay(60);
      data = structuredClone(d);
    },
    async uploadPhoto(name, blob) {
      await delay(120);
      const id = 'demo-' + newId();
      blobs.set(id, blob);
      return id;
    },
    async downloadPhoto(id) {
      await delay(80);
      const b = blobs.get(id);
      if (!b) throw new Error('사진이 없어요');
      return b;
    },
    async trash(id) {
      blobs.delete(id);
    },
  };
}
