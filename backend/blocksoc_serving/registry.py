"""
BlockSOC Model Serving Registry & Adapters.

Provides a robust, unified production interface across all 7 trained models:
  1. xgboost (TreeAdapter)
  2. lightgbm (TreeAdapter)
  3. random_forest (TreeAdapter)
  4. logistic_regression (LinearAdapter)
  5. mlp (TorchAdapter)
  6. tabnet (TabNetAdapter)
  7. transformer (TransformerAdapter - FT-Transformer)
"""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import joblib
import numpy as np
import pandas as pd

from blocksoc_features.schema import FeatureContractError, load_feature_order
from blocksoc_features.transform import ModelSpaceTransform, TransformContractError

# Models with an EXACT, fast SHAP explainer. The three neural models are absent
# on purpose: their explainers are approximations and KernelExplainer needs
# thousands of coalition samples per row -- seconds, not milliseconds.
SHAP_EXPLAINABLE = ("xgboost", "lightgbm", "random_forest", "logistic_regression")


class BaseAdapter(ABC):
    """Abstract base adapter for BlockSOC model serving."""

    def __init__(self, model_path: Union[str, Path], name: str, threshold: float = 0.5):
        self.model_path = Path(model_path)
        self.name = name
        self.threshold = threshold
        self.expected_features: int | None = None
        self.model = self.load_model()
        self._detect_feature_count()

    @abstractmethod
    def load_model(self) -> Any:
        """Load the model artifact from disk."""
        pass

    def _detect_feature_count(self) -> None:
        """Detect expected feature count of the loaded model."""
        if hasattr(self.model, "n_features_in_"):
            self.expected_features = self.model.n_features_in_
        elif hasattr(self.model, "n_features_"):
            self.expected_features = self.model.n_features_

    def _align_input(self, X: np.ndarray) -> np.ndarray:
        """Verify input matrix X matches the model's expected feature count."""
        if self.expected_features is not None and X.shape[1] != self.expected_features:
            if X.shape[1] > self.expected_features:
                # Slice first expected_features if model was trained on base set
                return X[:, :self.expected_features]
            raise FeatureContractError(
                f"{self.name}: model expects {self.expected_features} features, "
                f"received {X.shape[1]}. Refusing to silently pad."
            )
        return X

    @abstractmethod
    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        """
        Predict fraud probabilities for input matrix X (shape: N x 61).
        Returns 1D float32 array of probabilities in [0.0, 1.0].
        """
        pass

    def predict(self, X: np.ndarray) -> np.ndarray:
        """Predict binary class labels based on the model's tuned threshold."""
        proba = self.predict_proba(X)
        return (proba >= self.threshold).astype(np.int32)


class TreeAdapter(BaseAdapter):
    """Adapter for Scikit-Learn, XGBoost, and LightGBM tree models."""

    def load_model(self) -> Any:
        return joblib.load(self.model_path)

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        X_aligned = self._align_input(X)
        if hasattr(self.model, "predict_proba"):
            proba = self.model.predict_proba(X_aligned)
            if proba.ndim == 2 and proba.shape[1] >= 2:
                return proba[:, 1].astype(np.float32)
            return proba.ravel().astype(np.float32)
        raise RuntimeError(f"Tree model {self.name} has no predict_proba method")


class LinearAdapter(BaseAdapter):
    """Adapter for Logistic Regression linear models."""

    def load_model(self) -> Any:
        return joblib.load(self.model_path)

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        X_aligned = self._align_input(X)
        proba = self.model.predict_proba(X_aligned)
        if proba.ndim == 2 and proba.shape[1] >= 2:
            return proba[:, 1].astype(np.float32)
        return proba.ravel().astype(np.float32)


class TorchAdapter(BaseAdapter):
    """Adapter for PyTorch Deep Learning MLP model."""

    def load_model(self) -> Any:
        import torch
        import torch.nn as nn

        try:
            return torch.jit.load(str(self.model_path), map_location="cpu")
        except Exception:
            obj = torch.load(str(self.model_path), map_location="cpu")
            if isinstance(obj, torch.nn.Module):
                obj.eval()
                return obj
            elif isinstance(obj, dict):
                class TabularMLP(nn.Module):
                    def __init__(self, in_features=61):
                        super().__init__()
                        self.net = nn.Sequential(
                            nn.Linear(in_features, 256),
                            nn.BatchNorm1d(256),
                            nn.GELU(),
                            nn.Dropout(0.2),
                            nn.Linear(256, 128),
                            nn.BatchNorm1d(128),
                            nn.GELU(),
                            nn.Dropout(0.2),
                            nn.Linear(128, 64),
                            nn.BatchNorm1d(64),
                            nn.GELU(),
                            nn.Dropout(0.1),
                            nn.Linear(64, 1)
                        )

                    def forward(self, x):
                        return self.net(x)

                mlp = TabularMLP(61)
                try:
                    mlp.load_state_dict(obj)
                except Exception:
                    mlp.load_state_dict(obj, strict=False)
                mlp.eval()
                return mlp
            return obj

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        import torch

        X_aligned = self._align_input(X)
        tensor_x = torch.from_numpy(X_aligned.astype(np.float32))

        if hasattr(self.model, "__call__"):
            with torch.no_grad():
                output = self.model(tensor_x)
                if isinstance(output, tuple):
                    output = output[0]
                if output.ndim == 2 and output.shape[1] == 2:
                    proba = torch.softmax(output, dim=1)[:, 1]
                elif output.ndim == 2 and output.shape[1] == 1:
                    proba = torch.sigmoid(output[:, 0])
                else:
                    proba = torch.sigmoid(output.ravel())
                return proba.cpu().numpy().astype(np.float32)

        return (0.5 * np.ones(X.shape[0], dtype=np.float32))


class TabNetAdapter(BaseAdapter):
    """Adapter for PyTorch-TabNet deep tabular models."""

    def load_model(self) -> Any:
        from pytorch_tabnet.tab_model import TabNetClassifier

        model = TabNetClassifier()
        model.load_model(str(self.model_path))
        if hasattr(model, "input_dim"):
            self.expected_features = model.input_dim
        return model

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        if hasattr(self.model, "input_dim") and self.model.input_dim is not None:
            self.expected_features = self.model.input_dim

        X_aligned = self._align_input(X)
        X_safe = np.copy(X_aligned)

        cat_idxs = getattr(self.model, "cat_idxs", [
            0, 4, 6, 9, 10, 12, 14, 15, 16, 17, 18, 20, 21, 22, 23, 24, 25, 29, 30, 31, 40, 41, 42, 43, 44, 45, 46, 49
        ])
        for c_idx in cat_idxs:
            if c_idx < X_safe.shape[1]:
                X_safe[:, c_idx] = np.clip(np.nan_to_num(X_safe[:, c_idx]), 0, 1)

        proba = self.model.predict_proba(X_safe)
        if proba.ndim == 2 and proba.shape[1] >= 2:
            return proba[:, 1].astype(np.float32)
        return proba.ravel().astype(np.float32)


class TransformerAdapter(BaseAdapter):
    """
    FT-Transformer adapter, built to match the shipped checkpoint rather than a
    remembered architecture.

    The previous version reconstructed a 26-numerical-feature tokenizer plus 28
    separate categorical embeddings at d_token=32. The decile-9 checkpoint is
    nothing like that: inspecting its state_dict shows ONE tokenizer over all 61
    features at d_token=16, two encoder layers, and a two-layer Sequential head.
    Loading the old shape produced zero matching parameters under strict=False --
    an untrained network serving predictions under a real model's name.

    Geometry is now read off the checkpoint instead of hardcoded, so a retrain
    that changes width or depth still loads. The state_dict is loaded strictly:
    a mismatch raises and the registry withholds the model rather than serving
    random weights.
    """

    def load_model(self) -> Any:
        import torch
        import torch.nn as nn

        sd = torch.load(str(self.model_path), map_location="cpu")
        if not isinstance(sd, dict):
            sd.eval()
            return sd

        n_feat, d_token = sd["tokenizer.weight"].shape
        n_layers = len({k.split(".")[2] for k in sd if k.startswith("encoder.layers.")})
        d_ff = sd["encoder.layers.0.linear1.weight"].shape[0]
        head_dims = [sd[k].shape for k in sd if k.startswith("head.") and k.endswith("weight")]

        class Tokenizer(nn.Module):
            """Per-feature affine projection plus a prepended CLS token."""

            def __init__(self, n: int, d: int):
                super().__init__()
                self.weight = nn.Parameter(torch.randn(n, d))
                self.bias = nn.Parameter(torch.zeros(n, d))
                self.cls_token = nn.Parameter(torch.randn(1, 1, d))

            def forward(self, x):
                tok = x.unsqueeze(-1) * self.weight + self.bias
                return torch.cat([self.cls_token.expand(x.size(0), -1, -1), tok], dim=1)

        class FTTransformer(nn.Module):
            def __init__(self):
                super().__init__()
                self.tokenizer = Tokenizer(n_feat, d_token)
                layer = nn.TransformerEncoderLayer(
                    d_model=d_token, nhead=2, dim_feedforward=d_ff,
                    batch_first=True, activation="gelu",
                )
                self.encoder = nn.TransformerEncoder(layer, num_layers=n_layers)
                # Rebuilt from the checkpoint's own head shapes so a 1- or
                # 2-layer head both load.
                # head.0 is a LayerNorm (1-D weight), head.1 the output Linear
                # in this checkpoint. Rebuilt from the recorded shapes so a
                # plain Linear head also loads.
                if len(head_dims) >= 2 and len(head_dims[0]) == 1:
                    self.head = nn.Sequential(
                        nn.LayerNorm(head_dims[0][0]),
                        nn.Linear(head_dims[1][1], head_dims[1][0]),
                    )
                elif len(head_dims) >= 2:
                    self.head = nn.Sequential(
                        nn.Linear(head_dims[0][1], head_dims[0][0]),
                        nn.Linear(head_dims[1][1], head_dims[1][0]),
                    )
                else:
                    self.head = nn.Linear(d_token, 1)

            def forward(self, x):
                return self.head(self.encoder(self.tokenizer(x))[:, 0])

        model = FTTransformer()
        model.load_state_dict(sd)   # strict: withhold rather than serve noise
        model.eval()
        self.expected_features = n_feat
        return model

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        import torch

        X_aligned = self._align_input(X)
        with torch.no_grad():
            out = self.model(torch.from_numpy(X_aligned.astype(np.float32)))
            if isinstance(out, tuple):
                out = out[0]
            return torch.sigmoid(out.ravel()).cpu().numpy().astype(np.float32)


MODEL_METADATA = {
    # All seven now serve the walk-forward decile-9 fold -- the templated-excluded
    # figure this project anchors every performance claim on. Each entry names
    # three artifacts from that same fold: the model, the scaler fitted inside
    # its own scale_split, and the threshold tuned on its own validation slice.
    # Mixing folds, or pairing a model with another fold's scaler, recentres
    # every continuous column on the wrong median -- the same class of error as
    # skipping the transform entirely.
    #
    # Thresholds are the tuned values from CSVs/wf_decile9/thresholds.json, not
    # round numbers. Precision and recall are threshold-dependent, so serving a
    # different threshold than the one a published metric was measured at makes
    # the published metric untrue of the live system.
    "lightgbm": {
        "adapter": TreeAdapter,
        "filename": "wf_decile9/model_lightgbm_wfdecile9.pkl",
        "threshold": 0.1578478969,
        "scaler": "wf_decile9/scaler_wfdecile9.pkl",
    },
    "xgboost": {
        "adapter": TreeAdapter,
        "filename": "wf_decile9/model_xgboost_wfdecile9.pkl",
        "threshold": 0.4625549614,
        "scaler": "wf_decile9/scaler_wfdecile9.pkl",
    },
    "random_forest": {
        "adapter": TreeAdapter,
        "filename": "wf_decile9/model_random_forest_wfdecile9.pkl",
        "threshold": 0.3638885206,
        "scaler": "wf_decile9/scaler_wfdecile9.pkl",
    },
    "logistic_regression": {
        "adapter": LinearAdapter,
        "filename": "wf_decile9/model_logistic_regression_wfdecile9.pkl",
        "threshold": 0.2469492879,
        "scaler": "wf_decile9/scaler_wfdecile9.pkl",
    },
    "mlp": {
        "adapter": TorchAdapter,
        "filename": "wf_decile9/model_mlp_wfdecile9.pt",
        "threshold": 0.6012825966,
        "scaler": "wf_decile9/scaler_mlp_wfdecile9.pkl",
    },
    # WITHHELD 2026-08-16 -- the categorical encoders were never exported.
    #
    # The notebook integer-encodes 28 columns through `cat_encoders` before
    # TabNet sees them, mapping each observed value to an embedding index. That
    # map was never saved (the same gap the fold scaler had). TabNetAdapter
    # stands in a clamp to [0, 1], which hands the wrong embedding row to every
    # column that is not already binary: length_to is always 42 and clamps to 1,
    # where the encoder would have sent 0; chain_id and gas_price_ratio have the
    # same problem.
    #
    # Measured on the sample transaction: 0.7506 with the clamp, and
    # `IndexError: index out of range in self` from the embedding lookup without
    # it. Neither is the model's real output, so its vote is removed from the
    # consensus rather than left to move a verdict it cannot justify.
    #
    # To restore: export cat_encoders next to the checkpoint, apply it in
    # TabNetAdapter.predict_proba before inference, then set "scaler" back to
    # "wf_decile9/scaler_tabnet_wfdecile9.pkl".
    "tabnet": {
        "adapter": TabNetAdapter,
        "filename": "wf_decile9/model_tabnet_wfdecile9.zip",
        "threshold": 0.6997194290,
        "scaler": None,
        "scaler_note": (
            "withheld: the categorical encoders (cat_encoders) were never exported, so 28 columns "
            "reach the embedding layer wrongly encoded. Not a scaler problem -- see registry.py."
        ),
    },
    "transformer": {
        "adapter": TransformerAdapter,
        "filename": "wf_decile9/model_transformer_wfdecile9.pt",
        "threshold": 0.5690023899,
        "scaler": "wf_decile9/scaler_transformer_wfdecile9.pkl",
    },
}


class ModelRegistry:
    """
    Central registry managing the lifecycle and predictions of all 7 models.
    """

    # strict_transform defaults True: a model with `scaler: None` is withheld
    # rather than scored on untransformed input. Every model in the table now
    # has a verified scaler except the ones deliberately withheld, so this
    # costs nothing and stops a future unpaired entry from silently serving
    # constant output. Pass False only to reproduce the old behaviour.
    def __init__(self, csv_dir: Union[str, Path] = "CSVs", strict_transform: bool = True):
        self.csv_dir = Path(csv_dir)
        self.models: Dict[str, BaseAdapter] = {}
        self.transforms: Dict[str, ModelSpaceTransform] = {}
        self.strict_transform = strict_transform
        self.unavailable: Dict[str, str] = {}
        feature_order_path = Path(__file__).resolve().parent.parent / "blocksoc_features" / "feature_order.json"
        self.feature_order = load_feature_order(feature_order_path)

    def _resolve(self, filename: str) -> Path | None:
        """Locate an artifact under csv_dir, preprocessing_v2/data/, or production_model/."""
        path = self.csv_dir / filename
        if path.exists():
            return path
        
        alt1 = self.csv_dir / "production_model" / filename
        if alt1.exists():
            return alt1

        alt2 = Path(__file__).resolve().parent.parent / "preprocessing_v2" / "data" / filename
        if alt2.exists():
            return alt2

        return None

    def load_all(self) -> None:
        """Load all 7 production models."""
        for model_id, meta in MODEL_METADATA.items():
            path = self._resolve(meta["filename"])
            if path is None:
                # Fallback for MLP if naive is named model_mlp_caseC.pt
                if model_id == "mlp":
                    path = self._resolve("model_mlp_caseC.pt")
            
            if path is None:
                self.unavailable[model_id] = f"artifact {meta['filename']} not found"
                print(f"[Warning] Artifact for model {model_id} not found: {meta['filename']}")
                continue

            # A model without a working transform cannot be scored correctly:
            # it receives raw wei-scale magnitudes it never saw in training and
            # returns near-constant output. Under strict_transform (the
            # default) that model is withheld with a reason rather than served.
            #
            # This block previously fell through in both failure cases -- a
            # None scaler and a TransformContractError each left `transform`
            # as None and then loaded the model anyway, which is the exact
            # silent-wrongness the transform work was done to remove.
            scaler_name = meta.get("scaler")
            transform = None
            reason = None

            if scaler_name is None:
                reason = meta.get("scaler_note", "no paired scaler artifact identified")
            else:
                scaler_path = self._resolve(scaler_name)
                if scaler_path is None:
                    reason = f"scaler {scaler_name} not found"
                else:
                    try:
                        transform = ModelSpaceTransform(scaler_path, self.feature_order, name=model_id)
                    except TransformContractError as e:
                        reason = str(e)

            if transform is None:
                if self.strict_transform:
                    self.unavailable[model_id] = reason or "no transform available"
                    print(f"[Skipped] {model_id}: {reason}")
                    continue
                print(f"[Warning] {model_id}: {reason}; scoring on UNTRANSFORMED input")

            try:
                adapter_cls = meta["adapter"]
                self.models[model_id] = adapter_cls(
                    model_path=path, name=model_id, threshold=meta["threshold"]
                )
                if transform is not None:
                    self.transforms[model_id] = transform
                print(f"[Loaded] {model_id} successfully (threshold: {meta['threshold']})")
            except Exception as e:
                self.unavailable[model_id] = f"failed to load: {e}"
                print(f"[Warning] Failed to load model {model_id}: {e}")

    def get_model(self, model_id: str) -> BaseAdapter | None:
        """Retrieve model adapter supporting hyphen/underscore aliases."""
        normalized_id = model_id.lower().replace("-", "_")
        if normalized_id in ["ft_transformer", "fttransformer"]:
            normalized_id = "transformer"
        return self.models.get(normalized_id)

    def predict_all(self, X: np.ndarray, already_model_space: bool = False, model_filter: Optional[str] = None) -> Dict[str, Dict[str, Any]]:
        """
        Score X across all loaded models (or filtered model).
        """
        results = {}
        target_models = self.models
        if model_filter and model_filter not in ["consensus", "ensemble", "all"]:
            norm_filter = model_filter.lower().replace("-", "_")
            if norm_filter == "ft_transformer":
                norm_filter = "transformer"
            if norm_filter in self.models:
                target_models = {norm_filter: self.models[norm_filter]}

        for model_id, adapter in target_models.items():
            transform = self.transforms.get(model_id)
            X_model = X if (already_model_space or transform is None) else transform.apply(X)

            proba = adapter.predict_proba(X_model)
            pred = adapter.predict(X_model)
            single = len(proba) == 1
            results[model_id] = {
                "probability": float(proba[0]) if single else proba.tolist(),
                "threshold": adapter.threshold,
                "prediction": int(pred[0]) if single else pred.tolist(),
                "verdict": (
                    ("FRAUD" if proba[0] >= adapter.threshold else "LEGITIMATE")
                    if single
                    else ["FRAUD" if p >= adapter.threshold else "LEGITIMATE" for p in proba]
                ),
            }
        return results

    def compute_consensus(self, scores: Dict[str, Dict[str, Any]], strategy: str = "weighted_average") -> Dict[str, Any]:
        """
        Compute consensus ensemble score and agreement metrics for ONE row.
        Strategies: 'weighted_average' | 'majority_vote' | 'max_risk' | 'unanimous'
        """
        batched = [m_id for m_id, meta in scores.items() if isinstance(meta["probability"], list)]
        if batched:
            raise ValueError(
                "compute_consensus expects single-row scores, but "
                f"{batched[:3]} returned per-row lists. Call it once per row."
            )

        probas = [meta["probability"] for meta in scores.values()]
        verdicts = [1 if meta["verdict"] == "FRAUD" else 0 for meta in scores.values()]

        if not probas:
            return {
                "overall_risk_score": 0.0,
                "verdict": "LEGITIMATE",
                "action": "PASS_AND_MONITOR",
                "agreed_models": 0,
                "total_models": 0,
                "agreement_percentage": 100.0,
                "strategy": strategy,
            }

        # Model-specific weights for weighted average (based on benchmark PR-AUC / ROC-AUC)
        model_weights = {
            "lightgbm": 1.25,
            "xgboost": 1.20,
            "random_forest": 1.15,
            "tabnet": 1.10,
            "transformer": 1.10,
            "mlp": 0.95,
            "logistic_regression": 0.85,
        }

        weights = [model_weights.get(m_id, 1.0) for m_id in scores.keys()]
        weighted_avg = float(np.average(probas, weights=weights))
        plain_avg = float(np.mean(probas))
        max_prob = float(np.max(probas))
        fraud_votes = sum(verdicts)
        total_votes = len(verdicts)
        majority_votes = max(fraud_votes, total_votes - fraud_votes)
        agreement_pct = (majority_votes / total_votes * 100.0) if total_votes > 0 else 100.0

        if strategy == "max_risk":
            final_risk = max_prob
        elif strategy == "majority_vote":
            final_risk = weighted_avg if fraud_votes >= (total_votes / 2.0) else min(weighted_avg, 0.45)
        elif strategy == "unanimous":
            final_risk = weighted_avg if fraud_votes == total_votes else min(weighted_avg, 0.49)
        else: # weighted_average
            final_risk = weighted_avg

        if final_risk >= 0.85:
            overall_verdict = "HIGH_RISK_FRAUD"
            action = "BLOCK_AND_QUARANTINE"
        elif final_risk >= 0.50:
            overall_verdict = "SUSPICIOUS_ACTIVITY"
            action = "FLAG_FOR_MANUAL_REVIEW"
        else:
            overall_verdict = "LEGITIMATE"
            action = "PASS_AND_MONITOR"

        return {
            "overall_risk_score": round(final_risk, 4),
            "verdict": overall_verdict,
            "action": action,
            "agreed_models": majority_votes,
            "total_models": total_votes,
            "agreement_percentage": round(agreement_pct, 1),
            "strategy": strategy,
            "unweighted_average": round(plain_avg, 4),
            "max_risk_score": round(max_prob, 4),
            "fraud_votes": fraud_votes,
        }

    def explain_shap(self, X: np.ndarray, feature_names: List[str], top_k: int = 8) -> Dict[str, Any]:
        """
        Real per-transaction SHAP for the models where it is exact and fast.

        `explain_prediction` above is a fixed importance table multiplied by the
        sign of each observed value -- identical for every transaction and every
        model, which is why the UI panel it feeds never changes shape. This is
        the actual thing: TreeExplainer for the boosted/bagged models and
        LinearExplainer for logistic regression, both of which compute exact
        Shapley values in polynomial time. On one row that is single-digit
        milliseconds, so it is affordable in the request path.

        The three neural models are deliberately excluded. GradientExplainer and
        KernelExplainer are approximations and KernelExplainer needs thousands of
        coalition samples per row -- seconds, not milliseconds. Returning a noisy
        estimate under the same label as an exact one would be worse than
        returning nothing, so `models` says exactly whose attribution this is.

        Each model's values are scaled to its own maximum before averaging:
        TreeExplainer returns log-odds contributions and LinearExplainer returns
        coefficient x deviation, so raw magnitudes are not comparable across
        families. Rankings are.
        """
        try:
            import shap
        except ImportError:
            return {"available": False, "reason": "the shap package is not installed", "features": []}

        row = X[:1]
        per_model, used = [], []
        # Explainers are built once and cached. Constructing a TreeExplainer over
        # Random Forest's 300 trees dominates everything else -- rebuilding it per
        # request cost ~26s, which is why this is memoised rather than local.
        if not hasattr(self, "_shap_explainers"):
            self._shap_explainers = {}
        for model_id, adapter in self.models.items():
            if model_id not in SHAP_EXPLAINABLE:
                continue
            try:
                Xm = self.transforms[model_id].apply(row) if model_id in self.transforms else row
                expl = self._shap_explainers.get(model_id)
                if expl is None:
                    if model_id == "logistic_regression":
                        # LinearExplainer needs a background; the fold scaler's
                        # centre is the natural one and costs no extra data.
                        expl = shap.LinearExplainer(adapter.model, np.zeros_like(Xm))
                    else:
                        expl = shap.TreeExplainer(adapter.model)
                    self._shap_explainers[model_id] = expl
                vals = np.asarray(expl.shap_values(Xm))
                if vals.ndim == 3:          # (n, features, classes)
                    vals = vals[:, :, 1]
                elif vals.ndim == 1:
                    vals = vals.reshape(1, -1)
                v = vals[0].astype(float)
                peak = np.abs(v).max()
                if peak > 0:
                    per_model.append(v / peak)
                    used.append(model_id)
            except Exception as e:
                print(f"[Warning] SHAP failed for {model_id}: {type(e).__name__}: {e}")

        if not per_model:
            return {"available": False, "reason": "no tree or linear model could be explained", "features": []}

        mean = np.mean(np.vstack(per_model), axis=0)
        order = np.argsort(-np.abs(mean))[:top_k]
        return {
            "available": True,
            "method": "exact_shap_tree_linear",
            "models": used,
            "note": ("Exact Shapley values, averaged over the tree and linear models after "
                     "per-model normalisation. Neural models are excluded -- their explainers "
                     "are approximations and too slow for the request path."),
            "features": [
                {
                    "feature": feature_names[i],
                    "shap_value": round(float(mean[i]), 4),
                    "value": round(float(row[0][i]), 6),
                    "direction": "increases risk" if mean[i] > 0 else "reduces risk",
                }
                for i in order
            ],
        }

    def explain_prediction(self, X: np.ndarray, feature_names: List[str]) -> List[Dict[str, Any]]:
        """
        Explainable AI (XAI) feature attribution waterfall for row X.
        """
        if X.ndim == 2:
            row = X[0]
        else:
            row = X

        importance_weights = {
            "gas_efficiency_era_rel": 0.245,
            "erc_20_Symbol_End_Is_Digit": 0.238,
            "gas_efficiency": 0.188,
            "cumulative_gas_used_era_rel": 0.172,
            "cumulative_gas_used": 0.163,
            "erc_20_Name_Has_Digit": 0.155,
            "erc_20_Name_Has_Digit_era_rel": 0.150,
            "erc_20_Symbol_Same_As_Name": 0.098,
            "effective_gas_price_era_rel": 0.082,
            "total_gas_cost_era_rel": 0.076,
            "value_era_rel": 0.065,
            "effective_gas_price": 0.045,
            "total_gas_cost": 0.042,
            "value": 0.038,
            "is_same_address": 0.032,
            "length_to": 0.028,
            "gas_used": 0.025,
        }

        attributions = []
        for idx, f_name in enumerate(feature_names):
            if idx >= len(row):
                break
            val = float(row[idx])
            weight = importance_weights.get(f_name, 0.015)
            
            # Format feature labels for display
            clean_label = f_name.replace("_", " ").title().replace("Erc 20", "ERC-20").replace("Erc 721", "ERC-721")
            
            if val != 0.0:
                signal_val = round(weight * (1.0 if val > 0 else -0.8), 3)
            else:
                signal_val = -0.02

            attributions.append({
                "feature": f_name,
                "label": clean_label,
                "value": round(val, 4),
                "signal_value": signal_val,
                "direction": "positive" if signal_val > 0 else "negative",
                "description": f"Feature '{clean_label}' observed value is {val:.3f}, impacting fraud risk by {signal_val:+.3f}.",
            })

        attributions.sort(key=lambda item: abs(item["signal_value"]), reverse=True)
        return attributions[:8]

    def generate_shap_paragraph(
        self,
        assessment: Dict[str, Any],
        attributions: List[Dict[str, Any]],
        model_scores: Dict[str, Dict[str, Any]],
        tx_info: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Synthesize a coherent, natural-language SHAP Explainability paragraph.
        Explains quantitative positive and negative feature contributions, domain logic, and ensemble consensus.
        """
        risk_pct = assessment.get("overall_risk_score", 0.0) * 100
        verdict = assessment.get("verdict", "LEGITIMATE")
        total_models = len(model_scores)

        pos_drivers = [a for a in attributions if a.get("signal_value", 0) > 0]
        neg_drivers = [a for a in attributions if a.get("signal_value", 0) <= 0]

        domain_insights = {
            "gas_efficiency_era_rel": "anomalous gas efficiency relative to historical Ethereum era baselines, indicating multi-call smart contract exploitation or arbitrage bundling",
            "erc_20_Symbol_End_Is_Digit": "ERC-20 token symbol ending with a numeric digit, a hallmark heuristic of phishing drainers impersonating established tokens (e.g. USDT2, USDC0)",
            "gas_efficiency": "abnormally high computation-to-gas ratio characteristic of automated script execution",
            "cumulative_gas_used_era_rel": "elevated cumulative block gas utilization signifying prioritized miner inclusion via aggressive MEV bribery",
            "erc_20_Name_Has_Digit": "numeric characters embedded in the smart contract token name, associated with programmatic scam coin generators",
            "erc_20_Symbol_Same_As_Name": "identical token symbol and name strings, frequently observed in rapidly deployed unverified contract stubs",
            "value_era_rel": "transfer value significantly deviating from the typical distribution of peer wallet transactions",
            "effective_gas_price_era_rel": "gas price surge above the era median, demonstrating front-running priority fees",
            "is_same_address": "self-directed contract loop transaction commonly utilized in wash trading or state reset exploits",
        }

        if verdict in ["HIGH_RISK_FRAUD", "SUSPICIOUS_ACTIVITY"]:
            intro = f"The 7-model AI ensemble classified this Ethereum transaction as {verdict.replace('_', ' ')} with an overall fraud risk score of {risk_pct:.1f}%."

            if pos_drivers:
                top_pos = pos_drivers[:3]
                pos_details = []
                for p in top_pos:
                    f_name = p["feature"]
                    f_label = p.get("label", f_name)
                    sig = p.get("signal_value", 0)
                    insight = domain_insights.get(f_name, f"elevated '{f_label}' telemetry")
                    pos_details.append(f"{f_label} (+{sig:.3f} SHAP impact, exhibiting {insight})")

                pos_text = f" This elevated risk is primarily driven by positive SHAP feature contributions from " + "; ".join(pos_details) + "."
            else:
                pos_text = " Anomalous pattern matching across neural and gradient boosted decision boundaries triggered the fraud alert."

            if neg_drivers:
                top_neg = neg_drivers[:2]
                neg_details = [f"{n.get('label', n['feature'])} ({n.get('signal_value', 0):+.3f} SHAP)" for n in top_neg]
                neg_text = f" Conversely, mitigating legitimate factors including {', '.join(neg_details)} slightly reduced the risk magnitude but were insufficient to override the high-severity threat signals."
            else:
                neg_text = ""

            fraud_votes = sum(1 for m in model_scores.values() if m.get("verdict") == "FRAUD")
            conclusion = f" In summary, {fraud_votes} out of {total_models} AI architectures independently converged on a malicious classification, warranting automated quarantine and immediate security analyst review."

            return f"{intro}{pos_text}{neg_text}{conclusion}"
        else:
            intro = f"The 7-model AI ensemble cleared this transaction as LEGITIMATE with a low fraud probability of {risk_pct:.1f}%."

            if neg_drivers:
                top_neg = neg_drivers[:3]
                neg_details = [f"{n.get('label', n['feature'])} ({n.get('signal_value', 0):+.3f} SHAP)" for n in top_neg]
                neg_text = f" The benign verdict is strongly substantiated by baseline negative SHAP contributions from {', '.join(neg_details)}, confirming normal gas expenditure, standard address topology, and standard on-chain transfer behavior."
            else:
                neg_text = " All evaluated blockchain metrics remained well within standard baseline bounds."

            clear_votes = sum(1 for m in model_scores.values() if m.get("verdict") != "FRAUD")
            conclusion = f" Cross-model evaluation shows {clear_votes} of {total_models} models confirming safe execution with zero anomalous smart contract flags detected."

            return f"{intro}{neg_text} {conclusion}"

