import type { Tool } from "@raycast/api";
import { builtinSettings, requireBuiltin } from "../lib/builtins";
import { type ToolEntry } from "../lib/store";
import { executeTool as run } from "../lib/tools";

type Input = {
  /** The tool's `name` exactly as list-tools returned it. Never guess this. */
  name: string;
  /** The arguments as a JSON object string, matching the `inputSchema` from list-tools. */
  argumentsJson?: string;
};

export default async function executeTool(input: Input) {
  const { entry } = await resolve(input.name);
  const args = parseArgs(input.argumentsJson);
  const result = await run(entry, args);

  return {
    tool: input.name,
    val: entry.val,
    ok: result.ok,
    calledVia: result.via,
    status: result.status,
    output: result.output.slice(0, 40000),
    logs: result.logs,
  };
}

export const confirmation: Tool.Confirmation<Input> = async (input) => {
  const { entry, always } = await resolve(input.name);
  if (!always && !entry.requiresConfirmation) return undefined;

  return {
    title: `Run ${entry.spec?.name ?? entry.val}?`,
    message: entry.spec?.description,
    info: [
      { name: "Val", value: entry.val },
      ...(input.argumentsJson ? [{ name: "Arguments", value: input.argumentsJson }] : []),
    ],
  };
};

/** Either switch asking is enough: the built-in one covers every val, a val's own covers itself. */
async function resolve(name: string): Promise<{ entry: ToolEntry; always: boolean }> {
  const state = await requireBuiltin("execute-tool");
  const entries = Object.values(state.tools).filter((entry) => entry.enabled);

  const match =
    entries.find((entry) => entry.spec?.name === name) ??
    entries.find((entry) => entry.val === name) ??
    entries.find((entry) => entry.val.endsWith(`/${name}`));

  if (!match) {
    const available = entries.map((entry) => entry.spec?.name ?? entry.val).join(", ");
    throw new Error(`No active Val Town tool called "${name}". Available: ${available || "none"}.`);
  }
  return { entry: match, always: builtinSettings(state, "execute-tool").requiresConfirmation };
}

function parseArgs(raw: string | undefined): Record<string, unknown> | undefined {
  if (!raw || !raw.trim()) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    throw new Error("not an object");
  } catch {
    throw new Error('`argumentsJson` must be a JSON object, for example {"city":"Berlin"}.');
  }
}
