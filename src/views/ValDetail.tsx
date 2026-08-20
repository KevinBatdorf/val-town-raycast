import { Action, ActionPanel, Color, Icon, Keyboard, List, Toast, showToast, useNavigation } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { getValDetail, listVals, webUrlFor } from "../lib/api";
import { errorMessage, formatDateTime, privacyIcon } from "../lib/format";
import { loadState } from "../lib/store";
import { prepareEntry, removeTool } from "../lib/tools";
import { BlobList } from "./BlobList";
import { FileList } from "./FileList";
import { HistoryList } from "./HistoryList";
import { SqliteQuery } from "./SqliteQuery";
import { ToolForm } from "./ToolForm";

export function ValDetail({ identifier }: { identifier: string }) {
  const { push } = useNavigation();
  const { data, isLoading, error, revalidate } = useCachedPromise(
    async (val: string) => {
      // `get_val_detail` returns no description, so the summary supplies it.
      const [detail, membership, state] = await Promise.all([
        getValDetail(val),
        listVals({ name: val.split("/")[1] }),
        loadState(),
      ]);
      const summary = membership.vals.find((candidate) => candidate.identifier === val);
      return { detail, summary, entry: state.tools[val] };
    },
    [identifier],
  );

  const detail = data?.detail;
  const entry = data?.entry;
  const isTool = entry !== undefined;
  const branches = detail?.branches?.items ?? [];
  const branchCount = detail?.branches?.count ?? branches.length;
  const branch = branches[0]?.name ?? "main";

  async function addAsTool() {
    const summary = data?.summary;
    if (!summary) return;

    const toast = await showToast({ style: Toast.Style.Animated, title: `Reading ${summary.name}` });
    try {
      const prepared = await prepareEntry(summary, entry);
      toast.hide();
      push(<ToolForm entry={prepared} onSaved={revalidate} />);
    } catch (mutationError) {
      toast.style = Toast.Style.Failure;
      toast.title = "Could not read this val";
      toast.message = errorMessage(mutationError);
    }
  }

  async function removeAsTool() {
    const toast = await showToast({ style: Toast.Style.Animated, title: "Removing" });
    try {
      await removeTool(identifier);
      toast.style = Toast.Style.Success;
      toast.title = "Removed from tools";
      revalidate();
    } catch (mutationError) {
      toast.style = Toast.Style.Failure;
      toast.title = "Could not remove";
      toast.message = errorMessage(mutationError);
    }
  }

  if (error) {
    return (
      <List navigationTitle={identifier}>
        <List.EmptyView
          icon={{ source: Icon.Warning, tintColor: Color.Red }}
          title="Could not load this val"
          description={errorMessage(error)}
        />
      </List>
    );
  }

  return (
    <List isLoading={isLoading} navigationTitle={identifier}>
      <List.Section title="Val">
        <List.Item
          icon={detail ? privacyIcon(detail.privacy) : Icon.Circle}
          title={identifier}
          subtitle={data?.summary?.description ?? undefined}
          accessories={[
            ...(isTool ? [{ tag: { value: "tool", color: Color.Purple } }] : []),
            { tag: detail?.privacy ?? "…" },
            { text: `${branchCount} branch${branchCount === 1 ? "" : "es"}` },
          ]}
          actions={
            <ActionPanel>
              <Action.OpenInBrowser title="Open on Val Town" url={detail?.htmlUrl ?? webUrlFor(identifier)} />
              <Action
                title={isTool ? "Edit Tool Details" : "Add as Tool"}
                icon={Icon.Stars}
                shortcut={{ modifiers: ["cmd"], key: "t" }}
                onAction={addAsTool}
              />
              {isTool ? (
                <Action
                  title="Remove from Tools"
                  icon={Icon.Trash}
                  style={Action.Style.Destructive}
                  shortcut={Keyboard.Shortcut.Common.Remove}
                  onAction={removeAsTool}
                />
              ) : null}
              <Action.CopyToClipboard title="Copy Identifier" content={identifier} />
            </ActionPanel>
          }
        />
      </List.Section>

      <List.Section title="Browse">
        <NavigationRow
          icon={Icon.Folder}
          title="Files"
          subtitle="Code, logs, traces and schedules"
          target={<FileList val={identifier} branch={branch} />}
        />
        <NavigationRow
          icon={Icon.Clock}
          title="History"
          subtitle="Commits on this branch"
          target={<HistoryList val={identifier} branch={branch} />}
        />
      </List.Section>

      <List.Section title="Data">
        <NavigationRow
          icon={Icon.List}
          title="SQLite"
          subtitle="Run a read-only query"
          target={<SqliteQuery val={identifier} />}
        />
        <NavigationRow
          icon={Icon.Box}
          title="Blobs"
          subtitle="This val's blob storage"
          target={<BlobList val={identifier} />}
        />
      </List.Section>

      {branchCount > 1 ? (
        <List.Section title="Branches">
          {branches.map((item) => (
            <List.Item
              key={item.name}
              icon={Icon.Tree}
              title={item.name}
              accessories={[{ text: `v${item.version}` }, { text: formatDateTime(item.updatedAt) }]}
              actions={
                <ActionPanel>
                  <Action.Push
                    title="Browse Files"
                    icon={Icon.Folder}
                    target={<FileList val={identifier} branch={item.name} />}
                  />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      ) : null}
    </List>
  );
}

function NavigationRow({
  icon,
  title,
  subtitle,
  target,
}: {
  icon: Icon;
  title: string;
  subtitle: string;
  target: React.ReactNode;
}) {
  return (
    <List.Item
      icon={icon}
      title={title}
      subtitle={subtitle}
      accessories={[{ icon: Icon.ChevronRight }]}
      actions={
        <ActionPanel>
          <Action.Push title={`Open ${title}`} icon={icon} target={target} />
        </ActionPanel>
      }
    />
  );
}
