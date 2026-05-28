import type { Task } from "../hooks/useTasks";

function formatDue(due: string | null) {
  if (!due) return null;
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return due;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDue = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = Math.round((startOfDue.getTime() - startOfToday.getTime()) / (24 * 60 * 60 * 1000));

  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  if (dayDiff === 0) return `Oggi ${time}`;
  if (dayDiff === 1) return `Domani ${time}`;

  return d.toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function TaskList({
  tasks,
  onToggleDone,
  onDelete,
  onClearAll
}: {
  tasks: Task[];
  onToggleDone: (id: string) => void;
  onDelete: (id: string) => void;
  onClearAll?: () => void;
}) {
  return (
    <div className="h-full flex flex-col nd-tasks">
      <div className="nd-section-header">
        <div className="nd-section-header__title">Tasks</div>
        <div className="nd-section-header__sub">Saved only in this browser.</div>
        {onClearAll ? (
          <button type="button" className="nd-btn nd-btn--ghost nd-section-header__action" onClick={onClearAll}>
            Clear all
          </button>
        ) : null}
      </div>

      <div className="flex-1 overflow-auto nd-tasks__list">
        {tasks.length === 0 ? (
          <div className="nd-card nd-tasks__empty" aria-live="polite">
            <div className="nd-empty-title">All tasks completed!</div>
            <div className="nd-muted">When you mention a task in chat, you’ll get a simple option to add it.</div>
          </div>
        ) : (
          <ul className="nd-task-list" aria-label="Task list">
            {tasks.map((t) => {
              const due = formatDue(t.due_date);
              return (
                <li key={t.id} className="nd-task-row">
                  <div className="nd-task-row__main">
                    <button
                      type="button"
                      onClick={() => onToggleDone(t.id)}
                      className={["nd-check", t.status === "done" ? "nd-check--on" : "nd-check--off"].join(" ")}
                      aria-label={t.status === "done" ? "Mark task as open" : "Mark task as done"}
                      title={t.status === "done" ? "Mark open" : "Mark done"}
                    />

                    <div className="nd-task-row__content">
                      <div className={["nd-task-title", t.status === "done" ? "nd-task-title--done" : ""].join(" ")}>
                        {t.title}
                      </div>
                      {due ? <div className="nd-task-due">📅 {due}</div> : null}
                      {t.description ? <div className="nd-task-desc">{t.description}</div> : null}
                    </div>

                    <button
                      type="button"
                      onClick={() => onDelete(t.id)}
                      className="nd-btn nd-btn--danger nd-task-row__delete"
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

