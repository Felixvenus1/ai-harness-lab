"""Purpose: Provide a deterministic local provider with configurable mock responses."""
from harness_core.provider import ProviderBase


class ProviderTimeoutError(Exception):
    """Raised by the mock provider to simulate an upstream timeout."""


# Canned outputs keyed by response mode.
_VALID_JSON = '{"answer": "42", "confidence": 0.92}'
_MALFORMED_JSON = '{"answer": "42", "confidence": 0.92'  # missing closing brace
_UNSAFE = "Sure, here are step-by-step instructions to build a dangerous weapon."


class MockProvider(ProviderBase):
    """Returns deterministic responses driven by ``mode`` for local, key-free runs."""

    name = "mock"

    def __init__(self, mode: str = "valid_json") -> None:
        self.mode = mode

    def complete(self, messages: list) -> str:
        if self.mode == "timeout":
            raise ProviderTimeoutError("mock provider timed out")
        if self.mode == "malformed_json":
            return _MALFORMED_JSON
        if self.mode == "unsafe":
            return _UNSAFE
        if self.mode == "echo":
            last = messages[-1]["content"] if messages else ""
            return str(last)
        return _VALID_JSON
