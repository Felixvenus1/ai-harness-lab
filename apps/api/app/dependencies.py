"""Purpose: Expose FastAPI dependency provider stubs for shared services."""
from pydantic import BaseModel


class DependencyContainer(BaseModel):
    ready: bool = False


def get_container() -> DependencyContainer:
    return DependencyContainer()
