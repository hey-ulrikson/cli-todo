# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `bun test` — full test suite. `bun test tests/ranking.test.ts` for a single file; `bun test -t "<name>"` for a single test.
- `bun run todo -- <args>` — run the CLI from source against the live DB.
- `bun run install:bin` — writes a shim at `~/.local/bin/todo` that `exec`s `bun run <repo>/src/index.ts`. The installed `todo` always runs current source; no rebuild step.
- No lint/format step is configured.

## Architecture

Single-binary Bun CLI. `src/index.ts` is the entry point: it parses argv, dispatches to one handler per subcommand, and is the only place that catches errors.

Two kinds of subcommand:

1. **Read paths** (`list`, `today`, `doctor`) — pure SQLite, no AI, no network. `list`/`today` go through `db.ts` → `queries.loadOpenTasks` → `ranking.ts` → `render.ts`. `effectiveUrgency` overrides stored urgency based on `due_at` vs. now; `isHiddenFromToday` keeps far-future tasks out of `today`. Snapshot tests in `tests/render.test.ts` lock the output format — changing it is a contract break.

2. **Write paths** (`add`, `done`, `do`, `move`) — shell out to `claude -p` (Claude Code in print mode). The wrapper builds a prompt, spawns Claude with `--allowed-tools Bash`, and Claude operates the SQLite DB directly via `sqlite3`. Claude only mutates; the wrapper prints a static confirmation (`✅ Added` / `✅ Done` / `✅ Moved`) and is done. Claude's stdout is not consumed.

> **Do not propose migrating write paths to the Anthropic SDK or Claude Agent SDK.** Both require an `ANTHROPIC_API_KEY` with paid credits; the Pro/Max subscription's OAuth token is restricted to Claude Code and claude.ai per the consumer ToS and cannot authenticate the SDKs. Shelling out to `claude -p` is the deliberate choice that keeps this CLI on the user's existing subscription. Verified 2026-05-11.

`move` is the dedicated cheap path for kanban column changes (`someday|general|coding|waiting`); `done` is its own command. `do` is the catch-all: free-form instruction → arbitrary mutation against the schema, used for anything `add`/`done`/`move` don't cover (field edits, splits, bulk rewords, etc.).

Models: `do` runs on `opus` (highest reasoning, low frequency, high error cost). `add` runs on `sonnet`. `done`, `move` run on `haiku`. `clean` runs on `opus`.

Contract between wrapper and Claude:
- Success: Claude writes the change(s) and exits 0. Stdout is ignored.
- On no-match / multi-match / ambiguity / no-change: Claude writes a prose error to stderr and exits non-zero; the wrapper relays the exit code.

`today` does not auto-sort — it just reads and renders the current DB state.

### Prompts and the `db` skill

- Per-subcommand instructions live as Markdown in `src/prompts/{add,done,do,move}.md`. They are imported as text via Bun's `with { type: 'text' }`.
- Shared SQLite conventions live in `.claude/skills/db/SKILL.md` (project-level skill). `src/ai/run.ts` imports the SKILL.md text and prepends it to every prompt — single source of truth for schema, status/urgency enums, and SQL conventions.
- `src/ai/memory.ts` reads `memory/{people,projects,glossary,conventions}.md` at runtime and concatenates them into a `MEMORY` string that's also appended to every prompt. The `memory/` dir is gitignored — missing files are silently skipped.
- The wrapper also appends today's date, the DB path, and the open-task TSV.

The installed `todo` is a shim that runs source live, so prompt and memory edits take effect on the next invocation.

### Data model notes

`Status` is the kanban column (`someday|general|coding|waiting|done`); there is no separate done flag. `Urgency` is `red|yellow|blue`. `due_at` is nullable Unix seconds and, when set, takes precedence over stored urgency for ranking via `effectiveUrgency`. `id` is SQLite rowid — internal only, never shown to the user, but Claude receives it so `done`/`do` can reference specific rows.

### Testing

Tests live in `tests/`. Ranking, rendering, queries, and doctor are tested directly. There are no AI tests — Claude's behavior is exercised end-to-end by running the binary, not unit-tested. Use `:memory:` SQLite for DB tests.

## Conventions specific to this repo

- TypeScript strict, no `any`. One subcommand = one `runX` function under `src/commands/<sub>.ts` with helpers below it (top-down layout — caller above callee).
- Errors throw with prose; `main()` is the only catch site.
- The output formats locked by `tests/render.test.ts` are a contract. Don't change them without updating the snapshot tests together.
- `claude` must be on `$PATH`. `todo doctor` checks for it.
