// ─── Derive the 6 ML input features from a CGM array ─────────────────────────
// Each point in cgmData is { glucose: number, time: string, index: number }

export function computeCGMFeatures(cgmData) {
  const values = cgmData.map(d => d.glucose);
  const n = values.length;

  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);

  const above   = values.filter(v => v > 180).length;
  const below   = values.filter(v => v < 70).length;
  const inRange = n - above - below;

  return {
    mean_glucose:     parseFloat(mean.toFixed(2)),
    glucose_std:      parseFloat(std.toFixed(2)),
    cv_glucose:       parseFloat(((std / mean) * 100).toFixed(2)),
    time_above_range: parseFloat(((above   / n) * 100).toFixed(2)),
    time_below_range: parseFloat(((below   / n) * 100).toFixed(2)),
    time_in_range:    parseFloat(((inRange / n) * 100).toFixed(2)),
  };
}
