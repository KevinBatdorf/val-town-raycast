import { syncTools } from "../lib/tools";

type Input = {
  /**
   * Re-read every tool's source before answering, instead of serving cached specs. Only worth
   * passing when a tool the user just changed looks out of date.
   */
  refresh?: boolean;
};

type ListedTool = {
  name: string;
  description: string;
  val: string;
  inputSchema: Record<string, unknown> | null;
  requiresConfirmation: boolean;
};

/** Syncing rather than reading the cache is what makes a val tagged a minute ago callable now. */
export default async function listTools(input: Input): Promise<{ tools: ListedTool[]; note?: string }> {
  const { state } = await syncTools({ force: input.refresh === true });

  const tools = Object.values(state.tools)
    .filter((entry) => entry.enabled && entry.spec?.filePath)
    .map((entry) => ({
      name: entry.spec?.name ?? entry.val,
      description: entry.spec?.description ?? "",
      val: entry.val,
      inputSchema: entry.spec?.inputSchema ?? null,
      requiresConfirmation: entry.requiresConfirmation,
    }));

  if (tools.length === 0) {
    return {
      tools: [],
      note: "The user has no callable Val Town tools. They add one by tagging a val 'raycast-tool' in this extension's Search Vals command, and giving it an http file if it needs to take arguments.",
    };
  }

  return { tools };
}
