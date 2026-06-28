import type { JSX } from "react";
import { Play, Loader2, ShieldCheck, Save, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import type { RunStatus } from "../hooks/useExecutionTrace";

interface TopBarProps {
  flowName: string;
  onFlowNameChange: (name: string) => void;
  initialInput: string;
  onInitialInputChange: (v: string) => void;
  onRun: () => void;
  onValidate: () => void;
  onSave: () => void;
  runStatus: RunStatus;
  validateStatus: "idle" | "running" | "valid" | "invalid" | "error";
  saveStatus: "idle" | "saving" | "saved" | "error";
  density: "compact" | "normal" | "comfortable";
  onDensityChange: (d: "compact" | "normal" | "comfortable") => void;
}

const DENSITY_OPTIONS: { id: "compact" | "normal" | "comfortable"; label: string }[] = [
  { id: "compact", label: "S" },
  { id: "normal", label: "M" },
  { id: "comfortable", label: "L" },
];

export function TopBar({
  flowName,
  onFlowNameChange,
  initialInput,
  onInitialInputChange,
  onRun,
  onValidate,
  onSave,
  runStatus,
  validateStatus,
  saveStatus,
  density,
  onDensityChange,
}: TopBarProps): JSX.Element {
  const running = runStatus === "running";
  const validating = validateStatus === "running";
  const saving = saveStatus === "saving";

  return (
    <header
      style={{
        height: 48,
        backgroundColor: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border-color)",
        display: "flex",
        alignItems: "center",
        padding: "0 20px",
        gap: 16,
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      {/* Brand */}
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-primary)", whiteSpace: "nowrap" }}>
        AI Harness Lab
      </span>
      <Divider />

      {/* Flow name */}
      <input
        value={flowName}
        onChange={(e) => onFlowNameChange(e.target.value)}
        spellCheck={false}
        aria-label="Flow name"
        style={{
          background: "transparent",
          border: "1px solid transparent",
          borderBottom: "1px solid var(--border-color)",
          color: "var(--text-primary)",
          fontSize: 15,
          fontWeight: 600,
          padding: "6px 8px",
          minWidth: 120,
          outline: "none",
          transition: "border-color 0.2s",
        }}
        onFocus={(e) => (e.currentTarget.style.borderBottomColor = "var(--accent-primary)")}
        onBlur={(e) => (e.currentTarget.style.borderBottomColor = "var(--border-color)")}
      />

      {/* Initial input */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, maxWidth: 400 }}>
        <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 500, whiteSpace: "nowrap" }}>
          Input
        </span>
        <input
          value={initialInput}
          onChange={(e) => onInitialInputChange(e.target.value)}
          placeholder="Enter initial input…"
          aria-label="Initial flow input"
          style={{
            flex: 1,
            backgroundColor: "var(--bg-tertiary)",
            border: "1px solid var(--border-color)",
            borderRadius: 6,
            color: "var(--text-primary)",
            fontSize: 13,
            padding: "6px 12px",
            outline: "none",
            transition: "border-color 0.2s, box-shadow 0.2s",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--accent-primary)";
            e.currentTarget.style.boxShadow = "0 0 0 2px rgba(22,163,74,0.1)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--border-color)";
            e.currentTarget.style.boxShadow = "none";
          }}
        />
      </div>

      <div style={{ flex: 1 }} />

      {/* Status badges */}
      {runStatus === "success"  && <StatusBadge color="var(--status-success)" bg="rgba(34,197,94,0.12)"  label="Passed"  />}
      {runStatus === "failed"   && <StatusBadge color="var(--status-warning)" bg="rgba(234,179,8,0.12)"  label="Failed"  />}
      {runStatus === "error"    && <StatusBadge color="var(--status-error)"   bg="rgba(239,68,68,0.12)"  label="Error"   />}
      {running                  && <StatusBadge color="var(--status-info)"    bg="rgba(59,130,246,0.12)" label="Running" />}
      {validateStatus === "valid"   && <StatusBadge color="var(--status-success)" bg="rgba(34,197,94,0.12)"  label="Valid"   />}
      {validateStatus === "invalid" && <StatusBadge color="var(--status-warning)" bg="rgba(234,179,8,0.12)"  label="Issues"  />}
      {saveStatus === "saved"       && <StatusBadge color="var(--status-success)" bg="rgba(34,197,94,0.12)"  label="Saved"   />}
      {saveStatus === "error"       && <StatusBadge color="var(--status-error)"   bg="rgba(239,68,68,0.12)"  label="Save failed" />}

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {/* Validate */}
        <IconButton
          onClick={onValidate}
          disabled={validating}
          title="Validate graph"
          accent={
            validateStatus === "valid"   ? "var(--status-success)" :
            validateStatus === "invalid" ? "var(--status-warning)" : undefined
          }
        >
          {validating
            ? <Loader2 size={13} className="animate-spin" />
            : validateStatus === "valid"
              ? <CheckCircle2 size={13} />
              : validateStatus === "invalid"
                ? <AlertTriangle size={13} />
                : <ShieldCheck size={13} />
          }
        </IconButton>

        {/* Save */}
        <IconButton onClick={onSave} disabled={saving} title="Save flow to server">
          {saving
            ? <Loader2 size={13} className="animate-spin" />
            : saveStatus === "saved"
              ? <CheckCircle2 size={13} />
              : saveStatus === "error"
                ? <XCircle size={13} />
                : <Save size={13} />
          }
        </IconButton>

        <Divider />

        {/* Run */}
        <IconButton onClick={onRun} disabled={running} title="Run flow" primary>
          {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
        </IconButton>

        <Divider />

        {/* Density */}
        <div
          style={{
            display: "flex",
            backgroundColor: "var(--bg-tertiary)",
            border: "1px solid var(--border-color)",
            borderRadius: 6,
            padding: 2,
          }}
        >
          {DENSITY_OPTIONS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => onDensityChange(id)}
              title={`${id} density`}
              style={{
                background: density === id ? "var(--accent-primary)" : "transparent",
                border: `1px solid ${density === id ? "var(--accent-primary)" : "transparent"}`,
                color: density === id ? "white" : "var(--text-secondary)",
                padding: "4px 8px",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                borderRadius: 4,
                transition: "all 0.2s",
                lineHeight: 1,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Divider() {
  return <div style={{ width: 1, height: 20, backgroundColor: "var(--border-color)", flexShrink: 0 }} />;
}

function IconButton({
  onClick, disabled, title, primary, accent, children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  primary?: boolean;
  accent?: string;
  children: React.ReactNode;
}) {
  const bg = primary ? "var(--accent-primary)" : accent ?? "var(--bg-tertiary)";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: 32,
        height: 32,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 6,
        border: "1px solid var(--border-color)",
        backgroundColor: bg,
        color: primary || accent ? "white" : "var(--text-secondary)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "all 0.2s",
      }}
    >
      {children}
    </button>
  );
}

function StatusBadge({ color, bg, label }: { color: string; bg: string; label: string }) {
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 500,
        padding: "4px 10px",
        borderRadius: 4,
        backgroundColor: bg,
        color,
        display: "flex",
        alignItems: "center",
        gap: 5,
        whiteSpace: "nowrap",
        border: `1px solid ${color}33`,
      }}
    >
      <span style={{ fontSize: 8, lineHeight: 1 }}>●</span>
      {label}
    </span>
  );
}
