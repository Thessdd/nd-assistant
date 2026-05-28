import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { createDAVClient } from "tsdav";
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

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toUtcIcsDate(date: Date) {
  const d = new Date(date.getTime());
  return (
    d.getUTCFullYear() +
    pad2(d.getUTCMonth() + 1) +
    pad2(d.getUTCDate()) +
    "T" +
    pad2(d.getUTCHours()) +
    pad2(d.getUTCMinutes()) +
    pad2(d.getUTCSeconds()) +
    "Z"
  );
}

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function buildICS({
  uid,
  dtstamp,
  dtstart,
  dtend,
  summary,
  description
}: {
  uid: string;
  dtstamp: Date;
  dtstart: Date;
  dtend: Date;
  summary: string;
  description?: string | null;
}) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//nd-assistant//CalDAV Sync//IT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(uid)}`,
    `DTSTAMP:${toUtcIcsDate(dtstamp)}`,
    `DTSTART:${toUtcIcsDate(dtstart)}`,
    `DTEND:${toUtcIcsDate(dtend)}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    ...(description ? [`DESCRIPTION:${escapeIcsText(description)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR"
  ];
  // CalDAV servers accept CRLF; LF is usually ok but be strict.
  return lines.join("\r\n") + "\r\n";
}

function makeUid() {
  const r = Math.random().toString(16).slice(2);
  return `nd-${Date.now()}-${r}@nd-assistant`;
}

function isUnauthorizedError(err: unknown) {
  const anyErr = err as any;
  const status = Number(anyErr?.status ?? anyErr?.statusCode ?? anyErr?.response?.status);
  if (status === 401) return true;
  const msg = String(anyErr?.message ?? "").toLowerCase();
  return msg.includes("401") || msg.includes("unauthorized") || msg.includes("not authorized");
}

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
    if (!caldav_username.trim() || !caldav_password) {
      return res.status(400).json({ synced: false, error: "Credenziali mancanti." });
    }

    const start = new Date(start_time);
    const end = new Date(end_time);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ synced: false, error: "Date non valide." });
    }

    const serverUrl = process.env.CALDAV_SERVER_URL ?? "https://caldav.icloud.com";

    const client = await createDAVClient({
      serverUrl,
      credentials: { username: caldav_username.trim(), password: caldav_password },
      authMethod: "Basic",
      defaultAccountType: "caldav"
    });

    const calendars = await (client as any).fetchCalendars();
    if (!Array.isArray(calendars) || calendars.length === 0) {
      return res.status(200).json({ synced: false, error: "Nessun calendario trovato su questo account." });
    }

    const supportsVevent = (cal: any) => {
      const comps = cal?.supportedComponents ?? cal?.components ?? cal?.comp ?? cal?.supportedCalendarComponentSet;
      if (Array.isArray(comps)) return comps.includes("VEVENT") || comps.includes("vevent");
      if (typeof comps === "string") return comps.toUpperCase().includes("VEVENT");
      return true; // best-effort fallback
    };

    const calendar = calendars.find(supportsVevent) ?? calendars[0];
    if (!calendar) {
      return res.status(200).json({ synced: false, error: "Nessun calendario disponibile." });
    }

    const uid = makeUid();
    const iCalString = buildICS({
      uid,
      dtstamp: new Date(),
      dtstart: start,
      dtend: end,
      summary: title,
      description: null
    });

    await (client as any).createCalendarObject({
      calendar,
      filename: `${uid}.ics`,
      iCalString
    });

    return res.status(200).json({ synced: true });
  } catch (error: any) {
    if (isUnauthorizedError(error)) {
      return res
        .status(200)
        .json({ synced: false, error: "Credenziali non valide o serve una password specifica per app." });
    }
    const message = (error as Error)?.message || "Sync calendario fallita.";
    return res.status(200).json({ synced: false, error: message });
  }
}