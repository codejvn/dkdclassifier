import { useState, useMemo, useCallback } from 'react';
import './index.css';
import CyberHeader from './components/CyberHeader';
import Sidebar from './components/Sidebar';
import PatientTable from './components/PatientTable';
import DeepDiveModal from './components/DeepDiveModal';
import CsvUpload from './components/CsvUpload';

const DEFAULT_FILTERS = { minRisk: 0, maxAge: 90, minEgfr: 0, showHighOnly: false };

const makeResult = (features, result) => ({ loading: false, features, ...result, error: null });

function effectiveRisk(patient, predictions) {
  const p = predictions[patient.id];
  return (p && !p.loading && p.risk_score_percent != null) ? p.risk_score_percent : patient.dkdRisk;
}

export default function App() {
  const [filters, setFilters]          = useState(DEFAULT_FILTERS);
  const [selectedPatient, setSelected] = useState(null);
  const [patients, setPatients]        = useState([]);
  const [predictions, setPredictions]  = useState({});
  const [apiStatus, setApiStatus]      = useState('idle');
  const [lastUpload, setLastUpload]    = useState(null);

  // ── Handle CSV upload result from backend ────────────────────────────────
  const handlePatientUpdate = useCallback((id, changes) => {
    setPatients(prev => prev.map(p => p.id === id ? { ...p, ...changes } : p));
  }, []);

  const handleCsvResult = useCallback((result, fileName) => {
    const id           = `UP-${Date.now()}`;
    const score        = Math.round(result.risk_score_percent * 10) / 10;
    const demographics = result.patient_demographics ?? {};
    const graphData    = result.glucose_graph_data    ?? [];

    const newPatient = {
      id,
      age:               demographics.age ?? '—',
      gender:            demographics.sex ?? '—',
      dkdRisk:           score,
      cgm:               graphData.map((d, i) => ({ glucose: d.value, time: String(d.time), index: i })),
      flags:             ['CSV_UPLOAD'],
      _fileName:         fileName,
      _glucoseGraphData: graphData,
    };

    setLastUpload(new Date());
    setApiStatus('ok');
    setPatients(prev => [newPatient, ...prev]);
    setPredictions(prev => ({
      ...prev,
      [id]: makeResult(result.extracted_features ?? {}, { risk_score_percent: score, risk_flag: result.risk_flag }),
    }));
  }, []);

  const filtered = useMemo(() =>
    patients
      .filter(p => {
        const risk = effectiveRisk(p, predictions);
        if (risk < filters.minRisk)             return false;
        if (filters.showHighOnly && risk <= 80) return false;
        return true;
      })
      .sort((a, b) => effectiveRisk(b, predictions) - effectiveRisk(a, predictions)),
    [filters, predictions, patients]
  );

  const counts = useMemo(() => {
    let high = 0, med = 0, low = 0;
    patients.forEach(p => {
      const r = predictions[p.id]?.risk_score_percent ?? p.dkdRisk;
      if (r > 80) high++;
      else if (r >= 50) med++;
      else low++;
    });
    return { high, med, low };
  }, [predictions, patients]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

      <CyberHeader
        totalPatients={patients.length}
        counts={counts}
        apiStatus={apiStatus}
        lastUpload={lastUpload}
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        <Sidebar
          filters={filters}
          onChange={setFilters}
          totalShown={filtered.length}
          totalAll={patients.length}
          anyLoading={false}
        />

        <main
          className="raised"
          style={{ flex: 1, margin: 4, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#d4d0c8' }}
        >
          {/* Panel title bar */}
          <div className="win-title" style={{ fontSize: 11 }}>
            <span style={{ fontSize: 12 }}>📋</span>
            <span style={{ flex: 1 }}>Patient Cohort — DKD Risk Assessment</span>
            <span style={{ fontWeight: 'normal', fontSize: 11 }}>
              {filtered.length} record{filtered.length !== 1 ? 's' : ''} &nbsp;|&nbsp; sorted by risk ↓
            </span>
          </div>

          <CsvUpload onResult={handleCsvResult} onApiStatus={setApiStatus} />

          <PatientTable
            patients={filtered}
            predictions={predictions}
            selectedId={selectedPatient?.id}
            onSelect={setSelected}
            onRetry={() => {}}
          />

          {/* Status bar */}
          <div className="status-bar">
            <div className="status-pane" style={{ flex: 2 }}>Ready</div>
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
              ML Backend: https://codejvn-classfy-dkd-backend.hf.space/predict; REGEN-RECRUIT v2.0
            </div>
          </div>
        </main>
      </div>

      {selectedPatient && (
        <DeepDiveModal
          patient={selectedPatient}
          prediction={predictions[selectedPatient.id]}
          onClose={() => setSelected(null)}
          onUpdate={handlePatientUpdate}
          onRetry={() => {}}
        />
      )}
    </div>
  );
}
