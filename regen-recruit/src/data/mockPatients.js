// ─────────────────────────────────────────────────────────────────────────────
// Mock patient cohort for the DKD Clinical Recruiter Dashboard
// ─────────────────────────────────────────────────────────────────────────────

function generateCGM(baseGlucose, variability, days = 14) {
  const points = [];
  const now = new Date();
  const msPerReading = 5 * 60 * 1000; // 5-min intervals
  const totalReadings = days * 24 * 12; // 12 readings/hr * 24h * 14 days

  // We'll return ~288 points (1 day worth) to keep charts snappy
  const displayReadings = 288;
  const startOffset = (totalReadings - displayReadings) * msPerReading;

  for (let i = 0; i < displayReadings; i++) {
    const t = new Date(now.getTime() - startOffset + i * msPerReading);
    const hour = t.getHours();
    // Simulate meal spikes at 7am, 12pm, 6pm
    const mealSpike =
      (Math.abs(hour - 7) < 1 ? 1 : 0) * 60 +
      (Math.abs(hour - 12) < 1 ? 1 : 0) * 55 +
      (Math.abs(hour - 18) < 1 ? 1 : 0) * 50;
    const noise = (Math.random() - 0.5) * variability * 2;
    const glucose = Math.max(60, baseGlucose + mealSpike + noise);
    points.push({
      time: t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      glucose: Math.round(glucose),
      index: i,
    });
  }
  return points;
}

export const PATIENTS = [
  {
    id: 'PT-00142',
    age: 67,
    egfr: 28,
    hba1c: 9.4,
    dkdRisk: 94,
    gender: 'M',
    diabetesDuration: 18,
    bmi: 31.2,
    systolicBP: 158,
    cgm: generateCGM(195, 55),
    shapImageUrl: null, // populated by backend
    flags: ['HIGH_VARIABILITY', 'eGFR_DECLINING', 'NOCTURNAL_HYPER'],
  },
  {
    id: 'PT-00089',
    age: 54,
    egfr: 34,
    hba1c: 8.8,
    dkdRisk: 87,
    gender: 'F',
    diabetesDuration: 12,
    bmi: 28.7,
    systolicBP: 144,
    cgm: generateCGM(180, 48),
    shapImageUrl: null,
    flags: ['HIGH_VARIABILITY', 'eGFR_DECLINING'],
  },
  {
    id: 'PT-00311',
    age: 72,
    egfr: 22,
    hba1c: 10.1,
    dkdRisk: 96,
    gender: 'M',
    diabetesDuration: 24,
    bmi: 34.1,
    systolicBP: 162,
    cgm: generateCGM(210, 70),
    shapImageUrl: null,
    flags: ['HIGH_VARIABILITY', 'eGFR_DECLINING', 'NOCTURNAL_HYPER', 'HYPOGLYCEMIA_RISK'],
  },
  {
    id: 'PT-00204',
    age: 61,
    egfr: 42,
    hba1c: 8.2,
    dkdRisk: 74,
    gender: 'F',
    diabetesDuration: 9,
    bmi: 27.3,
    systolicBP: 138,
    cgm: generateCGM(165, 40),
    shapImageUrl: null,
    flags: ['HIGH_VARIABILITY'],
  },
  {
    id: 'PT-00078',
    age: 49,
    egfr: 51,
    hba1c: 7.8,
    dkdRisk: 62,
    gender: 'M',
    diabetesDuration: 7,
    bmi: 26.1,
    systolicBP: 132,
    cgm: generateCGM(155, 35),
    shapImageUrl: null,
    flags: ['HIGH_VARIABILITY'],
  },
  {
    id: 'PT-00556',
    age: 58,
    egfr: 65,
    hba1c: 7.3,
    dkdRisk: 41,
    gender: 'F',
    diabetesDuration: 6,
    bmi: 24.9,
    systolicBP: 128,
    cgm: generateCGM(148, 28),
    shapImageUrl: null,
    flags: [],
  },
  {
    id: 'PT-00399',
    age: 44,
    egfr: 78,
    hba1c: 6.9,
    dkdRisk: 23,
    gender: 'M',
    diabetesDuration: 4,
    bmi: 23.5,
    systolicBP: 122,
    cgm: generateCGM(138, 22),
    shapImageUrl: null,
    flags: [],
  },
  {
    id: 'PT-00712',
    age: 63,
    egfr: 38,
    hba1c: 9.0,
    dkdRisk: 81,
    gender: 'F',
    diabetesDuration: 15,
    bmi: 30.4,
    systolicBP: 149,
    cgm: generateCGM(175, 52),
    shapImageUrl: null,
    flags: ['HIGH_VARIABILITY', 'eGFR_DECLINING'],
  },
  {
    id: 'PT-00093',
    age: 55,
    egfr: 58,
    hba1c: 7.6,
    dkdRisk: 55,
    gender: 'M',
    diabetesDuration: 8,
    bmi: 25.8,
    systolicBP: 135,
    cgm: generateCGM(158, 32),
    shapImageUrl: null,
    flags: ['HIGH_VARIABILITY'],
  },
  {
    id: 'PT-00481',
    age: 70,
    egfr: 19,
    hba1c: 10.8,
    dkdRisk: 98,
    gender: 'M',
    diabetesDuration: 28,
    bmi: 36.2,
    systolicBP: 168,
    cgm: generateCGM(225, 80),
    shapImageUrl: null,
    flags: ['HIGH_VARIABILITY', 'eGFR_DECLINING', 'NOCTURNAL_HYPER', 'HYPOGLYCEMIA_RISK'],
  },
];
