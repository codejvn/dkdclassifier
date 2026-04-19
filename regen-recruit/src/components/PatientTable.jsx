// ─── Patient Table — live ML predictions ─────────────────────────────────────

const FLAG_COLORS = { RED: '#cc0000', YELLOW: '#996600', GREEN: '#007700' };
const FLAG_BG     = { RED: '#fff0f0', YELLOW: '#fffacd', GREEN: '#f0fff0' };
const FLAG_BORDER = { RED: '#cc0000', YELLOW: '#ccaa00', GREEN: '#007700' };

function RiskCell({ score, flag, loading, error, onRetry }) {
  if (loading) {
    return (
      <span style={{ color: '#808080', fontSize: 11, fontStyle: 'italic' }}>
        Inferring...
      </span>
    );
  }
  if (error) {
    return (
      <span style={{ fontSize: 11, color: '#808080' }}>
        —&nbsp;
        <button
          className="btn-win"
          style={{ fontSize: 9, padding: '1px 4px', minHeight: 'unset' }}
          onClick={e => { e.stopPropagation(); onRetry(); }}
          title={error}
        >
          Retry
        </button>
      </span>
    );
  }

  const color  = FLAG_COLORS[flag] ?? '#808080';
  const bg     = FLAG_BG[flag]     ?? '#f4f4f4';
  const border = FLAG_BORDER[flag] ?? '#aaa';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {/* Win95-style progress bar */}
      <div className="risk-bar-track" style={{ width: 68 }}>
        <div className="risk-bar-fill" style={{ width: `${score}%`, background: color }} />
      </div>

      <span style={{ fontFamily: 'Courier New, monospace', fontSize: 12, fontWeight: 'bold', color, minWidth: 32 }}>
        {score}%
      </span>

      {/* Risk flag badge */}
      <span style={{
        fontSize: 10,
        fontWeight: 'bold',
        color,
        background: bg,
        border: `1px solid ${border}`,
        padding: '1px 5px',
        whiteSpace: 'nowrap',
      }}>
        {flag}
      </span>
    </div>
  );
}

function eGFRColor(v) {
  return v < 30 ? '#cc0000' : v < 60 ? '#996600' : '#000000';
}

export default function PatientTable({ patients, predictions, selectedId, onSelect, onRetry, onDelete }) {
  if (patients.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff', color: '#808080', fontSize: 13 }}>
        No records match the current filter criteria.
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#ffffff' }}>
      <table className="win-table">
        <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
          <tr>
            {['Patient ID', 'Age', 'Sex', 'CV Glucose', 'Time in Range', 'DKD Risk (ML)', ''].map(h => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {patients.map(p => {
            const pred = predictions[p.id] ?? {};
            const score = pred.risk_score_percent ?? p.dkdRisk;
            const isSelected = selectedId === p.id;

            return (
              <tr
                key={p.id}
                className={`win-row ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelect(p)}
              >
                <td>
                  <span style={{
                    fontFamily: 'Courier New, monospace',
                    fontWeight: 'bold',
                    color: isSelected ? '#ffffff' : '#000080',
                  }}>
                    {p.id}
                  </span>
                </td>

                <td>{p.age}</td>
                <td>{p.gender}</td>

                <td>
                  <span style={{
                    fontFamily: 'Courier New, monospace',
                    color: isSelected ? '#ffffff' : (
                      pred.features?.cv_glucose >= 50 ? '#cc0000'
                      : pred.features?.cv_glucose >= 36 ? '#996600'
                      : pred.features?.cv_glucose != null ? '#007700'
                      : '#808080'
                    ),
                  }}>
                    {pred.features?.cv_glucose != null ? `${pred.features.cv_glucose}%` : '—'}
                  </span>
                </td>

                <td>
                  <span style={{
                    fontFamily: 'Courier New, monospace',
                    color: isSelected ? '#ffffff' : (
                      pred.features?.time_in_range >= 70 ? '#007700'
                      : pred.features?.time_in_range >= 50 ? '#996600'
                      : pred.features?.time_in_range != null ? '#cc0000'
                      : '#808080'
                    ),
                  }}>
                    {pred.features?.time_in_range != null ? `${pred.features.time_in_range}%` : '—'}
                  </span>
                </td>

                <td style={{ minWidth: 210 }}>
                  {isSelected
                    ? <span style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#ffffff' }}>
                        {score}% {pred.risk_flag && `— ${pred.risk_flag}`}
                      </span>
                    : <RiskCell
                        score={score}
                        flag={pred.risk_flag}
                        loading={pred.loading}
                        error={pred.error}
                        onRetry={() => onRetry(p)}
                      />
                  }
                </td>

                <td style={{ display: 'flex', gap: 4 }}>
                  <button
                    className="btn-win"
                    style={{ fontSize: 11 }}
                    onClick={e => { e.stopPropagation(); onSelect(p); }}
                  >
                    Details...
                  </button>
                  <button
                    className="btn-win"
                    style={{ fontSize: 11, color: '#cc0000' }}
                    onClick={e => { e.stopPropagation(); onDelete?.(p.id); }}
                    title="Remove patient from table"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
