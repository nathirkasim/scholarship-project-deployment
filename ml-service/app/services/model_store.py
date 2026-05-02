"""
Model store — loads and holds the Isolation Forest model.
XGBoost (need scoring) has been removed. Only anomaly detection remains.
Falls back to a bootstrap Isolation Forest on first run.
"""

import os
import logging
import numpy as np
import joblib
from sklearn.ensemble import IsolationForest

logger = logging.getLogger(__name__)

MODEL_DIR = os.environ.get("MODEL_DIR", "/app/models/saved")

FEATURE_NAMES = [
    "total_annual_income", "income_per_capita", "family_size", "earning_members",
    "dependents", "car_value", "gold_value_inr", "fixed_deposit_amount",
    "electronics_value", "total_asset_value", "land_area_acres", "vehicle_count",
    "house_type_encoded", "has_electricity", "has_piped_water", "has_toilet",
    "has_lpg", "caste_encoded", "is_differently_abled", "has_bpl_card",
    "has_aay_card", "has_mgnrega", "has_ayushman", "has_pm_schemes",
    "loan_outstanding", "hsc_percentage", "ug_aggregate_pct", "active_arrears",
    "is_first_graduate", "study_mode_encoded", "owns_land", "father_status_encoded",
    "mother_status_encoded", "has_chronic_illness", "mother_widow_pension",
    "religion_minority", "enrollment_encoded", "residential_encoded",
    "ration_type_encoded", "loan_to_income_ratio", "ownership_encoded",
]


class ModelStore:
    def __init__(self):
        self._isolation_forest = None

    def model_loaded(self) -> bool:
        return self._isolation_forest is not None

    # Keep legacy method for backwards compat with any existing health checks
    def models_loaded(self) -> bool:
        return self.model_loaded()

    def load_models(self):
        os.makedirs(MODEL_DIR, exist_ok=True)
        if_path = os.path.join(MODEL_DIR, "isolation_forest.joblib")

        if os.path.exists(if_path):
            self._isolation_forest = joblib.load(if_path)
            logger.info("Isolation Forest loaded from disk.")
        else:
            logger.warning("No Isolation Forest found — creating bootstrap model.")
            self._isolation_forest = self._bootstrap_isolation_forest()
            joblib.dump(self._isolation_forest, if_path)

    def _bootstrap_isolation_forest(self) -> IsolationForest:
        """Bootstrap IF with synthetic data mimicking Indian scholarship patterns."""
        rng = np.random.default_rng(42)
        n = 2000

        # Genuine poor students (80%)
        genuine = np.column_stack([
            rng.integers(30000, 250000, n),    # income
            rng.integers(5000, 40000, n),      # per_capita
            rng.integers(3, 8, n),             # family_size
            rng.integers(1, 2, n),             # earning_members
            rng.integers(2, 5, n),             # dependents
            np.zeros(n),                       # car_value
            rng.integers(0, 50000, n),         # gold
            np.zeros(n),                       # FD
            rng.integers(0, 20000, n),         # electronics
            rng.integers(10000, 100000, n),    # assets
            np.zeros(n),                       # land
            rng.integers(0, 1, n),             # vehicles
            rng.integers(1, 3, n),             # house_type (kuccha/semi)
            *[rng.integers(0, 2, n) for _ in range(28)],  # remaining bool/encoded
        ])

        model = IsolationForest(
            n_estimators=200,
            contamination=0.08,
            max_features=0.8,
            random_state=42,
        )
        model.fit(genuine)
        return model

    def predict_anomaly(self, features: list[float]) -> float:
        """Returns anomaly score 0.0 (normal) to 1.0 (anomalous).
        Uses decision_function: positive = inlier, negative = outlier.
        Maps such that inliers → <0.65, outliers → ≥0.65.
        """
        x = np.array(features).reshape(1, -1)
        # decision_function = score_samples - threshold (offset_)
        # positive → inlier (normal), negative → outlier (anomaly)
        decision = float(self._isolation_forest.decision_function(x)[0])
        # Normalize: 0.5 at boundary, >0.65 for anomalies, <0.65 for normal
        normalized = float(np.clip(0.5 - 4.0 * decision, 0.0, 1.0))
        return round(normalized, 4)


model_store = ModelStore()
