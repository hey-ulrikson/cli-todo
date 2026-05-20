---
name: db
description: Inspect or edit the todo SQLite database directly via sqlite3. Use whenever you need to read, query, or mutate the tasks DB.
---

Use this skill whenever you're touching the todo SQLite DB directly — reading rows, inserting tasks, marking done, sorting, or one-off mutations.

Database path: resolve via `$TODO_DB`, else `$XDG_DATA_HOME/todo/tasks.db`, else `$HOME/.local/share/todo/tasks.db`.

Discover the schema at runtime with `.schema tasks` in sqlite3 (or read `src/ai/schema.ts::describeSchema()` if working inside the cli-todo repo).

## Title and note format

Rendered as `title — note`. Combined line ≤ 70 chars (hard cap 80). Title alone ≤ 40.

- Title: the verb+object. No author, no status narration, no parentheticals.
- **Scan-friendly refs lead the title.** PR numbers go first: `PR 521 Review`, not `Review PR 521`. The user scans the list by PR number — leading it means the eye lands on it without reading past the verb.
- **Tracker IDs go in the note, not the title.** Notion/ticket IDs like `TASK-710` are opaque labels — they don't help scan a list. Append them at the end of the note: `Fix billing issues — TASK-710.`, not `Fix billing issues in TASK-710`. Exception: when the action is *about* the artifact (e.g. a PR), the short ref leads the title per the rule above.
- Note: one short sentence of context. Name the author with a bare first name (`Alice.`) **only when the work is someone else's**. The user's own work gets no tag — **never write `Own.`**; an untagged task is theirs by default. Drop `Author:` prefix and role labels (`(intern)`, `(own)`).
- Don't restate what `status` already encodes (`waiting` ⇒ blocked; don't say "waiting on …").
- Push deadlines into `due_at`, not the note. Strip year from dates when current.
- One sentence. No ellipsis dumps. Prefer dropping non-load-bearing detail over abbreviating to opacity.

Examples:
- ✅ `PR 521 Review — Alice. Re-review.`
- ✅ `PR 495 Review — feature rollout.`
- ✅ `Fix billing issues — TASK-710.`
- ❌ `Review PR 521 — Alice. Re-review.` (PR number should lead)
- ❌ `Fix billing issues in TASK-710` (tracker ID belongs in the note)
- ❌ `Review PR 506 — Author: Bob Smith. Approved, asked Bob to clarify a comment, waiting on him.`

## Conventions

- Always set `updated_at=strftime('%s','now')` on UPDATE.
- Tasks with `status='waiting'` must have `urgency='yellow'`.
- Single-quote escape: double up internal single quotes in SQL string literals.
- Wrap multi-row writes in `BEGIN; … COMMIT;`.
- Execute without asking for confirmation — the user has granted free rein. This includes mutations and destructive ops (DELETE, DROP, bulk UPDATE).

Workflow:
1. Read the user's request.
2. Run the query or mutation directly via `sqlite3 "<DB path>" "<SQL>"` (or heredoc for multi-statement).
3. After mutations, re-query to confirm the new state and show the result.
