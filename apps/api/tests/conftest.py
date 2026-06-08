"""Purpose: Provide shared test fixtures and application setup for API test modules."""
from fastapi import FastAPI


def create_test_app() -> FastAPI:
    return FastAPI()
