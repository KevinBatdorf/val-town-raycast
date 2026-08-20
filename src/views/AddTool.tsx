import { Action, ActionPanel, Color, Icon, List, Toast, showToast, useNavigation } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useState } from "react";
import { listVals } from "../lib/api";
import { errorMessage, privacyIcon } from "../lib/format";
import { loadState } from "../lib/store";
import { prepareEntry } from "../lib/tools";
import type { ValSummary } from "../lib/types";
import { ToolForm } from "./ToolForm";

export function AddTool({ onAdded }: { onAdded: () => void }) {
  const { push } = useNavigation();
  const [searchText, setSearchText] = useState("");

  const { data, isLoading, error } = useCachedPromise(
    async (text: string) => {
      const [{ vals }, state] = await Promise.all([listVals({ name: text.trim() || undefined }), loadState()]);
      return { vals, collected: state.tools };
    },
    [searchText],
    { keepPreviousData: true },
  );

  async function pick(val: ValSummary) {
    const toast = await showToast({ style: Toast.Style.Animated, title: `Reading ${val.name}` });
    try {
      const entry = await prepareEntry(val, data?.collected[val.identifier]);
      toast.hide();
      push(<ToolForm entry={entry} onSaved={onAdded} />);
    } catch (derivationError) {
      toast.style = Toast.Style.Failure;
      toast.title = "Could not read this val";
      toast.message = errorMessage(derivationError);
    }
  }

  return (
    <List
      isLoading={isLoading}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      throttle
      navigationTitle="Add Tool"
      searchBarPlaceholder="Search your vals"
    >
      {error ? (
        <List.EmptyView
          icon={{ source: Icon.Warning, tintColor: Color.Red }}
          title="Could not load your vals"
          description={errorMessage(error)}
        />
      ) : (
        <>
          <List.EmptyView icon={Icon.MagnifyingGlass} title="No vals found" description="Try a different search." />
          {(data?.vals ?? []).map((val) => {
            const already = data?.collected[val.identifier] !== undefined;
            return (
              <List.Item
                key={val.id}
                icon={{ source: privacyIcon(val.privacy), tintColor: already ? Color.Purple : Color.SecondaryText }}
                title={val.name}
                subtitle={val.description ?? undefined}
                accessories={already ? [{ tag: { value: "added", color: Color.Purple } }] : undefined}
                actions={
                  <ActionPanel>
                    <Action
                      title={already ? "Edit Tool Details" : "Set Tool Details"}
                      icon={Icon.Stars}
                      onAction={() => pick(val)}
                    />
                    <Action.OpenInBrowser title="Open on Val Town" url={val.links.html} />
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
