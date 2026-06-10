// Purpose: Observability workbench — Traces, Feedback, and Guardrails tabs.

import type { JSX } from "react";
import { useState } from "react";
import { Activity, MessageSquare, Shield } from "lucide-react";
import { TracesTab } from "./TracesTab";
import { FeedbackTab } from "./FeedbackTab";
import { GuardrailsTab } from "./GuardrailsTab";

type Tab = "traces" | "feedback" | "guardrails";

const TABS: { id: Tab; label: string; icon: JSX.Element }[] = [
  { id: "traces", label: "Traces", icon: <Activity size={13} /> },
  { id: "feedback", label: "Feedback", icon: <MessageSquare size={13} /> },
  { id: "guardrails", label: "Guardrails", icon: <Shield size={13} /> },
];

export function ObservabilityPage(): JSX.Element {
  const [tab, setTab] = useState<Tab>("traces");

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-zinc-950">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 h-12 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <span className="text-teal-400 font-semibold text-sm tracking-wide">AI Harness Lab</span>
        <div className="w-px h-4 bg-zinc-700" />
        <span className="text-zinc-300 text-sm">Observability</span>
      </header>

      {/* Tab bar */}
      <nav className="flex gap-1 px-4 pt-2 pb-0 bg-zinc-900 border-b border-zinc-800 shrink-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-t border-b-2 transition-colors ${
              tab === t.id
                ? "border-teal-500 text-teal-400"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {tab === "traces" && <TracesTab />}
        {tab === "feedback" && <FeedbackTab />}
        {tab === "guardrails" && <GuardrailsTab />}
      </div>
    </div>
  );
}
