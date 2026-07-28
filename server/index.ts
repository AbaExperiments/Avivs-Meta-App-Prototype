import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3001;
const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "agents.jsonl");

// Ensure data dir and file exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, "", "utf-8");
  console.log(`[server] created ${DATA_FILE}`);
}

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

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

// In-memory cache of latest state per agent
const agents = new Map<string, AgentEvent>();

// Load existing file into memory
function loadExisting() {
  try {
    const content = fs.readFileSync(DATA_FILE, "utf-8");
    const lines = content.split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const ev = JSON.parse(line) as AgentEvent;
        agents.set(ev.id, ev);
      } catch (err) {
        console.debug("[server] skip invalid line", err);
      }
    }
    console.log(`[server] loaded ${agents.size} agents from jsonl`);
  } catch (e) {
    console.error("[server] load failed", e);
  }
}
loadExisting();

// Watch file and tail live
let lastSize = 0;
try {
  lastSize = fs.statSync(DATA_FILE).size;
} catch (err) {
  console.debug("[server] stat init", err);
}

fs.watch(DATA_FILE, async () => {
  try {
    const stat = fs.statSync(DATA_FILE);
    if (stat.size < lastSize) {
      // truncated (reset)
      lastSize = 0;
      agents.clear();
    }
    if (stat.size > lastSize) {
      const fd = fs.openSync(DATA_FILE, "r");
      const buf = Buffer.alloc(stat.size - lastSize);
      fs.readSync(fd, buf, 0, buf.length, lastSize);
      fs.closeSync(fd);
      lastSize = stat.size;
      const chunk = buf.toString("utf-8");
      const lines = chunk.split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const ev = JSON.parse(line) as AgentEvent;
          agents.set(ev.id, ev);
          io.emit("agent:update", ev);
        } catch (err) {
          console.debug("[server] skip tail line", err);
        }
      }
    }
  } catch (e) {
    console.error("[server] watch error", e);
  }
});

function appendEvent(ev: AgentEvent) {
  agents.set(ev.id, ev);
  fs.appendFileSync(DATA_FILE, JSON.stringify(ev) + "\n", "utf-8");
  io.emit("agent:update", ev);
  // keep lastSize in sync
  try {
    lastSize = fs.statSync(DATA_FILE).size;
  } catch (err) {
    console.debug("[server] stat update", err);
  }
}

// API

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, agents: agents.size });
});

app.get("/api/agents", (_req, res) => {
  res.json({ agents: Array.from(agents.values()) });
});

app.post("/api/agents", (req, res) => {
  const ev = req.body as AgentEvent;
  if (!ev.id) {
    return res.status(400).json({ error: "id required" });
  }
  // normalize
  const normalized: AgentEvent = {
    id: ev.id,
    parentId: ev.parentId ?? null,
    name: ev.name ?? ev.id,
    status: ev.status ?? "running",
    depth: ev.depth ?? 0,
    toolCalls: ev.toolCalls ?? [],
    timestamp: ev.timestamp ?? new Date().toISOString(),
    model: ev.model,
    prompt: ev.prompt,
  };
  appendEvent(normalized);
  res.json({ ok: true, event: normalized });
});

app.delete("/api/agents", (_req, res) => {
  fs.writeFileSync(DATA_FILE, "", "utf-8");
  agents.clear();
  lastSize = 0;
  io.emit("agents:clear");
  res.json({ ok: true });
});

// Simulation: 1 parent -> 3 subs -> each spawns 2 sub-subs with random tool calls every 500ms
app.post("/api/simulate", async (_req, res) => {
  res.json({ ok: true, message: "simulation started" });

  // Clear previous? No, append for history, but we can also keep existing. Let's not clear, just add.
  const now = () => new Date().toISOString();
  const randId = () => Math.random().toString(36).slice(2, 9);
  const tools = ["read", "edit", "bash", "grep", "glob", "write", "task", "webfetch"];

  const parentId = `agent_${randId()}`;
  const parent: AgentEvent = {
    id: parentId,
    parentId: null,
    name: "spark-parent",
    status: "running",
    depth: 0,
    toolCalls: [],
    timestamp: now(),
    model: "meta/muse-spark-1.1",
    prompt: "Explore codebase and implement feature",
  };
  appendEvent(parent);

  const subIds: string[] = [];
  for (let i = 0; i < 3; i++) {
    const id = `agent_${randId()}`;
    subIds.push(id);
    appendEvent({
      id,
      parentId,
      name: `sub-agent-${i + 1}`,
      status: "running",
      depth: 1,
      toolCalls: [],
      timestamp: now(),
      model: "meta/muse-spark-1.1",
      prompt: `Subtask ${i + 1}: handle part of work`,
    });
  }

  // Now each sub spawns 2 sub-subs
  const subSubIds: string[] = [];
  for (const pid of subIds) {
    for (let j = 0; j < 2; j++) {
      const id = `agent_${randId()}`;
      subSubIds.push(id);
      appendEvent({
        id,
        parentId: pid,
        name: `sub-sub-${pid.slice(-3)}-${j + 1}`,
        status: "waiting",
        depth: 2,
        toolCalls: [],
        timestamp: now(),
        model: "meta/muse-spark-1.1",
      });
    }
  }

  // Simulate tool calls streaming
  const allIds = [parentId, ...subIds, ...subSubIds];
  let ticks = 0;
  const maxTicks = 20;

  const interval = setInterval(() => {
    ticks++;
    for (const id of allIds) {
      const current = agents.get(id);
      if (!current) continue;
      if (current.status === "success" || current.status === "error") continue;

      // 30% chance to add tool call
      if (Math.random() < 0.6) {
        const tool = tools[Math.floor(Math.random() * tools.length)];
        const tc: ToolCall = {
          id: `tool_${randId()}`,
          tool,
          input: `sample input for ${tool}`,
          output: Math.random() < 0.5 ? `output from ${tool}...` : undefined,
          timestamp: now(),
          status: Math.random() < 0.9 ? "success" : "error",
        };
        const updated: AgentEvent = {
          ...current,
          toolCalls: [...current.toolCalls, tc].slice(-20), // keep last 20
          timestamp: now(),
        };
        // maybe transition to running if waiting
        if (updated.status === "waiting" && updated.toolCalls.length > 0) {
          updated.status = "running";
        }
        appendEvent(updated);
      }

      // Randomly complete agents after some ticks
      if (ticks > 5 && Math.random() < 0.15) {
        const done = agents.get(id);
        if (!done) continue;
        const finalStatus: AgentStatus = Math.random() < 0.85 ? "success" : "error";
        appendEvent({ ...done, status: finalStatus, timestamp: now() });
      }
    }

    // Also randomly make parent success when subs done
    if (ticks > 10) {
      const parentCurrent = agents.get(parentId);
      if (parentCurrent && parentCurrent.status === "running") {
        const subs = subIds.map(sid => agents.get(sid)).filter(Boolean) as AgentEvent[];
        const allDone =
          subs.length === 3 && subs.every(s => s.status === "success" || s.status === "error");
        if (allDone && Math.random() < 0.5) {
          appendEvent({ ...parentCurrent, status: "success", timestamp: now() });
        }
      }
    }

    if (ticks >= maxTicks) {
      clearInterval(interval);
      // finalize any still running
      for (const id of allIds) {
        const cur = agents.get(id);
        if (cur && cur.status === "running") {
          appendEvent({ ...cur, status: "success", timestamp: now() });
        }
        if (cur && cur.status === "waiting") {
          appendEvent({ ...cur, status: "success", timestamp: now() });
        }
      }
      io.emit("simulate:done", { id: parentId });
      console.log(`[simulate] done parent ${parentId}`);
    }
  }, 500);
});

io.on("connection", socket => {
  console.log(`[socket] client connected ${socket.id}`);
  // Send current snapshot
  socket.emit("agents:snapshot", Array.from(agents.values()));
  socket.on("disconnect", () => {
    console.log(`[socket] client disconnected ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[Spark Scope] server listening on http://localhost:${PORT}`);
  console.log(`[Spark Scope] data file: ${DATA_FILE}`);
});
