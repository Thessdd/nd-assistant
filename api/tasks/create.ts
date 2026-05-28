import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleOptions, setCors } from "../_utils/sse";

type Body = {
  title: string;
  due_date?: string | null;
  description?: string | null;
  caldav_username?: string;
  caldav_password?: string;
};

function randomId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  setCors(res);

  if (req.method !== "POST") {
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }

  try {
    const body = req.body as Body;
    const title = body?.title?.trim();
    if (!title) {
      res.status(400).json({ success: false, error: "Missing title." });
      return;
    }

    const task_id = randomId();
    const due = body.due_date ? new Date(body.due_date) : null;
    const hasDue = !!due && !Number.isNaN(due.getTime());

    let calendar_synced = false;
    const hasCreds = !!body.caldav_username?.trim() && !!body.caldav_password;

    if (hasCreds && hasDue) {
      const start = due!;
      const end = new Date(start.getTime() + 30 * 60 * 1000);

      const syncRes = await fetch(`${req.headers["x-forwarded-proto"] ?? "https"}://${req.headers.host}/api/calendar/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          caldav_credentials: { username: body.caldav_username!.trim(), password: body.caldav_password }
        })
      });

      const json = (await syncRes.json().catch(() => null)) as null | { synced?: boolean };
      calendar_synced = !!json?.synced;
    }

    res.status(200).json({ success: true, task_id, calendar_synced });
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message || "Failed to create task." });
  }
}

