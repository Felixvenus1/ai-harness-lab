import type { JSX } from "react";
import { useState } from "react";
import { LayoutGrid, BarChart2, Eye, Settings, HelpCircle, Sun, Moon } from "lucide-react";

export type AppView = "canvas" | "evaluation" | "observability";

interface AppSidebarProps {
  view: AppView;
  onViewChange: (v: AppView) => void;
  theme: "dark" | "light";
  onThemeToggle: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
}

const VIEWS: { id: AppView; label: string; icon: JSX.Element }[] = [
  { id: "canvas", label: "Canvas", icon: <LayoutGrid size={16} /> },
  { id: "evaluation", label: "Evaluation", icon: <BarChart2 size={16} /> },
  { id: "observability", label: "Observability", icon: <Eye size={16} /> },
];

export function AppSidebar({ view, onViewChange, theme, onThemeToggle, onOpenSettings, onOpenHelp }: AppSidebarProps): JSX.Element {
  const [expanded, setExpanded] = useState(false);

  return (
    <aside
      style={{
        width: expanded ? 240 : 56,
        backgroundColor: "var(--bg-secondary)",
        borderRight: "1px solid var(--border-color)",
        display: "flex",
        flexDirection: "column",
        alignItems: expanded ? "flex-start" : "center",
        padding: expanded ? "12px" : "12px 0",
        gap: 8,
        overflowY: "auto",
        overflowX: "hidden",
        flexShrink: 0,
        transition: "width 0.2s ease",
      }}
    >
      {/* Logo / toggle */}
      <button
        onClick={() => setExpanded((e) => !e)}
        title="Toggle sidebar"
        style={{
          width: 40,
          height: 40,
          minWidth: 40,
          borderRadius: 8,
          backgroundColor: "var(--bg-tertiary)",
          border: "1px solid var(--border-color)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          fontSize: 14,
          color: "var(--accent-primary)",
          transition: "all 0.2s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--accent-primary)";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--bg-tertiary)";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--accent-primary)";
        }}
      >
        H
      </button>

      {/* Views section */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          width: "100%",
        }}
      >
        <SectionLabel label="Views" expanded={expanded} />
        {VIEWS.map(({ id, label, icon }) => (
          <NavItem
            key={id}
            icon={icon}
            label={label}
            active={view === id}
            expanded={expanded}
            onClick={() => onViewChange(id)}
          />
        ))}

        <SectionLabel label="Tools" expanded={expanded} style={{ marginTop: 16 }} />
        <NavItem icon={<Settings size={16} />} label="Settings" expanded={expanded} onClick={onOpenSettings} />
        <NavItem icon={<HelpCircle size={16} />} label="Help" expanded={expanded} onClick={onOpenHelp} />
      </div>

      {/* Theme toggle */}
      <NavItem
        icon={theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        label={theme === "dark" ? "Light mode" : "Dark mode"}
        expanded={expanded}
        onClick={onThemeToggle}
        title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      />
    </aside>
  );
}

function SectionLabel({
  label,
  expanded,
  style,
}: {
  label: string;
  expanded: boolean;
  style?: React.CSSProperties;
}): JSX.Element | null {
  if (!expanded) return null;
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        color: "var(--text-tertiary)",
        padding: "0 8px",
        marginTop: 16,
        marginBottom: 4,
        ...style,
      }}
    >
      {label}
    </div>
  );
}

function NavItem({
  icon,
  label,
  active = false,
  expanded,
  onClick,
  title,
}: {
  icon: JSX.Element;
  label: string;
  active?: boolean;
  expanded: boolean;
  onClick: () => void;
  title?: string;
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      title={expanded ? undefined : (title ?? label)}
      style={{
        width: expanded ? "100%" : 40,
        height: 40,
        minHeight: 40,
        borderRadius: 8,
        backgroundColor: active ? "var(--accent-primary)" : "transparent",
        border: `1px solid ${active ? "var(--accent-primary)" : "transparent"}`,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: expanded ? "flex-start" : "center",
        paddingLeft: expanded ? 12 : 0,
        gap: expanded ? 12 : 0,
        color: active ? "white" : "var(--text-secondary)",
        transition: "all 0.2s",
        fontSize: 13,
        fontWeight: 500,
        whiteSpace: "nowrap",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--bg-hover)";
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-color)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
          (e.currentTarget as HTMLButtonElement).style.borderColor = "transparent";
        }
      }}
    >
      <span style={{ flexShrink: 0, display: "flex" }}>{icon}</span>
      {expanded && <span>{label}</span>}
    </button>
  );
}
