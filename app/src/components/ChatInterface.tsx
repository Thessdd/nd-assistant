import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, ExtractedTask } from "../hooks/useChat";

function Dots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-300/80 animate-pulse-dots [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-slate-300/80 animate-pulse-dots [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-slate-300/80 animate-pulse-dots [animation-delay:300ms]" />
    </span>
  );
}

function Bubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <div className={["w-full flex", isUser ? "justify-end" : "justify-start"].join(" ")}>
      <div
        className={[
          "max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm",
          isUser ? "bg-blue-600 text-white" : "bg-slate-800/80 text-slate-100 border border-slate-700/60"
        ].join(" ")}
      >
        {msg.content}
      </div>
    </div>
  );
}

export default function ChatInterface({
  messages,
  isStreaming,
  error,
  onSend,
  onStop,
  extractedTask,
  canAddTask,
  onAddToCalendar
}: {
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  onSend: (text: string) => void;
  onStop: () => void;
  extractedTask: ExtractedTask | null;
  canAddTask: boolean;
  onAddToCalendar: () => void;
}) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);
  const atBottomRef = useRef(true);

  const assistantLastEmpty = useMemo(() => {
    const last = messages[messages.length - 1];
    return !!last && last.role === "assistant" && last.content.trim().length === 0;
  }, [messages]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, isStreaming]);

  function onScroll() {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    atBottomRef.current = nearBottom;
  }

  function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-100">ND Assistant</div>
          <div className="text-xs text-slate-400">Direct. Pragmatic. Supportive. No login.</div>
        </div>
        <div className="flex items-center gap-2">
          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              className="rounded-xl px-3 py-2 text-xs border border-slate-800 bg-slate-900/50 text-slate-100 hover:bg-slate-900 transition"
            >
              Stop
            </button>
          ) : null}
        </div>
      </div>

      <div ref={listRef} onScroll={onScroll} className="flex-1 overflow-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-200">
            Tell me what’s on your mind. If you mention a task, I’ll offer to add it to your calendar.
          </div>
        ) : null}

        {messages.map((m, idx) => (
          <Bubble key={idx} msg={m} />
        ))}

        {isStreaming && assistantLastEmpty ? (
          <div className="w-full flex justify-start">
            <div className="rounded-2xl px-4 py-3 text-sm bg-slate-800/80 text-slate-100 border border-slate-700/60">
              <Dots />
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t border-slate-800 p-4 space-y-3">
        {error ? (
          <div className="rounded-xl border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        {canAddTask && extractedTask ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wide text-slate-400">Task detected</div>
              <div className="text-sm text-slate-100 font-medium truncate">{extractedTask.title}</div>
              <div className="text-xs text-slate-400 mt-0.5">Add to calendar?</div>
            </div>
            <button
              type="button"
              onClick={onAddToCalendar}
              className="shrink-0 rounded-xl px-4 py-2 text-sm bg-emerald-600 text-white hover:bg-emerald-500 transition"
            >
              Add
            </button>
          </div>
        ) : null}

        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Write a message… (Enter to send, Shift+Enter for newline)"
            className="min-h-[44px] max-h-[160px] w-full resize-none rounded-2xl bg-slate-900 border border-slate-800 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition"
            disabled={isStreaming}
          />

          <button
            type="button"
            onClick={submit}
            disabled={isStreaming || !text.trim()}
            className="rounded-2xl px-4 py-3 text-sm bg-blue-600 text-white hover:bg-blue-500 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>

        <div className="text-xs text-slate-500">
          Privacy: chat + tasks stay in your browser unless you sync a calendar event.
        </div>
      </div>
    </div>
  );
}

