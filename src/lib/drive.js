// 구글 드라이브 API 호출
import { getValidToken, clearToken, AuthError } from './google-auth.js';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
export const FOLDER_MIME = 'application/vnd.google-apps.folder';

export class DriveError extends Error {
  constructor(status, message) {
    super(message || `Drive error ${status}`);
    this.status = status;
    this.name = 'DriveError';
  }
}

async function driveFetch(url, opts = {}) {
  const token = getValidToken();
  if (!token) throw new AuthError('need_auth');
  const res = await fetch(url, {
    ...opts,
    headers: { ...(opts.headers || {}), Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    clearToken();
    throw new AuthError('need_auth');
  }
  if (!res.ok) {
    let msg = '';
    try {
      const j = await res.json();
      msg = j?.error?.message || '';
    } catch {}
    throw new DriveError(res.status, msg);
  }
  return res;
}

const enc = encodeURIComponent;

export async function findFile({ name, parentId, folder }) {
  const parts = [`name = '${name.replace(/'/g, "\\'")}'`, 'trashed = false'];
  if (folder) parts.push(`mimeType = '${FOLDER_MIME}'`);
  if (parentId) parts.push(`'${parentId}' in parents`);
  const url =
    `${API}/files?q=${enc(parts.join(' and '))}` +
    `&fields=${enc('files(id,name,createdTime)')}&orderBy=createdTime&pageSize=10&spaces=drive`;
  const j = await (await driveFetch(url)).json();
  return j.files?.[0]?.id || null;
}

export async function createFolder(name, parentId) {
  const res = await driveFetch(`${API}/files?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, ...(parentId ? { parents: [parentId] } : {}) }),
  });
  return (await res.json()).id;
}

export async function getMeta(id) {
  const res = await driveFetch(`${API}/files/${id}?fields=${enc('id,trashed')}`);
  return res.json();
}

function multipartBody(meta, blob, mime) {
  const boundary = 'ootd' + Math.random().toString(36).slice(2);
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n`,
    `--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`,
    blob,
    `\r\n--${boundary}--`,
  ]);
  return { body, contentType: `multipart/related; boundary=${boundary}` };
}

export async function uploadFile({ name, parentId, blob, mime }) {
  const { body, contentType } = multipartBody({ name, parents: [parentId], mimeType: mime }, blob, mime);
  const res = await driveFetch(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body,
  });
  return (await res.json()).id;
}

export async function readJson(id) {
  const res = await driveFetch(`${API}/files/${id}?alt=media`, { cache: 'no-store' });
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export async function writeJson(id, obj) {
  await driveFetch(`${UPLOAD}/files/${id}?uploadType=media&fields=id`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(obj),
  });
}

export async function downloadBlob(id) {
  const res = await driveFetch(`${API}/files/${id}?alt=media`);
  return res.blob();
}

// 바로 지우지 않고 드라이브 휴지통으로 보낸다 (30일 안에 복구 가능)
export async function trashFile(id) {
  await driveFetch(`${API}/files/${id}?fields=id`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  });
}
