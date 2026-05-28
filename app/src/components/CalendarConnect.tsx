import { useEffect, useMemo, useState } from "react";
import type { Task } from "../hooks/useTasks";

type CaldavCredentials = { username: string; password: string };

const LS_CALDAV = "caldav_credentials";

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export default function CalendarConnect({
  open,
  onClose,
  task,
  onSynced
}: {
  open: boolean;
  onClose: () => void;
  task: Pick<Task, "title" | "due_date" | "description">;
  onSynced: (calendarSynced: boolean) => void;
}) {
  const stored = useMemo(() => safeJsonParse<CaldavCredentials>(localStorage.getItem(LS_CALDAV)), []);
  const [username, setUsername] = useState(stored?.username ?? "");
  const [password, setPassword] = useState(stored?.password ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remember, setRemember] = useState(true);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setBusy(false);
  }, [open]);

  if (!open) return null;

  async function sync() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/tasks/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: task.title,
          due_date: task.due_date,
          description: task.description ?? null,
          caldav_username: username.trim() || undefined,
          caldav_password: password || undefined
        })
      });
      const json = (await res.json().catch(() => null)) as null | { success?: boolean; calendar_synced?: boolean; error?: string };
      if (!res.ok || !json?.success) throw new Error(json?.error || `Request failed (${res.status})`);

      if (remember) {
        localStorage.setItem(LS_CALDAV, JSON.stringify({ username: username.trim(), password }));
      }

      onSynced(!!json.calendar_synced);
      onClose();
    } catch (e) {
      setError((e as Error).message || "Sync failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close calendar connect"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
        <div className="p-5 border-b border-slate-800">
          <div className="text-base font-semibold text-slate-100">Connect Apple Calendar (optional)</div>
          <div className="mt-1 text-sm text-slate-400">
            Use an <span className="text-slate-200 font-medium">app-specific password</span> from iCloud settings (not your main password).
          </div>
        </div>

        <div className="p-5 space-y-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-400">Task</div>
            <div className="mt-1 text-sm text-slate-100 font-medium">{task.title}</div>
            {task.due_date ? <div className="mt-1 text-xs text-slate-400">Due: {new Date(task.due_date).toLocaleString()}</div> : null}
          </div>

          <label className="block">
            <div className="text-xs text-slate-400 mb-1">iCloud email</div>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition"
              placeholder="user@icloud.com"
              autoComplete="username"
            />
          </label>

          <label className="block">
            <div className="text-xs text-slate-400 mb-1">App-specific password</div>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition"
              placeholder="xxxx-xxxx-xxxx-xxxx"
              type="password"
              autoComplete="current-password"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-300 select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded border-slate-700 bg-slate-900"
            />
            Remember credentials in this browser
          </label>

          {error ? (
            <div className="rounded-xl border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
              {error}
            </div>
          ) : null}
        </div>

        <div className="p-5 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem(LS_CALDAV);
              setUsername("");
              setPassword("");
            }}
            className="text-sm text-slate-400 hover:text-slate-200 transition"
          >
            Clear saved credentials
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm border border-slate-800 bg-slate-900/50 text-slate-100 hover:bg-slate-900 transition"
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={sync}
              className="rounded-xl px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-500 transition disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={busy || !username.trim() || !password}
            >
              {busy ? "Syncing…" : "Sync to Calendar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

