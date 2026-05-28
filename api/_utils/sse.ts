function getAllowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isOriginAllowed(origin: string, allowed: string[]) {
  if (!origin) return false;
  if (allowed.length === 0) return false;
  return allowed.includes(origin);
}

export function setCors(req: any, res: any) {
  const origin = (req?.headers?.origin ?? "") as string;
  const allowed = getAllowedOrigins();

  if (isOriginAllowed(origin, allowed)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    // Avoid caches mixing responses across origins.
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export function handleOptions(req: any, res: any) {
  if (req.method === "OPTIONS") {
    setCors(req, res);
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

export function writeSse(res: any, event: string, data: string) {
  res.write(`event: ${event}\n`);
  for (const line of data.replace(/\r/g, "").split("\n")) {
    res.write(`data: ${line}\n`);
  }
  res.write("\n");
}

