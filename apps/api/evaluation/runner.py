"""Purpose: Benchmark runner — executes a harness flow over a dataset and collects metrics."""
from __future__ import annotations

import asyncio
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any, Callable

from harness_core.schemas import BenchmarkRun, EvaluationRecord, FlowGraph

from evaluation.metrics.accuracy import compute_all as compute_accuracy
from evaluation.metrics.cost import per_run_cost, token_breakdown
from evaluation.metrics.latency import (
    fit_distributions,
    flag_anomalies,
    latency_regression,
    latency_summary,
)
from evaluation.stats.bayesian import posterior_accuracy, subgroup_analysis


class BenchmarkRunner:
    """Execute a saved harness over a dataset and produce a BenchmarkRun."""

    def __init__(
        self,
        flow_graph: FlowGraph,
        dataset_rows: list[dict[str, Any]],
        metrics: list[str],
        concurrency: int = 1,
        progress_callback: Callable[[dict[str, Any]], None] | None = None,
    ) -> None:
        self.flow_graph = flow_graph
        self.dataset_rows = dataset_rows
        self.metrics = metrics
        self.concurrency = max(1, min(concurrency, 5))
        self.progress_callback = progress_callback
        self.run_id = str(uuid.uuid4())

    def run(self) -> BenchmarkRun:
        """Execute the benchmark synchronously, returning a BenchmarkRun."""
        from app.core.executor import FlowExecutor  # type: ignore  # noqa: PLC0415

        records: list[EvaluationRecord] = []
        completed = 0
        running_latency: list[float] = []
        running_cost: float = 0.0

        def _run_single(row: dict[str, Any]) -> EvaluationRecord:
            input_text = str(row.get("input", ""))
            reference = str(row.get("reference", ""))
            group = row.get("group")
            row_id = str(row.get("row_id", str(uuid.uuid4())))

            # Build a single-row graph by injecting the input
            graph = self.flow_graph.model_copy(update={"initial_input": input_text})

            t0 = time.perf_counter()
            error: str | None = None
            output = ""
            input_tokens = 0
            output_tokens = 0
            cost_usd = 0.0

            try:
                trace = FlowExecutor(graph).run()
                output = str(trace.final_output or "")
                # Extract token/cost from model node results if available
                for res in trace.results:
                    if hasattr(res, "input_tokens"):
                        input_tokens += getattr(res, "input_tokens", 0)
                    if hasattr(res, "output_tokens"):
                        output_tokens += getattr(res, "output_tokens", 0)
                    if hasattr(res, "cost_usd"):
                        cost_usd += getattr(res, "cost_usd", 0.0)
                # Estimate tokens from text length if not provided
                if input_tokens == 0:
                    input_tokens = max(1, len(input_text.split()))
                if output_tokens == 0:
                    output_tokens = max(1, len(output.split()))
            except Exception as exc:  # noqa: BLE001
                error = str(exc)
                output = ""

            latency_ms = (time.perf_counter() - t0) * 1000.0

            # Compute accuracy scores
            scores: dict[str, float] = {}
            if "accuracy" in self.metrics and output and not error:
                scores.update(compute_accuracy(output, reference))

            return EvaluationRecord(
                row_id=row_id,
                input=input_text,
                reference=reference,
                output=output,
                group=group,
                latency_ms=round(latency_ms, 2),
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cost_usd=round(cost_usd, 8),
                scores=scores,
                error=error,
            )

        # Execute with limited concurrency using ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=self.concurrency) as executor:
            futures = {executor.submit(_run_single, row): i for i, row in enumerate(self.dataset_rows)}
            for future in as_completed(futures):
                rec = future.result()
                records.append(rec)
                completed += 1
                running_latency.append(rec.latency_ms)
                running_cost += rec.cost_usd

                if self.progress_callback:
                    accuracy_so_far = None
                    if records:
                        hits = sum(1 for r in records if r.scores.get("exact_match", 0) > 0.5)
                        accuracy_so_far = round(hits / len(records), 4)
                    self.progress_callback({
                        "run_id": self.run_id,
                        "rows_completed": completed,
                        "row_count": len(self.dataset_rows),
                        "accuracy_rate": accuracy_so_far,
                        "mean_latency_ms": round(sum(running_latency) / len(running_latency), 2),
                        "cumulative_cost_usd": round(running_cost, 6),
                        "status": "running",
                    })

        # Sort records back to original order
        row_id_order = {str(row.get("row_id", i)): i for i, row in enumerate(self.dataset_rows)}
        records.sort(key=lambda r: row_id_order.get(r.row_id, 0))

        summary = self._compute_summary(records)

        return BenchmarkRun(
            id=self.run_id,
            harness_id=self.flow_graph.id or "unknown",
            dataset_id="",  # Set by the caller
            timestamp=datetime.now(tz=timezone.utc),
            row_count=len(records),
            metrics_config=self.metrics,
            records=records,
            summary=summary,
        )

    def _compute_summary(self, records: list[EvaluationRecord]) -> dict[str, Any]:
        """Aggregate metrics across all records into a top-level summary."""
        raw_records = [r.model_dump() for r in records]
        latencies = [r.latency_ms for r in records]
        summary: dict[str, Any] = {}

        # Accuracy
        if "accuracy" in self.metrics:
            successes = sum(1 for r in records if r.scores.get("exact_match", 0) > 0.5)
            bayes = posterior_accuracy(successes, len(records))
            summary["accuracy"] = {
                "exact_match_rate": round(successes / max(len(records), 1), 4),
                "bayesian": bayes,
                "mean_bertscore_f1": round(
                    sum(r.scores.get("bertscore_f1", 0.0) for r in records) / max(len(records), 1), 4
                ),
                "mean_semantic_similarity": round(
                    sum(r.scores.get("semantic_similarity", 0.0) for r in records) / max(len(records), 1), 4
                ),
            }

        # Cost
        if "cost" in self.metrics:
            summary["cost"] = per_run_cost(raw_records)
            summary["tokens"] = token_breakdown(raw_records)

        # Latency
        if "latency" in self.metrics:
            summary["latency"] = latency_summary(latencies)
            summary["latency_distribution"] = fit_distributions(latencies)
            summary["latency_anomalies"] = flag_anomalies(raw_records)
            summary["latency_regression"] = latency_regression(raw_records)

        # Subgroup analysis
        groups: dict[str, list[EvaluationRecord]] = {}
        for r in records:
            if r.group:
                groups.setdefault(r.group, []).append(r)
        if groups:
            group_stats = {
                name: (
                    sum(1 for r in recs if r.scores.get("exact_match", 0) > 0.5),
                    len(recs),
                )
                for name, recs in groups.items()
            }
            summary["subgroups"] = subgroup_analysis(group_stats)

        # Small-sample warning
        if len(records) < 30:
            summary["small_sample_warning"] = (
                f"Only {len(records)} rows evaluated. "
                "Statistical estimates have high uncertainty; Bayesian intervals will be wide by design."
            )

        return summary
