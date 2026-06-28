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
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Tab bar */}
      <nav
        style={{
          display: "flex",
          gap: 16,
          padding: "0 20px",
          borderBottom: "1px solid var(--border-color)",
          backgroundColor: "var(--bg-secondary)",
          height: 44,
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 0",
              color: tab === t.id ? "var(--accent-primary)" : "var(--text-secondary)",
              background: "transparent",
              border: "none",
              borderBottom: `2px solid ${tab === t.id ? "var(--accent-primary)" : "transparent"}`,
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              transition: "color 0.2s, border-color 0.2s",
              whiteSpace: "nowrap",
            }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {tab === "traces" && <TracesTab />}
        {tab === "feedback" && <FeedbackTab />}
        {tab === "guardrails" && <GuardrailsTab />}
      </div>
    </div>
  );
}
