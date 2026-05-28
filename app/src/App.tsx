import { useEffect, useMemo, useState } from "react";
import ChatInterface from "./components/ChatInterface";
import TaskList from "./components/TaskList";
import { useChat } from "./hooks/useChat";
import { useTasks } from "./hooks/useTasks";

function Toast({ text }: { text: string }) {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <div className="rounded-2xl border border-slate-800 bg-slate-950/90 backdrop-blur px-4 py-3 shadow-xl text-sm text-slate-100">
        {text}
      </div>
    </div>
  );
}

type ThemeMode = "dark" | "light" | "contrast";
type FontSize = "small" | "normal" | "large";
type Density = "comfortable" | "compact";
type FontFamily = "system" | "accessible";

type NdSettings = {
  theme: ThemeMode;
  reduceMotion: boolean;
  fontSize: FontSize;
  density: Density;
  fontFamily: FontFamily;
  timestamps: boolean;
  sound: boolean;
};

const LS_SETTINGS = "nd_settings";

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function SettingsModal({
  open,
  value,
  onChange,
  onClose
}: {
  open: boolean;
  value: NdSettings;
  onChange: (next: NdSettings) => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="nd-modal" role="dialog" aria-modal="true" aria-label="Settings">
      <button type="button" className="nd-modal__backdrop" onClick={onClose} aria-label="Close settings" />
      <div className="nd-modal__panel">
        <div className="nd-modal__header">
          <div className="nd-modal__title">Settings</div>
          <div className="nd-muted">Calm, predictable, and adjustable.</div>
        </div>

        <div className="nd-modal__body">
          <div className="nd-setting">
            <div className="nd-setting__text">
              <div className="nd-setting__label">Theme</div>
              <div className="nd-setting__help">Dark reduces eye strain. High contrast boosts clarity.</div>
            </div>
            <div className="nd-setting__control" role="group" aria-label="Theme selection">
              <button
                type="button"
                className={["nd-pill", value.theme === "dark" ? "nd-pill--on" : ""].join(" ")}
                onClick={() => onChange({ ...value, theme: "dark" })}
              >
                Dark
              </button>
              <button
                type="button"
                className={["nd-pill", value.theme === "light" ? "nd-pill--on" : ""].join(" ")}
                onClick={() => onChange({ ...value, theme: "light" })}
              >
                Light
              </button>
              <button
                type="button"
                className={["nd-pill", value.theme === "contrast" ? "nd-pill--on" : ""].join(" ")}
                onClick={() => onChange({ ...value, theme: "contrast" })}
              >
                High contrast
              </button>
            </div>
          </div>

          <div className="nd-setting">
            <div className="nd-setting__text">
              <div className="nd-setting__label">Reduce motion</div>
              <div className="nd-setting__help">Turns off most animations and pulsing effects.</div>
            </div>
            <button
              type="button"
              className={["nd-toggle", value.reduceMotion ? "nd-toggle--on" : "nd-toggle--off"].join(" ")}
              aria-pressed={value.reduceMotion}
              onClick={() => onChange({ ...value, reduceMotion: !value.reduceMotion })}
            >
              <span className="nd-toggle__knob" aria-hidden="true" />
              <span className="nd-toggle__label">{value.reduceMotion ? "On" : "Off"}</span>
            </button>
          </div>

          <div className="nd-setting">
            <div className="nd-setting__text">
              <div className="nd-setting__label">Font size</div>
              <div className="nd-setting__help">Larger text can reduce fatigue and re-reading.</div>
            </div>
            <div className="nd-setting__control" role="group" aria-label="Font size selection">
              <button
                type="button"
                className={["nd-pill", value.fontSize === "small" ? "nd-pill--on" : ""].join(" ")}
                onClick={() => onChange({ ...value, fontSize: "small" })}
              >
                Small
              </button>
              <button
                type="button"
                className={["nd-pill", value.fontSize === "normal" ? "nd-pill--on" : ""].join(" ")}
                onClick={() => onChange({ ...value, fontSize: "normal" })}
              >
                Normal
              </button>
              <button
                type="button"
                className={["nd-pill", value.fontSize === "large" ? "nd-pill--on" : ""].join(" ")}
                onClick={() => onChange({ ...value, fontSize: "large" })}
              >
                Large
              </button>
            </div>
          </div>

          <div className="nd-setting">
            <div className="nd-setting__text">
              <div className="nd-setting__label">Font</div>
              <div className="nd-setting__help">Choose a highly legible typeface stack where available.</div>
            </div>
            <div className="nd-setting__control" role="group" aria-label="Font selection">
              <button
                type="button"
                className={["nd-pill", value.fontFamily === "system" ? "nd-pill--on" : ""].join(" ")}
                onClick={() => onChange({ ...value, fontFamily: "system" })}
              >
                System
              </button>
              <button
                type="button"
                className={["nd-pill", value.fontFamily === "accessible" ? "nd-pill--on" : ""].join(" ")}
                onClick={() => onChange({ ...value, fontFamily: "accessible" })}
              >
                Accessible
              </button>
              <div className="nd-pill nd-pill--spacer" aria-hidden="true" />
            </div>
          </div>

          <div className="nd-setting">
            <div className="nd-setting__text">
              <div className="nd-setting__label">Layout density</div>
              <div className="nd-setting__help">Compact reduces scrolling. Comfortable adds breathing room.</div>
            </div>
            <div className="nd-setting__control" role="group" aria-label="Layout density selection">
              <button
                type="button"
                className={["nd-pill", value.density === "comfortable" ? "nd-pill--on" : ""].join(" ")}
                onClick={() => onChange({ ...value, density: "comfortable" })}
              >
                Comfortable
              </button>
              <button
                type="button"
                className={["nd-pill", value.density === "compact" ? "nd-pill--on" : ""].join(" ")}
                onClick={() => onChange({ ...value, density: "compact" })}
              >
                Compact
              </button>
              <div className="nd-pill nd-pill--spacer" aria-hidden="true" />
            </div>
          </div>

          <div className="nd-setting">
            <div className="nd-setting__text">
              <div className="nd-setting__label">Timestamps in chat</div>
              <div className="nd-setting__help">Hide timestamps to reduce visual scanning load.</div>
            </div>
            <button
              type="button"
              className={["nd-toggle", value.timestamps ? "nd-toggle--on" : "nd-toggle--off"].join(" ")}
              aria-pressed={value.timestamps}
              onClick={() => onChange({ ...value, timestamps: !value.timestamps })}
            >
              <span className="nd-toggle__knob" aria-hidden="true" />
              <span className="nd-toggle__label">{value.timestamps ? "On" : "Off"}</span>
            </button>
          </div>

          <div className="nd-setting">
            <div className="nd-setting__text">
              <div className="nd-setting__label">Sound</div>
              <div className="nd-setting__help">Off by default. Only used if you add sound cues later.</div>
            </div>
            <button
              type="button"
              className={["nd-toggle", value.sound ? "nd-toggle--on" : "nd-toggle--off"].join(" ")}
              aria-pressed={value.sound}
              onClick={() => onChange({ ...value, sound: !value.sound })}
            >
              <span className="nd-toggle__knob" aria-hidden="true" />
              <span className="nd-toggle__label">{value.sound ? "On" : "Off"}</span>
            </button>
          </div>
        </div>

        <div className="nd-modal__footer">
          <button type="button" className="nd-btn nd-btn--primary" onClick={onClose}>
            Save settings
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { messages, sendMessage, isStreaming, stop, error, clearAll: clearChat, lastExtractedTask, canAddTask } = useChat();
  const { tasks, addTask, removeTask, toggleDone, clearAll: clearTasks, openCount } = useTasks();

  const [toast, setToast] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [view, setView] = useState<"chat" | "tasks">("chat");
  const [dismissedTaskKey, setDismissedTaskKey] = useState<string | null>(null);
  const [settings, setSettings] = useState<NdSettings>(() => {
    const stored = safeJsonParse<Partial<NdSettings>>(localStorage.getItem(LS_SETTINGS));
    return {
      theme: stored?.theme === "light" || stored?.theme === "contrast" ? stored.theme : "dark",
      reduceMotion: typeof stored?.reduceMotion === "boolean" ? stored.reduceMotion : false,
      fontSize: stored?.fontSize === "small" || stored?.fontSize === "large" ? stored.fontSize : "normal",
      density: stored?.density === "compact" ? "compact" : "comfortable",
      fontFamily: stored?.fontFamily === "accessible" ? "accessible" : "system",
      timestamps: typeof stored?.timestamps === "boolean" ? stored.timestamps : true,
      sound: typeof stored?.sound === "boolean" ? stored.sound : false
    };
  });

  const extractedAsTask = useMemo(() => {
    if (!lastExtractedTask?.has_task) return null;
    return {
      title: lastExtractedTask.title,
      due_date: lastExtractedTask.due_date ?? null,
      description: lastExtractedTask.description ?? null
    };
  }, [lastExtractedTask]);

  function showToast(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(null), 2400);
  }

  useEffect(() => {
    localStorage.setItem(LS_SETTINGS, JSON.stringify(settings));
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.dataset.motion = settings.reduceMotion ? "reduced" : "full";
    document.documentElement.dataset.font = settings.fontSize;
    document.documentElement.dataset.density = settings.density;
    document.documentElement.dataset.fontFamily = settings.fontFamily;
    document.documentElement.dataset.timestamps = settings.timestamps ? "on" : "off";
  }, [settings]);

  function clearAllData() {
    if (!confirm("Clear all local data (chat + tasks + saved calendar credentials)?")) return;
    clearChat();
    clearTasks();
    localStorage.removeItem("caldav_credentials");
    showToast("All local data cleared.");
  }

  function addTaskFromExtraction() {
    if (!extractedAsTask) return;
    addTask({ title: extractedAsTask.title, due_date: extractedAsTask.due_date, description: extractedAsTask.description });
    showToast("Task added!");
    setDismissedTaskKey(`${extractedAsTask.title}|${extractedAsTask.due_date ?? ""}`);
  }

  const canShowInlineTask =
    canAddTask &&
    !!extractedAsTask &&
    dismissedTaskKey !== `${extractedAsTask.title}|${extractedAsTask.due_date ?? ""}`;

  return (
    <div className="nd-app">
      {toast ? <Toast text={toast} /> : null}

      <div className="nd-shell">
        <header className="nd-header">
          <div className="nd-header__top">
            <div>
              <div className="nd-title">ND Assistant</div>
              <div className="nd-breadcrumbs">Home / {view === "chat" ? "Chat" : "Tasks"}</div>
            </div>
            <div className="nd-header__meta">
              <div className="nd-muted">
                Open tasks: <span className="nd-strong">{openCount}</span>
              </div>
            </div>
          </div>

          <div className="nd-segment" role="tablist" aria-label="Primary view">
            <button
              type="button"
              className={["nd-segment__btn", view === "chat" ? "nd-segment__btn--on" : ""].join(" ")}
              onClick={() => setView("chat")}
              role="tab"
              aria-selected={view === "chat"}
            >
              Chat
            </button>
            <button
              type="button"
              className={["nd-segment__btn", view === "tasks" ? "nd-segment__btn--on" : ""].join(" ")}
              onClick={() => setView("tasks")}
              role="tab"
              aria-selected={view === "tasks"}
            >
              Tasks
            </button>
          </div>
        </header>

        <main className="nd-main">
          {view === "chat" ? (
            <ChatInterface
              messages={messages}
              isStreaming={isStreaming}
              error={error}
              onSend={(t) => void sendMessage(t)}
              onStop={stop}
              extractedTask={lastExtractedTask}
              canAddTask={!!canShowInlineTask}
              onAddToCalendar={addTaskFromExtraction}
              showTimestamps={settings.timestamps}
              onSkipTask={() => {
                if (!extractedAsTask) return;
                setDismissedTaskKey(`${extractedAsTask.title}|${extractedAsTask.due_date ?? ""}`);
                showToast("Skipped.");
              }}
            />
          ) : (
            <TaskList
              tasks={tasks}
              onToggleDone={toggleDone}
              onDelete={removeTask}
              onClearAll={() => {
                if (!confirm("Clear all tasks?")) return;
                clearTasks();
                showToast("Tasks cleared.");
              }}
            />
          )}
        </main>

        <footer className="nd-footer">
          <button type="button" className="nd-btn nd-btn--ghost" onClick={() => setSettingsOpen(true)}>
            Settings
          </button>
          <button type="button" className="nd-btn nd-btn--ghost" onClick={clearAllData}>
            Clear data
          </button>
          <button
            type="button"
            className="nd-btn nd-btn--ghost"
            onClick={() => showToast("Help: write one message, then choose Add/Skip when a task is detected.")}
          >
            Help
          </button>
        </footer>
      </div>

      <SettingsModal
        open={settingsOpen}
        value={settings}
        onChange={(next) => setSettings(next)}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}

