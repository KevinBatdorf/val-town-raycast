import { Action, ActionPanel, Icon, List } from "@raycast/api";
import { useProfile } from "../hooks/useProfile";
import { UserReferencedList } from "./UserReferencedList";

export const MyReferencedVals = () => {
  const { profile } = useProfile();
  return (
    <List.Item
      id="my-referenced-vals"
      icon={Icon.Megaphone}
      title="My Referenced Vals"
      actions={
        <ActionPanel>
          <Action.Push
            icon={Icon.List}
            title="View Your Referenced Vals"
            target={<UserReferencedList userId={profile?.id} />}
          />
        </ActionPanel>
      }
    />
  );
};
