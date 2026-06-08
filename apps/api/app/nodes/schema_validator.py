"""Purpose: Define stub executor for schema validation node runtime behavior."""
from app.nodes.base import BaseNodeExecutor


class SchemaValidatorExecutor(BaseNodeExecutor):
    def run(self) -> dict:
        return {}
