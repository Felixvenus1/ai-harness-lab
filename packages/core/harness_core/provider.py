"""Purpose: Declare the abstract provider contract that every model backend must satisfy."""
from abc import ABC, abstractmethod


class ProviderBase(ABC):
    """Minimal provider contract: turn a list of chat messages into a string reply."""

    name: str = "base"

    @abstractmethod
    def complete(self, messages: list) -> str:
        """Return a completion string for the given list of chat messages."""
        raise NotImplementedError
