// 사진 용량 줄이기 + 촬영일 읽기
import { PHOTO_FULL, PHOTO_THUMB } from '../config.js';

async function decode(file) {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
    } catch {
      URL.revokeObjectURL(url);
      throw new Error('이 사진 형식은 열 수 없어요');
    }
  }
}

function drawToBlob(src, { maxSide, quality }) {
  const scale = Math.min(1, maxSide / Math.max(src.width, src.height));
  const w = Math.max(1, Math.round(src.width * scale));
  const h = Math.max(1, Math.round(src.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src.source, 0, 0, w, h);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve({ blob, width: w, height: h }) : reject(new Error('사진을 줄이지 못했어요'))),
      'image/jpeg',
      quality,
    );
  });
}

// 원본 사진 → 저장용(긴 변 1600px) + 캘린더용 썸네일(긴 변 480px)
export async function makePhotoVersions(file) {
  const src = await decode(file);
  try {
    const full = await drawToBlob(src, PHOTO_FULL);
    const thumb = await drawToBlob(src, PHOTO_THUMB);
    return { full, thumb };
  } finally {
    src.close();
  }
}

// ----- 촬영일(EXIF) 읽기: 'YYYY-MM-DD' 또는 null -----

function parseExifDate(s) {
  const m = /^(\d{4}):(\d{2}):(\d{2})/.exec(s || '');
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1990 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function parseTiff(view, tiff) {
  const little = view.getUint16(tiff) === 0x4949;
  const u16 = (o) => view.getUint16(o, little);
  const u32 = (o) => view.getUint32(o, little);
  const readStr = (entry) => {
    const count = u32(entry + 4);
    const off = count > 4 ? tiff + u32(entry + 8) : entry + 8;
    let s = '';
    for (let i = 0; i < count - 1 && off + i < view.byteLength; i++) s += String.fromCharCode(view.getUint8(off + i));
    return s;
  };
  const scan = (ifd, tags) => {
    const out = {};
    if (ifd + 2 > view.byteLength) return out;
    const n = u16(ifd);
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12;
      if (e + 12 > view.byteLength) break;
      const tag = u16(e);
      if (tags.includes(tag)) out[tag] = tag === 0x8769 ? u32(e + 8) : readStr(e);
    }
    return out;
  };
  const ifd0 = scan(tiff + u32(tiff + 4), [0x0132, 0x8769]);
  let dt = null;
  if (ifd0[0x8769] != null) {
    const exif = scan(tiff + ifd0[0x8769], [0x9003, 0x9004]);
    dt = exif[0x9003] || exif[0x9004];
  }
  return parseExifDate(dt || ifd0[0x0132]);
}

export async function readExifDate(file) {
  try {
    const buf = await file.slice(0, 256 * 1024).arrayBuffer();
    const view = new DataView(buf);
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;
    let off = 2;
    while (off + 4 <= view.byteLength) {
      const marker = view.getUint16(off);
      if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) break;
      const size = view.getUint16(off + 2);
      if (marker === 0xffe1 && off + 10 <= view.byteLength && view.getUint32(off + 4) === 0x45786966) {
        return parseTiff(view, off + 10);
      }
      off += 2 + size;
    }
  } catch {}
  return null;
}
