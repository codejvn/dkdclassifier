from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import xgboost as xgb
import pandas as pd
import io
import numpy as np
import os
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# 1. Initialize the API
app = FastAPI(title="Regen-Recruit DKD Inference API", version="2.0")

# 2. Fix the CORS headache so your React frontend can actually talk to it
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for hackathon speed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Load your trained model (Make sure 'xgb_dkd_model.json' is in the same folder!)
try:
    model = xgb.XGBClassifier()
    model.load_model("xgb_dkd_model.json")
except Exception as e:
    print(f"Warning: Model not loaded. Train the model first! Error: {e}")

# 3b. Configure Gemini for semantic column mapping
try:
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    if not gemini_api_key:
        raise ValueError("GEMINI_API_KEY environment variable not set")
    genai.configure(api_key=gemini_api_key)
    gemini_model = genai.GenerativeModel("gemini-2.5-flash")
except Exception as e:
    print(f"Warning: Gemini not configured. Column mapping will be unavailable. Error: {e}")
    gemini_model = None

# 4. Semantic Column Mapper using Gemini (Index Hack) with Regex Fallback
def identify_glucose_column(columns: list[str]) -> str:
    """
    Identify glucose column using the Index Hack (ask Gemini for column index)
    with regex fallback for robustness.

    Returns the exact column name if found.
    Raises HTTPException if identification fails.
    """
    glucose_col_name = None

    # PRIMARY: Index Hack with Gemini (ask for integer index, not full column name)
    if gemini_model:
        try:
            numbered_cols = "\n".join([f"{i}: {col}" for i, col in enumerate(columns)])
            prompt = f"""Below is a numbered list of columns from a clinical CSV:

{numbered_cols}

Which index corresponds to the continuous glucose monitor (CGM) readings?
Return ONLY the integer index.
If none apply, return 'ERROR'.
No extra text."""

            response = gemini_model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.1,
                    max_output_tokens=10,
                ),
            )
            result = response.text.strip()

            # Try to parse the index
            if result != "ERROR":
                try:
                    glucose_col_idx = int(result)
                    if 0 <= glucose_col_idx < len(columns):
                        glucose_col_name = columns[glucose_col_idx]
                except (ValueError, IndexError):
                    pass

        except Exception as e:
            print(f"Gemini Index Hack failed: {e}. Falling back to regex.")

    # SECONDARY: Regex fallback if Gemini failed (case-insensitive keyword matching)
    if glucose_col_name is None:
        keywords = ['gluc', 'cgm', 'sugar', 'value', 'reading']
        for col in columns:
            col_lower = col.lower()
            if any(keyword in col_lower for keyword in keywords):
                glucose_col_name = col
                break

    # If both methods failed, raise error
    if glucose_col_name is None:
        raise HTTPException(
            status_code=400,
            detail="No valid continuous glucose data column found. "
                   f"Available columns: {columns}. "
                   "Try renaming your glucose column to include 'glucose', 'CGM', 'sugar', 'value', or 'reading'."
        )

    return glucose_col_name


# 5. Define the exact data the React frontend needs to send you
class PatientFeatures(BaseModel):
    mean_glucose: float
    glucose_std: float
    cv_glucose: float
    time_above_range: float
    time_below_range: float
    time_in_range: float
    age: Optional[int] = None
    sex: Optional[str] = None

# 6. Create the Endpoints!
@app.post("/predict")
def predict_dkd_risk(patient: PatientFeatures):
    try:
        # Extract demographics from request (optional fields)
        age = patient.age
        sex = patient.sex

        # Convert the incoming JSON into a format XGBoost understands
        # Only use feature columns, exclude age/sex from model input
        features_dict = {
            "mean_glucose": patient.mean_glucose,
            "glucose_std": patient.glucose_std,
            "cv_glucose": patient.cv_glucose,
            "time_above_range": patient.time_above_range,
            "time_below_range": patient.time_below_range,
            "time_in_range": patient.time_in_range,
        }
        input_df = pd.DataFrame([features_dict])

        # Get the probability of DKD (Class 1)
        risk_probability = model.predict_proba(input_df)[0][1]

        # Convert to a clean percentage for the Y2K dashboard
        risk_score_percent = round(float(risk_probability) * 100, 2)

        # Determine the color flag for the frontend
        if risk_score_percent >= 80.0:
            flag = "RED"
        elif risk_score_percent >= 50.0:
            flag = "YELLOW"
        else:
            flag = "GREEN"

        return {
            "status": "success",
            "message": "Inference complete.",
            "risk_score_percent": risk_score_percent,
            "risk_flag": flag,
            "patient_demographics": {
                "age": age,
                "sex": sex,
            },
            "extracted_features": features_dict,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/upload-and-predict")
async def upload_and_predict(file: UploadFile = File(...)):
    """
    Upload a CSV with glucose readings (column name can be anything) and calculate DKD risk.

    Uses Gemini 2.5 Flash to automatically identify the glucose column via semantic analysis.
    Processes file entirely in memory for HIPAA compliance (no disk I/O).

    Returns a rich, frontend-ready JSON payload with risk prediction, demographics,
    extracted features, and time-series glucose data for graphing.
    """
    try:
        # Read file into ephemeral memory
        contents = await file.read()

        # Parse CSV from bytes without touching disk
        try:
            df = pd.read_csv(io.BytesIO(contents))
        except Exception as parse_error:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to parse CSV: {str(parse_error)}"
            )

        # 1. Clean headers: remove leading/trailing whitespace from column names
        df.columns = df.columns.str.strip()

        # 2. Extract demographics (age and sex/gender) — case-insensitive, take first value
        age = None
        sex = None

        age_cols = [c for c in df.columns if c.lower() == "age"]
        if age_cols:
            try:
                age = int(df[age_cols[0]].iloc[0])
            except (ValueError, TypeError, IndexError):
                age = None

        sex_cols = [c for c in df.columns if c.lower() in ["sex", "gender"]]
        if sex_cols:
            try:
                sex = str(df[sex_cols[0]].iloc[0])
            except (ValueError, TypeError, IndexError):
                sex = None

        # Use Index Hack + regex fallback to identify the glucose column
        column_names = df.columns.tolist()
        glucose_col_name = identify_glucose_column(column_names)

        # Rename the identified glucose column to our standard name
        df = df.rename(columns={glucose_col_name: "glucose_value"})

        # Extract and clean glucose readings
        glucose = df["glucose_value"].dropna().astype(float)

        if len(glucose) < 5:
            raise HTTPException(
                status_code=400,
                detail="Minimum 5 valid glucose readings required"
            )

        # Calculate the 6 glycemic variability features (as fractions, matching training data)
        mean_glucose = float(glucose.mean())
        glucose_std = float(glucose.std(ddof=1))

        # Safely handle CV division by zero
        cv_glucose = (glucose_std / mean_glucose) if mean_glucose > 1e-6 else 0.0

        n = len(glucose)
        time_above_range = float((glucose > 180).sum() / n)
        time_below_range = float((glucose < 70).sum() / n)
        time_in_range = float(((glucose >= 70) & (glucose <= 180)).sum() / n)

        # Build feature array in correct order (matches model training)
        features = {
            "mean_glucose": round(mean_glucose, 2),
            "glucose_std": round(glucose_std, 2),
            "cv_glucose": round(cv_glucose, 4),
            "time_above_range": round(time_above_range, 4),
            "time_below_range": round(time_below_range, 4),
            "time_in_range": round(time_in_range, 4),
        }

        feature_array = pd.DataFrame([{
            "mean_glucose": features["mean_glucose"],
            "glucose_std": features["glucose_std"],
            "cv_glucose": features["cv_glucose"],
            "time_above_range": features["time_above_range"],
            "time_below_range": features["time_below_range"],
            "time_in_range": features["time_in_range"],
        }])

        # Inference
        risk_probability = model.predict_proba(feature_array)[0][1]
        risk_score_percent = round(float(risk_probability) * 100, 2)

        # Risk stratification
        # The Adjusted Clinical Thresholds
        if risk_score_percent >= 16.0:
            risk_flag = "RED"
        elif risk_score_percent >= 5.0:
            risk_flag = "YELLOW"
        else:
            risk_flag = "GREEN"

        # 3. Create graph-ready time-series data: [{"time": 0, "value": 110}, ...]
        glucose_graph_data = (
            df[['glucose_value']]
            .dropna()
            .reset_index(drop=True)
            .reset_index()
            .rename(columns={'index': 'time', 'glucose_value': 'value'})
            .to_dict(orient='records')
        )

        # 4. Serialization safety: convert NumPy types to standard Python types
        glucose_graph_data = [
            {"time": int(item["time"]), "value": float(item["value"])}
            for item in glucose_graph_data
        ]

        return {
            "status": "success",
            "message": "Inference complete.",
            "risk_score_percent": risk_score_percent,
            "risk_flag": risk_flag,
            "patient_demographics": {
                "age": age,
                "sex": sex,
            },
            "extracted_features": features,
            "glucose_graph_data": glucose_graph_data,
        }

    except HTTPException:
        raise  # Re-raise HTTPExceptions as-is
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )