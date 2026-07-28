import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import type { AgentEvent } from "../types";

type AgentNodeData = {
  agent: AgentEvent;
  isSelected?: boolean;
  [key: string]: unknown;
};

function statusColor(status: AgentEvent["status"]) {
  switch (status) {
    case "running":
      return "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]";
    case "success":
      return "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]";
    case "error":
      return "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]";
    case "waiting":
      return "bg-zinc-500";
    default:
      return "bg-zinc-400";
  }
}

function statusText(status: AgentEvent["status"]) {
  switch (status) {
    case "running":
      return "RUN";
    case "success":
      return "OK";
    case "error":
      return "ERR";
    case "waiting":
      return "WAIT";
    default:
      return (status as string).toUpperCase();
  }
}

export const AgentNode = memo(({ data }: NodeProps) => {
  const { agent, isSelected } = data as AgentNodeData;
  const toolCount = agent.toolCalls.length;

  return (
    <div
      className={`
        group relative min-w-[200px] rounded-[10px] border backdrop-blur
        px-3 py-2.5 font-mono text-[12px] leading-tight
        transition-all duration-200
        ${isSelected ? "border-violet-400 bg-zinc-900/90 shadow-[0_0_0_2px_rgba(167,139,250,0.4),0_4px_20px_rgba(0,0,0,0.8)]" : "border-zinc-700 bg-zinc-900/70 hover:border-zinc-600 hover:bg-zinc-900/90"}
      `}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 truncate">
          <span className={`h-2.5 w-2.5 rounded-full ${statusColor(agent.status)}`} />
          <span className="truncate font-semibold text-zinc-100">{agent.name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
            D{agent.depth}
          </span>
          <span
            className={`rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider ${agent.status === "running" ? "bg-amber-500/20 text-amber-300" : agent.status === "success" ? "bg-emerald-500/20 text-emerald-300" : agent.status === "error" ? "bg-red-500/20 text-red-300" : "bg-zinc-700 text-zinc-400"}`}
          >
            {statusText(agent.status)}
          </span>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] text-zinc-500">
          {agent.id.slice(0, 8)} • {agent.model?.split("/").pop() ?? "spark"}
        </span>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-zinc-400">{toolCount} tools</span>
          {toolCount > 0 && <span className="h-1 w-1 rounded-full bg-zinc-600" />}
          <span className="text-[10px] text-zinc-500">
            {new Date(agent.timestamp).toLocaleTimeString()}
          </span>
        </div>
      </div>

      {toolCount > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {agent.toolCalls.slice(-4).map(tc => (
            <span
              key={tc.id}
              className={`rounded px-1 py-0.5 text-[9px] ${tc.status === "error" ? "bg-red-900/40 text-red-300" : "bg-zinc-800 text-zinc-300"}`}
            >
              {tc.tool}
            </span>
          ))}
          {toolCount > 4 && <span className="text-[9px] text-zinc-500">+{toolCount - 4}</span>}
        </div>
      )}

      {/* handles for React Flow */}
      <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-zinc-600 opacity-0 group-hover:opacity-100" />
      <div className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-zinc-600 opacity-0 group-hover:opacity-100" />
    </div>
  );
});

AgentNode.displayName = "AgentNode";
