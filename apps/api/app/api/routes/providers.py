"""Purpose: Expose GET /providers to list the model providers available to the engine."""
from fastapi import APIRouter

from app.providers.registry import list_providers

router = APIRouter(tags=["providers"])


@router.get("/providers")
def get_providers() -> dict[str, list[str]]:
    return {"providers": list_providers()}
