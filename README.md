# AI Harness Lab

A local tool for building and running LLM flow graphs. You wire nodes (input validator, normaliser, model, schema validator, fallback, logger) on a React Flow canvas, and a FastAPI backend executes the graph with guardrail checks, trace recording, user feedback and an evaluation workbench.

The web app is in `apps/web` (React, Vite, TypeScript). The API is in `apps/api` (FastAPI) and uses the shared Python models in `packages/core`. Example flows are in `examples/` and can be imported from the editor.

## Run with Docker

```bash
docker compose up --build
```

The editor is at http://localhost:5173 and the API at http://localhost:8000.

## Run locally

API (Python 3.12):

```bash
cd apps/api
python -m venv .venv && source .venv/bin/activate
pip install -e ../../packages/core -e .
uvicorn app.main:app --reload --port 8000
```

Web (Node 22):

```bash
cd apps/web
npm ci
npm run dev
```

The Vite dev server proxies `/api` to `http://localhost:8000`. Set `API_PROXY_TARGET` to point it elsewhere.

## Providers

The `mock` provider needs no key. For real models, set `OPENROUTER_API_KEY` or `ANTHROPIC_API_KEY` in the environment or in `apps/api/.env` (see `apps/api/.env.example`). The semantic similarity metric downloads a sentence-transformers model on first use.

## API

- `POST /run` executes a flow graph and returns the node results and a trace ID.
- `GET /traces`, `GET /traces/{id}` return recorded traces, written to `apps/api/data/traces/`.
- `/feedback` stores thumbs up or down on a trace and can export regression datasets as JSON or CSV.
- `/guardrails/policies` manages policies (PII, hate, dangerous intent, prompt injection, output format, custom redaction), each with an allow, warn, block or redact action. Pass `policy_overrides` in a `/run` body to use a different set for one call.
- `/evaluation` runs datasets through a flow and reports accuracy, latency, cost, robustness and Bayesian comparisons.

Interactive docs are at http://localhost:8000/docs.

## Tests

```bash
cd apps/api
python -m pytest
cd ../web
npm run lint
```

`python scripts/seed_observability.py` adds sample policies, a trace and feedback items.

`currentUI/` has screenshots of the app. `NewUI/` is a design mockup exported from Claude Design for a planned UI refresh.
