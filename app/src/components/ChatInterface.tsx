import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, ExtractedTask } from "../hooks/useChat";
import { t } from "../i18n";

function TypingDots() {
  return (
    <span className="nd-typing-dots" aria-hidden="true">
      <span className="nd-typing-dot" style={{ animationDelay: "0ms" }} />
      <span className="nd-typing-dot" style={{ animationDelay: "150ms" }} />
      <span className="nd-typing-dot" style={{ animationDelay: "300ms" }} />
    </span>
  );
}

function formatTimestamp(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function MessageRow({
  msg,
  ts
}: {
  msg: ChatMessage;
  ts: number;
}) {
  const isUser = msg.role === "user";
  return (
    <div className={["nd-message-row", isUser ? "nd-message-row--user" : "nd-message-row--assistant", "nd-fade-in"].join(" ")}>
      <div className={["nd-message", isUser ? "nd-message--user" : "nd-message--assistant"].join(" ")}>
        <div className="nd-message__content">{msg.content}</div>
        <div className="nd-message__meta">
          <span className="nd-message__time">{formatTimestamp(ts)}</span>
        </div>
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
  onAddToCalendar,
  suggestions,
  onClearSuggestions,
  onSkipTask
}: {
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  onSend: (text: string) => void;
  onStop: () => void;
  extractedTask: ExtractedTask | null;
  canAddTask: boolean;
  onAddToCalendar: () => void;
  suggestions?: string[];
  onClearSuggestions?: () => void;
  onSkipTask?: () => void;
}) {
  const [text, setText] = useState("");
  const [showJump, setShowJump] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const atBottomRef = useRef(true);
  const tsRef = useRef<number[]>([]);

  const assistantLastEmpty = useMemo(() => {
    const last = messages[messages.length - 1];
    return !!last && last.role === "assistant" && last.content.trim().length === 0;
  }, [messages]);

  useEffect(() => {
    // ensure stable timestamps per message index (best-effort, backwards compatible)
    const now = Date.now();
    while (tsRef.current.length < messages.length) tsRef.current.push(now);
  }, [messages.length]);

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
    setShowJump(!nearBottom && el.scrollHeight > el.clientHeight + 120);
  }

  function jumpToLatest() {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    atBottomRef.current = true;
    setShowJump(false);
  }

  function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  }

  return (
    <div className="nd-chat h-full flex flex-col">
      <div ref={listRef} onScroll={onScroll} className="nd-chat__list flex-1 overflow-auto">
        {messages.length === 0 ? (
          <div className="nd-card nd-chat__empty">
            <div className="nd-muted">
              {t("chat.empty")}
            </div>
          </div>
        ) : null}

        {showJump ? (
          <div className="nd-jump">
            <button type="button" className="nd-btn nd-btn--ghost" onClick={jumpToLatest}>
              {t("chat.jumpLatest")}
            </button>
          </div>
        ) : null}

        <div className="nd-chat__stack">
          {messages.map((m, idx) => (
            <MessageRow key={idx} msg={m} ts={tsRef.current[idx] ?? Date.now()} />
          ))}

          {isStreaming && assistantLastEmpty ? (
            <div className="nd-message-row nd-message-row--assistant nd-fade-in">
              <div className="nd-message nd-message--assistant" aria-live="polite">
                <div className="nd-message__content">
                  <span className="nd-muted">{t("chat.typing")}</span> <TypingDots />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="nd-chat__composer">
        {error ? (
          <div className="nd-alert nd-alert--error" role="alert">
            {error}
          </div>
        ) : null}

        {canAddTask && extractedTask ? (
          <div className="nd-inline-confirm" role="group" aria-label={t("chat.taskFound")}>
            <div className="nd-inline-confirm__text">
              <div className="nd-inline-confirm__title">{t("chat.taskFound")}</div>
              <div className="nd-inline-confirm__value" title={extractedTask.title}>
                {extractedTask.title}
              </div>
            </div>
            <div className="nd-inline-confirm__actions">
              <button type="button" onClick={onAddToCalendar} className="nd-btn nd-btn--primary">
                {t("chat.addToCalendar")}
              </button>
              <button
                type="button"
                onClick={onSkipTask}
                className="nd-btn nd-btn--ghost"
                disabled={!onSkipTask}
              >
                {t("chat.skip")}
              </button>
            </div>
          </div>
        ) : null}

        <div className="nd-composer">
          {!isStreaming && (suggestions?.length ?? 0) > 0 ? (
            <div className="nd-suggestions" role="group" aria-label="Suggerimenti rapidi">
              {suggestions!.map((s, idx) => (
                <button
                  key={`${idx}-${s}`}
                  type="button"
                  className="nd-chip"
                  onClick={() => {
                    onClearSuggestions?.();
                    onSend(s);
                    setText("");
                  }}
                  aria-label={`Invia: ${s}`}
                >
                  {s}
                </button>
              ))}
            </div>
          ) : null}

          <label className="nd-sr-only" htmlFor="nd-chat-input">{t("chat.input.label")}</label>
          <textarea
            id="nd-chat-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
              if (e.key === "Escape") {
                (e.currentTarget as HTMLTextAreaElement).blur();
              }
            }}
            placeholder={t("chat.input.placeholder")}
            className="nd-input"
            disabled={isStreaming}
            rows={2}
          />

          <div className="nd-composer__actions">
            {isStreaming ? (
              <button type="button" onClick={onStop} className="nd-btn nd-btn--ghost">
                {t("chat.stop")}
              </button>
            ) : null}
            <button
              type="button"
              onClick={submit}
              disabled={isStreaming || !text.trim()}
              className="nd-btn nd-btn--primary"
            >
              {t("chat.send")}
            </button>
          </div>
        </div>

        <div className="nd-footnote">{t("chat.privacyFootnote")}</div>
      </div>
    </div>
  );
}

