# Val Town Changelog

## [Rewrite] - 2026-08-20

Rebuilt around observability and AI tools. The extension views; val.town edits.

### Added

- Search Vals: file tree with a read-only viewer, plus per-file logs, traces and schedules
- Val history, val-scoped SQLite and blob browsing, and HTTP access settings
- Manage Tools: the vals tagged `raycast-tool`, with hand-editable specs, re-derivation and
  test runs
- Four AI tools: list the collection, execute one, read a val's source, and load one of your own
  Val Town skills
- Errors: an optional menu bar item that watches chosen files for failed executions

### Changed

- Talks to Val Town's MCP endpoint over plain HTTP, which is the only place val tags are exposed
- Extension state moved to account-global blob storage, so a tool collection follows you between
  machines
- Updated to `@raycast/api` 2.x and dropped `node-fetch` and `date-fns`

### Removed

- Running vals with arbitrary arguments from a form, searching other people's vals, likes and
  references. Val town's own site is better at all of these

## [Added Val Town] - 2023-10-16

Initial version code
