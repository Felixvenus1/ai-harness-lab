"""Purpose: Provide flow validation route stubs for uploaded harness definitions."""
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/flows", tags=["flows"])


class FlowPayload(BaseModel):
    flow: dict


@router.post("/validate")
def validate_flow(payload: FlowPayload) -> dict[str, str]:
    return {"result": "stub"}
