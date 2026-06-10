"""Purpose: File-based persistence for feedback and regression datasets."""
from __future__ import annotations

import json
import uuid
from pathlib import Path

from app.feedback.models import Feedback, FeedbackStats, RegressionDataset

_API_ROOT = Path(__file__).parent.parent.parent  # apps/api/
_FEEDBACK_DIR = _API_ROOT / "data" / "feedback"
_REGRESSION_DIR = _API_ROOT / "data" / "regression_datasets"


def _ensure_dirs() -> None:
    _FEEDBACK_DIR.mkdir(parents=True, exist_ok=True)
    _REGRESSION_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Feedback persistence
# ---------------------------------------------------------------------------


def save_feedback(fb: Feedback) -> None:
    _ensure_dirs()
    path = _FEEDBACK_DIR / f"{fb.feedback_id}.json"
    path.write_text(fb.model_dump_json(indent=2), encoding="utf-8")


def load_feedback(feedback_id: str) -> Feedback:
    path = _FEEDBACK_DIR / f"{feedback_id}.json"
    if not path.exists():
        raise FileNotFoundError(f"feedback {feedback_id!r} not found")
    return Feedback.model_validate_json(path.read_text(encoding="utf-8"))


def list_feedback(
    *,
    signal: str | None = None,
    harness_version: str | None = None,
    limit: int = 200,
) -> list[Feedback]:
    """Return feedback items, newest first, with optional filters."""
    _ensure_dirs()
    paths = sorted(_FEEDBACK_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    results: list[Feedback] = []
    for p in paths:
        try:
            fb = Feedback.model_validate_json(p.read_text(encoding="utf-8"))
            if signal and fb.signal.value != signal:
                continue
            if harness_version and fb.harness_version != harness_version:
                continue
            results.append(fb)
            if len(results) >= limit:
                break
        except Exception:  # noqa: BLE001
            pass
    return results


def compute_feedback_stats(items: list[Feedback]) -> FeedbackStats:
    """Aggregate statistics over a list of feedback records."""
    total = len(items)
    if total == 0:
        return FeedbackStats(
            total=0,
            thumbs_up=0,
            thumbs_down=0,
            thumbs_up_rate=0.0,
            thumbs_down_rate=0.0,
            category_counts={},
            by_harness_version={},
            sample_note="No feedback records.",
        )

    thumbs_up = sum(1 for f in items if f.signal.value == "thumbs_up")
    thumbs_down = total - thumbs_up

    category_counts: dict[str, int] = {}
    for fb in items:
        for cat in fb.categories:
            category_counts[cat.value] = category_counts.get(cat.value, 0) + 1

    by_version: dict[str, dict[str, int]] = {}
    for fb in items:
        v = fb.harness_version or "unknown"
        if v not in by_version:
            by_version[v] = {"thumbs_up": 0, "thumbs_down": 0, "total": 0}
        by_version[v]["total"] += 1
        if fb.signal.value == "thumbs_up":
            by_version[v]["thumbs_up"] += 1
        else:
            by_version[v]["thumbs_down"] += 1

    note = f"Statistics based on {total} feedback item(s)." if total < 10 else None

    return FeedbackStats(
        total=total,
        thumbs_up=thumbs_up,
        thumbs_down=thumbs_down,
        thumbs_up_rate=round(thumbs_up / total, 4),
        thumbs_down_rate=round(thumbs_down / total, 4),
        category_counts=category_counts,
        by_harness_version=by_version,
        sample_note=note,
    )


# ---------------------------------------------------------------------------
# Regression dataset persistence
# ---------------------------------------------------------------------------


def save_regression_dataset(ds: RegressionDataset) -> None:
    _ensure_dirs()
    path = _REGRESSION_DIR / f"{ds.dataset_id}.json"
    path.write_text(ds.model_dump_json(indent=2), encoding="utf-8")


def load_regression_dataset(dataset_id: str) -> RegressionDataset:
    path = _REGRESSION_DIR / f"{dataset_id}.json"
    if not path.exists():
        raise FileNotFoundError(f"regression dataset {dataset_id!r} not found")
    return RegressionDataset.model_validate_json(path.read_text(encoding="utf-8"))


def list_regression_datasets() -> list[dict]:
    _ensure_dirs()
    results = []
    for p in sorted(_REGRESSION_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            ds = RegressionDataset.model_validate_json(p.read_text(encoding="utf-8"))
            results.append({
                "dataset_id": ds.dataset_id,
                "name": ds.name,
                "created_at": ds.created_at.isoformat(),
                "row_count": ds.row_count,
            })
        except Exception:  # noqa: BLE001
            pass
    return results
