"""Purpose: Define stub executor for input validation node runtime behavior."""
from app.nodes.base import BaseNodeExecutor


class InputValidatorExecutor(BaseNodeExecutor):
    def run(self) -> dict:
        return {}
