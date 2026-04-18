import { useEffect, useState } from 'react';

const TICKER_ITEMS = [
  'Connected to TRIAL-DB  ...  OK',
  'ML engine loaded  ...  AUC = 0.94',
  'Downloading patient records  ...  2,847 records received',
  'CGM stream active  ...  14 devices synced',
  'eGFR monitor running  ...  all values current',
  'Trial registry  ...  NCT05129748 open',
  'SHAP engine  ...  standby',
  'HIPAA audit log  ...  enabled',
  'Last sync  ' + new Date().toLocaleString(),
  'Connection: TCP/IP  ...  56 kbps',
];

const NAV_ITEMS = ['File', 'Patient', 'View', 'Reports', 'Help'];
const TOOLBAR_BTNS = [
  { label: '↺  Refresh', title: 'Refresh patient list' },
  { label: '⎙  Export',  title: 'Export to CSV' },
  { label: '⎙  Print',   title: 'Print report' },
];

export default function CyberHeader() {
  const [clock, setClock] = useState('');
  const tickerText = TICKER_ITEMS.join('     |     ');

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
        {TOOLBAR_BTNS.map(({ label, title }) => (
          <button key={label} className="btn-win" title={title} style={{ fontSize: 11 }}>
            {label}
          </button>
        ))}

        <div className="toolbar-sep" />

        {/* Connection status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, paddingLeft: 4 }}>
          <div className="pulse-dot" />
          <span style={{ fontSize: 11, color: '#007700' }}>Connected</span>
        </div>

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
