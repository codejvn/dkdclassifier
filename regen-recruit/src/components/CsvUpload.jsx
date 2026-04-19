import { useRef, useState } from 'react';

const UPLOAD_URL = 'https://codejvn-classfy-dkd-backend.hf.space/upload-and-predict';
const SCAN_MSGS  = [
  'SCANNING BIOMETRICS...',
  'ANALYZING CGM DATA...',
  'RUNNING INFERENCE ENGINE...',
  'PROCESSING TISSUE MARKERS...',
];

async function uploadOne(file) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(UPLOAD_URL, { method: 'POST', body: fd });
  if (!res.ok) {
    const txt = await res.text().catch(() => res.statusText);
    throw new Error(`${file.name}: HTTP ${res.status}: ${txt}`);
  }
  const data = await res.json();
  if (data.status !== 'success')
    throw new Error(`${file.name}: ${data.message ?? 'Backend returned failure status'}`);
  return { data, name: file.name };
}

export default function CsvUpload({ onResult, onApiStatus, disabled }) {
  const inputRef    = useRef(null);
  const intervalRef = useRef(null);
  const [dragging,  setDragging]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [progress,  setProgress]  = useState('');
  const [scanIdx,   setScanIdx]   = useState(0);
  const [error,     setError]     = useState(null);

  async function uploadFiles(fileList) {
    const files    = Array.from(fileList).filter(f => f.name.toLowerCase().endsWith('.csv'));
    const rejected = fileList.length - files.length;

    if (files.length === 0) {
      setError('ERR_FORMAT: ONLY .CSV FILES ACCEPTED');
      return;
    }

    setError(null);
    setLoading(true);
    setScanIdx(0);
    setProgress(`0 / ${files.length}`);
    intervalRef.current = setInterval(
      () => setScanIdx(i => (i + 1) % SCAN_MSGS.length),
      650,
    );

    let completed = 0;
    const errors = [];

    await Promise.all(files.map(async file => {
      try {
        const { data, name } = await uploadOne(file);
        onResult(data, name);
        completed++;
        setProgress(`${completed} / ${files.length}`);
      } catch (err) {
        errors.push(err.message);
      }
    }));

    clearInterval(intervalRef.current);
    setLoading(false);
    setProgress('');
    if (inputRef.current) inputRef.current.value = '';

    if (errors.length > 0) {
      onApiStatus?.('error');
      const suffix = rejected > 0 ? ` (+${rejected} non-CSV skipped)` : '';
      setError(`${errors.length} file${errors.length > 1 ? 's' : ''} failed${suffix} — ${errors[0]}`);
    } else {
      onApiStatus?.('ok');
      if (rejected > 0) setError(`${rejected} non-CSV file${rejected > 1 ? 's' : ''} skipped`);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    uploadFiles(e.dataTransfer.files);
  }

  return (
    <div style={{ padding: '5px 6px', borderBottom: '2px solid #808080', background: '#d4d0c8' }}>
      <div
        className="sunken"
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '5px 10px',
          background: dragging ? '#dce8ff' : '#ffffff',
          outline: dragging ? '2px dashed #0a246a' : 'none',
          minHeight: 34,
          transition: 'background 0.1s',
        }}
      >
        <span style={{ fontSize: 15, userSelect: 'none' }}>💾</span>

        <span style={{
          fontFamily: 'Courier New, monospace',
          fontSize: 11,
          flex: 1,
          color: loading ? '#0a246a' : '#444444',
          fontWeight: loading ? 'bold' : 'normal',
          letterSpacing: loading ? 1 : 0,
        }}>
          {loading
            ? `⏳ ${SCAN_MSGS[scanIdx]}  [${progress}]`
            : dragging
              ? '[ DROP FILES TO BEGIN UPLOAD ]'
              : 'Drag & drop one or more CGM .CSV files — or click to browse'}
        </span>

        {error && (
          <span
            title={error}
            style={{
              fontFamily: 'Courier New, monospace',
              fontSize: 10,
              color: '#cc0000',
              fontWeight: 'bold',
              maxWidth: 340,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              background: '#fff0f0',
              border: '1px solid #cc0000',
              padding: '1px 6px',
            }}
          >
            ⚠ {error}
          </span>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          multiple
          style={{ display: 'none' }}
          onChange={e => uploadFiles(e.target.files)}
        />

        <button
          className="btn-win"
          style={{ fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0 }}
          disabled={loading || disabled}
          onClick={() => { setError(null); inputRef.current?.click(); }}
        >
          ⬆ UPLOAD CGM DATA (.CSV)
        </button>
      </div>
    </div>
  );
}
