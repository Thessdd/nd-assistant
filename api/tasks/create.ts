import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { handleOptions, setCors } from "../_utils/sse";

const CreateTaskBodySchema = z.object({
  title: z.string().trim().min(1, "Missing title.").max(500, "Title too long."),
  due_date: z.string().datetime({ offset: true }).nullable().optional(),
  description: z.string().max(5000, "Description too long.").nullable().optional(),
  caldav_username: z.string().trim().min(1).max(200).optional(),
  caldav_password: z.string().min(1).max(500).optional()
});

function randomId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  setCors(req, res);

  if (req.method !== "POST") {
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }

  try {
    const parsed = CreateTaskBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ success: false, error: "Invalid request body.", details: parsed.error.flatten() });
      return;
    }
    const body = parsed.data;
    const title = body.title;

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

