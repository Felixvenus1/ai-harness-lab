"""Purpose: Create the FastAPI application and register API routers."""
from fastapi import FastAPI

from app.api.routes.execute import router as execute_router
from app.api.routes.health import router as health_router
from app.api.routes.providers import router as providers_router

app = FastAPI(title="AI Harness Lab API")
app.include_router(health_router)
app.include_router(providers_router)
app.include_router(execute_router)
