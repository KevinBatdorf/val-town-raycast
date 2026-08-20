/** The MCP endpoint frames even a single stateless call as SSE, so the envelope is the last `data:` line. */
export function parseEventStream(body: string): unknown {
  const dataLines = body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim());

  const payload = dataLines.length > 0 ? dataLines[dataLines.length - 1] : body.trim();
  if (!payload) throw new Error("Val Town returned an empty response");

  try {
    return JSON.parse(payload);
  } catch {
    throw new Error("Could not parse the response from Val Town");
  }
}
