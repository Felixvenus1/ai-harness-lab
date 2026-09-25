# API

FastAPI service that executes flow graphs and stores traces, feedback, guardrail policies and evaluation runs as JSON under `data/`.

```bash
pip install -e ../../packages/core -e .
uvicorn app.main:app --reload --port 8000
python -m pytest
```

Run commands from this directory so the `evaluation` package and `data/` paths resolve. Provider keys go in `.env` (see `.env.example`).
