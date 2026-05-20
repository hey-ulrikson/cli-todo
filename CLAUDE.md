# CLAUDE.md

Guidance for Claude Code working in this repo.

## This repo is public

Treat every tracked line — code, comments, commits, fixtures, prompts, docs — as something a stranger on GitHub will read.

- **No PII, no employer-internal info.** No real colleague names, no work email addresses, no internal product names, no internal ticket IDs, no internal jargon. The specific forbid-list lives in `memory/public-repo.md` (gitignored) — consult it before committing. When in doubt, ask.
- **Fixtures and examples use clearly fictional values.** Alice / Bob / Carol, `PR101`, `TASK-710`, `Acme`. The `memory/` dir is where real context lives — never echo it into tracked files.
- **No personal paths.** Derive from `import.meta.dir`, `$HOME`, or `$XDG_DATA_HOME`. No `/Users/<name>/...`.
- **Commits explain themselves.** A reader landing from `git log` has no other context. Subject = the change. Body = the why, when not obvious. No internal ticket refs, no "as discussed", no external links.

## Architecture

Single-binary Bun CLI. Two kinds of subcommand:

1. **Read paths** (`list`, `today`, `doctor`) — pure SQLite, no AI, no network. Snapshots in `tests/render.test.ts` lock the output format — they're a contract.
2. **Write paths** (`add`, `done`, `do`, `move`, `clean`) — shell out to `claude -p` (Claude Code in print mode). The wrapper spawns Claude with `--allowed-tools Bash`, Claude operates the SQLite DB directly via `sqlite3`, and the wrapper prints a static confirmation. Claude's stdout is not consumed — clarification questions there go nowhere.

> **Do not propose migrating write paths to the Anthropic SDK or Claude Agent SDK.** Both require an `ANTHROPIC_API_KEY` with paid credits; the Pro/Max subscription's OAuth token is restricted to Claude Code and claude.ai per the consumer ToS and cannot authenticate the SDKs. Shelling out to `claude -p` is the deliberate choice that keeps this CLI on the user's existing subscription. Verified 2026-05-11.

Per-subcommand contract: success → exit 0, stdout ignored. Failure (no match, multi-match, ambiguity, no-change) → prose to stderr, non-zero exit; the wrapper relays the code.

## Single source of truth

Don't restate these in markdown — they drift.

- Status / urgency enums: `src/task.ts`.
- DB schema: `src/ai/schema.ts::describeSchema()` (fed to every write-path prompt).
- Per-subcommand model + verb + prompt: the `WRITERS` table in `src/ai/run.ts`.
- LLM title/note conventions: `.claude/skills/db/SKILL.md`.

`src/ai/memory.ts` reads `memory/*.md` at runtime and appends it to every write-path prompt. The dir is gitignored; missing files are silently skipped.

## Data model

- `Status` is the kanban column (`someday|general|coding|waiting|done`) — there's no separate done flag.
- `due_at` (nullable Unix seconds) overrides stored urgency for ranking, via `effectiveUrgency`.
- `id` is SQLite rowid — internal, never user-facing, but Claude receives it so write paths can reference rows.

## Rules

- TypeScript strict, no `any`.
- One subcommand = one `runX` in `src/commands/<sub>.ts`, helpers below it (top-down — caller above callee).
- `main()` is the only catch site; everything else throws prose.
- DB tests use `:memory:` SQLite, never the real file.
- Snapshot tests are a contract — update them in the same commit as any output change.
- `claude` must be on `$PATH`; `todo doctor` checks for it.

## Install detail worth knowing

`bun run install:bin` writes a shim at `~/.local/bin/todo` that `exec`s `bun run <repo>/src/index.ts`. The installed `todo` always runs current source — no rebuild step. Prompt and memory edits take effect on the next invocation.
