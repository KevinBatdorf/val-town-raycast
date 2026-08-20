import { Action, ActionPanel, Color, Icon, List } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { listAllowedUsers, listBypassTokens } from "../lib/api";
import { errorMessage, formatDateTime } from "../lib/format";

export function AccessList({ val }: { val: string }) {
  const { data, isLoading, error } = useCachedPromise(
    async (identifier: string) => {
      const [users, tokens] = await Promise.all([listAllowedUsers(identifier), listBypassTokens(identifier)]);
      return {
        users: users.allowedUsers ?? users.users ?? [],
        tokens: tokens.bypassTokens ?? tokens.tokens ?? [],
      };
    },
    [val],
  );

  const users = data?.users ?? [];
  const tokens = data?.tokens ?? [];

  return (
    <List isLoading={isLoading} navigationTitle={`Access · ${val}`} searchBarPlaceholder="Filter access">
      {error ? (
        <List.EmptyView
          icon={{ source: Icon.Warning, tintColor: Color.Red }}
          title="Could not read access settings"
          description={errorMessage(error)}
        />
      ) : (
        <>
          <List.EmptyView
            icon={Icon.Key}
            title="No grants or tokens"
            description="These only take effect once the val's HTTP access is restricted."
          />
          {users.length > 0 ? (
            <List.Section title="Granted Organisations">
              {users.map((user) => (
                <List.Item
                  key={user.orgId}
                  icon={Icon.PersonCircle}
                  title={user.handle}
                  accessories={[{ text: user.orgId }]}
                  actions={
                    <ActionPanel>
                      <Action.CopyToClipboard title="Copy Handle" content={user.handle} />
                      <Action.OpenInBrowser title="Open Profile" url={`https://www.val.town/u/${user.handle}`} />
                    </ActionPanel>
                  }
                />
              ))}
            </List.Section>
          ) : null}
          {tokens.length > 0 ? (
            <List.Section title="Bypass Tokens">
              {tokens.map((token) => (
                <List.Item
                  key={token.publicId}
                  icon={{
                    source: token.revokedAt ? Icon.XMarkCircle : Icon.Key,
                    tintColor: token.revokedAt ? Color.Red : Color.Green,
                  }}
                  title={token.name?.trim() || token.publicId}
                  subtitle={token.revokedAt ? `Revoked ${formatDateTime(token.revokedAt)}` : undefined}
                  accessories={token.createdAt ? [{ date: new Date(token.createdAt) }] : []}
                  actions={
                    <ActionPanel>
                      <Action.CopyToClipboard title="Copy Public ID" content={token.publicId} />
                    </ActionPanel>
                  }
                />
              ))}
            </List.Section>
          ) : null}
        </>
      )}
    </List>
  );
}
