// Purpose: Render the top navigation bar with flow name, initial input, and run controls.

import type { JSX } from "react";
import { Play, Loader2 } from "lucide-react";
import type { RunStatus } from "../hooks/useExecutionTrace";

interface TopBarProps {
  flowName: string;
  onFlowNameChange: (name: string) => void;
  initialInput: string;
  onInitialInputChange: (v: string) => void;
  onRun: () => void;
  runStatus: RunStatus;
}

export function TopBar({
  flowName,
  onFlowNameChange,
  initialInput,
  onInitialInputChange,
  onRun,
  runStatus,
}: TopBarProps): JSX.Element {
  const running = runStatus === "running";

  return (
    <header className="flex items-center gap-3 px-4 h-12 bg-zinc-900 border-b border-zinc-800 shrink-0">
      {/* Logo */}
      <span className="text-teal-400 font-semibold text-sm tracking-wide whitespace-nowrap">
        AI Harness Lab
      </span>
      <div className="w-px h-4 bg-zinc-700" />

      {/* Flow name */}
      <input
        value={flowName}
        onChange={(e) => onFlowNameChange(e.target.value)}
        className="bg-transparent text-zinc-200 text-sm font-medium w-44 outline-none border-b border-transparent hover:border-zinc-600 focus:border-teal-500 transition-colors"
        spellCheck={false}
        aria-label="Flow name"
      />

      {/* Initial input */}
      <div className="flex items-center gap-2 flex-1 max-w-sm">
        <span className="text-zinc-500 text-xs whitespace-nowrap">Input →</span>
        <input
          value={initialInput}
          onChange={(e) => onInitialInputChange(e.target.value)}
          placeholder="Initial input value…"
          className="flex-1 bg-zinc-800 text-zinc-200 text-xs rounded px-2 py-1 border border-zinc-700 outline-none focus:border-teal-500 transition-colors"
          aria-label="Initial flow input"
        />
      </div>

      <div className="flex-1" />

      {/* Status badge */}
      {runStatus === "success" && (
        <span className="text-xs text-emerald-400 tabular-nums">● Passed</span>
      )}
      {runStatus === "error" && (
        <span className="text-xs text-red-400 tabular-nums">● Error</span>
      )}

      {/* Run button */}
      <button
        type="button"
        onClick={onRun}
        disabled={running}
        className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5 rounded transition-colors cursor-pointer disabled:cursor-not-allowed"
      >
        {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
        Run
      </button>
    </header>
  );
}
