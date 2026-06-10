"""Purpose: Create the FastAPI application and register API routers."""
import sys
import os

# Ensure the evaluation module (apps/api/evaluation/) is on the Python path.
_EVAL_ROOT = os.path.join(os.path.dirname(__file__), "..")
if _EVAL_ROOT not in sys.path:
    sys.path.insert(0, _EVAL_ROOT)

from fastapi import FastAPI

from app.api.routes.execute import router as execute_router
from app.api.routes.evaluation import router as evaluation_router
from app.api.routes.health import router as health_router
from app.api.routes.providers import router as providers_router
from app.api.routes.traces import router as traces_router
from app.api.routes.feedback import router as feedback_router
from app.api.routes.guardrails import router as guardrails_router

app = FastAPI(title="AI Harness Lab API")
app.include_router(health_router)
app.include_router(providers_router)
app.include_router(execute_router)
app.include_router(evaluation_router)
app.include_router(traces_router)
app.include_router(feedback_router)
app.include_router(guardrails_router)
