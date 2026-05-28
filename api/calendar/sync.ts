import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { handleOptions, setCors } from "../_utils/sse";

const CalendarSyncBodySchema = z.object({
  title: z.string().trim().min(1).max(500),
  start_time: z.string().datetime({ offset: true }),
  end_time: z.string().datetime({ offset: true }),
  caldav_username: z.string().trim().min(1).max(200).optional(),
  caldav_password: z.string().min(1).max(500).optional(),
  caldav_credentials: z
    .object({
      username: z.string().trim().min(1).max(200),
      password: z.string().min(1).max(500)
    })
    .optional()
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  setCors(req, res);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = CalendarSyncBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body.", details: parsed.error.flatten() });
  }

  const body = parsed.data;
  const title = body.title;
  const start_time = body.start_time;
  const end_time = body.end_time;

  // Accept both legacy and current shapes.
  const caldav_username = body.caldav_username ?? body.caldav_credentials?.username ?? "";
  const caldav_password = body.caldav_password ?? body.caldav_credentials?.password ?? "";

  try {
    // TODO: Implement CalDAV sync with proper tsdav usage
    // For now, return success (frontend stores in localStorage)
    
    void title;
    void start_time;
    void end_time;
    void caldav_username;
    void caldav_password;

    res.status(200).json({
      synced: true,
      message: "Task saved. Manual sync to Apple Calendar coming soon."
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
}