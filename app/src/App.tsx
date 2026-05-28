import { useMemo, useState } from "react";
import ChatInterface from "./components/ChatInterface";
import CalendarConnect from "./components/CalendarConnect";
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

export default function App() {
  const { messages, sendMessage, isStreaming, stop, error, clearAll: clearChat, lastExtractedTask, canAddTask } = useChat();
  const { tasks, addTask, removeTask, toggleDone, clearAll: clearTasks, openCount } = useTasks();

  const [toast, setToast] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

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
    setCalendarOpen(true);
  }

  return (
    <div className="min-h-full bg-slate-950 text-slate-100">
      {toast ? <Toast text={toast} /> : null}

      <div className="mx-auto max-w-6xl h-dvh">
        <div className="h-full grid grid-rows-[auto_1fr]">
          <header className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-baseline gap-2">
              <div className="text-base font-semibold">ND Assistant</div>
              <div className="text-xs text-slate-400">Minimal MVP</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden sm:block text-xs text-slate-400">
                Open tasks: <span className="text-slate-200 font-medium">{openCount}</span>
              </div>
              <button
                type="button"
                onClick={clearAllData}
                className="rounded-xl px-3 py-2 text-xs border border-slate-800 bg-slate-900/50 text-slate-100 hover:bg-slate-900 transition"
              >
                Clear all data
              </button>
            </div>
          </header>

          <main className="h-full grid grid-cols-1 md:grid-cols-[1fr_360px]">
            <section className="min-h-0">
              <ChatInterface
                messages={messages}
                isStreaming={isStreaming}
                error={error}
                onSend={(t) => void sendMessage(t)}
                onStop={stop}
                extractedTask={lastExtractedTask}
                canAddTask={canAddTask}
                onAddToCalendar={addTaskFromExtraction}
              />
            </section>

            <aside className="min-h-0 border-t md:border-t-0 md:border-l border-slate-800 bg-slate-950">
              <TaskList tasks={tasks} onToggleDone={toggleDone} onDelete={removeTask} />
            </aside>
          </main>
        </div>
      </div>

      {extractedAsTask ? (
        <CalendarConnect
          open={calendarOpen}
          onClose={() => setCalendarOpen(false)}
          task={extractedAsTask}
          onSynced={(synced) => showToast(synced ? "Calendar synced!" : "Saved task (no calendar sync).")}
        />
      ) : null}
    </div>
  );
}

