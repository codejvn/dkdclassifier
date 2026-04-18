import { useState, useMemo, useEffect, useCallback } from 'react';
import './index.css';
import CyberHeader from './components/CyberHeader';
import Sidebar from './components/Sidebar';
import PatientTable from './components/PatientTable';
import DeepDiveModal from './components/DeepDiveModal';
import { PATIENTS } from './data/mockPatients';
import { computeCGMFeatures } from './utils/cgmFeatures';
import { callPredict } from './services/mlApi';

const DEFAULT_FILTERS = { minRisk: 0, maxAge: 90, minEgfr: 0, showHighOnly: false };

// predictions shape per patient:
// { loading: bool, features: obj|null, risk_score_percent: number|null, risk_flag: str|null, error: str|null }
const makeLoading  = () => ({ loading: true,  features: null, risk_score_percent: null, risk_flag: null, error: null });
const makeError    = (msg) => ({ loading: false, features: null, risk_score_percent: null, risk_flag: null, error: msg });
const makeResult   = (features, result) => ({ loading: false, features, ...result, error: null });

// Effective risk for sorting / filtering — falls back to mock dkdRisk while loading
function effectiveRisk(patient, predictions) {
  const p = predictions[patient.id];
  return (p && !p.loading && p.risk_score_percent != null) ? p.risk_score_percent : patient.dkdRisk;
}

export default function App() {
  const [filters, setFilters]          = useState(DEFAULT_FILTERS);
  const [selectedPatient, setSelected] = useState(null);
  const [predictions, setPredictions]  = useState(
    () => Object.fromEntries(PATIENTS.map(p => [p.id, makeLoading()]))
  );

  // ── Fetch a single patient's prediction ──────────────────────────────────
  const fetchOne = useCallback(async (patient) => {
    setPredictions(prev => ({ ...prev, [patient.id]: makeLoading() }));
    try {
      const features = computeCGMFeatures(patient.cgm);
      const result   = await callPredict(features);
      setPredictions(prev => ({ ...prev, [patient.id]: makeResult(features, result) }));
    } catch (err) {
      setPredictions(prev => ({ ...prev, [patient.id]: makeError(err.message) }));
    }
  }, []);

  // ── Fetch all patients on mount ──────────────────────────────────────────
  useEffect(() => {
    PATIENTS.forEach(p => fetchOne(p));
  }, [fetchOne]);

  const filtered = useMemo(() =>
    PATIENTS
      .filter(p => {
        const risk = effectiveRisk(p, predictions);
        if (risk < filters.minRisk)                  return false;
        if (p.age > filters.maxAge)                  return false;
        if (p.egfr < filters.minEgfr)               return false;
        if (filters.showHighOnly && risk <= 80)      return false;
        return true;
      })
      .sort((a, b) => effectiveRisk(b, predictions) - effectiveRisk(a, predictions)),
    [filters, predictions]
  );

  // Status bar counts (use live predictions where available)
  const counts = useMemo(() => {
    let high = 0, med = 0, low = 0, loading = 0;
    PATIENTS.forEach(p => {
      const pred = predictions[p.id];
      if (pred?.loading) { loading++; return; }
      const r = pred?.risk_score_percent ?? p.dkdRisk;
      if (r > 80) high++;
      else if (r >= 50) med++;
      else low++;
    });
    return { high, med, low, loading };
  }, [predictions]);

  const anyLoading = counts.loading > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

      <CyberHeader />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        <Sidebar
          filters={filters}
          onChange={setFilters}
          totalShown={filtered.length}
          totalAll={PATIENTS.length}
          anyLoading={anyLoading}
        />

        <main
          className="raised"
          style={{ flex: 1, margin: 4, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#d4d0c8' }}
        >
          {/* Panel title bar */}
          <div className="win-title" style={{ fontSize: 11 }}>
            <span style={{ fontSize: 12 }}>📋</span>
            <span style={{ flex: 1 }}>Patient Cohort — DKD Risk Assessment</span>
            {anyLoading && (
              <span style={{ fontWeight: 'normal', fontSize: 11, color: '#aad4ff', marginRight: 10 }}>
                ⏳ Running ML inference...
              </span>
            )}
            <span style={{ fontWeight: 'normal', fontSize: 11 }}>
              {filtered.length} record{filtered.length !== 1 ? 's' : ''} &nbsp;|&nbsp; sorted by risk ↓
            </span>
          </div>

          <PatientTable
            patients={filtered}
            predictions={predictions}
            selectedId={selectedPatient?.id}
            onSelect={setSelected}
            onRetry={fetchOne}
          />

          {/* Status bar */}
          <div className="status-bar">
            <div className="status-pane" style={{ flex: 2 }}>
              {anyLoading ? `Inferring... (${counts.loading} pending)` : 'Ready'}
            </div>
            <div className="status-pane" style={{ flex: 3 }}>
              {filtered.length} patient{filtered.length !== 1 ? 's' : ''} displayed
            </div>
            <div className="status-pane" style={{ flex: 3, color: '#cc0000', fontWeight: 'bold' }}>
              High risk: {counts.high}
            </div>
            <div className="status-pane" style={{ flex: 3, color: '#996600', fontWeight: 'bold' }}>
              Medium: {counts.med}
            </div>
            <div className="status-pane" style={{ flex: 3, color: '#007700' }}>
              Low: {counts.low}
            </div>
            <div className="status-pane" style={{ flex: 5, textAlign: 'right', color: '#808080' }}>
              ML Backend: localhost:8000 &nbsp;|&nbsp; REGEN-RECRUIT v2.0
            </div>
          </div>
        </main>
      </div>

      {selectedPatient && (
        <DeepDiveModal
          patient={selectedPatient}
          prediction={predictions[selectedPatient.id]}
          onClose={() => setSelected(null)}
          onRetry={() => fetchOne(selectedPatient)}
        />
      )}
    </div>
  );
}
