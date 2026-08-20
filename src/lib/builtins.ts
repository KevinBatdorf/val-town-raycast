import { loadState, type BuiltinEntry, type ExtensionState } from "./store";

/** Descriptions are generated from the tool schemas at build time, so a row carries only switches. */
export type BuiltinTool = {
  /** Matches the tool's `name` in `package.json`. */
  id: string;
  title: string;
  summary: string;
  /** Reads never ask. Anything that runs or writes carries the toggle. */
  confirmable: boolean;
};

// `list-tools` has no row: turning it off would leave every other tool unreachable.
export const BUILTIN_TOOLS: BuiltinTool[] = [
  {
    id: "get-val-info",
    title: "Read Val",
    summary: "Reads a val's file listing and source. Never asks first.",
    confirmable: false,
  },
  {
    id: "execute-tool",
    title: "Run Val",
    summary: "Runs one of the vals below, by endpoint or run_file.",
    confirmable: true,
  },
  {
    id: "load-skill",
    title: "Load Skill",
    summary: "Loads one of your skills so the model can follow it. Never asks first.",
    confirmable: false,
  },
];

export function builtinFor(id: string): BuiltinTool | undefined {
  return BUILTIN_TOOLS.find((tool) => tool.id === id);
}

export function builtinSettings(state: ExtensionState, id: string): BuiltinEntry {
  return state.builtins[id] ?? { enabled: true, requiresConfirmation: builtinFor(id)?.confirmable === true };
}

/** The model relays a thrown tool error to the user verbatim, so a refusal stays visible. */
export async function requireBuiltin(id: string): Promise<ExtensionState> {
  const state = await loadState();
  if (!builtinSettings(state, id).enabled) {
    throw new Error(`The user turned "${builtinFor(id)?.title ?? id}" off in the Val Town extension's Manage Tools.`);
  }
  return state;
}
