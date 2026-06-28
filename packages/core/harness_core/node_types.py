"""Purpose: Define the canonical node type enumeration used across the harness."""
from enum import Enum


class NodeType(str, Enum):
    INPUT_VALIDATOR = "input_validator"
    NORMALISER = "normaliser"
    MODEL = "model"
    SCHEMA_VALIDATOR = "schema_validator"
    FALLBACK = "fallback"
    LOGGER = "logger"
    ROUTER = "router"
    MERGE = "merge"
    LOOP = "loop"
