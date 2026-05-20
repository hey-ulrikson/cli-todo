# todo

Terminal-first AI todo CLI. Reads are pure code (instant, deterministic). Writes shell out to `claude -p` (Claude Code in print mode).

## Install

```fish
bun install
bun run install:bin                 # writes a shim at ~/.local/bin/todo that runs live source
```

`~/.local/bin` must be on `PATH`. `claude` must also be on `PATH` (`todo doctor` checks for it).

## Commands

| | |
|---|---|
| `todo` / `todo list` | Open tasks grouped by status. |
| `todo today [--n 5]` | Top-ranked open tasks for today. |
| `todo add "<text>"` | AI classifies status, urgency, title, note. |
| `todo done "<text>"` | AI matches free text against open tasks; marks one done. |
| `todo doctor` | Sanity check (env, DB, memory). |

## Where things live

- DB: `~/.local/share/todo/tasks.db` (override with `TODO_DB`).
- Memory (AI context): `memory/*.md` in the repo root — read live by the source. The directory is gitignored; populate it locally with `people.md`, `projects.md`, `glossary.md`, `conventions.md` to give the AI extra context (any subset works).
- Source: the repo root.
