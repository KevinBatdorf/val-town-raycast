import { getPreferenceValues } from "@raycast/api";
import { parseEventStream } from "./sse";

const MCP_URL = "https://api.val.town/v3/mcp";

export class McpError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "McpError";
    this.status = status;
  }
}

let requestId = 0;

type JsonRpcResponse = {
  result?: unknown;
  error?: { message?: string; code?: number };
};

async function rpc(method: string, params: unknown, signal?: AbortSignal): Promise<unknown> {
  const { apiToken } = getPreferenceValues<Preferences>();
  const id = ++requestId;

  let response: Response;
  try {
    response = await fetch(MCP_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
      signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new McpError("Could not reach Val Town. Check your connection.");
  }

  if (response.status === 401 || response.status === 403) {
    throw new McpError("Val Town rejected your API token. Check it in extension preferences.", response.status);
  }

  const body = await response.text();

  if (!response.ok) {
    throw new McpError(body.slice(0, 400) || `Val Town returned ${response.status}`, response.status);
  }

  const envelope = parseEventStream(body, id) as JsonRpcResponse;
  if (envelope.error) throw new McpError(envelope.error.message ?? "Val Town returned an error");
  return envelope.result;
}

type ToolCallResult = {
  content?: { type: string; text?: string }[];
  isError?: boolean;
};

/** A few tools answer with prose rather than JSON, so a failed parse returns the raw text. */
export async function callTool<T>(name: string, args: Record<string, unknown> = {}, signal?: AbortSignal): Promise<T> {
  const text = await callToolText(name, args, signal);

  // Handing back undefined here renders as an empty view with nothing to explain it.
  if (!text) throw new McpError(`${name} returned nothing`);

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

/** For a tool whose success is an empty response, where no body is the expected answer. */
export async function callToolVoid(name: string, args: Record<string, unknown> = {}): Promise<void> {
  await callToolText(name, args);
}

async function callToolText(name: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<string> {
  const result = (await rpc("tools/call", { name, arguments: args }, signal)) as ToolCallResult;
  const text = result.content?.find((part) => part.type === "text")?.text ?? "";
  if (result.isError) throw new McpError(extractErrorMessage(text) ?? `${name} failed`);
  return text;
}

function extractErrorMessage(text: string): string | undefined {
  if (!text) return undefined;
  try {
    const parsed = JSON.parse(text) as { error?: string; message?: string };
    return parsed.error ?? parsed.message ?? text;
  } catch {
    return text;
  }
}
