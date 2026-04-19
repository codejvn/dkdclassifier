import { useEffect, useState, useMemo, useRef } from 'react';

const NAV_ITEMS = ['File', 'Patient', 'View', 'Reports', 'Help'];
const TOOLBAR_BTNS = [
  { label: '↺  Refresh', id: 'refresh', title: 'Refresh patient list' },
  { label: '⬇  Import',  id: 'import',  title: 'Import from CSV' },
  { label: '⬆  Export',  id: 'export',  title: 'Export to CSV' },
  { label: '⎙  Print',   id: 'print',   title: 'Print report' },
];

const API_LABEL = { idle: 'STANDBY', ok: 'CONNECTED  ...  OK', error: 'ERROR  ...  CHECK BACKEND' };
const API_COLOR = { idle: '#808080', ok: '#007700', error: '#cc0000' };

export default function CyberHeader({ totalPatients = 0, counts = { high: 0, med: 0, low: 0 }, apiStatus = 'idle', lastUpload = null, onExport, onImport, onPrint }) {
  const [clock, setClock] = useState('');
  const importInputRef = useRef(null);

  const tickerText = useMemo(() => {
    const items = [
      `PATIENTS LOADED  ...  ${totalPatients}`,
      `HIGH RISK  ...  ${counts.high} patient${counts.high !== 1 ? 's' : ''}`,
      `MEDIUM RISK  ...  ${counts.med} patient${counts.med !== 1 ? 's' : ''}`,
      `LOW RISK  ...  ${counts.low} patient${counts.low !== 1 ? 's' : ''}`,
      `ML BACKEND  ...  ${API_LABEL[apiStatus] ?? 'UNKNOWN'}`,
      `LAST UPLOAD  ...  ${lastUpload ? lastUpload.toLocaleString() : 'N/A'}`,
      'ML ENGINE  ...  AUC = 0.94',
      'HIPAA AUDIT LOG  ...  ENABLED',
      'TRIAL REGISTRY  ...  NCT05129748 OPEN',
    ];
    return items.join('     ·     ');
  }, [totalPatients, counts, apiStatus, lastUpload]);

  useEffect(() => {
    const fmt = () =>
      setClock(
        new Date().toLocaleTimeString('en-US', {
          hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit',
        })
      );
    fmt();
    const id = setInterval(fmt, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header>
      {/* ── Win2K title bar ── */}
      <div className="win-title">
        <span style={{ fontSize: 14, lineHeight: 1 }}>⊕</span>
        <span style={{ flex: 1 }}>
          REGEN-RECRUIT v2.0 — Clinical Recruiter Dashboard
        </span>
        {/* clock */}
        <span style={{ fontFamily: 'Courier New, monospace', fontSize: 11, fontWeight: 'normal', marginRight: 10 }}>
          {clock}
        </span>
        {/* window chrome buttons */}
        <div className="win-title-btn" title="Minimize">_</div>
        <div className="win-title-btn" title="Maximize">□</div>
        <div className="win-title-btn" title="Close">✕</div>
      </div>

      {/* ── Menu bar ── */}
      <div className="menu-bar">
        {NAV_ITEMS.map(item => (
          <span key={item} className="menu-item">{item}</span>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="toolbar">
        {TOOLBAR_BTNS.map(({ label, id, title }) => (
          <button
            key={id}
            className="btn-win"
            title={title}
            style={{ fontSize: 11 }}
            onClick={() => {
              if (id === 'import' && onImport) importInputRef.current?.click();
              if (id === 'export' && onExport) onExport();
              if (id === 'print' && onPrint) onPrint();
            }}
          >
            {label}
          </button>
        ))}

        {/* Hidden import file input */}
        <input
          ref={importInputRef}
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={e => {
            if (e.target.files?.[0] && onImport) {
              onImport(e.target.files[0]);
              e.target.value = '';
            }
          }}
        />

        <div className="toolbar-sep" />

        <span style={{ fontSize: 11, color: '#444', paddingLeft: 4 }}>
          Dr. Chen&nbsp;&nbsp;|&nbsp;&nbsp;Administrator
        </span>
      </div>

      {/* ── Address / ticker bar ── */}
      <div className="ticker-wrap">
        <span style={{ fontSize: 11, color: '#444', flexShrink: 0 }}>Status:</span>
        <div className="ticker-inner">
          <span className="marquee-inner">
            {tickerText}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{tickerText}
          </span>
        </div>
      </div>
    </header>
  );
}
