import { Action, ActionPanel, Form, Icon, Toast, showToast, useNavigation } from "@raycast/api";
import { webUrlFor } from "../lib/api";
import { errorMessage } from "../lib/format";
import { mutateState, skillKey, type SkillEntry } from "../lib/store";

export function SkillForm({ entry, onSaved }: { entry: SkillEntry; onSaved: () => void }) {
  const { pop } = useNavigation();

  async function submit(values: { enabled: boolean }) {
    try {
      await mutateState((state) => ({
        ...state,
        skills: { ...state.skills, [skillKey(entry.val, entry.path)]: { ...entry, enabled: values.enabled } },
      }));
      onSaved();
      pop();
    } catch (error) {
      await showToast({ style: Toast.Style.Failure, title: "Could not save", message: errorMessage(error) });
    }
  }

  return (
    <Form
      navigationTitle={entry.name}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save Skill" icon={Icon.Check} onSubmit={submit} />
          <Action.OpenInBrowser title="Open on Val Town" url={webUrlFor(entry.val, entry.path)} />
        </ActionPanel>
      }
    >
      <Form.Description title="Skill" text={entry.name} />
      <Form.Description title="File" text={`${entry.val} · ${entry.path}`} />
      <Form.Description title="Description" text={entry.description || "—"} />
      <Form.Checkbox id="enabled" label="Active" defaultValue={entry.enabled} />
      <Form.Separator />
      <Form.Description text="Name and description come from the skill's own frontmatter. Edit them on val.town." />
    </Form>
  );
}
