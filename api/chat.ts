import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { handleOptions, setCors, writeSse } from "./_utils/sse";
import { SYSTEM_PROMPT } from "./prompts/systemPrompt";
import { MODELS } from "./prompts/models";
import { ProfileSchema } from "../shared/profile";

type ExtractedTask = {
  has_task: boolean;
  title: string;
  due_date: string | null;
  description: string | null;
  quick_replies: string[];
};

const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(10_000)
});

const ChatBodySchema = z.object({
  messages: z.array(ChatMessageSchema).min(1).max(40)
  ,profile: ProfileSchema.optional()
});

const ExtractedTaskSchema = z.object({
  has_task: z.boolean(),
  title: z.string(),
  due_date: z.string().nullable(),
  description: z.string().nullable(),
  quick_replies: z.array(z.string()).max(4)
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

function coerceTask(x: any): ExtractedTask {
  const has_task = !!x?.has_task;
  const title = typeof x?.title === "string" ? x.title : "";
  const due_date = typeof x?.due_date === "string" ? x.due_date : null;
  const description = typeof x?.description === "string" ? x.description : null;
  const quick_replies = Array.isArray(x?.quick_replies) ? x.quick_replies.filter((s: any) => typeof s === "string") : [];
  return { has_task, title, due_date, description, quick_replies };
}

function clampQuickReplies(replies: string[]) {
  return replies
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.length > 40 ? s.slice(0, 40) : s))
    .slice(0, 4);
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

  const messages = parsedBody.data.messages;
  const profile = parsedBody.data.profile;
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") {
    res.status(400).json({ error: "Invalid request body.", details: { messages: ["Last message must be role=user."] } });
    return;
  }

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
      model: MODELS.chat,
      max_tokens: Number(process.env.CHAT_MAX_TOKENS ?? 800),
      temperature: 0.5,
      system:
        SYSTEM_PROMPT +
        (profile
          ? `\n\nPREFERENZE UTENTE (rispettale, non citarle a voce):\n` +
            `${
              profile.neurotypes?.length
                ? `- Neurotipi: ${profile.neurotypes
                    .map((x) =>
                      x === "adhd"
                        ? "ADHD"
                        : x === "autism"
                          ? "Autismo"
                          : x === "dyslexia"
                            ? "Dislessia"
                            : x === "anxiety"
                              ? "Ansia"
                              : "Preferisco non dirlo"
                    )
                    .join(", ")}\n`
                : ""
            }` +
            `${
              profile.response_length
                ? `- Lunghezza risposte preferita: ${
                    profile.response_length === "very_short"
                      ? "Brevissime"
                      : profile.response_length === "detailed"
                        ? "Dettagliate quando serve"
                        : "Normali"
                  }\n`
                : ""
            }` +
            `${profile.name ? `- Nome: ${profile.name}\n` : ""}`
          : ""),
      messages
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

    // Secondary: extract task + quick replies (tool use, short + deterministic).
    const extractPrompt =
      "Estrai (se presente) UNA attività esplicita dall'ultimo messaggio dell'utente e suggerisci fino a 4 risposte rapide (dal punto di vista dell'utente), molto brevi, nella lingua dell'utente. " +
      "Se l'utente è sopraffatto o in blocco, proponi risposte come: Silenzio / Parlare / Aiuto concreto. " +
      "Se non utile, quick_replies può essere []. Non inventare scadenze.";

    const extract = await client.messages.create({
      model: MODELS.extract,
      max_tokens: 200,
      temperature: 0,
      system: extractPrompt,
      tools: [
        {
          name: "extract",
          description: "Estrae un eventuale task e suggerimenti di risposta rapida.",
          input_schema: {
            type: "object",
            properties: {
              has_task: { type: "boolean" },
              title: { type: "string" },
              due_date: { type: ["string", "null"], description: "ISO 8601 o null" },
              description: { type: ["string", "null"] },
              quick_replies: { type: "array", items: { type: "string" }, maxItems: 4 }
            },
            required: ["has_task", "title", "due_date", "description", "quick_replies"]
          }
        }
      ],
      tool_choice: { type: "tool", name: "extract" },
      messages: [
        {
          role: "user",
          content: `Messaggio utente:\n${last.content}\n\nRisposta assistente:\n${fullText}`
        }
      ]
    });

    const toolBlock = extract.content.find((b: any) => b && b.type === "tool_use" && b.name === "extract") as any;
    const toolInput = toolBlock?.input ?? null;
    if (toolInput) {
      const candidate = coerceTask(toolInput);
      candidate.quick_replies = clampQuickReplies(candidate.quick_replies);
      const safeTask = ExtractedTaskSchema.safeParse(candidate);
      if (safeTask.success) {
        writeSse(res, "task", JSON.stringify(safeTask.data));
        writeSse(res, "suggestions", JSON.stringify(safeTask.data.quick_replies));
      }
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

