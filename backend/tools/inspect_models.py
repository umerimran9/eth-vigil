import joblib
from pathlib import Path
import torch

base_dir = Path("CSVs")

models = {
    "xgb": base_dir / "model_xgb_caseC.pkl",
    "lgbm": base_dir / "model_lgbm_caseC.pkl",
    "rf": base_dir / "model_rf_caseC.pkl",
    "prod": base_dir / "production_model" / "model.pkl",
}

for name, path in models.items():
    if path.exists():
        m = joblib.load(path)
        n_feats = getattr(m, "n_features_in_", getattr(m, "n_features_", "unknown"))
        print(f"{name}: n_features = {n_feats}")

tr_path = base_dir / "transformer_ckpt" / "epoch10.pt"
if tr_path.exists():
    t_obj = torch.load(tr_path, map_location="cpu")
    print(f"transformer: type = {type(t_obj)}")

tab_path = base_dir / "tabnet_ckpt_epoch0.zip"
if tab_path.exists():
    print(f"tabnet artifact exists at {tab_path}")
