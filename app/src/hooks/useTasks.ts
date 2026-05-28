import { useCallback, useEffect, useMemo, useState } from "react";

export type TaskStatus = "open" | "done";

export type Task = {
  id: string;
  title: string;
  due_date: string | null;
  description?: string | null;
  status: TaskStatus;
};

const LS_TASKS = "tasks";

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>(() => safeJsonParse<Task[]>(localStorage.getItem(LS_TASKS)) ?? []);

  useEffect(() => {
    localStorage.setItem(LS_TASKS, JSON.stringify(tasks));
  }, [tasks]);

  const addTask = useCallback((input: Omit<Task, "id" | "status"> & { status?: TaskStatus }) => {
    const task: Task = {
      id: uuid(),
      title: input.title.trim(),
      due_date: input.due_date ?? null,
      description: input.description ?? null,
      status: input.status ?? "open"
    };
    setTasks((prev) => [task, ...prev]);
    return task;
  }, []);

  const removeTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toggleDone = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: t.status === "done" ? "open" : "done" } : t))
    );
  }, []);

  const clearAll = useCallback(() => {
    localStorage.removeItem(LS_TASKS);
    setTasks([]);
  }, []);

  const openCount = useMemo(() => tasks.filter((t) => t.status === "open").length, [tasks]);

  return { tasks, addTask, removeTask, toggleDone, clearAll, openCount };
}

