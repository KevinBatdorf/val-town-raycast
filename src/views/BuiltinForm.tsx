import { Action, ActionPanel, Form, Icon, Toast, showToast, useNavigation } from "@raycast/api";
import { builtinSettings, type BuiltinTool } from "../lib/builtins";
import { errorMessage } from "../lib/format";
import { mutateState, type ExtensionState } from "../lib/store";

export function BuiltinForm({
  tool,
  state,
  onSaved,
}: {
  tool: BuiltinTool;
  state: ExtensionState;
  onSaved: () => void;
}) {
  const { pop } = useNavigation();
  const current = builtinSettings(state, tool.id);

  async function submit(values: { enabled: boolean; requiresConfirmation?: boolean }) {
    try {
      await mutateState((previous) => ({
        ...previous,
        builtins: {
          ...previous.builtins,
          [tool.id]: {
            enabled: values.enabled,
            requiresConfirmation: tool.confirmable ? values.requiresConfirmation === true : false,
          },
        },
      }));
      onSaved();
      pop();
    } catch (error) {
      await showToast({ style: Toast.Style.Failure, title: "Could not save", message: errorMessage(error) });
    }
  }

  return (
    <Form
      navigationTitle={tool.title}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save" icon={Icon.Check} onSubmit={submit} />
        </ActionPanel>
      }
    >
      <Form.Description title={tool.title} text={tool.summary} />
      <Form.Checkbox id="enabled" label="Active" defaultValue={current.enabled} />
      {tool.confirmable ? (
        <Form.Checkbox
          id="requiresConfirmation"
          label="Ask before running"
          defaultValue={current.requiresConfirmation}
          info="Applies to every val. A val can also ask on its own, from its own row."
        />
      ) : null}
      <Form.Separator />
      <Form.Description text="This tool's description comes from the extension's build, so it is not editable here." />
    </Form>
  );
}
