import { Action, ActionPanel, Detail, Form, Icon, Toast, showToast, useNavigation } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { webUrlFor } from "../lib/api";
import { errorMessage } from "../lib/format";
import { mutateState, type JsonSchema, type ToolEntry } from "../lib/store";
import { executeTool } from "../lib/tools";

type Values = {
  enabled: boolean;
  requiresConfirmation: boolean;
  name: string;
  description: string;
  inputSchema: string;
};

export function ToolForm({ entry, onSaved }: { entry: ToolEntry; onSaved: () => void }) {
  const { pop, push } = useNavigation();
  const spec = entry.spec;

  async function submit(values: Values) {
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

    const edited =
      values.name.trim() !== spec?.name ||
      values.description.trim() !== spec?.description ||
      JSON.stringify(inputSchema) !== JSON.stringify(spec?.inputSchema ?? null);

    const next: ToolEntry = {
      ...entry,
      enabled: values.enabled,
      requiresConfirmation: values.requiresConfirmation,
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
      edited: entry.edited || edited,
    };

    try {
      await mutateState((state) => ({ ...state, tools: { ...state.tools, [next.val]: next } }));
      onSaved();
      pop();
    } catch (error) {
      await showToast({ style: Toast.Style.Failure, title: "Could not save", message: errorMessage(error) });
    }
  }

  return (
    <Form
      navigationTitle={spec?.name ?? entry.val}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save Tool" icon={Icon.Check} onSubmit={submit} />
          <Action
            title="Test Run"
            icon={Icon.Play}
            shortcut={{ modifiers: ["cmd"], key: "return" }}
            onAction={() => push(<TestRun entry={entry} />)}
          />
          <Action.OpenInBrowser title="Open on Val Town" url={webUrlFor(entry.val)} />
        </ActionPanel>
      }
    >
      <Form.Description title="Val" text={entry.val} />
      <Form.Description title="Runs" text={runsVia(entry)} />
      <Form.Checkbox id="enabled" label="Active" defaultValue={entry.enabled} />
      <Form.Checkbox
        id="requiresConfirmation"
        label="Ask before running"
        defaultValue={entry.requiresConfirmation}
        info="Raycast AI shows a confirmation before it calls this val."
      />
      <Form.Separator />
      <Form.TextField id="name" title="Tool name" defaultValue={spec?.name ?? ""} />
      <Form.TextArea
        id="description"
        title="Description"
        defaultValue={spec?.description ?? ""}
        info="What the model reads when it decides whether to call this val."
      />
      <Form.TextArea
        id="inputSchema"
        title="Input schema"
        placeholder='{ "type": "object", "properties": { … } }'
        defaultValue={spec?.inputSchema ? JSON.stringify(spec.inputSchema, null, 2) : ""}
        enableMarkdown={false}
        info="JSON Schema. Only http vals can take arguments."
      />
      <Form.Description text="Edits survive syncing until you re-derive the spec." />
    </Form>
  );
}

function runsVia(entry: ToolEntry): string {
  if (!entry.spec?.filePath) return "Nothing runnable — this val has no http, script, interval or email file";
  return entry.spec.endpoint ? `HTTP endpoint · ${entry.spec.filePath}` : `run_file · ${entry.spec.filePath}`;
}

export function TestRun({ entry }: { entry: ToolEntry }) {
  const { push } = useNavigation();
  if (!entry.spec?.inputSchema) return <TestResult entry={entry} args="{}" />;

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
