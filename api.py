from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import xgboost as xgb
import pandas as pd

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

# 4. Define the exact data the React frontend needs to send you
class PatientFeatures(BaseModel):
    mean_glucose: float
    glucose_std: float
    cv_glucose: float
    time_above_range: float
    time_below_range: float
    time_in_range: float

# 5. Create the Endpoint!
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