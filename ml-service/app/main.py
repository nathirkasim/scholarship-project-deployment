"""
ML Service — FastAPI
Provides anomaly detection (Isolation Forest) only.
XGBoost need scoring has been removed — scoring is now 100% rule-based.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.routes.anomaly import router as anomaly_router
from app.services.model_store import model_store

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load Isolation Forest model on startup."""
    logger.info("Loading Isolation Forest model...")
    model_store.load_models()
    logger.info("ML model ready.")
    yield
    logger.info("Shutting down ML service.")


app = FastAPI(
    title="Scholarship ML Service",
    version="2.0.0",
    description="Isolation Forest anomaly detection (G-08). XGBoost need scoring removed.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4000"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

app.include_router(anomaly_router)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": "isolation_forest",
        "model_loaded": model_store.model_loaded(),
    }
