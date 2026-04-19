// ─── POST to the ML inference backend ────────────────────────────────────────
// Proxied through Vite dev server (/predict → http://:8000/predict)
// Returns { risk_score_percent: number, risk_flag: "RED"|"YELLOW"|"GREEN" }

export async function callPredict(features) {
  const res = await fetch('/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(features),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}
