import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createAccount, createCalendarObject, fetchCalendars, fetchPrincipalUrl, fetchWellKnown } from "tsdav";
import { handleOptions, setCors } from "../_utils/sse";

type Body = {
  title: string;
  start_time: string;
  end_time: string;
  caldav_credentials: { username: string; password: string };
};

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}@nd-assistant`;
}

function toIcsDate(d: Date) {
  // UTC: YYYYMMDDTHHMMSSZ
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function buildVevent({ title, start, end }: { title: string; start: Date; end: Date }) {
  const now = new Date();
  const id = uid();
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//nd-assistant//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${id}`,
    `DTSTAMP:${toIcsDate(now)}`,
    `DTSTART:${toIcsDate(start)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:${title.replace(/\n/g, " ").trim()}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  setCors(res);

  if (req.method !== "POST") {
    res.status(405).json({ synced: false, error: "Method not allowed" });
    return;
  }

  try {
    const body = req.body as Body;
    if (!body?.title || !body?.start_time || !body?.end_time || !body?.caldav_credentials?.username || !body?.caldav_credentials?.password) {
      res.status(400).json({ synced: false, error: "Missing required fields." });
      return;
    }

    const start = new Date(body.start_time);
    const end = new Date(body.end_time);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      res.status(400).json({ synced: false, error: "Invalid start/end time." });
      return;
    }

    const { username, password } = body.caldav_credentials;

    const wellKnown = await fetchWellKnown({
      account: {
        serverUrl: "https://caldav.icloud.com",
        accountType: "caldav",
        credentials: { username, password }
      }
    });

    const principalUrl = await fetchPrincipalUrl({
      account: {
        serverUrl: "https://caldav.icloud.com",
        accountType: "caldav",
        credentials: { username, password }
      },
      wellKnown
    });

    const account = await createAccount({
      account: {
        serverUrl: "https://caldav.icloud.com",
        accountType: "caldav",
        credentials: { username, password },
        principalUrl
      },
      headers: { "User-Agent": "nd-assistant" }
    });

    const calendars = await fetchCalendars({ account, headers: { "User-Agent": "nd-assistant" } });
    const target = calendars.find((c) => c.components?.includes("VEVENT")) ?? calendars[0];

    if (!target?.url) {
      res.status(400).json({ synced: false, error: "No writable calendar found on this account." });
      return;
    }

    const vevent = buildVevent({ title: body.title, start, end });
    const filename = `${uid()}.ics`;

    await createCalendarObject({
      calendar: { url: target.url },
      filename,
      iCalString: vevent,
      headers: { "User-Agent": "nd-assistant" }
    });

    res.status(200).json({ synced: true, error: "" });
  } catch (e) {
    res.status(500).json({ synced: false, error: (e as Error).message || "Calendar sync failed." });
  }
}

