from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
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

# 4. Semantic Column Mapper using Gemini
def identify_glucose_column(columns: list[str]) -> str:
    """
    Use Gemini 1.5 Flash to identify which column contains glucose data.

    Returns the exact column name if found, or "ERROR" if no column matches.
    Raises HTTPException on API failure or timeout.
    """
    if not gemini_model:
        raise HTTPException(
            status_code=503,
            detail="Gemini API not configured. Manual column specification required."
        )

    columns_str = ", ".join(columns)
    prompt = f"""You are a clinical CSV analyzer. Your ONLY task: return the exact column name containing glucose data.

Column names:
{columns_str}

RULES:
1. Return EXACTLY one of the column names above if it contains glucose/CGM data
2. Return exactly: ERROR (if no glucose column)
3. No extra text, quotes, markdown, or explanations
4. Preserve ALL characters including parentheses, spaces, units - return EXACTLY as shown
5. Single line only"""

    try:
        response = gemini_model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0,
                max_output_tokens=200,
                top_p=1,
                top_k=1,
            ),
        )
        result = response.text.strip()
        return result
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Gemini API error: {str(e)}"
        )


# 5. Define the exact data the React frontend needs to send you
class PatientFeatures(BaseModel):
    mean_glucose: float
    glucose_std: float
    cv_glucose: float
    time_above_range: float
    time_below_range: float
    time_in_range: float

# 6. Create the Endpoints!
@app.post("/predict")
def predict_dkd_risk(patient: PatientFeatures):
    try:
        # Convert the incoming JSON into a format XGBoost understands
        input_df = pd.DataFrame([patient.dict()])
        
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
            "risk_score_percent": risk_score_percent,
            "risk_flag": flag,
            "message": "Inference complete."
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/upload-and-predict")
async def upload_and_predict(file: UploadFile = File(...)):
    """
    Upload a CSV with glucose readings (column name can be anything) and calculate DKD risk.

    Uses Gemini 1.5 Flash to automatically identify the glucose column via semantic analysis.
    Processes file entirely in memory for HIPAA compliance (no disk I/O).
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

        # Use Gemini to identify the glucose column
        column_names = df.columns.tolist()
        identified_column = identify_glucose_column(column_names)

        # Check if Gemini found a valid column
        if identified_column.upper() == "ERROR":
            raise HTTPException(
                status_code=400,
                detail="No valid continuous glucose data column found in the provided file."
            )

        # Verify the identified column actually exists
        if identified_column not in df.columns:
            raise HTTPException(
                status_code=400,
                detail=f"Gemini identified '{identified_column}' but column not found. "
                       f"Available columns: {column_names}"
            )

        # Rename the identified glucose column to our standard name
        df = df.rename(columns={identified_column: "glucose_value"})

        # Extract and clean glucose readings
        glucose = df["glucose_value"].dropna().astype(float)

        if len(glucose) < 5:
            raise HTTPException(
                status_code=400,
                detail="Minimum 5 valid glucose readings required"
            )

        # Calculate the 6 glycemic variability features
        mean_glucose = float(glucose.mean())
        glucose_std = float(glucose.std(ddof=1))

        # Safely handle CV division by zero
        cv_glucose = (glucose_std / mean_glucose) if mean_glucose > 1e-6 else 0.0

        n = len(glucose)
        time_above_range = 100.0 * (glucose > 180).sum() / n
        time_below_range = 100.0 * (glucose < 70).sum() / n
        time_in_range = 100.0 * ((glucose >= 70) & (glucose <= 180)).sum() / n

        # Build feature array in correct order (matches model training)
        features = {
            "mean_glucose": round(mean_glucose, 2),
            "glucose_std": round(glucose_std, 2),
            "cv_glucose": round(cv_glucose, 4),
            "time_above_range": round(time_above_range, 2),
            "time_below_range": round(time_below_range, 2),
            "time_in_range": round(time_in_range, 2),
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
        if risk_score_percent >= 80.0:
            risk_flag = "RED"
        elif risk_score_percent >= 50.0:
            risk_flag = "YELLOW"
        else:
            risk_flag = "GREEN"

        return {
            "status": "success",
            "message": f"DKD risk assessment complete. Identified column: '{identified_column}'. Processed {n} glucose readings.",
            "identified_glucose_column": identified_column,
            "extracted_features": features,
            "risk_score_percent": risk_score_percent,
            "risk_flag": risk_flag,
        }

    except HTTPException:
        raise  # Re-raise HTTPExceptions as-is
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )