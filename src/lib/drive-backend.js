// 구글 드라이브 저장소: 'OOTD 캘린더' 폴더 + '썸네일' 하위 폴더 + ootd-data.json
import * as drive from './drive.js';
import { APP_FOLDER_NAME, THUMB_FOLDER_NAME, DATA_FILE_NAME } from '../config.js';
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

export function createDriveBackend() {
  let ids = readIds();

  async function discover() {
    let folderId = await drive.findFile({ name: APP_FOLDER_NAME, folder: true });
    if (!folderId) folderId = await drive.createFolder(APP_FOLDER_NAME);

    let thumbFolderId = await drive.findFile({ name: THUMB_FOLDER_NAME, folder: true, parentId: folderId });
    if (!thumbFolderId) thumbFolderId = await drive.createFolder(THUMB_FOLDER_NAME, folderId);

    let dataFileId = await drive.findFile({ name: DATA_FILE_NAME, parentId: folderId });
    if (!dataFileId) {
      dataFileId = await drive.uploadFile({
        name: DATA_FILE_NAME,
        parentId: folderId,
        blob: new Blob([JSON.stringify(emptyData())], { type: 'application/json' }),
        mime: 'application/json',
      });
    }
    ids = { folderId, thumbFolderId, dataFileId };
    saveIds(ids);
  }

  return {
    async init() {
      if (ids?.folderId && ids?.thumbFolderId && ids?.dataFileId) {
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
        parentId: thumb ? ids.thumbFolderId : ids.folderId,
        blob,
        mime: 'image/jpeg',
      }),
    downloadPhoto: (fileId) => drive.downloadBlob(fileId),
    trash: (fileId) => drive.trashFile(fileId),
  };
}
