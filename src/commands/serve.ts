import type { Database } from 'bun:sqlite';
import { runClaude } from '../ai/run';
import { openDb } from '../db';
import { countDoneSince, loadOpenTasks } from '../queries';
import { rank, effectiveUrgency } from '../ranking';
import { SECTION_ORDER, STATUS_DISPLAY } from '../render/list';
import { stripTrailingPeriod, withOwnTagStripped } from '../render/meta';
import type { Task } from '../task';
import { nowSec, resolveDbPath, startOfDaySec } from '../util';

type OpenStatus = (typeof SECTION_ORDER)[number];

// Dimmed and compacted in the UI, mirroring how the terminal grays these out.
const QUIET: ReadonlySet<OpenStatus> = new Set(['waiting', 'someday']);

function statusLabel(status: OpenStatus): string {
  const { emoji, label } = STATUS_DISPLAY[status];
  return `${emoji} ${label}`;
}

export function runServe(): void {
  const db = openDb(resolveDbPath());
  const port = Number(process.env.TODO_PORT) || 4567;
  const server = Bun.serve({ hostname: '127.0.0.1', port, fetch: (req) => handle(req, db) });
  const url = `http://127.0.0.1:${server.port}`;
  console.log(`todo web UI on ${url}  (Ctrl-C to stop)`);
  Bun.spawn(['open', url]);
}

async function handle(req: Request, db: Database): Promise<Response> {
  const { pathname } = new URL(req.url);
  if (req.method === 'POST' && pathname === '/edit') return freeform(req, db);
  if (req.method === 'POST' && pathname === '/done') return mutate(req, db, (id) => markDone(db, id));
  if (req.method === 'POST' && pathname === '/status') return mutate(req, db, (id, body) => setStatus(db, id, body.get('status')));
  if (req.method === 'POST' && pathname === '/rename') return mutate(req, db, (id, body) => renameTask(db, id, body.get('title')));
  if (pathname === '/') return html(await page(db));
  return new Response('not found', { status: 404 });
}

// Freeform box routes through the LLM `edit` catch-all — natural text in, any mutation out
// (add, mark done, move, reword), not just adds.
async function freeform(req: Request, db: Database): Promise<Response> {
  const text = new URLSearchParams(await req.text()).get('text')?.trim();
  if (text) await runClaude('edit', text, true);
  return html(await page(db));
}

async function mutate(req: Request, db: Database, apply: (id: number, body: URLSearchParams) => void): Promise<Response> {
  const body = new URLSearchParams(await req.text());
  const id = Number(body.get('id'));
  if (!Number.isInteger(id)) return new Response('bad id', { status: 400 });
  apply(id, body);
  return html(await page(db));
}

function markDone(db: Database, id: number): void {
  db.run('UPDATE tasks SET status=?, done_at=?, updated_at=? WHERE id=?', ['done', nowSec(), nowSec(), id]);
}

function setStatus(db: Database, id: number, status: string | null): void {
  if (!status || !SECTION_ORDER.includes(status as never)) return;
  // Convention: waiting tasks are always yellow.
  const urgency = status === 'waiting' ? 'yellow' : undefined;
  if (urgency) db.run('UPDATE tasks SET status=?, urgency=?, updated_at=? WHERE id=?', [status, urgency, nowSec(), id]);
  else db.run('UPDATE tasks SET status=?, updated_at=? WHERE id=?', [status, nowSec(), id]);
}

// Edits the stored title verbatim — no LLM. Display still strips tags/periods on render.
function renameTask(db: Database, id: number, title: string | null): void {
  const next = title?.trim();
  if (!next) return;
  db.run('UPDATE tasks SET title=?, updated_at=? WHERE id=?', [next, nowSec(), id]);
}

async function page(db: Database): Promise<string> {
  const now = nowSec();
  const open = loadOpenTasks(db).filter((t) => t.status !== 'done');
  const doneToday = countDoneSince(db, startOfDaySec(now));
  const prStatuses = await fetchPrStatuses(open.map((t) => prNumber(t.title)).filter((n): n is number => n !== null));
  const groups = SECTION_ORDER.map((s) => ({ status: s, items: rank(open.filter((t) => t.status === s), now) })).filter((g) => g.items.length);
  let i = 0;
  const sections = groups
    .map((g) => {
      const html = section(g.status, g.items, now, i, prStatuses);
      i += g.items.length;
      return html;
    })
    .join('');
  return masthead(open.length, doneToday, now) + ADD_FORM + (sections || '<p class="empty">all done — go outside ☀️</p>');
}

function masthead(openCount: number, doneToday: number, now: number): string {
  const date = new Date(now * 1000).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const count = openCount === 0 ? 'nothing open' : `${openCount} open`;
  const done = doneToday > 0 ? `<span class="streak">✓ ${doneToday} done today</span>` : '';
  return `<header class="masthead"><h1>todo<b>.</b></h1><div class="meta"><span class="today">${esc(date)}</span><span class="count-line">${count}${done}</span></div></header>`;
}

function section(status: OpenStatus, tasks: Task[], now: number, startIndex: number, prStatuses: Map<number, string>): string {
  const { emoji, label } = STATUS_DISPLAY[status];
  const rows = tasks.map((t, k) => row(t, now, startIndex + k, prStatuses)).join('');
  const cls = QUIET.has(status) ? ' class="quiet"' : '';
  return `<section${cls}><h2><span class="emoji">${emoji}</span><span class="label">${esc(label)}</span><span class="count">${tasks.length}</span></h2><div class="group">${rows}</div></section>`;
}

function row(task: Task, now: number, index: number, prStatuses: Map<number, string>): string {
  const t = withOwnTagStripped(task);
  const noteText = t.note ? stripTrailingPeriod(t.note) : '';
  const note = noteText ? `<span class="note">${esc(noteText)}</span>` : '';
  return `<div class="row" style="--i:${index}">
    <span class="dot ${effectiveUrgency(t, now)}"></span>
    <span class="title">
      <form class="rename" method="post" action="/rename"><input type="hidden" name="id" value="${t.id}"><input class="rename-input" name="title" value="${esc(t.title)}" autocomplete="off" aria-label="Rename task"></form>${note}
    </span>
    <span class="actions">
      ${prBadge(t.title, prStatuses)}
      <form method="post" action="/done"><input type="hidden" name="id" value="${t.id}"><button class="done" aria-label="Mark done" title="Mark done">✓</button></form>
      ${moveSelect(t)}
    </span>
  </div>`;
}

function moveSelect(t: Task): string {
  const opts = SECTION_ORDER.map((s) => `<option value="${s}"${s === t.status ? ' selected' : ''}>${statusLabel(s)}</option>`).join('');
  return `<form class="move" method="post" action="/status"><input type="hidden" name="id" value="${t.id}"><select name="status" onchange="this.form.submit()" aria-label="Move task">${opts}</select></form>`;
}

// Tasks lead with the PR number (`PR 637 Review`); only that anchored form earns a GitHub lookup.
export function prNumber(title: string): number | null {
  const match = title.match(/^PR\s+(\d+)\b/i);
  return match ? Number(match[1]) : null;
}

function prBadge(title: string, prStatuses: Map<number, string>): string {
  const num = prNumber(title);
  const state = num !== null ? prStatuses.get(num) : undefined;
  if (num === null || !state) return '';
  const href = `https://github.com/${process.env.TODO_GH_REPO}/pull/${num}`;
  return `<a class="pr-status ${state}" href="${href}" target="_blank" rel="noopener">${state}</a>`;
}

// Live GitHub state, behind TODO_GH_REPO (kept out of git). Cached briefly so reloads stay snappy;
// any failure (no repo, not authed, unknown PR, timeout) just drops the badge.
interface CachedState {
  state: string;
  at: number;
}
const PR_CACHE = new Map<number, CachedState>();
const PR_TTL_SEC = 60;
const GH_TIMEOUT_MS = 3000;

async function fetchPrStatuses(numbers: number[]): Promise<Map<number, string>> {
  const repo = process.env.TODO_GH_REPO;
  const result = new Map<number, string>();
  if (!repo) return result;
  const now = nowSec();
  const stale = [...new Set(numbers)].filter((n) => (now - (PR_CACHE.get(n)?.at ?? 0)) > PR_TTL_SEC);
  await Promise.all(
    stale.map(async (n) => {
      const state = await ghPrState(repo, n);
      if (state) PR_CACHE.set(n, { state, at: nowSec() });
    }),
  );
  for (const n of numbers) {
    const cached = PR_CACHE.get(n);
    if (cached) result.set(n, cached.state);
  }
  return result;
}

async function ghPrState(repo: string, num: number): Promise<string | null> {
  try {
    const proc = Bun.spawn(['gh', 'pr', 'view', String(num), '--repo', repo, '--json', 'state,isDraft'], { stdout: 'pipe', stderr: 'ignore' });
    const timeout = setTimeout(() => proc.kill(), GH_TIMEOUT_MS);
    const [out, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
    clearTimeout(timeout);
    if (code !== 0) return null;
    const { state, isDraft } = JSON.parse(out) as { state?: string; isDraft?: boolean };
    if (!state) return null;
    return isDraft && state === 'OPEN' ? 'draft' : state.toLowerCase();
  } catch {
    return null;
  }
}

const ADD_FORM = `<form class="add" method="post" action="/edit" onsubmit="var b=this.querySelector('button');b.textContent='…';b.disabled=true">
  <input name="text" autofocus autocomplete="off" placeholder="Tell me what to do — add, complete, move, reword… e.g. mark PR 600 done">
  <button>Go</button>
</form>`;

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
}

function html(body: string): Response {
  return new Response(SHELL.replace('{{body}}', body), { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

// ponytail: one inline page — SF Pro via the system stack (native on macOS), no fonts to fetch, no build step.
const SHELL = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>todo</title>
<style>
  :root {
    color-scheme: light;
    --bg: #ffffff; --sep: #ececef;
    --ink: #18181b; --ink-dim: #71717a; --ink-faint: #a1a1aa;
    --text: -apple-system, "SF Pro Text", system-ui, "Segoe UI", Roboto, sans-serif;
    --accent: #2563eb;
    --red: #ef4444; --yellow: #f59e0b; --blue: #2563eb; --green: #16a34a; --purple: #7c3aed;
  }
  * { box-sizing: border-box; }
  body {
    font: 400 16px/1.5 var(--text); color: var(--ink); background: var(--bg);
    max-width: 560px; margin: 0 auto; padding: 4rem 1.5rem 6rem;
    -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
  }
  form { margin: 0; }

  .masthead { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; margin-bottom: 3rem; }
  .masthead h1 { font: 600 1.5rem/1 var(--text); letter-spacing: -.02em; margin: 0; }
  .masthead h1 b { color: var(--accent); }
  .meta { display: flex; flex-direction: column; align-items: flex-end; gap: .15rem; }
  .today { font-size: .8rem; color: var(--ink-dim); white-space: nowrap; }
  .count-line { font-size: .8rem; color: var(--ink-faint); white-space: nowrap; }
  .streak { color: var(--green); margin-left: .5rem; }

  form.add { display: flex; gap: .5rem; margin-bottom: 3rem; }
  form.add input {
    flex: 1; font: 400 1rem var(--text); color: var(--ink); background: var(--bg);
    border: 1px solid var(--sep); border-radius: 8px; padding: .7rem .85rem;
  }
  form.add input::placeholder { color: var(--ink-faint); }
  form.add input:focus { outline: none; border-color: var(--accent); }
  form.add button {
    font: 500 1rem var(--text); color: var(--accent); background: none;
    border: 1px solid var(--sep); border-radius: 8px; padding: 0 1.1rem; cursor: pointer;
  }
  form.add button:hover { border-color: var(--accent); }
  form.add button:disabled { color: var(--ink-faint); border-color: var(--sep); cursor: default; }

  section { margin-bottom: 2.5rem; }
  h2 { display: flex; align-items: center; gap: .45rem; margin: 0 0 .4rem; font: 500 .72rem var(--text); text-transform: uppercase; letter-spacing: .06em; color: var(--ink-faint); }
  h2 .emoji { font-size: .8rem; }
  h2 .count { color: var(--ink-faint); }

  /* flat list — rows divided by hairlines, no card, no shadow */
  .row { display: flex; align-items: center; gap: .8rem; padding: .7rem 0; border-bottom: 1px solid var(--sep); }
  .row:last-child { border-bottom: 0; }

  .dot { width: 6px; height: 6px; border-radius: 50%; flex: none; }
  .dot.red { background: var(--red); }
  .dot.yellow { background: var(--yellow); }
  .dot.blue { background: var(--blue); }

  .title { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .1rem; }
  .rename { width: 100%; }
  /* borderless input that reads as the title text until you focus it */
  .rename-input {
    width: 100%; font: inherit; color: inherit; background: transparent;
    border: 0; border-radius: 4px; padding: .1rem .25rem; margin: -.1rem -.25rem;
    text-overflow: ellipsis;
  }
  .rename-input:focus { outline: none; box-shadow: 0 0 0 2px var(--accent); }
  .note { font-size: .8rem; color: var(--ink-faint); padding-left: .25rem; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .pr-status {
    font: 500 .65rem var(--text); text-transform: uppercase; letter-spacing: .04em;
    border: 1px solid var(--badgec); color: var(--badgec); border-radius: 4px;
    padding: .1rem .35rem; line-height: 1.3; text-decoration: none; white-space: nowrap;
  }
  .pr-status.merged { --badgec: var(--purple); }
  .pr-status.open { --badgec: var(--green); }
  .pr-status.closed { --badgec: var(--red); }
  .pr-status.draft { --badgec: var(--ink-faint); }

  .actions { display: flex; align-items: center; gap: .7rem; flex: none; }
  /* keep resting rows clean — reveal the move-to-column control on hover/focus */
  .move { opacity: 0; transition: opacity .15s ease; }
  .row:hover .move, .move:focus-within { opacity: 1; }
  @media (hover: none) { .move { opacity: 1; } }
  button.done { font: 400 1.1rem var(--text); color: var(--ink-faint); background: none; border: 0; padding: 0; line-height: 1; cursor: pointer; }
  button.done:hover { color: var(--green); }
  select { font: .8rem var(--text); color: var(--ink-faint); background: none; border: 0; cursor: pointer; -webkit-appearance: none; appearance: none; }
  select:hover { color: var(--ink); }

  /* waiting / someday: dimmed so they recede; full opacity on hover when you do want them */
  section.quiet { opacity: .55; transition: opacity .15s ease; }
  section.quiet:hover { opacity: 1; }
  section.quiet .row { padding: .45rem 0; }

  .empty { color: var(--ink-faint); text-align: center; margin: 5rem 0; }
</style></head><body>{{body}}</body></html>`;
