"""Purpose: Define stub executor for normalization node runtime behavior."""
from app.nodes.base import BaseNodeExecutor


class NormalizerExecutor(BaseNodeExecutor):
    def run(self) -> dict:
        return {}
