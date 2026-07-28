# AGENTS.md — Spark Scope v1

This is a test lab for Muse Spark. You can create/edit files, run builds/tests, use git.

## Now: Spark Scope — Agent Activity Viewer

v1 foundation: Vite + React + React Flow + Express + Socket.io real-time dashboard showing every agent, sub-agent, sub-sub-agent via parentId tree + live log.

### How to run

- `npm install`
- `npm run dev` — concurrently runs vite (5173) + server (3001) via tsx
- `npm run server` — just server
- `npm run simulate` — POST /api/simulate to spawn 1 → 3 → 6 agents with random tool calls every 500ms
- `npm run build` — tsc --noEmit + vite build
- `npm run test` — vitest harness
- `npm run lint` — eslint + prettier

### Structure

- `server/index.ts` — Express + Socket.io, watches ./data/agents.jsonl, emits agent:update, endpoints /api/agents, /api/simulate
- `data/agents.jsonl` — live tailed file, created if missing
- `src/App.tsx` — 2 panels: left React Flow tree auto-layout by depth, right live log + detail view
- `src/hooks/useSocket.ts` — connects to localhost:3001, merges events
- `src/components/AgentNode.tsx` — name, status dot (green/yellow/red), tool count, depth badge, click for history
- `src/index.ts` — legacy entry kept (`Muse Spark 1.1 lab ready`)
- `src/examples/hello.ts` / `game.ts` — placeholders

### Styling

Dark mode, terminal vibe, monospace (JetBrains Mono), high contrast for streaming logs. Tailwind v4 via @tailwindcss/vite.

### v2 Goal

Wire to real OpenCode agent events via opencode plugin — hook into agent lifecycle and write to data/agents.jsonl.

### Lab Rules

- Feel free to create new files in `src/` and `src/examples/`
- Use git — commit as you experiment
- Keep minimal but polished; this is foundation for v2 plugin wiring
- META_API_KEY env required for real Spark runs via OpenCode Desktop (see README + opencode.json)
