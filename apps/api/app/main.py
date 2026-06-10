"""Purpose: Create the FastAPI application and register API routers."""
import sys
import os
import logging
import traceback

# Ensure the evaluation module (apps/api/evaluation/) is on the Python path.
_EVAL_ROOT = os.path.join(os.path.dirname(__file__), "..")
if _EVAL_ROOT not in sys.path:
    sys.path.insert(0, _EVAL_ROOT)

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.api.routes.execute import router as execute_router
from app.api.routes.evaluation import router as evaluation_router
from app.api.routes.health import router as health_router
from app.api.routes.providers import router as providers_router
from app.api.routes.traces import router as traces_router
from app.api.routes.feedback import router as feedback_router
from app.api.routes.guardrails import router as guardrails_router
from app.api.routes.flows import router as flows_router
from app.api.routes.validate import router as validate_router

logger = logging.getLogger(__name__)

app = FastAPI(title="AI Harness Lab API")


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch unhandled exceptions and return proper error response."""
    error_msg = f"{type(exc).__name__}: {str(exc)}"
    stack_trace = traceback.format_exc()
    logger.error(f"Unhandled exception: {error_msg}\n{stack_trace}")
    return JSONResponse(
        status_code=500,
        content={
            "error": error_msg,
            "detail": stack_trace,
            "path": str(request.url),
        },
    )


app.include_router(health_router)
app.include_router(providers_router)
app.include_router(execute_router)
app.include_router(evaluation_router)
app.include_router(traces_router)
app.include_router(feedback_router)
app.include_router(guardrails_router)
app.include_router(validate_router)
app.include_router(flows_router)
