// Purpose: Inline feedback widget — thumbs up/down, categories, and note.

import type { JSX } from "react";
import { useState } from "react";
import { ThumbsUp, ThumbsDown, Send } from "lucide-react";
import { submitFeedback } from "../services/observabilityClient";
import type { FeedbackCategory, FeedbackSignal } from "../types/observability";

const CATEGORIES: { id: FeedbackCategory; label: string }[] = [
  { id: "incorrect", label: "Incorrect" },
  { id: "unsafe", label: "Unsafe" },
  { id: "incomplete", label: "Incomplete" },
  { id: "slow", label: "Slow" },
  { id: "bad_format", label: "Bad format" },
  { id: "hallucination", label: "Hallucination" },
  { id: "other", label: "Other" },
];

interface FeedbackWidgetProps {
  traceId: string;
  runId?: string;
  harnessVersion?: string;
}

type SubmitState = "idle" | "submitting" | "done" | "error";

export function FeedbackWidget({ traceId, runId, harnessVersion }: FeedbackWidgetProps): JSX.Element {
  const [signal, setSignal] = useState<FeedbackSignal | null>(null);
  const [categories, setCategories] = useState<FeedbackCategory[]>([]);
  const [note, setNote] = useState("");
  const [state, setState] = useState<SubmitState>("idle");

  function toggleCategory(cat: FeedbackCategory) {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  async function handleSubmit() {
    if (!signal) return;
    setState("submitting");
    try {
      await submitFeedback({
        trace_id: traceId,
        run_id: runId,
        signal,
        categories,
        note: note.trim() || undefined,
        harness_version: harnessVersion,
      });
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="text-teal-400 text-xs px-2 py-1">
        ✓ Feedback recorded
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-2 border border-zinc-700 rounded bg-zinc-900/60">
      <div className="text-zinc-500 text-xs">Was this response helpful?</div>

      {/* Signal buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setSignal("thumbs_up")}
          className={`flex items-center gap-1 px-2 py-1 text-xs rounded border transition-colors ${
            signal === "thumbs_up"
              ? "border-teal-500 text-teal-400 bg-teal-950/40"
              : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
          }`}
        >
          <ThumbsUp size={11} /> Yes
        </button>
        <button
          onClick={() => setSignal("thumbs_down")}
          className={`flex items-center gap-1 px-2 py-1 text-xs rounded border transition-colors ${
            signal === "thumbs_down"
              ? "border-red-500 text-red-400 bg-red-950/40"
              : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
          }`}
        >
          <ThumbsDown size={11} /> No
        </button>
      </div>

      {/* Categories — shown only for thumbs down */}
      {signal === "thumbs_down" && (
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => toggleCategory(cat.id)}
              className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${
                categories.includes(cat.id)
                  ? "border-orange-500 text-orange-400 bg-orange-950/30"
                  : "border-zinc-700 text-zinc-500 hover:border-zinc-500"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* Optional note */}
      {signal && (
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note…"
          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
        />
      )}

      {signal && (
        <div className="flex items-center gap-2">
          <button
            onClick={handleSubmit}
            disabled={state === "submitting"}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded transition-colors disabled:opacity-50"
          >
            <Send size={10} />
            {state === "submitting" ? "Saving…" : "Submit"}
          </button>
          {state === "error" && (
            <span className="text-red-400 text-xs">Failed to save feedback.</span>
          )}
        </div>
      )}
    </div>
  );
}
