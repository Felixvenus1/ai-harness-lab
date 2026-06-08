# Purpose: Build and run the FastAPI service container for local development.
FROM python:3.12-slim
WORKDIR /app
# Build context is the repo root so the shared core package is available.
COPY packages/core ./packages/core
COPY apps/api ./apps/api
RUN pip install --no-cache-dir ./packages/core ./apps/api
WORKDIR /app/apps/api
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
