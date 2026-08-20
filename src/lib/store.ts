import { listOrgs, readBlob, storeBlob, type BlobStorage } from "./api";
import { McpError } from "./mcp";

export const STATE_KEY = "raycast:tools.json";

export type JsonSchema = {
  type?: string;
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
};

export type ToolSpec = {
  name: string;
  description: string;
  inputSchema: JsonSchema | null;
  filePath: string | null;
  endpoint: string | null;
  method: "GET" | "POST";
  descriptionSource: "readme" | "val";
  restricted: boolean;
};

export type ToolEntry = {
  val: string;
  spec: ToolSpec | null;
  enabled: boolean;
  requiresConfirmation: boolean;
  /** A hand-edited spec survives syncing until the user re-derives it. */
  edited: boolean;
  derivedAt: string | null;
  addedAt: string | null;
  error: string | null;
};

export type SkillEntry = {
  val: string;
  /** Always `skills/<name>/SKILL.md`. */
  path: string;
  name: string;
  description: string;
  enabled: boolean;
  addedAt: string;
};

export type BuiltinEntry = {
  enabled: boolean;
  requiresConfirmation: boolean;
};

export type WatchedFile = {
  val: string;
  fileId: string;
  path: string;
};

export type ExtensionState = {
  version: 2;
  lastSync: string | null;
  /** Keyed by `handle/valName`. This key set is the collection: nothing else decides membership. */
  tools: Record<string, ToolEntry>;
  skills: Record<string, SkillEntry>;
  builtins: Record<string, BuiltinEntry>;
  watchedFiles: WatchedFile[];
  /** Newest failure the user acknowledged, per file, so a restart does not re-badge it. */
  reportedFailures: Record<string, string>;
};

export function emptyState(): ExtensionState {
  return {
    version: 2,
    lastSync: null,
    tools: {},
    skills: {},
    builtins: {},
    watchedFiles: [],
    reportedFailures: {},
  };
}

export function skillKey(val: string, path: string): string {
  return `${val}:${path}`;
}

let cachedHandle: string | null = null;

export async function personalHandle(signal?: AbortSignal): Promise<string> {
  if (cachedHandle) return cachedHandle;
  const { user, orgs } = await listOrgs(signal);
  const handle = orgs.find((org) => org.isPersonal)?.handle ?? user.handle;
  cachedHandle = handle;
  return handle;
}

/** LocalStorage is device-local, and a free-tier account can only create public vals. */
async function stateStorage(signal?: AbortSignal): Promise<BlobStorage> {
  return { type: "deprecated_global", org: await personalHandle(signal) };
}

export async function loadState(signal?: AbortSignal): Promise<ExtensionState> {
  const storage = await stateStorage(signal);

  let raw: string | undefined;
  try {
    raw = (await readBlob(storage, STATE_KEY, signal)).content;
  } catch (error) {
    // Swallowing anything but a missing blob would report a rejected token as an empty collection.
    if (error instanceof McpError && /not found/i.test(error.message)) return emptyState();
    throw error;
  }
  if (!raw) return emptyState();

  try {
    return migrate(JSON.parse(raw) as Partial<ExtensionState>);
  } catch {
    return emptyState();
  }
}

/** Version 1 filled `tools` from the `raycast-tool` tag, so its entries are still the collection. */
function migrate(stored: Partial<ExtensionState>): ExtensionState {
  const tools = Object.fromEntries(
    Object.entries(stored.tools ?? {}).map(([identifier, entry]) => [
      identifier,
      { ...entry, addedAt: entry.addedAt ?? entry.derivedAt ?? null },
    ]),
  );

  return { ...emptyState(), ...stored, tools, version: 2 };
}

export async function saveState(state: ExtensionState): Promise<void> {
  const storage = await stateStorage();
  await storeBlob(storage, STATE_KEY, JSON.stringify(state));
}

export async function mutateState(mutate: (state: ExtensionState) => ExtensionState): Promise<ExtensionState> {
  const next = mutate(await loadState());
  await saveState(next);
  return next;
}

export function isWatched(state: ExtensionState, fileId: string): boolean {
  return state.watchedFiles.some((file) => file.fileId === fileId);
}
