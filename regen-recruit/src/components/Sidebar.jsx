// ─── Sidebar: Windows 98/2000 filter panel ───────────────────────────────────

function SliderRow({ label, value, unit, min, max, step, onChange, annotation }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <label style={{ fontSize: 11 }}>{label}:</label>
        <span style={{ fontFamily: 'Courier New, monospace', fontSize: 12, fontWeight: 'bold', color: '#000080' }}>
          {value}{unit}
          {annotation && <span style={{ fontWeight: 'normal', color: '#808080', marginLeft: 4 }}>{annotation}</span>}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={onChange} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
        <span style={{ fontSize: 10, color: '#808080' }}>{min}{unit}</span>
        <span style={{ fontSize: 10, color: '#808080' }}>{max}{unit}</span>
      </div>
    </div>
  );
}

export default function Sidebar({ filters, onChange, totalShown, totalAll, anyLoading }) {
  const { minRisk, maxAge, minEgfr, showHighOnly } = filters;

  const ckdStage = minEgfr >= 60 ? 'G1–G2' : minEgfr >= 45 ? 'G3a' : minEgfr >= 30 ? 'G3b' : 'G4–G5';

  return (
    <aside
      className="raised"
      style={{
        width: 210,
        flexShrink: 0,
        height: '100%',
        overflowY: 'auto',
        background: '#d4d0c8',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Panel title bar */}
      <div className="win-title" style={{ fontSize: 11 }}>
        <span style={{ fontSize: 12 }}>⊞</span>
        Search &amp; Filter
      </div>

      <div style={{ padding: '8px 10px', flex: 1 }}>

        {/* ── Cohort summary ── */}
        <div className="stat-box" style={{ marginBottom: 10, textAlign: 'center' }}>
          <div style={{ fontFamily: 'Courier New, monospace', fontSize: 24, fontWeight: 'bold', color: '#000080', lineHeight: 1 }}>
            {totalShown}
          </div>
          <div style={{ fontSize: 10, color: '#808080' }}>of {totalAll} patients shown</div>
        </div>

        {/* ── Filter groupbox ── */}
        <div className="groupbox">
          <span className="groupbox-label">Filter Criteria</span>

          <SliderRow
            label="Min DKD Risk"
            value={minRisk}
            unit="%"
            min={0} max={100} step={5}
            annotation={minRisk >= 80 ? '(High)' : minRisk >= 50 ? '(Med)' : ''}
            onChange={e => onChange({ ...filters, minRisk: Number(e.target.value) })}
          />

          <SliderRow
            label="Max Age"
            value={maxAge}
            unit=" yrs"
            min={20} max={90} step={1}
            onChange={e => onChange({ ...filters, maxAge: Number(e.target.value) })}
          />

          <SliderRow
            label="Min eGFR"
            value={minEgfr}
            unit=""
            min={0} max={90} step={5}
            annotation={ckdStage}
            onChange={e => onChange({ ...filters, minEgfr: Number(e.target.value) })}
          />

          {/* High-risk checkbox */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginTop: 4 }}>
            <input
              type="checkbox"
              checked={showHighOnly}
              onChange={e => onChange({ ...filters, showHighOnly: e.target.checked })}
              style={{ width: 13, height: 13, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 11 }}>High risk only (&gt;80%)</span>
          </label>
        </div>

        {/* ── Reset ── */}
        <div style={{ marginTop: 12, textAlign: 'right' }}>
          <button
            className="btn-win"
            style={{ fontSize: 11 }}
            onClick={() => onChange({ minRisk: 0, maxAge: 90, minEgfr: 0, showHighOnly: false })}
          >
            Reset Filters
          </button>
        </div>

        {/* ── System status groupbox ── */}
        <div className="groupbox" style={{ marginTop: 14 }}>
          <span className="groupbox-label">System Status</span>
          {[
            { label: 'ML Engine',   status: anyLoading ? 'Inferring...' : 'Online', ok: true  },
            { label: 'CGM Stream',  status: 'Active',    ok: true  },
            { label: 'Trial DB',    status: 'Connected', ok: true  },
            { label: 'SHAP Engine', status: 'Standby',   ok: false },
          ].map(({ label, status, ok }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 11 }}>{label}</span>
              <span style={{ fontSize: 11, color: ok ? '#007700' : '#996600', fontWeight: 'bold' }}>
                {status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
