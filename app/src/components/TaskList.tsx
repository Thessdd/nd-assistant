import type { Task } from "../hooks/useTasks";

function formatDue(due: string | null) {
  if (!due) return null;
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return due;
  return d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function TaskList({
  tasks,
  onToggleDone,
  onDelete
}: {
  tasks: Task[];
  onToggleDone: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-slate-800">
        <div className="text-sm font-semibold text-slate-100">Tasks</div>
        <div className="text-xs text-slate-400">Saved only in this browser.</div>
      </div>

      <div className="flex-1 overflow-auto">
        {tasks.length === 0 ? (
          <div className="p-4 text-sm text-slate-400">No tasks yet. If you mention one in chat, I’ll offer to add it.</div>
        ) : (
          <ul className="p-3 space-y-2">
            {tasks.map((t) => {
              const due = formatDue(t.due_date);
              return (
                <li
                  key={t.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 hover:bg-slate-900 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => onToggleDone(t.id)}
                      className={[
                        "mt-0.5 h-5 w-5 rounded border transition-colors",
                        t.status === "done"
                          ? "bg-emerald-600 border-emerald-500"
                          : "bg-slate-950 border-slate-700 hover:border-slate-500"
                      ].join(" ")}
                      aria-label={t.status === "done" ? "Mark task as open" : "Mark task as done"}
                      title={t.status === "done" ? "Mark open" : "Mark done"}
                    />

                    <div className="min-w-0 flex-1">
                      <div className={["text-sm font-medium truncate", t.status === "done" ? "text-slate-400 line-through" : "text-slate-100"].join(" ")}>
                        {t.title}
                      </div>
                      {due && <div className="text-xs text-slate-400 mt-0.5">Due: {due}</div>}
                      {t.description ? <div className="text-xs text-slate-400 mt-1 line-clamp-3">{t.description}</div> : null}
                    </div>

                    <button
                      type="button"
                      onClick={() => onDelete(t.id)}
                      className="text-xs text-slate-400 hover:text-rose-300 transition-colors px-2 py-1 rounded-lg hover:bg-slate-800"
                      aria-label="Delete task"
                      title="Delete"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

