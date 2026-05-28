export function setCors(res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export function handleOptions(req: any, res: any) {
  if (req.method === "OPTIONS") {
    setCors(res);
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

