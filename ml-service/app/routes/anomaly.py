from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.model_store import model_store, FEATURE_NAMES

router = APIRouter()


class AnomalyRequest(BaseModel):
    features: dict[str, float]


class AnomalyResponse(BaseModel):
    anomaly_score: float
    is_anomaly: bool
    threshold: float = 0.65


@router.post("/anomaly", response_model=AnomalyResponse)
def detect_anomaly(request: AnomalyRequest):
    if not model_store.models_loaded():
        raise HTTPException(status_code=503, detail="Models not loaded")

    # Build ordered feature vector
    feature_vector = [request.features.get(f, 0.0) for f in FEATURE_NAMES]
    score = model_store.predict_anomaly(feature_vector)

    return AnomalyResponse(
        anomaly_score=score,
        is_anomaly=score >= 0.65,
    )
