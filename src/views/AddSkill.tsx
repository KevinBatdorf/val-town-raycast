import { Action, ActionPanel, Color, Icon, List, Toast, showToast, useNavigation } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { listVals, webUrlFor } from "../lib/api";
import { errorMessage } from "../lib/format";
import { loadState, skillKey } from "../lib/store";
import { addSkill, scanSkills, type FoundSkill } from "../lib/skills";

export function AddSkill({ onAdded }: { onAdded: () => void }) {
  const { pop } = useNavigation();

  const { data, isLoading, error, revalidate } = useCachedPromise(async () => {
    const [{ vals }, state] = await Promise.all([listVals({}), loadState()]);
    const skills = await scanSkills(vals);
    return { skills, collected: new Set(Object.keys(state.skills)) };
  }, []);

  async function add(skill: FoundSkill) {
    const toast = await showToast({ style: Toast.Style.Animated, title: `Adding ${skill.name}` });
    try {
      await addSkill(skill);
      toast.style = Toast.Style.Success;
      toast.title = `Added ${skill.name}`;
      onAdded();
      pop();
    } catch (additionError) {
      toast.style = Toast.Style.Failure;
      toast.title = "Could not add this skill";
      toast.message = errorMessage(additionError);
    }
  }

  return (
    <List isLoading={isLoading} navigationTitle="Add Skill" searchBarPlaceholder="Filter skills">
      {error ? (
        <List.EmptyView
          icon={{ source: Icon.Warning, tintColor: Color.Red }}
          title="Could not scan for skills"
          description={errorMessage(error)}
          actions={
            <ActionPanel>
              <Action title="Try Again" icon={Icon.ArrowClockwise} onAction={revalidate} />
            </ActionPanel>
          }
        />
      ) : (
        <>
          <List.EmptyView
            icon={Icon.Book}
            title="No skills found"
            description="A skill is a SKILL.md file under skills/<name>/ in one of your vals."
          />
          {(data?.skills ?? []).map((skill) => {
            const already = data?.collected.has(skillKey(skill.val, skill.path)) === true;
            return (
              <List.Item
                key={skillKey(skill.val, skill.path)}
                icon={{ source: Icon.Book, tintColor: already ? Color.Purple : Color.SecondaryText }}
                title={skill.name}
                subtitle={skill.description || undefined}
                accessories={[
                  ...(already ? [{ tag: { value: "added", color: Color.Purple } }] : []),
                  { text: skill.val },
                ]}
                actions={
                  <ActionPanel>
                    <Action title={already ? "Add Again" : "Add Skill"} icon={Icon.Plus} onAction={() => add(skill)} />
                    <Action.OpenInBrowser title="Open on Val Town" url={webUrlFor(skill.val, skill.path)} />
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
