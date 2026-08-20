import { Action, ActionPanel, Color, Icon, List, Toast, showToast, Keyboard } from "@raycast/api";
import { useCachedPromise, useCachedState } from "@raycast/utils";
import { useCallback, useState } from "react";
import { listVals, TOOL_TAG, updateValTags } from "./lib/api";
import { errorMessage, privacyIcon } from "./lib/format";
import type { ValSummary } from "./lib/types";
import { ValDetail } from "./views/ValDetail";

type Scope = "vals" | "tools";

export default function SearchVals() {
  const [searchText, setSearchText] = useState("");
  const [scope, setScope] = useCachedState<Scope>("search-scope", "vals");

  const { data, isLoading, error, revalidate } = useCachedPromise(
    async (text: string, currentScope: Scope) => {
      const response = await listVals({
        name: text.trim() || undefined,
        tag: currentScope === "tools" ? TOOL_TAG : undefined,
      });
      return response.vals;
    },
    [searchText, scope],
    { keepPreviousData: true, initialData: [] },
  );

  const vals = data ?? [];

  return (
    <List
      isLoading={isLoading}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      throttle
      searchBarPlaceholder={scope === "tools" ? `Search vals tagged ${TOOL_TAG}` : "Search your vals"}
      searchBarAccessory={
        <List.Dropdown tooltip="Scope" value={scope} onChange={(value) => setScope(value as Scope)}>
          <List.Dropdown.Item title="Vals" value="vals" icon={Icon.Code} />
          <List.Dropdown.Item title="Tools" value="tools" icon={Icon.Stars} />
        </List.Dropdown>
      }
    >
      {error ? (
        <List.EmptyView
          icon={{ source: Icon.Warning, tintColor: Color.Red }}
          title="Could not load your vals"
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
            icon={scope === "tools" ? Icon.Stars : Icon.MagnifyingGlass}
            title={scope === "tools" ? "No vals tagged as tools" : "No vals found"}
            description={
              scope === "tools"
                ? `Tag a val ${TOOL_TAG} to make it callable from Raycast AI.`
                : "Try a different search."
            }
          />
          {vals.map((val) => (
            <ValRow key={val.id} val={val} onChanged={revalidate} />
          ))}
        </>
      )}
    </List>
  );
}

function ValRow({ val, onChanged }: { val: ValSummary; onChanged: () => void }) {
  const isTool = val.tags.includes(TOOL_TAG);

  const toggleTag = useCallback(async () => {
    const toast = await showToast({ style: Toast.Style.Animated, title: isTool ? "Removing tag" : "Adding tag" });
    try {
      const tags = isTool ? val.tags.filter((tag) => tag !== TOOL_TAG) : [...val.tags, TOOL_TAG];
      await updateValTags(val.identifier, tags);
      toast.style = Toast.Style.Success;
      toast.title = isTool ? `Removed ${TOOL_TAG}` : `Tagged ${TOOL_TAG}`;
      onChanged();
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Could not update tags";
      toast.message = errorMessage(error);
    }
  }, [isTool, val.identifier, val.tags, onChanged]);

  return (
    <List.Item
      icon={{ source: privacyIcon(val.privacy), tintColor: isTool ? Color.Purple : Color.SecondaryText }}
      title={val.name}
      subtitle={val.description ?? undefined}
      accessories={[
        ...(isTool ? [{ tag: { value: "tool", color: Color.Purple } }] : []),
        ...val.tags.filter((tag) => tag !== TOOL_TAG).map((tag) => ({ tag })),
        { date: new Date(val.createdAt), tooltip: `Created ${new Date(val.createdAt).toLocaleString()}` },
      ]}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <Action.Push title="Open Val" icon={Icon.ChevronRight} target={<ValDetail identifier={val.identifier} />} />
            <Action.OpenInBrowser title="Open on Val Town" url={val.links.html} />
          </ActionPanel.Section>
          <ActionPanel.Section>
            <Action
              title={isTool ? `Remove ${TOOL_TAG} Tag` : `Tag as ${TOOL_TAG}`}
              icon={isTool ? Icon.StarDisabled : Icon.Stars}
              shortcut={{ modifiers: ["cmd"], key: "t" }}
              onAction={toggleTag}
            />
            <Action.CopyToClipboard
              title="Copy Identifier"
              content={val.identifier}
              shortcut={Keyboard.Shortcut.Common.Pin}
            />
            <Action.CopyToClipboard
              title="Copy URL"
              content={val.links.html}
              shortcut={{ modifiers: ["cmd", "shift"], key: "." }}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}
