"""Purpose: Define Pydantic runtime model stubs used during graph execution."""
from pydantic import BaseModel


class RunContext(BaseModel):
    run_id: str
