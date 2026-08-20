import { Action, ActionPanel, Detail, Form, Icon, Toast, showToast, useNavigation, Keyboard } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useState } from "react";
import { webUrlFor } from "../lib/api";
import { errorMessage, formatDateTime } from "../lib/format";
import { mutateState, type JsonSchema, type ToolEntry } from "../lib/store";
import { deriveSpec, executeTool } from "../lib/tools";
import { listVals } from "../lib/api";

export function ToolDetail({ entry, onChanged }: { entry: ToolEntry; onChanged: () => void }) {
  const { push } = useNavigation();
  const [current, setCurrent] = useState(entry);
  const spec = current.spec;

  async function save(next: ToolEntry) {
    await mutateState((state) => ({ ...state, tools: { ...state.tools, [next.val]: next } }));
    setCurrent(next);
    onChanged();
  }

  async function rederive() {
    const toast = await showToast({ style: Toast.Style.Animated, title: "Re-deriving spec" });
    try {
      const { vals } = await listVals({ name: current.val.split("/")[1] });
      const val = vals.find((candidate) => candidate.identifier === current.val);
      if (!val) throw new Error(`${current.val} is no longer tagged as a tool.`);

      await save({
        ...current,
        spec: await deriveSpec(val),
        edited: false,
        derivedAt: new Date().toISOString(),
        error: null,
      });
      toast.style = Toast.Style.Success;
      toast.title = "Spec re-derived";
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Could not re-derive";
      toast.message = errorMessage(error);
    }
  }

  const markdown = [
    `# ${spec?.name ?? current.val}`,
    current.error ? `> ⚠️ ${current.error}` : (spec?.description ?? "_No description derived._"),
    spec?.inputSchema
      ? `## Input schema\n\n\`\`\`json\n${JSON.stringify(spec.inputSchema, null, 2)}\n\`\`\``
      : "## Input schema\n\n_None. This tool is called with no arguments._",
  ]
    .filter(Boolean)
    .join("\n\n");

  return (
    <Detail
      navigationTitle={spec?.name ?? current.val}
      markdown={markdown}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Val" text={current.val} />
          <Detail.Metadata.Label title="File" text={spec?.filePath ?? "—"} />
          {spec?.endpoint ? (
            <Detail.Metadata.Link title="Endpoint" target={spec.endpoint} text={new URL(spec.endpoint).host} />
          ) : (
            <Detail.Metadata.Label title="Called via" text="run_file" />
          )}
          <Detail.Metadata.Separator />
          <Detail.Metadata.Label title="Enabled" text={current.enabled ? "Yes" : "No"} />
          <Detail.Metadata.Label title="Asks first" text={current.requiresConfirmation ? "Yes" : "No"} />
          <Detail.Metadata.Label title="Spec source" text={current.edited ? "Hand-edited" : "Derived"} />
          <Detail.Metadata.Label title="Derived" text={formatDateTime(current.derivedAt ?? undefined)} />
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <Action
              title="Test Run"
              icon={Icon.Play}
              onAction={() => push(<TestRun entry={current} />)}
              shortcut={{ modifiers: ["cmd"], key: "return" }}
            />
            <Action
              title="Edit Spec"
              icon={Icon.Pencil}
              shortcut={{ modifiers: ["cmd"], key: "d" }}
              onAction={() => push(<SpecForm entry={current} onSave={save} />)}
            />
            <Action
              title="Re-Derive Spec"
              icon={Icon.Repeat}
              shortcut={Keyboard.Shortcut.Common.Refresh}
              onAction={rederive}
            />
          </ActionPanel.Section>
          <ActionPanel.Section>
            <Action
              title={current.enabled ? "Disable" : "Enable"}
              icon={current.enabled ? Icon.CircleDisabled : Icon.CheckCircle}
              shortcut={Keyboard.Shortcut.Common.Edit}
              onAction={() => save({ ...current, enabled: !current.enabled })}
            />
            <Action
              title={current.requiresConfirmation ? "Stop Asking First" : "Ask Before Running"}
              icon={Icon.Shield}
              shortcut={{ modifiers: ["cmd", "shift"], key: "a" }}
              onAction={() => save({ ...current, requiresConfirmation: !current.requiresConfirmation })}
            />
            <Action.OpenInBrowser title="Open on Val Town" url={webUrlFor(current.val)} />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

function SpecForm({ entry, onSave }: { entry: ToolEntry; onSave: (next: ToolEntry) => Promise<void> }) {
  const { pop } = useNavigation();
  const spec = entry.spec;

  async function submit(values: { name: string; description: string; inputSchema: string }) {
    let inputSchema: JsonSchema | null = null;
    const raw = values.inputSchema.trim();
    if (raw) {
      try {
        inputSchema = JSON.parse(raw) as JsonSchema;
      } catch {
        await showToast({ style: Toast.Style.Failure, title: "Input schema is not valid JSON" });
        return;
      }
    }

    await onSave({
      ...entry,
      edited: true,
      error: null,
      spec: {
        name: values.name.trim(),
        description: values.description.trim(),
        inputSchema,
        filePath: spec?.filePath ?? null,
        endpoint: spec?.endpoint ?? null,
        method: inputSchema ? "POST" : "GET",
        descriptionSource: spec?.descriptionSource ?? "val",
        restricted: spec?.restricted ?? false,
      },
    });
    pop();
  }

  return (
    <Form
      navigationTitle={`Edit ${spec?.name ?? entry.val}`}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save Spec" icon={Icon.Check} onSubmit={submit} />
        </ActionPanel>
      }
    >
      <Form.TextField id="name" title="Tool name" defaultValue={spec?.name ?? ""} />
      <Form.TextArea id="description" title="Description" defaultValue={spec?.description ?? ""} />
      <Form.TextArea
        id="inputSchema"
        title="Input schema"
        placeholder='{ "type": "object", "properties": { … } }'
        defaultValue={spec?.inputSchema ? JSON.stringify(spec.inputSchema, null, 2) : ""}
        enableMarkdown={false}
      />
      <Form.Description text="Edits survive syncing until you re-derive." />
    </Form>
  );
}

function TestRun({ entry }: { entry: ToolEntry }) {
  const { push } = useNavigation();
  const takesArgs = Boolean(entry.spec?.inputSchema);

  if (!takesArgs) return <TestResult entry={entry} args="{}" />;

  return (
    <Form
      navigationTitle={`Test ${entry.spec?.name ?? entry.val}`}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Run"
            icon={Icon.Play}
            onSubmit={(values: { args: string }) => push(<TestResult entry={entry} args={values.args} />)}
          />
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="args"
        title="Arguments"
        defaultValue={sampleArgs(entry.spec?.inputSchema ?? null)}
        enableMarkdown={false}
      />
      <Form.Description text="This really runs the val." />
    </Form>
  );
}

function TestResult({ entry, args }: { entry: ToolEntry; args: string }) {
  const { data, isLoading, error } = useCachedPromise(
    async (toolEntry: ToolEntry, raw: string) => {
      const parsed = raw.trim() ? (JSON.parse(raw) as Record<string, unknown>) : {};
      return executeTool(toolEntry, parsed);
    },
    [entry, args],
    { keepPreviousData: false },
  );

  const markdown = error
    ? `## Failed\n\n\`\`\`\n${errorMessage(error)}\n\`\`\``
    : data
      ? [
          `## ${data.ok ? "Success" : "Failed"} · via ${data.via}${data.status ? ` · ${data.status}` : ""}`,
          "```",
          data.output.slice(0, 20000),
          "```",
          data.logs?.length ? `### Logs\n\n\`\`\`\n${data.logs.join("\n")}\n\`\`\`` : "",
        ]
          .filter(Boolean)
          .join("\n\n")
      : "Running…";

  return (
    <Detail
      isLoading={isLoading}
      navigationTitle={`Test · ${entry.spec?.name ?? entry.val}`}
      markdown={markdown}
      actions={
        data ? (
          <ActionPanel>
            <Action.CopyToClipboard title="Copy Output" content={data.output} />
          </ActionPanel>
        ) : null
      }
    />
  );
}

function sampleArgs(schema: JsonSchema | null): string {
  if (!schema?.properties) return "{}";
  const sample = Object.fromEntries(
    Object.entries(schema.properties).map(([key, value]) => [key, placeholderFor(value)]),
  );
  return JSON.stringify(sample, null, 2);
}

function placeholderFor(property: unknown): unknown {
  const type = (property as { type?: string })?.type;
  if (type === "number" || type === "integer") return 0;
  if (type === "boolean") return false;
  if (type === "array") return [];
  if (type === "object") return {};
  return "";
}
