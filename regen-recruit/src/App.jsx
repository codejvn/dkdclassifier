import { useState, useMemo, useCallback } from 'react';
import './index.css';
import CyberHeader from './components/CyberHeader';
import Sidebar from './components/Sidebar';
import PatientTable from './components/PatientTable';
import DeepDiveModal from './components/DeepDiveModal';
import CsvUpload from './components/CsvUpload';

const DEFAULT_FILTERS = { minRisk: 0, maxAge: 90, minEgfr: 0, showHighOnly: false };

const makeResult = (features, result) => ({ loading: false, features, ...result, error: null });

function parseCSVContent(csv) {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) throw new Error('CSV file is empty or invalid');

  const headerLine = lines[0];
  const headers = [];
  let current = '';
  let inQuotes = false;

  // Parse CSV headers with quote support
  for (let i = 0; i < headerLine.length; i++) {
    const char = headerLine[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      headers.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  headers.push(current.trim());

  // Parse data rows
  const rows = [];
  for (let lineIdx = 1; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    if (!line.trim()) continue;

    const row = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    row.push(current.trim());
    rows.push(row);
  }

  return { headers, rows };
}

function importFromCSV(file, setPatients, setPredictions) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const csv = e.target.result;
      const { headers, rows } = parseCSVContent(csv);

      // Map headers to indices
      const headerMap = {};
      headers.forEach((h, i) => {
        headerMap[h.toLowerCase().replace(/[^a-z0-9]/g, '')] = i;
      });

      const newPatients = [];
      const newPredictions = {};

      rows.forEach((row, idx) => {
        const getId = (name) => {
          const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
          const index = headerMap[key];
          return index !== undefined ? row[index] : null;
        };

        const patientId = getId('Patient ID');
        if (!patientId) {
          console.warn(`Row ${idx + 1}: Missing Patient ID, skipping`);
          return;
        }

        const age = getId('Age');
        const sex = getId('Sex');
        const meanGlucose = getId('Mean Glucose');
        const glucoseStd = getId('Glucose Std Dev');
        const cv = getId('Coeff of Variation');
        const tir = getId('Time in Range');
        const tar = getId('Time Above 180');
        const tbr = getId('Time Below 70');
        const riskScore = getId('DKD Risk Score');
        const riskFlag = getId('DKD Risk Flag');
        const flags = getId('Clinical Flags');
        const cgmTraceJSON = getId('CGM Trace Data');

        // Parse CGM data from JSON column
        let glucoseGraphData = [];
        if (cgmTraceJSON && cgmTraceJSON !== '—') {
          try {
            glucoseGraphData = JSON.parse(cgmTraceJSON);
          } catch (e) {
            console.warn(`Row ${idx + 1}: Failed to parse CGM data: ${e.message}`);
          }
        }

        newPatients.push({
          id: patientId,
          age: age && age !== '—' ? parseInt(age) : '—',
          gender: sex && sex !== '—' ? sex : '—',
          dkdRisk: riskScore ? parseFloat(riskScore) : 0,
          cgm: glucoseGraphData.map((d, i) => ({ glucose: d.value, time: String(d.time), index: i })),
          flags: flags && flags !== 'None' ? flags.split(';').map(f => f.trim()) : [],
          _fileName: file.name,
          _glucoseGraphData: glucoseGraphData,
        });

        // Create prediction record
        newPredictions[patientId] = {
          loading: false,
          error: null,
          risk_score_percent: riskScore ? parseFloat(riskScore) : 0,
          risk_flag: riskFlag && riskFlag !== 'N/A' ? riskFlag : null,
          features: {
            mean_glucose: meanGlucose ? parseFloat(meanGlucose) : 0,
            glucose_std: glucoseStd ? parseFloat(glucoseStd) : 0,
            cv_glucose: cv ? parseFloat(cv) : 0,
            time_in_range: tir ? parseFloat(tir) / 100 : 0,
            time_above_range: tar ? parseFloat(tar) / 100 : 0,
            time_below_range: tbr ? parseFloat(tbr) / 100 : 0,
          },
        };
      });

      setPatients(prev => [...newPatients, ...prev]);
      setPredictions(prev => ({ ...newPredictions, ...prev }));
    } catch (err) {
      alert(`Import error: ${err.message}`);
    }
  };
  reader.readAsText(file);
}

function exportToCSV(patients, predictions) {
  // Build CSV headers
  const headers = [
    'Patient ID',
    'Age',
    'Sex',
    'Mean Glucose (mg/dL)',
    'Glucose Std Dev (mg/dL)',
    'Coeff of Variation (%)',
    'Time in Range (70-180) (%)',
    'Time Above 180 (%)',
    'Time Below 70 (%)',
    'DKD Risk Score (%)',
    'DKD Risk Flag',
    'Clinical Flags',
    'CGM Trace Data (JSON)',
  ];

  // Build CSV rows
  const rows = patients.map(p => {
    const pred = predictions[p.id] ?? {};
    const features = pred.features ?? {};
    const riskScore = pred.risk_score_percent ?? p.dkdRisk;
    const riskFlag = pred.risk_flag ?? 'N/A';

    // Export CGM data as JSON (prioritize _glucoseGraphData if available, fall back to cgm)
    const cgmData = p._glucoseGraphData?.length > 0 ? p._glucoseGraphData : p.cgm?.map(d => ({ time: d.index ?? d.time, value: d.glucose })) ?? [];
    const cgmJSON = JSON.stringify(cgmData);

    return [
      p.id,
      p.age ?? '—',
      p.gender ?? '—',
      features.mean_glucose ?? '—',
      features.glucose_std ?? '—',
      features.cv_glucose ?? '—',
      (features.time_in_range != null ? (features.time_in_range * 100).toFixed(2) : '—'),
      (features.time_above_range != null ? (features.time_above_range * 100).toFixed(2) : '—'),
      (features.time_below_range != null ? (features.time_below_range * 100).toFixed(2) : '—'),
      riskScore?.toFixed(2) ?? '—',
      riskFlag,
      (p.flags ?? []).join('; ') || 'None',
      cgmJSON,
    ];
  });

  // Escape CSV values (handle commas, quotes, newlines)
  const escapeCSV = val => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // Build CSV content
  const csvContent = [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => row.map(escapeCSV).join(',')),
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `dkd-cohort-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

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

  const handleDeletePatient = useCallback((id) => {
    setPatients(prev => prev.filter(p => p.id !== id));
    setPredictions(prev => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
    if (selectedPatient?.id === id) {
      setSelected(null);
    }
  }, [selectedPatient]);

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
        onImport={file => importFromCSV(file, setPatients, setPredictions)}
        onExport={() => exportToCSV(patients, predictions)}
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
            onDelete={handleDeletePatient}
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
          onDelete={handleDeletePatient}
        />
      )}
    </div>
  );
}
