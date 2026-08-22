import { AI, environment } from "@raycast/api";
import { listFiles, readFile } from "./api";
import type { JsonSchema } from "./store";
import type { ValFile } from "./types";

export function canIntrospect(): boolean {
  return environment.canAccess(AI);
}

const PROMPT = `You are reading the source of a Val Town HTTP handler.

Return a JSON Schema describing the JSON request body this handler reads — query parameters count too.
Rules:
- Output JSON only. No prose, no code fence.
- Shape: {"type":"object","properties":{...},"required":[...]}
- Give every property a "type" and a short "description".
- If the handler reads nothing off the request, return {"type":"object","properties":{}}.

Source:
`;

/**
 * The model reads the code because that is where the interface is; a README rarely repeats it.
 * Null means the val takes nothing — a val with no http file has no request body to describe, which
 * is an answer rather than a failure.
 */
export async function introspect(val: string, signal?: AbortSignal): Promise<JsonSchema | null> {
  const { files } = await listFiles(val, {}, signal);
  const entry = pickHttpFile(files);
  if (!entry) return null;

  const { content } = await readFile(val, entry.path, {}, signal);
  const answer = await AI.ask(`${PROMPT}${content.slice(0, 24000)}`, { creativity: 0 });

  return parseSchema(answer);
}

export function pickHttpFile(files: ValFile[]): ValFile | undefined {
  const httpFiles = files.filter((file) => file.type === "http");
  return httpFiles.find((file) => /^main\./.test(file.name)) ?? httpFiles[0];
}

/** Models fence their JSON often enough that stripping it is cheaper than re-asking. */
function parseSchema(answer: string): JsonSchema {
  const fenced = /```(?:json)?\s*\n([\s\S]*?)```/i.exec(answer);
  const body = (fenced ? fenced[1] : answer).trim();

  const parsed = JSON.parse(body) as JsonSchema;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
  return { type: "object", properties: {}, ...parsed };
}
