import { Action, ActionPanel, Color, Detail, Icon, Toast, showToast, Keyboard } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { endpointOf, readFile, webUrlFor } from "../lib/api";
import { codeBlock, errorMessage, fileIcon, formatDateTime } from "../lib/format";
import { isWatched, loadState, mutateState } from "../lib/store";
import type { ValFile } from "../lib/types";
import { LogList } from "./LogList";
import { RunResult } from "./RunResult";
import { ScheduleDetail } from "./ScheduleDetail";
import { TraceList } from "./TraceList";

export function FileDetail({ val, branch, file }: { val: string; branch: string; file: ValFile }) {
  const endpoint = endpointOf(file);

  const { data, isLoading, error } = useCachedPromise(
    (identifier: string, path: string, currentBranch: string) => readFile(identifier, path, { branch: currentBranch }),
    [val, file.path, branch],
  );

  const watched = useCachedPromise(async (fileId: string) => isWatched(await loadState(), fileId), [file.id]);

  const markdown = error
    ? `## Could not read this file\n\n${errorMessage(error)}`
    : codeBlock(data?.content ?? "", file.path);

  async function toggleWatch() {
    const nextWatched = !watched.data;
    const toast = await showToast({ style: Toast.Style.Animated, title: nextWatched ? "Watching" : "Unwatching" });
    try {
      await mutateState((state) => ({
        ...state,
        watchedFiles: nextWatched
          ? [
              ...state.watchedFiles.filter((entry) => entry.fileId !== file.id),
              { val, fileId: file.id, path: file.path },
            ]
          : state.watchedFiles.filter((entry) => entry.fileId !== file.id),
      }));
      toast.style = Toast.Style.Success;
      toast.title = nextWatched ? "Watching for errors" : "No longer watching";
      watched.revalidate();
    } catch (mutationError) {
      toast.style = Toast.Style.Failure;
      toast.title = "Could not save";
      toast.message = errorMessage(mutationError);
    }
  }

  return (
    <Detail
      isLoading={isLoading}
      navigationTitle={`${val} / ${file.path}`}
      markdown={markdown}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.TagList title="Type">
            <Detail.Metadata.TagList.Item
              text={file.type}
              color={fileIcon(file.type).tintColor ?? Color.SecondaryText}
            />
          </Detail.Metadata.TagList>
          <Detail.Metadata.Label title="Version" text={`v${file.version}`} />
          <Detail.Metadata.Label title="Updated" text={formatDateTime(file.updatedAt)} />
          <Detail.Metadata.Label title="Branch" text={branch} />
          {endpoint ? <Detail.Metadata.Link title="Endpoint" target={endpoint} text={new URL(endpoint).host} /> : null}
          <Detail.Metadata.Separator />
          <Detail.Metadata.Label
            title="Error watch"
            icon={watched.data ? Icon.BellDisabled : undefined}
            text={watched.data ? "On" : "Off"}
          />
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <Action.Push
              title="View Traces"
              icon={Icon.List}
              shortcut={Keyboard.Shortcut.Common.Refresh}
              target={<TraceList fileId={file.id} fileName={file.path} />}
            />
            <Action.Push
              title="View Logs"
              icon={Icon.Terminal}
              shortcut={{ modifiers: ["cmd"], key: "l" }}
              target={<LogList fileId={file.id} fileName={file.path} />}
            />
            {file.type === "interval" ? (
              <Action.Push
                title="View Schedule"
                icon={Icon.Clock}
                target={<ScheduleDetail val={val} path={file.path} branch={branch} />}
              />
            ) : null}
          </ActionPanel.Section>

          <ActionPanel.Section>
            {endpoint ? (
              <Action.Push
                title="Fetch Endpoint"
                icon={Icon.Globe}
                target={<RunResult mode="fetch" val={val} path={file.path} endpoint={endpoint} />}
              />
            ) : null}
            {file.type !== "file" ? (
              <Action.Push
                title="Run File"
                icon={Icon.Play}
                target={<RunResult mode="run" val={val} path={file.path} branch={branch} />}
              />
            ) : null}
          </ActionPanel.Section>

          <ActionPanel.Section>
            <Action.OpenInBrowser title="Edit in Val Town" url={webUrlFor(val, file.path)} />
            <Action.CopyToClipboard title="Copy Code" content={data?.content ?? ""} />
            {endpoint ? <Action.CopyToClipboard title="Copy Endpoint" content={endpoint} /> : null}
            <Action
              title={watched.data ? "Stop Watching for Errors" : "Watch for Errors"}
              icon={watched.data ? Icon.BellDisabled : Icon.Bell}
              shortcut={{ modifiers: ["cmd", "shift"], key: "w" }}
              onAction={toggleWatch}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}
