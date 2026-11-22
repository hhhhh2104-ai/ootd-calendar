import { useEffect, useState } from 'react';
import { loadPhotoUrl, peekPhotoUrl } from '../lib/photo-cache.js';
import { useStore } from '../store.js';

function usePhotoUrl(id) {
  const { connected } = useStore();
  const [st, setSt] = useState(() => ({ id, url: id ? peekPhotoUrl(id) : null, failed: false }));

  useEffect(() => {
    if (!id) return;
    let alive = true;
    const cached = peekPhotoUrl(id);
    if (cached) {
      setSt({ id, url: cached, failed: false });
      return;
    }
    setSt({ id, url: null, failed: false });
    loadPhotoUrl(id).then(
      (url) => alive && setSt({ id, url, failed: false }),
      () => alive && setSt({ id, url: null, failed: true }),
    );
    return () => {
      alive = false;
    };
  }, [id, connected]);

  return st.id === id ? st : { id, url: null, failed: false };
}

// fileId: 보여줄 사진, previewId: 먼저 보여줄 작은 사진(썸네일)
export default function PhotoImg({ fileId, previewId = null, fit = 'cover', className = '' }) {
  const full = usePhotoUrl(fileId);
  const preview = usePhotoUrl(previewId && previewId !== fileId ? previewId : null);
  const url = full.url || preview.url;
  return (
    <div className={`photo ${className}`}>
      {url ? (
        <img src={url} alt="" draggable={false} style={{ objectFit: fit }} />
      ) : (
        <div className={`photo-ph ${full.failed ? 'failed' : ''}`} />
      )}
    </div>
  );
}
