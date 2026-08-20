import { Action, ActionPanel, Color, Icon, Keyboard, List, Toast, showToast } from "@raycast/api";
import { useCachedPromise, useCachedState } from "@raycast/utils";
import { webUrlFor } from "./lib/api";
import { BUILTIN_TOOLS, builtinSettings, type BuiltinTool } from "./lib/builtins";
import { errorMessage, formatDateTime } from "./lib/format";
import { removeSkill } from "./lib/skills";
import { mutateState, skillKey, type ExtensionState, type SkillEntry, type ToolEntry } from "./lib/store";
import { removeTool, statusOf, syncTools, type SpecStatus } from "./lib/tools";
import { AddSkill } from "./views/AddSkill";
import { AddTool } from "./views/AddTool";
import { BuiltinForm } from "./views/BuiltinForm";
import { SkillForm } from "./views/SkillForm";
import { ToolForm } from "./views/ToolForm";

type Filter = "all" | "tools" | "skills";

const STATUS_LABEL: Record<SpecStatus, { text: string; color: Color; icon: Icon }> = {
  ok: { text: "ok", color: Color.Green, icon: Icon.CheckCircle },
  "no-schema": { text: "no schema", color: Color.Yellow, icon: Icon.QuestionMark },
  "not-callable": { text: "not callable", color: Color.Orange, icon: Icon.MinusCircle },
  stale: { text: "stale", color: Color.Blue, icon: Icon.Clock },
  failed: { text: "failed", color: Color.Red, icon: Icon.XMarkCircle },
};

export default function ManageTools() {
  const [filter, setFilter] = useCachedState<Filter>("manage-filter", "all");
  const { data, isLoading, error, revalidate, mutate } = useCachedPromise(() => syncTools(), [], {
    keepPreviousData: true,
  });

  const state = data?.state;
  const tools = Object.values(state?.tools ?? {}).sort((a, b) => a.val.localeCompare(b.val));
  const skills = Object.values(state?.skills ?? {}).sort((a, b) => a.name.localeCompare(b.name));

  async function apply(next: Promise<ExtensionState>, failureTitle: string) {
    try {
      const result = { state: await next, derived: 0 };
      await mutate(Promise.resolve(result), { optimisticUpdate: () => result, shouldRevalidateAfter: false });
    } catch (mutationError) {
      await showToast({ style: Toast.Style.Failure, title: failureTitle, message: errorMessage(mutationError) });
    }
  }

  async function resync(force: boolean) {
    const toast = await showToast({ style: Toast.Style.Animated, title: force ? "Re-deriving specs" : "Syncing" });
    try {
      const result = await syncTools({ force });
      await mutate(Promise.resolve(result), { optimisticUpdate: () => result, shouldRevalidateAfter: false });
      toast.style = Toast.Style.Success;
      toast.title = `${Object.keys(result.state.tools).length} vals`;
      toast.message = `${result.derived} spec${result.derived === 1 ? "" : "s"} re-derived`;
    } catch (syncError) {
      toast.style = Toast.Style.Failure;
      toast.title = "Sync failed";
      toast.message = errorMessage(syncError);
    }
  }

  const addActions = (
    <ActionPanel.Section>
      <Action.Push
        title="Add Tool"
        icon={Icon.Plus}
        shortcut={Keyboard.Shortcut.Common.New}
        target={<AddTool onAdded={revalidate} />}
      />
      <Action.Push
        title="Add Skill"
        icon={Icon.Book}
        shortcut={{ modifiers: ["cmd", "shift"], key: "n" }}
        target={<AddSkill onAdded={revalidate} />}
      />
    </ActionPanel.Section>
  );

  const syncActions = (
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
    </ActionPanel.Section>
  );

  if (error) {
    return (
      <List>
        <List.EmptyView
          icon={{ source: Icon.Warning, tintColor: Color.Red }}
          title="Could not load your tools"
          description={errorMessage(error)}
          actions={
            <ActionPanel>
              <Action title="Try Again" icon={Icon.ArrowClockwise} onAction={revalidate} />
            </ActionPanel>
          }
        />
      </List>
    );
  }

  return (
    <List
      isLoading={isLoading}
      isShowingDetail
      searchBarPlaceholder="Filter your tools"
      searchBarAccessory={
        <List.Dropdown tooltip="Show" value={filter} onChange={(value) => setFilter(value as Filter)}>
          <List.Dropdown.Item title="All" value="all" icon={Icon.Dot} />
          <List.Dropdown.Item title="Tools" value="tools" icon={Icon.Stars} />
          <List.Dropdown.Item title="Skills" value="skills" icon={Icon.Book} />
        </List.Dropdown>
      }
    >
      {filter !== "skills" && state ? (
        <List.Section title="Built-In">
          {BUILTIN_TOOLS.map((tool) => (
            <BuiltinRow
              key={tool.id}
              tool={tool}
              state={state}
              onSaved={revalidate}
              addActions={addActions}
              syncActions={syncActions}
            />
          ))}
        </List.Section>
      ) : null}

      {filter !== "skills" ? (
        <List.Section title="Your Vals" subtitle={tools.length ? `${tools.length}` : undefined}>
          {tools.map((entry) => (
            <ValRow
              key={entry.val}
              entry={entry}
              onSaved={revalidate}
              onRemove={() => apply(removeTool(entry.val), "Could not remove")}
              onToggle={(field) =>
                apply(
                  mutateState((current) => ({
                    ...current,
                    tools: { ...current.tools, [entry.val]: { ...entry, [field]: !entry[field] } },
                  })),
                  "Could not save",
                )
              }
              addActions={addActions}
              syncActions={syncActions}
            />
          ))}
        </List.Section>
      ) : null}

      {filter !== "tools" ? (
        <List.Section title="Your Skills" subtitle={skills.length ? `${skills.length}` : undefined}>
          {skills.map((entry) => (
            <SkillRow
              key={skillKey(entry.val, entry.path)}
              entry={entry}
              onSaved={revalidate}
              onRemove={() => apply(removeSkill(entry.val, entry.path), "Could not remove")}
              onToggle={() =>
                apply(
                  mutateState((current) => ({
                    ...current,
                    skills: {
                      ...current.skills,
                      [skillKey(entry.val, entry.path)]: { ...entry, enabled: !entry.enabled },
                    },
                  })),
                  "Could not save",
                )
              }
              addActions={addActions}
            />
          ))}
        </List.Section>
      ) : null}

      <List.EmptyView
        icon={Icon.Stars}
        title="Nothing here yet"
        description="Add one of your vals as a tool, or add a skill that orchestrates several."
        actions={<ActionPanel>{addActions}</ActionPanel>}
      />
    </List>
  );
}

function BuiltinRow({
  tool,
  state,
  onSaved,
  addActions,
  syncActions,
}: {
  tool: BuiltinTool;
  state: ExtensionState;
  onSaved: () => void;
  addActions: React.ReactNode;
  syncActions: React.ReactNode;
}) {
  const settings = builtinSettings(state, tool.id);

  return (
    <List.Item
      icon={{ source: Icon.Cog, tintColor: settings.enabled ? Color.Blue : Color.SecondaryText }}
      title={tool.title}
      accessories={[
        ...(settings.requiresConfirmation ? [{ icon: Icon.Shield, tooltip: "Asks before running" }] : []),
        { tag: { value: settings.enabled ? "on" : "off", color: settings.enabled ? Color.Blue : Color.SecondaryText } },
      ]}
      detail={
        <List.Item.Detail
          markdown={`## ${tool.title}\n\n${tool.summary}`}
          metadata={
            <List.Item.Detail.Metadata>
              <List.Item.Detail.Metadata.Label title="Kind" text="Built-in tool" />
              <List.Item.Detail.Metadata.Label title="Active" text={settings.enabled ? "Yes" : "No"} />
              <List.Item.Detail.Metadata.Label
                title="Asks first"
                text={tool.confirmable ? (settings.requiresConfirmation ? "Yes" : "No") : "Never"}
              />
            </List.Item.Detail.Metadata>
          }
        />
      }
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <Action.Push
              title="Configure"
              icon={Icon.Cog}
              target={<BuiltinForm tool={tool} state={state} onSaved={onSaved} />}
            />
          </ActionPanel.Section>
          {addActions}
          {syncActions}
        </ActionPanel>
      }
    />
  );
}

function ValRow({
  entry,
  onSaved,
  onRemove,
  onToggle,
  addActions,
  syncActions,
}: {
  entry: ToolEntry;
  onSaved: () => void;
  onRemove: () => void;
  onToggle: (field: "enabled" | "requiresConfirmation") => void;
  addActions: React.ReactNode;
  syncActions: React.ReactNode;
}) {
  const status = STATUS_LABEL[statusOf(entry)];
  const schema = entry.spec?.inputSchema;

  const markdown = [
    `## ${entry.spec?.name ?? entry.val}`,
    entry.error ? `> ⚠️ ${entry.error}` : (entry.spec?.description ?? "_No description derived._"),
    schema
      ? `### Input\n\n\`\`\`json\n${JSON.stringify(schema, null, 2)}\n\`\`\``
      : "### Input\n\n_Takes no arguments._",
  ].join("\n\n");

  return (
    <List.Item
      icon={{ source: status.icon, tintColor: entry.enabled ? status.color : Color.SecondaryText }}
      title={entry.spec?.name ?? entry.val.split("/")[1]}
      subtitle={entry.val}
      accessories={[
        ...(entry.requiresConfirmation ? [{ icon: Icon.Shield, tooltip: "Asks before running" }] : []),
        ...(entry.edited ? [{ icon: Icon.Pencil, tooltip: "Hand-edited spec" }] : []),
        {
          tag: {
            value: entry.enabled ? status.text : "off",
            color: entry.enabled ? status.color : Color.SecondaryText,
          },
        },
      ]}
      detail={
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
              <List.Item.Detail.Metadata.Label title="Active" text={entry.enabled ? "Yes" : "No"} />
              <List.Item.Detail.Metadata.Label title="Asks first" text={entry.requiresConfirmation ? "Yes" : "No"} />
              <List.Item.Detail.Metadata.Label title="Derived" text={formatDateTime(entry.derivedAt ?? undefined)} />
            </List.Item.Detail.Metadata>
          }
        />
      }
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <Action.Push title="Configure" icon={Icon.Cog} target={<ToolForm entry={entry} onSaved={onSaved} />} />
            <Action
              title={entry.enabled ? "Deactivate" : "Activate"}
              icon={entry.enabled ? Icon.CircleDisabled : Icon.CheckCircle}
              shortcut={Keyboard.Shortcut.Common.Edit}
              onAction={() => onToggle("enabled")}
            />
            <Action
              title={entry.requiresConfirmation ? "Stop Asking First" : "Ask Before Running"}
              icon={Icon.Shield}
              shortcut={{ modifiers: ["cmd", "shift"], key: "a" }}
              onAction={() => onToggle("requiresConfirmation")}
            />
          </ActionPanel.Section>
          {addActions}
          <ActionPanel.Section>
            <Action
              title="Remove from Tools"
              icon={Icon.Trash}
              style={Action.Style.Destructive}
              shortcut={Keyboard.Shortcut.Common.Remove}
              onAction={onRemove}
            />
            <Action.OpenInBrowser title="Open on Val Town" url={webUrlFor(entry.val)} />
          </ActionPanel.Section>
          {syncActions}
        </ActionPanel>
      }
    />
  );
}

function SkillRow({
  entry,
  onSaved,
  onRemove,
  onToggle,
  addActions,
}: {
  entry: SkillEntry;
  onSaved: () => void;
  onRemove: () => void;
  onToggle: () => void;
  addActions: React.ReactNode;
}) {
  return (
    <List.Item
      icon={{ source: Icon.Book, tintColor: entry.enabled ? Color.Purple : Color.SecondaryText }}
      title={entry.name}
      subtitle={entry.val}
      accessories={[
        { tag: { value: entry.enabled ? "on" : "off", color: entry.enabled ? Color.Purple : Color.SecondaryText } },
      ]}
      detail={
        <List.Item.Detail
          markdown={`## ${entry.name}\n\n${entry.description || "_No description in this skill's frontmatter._"}`}
          metadata={
            <List.Item.Detail.Metadata>
              <List.Item.Detail.Metadata.Label title="Val" text={entry.val} />
              <List.Item.Detail.Metadata.Label title="File" text={entry.path} />
              <List.Item.Detail.Metadata.Separator />
              <List.Item.Detail.Metadata.Label title="Active" text={entry.enabled ? "Yes" : "No"} />
              <List.Item.Detail.Metadata.Label title="Added" text={formatDateTime(entry.addedAt)} />
            </List.Item.Detail.Metadata>
          }
        />
      }
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <Action.Push title="Configure" icon={Icon.Cog} target={<SkillForm entry={entry} onSaved={onSaved} />} />
            <Action
              title={entry.enabled ? "Deactivate" : "Activate"}
              icon={entry.enabled ? Icon.CircleDisabled : Icon.CheckCircle}
              shortcut={Keyboard.Shortcut.Common.Edit}
              onAction={onToggle}
            />
          </ActionPanel.Section>
          {addActions}
          <ActionPanel.Section>
            <Action
              title="Remove from Skills"
              icon={Icon.Trash}
              style={Action.Style.Destructive}
              shortcut={Keyboard.Shortcut.Common.Remove}
              onAction={onRemove}
            />
            <Action.OpenInBrowser title="Open on Val Town" url={webUrlFor(entry.val, entry.path)} />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}
