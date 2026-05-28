import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { handleOptions, setCors, writeSse } from "./_utils/sse";
import { SYSTEM_PROMPT } from "./prompts/systemPrompt";

type ExtractedTask = {
  has_task: boolean;
  title: string;
  due_date: string | null;
  description: string | null;
};

const ChatBodySchema = z.object({
  message: z.string().trim().min(1, "Missing message.").max(10_000, "Message too long.")
});

const ExtractedTaskSchema = z.object({
  has_task: z.boolean(),
  title: z.string(),
  due_date: z.string().nullable(),
  description: z.string().nullable()
});

type RateLimitBucket = { count: number; resetAt: number };
const RATE_LIMIT = {
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
  max: Number(process.env.RATE_LIMIT_MAX ?? 20)
};
const rateLimitBuckets: Map<string, RateLimitBucket> = (globalThis as any).__nd_rl ?? new Map();
(globalThis as any).__nd_rl = rateLimitBuckets;

function getClientIp(req: VercelRequest) {
  const xff = (req.headers["x-forwarded-for"] ?? "").toString();
  const first = xff.split(",")[0]?.trim();
  return first || (req.socket as any)?.remoteAddress || "unknown";
}

function rateLimitOrThrow(req: VercelRequest) {
  if (RATE_LIMIT.max <= 0) return;
  const now = Date.now();
  const key = getClientIp(req);
  const bucket = rateLimitBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    return;
  }

  bucket.count += 1;
  if (bucket.count > RATE_LIMIT.max) {
    const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    const err = new Error("Rate limit exceeded.");
    (err as any).statusCode = 429;
    (err as any).retryAfterSec = retryAfterSec;
    throw err;
  }
}

function safeJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function coerceTask(x: any): ExtractedTask {
  const has_task = !!x?.has_task;
  const title = typeof x?.title === "string" ? x.title : "";
  const due_date = typeof x?.due_date === "string" ? x.due_date : null;
  const description = typeof x?.description === "string" ? x.description : null;
  return { has_task, title, due_date, description };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  setCors(req, res);

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Missing ANTHROPIC_API_KEY on server." });
    return;
  }

  const parsedBody = ChatBodySchema.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    res.status(400).json({ error: "Invalid request body.", details: parsedBody.error.flatten() });
    return;
  }
  const message = parsedBody.data.message;

  try {
    rateLimitOrThrow(req);
  } catch (e) {
    const status = Number((e as any).statusCode ?? 429);
    const retryAfterSec = Number((e as any).retryAfterSec ?? 60);
    res.setHeader("Retry-After", String(retryAfterSec));
    res.status(status).json({ error: (e as Error).message || "Rate limit exceeded." });
    return;
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const client = new Anthropic({ apiKey });

  try {
    let closed = false;
    req.on("close", () => {
      closed = true;
    });

    const ping = setInterval(() => {
      if (closed) return;
      try {
        writeSse(res, "ping", "1");
      } catch {
        closed = true;
      }
    }, 15_000);

    const stream = await client.messages.stream({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      temperature: 0.5,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: message }]
    });

    let fullText = "";

    stream.on("text", (t) => {
      if (closed) return;
      fullText += t;
      writeSse(res, "delta", t);
    });

    stream.on("error", (err) => {
      if (closed) return;
      writeSse(res, "error", (err as Error).message || "Claude streaming error.");
    });

    await stream.finalMessage();

    if (closed) {
      clearInterval(ping);
      return;
    }

    // Secondary: extract task JSON (non-streaming, short + deterministic).
    const extract = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 120,
      temperature: 0,
      system:
        SYSTEM_PROMPT +
        `\n\nReturn ONLY valid JSON matching this schema:\n` +
        `{\n  "has_task": boolean,\n  "title": "string",\n  "due_date": "ISO 8601 or null",\n  "description": "string or null"\n}\n` +
        `If no task, set has_task=false and use empty title.`,
      messages: [
        {
          role: "user",
          content:
            `User message:\n${message}\n\nAssistant response:\n${fullText}\n\nExtract task JSON now.`
        }
      ]
    });

    const text = extract.content
      .map((b) => ("text" in b ? (b.text as string) : ""))
      .join("")
      .trim();

    const parsed = safeJson<ExtractedTask>(text);
    if (parsed) {
      const safeTask = ExtractedTaskSchema.safeParse(coerceTask(parsed));
      if (safeTask.success) writeSse(res, "task", JSON.stringify(safeTask.data));
    }

    writeSse(res, "done", "1");
    clearInterval(ping);
    res.end();
  } catch (e) {
    writeSse(res, "error", (e as Error).message || "Chat failed.");
    writeSse(res, "done", "1");
    res.end();
  }
}

