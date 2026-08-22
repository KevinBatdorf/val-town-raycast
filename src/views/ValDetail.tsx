import {
  Action,
  ActionPanel,
  Color,
  Detail,
  Icon,
  Keyboard,
  List,
  Toast,
  showToast,
  useNavigation,
} from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { getValDetail, listVals, setPrivacy, webUrlFor } from "../lib/api";
import { appAccessColor, errorMessage, formatDateTime, privacyColor } from "../lib/format";
import { cachedReadme } from "../lib/cache";
import { loadReadme } from "../lib/readme";
import { loadState } from "../lib/store";
import type { Privacy } from "../lib/types";
import { readValConfig, writeValConfig, type ValConfig } from "../lib/valconfig";
import { BlobList } from "./BlobList";
import { FileList } from "./FileList";
import { HistoryList } from "./HistoryList";
import { RegisterVal } from "./RegisterVal";
import { SqliteQuery } from "./SqliteQuery";

export function ValDetail({ identifier }: { identifier: string }) {
  const { push } = useNavigation();

  const { data, isLoading, error, mutate } = useCachedPromise(
    async (val: string) => {
      /**
       * `list_vals` is the source for the val's own fields: it has reliably carried description,
       * privacy, httpPrivacy and createdAt, where the same fields off `get_val_detail` have come
       * back empty. `get_val_detail` is kept for branches, which only it reports, and is allowed
       * to fail without taking the view down with it.
       */
      const [summaries, detail, state] = await Promise.all([
        listVals({ name: val.split("/")[1] }),
        // Reported rather than swallowed: a silent null here reads as "this val has no branches".
        getValDetail(val).then(
          (result) => ({ result, error: null as string | null }),
          (failure: unknown) => ({ result: null, error: errorMessage(failure) }),
        ),
        loadState(),
      ]);

      const summary = summaries.vals.find((candidate) => candidate.identifier === val);
      const config = state.tools[val] ? await readValConfig(val).catch(() => null) : null;
      return { summary, detail: detail.result, detailError: detail.error, entry: state.tools[val], config };
    },
    [identifier],
  );

  // Its own request so the val's own fields render immediately, seeded from whatever the list
  // already warmed while the row was hovered.
  const { data: readme, isLoading: loadingReadme } = useCachedPromise(loadReadme, [identifier], {
    initialData: cachedReadme(identifier)?.content ?? null,
  });

  const summary = data?.summary;
  const detail = data?.detail;
  const config = data?.config ?? null;
  const isTool = data?.entry !== undefined;
  const argumentCount = Object.keys(config?.inputSchema?.properties ?? {}).length;

  const privacy = summary?.privacy ?? detail?.privacy;
  const appAccess = summary?.httpPrivacy ?? detail?.httpPrivacy;
  const createdAt = summary?.createdAt ?? detail?.createdAt;
  const webUrl = summary?.links.html ?? detail?.htmlUrl ?? webUrlFor(identifier);
  const branches = detail?.branches?.items ?? [];
  const branchCount = detail?.branches?.count ?? branches.length;
  const branch = branches[0]?.name ?? "main";

  function configure(register: boolean) {
    push(
      <RegisterVal
        identifier={identifier}
        register={register}
        preloaded={register ? undefined : config}
        valDescription={summary?.description ?? detail?.description}
        onSaved={() => mutate()}
      />,
    );
  }

  /** Both axes are tier-gated, so a rejection is reported rather than swallowed. */
  async function changeAccess(label: string, apply: () => Promise<void>) {
    const toast = await showToast({ style: Toast.Style.Animated, title: `Setting ${label}` });
    try {
      await apply();
      await mutate();
      toast.style = Toast.Style.Success;
      toast.title = `Now ${label}`;
    } catch (changeError) {
      toast.style = Toast.Style.Failure;
      toast.title = "Could not change access";
      toast.message = errorMessage(changeError);
    }
  }

  async function updateConfig(change: Partial<ValConfig>, doing: string, done: string) {
    if (!config) return;
    const toast = await showToast({ style: Toast.Style.Animated, title: doing });
    try {
      await writeValConfig(identifier, { ...config, ...change });
      await mutate();
      toast.style = Toast.Style.Success;
      toast.title = done;
    } catch (writeError) {
      toast.style = Toast.Style.Failure;
      toast.title = "Could not change this val";
      toast.message = errorMessage(writeError);
    }
  }

  if (error) {
    return <Detail navigationTitle={identifier} markdown={`# Could not load this val\n\n${errorMessage(error)}`} />;
  }

  const name = summary?.name ?? detail?.name ?? identifier.split("/")[1] ?? identifier;
  const description = summary?.description ?? detail?.description;

  // The body is the README alone: the val's own fields sit in the metadata beside it.
  const body = readme ?? (loadingReadme ? "Loading readme" : "_No readme._");

  return (
    <Detail
      isLoading={isLoading}
      navigationTitle={identifier}
      markdown={body}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Link title="Val Town" target={webUrl} text="Open" />
          <Detail.Metadata.Label title="Name" text={name} />
          {description ? <Detail.Metadata.Label title="Description" text={description} /> : null}
          <Detail.Metadata.Label title="Val" text={identifier} />
          <Detail.Metadata.TagList title="Code">
            <Detail.Metadata.TagList.Item
              text={privacy ?? "unknown"}
              color={privacy ? privacyColor(privacy) : undefined}
            />
          </Detail.Metadata.TagList>
          <Detail.Metadata.TagList title="App access">
            <Detail.Metadata.TagList.Item
              text={appAccess ?? "unknown"}
              color={appAccess ? appAccessColor(appAccess) : undefined}
            />
          </Detail.Metadata.TagList>
          {data?.detailError ? (
            <Detail.Metadata.Label title="Branches" text={`unavailable — ${data.detailError}`} />
          ) : (
            <Detail.Metadata.Label title="Branches" text={`${branchCount}`} />
          )}
          <Detail.Metadata.Label title="Created" text={createdAt ? formatDateTime(createdAt) : "unknown"} />
          <Detail.Metadata.Separator />
          {/*
           * Unlike a list row, this pane states the whole picture: no config says nothing at all,
           * an enabled val says so and whether it stops to ask, and a disabled one says only that.
           */}
          {config ? (
            <Detail.Metadata.TagList title="AI Agent Access">
              {config.active ? (
                <>
                  <Detail.Metadata.TagList.Item text="ai" color={Color.Purple} />
                  {config.confirm ? (
                    <Detail.Metadata.TagList.Item text="must confirm" color={Color.Orange} />
                  ) : (
                    <Detail.Metadata.TagList.Item text="no confirm" color={Color.SecondaryText} />
                  )}
                </>
              ) : (
                <Detail.Metadata.TagList.Item text="disabled" color={Color.SecondaryText} />
              )}
            </Detail.Metadata.TagList>
          ) : null}
          {config ? (
            <Detail.Metadata.Label
              title="Prompt"
              text={config.description ?? `The val's own: ${description ?? "none"}`}
            />
          ) : null}
          {config ? (
            <Detail.Metadata.Label
              title="Arguments"
              text={argumentCount ? `${argumentCount} input${argumentCount === 1 ? "" : "s"}` : "none"}
            />
          ) : null}
          {config ? (
            <Detail.Metadata.Label title="Entrypoint" text={config.entrypoint ?? "resolved at run time"} />
          ) : null}
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <ActionPanel.Section title="Data">
            <Action.Push title="Files" icon={Icon.Folder} target={<FileList val={identifier} branch={branch} />} />
            <Action.Push
              title="History"
              icon={Icon.Clock}
              shortcut={Keyboard.Shortcut.Common.ToggleQuickLook}
              target={<HistoryList val={identifier} branch={branch} />}
            />
            <Action.Push
              title="SQLite"
              icon={Icon.List}
              shortcut={{ modifiers: ["cmd"], key: "l" }}
              target={<SqliteQuery val={identifier} />}
            />
            <Action.Push
              title="Blobs"
              icon={Icon.Box}
              shortcut={{ modifiers: ["cmd"], key: "b" }}
              target={<BlobList val={identifier} />}
            />
            {branchCount > 1 ? (
              <Action.Push
                title="Browse Branches"
                icon={Icon.Tree}
                target={<BranchList val={identifier} branches={branches} />}
              />
            ) : null}
            <ActionPanel.Submenu title="Change Visibility" icon={Icon.Eye}>
              {(["public", "unlisted", "private"] as Privacy[]).map((value) => (
                <Action
                  key={value}
                  title={value}
                  icon={value === privacy ? Icon.CheckCircle : Icon.Circle}
                  onAction={
                    value === privacy
                      ? () => undefined
                      : () => changeAccess(`code ${value}`, () => setPrivacy(identifier, value))
                  }
                />
              ))}
            </ActionPanel.Submenu>
          </ActionPanel.Section>

          <ActionPanel.Section title="AI Agent Access">
            {/* Everything but Configure needs an enabled val: enabling happens by saving the config. */}
            <Action
              title="Configure"
              icon={Icon.Pencil}
              shortcut={{ modifiers: ["cmd"], key: "t" }}
              onAction={() => configure(!isTool)}
            />
            {isTool && config?.active ? (
              <Action
                title="Disable"
                icon={Icon.Circle}
                shortcut={{ modifiers: ["cmd", "shift"], key: "a" }}
                onAction={() => updateConfig({ active: false }, "Disabling", "Disabled")}
              />
            ) : null}
            {isTool && config?.active ? (
              <Action
                title={config.confirm ? "Disable Confirm" : "Require Confirm"}
                icon={config.confirm ? Icon.LockUnlocked : Icon.Lock}
                shortcut={Keyboard.Shortcut.Common.Copy}
                onAction={() =>
                  config.confirm
                    ? updateConfig({ confirm: false }, "Removing confirmation", "Runs without asking")
                    : updateConfig({ confirm: true }, "Requiring confirmation", "Asks before running")
                }
              />
            ) : null}
          </ActionPanel.Section>

          <ActionPanel.Section>
            <Action.OpenInBrowser title="Open on Val Town" url={webUrl} />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

/**
 * A list rather than a submenu: a branch name is data, and Raycast's title-case rule applies to
 * action titles but not to list items.
 */
function BranchList({ val, branches }: { val: string; branches: { name: string; version: number }[] }) {
  return (
    <List navigationTitle={`Branches · ${val}`} searchBarPlaceholder="Filter branches">
      {branches.map((branch) => (
        <List.Item
          key={branch.name}
          icon={Icon.Tree}
          title={branch.name}
          accessories={[{ text: `v${branch.version}` }]}
          actions={
            <ActionPanel>
              <Action.Push
                title="Browse Files"
                icon={Icon.Folder}
                target={<FileList val={val} branch={branch.name} />}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
