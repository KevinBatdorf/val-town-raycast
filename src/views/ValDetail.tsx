import { Action, ActionPanel, Color, Icon, List, Toast, showToast } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { getValDetail, listVals, TOOL_TAG, updateValTags, webUrlFor } from "../lib/api";
import { errorMessage, formatDateTime, privacyIcon } from "../lib/format";
import { AccessList } from "./AccessList";
import { BlobList } from "./BlobList";
import { FileList } from "./FileList";
import { HistoryList } from "./HistoryList";
import { SqliteQuery } from "./SqliteQuery";

export function ValDetail({ identifier }: { identifier: string }) {
  const { data, isLoading, error, revalidate } = useCachedPromise(
    async (val: string) => {
      const [detail, membership] = await Promise.all([getValDetail(val), listVals({ name: val.split("/")[1] })]);
      const summary = membership.vals.find((candidate) => candidate.identifier === val);
      return { detail, tags: summary?.tags ?? [], description: summary?.description ?? null };
    },
    [identifier],
  );

  const detail = data?.detail;
  const tags = data?.tags ?? [];
  const isTool = tags.includes(TOOL_TAG);
  const branch = detail?.branches.items[0]?.name ?? "main";

  async function toggleTag() {
    const toast = await showToast({ style: Toast.Style.Animated, title: isTool ? "Removing tag" : "Adding tag" });
    try {
      const next = isTool ? tags.filter((tag) => tag !== TOOL_TAG) : [...tags, TOOL_TAG];
      await updateValTags(identifier, next);
      toast.style = Toast.Style.Success;
      toast.title = isTool ? `Removed ${TOOL_TAG}` : `Tagged ${TOOL_TAG}`;
      revalidate();
    } catch (mutationError) {
      toast.style = Toast.Style.Failure;
      toast.title = "Could not update tags";
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
          subtitle={data?.description ?? undefined}
          accessories={[
            ...(isTool ? [{ tag: { value: "tool", color: Color.Purple } }] : []),
            { tag: detail?.privacy ?? "…" },
            { text: `${detail?.branches.count ?? 0} branch${detail?.branches.count === 1 ? "" : "es"}` },
          ]}
          actions={
            <ActionPanel>
              <Action.OpenInBrowser title="Open on Val Town" url={detail?.htmlUrl ?? webUrlFor(identifier)} />
              <Action
                title={isTool ? `Remove ${TOOL_TAG} Tag` : `Tag as ${TOOL_TAG}`}
                icon={isTool ? Icon.StarDisabled : Icon.Stars}
                shortcut={{ modifiers: ["cmd"], key: "t" }}
                onAction={toggleTag}
              />
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
        <NavigationRow
          icon={Icon.Key}
          title="Access"
          subtitle="Granted orgs and bypass tokens"
          target={<AccessList val={identifier} />}
        />
      </List.Section>

      {detail && detail.branches.count > 1 ? (
        <List.Section title="Branches">
          {detail.branches.items.map((item) => (
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
