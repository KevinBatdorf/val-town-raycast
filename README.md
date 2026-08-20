# Val Town

Browse your [Val Town](https://www.val.town) account from Raycast, and turn the vals you choose
into tools Raycast AI can call.

The extension **views**; val.town **edits**. Nothing here writes your code — the one exception is
toggling the `raycast-tool` tag, which is how a val opts into being callable.

## Setup

Create a token at [val.town/settings/api](https://www.val.town/settings/api) and paste it into the
extension's preferences. Read access is enough to browse; add write access if you want to tag vals
as tools from Raycast.

## Commands

### Search Vals

The front door. Search your vals, or switch the scope dropdown to **Tools** to see only the ones
tagged `raycast-tool`. Open a val to reach:

- **Files** — the file tree, with a read-only viewer for each file
- **Logs** and **Traces** — per file, since that is where Val Town hangs them. Both cover the last
  hour only; that is the whole window Val Town keeps
- **Schedule** — the cron or delay behind an interval file
- **Run** — `run_file`, or a plain fetch of an http file's endpoint
- **History** — commits on the branch
- **SQLite** — the val's own database: tables, row previews, and read-only queries
- **Blobs** — the val's own blob storage
- **Access** — which organisations are granted the val's restricted endpoints, and which bypass
  tokens exist (metadata only; secrets are never returned by the API)

### Manage Tools

Every val tagged `raycast-tool`, joined against the cached spec Raycast AI will call it with. Each
row shows whether the spec is `ok`, `stale`, has `no schema`, or is `not callable` because the val
has no runnable file. Drill in to read the spec, hand-edit it, re-derive it, or test-run it with
sample arguments. Per-tool switches: enabled, and whether to ask before running.

### Errors

An optional menu bar item, shipped off by default. Turn it on, then use **Watch for Errors** on any
file. It checks each watched file's traces once a minute and badges the count of failures you have
not acknowledged.

## Turning a val into a tool

1. Tag the val `raycast-tool` — from Search Vals (`⌘T`) or on val.town.
2. Give it an http file if it needs to take arguments. Only http vals can be called with input;
   everything else runs through `run_file` with none.
3. Write its README:
   - the **first prose paragraph** becomes the tool's description
   - the **first fenced `json` block** that looks like a JSON Schema becomes its input schema

```json
{
  "type": "object",
  "properties": { "city": { "type": "string", "description": "City to look up" } },
  "required": ["city"]
}
```

A val's own `description` field is capped at 64 characters, which is why the spec lives in the
README. If the README has no lead paragraph, the description falls back to that field.

Specs are derived when the collection syncs, not while Raycast AI is mid-conversation — reading
files per invocation would cost three or four extra round trips every time. A code change lands on
the next sync; a description-only change lands too, since it comes back with the membership call.
Hand-edited specs survive syncing until you re-derive them.

## Skills

Ask Raycast AI to load one of your own Val Town skills — a markdown guide at
`skills/<name>/SKILL.md` in any of your vals. A skill is an orchestrator: its body names the vals
to call as `handle/valName`, and the model calls them itself. There is no binding between a skill
and a val, and no second tag to manage. Val Town's own platform guides are filtered out.

## Where extension state lives

Your tool collection — the spec cache, the per-tool switches, the watch list — is stored as
`raycast:tools.json` in your **account-global blob storage**.

Not LocalStorage, which is device-local and not covered by Raycast Cloud Sync, so the collection
would not follow you between machines. Not a dedicated val either, because a free Val Town account
cannot create a private one, and your tool collection should not be public.

That store is internal plumbing. The extension never lists it — the Blobs view is val-scoped only.

## Not included, on purpose

Editing code, creating vals, merging or reverting, and environment variable values (the API only
ever returns their keys). Do those on val.town.
