# Val Town Raycast extension — local notes

Facts established by hitting the live API or the Raycast runtime. Not derivable from the code, and
expensive to rediscover. Not committed.

## Val Town account tiers gate two things

- **`httpPrivacy: "restricted"` requires a paid business plan.** `set_http_privacy` rejects with
  "Restricted HTTP access requires a paid business plan." on anything less. This extension therefore
  **reads and displays app access but never sets it** — a control that fails for most accounts is
  worse than no control. Do not add a setter back.
- **`privacy: "private"` / `"unlisted"` require pro or business.** A free-tier org can only hold
  public vals. `update_val`'s `privacy` field is wired up and works on this account.
- Kevin's org is **pro**: private code succeeds, restricted endpoints do not.
- Also business-gated, which is why there is no Access view: `list_allowed_users`,
  `list_bypass_tokens`, `create_bypass_token`.

## The two access axes are independent

- `privacy` — `public` / `unlisted` / `private` — who can read the **source**. Changed by `update_val`.
- `httpPrivacy` — `public` / `restricted` — who can call the **endpoint**. Changed by `set_http_privacy`.

Only the second affects whether `execute-tool` can reach a val. A restricted val answers
unauthenticated callers with a 302 to login; `callEndpoint` sends the account token when it sees
`restricted`.

## SOLVED: get_val_detail "flakiness" was the text part being prose

MCP tool results carry `content` (display text) and sometimes `structuredContent` (machine JSON).
For most Val Town tools the text part happens to be JSON; for `get_val_detail` it is a one-line
prose summary, so any client reading only the text part gets non-JSON. `callTool` now prefers
`structuredContent` and only falls back to parsing the text. Clients with proper MCP plumbing read
structuredContent, which is why direct calls always looked fine.

## Tag colours — one meaning each, no sharing

| colour | meaning |
| --- | --- |
| Green / Yellow | code visibility: `public` / `unlisted` |
| Blue / Magenta | app access: `public` / `restricted` |
| Orange | `must confirm` |
| Purple | `ai` (agent access enabled) |
| Red | no config — calling will fail |

## The list is terse; the detail pane is complete

**List rows** carry a tag only when there is something to notice, so absence is the signal:

- **private code** — no tag. It reaches no further than the account.
- **public app access** — no tag. Two tags both reading "public" say less than one.
- **agent access disabled** — no tag, and no icon tint. A switched-off val looks identical to one
  never enabled; a row is not asked to distinguish "off" from "never set up".

**The val's detail pane states the whole picture instead**, because that is where you go to find out:

- no config — the AI Agent Access row is absent entirely
- active — `ai`, plus `must confirm` or `no confirm`
- disabled — `disabled` alone

Do not make one match the other. They are terse and complete on purpose.

## Raycast runtime

- **The hover highlight in an open dropdown resets on its own.** Reproduced 2026-08-22 in a build
  with zero hooks, zero state and hardcoded rows — it is Raycast's, not ours. Do not burn time
  re-investigating from this codebase.
- **A submenu's header clears itself after ~5s.** Reproducible, nothing in this codebase runs on that
  cadence, and `ActionPanel.Submenu`'s `title` is a required prop that feeds both the parent row and
  the header. Not fixable from here — do not put load-bearing information in a submenu title.
- Broader Raycast gotchas live in the `raycast-extensions` skill, symlinked at
  `.claude/skills/raycast-extensions` from `~/code/raycast/skills/`.

## This checkout

A git worktree. `/Users/kevin/code/raycast/valtown` on `rewrite-ai-tools` holds a second, older copy
of the same uncommitted work. Nothing is pushed and there is no remote branch.

## Axioms — Kevin's design rules, learned the hard way

Each of these was enforced in review at least once. Follow them without being asked.

1. **The allow list is the only gate.** Membership is capability; there are no global switches. A
   val not in the list is absent, not refused — tools answer with an empty result, never a lecture.
2. **State changes only on save.** Enabling happens by submitting the config form — never on mount,
   never as a side effect. Escaping any screen leaves everything exactly as it was.
3. **Until a val is enabled, Configure is its only action.** Disable and the confirm toggle exist
   only on enabled vals. Re-enabling goes through Configure (the Active checkbox), not a blind flip.
4. **Lists are terse; the detail pane is complete.** A row carries a tag only when there is
   something to notice (no "public" app access, no tag for private code, nothing for disabled).
   The pane states the whole picture. Do not make one match the other.
5. **One meaning per colour.** Green/yellow = code visibility, purple = ai, orange = must-confirm,
   red = broken config. Never reuse a hue for a second meaning.
6. **No filler in copy.** No ellipses, no "unknown" placeholders that read as truncation, no
   restating the title in a description, no "either X or Y" when the code knows which.
7. **A group of one is not a group.** A section with a single action folds into the section above.
8. **Errors surface; they are never swallowed.** A failed call shows a toast or an inline message
   with the real error text. Catch-and-null turned real bugs invisible twice today.
9. **Model prompts route by description matching.** Request matches a val's description → run it
   (confirm flag is the safety, not model hesitancy). Question about the collection → answer from
   list-tools. No prescribed call chains beyond the one tested exception (get-val-info→execute was
   tried and later removed).
10. **Reads gate on membership, runs gate on active.** Inspecting a disabled val is how the user
    decides to re-enable it.
