// ─── Deep Dive Modal — patient detail + live ML prediction ───────────────────
import { useEffect, useRef, useState } from 'react';
import CGMChart from './CGMChart';
import PatientGraph from './PatientGraph';

const FLAG_COLORS = { RED: '#cc0000', YELLOW: '#996600', GREEN: '#007700' };
const FLAG_BG     = { RED: '#fff0f0', YELLOW: '#fffacd', GREEN: '#f0fff0' };
const FLAG_BORDER = { RED: '#cc0000', YELLOW: '#ccaa00', GREEN: '#007700' };

// ── Sub-components ────────────────────────────────────────────────────────────

function LabeledValue({ label, value, unit, flagColor }) {
  return (
    <div className="stat-box" style={{ flex: 1, minWidth: 90 }}>
      <div style={{ fontSize: 10, color: '#808080', marginBottom: 2 }}>{label}</div>
      <div style={{
        fontFamily: 'Courier New, monospace',
        fontSize: 15,
        fontWeight: 'bold',
        color: flagColor || '#000080',
      }}>
        {value}
        <span style={{ fontSize: 10, fontWeight: 'normal', color: '#808080', marginLeft: 2 }}>{unit}</span>
      </div>
    </div>
  );
}

function FeatureRow({ label, value, unit, good, warn, bad, invert }) {
  // For metrics where higher = worse (e.g. time above range, CV):
  //   invert=true means threshold direction flips
  let color = '#000000';
  if (!invert) {
    if      (value <= bad)  color = '#cc0000';
    else if (value <= warn) color = '#996600';
    else                    color = '#007700';
  } else {
    if      (value >= bad)  color = '#cc0000';
    else if (value >= warn) color = '#996600';
    else                    color = '#007700';
  }

  return (
    <tr>
      <td style={{ padding: '4px 10px', fontSize: 12, borderBottom: '1px solid #e4e4e4', width: '55%' }}>
        {label}
      </td>
      <td style={{ padding: '4px 10px', fontSize: 12, borderBottom: '1px solid #e4e4e4', fontFamily: 'Courier New, monospace', fontWeight: 'bold', color }}>
        {value} <span style={{ color: '#808080', fontWeight: 'normal', fontSize: 10 }}>{unit}</span>
      </td>
    </tr>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function DeepDiveModal({ patient, prediction, onClose, onUpdate, onRetry }) {
  const backdropRef = useRef();
  const [approved, setApproved] = useState(false);
  const [approving, setApproving] = useState(false);
  const [age, setAge]   = useState(patient.age);
  const [sex, setSex]   = useState(patient.gender);

  useEffect(() => {
    const h = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const handleBackdrop = e => { if (e.target === backdropRef.current) onClose(); };

  const handleApprove = () => {
    if (approved) return;
    setApproving(true);
    setTimeout(() => { setApproving(false); setApproved(true); }, 1200);
  };

  // Resolved prediction values
  const liveScore = prediction?.risk_score_percent ?? patient.dkdRisk;
  const liveFlag  = prediction?.risk_flag ?? null;
  const features  = prediction?.features  ?? null;
  const isLoading = prediction?.loading   ?? false;
  const hasError  = !!prediction?.error;

  const riskColor  = liveFlag ? (FLAG_COLORS[liveFlag] ?? '#808080') : (liveScore > 80 ? '#cc0000' : liveScore >= 50 ? '#996600' : '#007700');
  const riskBg     = liveFlag ? (FLAG_BG[liveFlag]     ?? '#f4f4f4') : '#ffffff';
  const riskBorder = liveFlag ? (FLAG_BORDER[liveFlag] ?? '#aaa')    : riskColor;
  const riskLabel  = liveFlag ?? (liveScore > 80 ? 'HIGH' : liveScore >= 50 ? 'MEDIUM' : 'LOW');

  const meanGlucose = patient.cgm.length > 0
    ? Math.round(patient.cgm.reduce((s, d) => s + d.glucose, 0) / patient.cgm.length)
    : '—';

  return (
    <div className="modal-backdrop" ref={backdropRef} onClick={handleBackdrop}>
      <div
        className="win-dialog"
        style={{
          width: '100%',
          maxWidth: 860,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* ── Title bar ── */}
        <div className="win-title">
          <span style={{ fontSize: 13 }}>📋</span>
          <span style={{ flex: 1 }}>Patient Details — {patient.id}</span>
          <div className="win-title-btn" onClick={onClose} title="Close">✕</div>
        </div>

        {/* ── Body ── */}
        <div style={{ overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10, background: '#d4d0c8' }}>

          {/* ── Hero row: ID + ML result ── */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>

            {/* Left: ID + flags */}
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Courier New, monospace', fontSize: 18, fontWeight: 'bold', color: '#000080', marginBottom: 6 }}>
                {patient.id}
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {patient.flags.length === 0
                  ? <span style={{ fontSize: 11, color: '#808080' }}>No clinical flags</span>
                  : patient.flags.map(f => (
                      <span key={f} style={{ fontSize: 10, padding: '1px 4px', background: '#fffacd', border: '1px solid #ccaa00', color: '#664400' }}>
                        {f}
                      </span>
                    ))
                }
              </div>
            </div>

            {/* Right: ML prediction box */}
            <div
              className="raised"
              style={{
                background: riskBg,
                border: `2px solid ${riskBorder}`,
                padding: '10px 18px',
                textAlign: 'center',
                minWidth: 140,
              }}
            >
              <div style={{ fontSize: 10, color: '#808080', marginBottom: 2, fontWeight: 'bold', letterSpacing: '0.05em' }}>
                ML DKD RISK SCORE
              </div>

              {isLoading ? (
                <div style={{ fontSize: 13, color: '#808080', fontStyle: 'italic', margin: '8px 0' }}>
                  Inferring...
                </div>
              ) : hasError ? (
                <div style={{ fontSize: 12, color: '#808080', margin: '4px 0' }}>
                  Unavailable
                  <br />
                  <button className="btn-win" style={{ fontSize: 10, marginTop: 4 }} onClick={onRetry}>Retry</button>
                </div>
              ) : (
                <>
                  <div style={{ fontFamily: 'Courier New, monospace', fontSize: 34, fontWeight: 'bold', color: riskColor, lineHeight: 1 }}>
                    {liveScore}%
                  </div>
                  {liveFlag && (
                    <div style={{
                      marginTop: 6,
                      display: 'inline-block',
                      fontSize: 12,
                      fontWeight: 'bold',
                      color: riskColor,
                      background: riskBg,
                      border: `1px solid ${riskBorder}`,
                      padding: '2px 10px',
                    }}>
                      ■ {liveFlag}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── Clinical stats ── */}
          <div className="groupbox">
            <span className="groupbox-label">Patient Demographics &amp; Clinical Data</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
              {/* Editable Age */}
              <div className="stat-box" style={{ flex: 1, minWidth: 90 }}>
                <div style={{ fontSize: 10, color: '#808080', marginBottom: 2 }}>Age</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                  <input
                    type="number"
                    className="win-input"
                    value={age}
                    min={0} max={120}
                    style={{ width: 48, fontFamily: 'Courier New, monospace', fontSize: 14, fontWeight: 'bold', color: '#000080', padding: '1px 4px' }}
                    onChange={e => setAge(e.target.value)}
                    onBlur={() => onUpdate(patient.id, { age: age === '' ? '—' : Number(age) })}
                  />
                  <span style={{ fontSize: 10, color: '#808080' }}>yrs</span>
                </div>
              </div>
              {/* Editable Sex */}
              <div className="stat-box" style={{ flex: 1, minWidth: 90 }}>
                <div style={{ fontSize: 10, color: '#808080', marginBottom: 2 }}>Sex</div>
                <select
                  className="win-input"
                  value={sex}
                  style={{ fontFamily: 'Courier New, monospace', fontSize: 13, fontWeight: 'bold', color: '#000080', padding: '1px 2px', width: '100%' }}
                  onChange={e => { setSex(e.target.value); onUpdate(patient.id, { gender: e.target.value }); }}
                >
                  <option value="—">—</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <LabeledValue label="eGFR"         value={patient.egfr}             unit="mL/min" flagColor={patient.egfr < 30 ? '#cc0000' : patient.egfr < 60 ? '#996600' : undefined} />
              <LabeledValue label="HbA1c"        value={patient.hba1c}            unit="%" flagColor={patient.hba1c > 9 ? '#cc0000' : undefined} />
              <LabeledValue label="DM Duration"  value={patient.diabetesDuration} unit="yrs" />
              <LabeledValue label="BMI"          value={patient.bmi}              unit="" />
              <LabeledValue label="Systolic BP"  value={patient.systolicBP}       unit="mmHg" flagColor={patient.systolicBP > 140 ? '#996600' : undefined} />
            </div>
          </div>

          {/* ── ML Input Features ── */}
          <div className="groupbox">
            <span className="groupbox-label">ML Input Features (computed from CGM data)</span>

            {isLoading && (
              <div style={{ color: '#808080', fontSize: 12, fontStyle: 'italic', padding: '6px 0' }}>
                Computing features and running inference...
              </div>
            )}

            {hasError && (
              <div style={{ color: '#cc0000', fontSize: 12, padding: '6px 0' }}>
                {prediction.error} &nbsp;
                <button className="btn-win" style={{ fontSize: 10 }} onClick={onRetry}>Retry</button>
              </div>
            )}

            {features && (
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                {/* Feature table */}
                <div style={{ flex: 1 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', background: '#ffffff', boxShadow: 'inset 1px 1px #808080, inset -1px -1px #ffffff' }}>
                    <thead>
                      <tr style={{ background: '#d4d0c8' }}>
                        <th style={{ padding: '3px 10px', fontSize: 11, textAlign: 'left', fontWeight: 'bold', borderBottom: '1px solid #808080' }}>Feature</th>
                        <th style={{ padding: '3px 10px', fontSize: 11, textAlign: 'left', fontWeight: 'bold', borderBottom: '1px solid #808080' }}>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Mean glucose: normal <140, warn <180, bad >=180 (invert) */}
                      <FeatureRow label="Mean Glucose"       value={features.mean_glucose}     unit="mg/dL" invert bad={180} warn={140} good={0} />
                      {/* Std deviation: normal <36, warn <50, bad >=50 (invert) */}
                      <FeatureRow label="Glucose Std Dev"    value={features.glucose_std}      unit="mg/dL" invert bad={50}  warn={36}  good={0} />
                      {/* CV: normal <36%, warn <50%, bad >=50% (invert) */}
                      <FeatureRow label="Coeff of Variation" value={features.cv_glucose}       unit="%"     invert bad={50}  warn={36}  good={0} />
                      {/* TIR: bad <50%, warn <70%, good >=70% (normal direction) */}
                      <FeatureRow label="Time in Range"      value={features.time_in_range}    unit="%"     invert={false} bad={50} warn={70} good={100} />
                      {/* Time above: bad >=25%, warn >=10%, good <10% (invert) */}
                      <FeatureRow label="Time Above 180"     value={features.time_above_range} unit="%"     invert bad={25}  warn={10}  good={0} />
                      {/* Time below: bad >=4%, warn >=1%, good <1% (invert) */}
                      <FeatureRow label="Time Below 70"      value={features.time_below_range} unit="%"     invert bad={4}   warn={1}   good={0} />
                    </tbody>
                  </table>
                </div>

                {/* Visual summary bars */}
                <div style={{ width: 160, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {/* TIR donut-alternative: stacked bar */}
                  <div style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 2 }}>Glucose Distribution</div>
                  <div style={{ height: 18, display: 'flex', boxShadow: 'inset 1px 1px #808080, inset -1px -1px #fff', overflow: 'hidden' }}>
                    <div title={`Below: ${features.time_below_range}%`}  style={{ width: `${features.time_below_range}%`,  background: '#996600', height: '100%' }} />
                    <div title={`In range: ${features.time_in_range}%`}   style={{ width: `${features.time_in_range}%`,    background: '#007700', height: '100%' }} />
                    <div title={`Above: ${features.time_above_range}%`}   style={{ width: `${features.time_above_range}%`, background: '#cc0000', height: '100%' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, fontSize: 9, marginTop: 1 }}>
                    <span style={{ color: '#996600' }}>■ Below</span>
                    <span style={{ color: '#007700' }}>■ In range</span>
                    <span style={{ color: '#cc0000' }}>■ Above</span>
                  </div>

                  <div style={{ marginTop: 8, fontSize: 10, fontWeight: 'bold' }}>Variability</div>
                  <div style={{ fontSize: 11, fontFamily: 'Courier New, monospace' }}>
                    CV: <span style={{ color: features.cv_glucose >= 50 ? '#cc0000' : features.cv_glucose >= 36 ? '#996600' : '#007700', fontWeight: 'bold' }}>
                      {features.cv_glucose}%
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: '#808080', lineHeight: 1.4 }}>
                    Target: &lt;36%<br />
                    High variability indicates poor glycaemic control.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── CGM Trace ── */}
          <div className="groupbox">
            <span className="groupbox-label">
              {patient._glucoseGraphData?.length > 0 ? 'CGM Trace — Uploaded Glucose (mg/dL)' : 'CGM Trace — 14-Day Glucose (mg/dL)'}
            </span>
            {patient._glucoseGraphData?.length > 0
              ? <PatientGraph data={patient._glucoseGraphData} />
              : <CGMChart data={patient.cgm} />
            }
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {[
                { label: 'Mean Glucose',           value: `${features?.mean_glucose ?? meanGlucose} mg/dL` },
                { label: 'Time in Range (70–180)', value: `${features?.time_in_range ?? '—'}%`,  color: features ? (features.time_in_range >= 70 ? '#007700' : features.time_in_range >= 50 ? '#996600' : '#cc0000') : undefined },
                { label: 'Time Above 180',         value: `${features?.time_above_range ?? '—'}%`, color: features ? (features.time_above_range >= 25 ? '#cc0000' : features.time_above_range >= 10 ? '#996600' : '#007700') : undefined },
                { label: 'Time Below 70',          value: `${features?.time_below_range ?? '—'}%`, color: features ? (features.time_below_range >= 4 ? '#cc0000' : features.time_below_range >= 1 ? '#996600' : '#007700') : undefined },
              ].map(({ label, value, color }) => (
                <div key={label} className="stat-box" style={{ flex: 1, minWidth: 110 }}>
                  <div style={{ fontSize: 10, color: '#808080', marginBottom: 1 }}>{label}</div>
                  <div style={{ fontFamily: 'Courier New, monospace', fontSize: 13, fontWeight: 'bold', color: color || '#000080' }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Action row ── */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, paddingTop: 4, borderTop: '1px solid #808080' }}>
            {approved ? (
              <div className="raised" style={{ padding: '5px 16px', background: '#f0fff0', fontWeight: 'bold', color: '#007700', fontSize: 12, border: '1px solid #007700' }}>
                ✓ Approved — added to trial cohort
              </div>
            ) : (
              <button
                className="btn-approve"
                onClick={handleApprove}
                disabled={approving || isLoading}
                style={{ opacity: (approving || isLoading) ? 0.6 : 1, cursor: (approving || isLoading) ? 'wait' : 'pointer' }}
              >
                {approving ? 'Processing...' : 'Approve for Clinical Trial'}
              </button>
            )}
            <button className="btn-win" style={{ fontSize: 12 }} onClick={onClose}>Cancel</button>
          </div>

        </div>
      </div>
    </div>
  );
}
