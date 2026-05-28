import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type ChatRole = "user" | "assistant";
export type ChatMessage = { role: ChatRole; content: string };

export type ExtractedTask = {
  has_task: boolean;
  title: string;
  due_date: string | null;
  description: string | null;
};

type ChatStreamEvent =
  | { type: "delta"; text: string }
  | { type: "task"; task: ExtractedTask }
  | { type: "done" }
  | { type: "error"; message: string };

const LS_CHAT = "chat_history";

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function encodeSseValue(value: string) {
  return value.replace(/\r/g, "");
}

function parseSseChunk(buffer: string): { events: ChatStreamEvent[]; rest: string } {
  const events: ChatStreamEvent[] = [];
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";

  for (const part of parts) {
    const lines = part.split("\n");
    let eventType = "message";
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith("event:")) eventType = line.slice("event:".length).trim();
      if (line.startsWith("data:")) dataLines.push(line.slice("data:".length).trimStart());
    }

    const data = dataLines.join("\n");
    if (!data) continue;

    try {
      if (eventType === "delta") events.push({ type: "delta", text: data });
      else if (eventType === "task") events.push({ type: "task", task: JSON.parse(data) as ExtractedTask });
      else if (eventType === "done") events.push({ type: "done" });
      else if (eventType === "error") events.push({ type: "error", message: data });
    } catch {
      // ignore malformed event payloads
    }
  }

  return { events, rest };
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(
    () => safeJsonParse<ChatMessage[]>(localStorage.getItem(LS_CHAT)) ?? []
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastExtractedTask, setLastExtractedTask] = useState<ExtractedTask | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    localStorage.setItem(LS_CHAT, JSON.stringify(messages));
  }, [messages]);

  const clearAll = useCallback(() => {
    localStorage.removeItem(LS_CHAT);
    setMessages([]);
    setLastExtractedTask(null);
    setError(null);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const message = text.trim();
    if (!message) return;

    setError(null);
    setLastExtractedTask(null);
    setIsStreaming(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setMessages((prev) => [...prev, { role: "user", content: message }, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
        signal: controller.signal
      });

      if (!res.ok || !res.body) {
        const body = await res.text().catch(() => "");
        throw new Error(body || `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parsed = parseSseChunk(buffer);
        buffer = parsed.rest;

        for (const ev of parsed.events) {
          if (ev.type === "delta") {
            const delta = encodeSseValue(ev.text);
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (!last || last.role !== "assistant") return next;
              next[next.length - 1] = { ...last, content: last.content + delta };
              return next;
            });
          } else if (ev.type === "task") {
            setLastExtractedTask(ev.task);
          } else if (ev.type === "error") {
            setError(ev.message);
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message || "Something went wrong.");
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const canAddTask = useMemo(() => !!lastExtractedTask?.has_task && !!lastExtractedTask.title?.trim(), [lastExtractedTask]);

  return { messages, sendMessage, isStreaming, stop, error, clearAll, lastExtractedTask, canAddTask };
}

