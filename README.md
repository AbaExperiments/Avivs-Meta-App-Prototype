# Spark Scope — Agent Activity Viewer (v1)

Real-time dashboard for **Muse Spark 1.1** showing every agent, sub-agent, and sub-sub-agent as a live tree.

Built with **Vite + React + TypeScript + Tailwind + React Flow + Express + Socket.io**

![Spark Scope](https://img.shields.io/badge/Spark%20Scope-v1-violet?style=flat-square) ![Stack](https://img.shields.io/badge/stack-Vite%20%2B%20React%20Flow%20%2B%20Socket.io-000?style=flat-square)

## Quick Start

Requires `META_API_KEY` for Spark model (OpenCode provider), but v1 simulation runs without it.

```bash
git clone git@github.com-abaexperiments:AbaExperiments/Avivs-Meta-App-Prototype.git
cd Avivs-Meta-App-Prototype
export META_API_KEY="your-key"   # for OpenCode Desktop
npm install
npm run dev        # concurrently runs vite:5173 + server:3001
```

Open:

- Client: http://localhost:5173
- Server: http://localhost:3001/api/health

## What v1 Does

- **Agent Tree (React Flow)**: auto-layout by depth, parentId relationships, animated edges for running agents
- **AgentNode**: status dot (green/yellow/red), depth badge, tool count, last 4 tools, model hint
- **Live Log + Detail Panel**: click node → full history, prompts, tool calls, raw JSON
- **Terminal vibe**: dark mode, monospace JetBrains Mono, high-contrast, legible streaming logs
- **WebSocket real-time**: Socket.io `agent:update` events merged live
- **JSONL tap**: watches `./data/agents.jsonl` and tails it live (foundation for OpenCode plugin in v2)

### Simulation (no OpenCode needed)

`POST /api/simulate` spawns:

```
1 parent (spark-parent)
 └─ 3 subs (sub-agent-1..3)
     └─ each 2 sub-subs = 6 leaf agents
Total: 10 agents with random tool calls every 500ms
```

```bash
npm run simulate
# or
curl -X POST http://localhost:3001/api/simulate
```

## Scripts

| Command                                 | What it does                                      |
| --------------------------------------- | ------------------------------------------------- |
| `npm run dev`                           | concurrently: vite client + `tsx server/index.ts` |
| `npm run dev:client`                    | vite only (5173)                                  |
| `npm run dev:server` / `npm run server` | express + socket.io (3001)                        |
| `npm run simulate`                      | curl POST /api/simulate                           |
| `npm run build`                         | tsc --noEmit + vite build                         |
| `npm run test`                          | vitest (harness tests)                            |
| `npm run lint`                          | eslint + prettier                                 |

## API

- `GET /api/health` → `{ok, agents}`
- `GET /api/agents` → `{agents: AgentEvent[]}`
- `POST /api/agents` → add single event `{id, parentId, name, status, depth, toolCalls[], timestamp, model, prompt}`
- `DELETE /api/agents` → clear all + truncate jsonl
- `POST /api/simulate` → start simulation

### Socket.io Events

- Server → Client `agents:snapshot` full dump on connect
- Server → Client `agent:update` single AgentEvent (upsert)
- Server → Client `agents:clear`
- Server → Client `simulate:done`

### AgentEvent Schema

```ts
type AgentEvent = {
  id: string;
  parentId: string | null;
  name: string;
  status: "running" | "success" | "error" | "waiting";
  depth: number;
  toolCalls: { id; tool; input?; output?; timestamp; status }[];
  timestamp: string;
  model?: string;
  prompt?: string;
};
```

## Project Structure

```
.
├── opencode.json         # Meta provider: meta/muse-spark-1.1 (1M context)
├── server/
│   └── index.ts          # Express 3001 + Socket.io + JSONL tail + /api/* + simulate
├── data/
│   └── agents.jsonl      # watched file (empty committed, live appended)
├── src/
│   ├── main.tsx          # Vite entry
│   ├── App.tsx           # 2 panels: Flow tree left, log/detail right
│   ├── index.css         # Tailwind v4 + terminal theme
│   ├── types.ts          # AgentEvent types
│   ├── hooks/useSocket.ts# socket + merge + clear/simulate
│   ├── components/AgentNode.tsx
│   ├── index.ts          # legacy lab entry (kept)
│   ├── examples/hello.ts / game.ts (placeholders)
│   └── index.test.ts
├── index.html
├── vite.config.ts        # react + tailwindcss plugins + vitest jsdom
└── AGENTS.md
```

## OpenCode Desktop + Spark

`opencode.json` is pre-configured:

```json
{
  "provider": {
    "meta": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Meta Model API",
      "options": {
        "baseURL": "https://api.meta.ai/v1",
        "headers": { "Authorization": "Bearer ${env:META_API_KEY}" }
      },
      "models": {
        "meta/muse-spark-1.1": {
          "name": "Muse Spark 1.1",
          "limit": { "context": 1048576, "output": 131072 }
        }
      }
    }
  }
}
```

1. Open folder in OpenCode Desktop
2. Ensure `META_API_KEY` set
3. Select `meta/muse-spark-1.1`
4. Prompt — lab has full file/edit/build/test/git access

## v2 Roadmap

- OpenCode plugin that writes real agent events to `data/agents.jsonl`
- Hook into `@opencode` agent lifecycle (onAgentStart, onToolCall, onAgentEnd)
- Parent/child correlation from real `task` tool invocations
- Search/filter, timeline scrubbing, tool output streaming
- Persisted sessions + replay

## Lab Rules (AGENTS.md)

- You can create/edit files in `src/` and `src/examples/`
- `npm run build` to type-check, `npm run test` to verify
- `npm run dev` for Spark Scope (client+server)
- Git available — commit as you experiment
