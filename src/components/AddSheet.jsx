import { useRef } from 'react';
import Icon from './Icon.jsx';
import { Sheet } from './ui.jsx';
import { useStore, closeAddSheet, setPendingUpload } from '../store.js';
import { navigate } from '../router.js';
import { formatMonthDay } from '../lib/dates.js';

// 카메라 / 갤러리 선택
export default function AddSheet() {
  const { addSheet } = useStore();
  const camRef = useRef(null);
  const galRef = useRef(null);

  const onFiles = (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    setPendingUpload({ files, date: addSheet?.date || null, fromDay: addSheet?.fromDay || null });
    closeAddSheet();
    navigate('/upload');
  };

  return (
    <Sheet
      open={!!addSheet}
      onClose={closeAddSheet}
      title={addSheet?.date ? `${formatMonthDay(addSheet.date)} 착용샷 추가` : '착용샷 추가'}
    >
      <button className="sheet-item" onClick={() => camRef.current?.click()}>
        <Icon name="camera" />
        카메라로 촬영
      </button>
      <button className="sheet-item" onClick={() => galRef.current?.click()}>
        <Icon name="image" />
        갤러리에서 선택
        <small>여러 장 가능</small>
      </button>
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={onFiles} />
      <input ref={galRef} type="file" accept="image/*" multiple hidden onChange={onFiles} />
    </Sheet>
  );
}
