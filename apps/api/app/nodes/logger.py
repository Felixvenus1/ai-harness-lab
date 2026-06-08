"""Purpose: Define stub executor for structured logging node runtime behavior."""
from app.nodes.base import BaseNodeExecutor


class LoggerExecutor(BaseNodeExecutor):
    def run(self) -> dict:
        return {}
