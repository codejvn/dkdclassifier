"""
DKD Risk Prediction — Model Training, Evaluation, and Explainability

Pipeline stages:
  A. Stratified K-Fold cross-validation  ->  AUC-ROC estimate
  B. Final model fit  +  SHAP summary plot  ->  shap_summary.png
  C. Model persistence                    ->  xgb_dkd_model.json

Run standalone:
  python training.py                        # uses data_processor.py to load data
  python training.py --csv path/to/file.csv # reads a pre-exported CSV instead
"""

import argparse
import sys
import warnings

import matplotlib
matplotlib.use("Agg")   # non-interactive backend — no GUI window during execution
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import shap
import xgboost as xgb
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import roc_auc_score

# ---------------------------------------------------------------------------
# Artefact output paths
# ---------------------------------------------------------------------------
MODEL_PATH = "xgb_dkd_model.json"
SHAP_PLOT_PATH = "shap_summary.png"

# ---------------------------------------------------------------------------
# XGBoost hyper-parameters
# scale_pos_weight = negative_count / positive_count ≈ 81/4 ≈ 20.
# Without this, the model would overwhelmingly predict the majority class and
# never learn to flag the rare DKD-positive patients — the exact failure mode
# that matters most in a clinical screening context.
# ---------------------------------------------------------------------------
XGB_PARAMS = dict(
    n_estimators=300,
    max_depth=3,           # shallow trees reduce overfitting on a small dataset
    learning_rate=0.05,
    subsample=0.8,
    colsample_bytree=0.8,
    scale_pos_weight=20,   # corrects for 20:1 class imbalance
    eval_metric="auc",
    random_state=42,
)


# ===========================================================================
# STEP A — Stratified K-Fold cross-validation
# ===========================================================================

def cross_validate(X: pd.DataFrame, y: pd.Series, n_splits: int = 4) -> list[float]:
    """
    Evaluate model stability with Stratified K-Fold cross-validation.

    Stratified splitting is non-negotiable here: with only 4 positive cases,
    a random split could place all positives in training and leave the
    test set with zero positive examples, making AUC-ROC undefined.
    Stratification guarantees exactly 1 positive case per test fold.

    Returns a list of per-fold AUC-ROC scores.
    """
    skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
    fold_scores = []

    print(f"\n[CV]  Stratified {n_splits}-Fold cross-validation")
    print(f"      Positive cases: {y.sum()}  |  Negatives: {(y==0).sum()}  |  Total: {len(y)}\n")

    for fold_idx, (train_idx, test_idx) in enumerate(skf.split(X, y), start=1):
        X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
        y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]

        model = xgb.XGBClassifier(**XGB_PARAMS)
        model.fit(X_train, y_train, verbose=False)

        y_prob = model.predict_proba(X_test)[:, 1]

        # roc_auc_score requires at least one positive case in y_test.
        # Stratification ensures this, but guard defensively.
        if y_test.nunique() < 2:
            warnings.warn(f"Fold {fold_idx}: test set has only one class — skipping AUC.")
            continue

        auc = roc_auc_score(y_test, y_prob)
        fold_scores.append(auc)
        pos_in_test = y_test.sum()
        print(f"  Fold {fold_idx}:  AUC-ROC = {auc:.4f}  "
              f"(test size={len(y_test)}, positives={pos_in_test})")

    mean_auc = np.mean(fold_scores)
    std_auc  = np.std(fold_scores)
    print(f"\n  Mean CV AUC-ROC : {mean_auc:.4f}  ±  {std_auc:.4f}")
    return fold_scores


# ===========================================================================
# STEP B — Final model training + SHAP explainability
# ===========================================================================

def train_final_model(X: pd.DataFrame, y: pd.Series) -> xgb.XGBClassifier:
    """Train on 100% of the data for deployment and SHAP analysis."""
    print("\n[Final model]  Fitting on full dataset ...")
    model = xgb.XGBClassifier(**XGB_PARAMS)
    model.fit(X, y, verbose=False)
    print("  Done.")
    return model


def generate_shap_plot(
    model: xgb.XGBClassifier,
    X: pd.DataFrame,
    output_path: str = SHAP_PLOT_PATH,
) -> None:
    """
    Compute SHAP values and save a beeswarm summary plot.

    SHAP (SHapley Additive exPlanations) decomposes each prediction into the
    additive contribution of each feature — a requirement for clinical trust.
    Clinicians and regulators need to understand *why* a patient is flagged as
    high-risk, not just that they are. The summary plot shows both the global
    feature importance ranking and the direction of each feature's effect
    across all patients.
    """
    print(f"\n[SHAP]  Computing TreeExplainer values ...")
    explainer   = shap.TreeExplainer(model)
    shap_values = explainer(X)

    # shap_values is an Explanation object; extract the 2-D array for the
    # positive class. For binary classifiers, shap_values.values is already
    # (n_samples, n_features) representing the positive-class contributions.
    fig, ax = plt.subplots(figsize=(9, 5))
    shap.summary_plot(
        shap_values,
        X,
        plot_type="dot",    # beeswarm: shows distribution, not just mean
        show=False,         # suppress interactive window for server/CI use
        color_bar=True,
    )
    plt.title("SHAP Feature Importance — DKD Risk Model", fontsize=13, pad=12)
    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  SHAP summary plot saved -> {output_path}")


# ===========================================================================
# STEP C — Model persistence
# ===========================================================================

def save_model(model: xgb.XGBClassifier, path: str = MODEL_PATH) -> None:
    """
    Persist the model in XGBoost's native JSON format.

    JSON is preferred over pickle for deployment: it is human-readable,
    version-portable, and can be loaded by the XGBoost C++ runtime directly —
    meaning our Streamlit app can reload it without importing the full
    sklearn wrapper.
    """
    model.save_model(path)
    print(f"\n[Model]  Saved -> {path}")


# ===========================================================================
# Orchestration
# ===========================================================================

def load_data_from_csv(csv_path: str) -> tuple[pd.DataFrame, pd.Series]:
    df = pd.read_csv(csv_path)
    if "DKD_Risk" not in df.columns:
        raise ValueError(f"'DKD_Risk' column not found in {csv_path}. "
                         f"Columns present: {df.columns.tolist()}")
    y = df["DKD_Risk"].astype(int)
    X = df.drop(columns=["DKD_Risk"])
    return X, y


def load_data_from_pipeline() -> tuple[pd.DataFrame, pd.Series]:
    """Import and run the ETL pipeline defined in data_processor.py."""
    try:
        from data_processor import build_dataset
    except ImportError as exc:
        raise ImportError(
            "Could not import data_processor.py. "
            "Ensure it is in the same directory, or pass --csv to point at a "
            "pre-exported CSV file."
        ) from exc
    return build_dataset()


def run(csv_path: str | None = None) -> tuple[xgb.XGBClassifier, list[float]]:
    """
    Full training pipeline.

    Parameters
    ----------
    csv_path : str or None
        Path to a pre-exported CSV (with DKD_Risk column).
        If None, data is loaded directly from the ETL pipeline.

    Returns
    -------
    model      : trained XGBClassifier (fitted on full data)
    fold_aucs  : list of per-fold AUC-ROC scores from cross-validation
    """
    # --- load ---
    if csv_path:
        print(f"[Data]  Loading from CSV: {csv_path}")
        X, y = load_data_from_csv(csv_path)
    else:
        print("[Data]  Running ETL pipeline from data_processor.py ...")
        X, y = load_data_from_pipeline()

    print(f"[Data]  {X.shape[0]} samples, {X.shape[1]} features  "
          f"|  Positive rate: {y.mean():.1%}")

    # --- A: cross-validation ---
    fold_aucs = cross_validate(X, y, n_splits=4)

    # --- B: final model + SHAP ---
    model = train_final_model(X, y)
    generate_shap_plot(model, X)

    # --- C: persist ---
    save_model(model)

    return model, fold_aucs


# ===========================================================================
# CLI entry point
# ===========================================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Train the DKD risk XGBoost classifier."
    )
    parser.add_argument(
        "--csv",
        default=None,
        metavar="PATH",
        help="Path to a pre-exported feature CSV (with DKD_Risk column). "
             "Omit to run the ETL pipeline automatically.",
    )
    args = parser.parse_args()
    run(csv_path=args.csv)
