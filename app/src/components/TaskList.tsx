import type { Task } from "../hooks/useTasks";
import { t } from "../i18n";

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
        <div className="nd-section-header__title">{t("tasks.title")}</div>
        <div className="nd-section-header__sub">{t("tasks.subtitle")}</div>
        {onClearAll ? (
          <button type="button" className="nd-btn nd-btn--ghost nd-section-header__action" onClick={onClearAll}>
            {t("tasks.clearAll")}
          </button>
        ) : null}
      </div>

      <div className="flex-1 overflow-auto nd-tasks__list">
        {tasks.length === 0 ? (
          <div className="nd-card nd-tasks__empty" aria-live="polite">
            <div className="nd-empty-title">{t("tasks.emptyTitle")}</div>
            <div className="nd-muted">{t("tasks.emptyBody")}</div>
          </div>
        ) : (
          <ul className="nd-task-list" aria-label={t("tasks.title")}>
            {tasks.map((task) => {
              const due = formatDue(task.due_date);
              return (
                <li key={task.id} className="nd-task-row">
                  <div className="nd-task-row__main">
                    <button
                      type="button"
                      onClick={() => onToggleDone(task.id)}
                      className={["nd-check", task.status === "done" ? "nd-check--on" : "nd-check--off"].join(" ")}
                      aria-label={task.status === "done" ? t("tasks.toggleDone.open") : t("tasks.toggleDone.done")}
                      title={task.status === "done" ? t("tasks.markOpen") : t("tasks.markDone")}
                    />

                    <div className="nd-task-row__content">
                      <div className={["nd-task-title", task.status === "done" ? "nd-task-title--done" : ""].join(" ")}>
                        {task.title}
                      </div>
                      {due ? (
                        <div className="nd-task-due">
                          {t("tasks.duePrefix")} {due}
                        </div>
                      ) : null}
                      {task.description ? <div className="nd-task-desc">{task.description}</div> : null}
                    </div>

                    <button
                      type="button"
                      onClick={() => onDelete(task.id)}
                      className="nd-btn nd-btn--danger nd-task-row__delete"
                      aria-label={t("tasks.delete")}
                      title={t("tasks.delete")}
                    >
                      {t("tasks.delete")}
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

