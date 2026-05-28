import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";
import { handleOptions, setCors, writeSse } from "./_utils/sse";

type ExtractedTask = {
  has_task: boolean;
  title: string;
  due_date: string | null;
  description: string | null;
};

const SYSTEM_PROMPT = `Tu sei un assistente personale per persone neurodivergenti.
VOICE: Diretta, pragmatica, energica, non-giudicante.
CORE: Risposte brevi (max 70 parole), una domanda se vago, supportivo se overwhelm.
EXTRACT TASKS: Se menzioni un task, offri di aggiungerlo al calendario.`;

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
  setCors(res);

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Missing ANTHROPIC_API_KEY on server." });
    return;
  }

  const message = (req.body?.message ?? "").toString().trim();
  if (!message) {
    res.status(400).json({ error: "Missing message." });
    return;
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  // @ts-expect-error - Node response supports flushHeaders in Vercel runtime
  res.flushHeaders?.();

  const client = new Anthropic({ apiKey });

  try {
    const stream = await client.messages.stream({
      model: "claude-3-5-sonnet-latest",
      max_tokens: 400,
      temperature: 0.5,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: message }]
    });

    let fullText = "";

    stream.on("text", (t) => {
      fullText += t;
      writeSse(res, "delta", t);
    });

    stream.on("error", (err) => {
      writeSse(res, "error", (err as Error).message || "Claude streaming error.");
    });

    await stream.finalMessage();

    // Secondary: extract task JSON (non-streaming, short + deterministic).
    const extract = await client.messages.create({
      model: "claude-3-5-sonnet-latest",
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
    if (parsed) writeSse(res, "task", JSON.stringify(coerceTask(parsed)));

    writeSse(res, "done", "1");
    res.end();
  } catch (e) {
    writeSse(res, "error", (e as Error).message || "Chat failed.");
    writeSse(res, "done", "1");
    res.end();
  }
}

