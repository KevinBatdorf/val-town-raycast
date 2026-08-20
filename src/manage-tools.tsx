import { Action, ActionPanel, Color, Icon, List, Toast, showToast, Keyboard } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { TOOL_TAG, webUrlFor } from "./lib/api";
import { errorMessage } from "./lib/format";
import { mutateState, type ToolEntry } from "./lib/store";
import { statusOf, syncTools, type SpecStatus } from "./lib/tools";
import { ToolDetail } from "./views/ToolDetail";

const STATUS_LABEL: Record<SpecStatus, { text: string; color: Color; icon: Icon }> = {
  ok: { text: "ok", color: Color.Green, icon: Icon.CheckCircle },
  "no-schema": { text: "no schema", color: Color.Yellow, icon: Icon.QuestionMark },
  "not-callable": { text: "not callable", color: Color.Orange, icon: Icon.MinusCircle },
  stale: { text: "stale", color: Color.Blue, icon: Icon.Clock },
  failed: { text: "failed", color: Color.Red, icon: Icon.XMarkCircle },
};

export default function ManageTools() {
  const { data, isLoading, error, revalidate, mutate } = useCachedPromise(() => syncTools(), [], {
    keepPreviousData: true,
  });

  const entries = Object.values(data?.state.tools ?? {}).sort((a, b) => a.val.localeCompare(b.val));

  async function resync(force: boolean) {
    const toast = await showToast({ style: Toast.Style.Animated, title: force ? "Re-deriving specs" : "Syncing" });
    try {
      const result = await syncTools({ force });
      await mutate(Promise.resolve(result), { optimisticUpdate: () => result, shouldRevalidateAfter: false });
      toast.style = Toast.Style.Success;
      toast.title = `${Object.keys(result.state.tools).length} tools`;
      toast.message = `${result.derived} derived, ${result.removed} removed`;
    } catch (syncError) {
      toast.style = Toast.Style.Failure;
      toast.title = "Sync failed";
      toast.message = errorMessage(syncError);
    }
  }

  async function toggle(entry: ToolEntry, field: "enabled" | "requiresConfirmation") {
    try {
      const next = await mutateState((state) => ({
        ...state,
        tools: { ...state.tools, [entry.val]: { ...entry, [field]: !entry[field] } },
      }));
      const result = { state: next, derived: 0, removed: 0 };
      await mutate(Promise.resolve(result), { optimisticUpdate: () => result, shouldRevalidateAfter: false });
    } catch (mutationError) {
      await showToast({ style: Toast.Style.Failure, title: "Could not save", message: errorMessage(mutationError) });
    }
  }

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Filter tools" isShowingDetail={entries.length > 0}>
      {error ? (
        <List.EmptyView
          icon={{ source: Icon.Warning, tintColor: Color.Red }}
          title="Could not sync your tools"
          description={errorMessage(error)}
          actions={
            <ActionPanel>
              <Action title="Try Again" icon={Icon.ArrowClockwise} onAction={revalidate} />
            </ActionPanel>
          }
        />
      ) : (
        <>
          <List.EmptyView
            icon={Icon.Stars}
            title="No tools yet"
            description={`Tag a val ${TOOL_TAG} in Search Vals and it shows up here.`}
            actions={
              <ActionPanel>
                <Action title="Sync" icon={Icon.ArrowClockwise} onAction={() => resync(false)} />
              </ActionPanel>
            }
          />
          {entries.map((entry) => {
            const status = STATUS_LABEL[statusOf(entry)];
            return (
              <List.Item
                key={entry.val}
                icon={{ source: status.icon, tintColor: entry.enabled ? status.color : Color.SecondaryText }}
                title={entry.spec?.name ?? entry.val.split("/")[1]}
                subtitle={entry.val}
                accessories={[
                  ...(entry.requiresConfirmation ? [{ icon: Icon.Shield, tooltip: "Asks before running" }] : []),
                  ...(entry.edited ? [{ icon: Icon.Pencil, tooltip: "Hand-edited spec" }] : []),
                  { tag: { value: entry.enabled ? status.text : "off", color: status.color } },
                ]}
                detail={<ToolDetailPane entry={entry} />}
                actions={
                  <ActionPanel>
                    <ActionPanel.Section>
                      <Action.Push
                        title="Open Spec"
                        icon={Icon.Eye}
                        target={<ToolDetail entry={entry} onChanged={revalidate} />}
                      />
                      <Action
                        title={entry.enabled ? "Disable" : "Enable"}
                        icon={entry.enabled ? Icon.CircleDisabled : Icon.CheckCircle}
                        shortcut={Keyboard.Shortcut.Common.Edit}
                        onAction={() => toggle(entry, "enabled")}
                      />
                      <Action
                        title={entry.requiresConfirmation ? "Stop Asking First" : "Ask Before Running"}
                        icon={Icon.Shield}
                        shortcut={{ modifiers: ["cmd", "shift"], key: "a" }}
                        onAction={() => toggle(entry, "requiresConfirmation")}
                      />
                    </ActionPanel.Section>
                    <ActionPanel.Section>
                      <Action
                        title="Sync"
                        icon={Icon.ArrowClockwise}
                        shortcut={Keyboard.Shortcut.Common.Refresh}
                        onAction={() => resync(false)}
                      />
                      <Action
                        title="Re-Derive All Specs"
                        icon={Icon.Repeat}
                        shortcut={{ modifiers: ["cmd", "shift"], key: "r" }}
                        onAction={() => resync(true)}
                      />
                      <Action.OpenInBrowser title="Open on Val Town" url={webUrlFor(entry.val)} />
                    </ActionPanel.Section>
                  </ActionPanel>
                }
              />
            );
          })}
        </>
      )}
    </List>
  );
}

function ToolDetailPane({ entry }: { entry: ToolEntry }) {
  const schema = entry.spec?.inputSchema;
  const markdown = [
    `## ${entry.spec?.name ?? entry.val}`,
    entry.error ? `> ${entry.error}` : (entry.spec?.description ?? "_No description derived._"),
    schema
      ? `### Input\n\n\`\`\`json\n${JSON.stringify(schema, null, 2)}\n\`\`\``
      : "### Input\n\n_Takes no arguments._",
  ]
    .filter(Boolean)
    .join("\n\n");

  return (
    <List.Item.Detail
      markdown={markdown}
      metadata={
        <List.Item.Detail.Metadata>
          <List.Item.Detail.Metadata.Label title="Val" text={entry.val} />
          <List.Item.Detail.Metadata.Label
            title="Called via"
            text={entry.spec?.endpoint ? "HTTP endpoint" : "run_file"}
          />
          <List.Item.Detail.Metadata.Label title="File" text={entry.spec?.filePath ?? "—"} />
          <List.Item.Detail.Metadata.Separator />
          <List.Item.Detail.Metadata.Label title="Enabled" text={entry.enabled ? "Yes" : "No"} />
          <List.Item.Detail.Metadata.Label title="Asks first" text={entry.requiresConfirmation ? "Yes" : "No"} />
        </List.Item.Detail.Metadata>
      }
    />
  );
}
