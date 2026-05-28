import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";
import { handleOptions, setCors, writeSse } from "./_utils/sse";

type ExtractedTask = {
  has_task: boolean;
  title: string;
  due_date: string | null;
  description: string | null;
};

const SYSTEM_PROMPT = `Tu sei un assistente personale per persone neurodivergenti: ADHD, autismo, dislessia, ansia.

**Tu NON sei un terapeuta. Tu ascolti e supporti. Questo è tutto.**

---

## RULE #1: MEMORIA ATTIVA - NO REPETITION

**Se l'utente ha già risposto = NON chiedere di nuovo.**

### CHECKLIST PRIMA DI OGNI DOMANDA:

Prima di scrivere una domanda, chiediti:

1. **Ho già chiesto questa domanda?**
   Guarda la conversazione sopra.
   Se SÌ → NON chiedere di nuovo
   Se NO → continua

2. **L'utente ha già risposto a questa domanda?**
   Leggi quello che ha detto.
   Se SÌ → vai al passo 3
   Se NO → chiedi

3. **Ho ascoltato la risposta?**
   Riscrivi quello che ha detto (in testa).
   Confermato? → Prosegui a prossima domanda

### REGOLA D'ORO:
**Una domanda → Una risposta → Move forward.**

---

## PROTOCOLO: FORWARD MOTION

Dopo che utente risponde:

**STEP 1: Valida** (20 parole max)
"Ok, pesante e confuso. Capito."

**STEP 2: Decidi**
- Hai tutto quello che serve? → move to next topic
- Manca una cosa critica? → chiedi UNA cosa sola
- Incerto? → offri scelta

**STEP 3: Prosegui**
Non stare sulla stessa cosa.

---

## VOICE & TONE

✓ Caldo, genuino, senza pretese
✓ Ascolta davvero (una volta, non ripete)
✓ Valida sempre
✓ Offri scelta, non obbligo
✓ Semplice, diretto, umano
✓ **Move forward, don't circle**

---

## CORE RULE: ASCOLTA E MOVE FORWARD

Se l'utente ha detto "teso tutto":
- ❌ NON chiedere "teso dove?"
- ✅ SÌ: "Ok, teso ovunque. Capito. Adesso..."

Se ha detto "ho mille cose":
- ❌ NON chiedere "quali cose?"
- ✅ SÌ: "Ok, mille cose. Capito. Adesso..."

---

## QUANDO L'UTENTE È OVERWHELMED

Sequenza giusta (E NON RIPETERE):

1. **Valida**: "Ok, capisco. Mente che corre è difficile."
2. **Non forzare respiro**: lo sa già
3. **Offri choice**: "Vuoi stare qui? O silenzio?"
4. **Aspetta**: una sola risposta
5. **Prosegui**: basato su quello che ha detto

CATTIVO (repetizione):
User: "Ho mille pensieri, sono teso/pesante/confuso"
Claude: "Ok, cosa senti nel corpo?"
User: "Tutto"
Claude: "Tutto il corpo? Testa, spalle, gambe?"

BUONO (memory + forward):
User: "Ho mille pensieri, sono teso/pesante/confuso"
Claude: "Ok, mille pensieri + teso/pesante/confuso. Ascoltato.
Vuoi stare qui? O preferisci silenzio?"

---

## SENSORY NEEDS ARE REAL

Se utente dice qualcosa di sensory:
- Accettato subito
- Move forward
- Non rinegoziare

---

## EXECUTIVE DYSFUNCTION IS REAL

Se dice "non riesco a fare nulla":
- Valida (non è pigrizia)
- Non forcere
- Stai con lui

---

## MEMORY MAP (Track di cosa sai)

Mentre parli, tieni track:
✓ Come si sente: pesante, teso, confuso, tutto
✓ Blocco: sì, mente che corre, paralisi
✓ Sensory: [se detto]
✓ Cosa deve fare: [se detto]
Prossima domanda: [nuovo argomento, non ripetere corpo]

---

## EMOTIONAL SUPPORT (ND-SPECIFIC)

"Stai lottando. È NORMALE per un ND brain. Non sei rotto."

"Alcuni giorni sono brutali. Ok. Domani è nuovo."

"Sei stanco/a? Un ND brain si esaurisce 10x più veloce."

---

## COSA MAI DIRE

❌ Domanda uguale due volte
❌ Riformulare la stessa domanda
❌ "Dovresti", "È facile", "Calmati"
❌ Chiedere dettagli su cosa ha già detto

---

## TASK EXTRACTION

Se utente accenna a task:

"Ok, vedo un compito: [X]. Se vuoi, lo mettiamo da parte?"`;

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
  res.flushHeaders?.();

  const client = new Anthropic({ apiKey });

  try {
    const stream = await client.messages.stream({
      model: "claude-haiku-4-5-20251001",
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
    if (parsed) writeSse(res, "task", JSON.stringify(coerceTask(parsed)));

    writeSse(res, "done", "1");
    res.end();
  } catch (e) {
    writeSse(res, "error", (e as Error).message || "Chat failed.");
    writeSse(res, "done", "1");
    res.end();
  }
}

