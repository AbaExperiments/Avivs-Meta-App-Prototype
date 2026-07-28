import { useMemo, useState, useCallback, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
  Panel,
  MiniMap,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useSocket } from "./hooks/useSocket";
import { AgentNode } from "./components/AgentNode";
import type { AgentEvent } from "./types";

const nodeTypes = { agent: AgentNode };

function layoutTree(agents: Map<string, AgentEvent>): { nodes: Node[]; edges: Edge[] } {
  const list = Array.from(agents.values());
  if (list.length === 0) return { nodes: [], edges: [] };

  // group by depth and parent
  const byParent = new Map<string | null, AgentEvent[]>();
  for (const a of list) {
    const key = a.parentId;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(a);
  }

  // sort each group by timestamp for stability
  for (const [, group] of byParent) {
    group.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  // BFS layout: assign x,y by depth levels
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const LEVEL_Y = 160;
  const NODE_W = 240;
  const GAP_X = 40;

  // compute positions per depth
  const depths = new Map<number, AgentEvent[]>();
  for (const a of list) {
    if (!depths.has(a.depth)) depths.set(a.depth, []);
    depths.get(a.depth)!.push(a);
  }

  const depthKeys = Array.from(depths.keys()).sort((a, b) => a - b);

  for (const depth of depthKeys) {
    const levelAgents = depths.get(depth)!.sort((a, b) => {
      // sort by parentId then timestamp for grouping
      if (a.parentId !== b.parentId) return (a.parentId ?? "").localeCompare(b.parentId ?? "");
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });

    // center align each level
    const totalWidth = levelAgents.length * NODE_W + (levelAgents.length - 1) * GAP_X;
    const startX = -totalWidth / 2;

    levelAgents.forEach((agent, idx) => {
      const x = startX + idx * (NODE_W + GAP_X);
      const y = depth * LEVEL_Y;

      nodes.push({
        id: agent.id,
        type: "agent",
        position: { x, y },
        data: { agent },
        draggable: true,
      });

      if (agent.parentId) {
        edges.push({
          id: `${agent.parentId}->${agent.id}`,
          source: agent.parentId,
          target: agent.id,
          type: "smoothstep",
          animated: agent.status === "running",
          style: {
            stroke:
              agent.status === "error"
                ? "#ef4444"
                : agent.status === "success"
                  ? "#10b981"
                  : "#a1a1aa",
            strokeWidth: 1.5,
            opacity: 0.7,
          },
        });
      }
    });
  }

  return { nodes, edges };
}

export default function App() {
  const { agents, connected, log, clear, simulate } = useSocket();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);
  const [showAllLogs, setShowAllLogs] = useState(true);

  // Layout whenever agents change
  useEffect(() => {
    const { nodes: layoutNodes, edges: layoutEdges } = layoutTree(agents);

    // preserve selected state
    const enriched = layoutNodes.map(n => ({
      ...n,
      data: { ...n.data, isSelected: n.id === selectedId },
    }));

    setNodes(enriched as unknown as Node[]);
    setEdges(layoutEdges as unknown as Edge[]);
  }, [agents, selectedId, setNodes, setEdges]);

  const selectedAgent = useMemo(() => {
    if (!selectedId) return null;
    return agents.get(selectedId) ?? null;
  }, [selectedId, agents]);

  const stats = useMemo(() => {
    const all = Array.from(agents.values());
    return {
      total: all.length,
      running: all.filter(a => a.status === "running").length,
      success: all.filter(a => a.status === "success").length,
      error: all.filter(a => a.status === "error").length,
      waiting: all.filter(a => a.status === "waiting").length,
      maxDepth: Math.max(0, ...all.map(a => a.depth)),
    };
  }, [agents]);

  const onNodeClick = useCallback((_: unknown, node: Node) => {
    setSelectedId(node.id);
  }, []);

  const handleSimulate = async () => {
    await simulate();
  };

  const handleClear = async () => {
    await clear();
    setSelectedId(null);
  };

  return (
    <div className="flex h-screen w-screen flex-col bg-[#0a0a0a] font-mono text-zinc-100 selection:bg-violet-500/30">
      {/* Header */}
      <header className="flex h-[56px] shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-5 backdrop-blur">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 font-bold text-white shadow-[0_0_12px_rgba(124,58,237,0.5)]">
              ◈
            </div>
            <div>
              <h1 className="font-[Geist] text-[15px] font-semibold leading-none tracking-tight">
                SPARK SCOPE
              </h1>
              <p className="mt-0.5 text-[10px] tracking-[0.2em] text-zinc-500">
                AGENT ACTIVITY VIEWER • V1
              </p>
            </div>
          </div>
          <div className="ml-6 hidden items-center gap-2 md:flex">
            <div
              className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" : "bg-red-500"}`}
            />
            <span className="text-[11px] text-zinc-400">
              {connected ? "LIVE • :3001" : "OFFLINE"}
            </span>
            <span className="ml-3 text-[11px] text-zinc-600">|</span>
            <span className="ml-3 text-[11px] text-zinc-300">{stats.total} agents</span>
            <span className="text-[10px] text-amber-300">{stats.running} run</span>
            <span className="text-[10px] text-emerald-300">{stats.success} ok</span>
            <span className="text-[10px] text-red-400">{stats.error} err</span>
            <span className="text-[10px] text-zinc-500">{stats.waiting} wait</span>
            <span className="ml-2 text-[10px] text-zinc-500">depth {stats.maxDepth}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSimulate}
            className="rounded-md bg-violet-600 px-3.5 py-1.5 text-[12px] font-medium text-white transition hover:bg-violet-500 active:bg-violet-700 shadow-[0_0_10px_rgba(124,58,237,0.4)]"
          >
            ▶ SIMULATE
          </button>
          <button
            onClick={handleClear}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-[12px] text-zinc-300 transition hover:bg-zinc-700 hover:text-zinc-100"
          >
            CLEAR
          </button>
          <a
            href="https://github.com-abaexperiments/AbaExperiments/Avivs-Meta-App-Prototype"
            target="_blank"
            rel="noreferrer"
            className="ml-2 hidden text-[11px] text-zinc-500 hover:text-zinc-300 md:block"
          >
            GitHub →
          </a>
        </div>
      </header>

      {/* Main split */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: React Flow tree */}
        <div className="relative flex-1 border-r border-zinc-800 bg-[#0d0d0f]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2, maxZoom: 1.2 }}
            minZoom={0.1}
            maxZoom={1.5}
            proOptions={{ hideAttribution: true }}
            className="bg-[#0a0a0a]"
          >
            <Background color="#222" gap={20} size={1} />
            <Controls className="!bg-zinc-900 !border-zinc-700 [&>button]:!border-zinc-700 [&>button]:!bg-zinc-900 [&>button]:!text-zinc-400 hover:[&>button]:!bg-zinc-800" />
            <MiniMap
              className="!bg-zinc-900 !border-zinc-800"
              nodeColor={n => {
                const data = n.data as { agent?: AgentEvent } | undefined;
                const agent = data?.agent;
                if (!agent) return "#333";
                if (agent.status === "success") return "#10b981";
                if (agent.status === "error") return "#ef4444";
                if (agent.status === "running") return "#fbbf24";
                return "#52525b";
              }}
              maskColor="rgba(0,0,0,0.7)"
            />
            <Panel
              position="bottom-left"
              className="!m-3 rounded-md border border-zinc-800 bg-zinc-900/80 px-2.5 py-1.5 text-[10px] text-zinc-500 backdrop-blur"
            >
              Drag • Zoom • Click node → inspect
            </Panel>
          </ReactFlow>

          {agents.size === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="font-[Geist] text-[13px] text-zinc-500">
                  No agents yet — hit SIMULATE
                </p>
                <p className="mt-1 text-[11px] text-zinc-600">
                  POST /api/simulate spawns 1 → 3 → 6 agents with live tool calls
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right: log + detail */}
        <div className="flex w-[420px] shrink-0 flex-col bg-[#101013] max-lg:w-[380px] max-md:hidden">
          {/* Toggle */}
          <div className="flex border-b border-zinc-800">
            <button
              onClick={() => setShowAllLogs(true)}
              className={`flex-1 px-3 py-2.5 text-[11px] font-medium tracking-wider transition ${showAllLogs ? "bg-zinc-800 text-zinc-100 border-b-2 border-violet-500" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"}`}
            >
              LIVE LOG ({log.length})
            </button>
            <button
              onClick={() => setShowAllLogs(false)}
              className={`flex-1 px-3 py-2.5 text-[11px] font-medium tracking-wider transition ${!showAllLogs ? "bg-zinc-800 text-zinc-100 border-b-2 border-violet-500" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"}`}
            >
              DETAIL {selectedAgent ? `• ${selectedAgent.name}` : ""}
            </button>
          </div>

          {showAllLogs ? (
            <div className="flex-1 overflow-y-auto p-0 font-mono text-[11px] leading-[1.5]">
              <div className="sticky top-0 z-10 border-b border-zinc-800 bg-[#101013]/90 p-2 backdrop-blur">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] tracking-widest text-zinc-500">
                    STREAMING EVENT LOG
                  </span>
                  <span className="text-[10px] text-zinc-600">
                    {connected ? "● live" : "○ offline"}
                  </span>
                </div>
              </div>
              <div className="divide-y divide-zinc-900/50">
                {log.map((line, i) => (
                  <div
                    key={i}
                    className="px-3 py-1.5 text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200"
                  >
                    <span className="text-zinc-600">{line.slice(0, 12)}</span>
                    <span className="ml-1">{line.slice(12)}</span>
                  </div>
                ))}
                {log.length === 0 && (
                  <div className="p-4 text-center text-zinc-600">
                    Waiting for events… run SIMULATE or POST /api/agents
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {selectedAgent ? (
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-[Geist] text-[14px] font-semibold text-zinc-100">
                        {selectedAgent.name}
                      </h3>
                      <p className="mt-0.5 text-[11px] text-zinc-500">{selectedAgent.id}</p>
                    </div>
                    <span
                      className={`rounded px-2 py-1 text-[10px] font-bold tracking-wider ${selectedAgent.status === "running" ? "bg-amber-500/20 text-amber-300" : selectedAgent.status === "success" ? "bg-emerald-500/20 text-emerald-300" : selectedAgent.status === "error" ? "bg-red-500/20 text-red-300" : "bg-zinc-700 text-zinc-400"}`}
                    >
                      {selectedAgent.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded bg-zinc-900 p-2">
                      <div className="text-[10px] text-zinc-500">DEPTH</div>
                      <div className="mt-1 text-zinc-200">{selectedAgent.depth}</div>
                    </div>
                    <div className="rounded bg-zinc-900 p-2">
                      <div className="text-[10px] text-zinc-500">PARENT</div>
                      <div className="mt-1 truncate text-zinc-200">
                        {selectedAgent.parentId ?? "ROOT"}
                      </div>
                    </div>
                    <div className="rounded bg-zinc-900 p-2">
                      <div className="text-[10px] text-zinc-500">MODEL</div>
                      <div className="mt-1 text-zinc-200">{selectedAgent.model ?? "—"}</div>
                    </div>
                    <div className="rounded bg-zinc-900 p-2">
                      <div className="text-[10px] text-zinc-500">TOOLS</div>
                      <div className="mt-1 text-zinc-200">{selectedAgent.toolCalls.length}</div>
                    </div>
                  </div>

                  {selectedAgent.prompt && (
                    <div className="mt-4">
                      <div className="text-[10px] tracking-widest text-zinc-500">PROMPT</div>
                      <div className="mt-1 rounded bg-zinc-900 p-2.5 text-[11px] leading-relaxed text-zinc-300">
                        {selectedAgent.prompt}
                      </div>
                    </div>
                  )}

                  <div className="mt-4">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] tracking-widest text-zinc-500">
                        TOOL HISTORY ({selectedAgent.toolCalls.length})
                      </div>
                      <div className="text-[10px] text-zinc-600">
                        {new Date(selectedAgent.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <div className="mt-2 space-y-2">
                      {selectedAgent.toolCalls
                        .slice()
                        .reverse()
                        .map(tc => (
                          <div
                            key={tc.id}
                            className="rounded border border-zinc-800 bg-zinc-900/60 p-2.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-2">
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${tc.status === "success" ? "bg-emerald-400" : tc.status === "error" ? "bg-red-500" : "bg-amber-400"}`}
                                />
                                <span className="font-medium text-zinc-200">{tc.tool}</span>
                                <span className="text-[10px] text-zinc-500">
                                  {new Date(tc.timestamp).toLocaleTimeString()}
                                </span>
                              </span>
                              <span
                                className={`text-[9px] ${tc.status === "error" ? "text-red-400" : "text-zinc-500"}`}
                              >
                                {tc.status}
                              </span>
                            </div>
                            {tc.input && (
                              <div className="mt-1.5 rounded bg-black/50 px-2 py-1 text-[10px] text-zinc-400">
                                in: {tc.input}
                              </div>
                            )}
                            {tc.output && (
                              <div className="mt-1 rounded bg-zinc-800/50 px-2 py-1 text-[10px] text-zinc-300">
                                out: {tc.output}
                              </div>
                            )}
                          </div>
                        ))}
                      {selectedAgent.toolCalls.length === 0 && (
                        <div className="rounded bg-zinc-900 p-3 text-center text-[11px] text-zinc-600">
                          No tool calls yet
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 rounded border border-zinc-800 bg-black/40 p-2.5">
                    <div className="text-[10px] text-zinc-500">RAW JSON</div>
                    <pre className="mt-1 max-h-[200px] overflow-auto text-[10px] leading-relaxed text-zinc-400">
                      {JSON.stringify(selectedAgent, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center p-8 text-center">
                  <div>
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-600">
                      ◍
                    </div>
                    <p className="mt-3 text-[12px] text-zinc-500">Select a node to inspect</p>
                    <p className="mt-1 text-[11px] text-zinc-600">
                      Click any agent in the tree → full history, tools, prompt
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer hint */}
          <div className="border-t border-zinc-800 bg-zinc-900/50 px-3 py-2 text-[10px] text-zinc-600">
            <span className="text-zinc-500">Tip:</span> In v2 this will auto-wire to OpenCode's real
            agent events via plugin. For now{" "}
            <code className="rounded bg-zinc-800 px-1 py-0.5 text-zinc-400">
              POST /api/simulate
            </code>{" "}
            or <code className="rounded bg-zinc-800 px-1 py-0.5 text-zinc-400">/api/agents</code>
          </div>
        </div>
      </div>
    </div>
  );
}
