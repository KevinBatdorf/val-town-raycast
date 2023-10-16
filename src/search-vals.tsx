import { useState } from "react";
import { Action, ActionPanel, Icon, List, openExtensionPreferences } from "@raycast/api";
import { useRuns } from "./hooks/useRuns";
import { Runs } from "./components/Runs";
import { MyVals } from "./components/MyVals";
import { useSearchVals } from "./hooks/useSearchVals";
import { SearchedVals } from "./components/SearchedVals";
import { MyLikedVals } from "./components/MyLikedVals";
import { MyReferencedVals } from "./components/MyReferencedVals";
import { Run } from "./types";

export default function ValTown() {
  const [searchText, setSearchText] = useState("");
  const { vals: searchedVals, isLoading: isSearching } = useSearchVals(searchText);
  const [showDetail, setShowDetail] = useState(false);
  const { isLoading, runs, error } = useRuns();
  const runsFiltered = (runs || [])
    .filter((v) => v.val)
    // TODO: if the api adds output or better info, then dont filter duplicates
    .filter((v, i, a) => a.findIndex((t) => t.val.id === v.val.id) === i);

  return (
    <List
      searchBarPlaceholder="Search public vals"
      navigationTitle={searchText ? "Search Results" : "Recent Runs"}
      isLoading={isSearching || isLoading}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      isShowingDetail={showDetail}
      // Close the detail view when the selection changes to "My Vals"
      onSelectionChange={(id) => setShowDetail((v) => (id === "my-vals" ? false : v))}
      throttle
    >
      {searchText && searchedVals ? (
        <SearchedVals vals={searchedVals} isShowingDetail={showDetail} setShowDetail={setShowDetail} />
      ) : (
        <MainList runs={runsFiltered} error={error} isShowingDetail={showDetail} setShowingDetail={setShowDetail} />
      )}
    </List>
  );
}

const MainList = ({
  runs,
  isShowingDetail,
  setShowingDetail,
  error,
}: {
  runs: Run[];
  isShowingDetail: boolean;
  setShowingDetail: React.Dispatch<React.SetStateAction<boolean>>;
  error: Error | undefined;
}) => {
  if (error)
    return (
      <List.EmptyView
        icon={Icon.Footprints}
        title="Error"
        actions={
          <ActionPanel>
            <Action title="Open Extension Preferences" onAction={openExtensionPreferences} />
          </ActionPanel>
        }
        description={error.message === "Unauthorized" ? "Bad API Token" : error.message}
      />
    );

  return (
    <>
      <MyVals />
      <MyLikedVals />
      <MyReferencedVals />
      {runs?.length > 0 ? (
        <List.Section title="Recent Runs">
          <Runs runs={runs} isShowingDetail={isShowingDetail} setShowDetail={setShowingDetail} />
        </List.Section>
      ) : null}
    </>
  );
};