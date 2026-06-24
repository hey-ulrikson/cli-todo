# CLAUDE.md

Guidance for Claude Code working in this repo.

## This repo is public

Treat every tracked line — code, comments, commits — as something a stranger on GitHub will read. No PII, no employer-internal info, no personal paths (derive from `$HOME`). Fixtures use clearly fictional values (Alice/Bob, `PR101`). When in doubt, ask.

## What this is

A todo app that's just a markdown file. The entire app is `src/index.ts` — a thin Bun CLI over `TODO.md`:

- `todo` / `todo list` — print open items, numbered.
- `todo add <text>` — append `- [ ] <text>`.
- `todo done <n...>` — check the n-th open item(s) by their `list` number.

The file is `$TODO_FILE` (default `~/TODO.md`), a plain markdown checklist. Edit it by hand anytime; the CLI just saves typing. No database, no AI, no network, no dependencies beyond Bun.

`bun run install:bin` writes a shim at `~/.local/bin/todo` that runs live source — no rebuild step.
