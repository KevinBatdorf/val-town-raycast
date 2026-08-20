# Val Town

Browse your [Val Town](https://www.val.town) account from Raycast, and turn the vals you choose
into tools Raycast AI can call.

The extension **views**; val.town **edits**. Nothing here writes your code.

## Setup

Create a token at [val.town/settings/api](https://www.val.town/settings/api) and paste it into the
extension's preferences.

## Commands

### Search Vals

The front door. Search your vals, or switch the scope dropdown to **Tools** to see only the ones
you added. Open a val to reach:

- **Files** — the file tree, with a read-only viewer for each file
- **Logs** and **Traces** — per file, since that is where Val Town hangs them. Both cover the last
  hour only; that is the whole window Val Town keeps
- **Schedule** — the cron or delay behind an interval file
- **Run** — `run_file`, or a plain fetch of an http file's endpoint
- **History** — commits on the branch
- **SQLite** — the val's own database: tables, row previews, and read-only queries
- **Blobs** — the val's own blob storage

### Manage Tools

Everything Raycast AI can reach, one row per capability, filtered by **All / Tools / Skills**.

- **Built-in** — the tools this extension ships: *Read Val*, *Run Val*, *Load Skill*. Their
  descriptions are generated at build time, so a row carries only the switches: active, and (for
  *Run Val*) whether to ask before running.
- **Your Vals** — the vals you added with **Add Tool** (`⌘N`). Each row has active,
  ask-before-running, and a hand-editable description and input schema. Each also shows whether its
  spec is `ok`, `stale`, has `no schema`, or is `not callable` because the val has no runnable file.
- **Your Skills** — the skills you added with **Add Skill** (`⇧⌘N`).

**Ask before running is on by default**, both on *Run Val* and on each val you add. Either switch
asking is enough to get a confirmation, so turn *Run Val*'s off if you want per-val control.

### Errors

An optional menu bar item, shipped off by default. Turn it on, then use **Watch for Errors** on any
file. It checks each watched file's traces once a minute and badges the count of failures you have
not acknowledged.

## Turning a val into a tool

1. **Add Tool** in Manage Tools, or `⌘T` on any row in Search Vals. Nothing is tagged and nothing on
   val.town changes — your collection lives in this extension.
2. Give the val an http file if it needs to take arguments. Only http vals can be called with input;
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
README. If the README has no lead paragraph, the description falls back to that field. Whatever is
derived is editable on the val's row, and a hand-edited spec survives syncing until you re-derive it.

Specs are derived when you add a val and refreshed when the collection syncs, not while Raycast AI
is mid-conversation — reading files per invocation would cost three or four extra round trips every
time. A sync asks Val Town which vals changed since the last one and re-derives only those.

## Skills

A skill is a markdown guide at `skills/<name>/SKILL.md` in one of your vals. Its body names the vals
to call as `handle/valName`, and the model calls them itself — there is no binding between a skill
and a val.

**Add Skill** walks your vals looking for those files, since Val Town's skill search can only answer
queries and never says which val a skill came from. Once you have added at least one, *Load Skill*
returns only the skills you added and left active; with none added it returns any of your own that
match. Val Town's platform guides are always filtered out.

## Where extension state lives

Your collection — the vals, the skills, the spec cache, the switches, the watch list — is stored as
`raycast:tools.json` in your **account-global blob storage**.

Not LocalStorage, which is device-local and not covered by Raycast Cloud Sync, so the collection
would not follow you between machines. Not a dedicated val either, because a free Val Town account
cannot create a private one, and your tool collection should not be public.

That store is internal plumbing. The extension never lists it — the Blobs view is val-scoped only.

## Not included, on purpose

Editing code, creating vals, merging or reverting, environment variable values (the API only ever
returns their keys), and restricted-endpoint access lists (both reads need a business plan). Do
those on val.town.
