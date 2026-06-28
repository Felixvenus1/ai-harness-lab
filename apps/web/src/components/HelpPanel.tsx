import type { JSX } from "react";
import { X, MousePointer2, Keyboard, Layers } from "lucide-react";
import { NODE_META, NODE_TYPES_ORDERED } from "../config/nodeConfig";
import { Backdrop } from "./SettingsPanel";

interface HelpPanelProps {
  onClose: () => void;
}

export function HelpPanel({ onClose }: HelpPanelProps): JSX.Element {
  return (
    <Backdrop onClose={onClose}>
      <div
        style={{
          backgroundColor: "var(--bg-secondary)",
          border: "1px solid var(--border-color)",
          borderRadius: 10,
          width: 480,
          maxWidth: "calc(100vw - 48px)",
          maxHeight: "calc(100vh - 80px)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 18px",
            borderBottom: "1px solid var(--border-color)",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", flex: 1 }}>
            Help &amp; Reference
          </span>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
              background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", borderRadius: 6,
            }}
          >
            <X size={15} />
          </button>
        </div>

        <div style={{ overflowY: "auto", padding: "20px 18px", display: "flex", flexDirection: "column", gap: 24 }}>

          {/* Canvas interactions */}
          <Section icon={<MousePointer2 size={14} />} title="Canvas">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {[
                  ["Drag node from palette", "Add node to canvas"],
                  ["Drag node handle → handle", "Connect two nodes"],
                  ["Click node", "Open Node Inspector"],
                  ["Click canvas background", "Deselect / close Inspector"],
                  ["Select node + Delete", "Remove node"],
                  ["Scroll wheel", "Zoom in / out"],
                  ["Middle-click drag", "Pan canvas"],
                  ["Ctrl + click drag", "Pan canvas (alternate)"],
                ].map(([action, desc]) => (
                  <tr key={action} style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <td style={{ padding: "7px 0 7px 0", fontSize: 12, color: "var(--text-secondary)", width: "50%", paddingRight: 12 }}>{action}</td>
                    <td style={{ padding: "7px 0", fontSize: 12, color: "var(--text-tertiary)" }}>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          {/* Keyboard shortcuts */}
          <Section icon={<Keyboard size={14} />} title="Keyboard Shortcuts">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                ["Delete / Backspace", "Delete selected node"],
                ["Ctrl + Z", "Undo node/edge change"],
                ["Ctrl + Shift + Z", "Redo"],
                ["Ctrl + A", "Select all nodes"],
                ["Escape", "Deselect / close Inspector"],
              ].map(([keys, desc]) => (
                <div key={keys} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <KbdChip>{keys}</KbdChip>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)", textAlign: "right" }}>{desc}</span>
                </div>
              ))}
            </div>
          </Section>

          {/* Node reference */}
          <Section icon={<Layers size={14} />} title="Node Types">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {NODE_TYPES_ORDERED.map((type) => {
                const meta = NODE_META[type];
                const { Icon } = meta;
                return (
                  <div
                    key={type}
                    style={{
                      display: "flex",
                      gap: 10,
                      padding: "8px 10px",
                      borderRadius: 6,
                      backgroundColor: "var(--bg-tertiary)",
                      border: "1px solid var(--border-color)",
                      alignItems: "flex-start",
                    }}
                  >
                    <Icon size={14} className={meta.iconColorClass} style={{ marginTop: 1, flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>
                        {meta.label}
                      </p>
                      <p style={{ fontSize: 11, color: "var(--text-tertiary)", lineHeight: 1.5 }}>
                        {NODE_DESCRIPTIONS[type]}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* Flow tips */}
          <Section icon={<span style={{ fontSize: 14 }}>💡</span>} title="Tips">
            <ul style={{ paddingLeft: 16, margin: 0, display: "flex", flexDirection: "column", gap: 5 }}>
              {[
                "Use Starter Flows (sidebar) to load example graphs and learn from them.",
                "The Node Inspector (right panel) lets you configure provider, schema, and thresholds.",
                "Chain Input Validator → Model → Schema Validator for a solid production baseline.",
                "Fallback nodes catch failures and route to a secondary provider.",
                "After running, expand trace rows to inspect raw input/output JSON per node.",
              ].map((tip) => (
                <li key={tip} style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  {tip}
                </li>
              ))}
            </ul>
          </Section>

        </div>
      </div>
    </Backdrop>
  );
}

const NODE_DESCRIPTIONS: Record<string, string> = {
  input_validator: "Validates the initial user input. Checks required fields, min/max length. Blocks empty or malformed requests before they reach the model.",
  normaliser: "Transforms the input before the model call — strips whitespace, lowercases, or applies a prompt template.",
  model: "Calls an LLM provider (mock, OpenRouter, Gemini). Supports tool call routing and configurable response modes.",
  schema_validator: "Validates the model output against a JSON Schema. Fails the step if required fields are missing or types are wrong.",
  fallback: "Wraps a chain segment. On failure, returns a safe default response and continues the flow.",
  logger: "Records node output to the execution trace. Useful as the terminal node to capture final output.",
};

function Section({
  icon,
  title,
  children,
}: {
  icon: JSX.Element;
  title: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: "var(--accent-primary)", display: "flex" }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text-tertiary)" }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function KbdChip({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <span
      style={{
        fontFamily: "monospace",
        fontSize: 11,
        padding: "3px 8px",
        borderRadius: 4,
        backgroundColor: "var(--bg-tertiary)",
        border: "1px solid var(--border-color)",
        color: "var(--text-primary)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}
