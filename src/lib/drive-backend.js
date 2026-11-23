// 구글 드라이브 저장소
//   OOTD 캘린더/
//   ├─ 사진/          착용샷 (긴 변 1600px)
//   ├─ 썸네일/        캘린더 칸용 작은 사진
//   └─ ootd-data.json
import * as drive from './drive.js';
import { APP_FOLDER_NAME, PHOTO_FOLDER_NAME, THUMB_FOLDER_NAME, DATA_FILE_NAME } from '../config.js';
import { emptyData } from './data.js';

const IDS_KEY = 'ootd.drive.ids';

function readIds() {
  try {
    return JSON.parse(localStorage.getItem(IDS_KEY));
  } catch {
    return null;
  }
}

function saveIds(ids) {
  try {
    localStorage.setItem(IDS_KEY, JSON.stringify(ids));
  } catch {}
}

async function findOrCreateFolder(name, parentId) {
  return (await drive.findFile({ name, folder: true, parentId })) || drive.createFolder(name, parentId);
}

export function createDriveBackend() {
  let ids = readIds();

  async function discover() {
    let folderId = await drive.findFile({ name: APP_FOLDER_NAME, folder: true });
    if (!folderId) folderId = await drive.createFolder(APP_FOLDER_NAME);

    const photoFolderId = await findOrCreateFolder(PHOTO_FOLDER_NAME, folderId);
    const thumbFolderId = await findOrCreateFolder(THUMB_FOLDER_NAME, folderId);

    let dataFileId = await drive.findFile({ name: DATA_FILE_NAME, parentId: folderId });
    if (!dataFileId) {
      dataFileId = await drive.uploadFile({
        name: DATA_FILE_NAME,
        parentId: folderId,
        blob: new Blob([JSON.stringify(emptyData())], { type: 'application/json' }),
        mime: 'application/json',
      });
    }
    ids = { folderId, photoFolderId, thumbFolderId, dataFileId };
    saveIds(ids);
  }

  return {
    async init() {
      if (ids?.folderId && ids?.photoFolderId && ids?.thumbFolderId && ids?.dataFileId) {
        try {
          const meta = await drive.getMeta(ids.dataFileId);
          if (!meta.trashed) return;
        } catch (e) {
          if (!(e instanceof drive.DriveError && e.status === 404)) throw e;
        }
      }
      await discover();
    },
    loadData: () => drive.readJson(ids.dataFileId),
    saveData: (data) => drive.writeJson(ids.dataFileId, data),
    uploadPhoto: (name, blob, { thumb = false } = {}) =>
      drive.uploadFile({
        name,
        parentId: thumb ? ids.thumbFolderId : ids.photoFolderId,
        blob,
        mime: 'image/jpeg',
      }),
    downloadPhoto: (fileId) => drive.downloadBlob(fileId),
    trash: (fileId) => drive.trashFile(fileId),

    // 예전 버전이 'OOTD 캘린더' 바로 아래에 올린 사진을 '사진' 폴더로 옮긴다 (파일 id 는 그대로라 기록은 안 바뀜)
    async movePhotosIntoFolder(onProgress) {
      const loose = await drive.listChildren(ids.folderId, 'image/jpeg');
      let moved = 0;
      let next = 0;
      const worker = async () => {
        while (next < loose.length) {
          const id = loose[next++];
          await drive.moveFile(id, ids.photoFolderId, ids.folderId);
          moved++;
          onProgress?.(moved, loose.length);
        }
      };
      await Promise.all(Array.from({ length: Math.min(4, loose.length) }, worker));
      return moved;
    },
  };
}
