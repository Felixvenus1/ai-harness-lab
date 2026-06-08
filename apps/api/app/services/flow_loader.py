"""Purpose: Provide stubs for loading flow definitions from request bodies or storage."""
from pydantic import BaseModel


class LoadedFlow(BaseModel):
    data: dict


def load_flow() -> LoadedFlow:
    return LoadedFlow(data={})
