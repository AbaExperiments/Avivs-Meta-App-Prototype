export type AgentStatus = "running" | "success" | "error" | "waiting";

export type ToolCall = {
  id: string;
  tool: string;
  input?: string;
  output?: string;
  timestamp: string;
  status: AgentStatus;
};

export type AgentEvent = {
  id: string;
  parentId: string | null;
  name: string;
  status: AgentStatus;
  depth: number;
  toolCalls: ToolCall[];
  timestamp: string;
  model?: string;
  prompt?: string;
};
