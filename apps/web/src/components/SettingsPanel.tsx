import { useState, type JSX } from "react";
import { X, Server, Palette, Info } from "lucide-react";

const STORAGE_KEY = "ahl_api_base";

function getStoredBase(): string {
  return (
    localStorage.getItem(STORAGE_KEY) ||
    (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
    "/api"
  );
}

export function getApiBase(): string {
  return getStoredBase();
}

interface SettingsPanelProps {
  theme: "dark" | "light";
  onThemeChange: (t: "dark" | "light") => void;
  onClose: () => void;
}

export function SettingsPanel({ theme, onThemeChange, onClose }: SettingsPanelProps): JSX.Element {
  const [apiBase, setApiBase] = useState(getStoredBase);
  const [saved, setSaved] = useState(false);

  function saveApiBase() {
    const trimmed = apiBase.trim() || "/api";
    localStorage.setItem(STORAGE_KEY, trimmed);
    setApiBase(trimmed);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <Backdrop onClose={onClose}>
      <div
        style={{
          backgroundColor: "var(--bg-secondary)",
          border: "1px solid var(--border-color)",
          borderRadius: 10,
          width: 440,
          maxWidth: "calc(100vw - 48px)",
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
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", flex: 1 }}>
            Settings
          </span>
          <button onClick={onClose} style={ghostIconBtn}>
            <X size={15} />
          </button>
        </div>

        <div style={{ padding: "20px 18px", display: "flex", flexDirection: "column", gap: 24 }}>
          {/* API section */}
          <Section icon={<Server size={14} />} title="API">
            <Label>Base URL</Label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={apiBase}
                onChange={(e) => { setApiBase(e.target.value); setSaved(false); }}
                onKeyDown={(e) => e.key === "Enter" && saveApiBase()}
                placeholder="/api"
                style={inputStyle}
              />
              <button
                onClick={saveApiBase}
                style={{
                  ...btnBase,
                  backgroundColor: saved ? "rgba(22,163,74,0.15)" : "var(--bg-tertiary)",
                  color: saved ? "var(--accent-primary)" : "var(--text-primary)",
                  border: `1px solid ${saved ? "var(--accent-primary)" : "var(--border-color)"}`,
                  minWidth: 60,
                }}
              >
                {saved ? "Saved" : "Save"}
              </button>
            </div>
            <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
              Persisted in localStorage. Reload the page after changing.
            </p>
          </Section>

          {/* Appearance section */}
          <Section icon={<Palette size={14} />} title="Appearance">
            <Label>Theme</Label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["dark", "light"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => onThemeChange(t)}
                  style={{
                    ...btnBase,
                    flex: 1,
                    backgroundColor: theme === t ? "var(--accent-primary)" : "var(--bg-tertiary)",
                    color: theme === t ? "white" : "var(--text-secondary)",
                    border: `1px solid ${theme === t ? "var(--accent-primary)" : "var(--border-color)"}`,
                  }}
                >
                  {t === "dark" ? "🌙 Dark" : "☀️ Light"}
                </button>
              ))}
            </div>
          </Section>

          {/* About section */}
          <Section icon={<Info size={14} />} title="About">
            <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              <strong style={{ color: "var(--text-primary)" }}>AI Harness Lab</strong>
              <br />
              A visual editor for building and testing LLM flow graphs.
              <br />
              Stack: React + Vite + ReactFlow · FastAPI · Python
            </p>
          </Section>
        </div>
      </div>
    </Backdrop>
  );
}

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
        <span style={{ color: "var(--accent-primary)" }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text-tertiary)" }}>
          {title}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {children}
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>
      {children}
    </span>
  );
}

export function Backdrop({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}): JSX.Element {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(2px)",
      }}
    >
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  backgroundColor: "var(--bg-tertiary)",
  border: "1px solid var(--border-color)",
  borderRadius: 6,
  color: "var(--text-primary)",
  fontSize: 13,
  padding: "7px 10px",
  outline: "none",
  fontFamily: "monospace",
};

const btnBase: React.CSSProperties = {
  padding: "7px 14px",
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
  transition: "all 0.15s",
  border: "1px solid var(--border-color)",
};

const ghostIconBtn: React.CSSProperties = {
  width: 28,
  height: 28,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  border: "none",
  color: "var(--text-tertiary)",
  cursor: "pointer",
  borderRadius: 6,
};
