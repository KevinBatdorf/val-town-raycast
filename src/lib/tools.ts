import { endpointOf, listFiles, listVals, readFile, runFile } from "./api";
import { getPreferenceValues } from "@raycast/api";
import { firstJsonSchema, leadParagraph, toolNameFor } from "./readme";
import { loadState, mutateState, saveState, type ExtensionState, type ToolEntry, type ToolSpec } from "./store";
import type { FileType, ValFile, ValSummary } from "./types";

export type SpecStatus = "ok" | "stale" | "no-schema" | "not-callable" | "failed";

/** A plain `file` is data; `run_file` refuses it. */
const RUNNABLE_TYPES: FileType[] = ["http", "script", "interval", "email"];

/** Deriving here rather than per AI call saves three or four round trips each invocation. */
export async function deriveSpec(val: ValSummary, signal?: AbortSignal): Promise<ToolSpec> {
  const { files } = await listFiles(val.identifier, {}, signal);

  const httpFile = pickHttpFile(files);
  const runnable = httpFile ?? files.find((file) => RUNNABLE_TYPES.includes(file.type));
  const readme = files.find((file) => file.type === "file" && /^readme\.md$/i.test(file.name));

  let readmeBody: string | null = null;
  if (readme) {
    try {
      readmeBody = (await readFile(val.identifier, readme.path, {}, signal)).content;
    } catch {
      readmeBody = null;
    }
  }

  const fromReadme = readmeBody ? leadParagraph(readmeBody) : null;
  const inputSchema = readmeBody ? firstJsonSchema(readmeBody) : null;

  return {
    name: toolNameFor(val.name),
    description: fromReadme ?? val.description ?? `Runs the Val Town val ${val.identifier}.`,
    descriptionSource: fromReadme ? "readme" : "val",
    inputSchema,
    filePath: runnable?.path ?? null,
    endpoint: httpFile ? (endpointOf(httpFile) ?? null) : null,
    method: inputSchema ? "POST" : "GET",
    restricted: val.httpPrivacy === "restricted",
  };
}

function pickHttpFile(files: ValFile[]): ValFile | undefined {
  const httpFiles = files.filter((file) => file.type === "http");
  return httpFiles.find((file) => /^main\./.test(file.name)) ?? httpFiles[0];
}

export function statusOf(entry: ToolEntry): SpecStatus {
  if (entry.error) return "failed";
  if (!entry.spec) return "stale";
  if (!entry.spec.filePath) return "not-callable";
  if (!entry.spec.inputSchema) return "no-schema";
  return "ok";
}

export type SyncResult = {
  state: ExtensionState;
  derived: number;
};

/** Membership is the blob's key set, so a sync only refreshes specs. It never adds or drops one. */
export async function syncTools(options: { force?: boolean } = {}, signal?: AbortSignal): Promise<SyncResult> {
  const state = await loadState(signal);
  const identifiers = Object.keys(state.tools);
  if (identifiers.length === 0) return { state, derived: 0 };

  const startedAt = new Date().toISOString();
  const full = options.force || !state.lastSync;
  const { vals } = await listVals(full ? {} : { updatedAfter: state.lastSync ?? undefined }, signal);

  const stale = vals.filter((val) => val.identifier in state.tools);
  const toDerive = stale.filter((val) => {
    const existing = state.tools[val.identifier];
    // An entry that failed last time is retried, not cached — otherwise its error sticks forever.
    if (!existing.spec || existing.error) return true;
    return !existing.edited;
  });

  // Two round trips per val, so a first sync of a dozen tools serialises into two dozen waits.
  const freshlyDerived = await Promise.all(
    toDerive.map(async (val): Promise<[string, ToolEntry, boolean]> => {
      const existing = state.tools[val.identifier];

      try {
        const spec = await deriveSpec(val, signal);
        return [val.identifier, { ...existing, spec, edited: false, derivedAt: startedAt, error: null }, true];
      } catch (error) {
        return [
          val.identifier,
          { ...existing, error: error instanceof Error ? error.message : "Could not read this val" },
          false,
        ];
      }
    }),
  );

  const tools: Record<string, ToolEntry> = { ...state.tools };
  let derived = 0;
  for (const [identifier, entry, succeeded] of freshlyDerived) {
    tools[identifier] = entry;
    if (succeeded) derived += 1;
  }

  const next: ExtensionState = { ...state, tools, lastSync: startedAt };

  // A sync that found nothing new should cost one read, not a read and a write.
  if (derived > 0 || JSON.stringify(state.tools) !== JSON.stringify(tools)) {
    await saveState(next);
    return { state: next, derived };
  }

  return { state, derived };
}

export function newToolEntry(val: ValSummary, spec: ToolSpec | null, addedAt: string): ToolEntry {
  return {
    val: val.identifier,
    spec,
    enabled: true,
    requiresConfirmation: true,
    edited: false,
    derivedAt: spec ? addedAt : null,
    addedAt,
    error: null,
  };
}

/** Re-adding a collected val must not reset the switches the user already chose. */
export async function prepareEntry(val: ValSummary, existing?: ToolEntry): Promise<ToolEntry> {
  const spec = await deriveSpec(val);
  return { ...newToolEntry(val, spec, new Date().toISOString()), ...existing, spec };
}

export async function removeTool(identifier: string): Promise<ExtensionState> {
  return mutateState((state) => {
    const tools = { ...state.tools };
    delete tools[identifier];
    return { ...state, tools };
  });
}

export type ExecutionResult = {
  ok: boolean;
  via: "endpoint" | "run_file";
  status?: number;
  output: string;
  logs?: string[];
};

export async function executeTool(
  entry: ToolEntry,
  args: Record<string, unknown> | undefined,
): Promise<ExecutionResult> {
  const spec = entry.spec;
  if (!spec) throw new Error(`${entry.val} has no spec yet. Re-derive it in Manage Tools.`);
  if (!spec.filePath) throw new Error(`${entry.val} has no runnable file, so it cannot be called.`);

  const hasArgs = args !== undefined && Object.keys(args).length > 0;

  if (hasArgs && !spec.endpoint) {
    throw new Error(`${entry.val} takes no input: only http vals can be called with arguments.`);
  }

  if (spec.endpoint) {
    return callEndpoint(spec, spec.endpoint, args, hasArgs);
  }

  const result = await runFile(entry.val, spec.filePath);
  const logs = result.logs?.map((line) => `[${line.level}] ${line.log}`);
  const failed = result.type === "error";

  return {
    ok: !failed,
    via: "run_file",
    output: failed
      ? [result.message, result.stack].filter(Boolean).join("\n")
      : JSON.stringify(result.value ?? result, null, 2),
    logs,
  };
}

async function callEndpoint(
  spec: ToolSpec,
  endpoint: string,
  args: Record<string, unknown> | undefined,
  hasArgs: boolean,
): Promise<ExecutionResult> {
  const headers: Record<string, string> = { Accept: "application/json, text/plain" };

  // Only a restricted val needs the account token, so a public val's code never sees it.
  if (spec.restricted) {
    headers.Authorization = `Bearer ${getPreferenceValues<Preferences>().apiToken}`;
  }

  const method: "GET" | "POST" = hasArgs || spec.inputSchema ? "POST" : "GET";
  if (method === "POST") headers["Content-Type"] = "application/json";

  const response = await fetch(endpoint, {
    method,
    headers,
    body: method === "POST" ? JSON.stringify(args ?? {}) : undefined,
    redirect: "manual",
  });

  if (response.status >= 300 && response.status < 400) {
    throw new Error("This val's HTTP access is restricted, so Raycast could not reach its endpoint.");
  }

  const output = await response.text();
  return { ok: response.ok, via: "endpoint", status: response.status, output };
}
