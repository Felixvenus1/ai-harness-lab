"""Purpose: Define stub executor for fallback routing node runtime behavior."""
from app.nodes.base import BaseNodeExecutor


class FallbackExecutor(BaseNodeExecutor):
    def run(self) -> dict:
        return {}
