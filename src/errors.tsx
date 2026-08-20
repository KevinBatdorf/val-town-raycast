import { Color, Icon, LaunchType, MenuBarExtra, launchCommand, open } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { getTraces, webUrlFor } from "./lib/api";
import { formatDateTime } from "./lib/format";
import { loadState, saveState } from "./lib/store";
import type { TraceEntry } from "./lib/types";

type Failure = { val: string; path: string; fileId: string; trace: TraceEntry };

type Snapshot = {
  watched: number;
  failures: Failure[];
  unseen: Failure[];
};

export default function Errors() {
  const { data, isLoading, revalidate } = useCachedPromise(collect, [], {
    initialData: { watched: 0, failures: [], unseen: [] },
  });

  const { watched = 0, failures = [], unseen = [] } = data ?? {};
  const alerting = unseen.length > 0;

  return (
    <MenuBarExtra
      isLoading={isLoading}
      icon={
        alerting
          ? { source: Icon.XMarkCircle, tintColor: Color.Red }
          : { source: Icon.CheckCircle, tintColor: Color.SecondaryText }
      }
      title={alerting ? String(unseen.length) : undefined}
      tooltip={watched === 0 ? "No val files watched" : `Watching ${watched} file${watched === 1 ? "" : "s"}`}
    >
      {watched === 0 ? (
        <MenuBarExtra.Section title="Nothing watched">
          <MenuBarExtra.Item
            title="Pick files in Search Vals"
            subtitle="Open a file, then Watch for Errors"
            onAction={() => launchCommand({ name: "search-vals", type: LaunchType.UserInitiated })}
          />
        </MenuBarExtra.Section>
      ) : null}

      {unseen.length > 0 ? (
        <MenuBarExtra.Section title="New failures">
          {unseen.map((failure) => (
            <FailureItem key={failure.trace.traceId} failure={failure} />
          ))}
          <MenuBarExtra.Item
            title="Mark All as Seen"
            icon={Icon.Checkmark}
            onAction={async () => {
              await acknowledge(failures);
              revalidate();
            }}
          />
        </MenuBarExtra.Section>
      ) : null}

      {watched > 0 ? (
        <MenuBarExtra.Section title={failures.length > 0 ? "Last hour" : `No failures · ${watched} watched`}>
          {failures
            .filter((failure) => !unseen.some((entry) => entry.trace.traceId === failure.trace.traceId))
            .map((failure) => (
              <FailureItem key={failure.trace.traceId} failure={failure} />
            ))}
        </MenuBarExtra.Section>
      ) : null}

      <MenuBarExtra.Section>
        <MenuBarExtra.Item
          title="Open Search Vals"
          icon={Icon.MagnifyingGlass}
          onAction={() => launchCommand({ name: "search-vals", type: LaunchType.UserInitiated })}
        />
      </MenuBarExtra.Section>
    </MenuBarExtra>
  );
}

function FailureItem({ failure }: { failure: Failure }) {
  return (
    <MenuBarExtra.Item
      icon={{ source: Icon.XMarkCircle, tintColor: Color.Red }}
      title={`${failure.val} · ${failure.path}`}
      subtitle={formatDateTime(failure.trace.startTime)}
      tooltip={failure.trace.error ?? undefined}
      onAction={() => open(webUrlFor(failure.val, failure.path))}
    />
  );
}

/** A one-minute refresh over a one-hour window misses most runs, so only failures are reportable. */
async function collect(): Promise<Snapshot> {
  const state = await loadState();
  if (state.watchedFiles.length === 0) return { watched: 0, failures: [], unseen: [] };

  const failures: Failure[] = [];

  for (const file of state.watchedFiles) {
    let traces: TraceEntry[];
    try {
      traces = (await getTraces(file.fileId)).traces;
    } catch {
      continue;
    }

    for (const trace of traces.filter((candidate) => candidate.status === "error")) {
      failures.push({ val: file.val, path: file.path, fileId: file.fileId, trace });
    }
  }

  failures.sort((a, b) => b.trace.startTime.localeCompare(a.trace.startTime));

  const unseen = failures.filter((failure) => {
    const acknowledged = state.reportedFailures[failure.fileId];
    return !acknowledged || failure.trace.startTime > acknowledged;
  });

  return { watched: state.watchedFiles.length, failures, unseen };
}

/** Acknowledging is the only write this command makes, so a background tick costs one read. */
async function acknowledge(failures: Failure[]): Promise<void> {
  const state = await loadState();
  const reportedFailures = { ...state.reportedFailures };

  for (const failure of failures) {
    const current = reportedFailures[failure.fileId];
    if (!current || failure.trace.startTime > current) reportedFailures[failure.fileId] = failure.trace.startTime;
  }

  await saveState({ ...state, reportedFailures });
}
