import { Action, ActionPanel, Color, Icon, Keyboard, List, Toast, showToast, useNavigation } from "@raycast/api";
import { useCachedPromise, useCachedState } from "@raycast/utils";
import { useState } from "react";
import { listVals } from "./lib/api";
import { errorMessage, privacyIcon } from "./lib/format";
import { loadState, type ToolEntry } from "./lib/store";
import { prepareEntry, removeTool } from "./lib/tools";
import type { ValSummary } from "./lib/types";
import { ToolForm } from "./views/ToolForm";
import { ValDetail } from "./views/ValDetail";

type Scope = "vals" | "tools";

export default function SearchVals() {
  const [searchText, setSearchText] = useState("");
  const [scope, setScope] = useCachedState<Scope>("search-scope", "vals");

  const { data, isLoading, error, revalidate } = useCachedPromise(
    async (text: string) => {
      const [{ vals }, state] = await Promise.all([listVals({ name: text.trim() || undefined }), loadState()]);
      return { vals, collected: state.tools };
    },
    [searchText],
    { keepPreviousData: true },
  );

  const collected = data?.collected ?? {};
  const vals = (data?.vals ?? []).filter((val) => scope === "vals" || val.identifier in collected);

  return (
    <List
      isLoading={isLoading}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      throttle
      searchBarPlaceholder={scope === "tools" ? "Search the vals you added as tools" : "Search your vals"}
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
            title={scope === "tools" ? "No vals added as tools" : "No vals found"}
            description={scope === "tools" ? "Add one with ⌘T here, or from Manage Tools." : "Try a different search."}
          />
          {vals.map((val) => (
            <ValRow key={val.id} val={val} entry={collected[val.identifier]} onChanged={revalidate} />
          ))}
        </>
      )}
    </List>
  );
}

function ValRow({ val, entry, onChanged }: { val: ValSummary; entry?: ToolEntry; onChanged: () => void }) {
  const { push } = useNavigation();
  const isTool = entry !== undefined;

  async function add() {
    const toast = await showToast({ style: Toast.Style.Animated, title: `Reading ${val.name}` });
    try {
      const prepared = await prepareEntry(val, entry);
      toast.hide();
      push(<ToolForm entry={prepared} onSaved={onChanged} />);
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Could not read this val";
      toast.message = errorMessage(error);
    }
  }

  async function remove() {
    const toast = await showToast({ style: Toast.Style.Animated, title: "Removing" });
    try {
      await removeTool(val.identifier);
      toast.style = Toast.Style.Success;
      toast.title = `Removed ${val.name}`;
      onChanged();
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Could not remove";
      toast.message = errorMessage(error);
    }
  }

  return (
    <List.Item
      icon={{ source: privacyIcon(val.privacy), tintColor: isTool ? Color.Purple : Color.SecondaryText }}
      title={val.name}
      subtitle={val.description ?? undefined}
      accessories={[
        ...(isTool ? [{ tag: { value: "tool", color: Color.Purple } }] : []),
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
              title={isTool ? "Edit Tool Details" : "Add as Tool"}
              icon={Icon.Stars}
              shortcut={{ modifiers: ["cmd"], key: "t" }}
              onAction={add}
            />
            {isTool ? (
              <Action
                title="Remove from Tools"
                icon={Icon.Trash}
                style={Action.Style.Destructive}
                shortcut={Keyboard.Shortcut.Common.Remove}
                onAction={remove}
              />
            ) : null}
          </ActionPanel.Section>
          <ActionPanel.Section>
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
