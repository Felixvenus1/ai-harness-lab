"""Purpose: Define stub executor for provider-backed model invocation nodes."""
from app.nodes.base import BaseNodeExecutor


class ModelExecutor(BaseNodeExecutor):
    def run(self) -> dict:
        return {}
