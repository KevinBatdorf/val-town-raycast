# Val Town

Browse your [Val Town](https://www.val.town) account from Raycast, and turn the vals you choose
into tools Raycast AI can call.

The extension **views**; val.town **edits**. Nothing here writes your code — the only things it
changes are a val's two access settings and the config it stores alongside the val.

## Setup

Create a token at [val.town/settings/api](https://www.val.town/settings/api) and paste it into the
extension's preferences.

## Commands

### Search Vals

The only view command. The collection dropdown switches between **All Vals** and **Allowed** — the
vals you have let Raycast AI call. Open a val to reach:

- **Files** — the file tree, with a read-only viewer for each file
- **Logs** and **Traces** — per file, since that is where Val Town hangs them. Both cover the last
  hour only; that is the whole window Val Town keeps
- **Schedule** — the cron or delay behind an interval file
- **Run** — `run_file`, or a plain fetch of an http file's endpoint
- **History** — commits on the branch
- **SQLite** — the val's own database: tables, row previews, and read-only queries
- **Blobs** — the val's own blob storage

**AI agent access** is a val's one setting, with three states. A val starts with none of it:
**Enable** (`⌘T`) opens the config screen, and the val joins the list when you save — never before,
so backing out changes nothing. After that **Disable** / **Enable** (`⇧⌘A`) turns it off and on, and
**Configure** reopens the config screen. A disabled val stays in the list and is hidden from the
model; that is the off state, so there is nothing to remove.

Nothing here creates anything. Raycast's tools are fixed at build time — *List Vals*, *Read Val* and
*Run Val* — and the list only decides which of your vals those three are willing to touch. That is
also why there is no global switch: a val you never enable is not refused, it simply is not one of
the user's tools as far as *List Vals* is concerned.

The Allowed collection is listed from the list itself rather than from search results, so a val that
was deleted or renamed on Val Town still appears rather than vanishing silently.

**Nothing asks before running unless you say so.** Ask-before-running is a switch on each val,
off when you first allow it.

### Errors

An optional menu bar item, shipped off by default. Turn it on, then use **Watch for Errors** on any
file. It checks each watched file's traces once a minute and badges the count of failures you have
not acknowledged.

## Allowing a val as a tool

**Enable** (`⌘T`) on any val row, or on the val's own pane. That opens the config screen; the val
joins the list only when you save, so escaping the screen changes nothing.

The screen asks for the arguments the val takes, as a JSON Schema, plus a description for the model
and whether it should ask before running. With Raycast AI available, `⌘G` reads the val's code and
drafts the schema for you — correct anything it got wrong before saving.

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

Which vals you allowed and the error watch list are stored as `raycast:tools.json` in your
**account-global blob storage**.
Everything about *how to call a particular val* lives in that val instead.

Listing costs one call no matter how many vals you have allowed: the model gets identifiers and
descriptions, then reads the config for the one val it is about to run.

Not LocalStorage, which is device-local and not covered by Raycast Cloud Sync, so the collection
would not follow you between machines. Not a dedicated val either, because a free Val Town account
cannot create a private one, and your tool collection should not be public.

That store is internal plumbing. The extension never lists it — the Blobs view is val-scoped only.

## Not included, on purpose

Editing code, creating vals, merging or reverting, environment variable values (the API only ever
returns their keys), and restricted-endpoint access lists (both reads need a business plan). Do
those on val.town.
