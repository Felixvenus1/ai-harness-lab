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

