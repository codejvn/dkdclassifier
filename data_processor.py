"""
DKD Risk Prediction — Data Processing Pipeline
Prepares the ShanghaiT2DM dataset for XGBoost classification.

Data layout (relative to project root):
  data-and-cleaning/ShanghaiT1DM/2022.11/
    Shanghai_T2DM_Summary.xlsx          <- clinical ground truth
    Shanghai_T2DM/<patient_id>.xlsx     <- per-session CGM time-series
"""

import os
import glob
import warnings

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Paths — edit if your working directory differs from the project root
# ---------------------------------------------------------------------------
BASE_DIR = os.path.join(
    "data-and-cleaning", "ShanghaiT1DM", "2022.11"
)
SUMMARY_PATH = os.path.join(BASE_DIR, "Shanghai_T2DM_Summary.xlsx")
CGM_DIR      = os.path.join(BASE_DIR, "Shanghai_T2DM")

# ---------------------------------------------------------------------------
# Clinical constants
# All CGM files use mg/dL — thresholds follow ADA/EASD consensus targets.
# ---------------------------------------------------------------------------
TAR_THRESHOLD_HIGH  = 180.0   # mg/dL  (> 10.0 mmol/L)
TBR_THRESHOLD_LOW   =  70.0   # mg/dL  (< 3.9  mmol/L)
EGFR_DKD_THRESHOLD  =  60.0   # ml/min/1.73m²  — CKD stage ≥3 signals DKD risk


# ===========================================================================
# STEP A — Label generation from clinical summary
# ===========================================================================

def load_labels(summary_path: str = SUMMARY_PATH) -> pd.DataFrame:
    """
    Load the T2DM clinical summary and derive a binary DKD_Risk label.

    DKD_Risk = 1  if eGFR < 60 ml/min/1.73m²  (CKD stage ≥3, high risk)
    DKD_Risk = 0  if eGFR ≥ 60 ml/min/1.73m²  (low / normal risk)

    Returns a DataFrame with columns: [patient_id, DKD_Risk]
    """
    if not os.path.isfile(summary_path):
        raise FileNotFoundError(f"Clinical summary not found: {summary_path}")

    df = pd.read_excel(summary_path)

    # --- locate patient-ID column (first column, regardless of exact name) ---
    patient_col = df.columns[0]

    # --- locate eGFR column by partial string match (handles whitespace/typos) ---
    egfr_col_matches = [c for c in df.columns if "Glomerular Filtration" in c or "eGFR" in c]
    if not egfr_col_matches:
        raise KeyError(
            "Cannot find an eGFR column in the summary. "
            f"Available columns: {df.columns.tolist()}"
        )
    egfr_col = egfr_col_matches[0]

    # --- keep only the two columns we need and drop rows where eGFR is missing ---
    labels = df[[patient_col, egfr_col]].copy()
    labels.columns = ["patient_id", "eGFR"]

    # The column is stored as object; '/' is used as a missing-value sentinel.
    labels["eGFR"] = pd.to_numeric(labels["eGFR"], errors="coerce")

    n_before = len(labels)
    labels = labels.dropna(subset=["eGFR"])
    n_dropped = n_before - len(labels)
    if n_dropped:
        warnings.warn(f"Dropped {n_dropped} rows with missing/unparseable eGFR.")

    labels["DKD_Risk"] = (labels["eGFR"] < EGFR_DKD_THRESHOLD).astype(int)
    labels = labels[["patient_id", "DKD_Risk"]].reset_index(drop=True)

    pos = labels["DKD_Risk"].sum()
    print(f"[Labels]  {len(labels)} patients loaded  |  "
          f"DKD_Risk=1: {pos} ({100*pos/len(labels):.1f}%)  "
          f"DKD_Risk=0: {len(labels)-pos}")
    return labels


# ===========================================================================
# STEP B — CGM feature engineering
# ===========================================================================

def _cgm_column(df: pd.DataFrame, filepath: str) -> pd.Series:
    """Return the CGM glucose series from a patient file."""
    # Primary expected column name
    if "CGM (mg / dl)" in df.columns:
        return df["CGM (mg / dl)"].dropna()

    # Fallback: first numeric column whose name contains 'CGM' or 'Glucose'
    candidates = [
        c for c in df.columns
        if ("CGM" in c.upper() or "GLUCOSE" in c.upper())
        and pd.api.types.is_numeric_dtype(df[c])
    ]
    if candidates:
        warnings.warn(
            f"{os.path.basename(filepath)}: Expected 'CGM (mg / dl)', "
            f"using '{candidates[0]}' instead."
        )
        return df[candidates[0]].dropna()

    raise KeyError(
        f"No recognisable CGM column in {filepath}. "
        f"Columns present: {df.columns.tolist()}"
    )


def extract_cgm_features(cgm_dir: str = CGM_DIR) -> pd.DataFrame:
    """
    Iterate over every patient CGM file and compute glycemic-variability (GV)
    features that capture both hyper- and hypo-glycaemic burden.

    Returns a DataFrame with columns:
        patient_id, mean_glucose, glucose_std, cv_glucose,
        time_above_range, time_below_range, time_in_range
    """
    files = sorted(
        glob.glob(os.path.join(cgm_dir, "*.xlsx")) +
        glob.glob(os.path.join(cgm_dir, "*.xls"))
    )
    # Filter out Excel lock/temp files (prefixed with ~$)
    files = [f for f in files if not os.path.basename(f).startswith("~$")]

    if not files:
        raise FileNotFoundError(
            f"No .xlsx files found in CGM directory: {cgm_dir}"
        )

    records = []
    skipped = 0

    for fpath in files:
        patient_id = os.path.splitext(os.path.basename(fpath))[0]
        try:
            raw = pd.read_excel(fpath)
            glucose = _cgm_column(raw, fpath)

            if len(glucose) < 10:
                warnings.warn(
                    f"Skipping {patient_id}: fewer than 10 valid CGM readings."
                )
                skipped += 1
                continue

            n = len(glucose)
            mean_g = glucose.mean()
            std_g  = glucose.std(ddof=1)

            records.append({
                "patient_id"      : patient_id,
                "mean_glucose"    : mean_g,
                "glucose_std"     : std_g,
                # CV is undefined when mean ≈ 0; guard with a small epsilon
                "cv_glucose"      : (std_g / mean_g) if mean_g > 1e-6 else np.nan,
                "time_above_range": (glucose > TAR_THRESHOLD_HIGH).sum() / n,
                "time_below_range": (glucose < TBR_THRESHOLD_LOW).sum()  / n,
                "time_in_range"   : (
                    (glucose >= TBR_THRESHOLD_LOW) &
                    (glucose <= TAR_THRESHOLD_HIGH)
                ).sum() / n,
            })

        except Exception as exc:
            warnings.warn(f"Skipping {patient_id} due to error: {exc}")
            skipped += 1

    if not records:
        raise RuntimeError("No CGM features could be extracted. Check your data.")

    features = pd.DataFrame(records)
    print(f"[CGM]  {len(features)} patient-sessions processed  |  {skipped} skipped")
    return features


# ===========================================================================
# STEP C — Merge, clean, and return model-ready arrays
# ===========================================================================

def build_dataset(
    summary_path: str = SUMMARY_PATH,
    cgm_dir:      str = CGM_DIR,
) -> tuple[pd.DataFrame, pd.Series]:
    """
    Full ETL pipeline.

    Returns
    -------
    X : pd.DataFrame
        Feature matrix ready for XGBClassifier — no PHI columns, no NaNs.
    y : pd.Series
        Binary target (DKD_Risk: 0 = low risk, 1 = high risk).
    """
    # A — labels
    labels   = load_labels(summary_path)

    # B — CGM features
    features = extract_cgm_features(cgm_dir)

    # C.1 — merge on patient_id (inner join: keep only matched records)
    merged = features.merge(labels, on="patient_id", how="left")

    # C.2 — drop rows where we have no ground-truth label
    n_before = len(merged)
    merged   = merged.dropna(subset=["DKD_Risk"])
    n_dropped = n_before - len(merged)
    if n_dropped:
        warnings.warn(
            f"Dropped {n_dropped} CGM records with no matching label "
            f"(likely patient IDs absent from the summary file)."
        )

    if merged.empty:
        raise RuntimeError(
            "Merged dataset is empty. Verify that patient IDs in the summary "
            "match the CGM filenames (stem should equal 'Patient Number')."
        )

    # C.3 — median imputation for any remaining NaN in feature columns
    feature_cols = ["mean_glucose", "glucose_std", "cv_glucose",
                    "time_above_range", "time_below_range", "time_in_range"]

    for col in feature_cols:
        n_nan = merged[col].isna().sum()
        if n_nan:
            median_val = merged[col].median()
            merged[col] = merged[col].fillna(median_val)
            warnings.warn(f"Imputed {n_nan} NaN(s) in '{col}' with median={median_val:.4f}.")

    # C.4 — drop patient_id and any other PHI before exposing to the model
    X = merged[feature_cols].reset_index(drop=True)
    y = merged["DKD_Risk"].astype(int).reset_index(drop=True)

    pos = y.sum()
    print(
        f"[Output]  {len(X)} samples  |  features: {X.columns.tolist()}\n"
        f"          Class balance — DKD_Risk=1: {pos} ({100*pos/len(y):.1f}%)  "
        f"DKD_Risk=0: {len(y)-pos}"
    )
    return X, y


# ===========================================================================
# Quick smoke-test when run as a script
# ===========================================================================

if __name__ == "__main__":
    X, y = build_dataset()

    print("\n--- Feature matrix (first 5 rows) ---")
    print(X.head().to_string(index=False))
    print(f"\n--- Target distribution ---\n{y.value_counts().to_string()}")

    # Verify it drops straight into XGBoost without modification
    try:
        import xgboost as xgb
        model = xgb.XGBClassifier(n_estimators=10, eval_metric="logloss", verbosity=0)
        model.fit(X, y)
        print("\nXGBClassifier fit succeeded — dataset is model-ready.")
    except ImportError:
        print("\nxgboost not installed; skipping model check.")
