import { useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type { AgentEvent } from "../types";

const SERVER_URL = "http://localhost:3001";

export function useSocket() {
  const [agents, setAgents] = useState<Map<string, AgentEvent>>(new Map());
  const [connected, setConnected] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const socketRef = useRef<Socket | null>(null);

  const pushLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString();
    setLog(prev => [`[${ts}] ${msg}`, ...prev].slice(0, 200));
  }, []);

  useEffect(() => {
    const socket = io(SERVER_URL, {
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      pushLog(`connected → ${SERVER_URL} id=${socket.id}`);
    });

    socket.on("disconnect", () => {
      setConnected(false);
      pushLog("disconnected from server");
    });

    socket.on("agents:snapshot", (snapshot: AgentEvent[]) => {
      const map = new Map<string, AgentEvent>();
      snapshot.forEach(ev => map.set(ev.id, ev));
      setAgents(map);
      pushLog(`snapshot loaded ${snapshot.length} agents`);
    });

    socket.on("agent:update", (ev: AgentEvent) => {
      setAgents(prev => {
        const next = new Map(prev);
        next.set(ev.id, ev);
        return next;
      });
      pushLog(
        `update ${ev.name} (${ev.id.slice(0, 6)}) → ${ev.status} +${ev.toolCalls.length} tools`
      );
    });

    socket.on("agents:clear", () => {
      setAgents(new Map());
      pushLog("all agents cleared");
    });

    socket.on("simulate:done", (data: { id: string }) => {
      pushLog(`simulation complete parent=${data.id}`);
    });

    return () => {
      socket.disconnect();
    };
  }, [pushLog]);

  const clear = useCallback(async () => {
    await fetch(`${SERVER_URL}/api/agents`, { method: "DELETE" });
  }, []);

  const simulate = useCallback(async () => {
    const res = await fetch(`${SERVER_URL}/api/simulate`, { method: "POST" });
    const data = await res.json();
    pushLog(`simulate trigger → ${JSON.stringify(data)}`);
    return data;
  }, [pushLog]);

  return { agents, connected, log, clear, simulate, socket: socketRef.current };
}
