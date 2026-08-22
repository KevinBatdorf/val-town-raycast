# Val Town Raycast extension — rewrite

Branch `rewrite-ai-tools`, three commits in — read `git log main..HEAD` first. `main` still has
the old code if you need to look at it.

Store slug is `val-town` and already has installs, so this ships as a major version bump, not a new listing.

## Where this stands

**Built and committed.** MCP-over-HTTP client, blob state store, Search Vals and every sub-view
(files, logs, traces, schedule, history, SQLite, blobs), Manage Tools, the Errors menu bar,
and four AI tools. Lint, typecheck and `ray build -t release` are clean.

**Tagging is gone — done in PR 1a.** Membership is the blob's key set. State is version 2, adding
`skills` and `builtins` maps; version 1 blobs migrate in place and keep their entries.
`lib/builtins.ts` holds the built-in row registry that PR 3's write tools slot into.

**The read path has run against the live API.** `raycast:tools.json` in Kevin's global blob store
was written 2026-08-20 11:17 with a real derived spec for `kevinb/raycast-fixture`, a val seeded
the same morning. That val is the fixture to test against.

## Goal

An observability-first Val Town extension: the extension **views**, the val.town website **edits**.
Plus AI tools that turn the user's vals into callable capabilities for Raycast AI.

## Verified facts (do not re-derive)

Established by probing the live API. Trust these.

- **Tags exist but only through MCP.** `GET /v2/vals/{id}` has no `tags` field and there is no
  PATCH or PUT route (both 404). The public `openapi.json` does not mention tags at all.
- **So the extension talks to `https://api.val.town/v3/mcp` as plain JSON-RPC over HTTP.**
  Stateless: `tools/list` and `tools/call` both work with only an `Authorization: Bearer <token>`
  header — no session id, no `initialize` handshake. Accept header must include
  `application/json, text/event-stream`; responses come back as SSE `data:` lines.
- **`run_file` takes no arguments** (`val`, `path`, `branch` only). Anything needing input must be
  an http val called at its `links.endpoint` from `list_files`. Plain `fetch` works.
- **Logs and traces need a `fileId`.** `get_logs` and `get_traces` both require it, so they hang off
  a *file*, not a val. There is no account-wide "what is running" call.
- **`list_vals` returns `createdAt` but not `updatedAt`.** It does accept `updatedAfter` /
  `updatedBefore` / `sortBy: "updated"`. `list_files` returns per-file `updatedAt` and a `version` int.
- **Cache invalidation works via `updatedAfter`:** a code-only file edit *does* surface, with no
  false positives. A metadata-only change (description) does *not* bump it, so since PR 1a dropped
  the membership call, a renamed description lands only on a forced re-derive.
- **Blobs are val-scoped now.** `storage` is a required param on every blob tool, and only takes
  `{type:"val", val:"owner/valName"}` or `{type:"deprecated_global", org:"handle"}`.
  `/v1/blob` and `/v2/blob` REST have no val param, so they *are* the deprecated global store.
- **Free tier cannot create private vals** ("Unlimited public vals"; private is Pro). This is why
  extension state does not live in a dedicated val — a free user's tool collection would be public.
- **`find_val_town_skills` returns no val attribution.** Response is
  `{name, description, content, source}` only. Frontmatter is stripped into `name`/`description`;
  `triggers` is match-only and never returned. Full body arrives in one call.
- **Allowed users and bypass tokens are business-tier only.** `list_allowed_users`,
  `list_bypass_tokens` and `create_bypass_token` all fail with "Restricted HTTP access requires a
  paid business plan" on a free or pro org — verified against two vals on Kevin's account. This is
  why there is no Access view.
- **No code editor in Raycast.** `Form.TextArea` has only `enableMarkdown`, no highlighting, and
  there is no editor component. Use `Detail` with a fenced code block plus open-in-editor.
- **LocalStorage is device-local.** Not a Cloud Sync category, and the catch-all excludes anything
  not listed. Kevin runs two Macs plus Windows, so extension state must live server-side.

## Data layer

**MCP client** — one module. `POST https://api.val.town/v3/mcp`, JSON-RPC, parse the last SSE
`data:` line, unwrap `result.content[0].text` and `JSON.parse` it (some tools return prose, so
fall back to the raw string). Token comes from a `password` preference.

**State store** — global blob storage (`{type:"deprecated_global", org:<handle>}`), key
`raycast:tools.json`. Holds the spec cache, per-tool enabled/confirmation flags, and `lastSync`.
Limits: 100KB per text write, 10MB total on free. Discouraged in docs but not removed; migrate one
JSON file later if it goes away.

The global store is **internal plumbing only** — never list it, never surface it in any command.
Blob *views* in the UI are val-scoped exclusively. Note the key in the README.

**Membership + invalidation** — **no tagging.** The user never tags a val. The collection is
whatever they added in Manage Tools, so the blob's key set *is* membership.

Invalidation is one call: `list_vals({updatedAfter: lastSync})`, unfiltered, intersected with the
collection keys. Re-derive only that intersection, serve the rest from cache, write the new
`lastSync`.

## Commands (three)

Multiple commands is idiomatic Raycast, not an anti-pattern; users can enable/disable each one and
`disabledByDefault` ships one off. The test is "would someone launch this directly."

### 1. Search Vals — the front door

Search bar `List.Dropdown` for scope so everything lives in one command:

```
Search Vals            scope: [ Vals ▾ | Tools ]
└── Val Detail ................ get_val_detail + list_branches
    ├── Files .................. list_files (pass `path` to recurse into directories)
    │   └── File Detail ........ type, version, updatedAt, links
    │       ├── Logs ........... get_logs      (fileId lives here)
    │       ├── Traces ......... get_traces
    │       ├── Schedule ....... read_interval_settings (interval files only)
    │       └── Run ............ run_file, or fetch links.endpoint for http files
    ├── History ................ get_val_history — read-only, no revert
    ├── SQLite ................. sqlite_execute, gate to SELECT
    └── Blobs .................. listBlobs/readBlob with {type:"val"} — val-scoped only
```

Row actions: open on web, copy identifier, add as a tool.
Files are **list-only** with a viewer — no editing. Open the real editor for that.

### 2. Manage Tools

The home list, with a `List.Dropdown` filter: **All / Tools / Skills**. Every row opens a
configuration form. Actions on home: **Add Tool** and **Add Skill**.

**Built-in rows — one per tool, separate rules each.** `read val`, `run val`, `create val`,
`create file`, `update file`, `replace in file`, `rename file`, `delete file`, `delete val`,
`load skill`. Their descriptions are **not** editable: the schema is generated at build time.
Their form carries active + confirmation only.

**Added-val rows** — the vals the user chose. Form: active, ask-before-running (default **on**),
description, input schema.

**Added-skill rows** — same shape.

**Add Tool** → a list of the user's vals with basic details → pick one → *Set Tool Details* form.

**Add Skill** → a list of the user's skills. `find_val_town_skills` is query-only and returns no
val attribution, so it cannot enumerate. Listing means walking vals with `list_files` for
`skills/*/SKILL.md`, cached in the blob.

**Confirmation, per row:**

| Row | Asks |
| --- | --- |
| read | never |
| run, create, update, rename | ask-before-running toggle, default on |
| delete file, delete val | same toggle, default on. One confirm, not two |

Delete copy must be accurate rather than scary-generic, and should say it is a soft delete. A
deleted **file** is recoverable. A deleted **val** keeps its code history, SQLite, blobs and env
vars, but has **no self-serve undo** — restoring one means asking Val Town.

### 3. Errors — menu bar

`mode: "menu-bar"`, can't live inside a view command. User picks watched files; poll their traces and
notify on **new failures only**. At 60s granularity you'd miss most executions, so live status is
not worth showing. Ship it `disabledByDefault`.

## AI tools (static entries in `package.json`, one per capability)

Schemas come from the exported TypeScript `Input` type plus JSDoc comments. There is no runtime
tool registration, so the set is fixed at build time and descriptions are not user-editable.
Writes get **one tool per action**, not one tool with an `action` field, so each carries its own
confirmation rule.

Reads — never confirm:

1. **list** — the collection, returning finished specs (not raw val metadata)
2. **get info** — one val's files and code. Fallback for when the model wants source; off the hot path
3. **load skill** — `find_val_town_skills({query, limit})` filtered to `source: "personal"`.
   Unfiltered queries drag in Val Town's own platform guides

Run — confirmation per the row's toggle, default on:

4. **execute** — `run_file`, or fetch the http endpoint when input is needed

Writes — PR 3, one tool each, confirmation per the Manage Tools table:

5. **create val**, **create file**, **update file**, **replace in file**, **rename file**
6. **delete file**, **delete val** — same toggle, one confirm, copy says soft delete

**Skills are orchestrators, not per-val metadata.** A skill body names the vals to call as
`handle/valName`; the model reads it and invokes `execute` itself. No val↔skill binding and no
`raycast-skill` tag — which is why the missing val attribution doesn't matter.

Target flow: `@val-town load my zarquon skill and run it` → load skill → body names
`kevinb/zarquon-widget` → execute. In v2 the @-mention is optional since extensions load when
relevant, so tool descriptions carry the routing.

**Spec derivation happens at collection time, not at AI runtime** — `list_files` for the http file
plus `read_file` on `README.md` or the code, cached in the blob. Deriving mid-conversation costs
three or four round trips per invocation. `description` is capped at 64 chars, so the spec can't
live there.

## Build order

Steps 1–3 are useful on their own; the browse views are also the tools' plumbing, since spec
derivation reuses the same `list_files` + `read_file` calls.

- [x] 1. MCP-over-HTTP client + blob store
- [x] 2. Search Vals → Val Detail → Files → File Detail
- [x] 3. Logs, traces, schedule, history, SQLite, blobs, access
- [x] 4. Manage Tools
- [x] 5. The four AI tools

## Shipping

- [x] **PR 1** — everything above, as built. Its Manage Tools and membership layer are superseded
- [x] **PR 1a** — tagging dropped, Manage Tools rebuilt: per-tool rows, Add Tool, Add Skill,
      the All/Tools/Skills filter, and the per-row confirmation rules
- [ ] **PR 2** — the v2 model provider experiment, isolated from PR 1's code paths
- [ ] **PR 3** — agent-driven writes (spec below)

PR 2 uses Raycast v2's new extension-model-provider entry point: export `getModels` +
`streamCompletion` and the extension becomes a selectable AI model, receiving `tools` with
`inputSchema` and emitting `tool-call` / `tool-result` / `tool-approval-request` / `finish` stream
parts. That makes the extension own the conversation instead of handing tools to Raycast's model —
the original idea in issue #1 of KevinBatdorf/val-town-raycast.

**Kevin is not on Raycast v2 yet and cannot run PR 2.** Keep it separable.

## Ruled out — don't re-propose

- Env vars in the UI (values are never returned by the API, only keys)
- `find_templates` (official starter templates only, not public val search)
- Skills as a plugin feature of their own
- Tagging vals to opt them in. Settled: the user adds tools in Manage Tools, never by tagging
- Editing a val's code in the Raycast UI (there is no editor component). Agent-driven writes are
  in scope; a UI editor is not
- Merge and revert
- A top-level Blob Storage command (blobs are val-scoped; they belong in Val Detail)
- A dedicated val for extension state (free tier can't make it private)
- The Access sub-view (allowed users, bypass tokens). Both reads are business-tier gated, so the
  view could only ever error for most users
- MCP as an architecture for the extension itself — settled, do not raise

## Housekeeping

- `@raycast/api` 2.0.3 (published 2026-08-19); the API docs changelog still stops at 1.103.0
- Drop `node-fetch` — extensions run Node 22 with global `fetch`
- Old deps to refresh: `date-fns` v2, TypeScript 4, ESLint 7
- v2 renames: `KeyboardShortcut` → `Keyboard.Shortcut`; `environment.entryPointType` /
  `entryPointMode` replace the deprecated field
- README must document that the extension writes `raycast:tools.json` to global blob storage

## PR 1 as built — notes for PR 2

- `list_files` returns `endpoint` at the top level, not `links.endpoint` as this plan says.
  `endpointOf()` in `src/lib/api.ts` reads either.
- `get_val_detail` does **not** return `tags` despite its own tool description saying so. Moot
  once tagging is gone, but the same gap means it returns no description either — a view that
  wants one still pairs it with a `list_vals` call.
- `find_val_town_skills` answers `{query, matches}`, not `{skills}`.
- `Icon.ArrowMerge` does not exist in `@raycast/api` 2.0.3.
- `@raycast/eslint-config` 2.2.0 is flat-config and CommonJS: `eslint.config.js` must use
  `require`, and `.eslintrc.json` is gone.
- `ray develop` and `ray build` from `@raycast/api` 2.x default to the **development-channel**
  Raycast app (`com.raycast.macos.development`), which is not installed. Kevin runs release
  1.104.25, so every invocation needs `-t release` or it fails at the notify step with
  "Raycast is not running". Worth putting in an npm script.
- `ray develop --print-tool-schemas` dumps the four AI tools' generated schemas. The JSDoc block
  directly above a tool's default export becomes the tool's model-facing `instructions`, not a
  code comment — an implementation note there gets shipped to the model.
- Covered by throwaway harnesses that stub `fetch` with Val Town's SSE shape, bundled with esbuild
  against a `@raycast/api` stub. PR 1's ran 26 checks over the SSE envelope, README spec
  derivation, blob round-trip, `updatedAfter` invalidation, endpoint-vs-`run_file` dispatch, token
  withholding from public endpoints, and the auth/5xx/redirect failure paths. PR 1a's ran 26 more
  over v1 migration, sync intersection, the skill walk, and the confirmation rules. Neither is
  committed — the repo has no test framework.

## PR 3 — agent-driven writes

Not in the UI. One tool per action so each gets its own confirmation rule, per the Manage Tools
table: `create_val`, `create_file`, `update_file`, `replace_in_file`, `rename_file`,
`delete_file`, `delete_val`. Read half already exists: `get-val-info`.

**`update_file` takes no version parameter.** No optimistic locking and no If-Match, so an agent
write is last-writer-wins against anything edited on val.town in the meantime. The confirmation
has to show the file's current `version` and `updatedAt` from `list_files` so a file that moved
since the model read it is visible before the write lands.

Other facts from the tool schemas:

- `delete_file` is a soft delete and recoverable.
- `delete_val` is also soft — code history, SQLite, blobs and env vars are retained — but there is
  **no self-serve undo**; restoring means asking Val Town. That is what the confirm should say.
- `replace_in_file` sends only the diff and is faster; `update_file` is for wholesale rewrites.
- Both accept a `run` field that runs the file or fetches its endpoint in the same call, which
  removes the separate verify round trip.
- `revert_to_version` needs a branch **UUID**, which `get_val_detail` does not return — its
  `branches.items` carry only name, version and updatedAt. Only `get_val_history` surfaces a
  `branchId`.
- `create_val` privacy defaults depend on the destination org's tier, not the caller's, and
  `httpPrivacy` is not an input — read it back off the response.
