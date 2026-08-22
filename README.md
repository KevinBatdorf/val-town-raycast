# Val Town

Browse your [Val Town](https://www.val.town) account from Raycast, and allow Raycast AI to run the
vals you choose.

## Setup

Create a token at [val.town/settings/api](https://www.val.town/settings/api) and paste it into the
extension's preferences.

## The allow list

Raycast AI can only run vals you have allowed. **Configure** (`⌘T`) on any val — in the list or on
its own pane — opens the config screen, and the val joins the allow list when you save. Never
before: backing out of the screen changes nothing.

The config screen asks for a description for the model (leave it empty to use the val's own), whether
to ask before running, the entrypoint file to call, and the arguments the val takes as a JSON Schema.
With Raycast AI available, `⌘G` reads the entrypoint's code and drafts the schema — and fills in the
entrypoint too when the field is empty. Correct anything it got wrong before saving.

Once a val is allowed:

- **Disable** (`⇧⌘A`) switches it off. It drops out of what the model can see; its settings keep, and
  re-enabling goes back through **Configure** — save, and it is on again.
- **Require Confirm** (`⇧⌘C`) makes Raycast AI stop and ask before each run. It is off when you first
  allow a val, so nothing asks before running unless you say so.

Beyond running, Raycast AI can also — on your request — read an allowed val's files and blobs, check
its recent runs and failures, and load a skill of yours: a `skills/<name>/SKILL.md` file (with
frontmatter) in any of your vals, whose instructions name vals to run.

## Commands

### Search Vals

The only view command. The collection dropdown switches between **All Vals** and **AI Agent
Access** — the vals Raycast AI can run right now — and appears once at least one val is enabled.
Open a val to reach:

- **Files** — the file tree, with a read-only viewer for each file
- **Logs** and **Traces** — per file, since that is where Val Town hangs them. Both cover the last
  hour only; that is the whole window Val Town keeps
- **Schedule** — the cron or delay behind an interval file
- **Run** — `run_file`, or a plain fetch of an http file's endpoint
- **History** — commits on the branch
- **SQLite** — the val's own database: tables, row previews, and read-only queries
- **Blobs** — the val's own blob storage

The AI Agent Access collection is listed from the allow list itself rather than from search results,
so a val that was deleted or renamed on Val Town still appears rather than vanishing silently.

## Argument examples

The **Arguments** box on a val's config screen takes a JSON Schema describing the request body the
val's http handler reads. Raycast AI sends an object matching it, and the extension `POST`s that
object as the body. Leave the box empty and the val is called with `GET` and no body at all.

Give every property a `description`. That is what the model reads when it works out what to pass,
and it is the difference between a val the model calls correctly and one it guesses at.

**One required argument:**

```json
{
  "type": "object",
  "properties": {
    "city": { "type": "string", "description": "City to look up, for example Berlin" }
  },
  "required": ["city"]
}
```

**Optional arguments.** Anything left out of `required` is optional, so say what happens without it:

```json
{
  "type": "object",
  "properties": {
    "query": { "type": "string", "description": "Search term" },
    "limit": { "type": "integer", "description": "How many results to return. Defaults to 10." }
  },
  "required": ["query"]
}
```

**A fixed set of choices.** `enum` keeps the model from inventing a value:

```json
{
  "type": "object",
  "properties": {
    "status": { "type": "string", "enum": ["todo", "doing", "done"], "description": "The new status" }
  },
  "required": ["status"]
}
```

**Lists and nested objects:**

```json
{
  "type": "object",
  "properties": {
    "recipients": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Email addresses to notify"
    },
    "message": {
      "type": "object",
      "properties": {
        "subject": { "type": "string", "description": "Subject line" },
        "body": { "type": "string", "description": "Plain text body" }
      },
      "required": ["subject", "body"],
      "description": "The email to send"
    }
  },
  "required": ["recipients", "message"]
}
```

The extension does not check the body against the schema before sending it — the schema steers the
model, it does not police it. `required` and `enum` are instructions to Raycast AI, not validation.

## Where a val's settings live

In the **val's own blob storage**, under the key `raycast:tool.json`:

```json
{
  "version": 1,
  "inputSchema": { "type": "object", "properties": {} },
  "entrypoint": null,
  "description": null,
  "active": true,
  "confirm": false
}
```

It lives with the val so it survives forking, sharing, and reinstalling the extension. `confirm`
makes Raycast AI stop and check before running that val. `entrypoint` is the file to call, chosen on
the config screen — an http file is fetched at its endpoint, anything else runs with `run_file` and
takes no arguments. A config written before that field existed has `null` there, and falls back to
the first `main.*` http file, then the first http file, then the first runnable one.

If a val has no such config, calling it fails with a message saying so rather than quietly sending
an empty body.

## Where extension state lives

Which vals you allowed are stored as `raycast:tools.json` in your
**account-global blob storage**.
Everything about _how to call a particular val_ lives in that val instead.

The model is handed every allowed val's description and arguments together, and reads nothing else
until you ask it to run one.

Not LocalStorage, which is device-local and not covered by Raycast Cloud Sync, so the collection
would not follow you between machines. Not a dedicated val either, because a free Val Town account
cannot create a private one, and your tool collection should not be public.

That store is internal plumbing. The extension never lists it — the Blobs view is val-scoped only.

## Not included, on purpose

Editing code, creating vals, merging or reverting, environment variable values (the API only ever
returns their keys), and restricted-endpoint access lists (both reads need a business plan). Do
those on val.town.
