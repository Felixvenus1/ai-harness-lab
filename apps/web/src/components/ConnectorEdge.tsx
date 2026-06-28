// Purpose: Custom ReactFlow edge that visualises connector routing policy with a label badge.

import type { JSX } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "reactflow";
import type { ConnectorConfig } from "../types/flow";

const RULE_COLOR: Record<string, string> = {
  always:       "#52525b",
  on_success:   "#16a34a",
  on_failure:   "#dc2626",
  on_condition: "#2563eb",
};

const RULE_LABEL: Record<string, string> = {
  always:       "",
  on_success:   "success",
  on_failure:   "failure",
  on_condition: "condition",
};

export function ConnectorEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps<ConnectorConfig>): JSX.Element {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const rule = data?.policy?.routing_rule ?? "always";
  const color = selected ? "#a78bfa" : (RULE_COLOR[rule] ?? "#52525b");
  const badge = data?.label || RULE_LABEL[rule];

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: color,
          strokeWidth: selected ? 2.5 : 1.5,
          strokeDasharray: rule === "on_condition" ? "5 3" : undefined,
        }}
        interactionWidth={12}
      />

      {badge && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "none",
              fontSize: 9,
              lineHeight: 1.2,
              zIndex: 10,
            }}
            className="nodrag nopan"
          >
            <span
              style={{
                background: color + "22",
                color,
                border: `1px solid ${color}55`,
                borderRadius: 3,
                padding: "1px 5px",
                whiteSpace: "nowrap",
                fontWeight: 600,
                letterSpacing: "0.03em",
              }}
            >
              {badge}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
