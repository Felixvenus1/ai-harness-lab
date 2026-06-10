<!-- Developer README for AI Harness Lab -->
# AI Harness Lab

React + Vite editor and FastAPI execution engine for building and testing flow-based LLM integrations.

One-line description
- A monorepo for authoring, validating, and executing flow graphs that orchestrate LLM providers and lightweight tool calls.

What problem it solves
- Provides a local developer environment to design, run, and iterate on flow graphs that connect input validation, model calls, schema validation, fallbacks and simple tool routing.
- Keeps provider implementations and flow execution contracts separated so you can test with mock providers and swap in real providers with minimal changes.

Tech stack
- ![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=000)
- ![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=FFF)
- ![React Flow](https://img.shields.io/badge/ReactFlow-FF0072?logo=reactflow&logoColor=FFF)
- ![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=FFF)
- ![Python](https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=FFF)
- ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=FFF)
- ![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=FFF)

Quick start (local, no API keys)
1. Clone the repo:

```bash
git clone https://github.com/your-org/aiharnesslab.git
cd aiharnesslab
```

2. Build and run with Docker Compose (starts both `apps/api` and `apps/web`):

```bash
docker compose up --build
```

3. Open the web editor at http://localhost:5173 and import example flows from the `examples/` folder.

Architecture overview
- Monorepo layout:
	- `apps/web` — React + Vite UI for editing and running flows; uses the flow JSON files in `examples/`.
	- `apps/api` — FastAPI service that implements the flow executor and provider registry.
	- `packages/core` — TypeScript/Python shared contracts: FlowGraph schema, node types, provider interface, and validation helpers.
	- `examples/` — runnable flow JSON files used by the web editor.
- Execution model (high level):
	- A `FlowGraph` JSON describes nodes and edges. Each node has a `type` (validator, model, normaliser, fallback, logger, etc.) and a `config` object.
	- The executor walks the graph from `initial_input`, running nodes in the defined order and passing a payload object between nodes.
	- `model` nodes call provider implementations via the provider interface; their outputs can include structured `tool_call` objects which the executor may route to registered tool handlers.
	- `fallback` nodes wrap a primary node execution and, on defined failure conditions, invoke a secondary provider or retry path.
- Provider interface (concept):
	- Providers implement a small contract: connect(config) -> client, call(client, request) -> response. Providers are registered in `apps/api/providers/registry` and wired into the executor.
	- Providers should return a deterministic object shape the executor expects, and may expose flags like `supports_tool_calls`.

Adding a real provider (example: OpenRouter)
Add a new provider module and register it in the provider registry. Minimal TypeScript-style example (~10 lines):

```ts
import { BaseProvider } from '../../packages/core/src/provider-contract';
export class OpenRouterProvider extends BaseProvider {
	constructor(cfg){ super(cfg); this.key = cfg.apiKey; }
	async call(client, req){ return fetch('https://api.openrouter.ai/', { method:'POST', body: JSON.stringify(req) }); }
}
// then register: providerRegistry.register('openrouter', new OpenRouterProvider(cfg));
```

Example flows (files in `examples/`)
- `strict-json-extractor.json` — InputValidator → Model → SchemaValidator → Logger. Enforces a strict JSON schema and fails the flow with a clear error when validation fails.
- `safe-customer-support.json` — InputValidator (blocks profanity/PII) → Normaliser (lowercase, trim) → Model → SchemaValidator → Logger. Shows content sanitisation before model calls.
- `tool-routing-agent.json` — InputValidator → Model (with `tool_calls` enabled) → Fallback that retries once if tool-call JSON is malformed → Logger. Demonstrates routing and retry logic for tool calls.
- `fallback-chain.json` — Model (primary: mock provider) → Fallback (secondary: mock provider with different config) → Logger. Demonstrates graceful degradation to a secondary provider.

Where to look next
- Flow schema: `packages/core/src/flow-schema.ts` and `packages/core/schemas/flow.schema.json`.
- Provider examples: `apps/api/providers/mock_provider.py` and `apps/api/providers/registry.py`.

Contributing notes
- Keep changes to provider contracts backward-compatible where possible. Tests for executor behavior live under `apps/api/tests`.

License: See `LICENSE` in the repository root.

---

## Observability / Trajectory Layer

Every `/run` call now creates a **Trace** — a structured record of every step the flow took.

### What is captured
- A `Trace` wraps an ordered list of `Span` objects. Each span records:
  - `kind` — `model_call | tool_call | retrieval | validation | guardrail | fallback | retry | general`
  - `started_at / ended_at / latency_ms`
  - `input / output` (verbatim, not summarised)
  - `status` — `success | failure | blocked | redacted | retried`
  - `error` (if any)
  - `input_tokens / output_tokens / cost_usd` (for model calls)
- A `TrajectoryScore` is computed automatically:
  - total steps, tool-call count, retry count
  - failed-span rate, blocked-span rate
  - median and p95 step latency (with honest uncertainty note when n < 20)

### Storage
Traces are written as JSON to `apps/api/data/traces/{trace_id}.json`.

### API
- `GET /traces` — list summaries (newest first)
- `GET /traces/{trace_id}` — full trace including all spans and trajectory score

### UI
Click **Observe** in the top bar to open the Observability workbench.  
The **Traces** tab shows a span tree for each run. Expand any span to inspect its input, output, and error.  
After inspecting a trace, submit feedback directly below the span tree.

### Seed examples
```
python scripts/seed_observability.py
```

---

## Feedback / Dataset Loop

Users can give a thumbs-up or thumbs-down on any trace and optionally tag it with a category (`incorrect | unsafe | incomplete | slow | bad_format | hallucination | other`).

### API
- `POST /feedback` — submit feedback against a `trace_id`
- `GET /feedback` — list feedback (filter by signal or harness_version)
- `GET /feedback/stats` — aggregate thumbs-up rate, thumbs-down rate, category frequency, per-version breakdown
- `POST /feedback/regression-datasets` — convert selected feedback items into a regression dataset
- `GET /feedback/regression-datasets/{id}/export?format=json|csv` — download

### Regression datasets
When you create a regression dataset from feedback, each row preserves:
- original trace input and model output
- feedback signal and categories
- harness version, model version
- trajectory score from the original trace

This lets you re-run failed or flagged traces against new model versions as a proper regression suite.

### UI
Click **Observe → Feedback** to:
- See thumbs-up/down rates and category breakdown
- Select negative-feedback rows and create a named regression dataset
- Download existing regression datasets as JSON or CSV

---

## Policy Guardrail Engine

The guardrail engine runs **before** the model call (on the user input) and **after** the model call (on the model output). Both pre- and post-inference checks are recorded as `guardrail` spans in the trace.

### Built-in policy types
| Type | What it detects |
|---|---|
| `pii` | Emails, phone numbers, SSNs, credit cards, IPs |
| `hate` | Slurs, threats, dehumanising phrases |
| `dangerous_intent` | Weapons, explosives, drug synthesis, cyberattack requests |
| `prompt_injection` | Classic "ignore previous instructions" patterns |
| `output_format` | JSON validity, required fields, max length |
| `sensitive_redaction` | Custom term list (supply via `params.terms`) |

### Policy actions
- `allow` — pass through unchanged
- `warn` — pass through but record the decision
- `block` — return a structured `GUARDRAIL_BLOCKED` error with explanation (no raw error to the user)
- `redact` — replace sensitive tokens before passing to the next step

### Composability
The engine accepts an ordered list of `PolicyConfig` objects. Policies are applied left-to-right; redaction from an earlier policy is seen by later ones. The most-severe action across all triggered policies wins.

### API
- `GET /guardrails/policies` — list configured policies
- `POST /guardrails/policies` — create a policy
- `PUT /guardrails/policies/{id}` — update (full replacement)
- `DELETE /guardrails/policies/{id}` — remove
- `POST /guardrails/check` — ad-hoc check of arbitrary text against enabled policies
- `GET /guardrails/stats` — block rate by type, redact rate, warn rate, review-queue size

### UI
Click **Observe → Guardrails** to:
- Toggle policies on/off
- Add new policies (choose type and action from dropdowns)
- Run an ad-hoc check and see per-policy decisions
- View aggregate block/redact/warn statistics

### Overriding policies at runtime
Pass `policy_overrides` in the `/run` request body to use a specific set of policies for that call instead of the persisted defaults:
```json
{
  "graph": { ... },
  "policy_overrides": [
    { "policy_id": "custom", "name": "Custom PII", "type": "pii", "action": "redact", "enabled": true, "params": {} }
  ]
}
```

---

## Tests
```
cd apps/api
python -m pytest tests/test_observability.py tests/test_guardrails.py -v
```
Covers: trajectory scoring edge cases, feedback statistics, every policy module, and engine composition.

