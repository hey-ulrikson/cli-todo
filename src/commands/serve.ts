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
  return `<header class="masthead"><h1>todo<b>.</b></h1><div class="meta"><span class="today">${esc(date)} <span class="sep">·</span> ${count}</span>${done}</div></header>`;
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
      <form class="rename" method="post" action="/rename"><input type="hidden" name="id" value="${t.id}"><input class="rename-input" name="title" value="${esc(t.title)}" autocomplete="off" aria-label="Rename task"></form>${note}${prBadge(t.title, prStatuses)}
    </span>
    <span class="actions">
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
    --bg: #f5f5f7; --card: #ffffff; --sep: rgba(60,60,67,.10);
    --ink: #1d1d1f; --ink-dim: #6e6e73; --ink-faint: #aeaeb2;
    --rounded: ui-rounded, "SF Pro Rounded", -apple-system, system-ui, sans-serif;
    --text: -apple-system, "SF Pro Text", system-ui, "Segoe UI", Roboto, sans-serif;
    --red: #ff3b30; --yellow: #ff9f0a; --blue: #007aff; --green: #34c759; --purple: #8250df;
  }
  * { box-sizing: border-box; }
  body {
    font: 400 16px/1.45 var(--text); color: var(--ink); background: var(--bg);
    max-width: 600px; margin: 0 auto; padding: 3.5rem 1.25rem 6rem;
    -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
  }

  .masthead { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 2.75rem; }
  .masthead h1 { font: 700 2.5rem/1 var(--rounded); letter-spacing: -.022em; margin: 0; }
  .masthead h1 b { color: var(--blue); font-weight: 700; }
  .meta { display: flex; flex-direction: column; align-items: flex-end; gap: .45rem; }
  .today, .streak { font: 590 .8rem/1 var(--text); margin: 0; letter-spacing: -.01em; border-radius: 980px; padding: .45rem .8rem; white-space: nowrap; }
  .today { color: var(--ink-dim); background: var(--card); box-shadow: 0 1px 3px rgba(0,0,0,.06); }
  .today .sep { color: var(--ink-faint); margin: 0 .35rem; }
  .streak { color: var(--green); background: color-mix(in srgb, var(--green) 12%, transparent); }

  form.add { display: flex; gap: .65rem; margin-bottom: 2.9rem; }
  form.add input {
    flex: 1; font: 400 1rem var(--text); color: var(--ink); background: var(--card);
    border: .5px solid var(--sep); border-radius: 12px; padding: .78rem .95rem;
    box-shadow: 0 1px 2px rgba(0,0,0,.04); transition: box-shadow .2s ease;
  }
  form.add input::placeholder { color: var(--ink-faint); }
  form.add input:focus { outline: none; box-shadow: 0 0 0 4px rgba(0,122,255,.18); }
  form.add button {
    font: 590 1rem var(--text); color: #fff; background: var(--blue); border: 0; border-radius: 12px;
    padding: 0 1.25rem; cursor: pointer; letter-spacing: -.01em;
    transition: transform .2s cubic-bezier(.2,.8,.2,1), filter .2s ease;
  }
  form.add button:hover { filter: brightness(1.06); }
  form.add button:active { transform: scale(.97); }
  form.add button:disabled { background: var(--ink-faint); cursor: default; transform: none; filter: none; }

  section { margin-bottom: 2.4rem; }
  h2 { display: flex; align-items: center; gap: .5rem; margin: 0 0 .8rem .25rem; font: 600 .92rem var(--text); }
  h2 .emoji { font-size: .92rem; }
  h2 .label { color: var(--ink); letter-spacing: -.014em; }
  h2 .count { font: 500 .82rem var(--text); color: var(--ink-faint); letter-spacing: -.01em; }

  /* iOS-style grouped list: one rounded card per section, hairline-separated rows */
  .group { background: var(--card); border-radius: 18px; box-shadow: 0 1px 3px rgba(0,0,0,.04), 0 12px 30px -16px rgba(0,0,0,.12); overflow: hidden; }
  .row {
    display: flex; align-items: center; gap: .85rem; padding: 1.05rem 1.15rem; position: relative;
    animation: rise .5s cubic-bezier(.2,.8,.2,1) both; animation-delay: calc(var(--i) * 40ms);
    transition: background .18s ease;
  }
  .row:not(:last-child)::after { content: ""; position: absolute; left: 2.85rem; right: 0; bottom: 0; height: .5px; background: var(--sep); }
  .row:hover { background: rgba(0,0,0,.022); }
  @keyframes rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) { .row { animation: none; } }

  .dot { width: .58rem; height: .58rem; border-radius: 50%; flex: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--dotc) 16%, transparent); }
  .dot.red { --dotc: var(--red); background: var(--red); }
  .dot.yellow { --dotc: var(--yellow); background: var(--yellow); }
  .dot.blue { --dotc: var(--blue); background: var(--blue); }

  .title { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .35rem; letter-spacing: -.011em; }
  .rename { width: 100%; }
  /* borderless input that reads as the title text until you focus it */
  .rename-input {
    width: 100%; font: inherit; color: inherit; letter-spacing: inherit; background: transparent;
    border: 0; border-radius: 6px; padding: .12rem .3rem; margin: -.12rem -.3rem;
    text-overflow: ellipsis; transition: background .15s ease, box-shadow .15s ease;
  }
  .rename-input:hover { background: rgba(0,0,0,.03); }
  .rename-input:focus { outline: none; background: var(--bg); box-shadow: 0 0 0 3px rgba(0,122,255,.18); }
  .note {
    align-self: flex-start; font: 510 .72rem var(--text); color: var(--ink-dim);
    background: rgba(0,0,0,.05); border-radius: 980px; padding: .3rem .85rem; line-height: 1.3; letter-spacing: 0;
  }
  .pr-status {
    align-self: flex-start; font: 590 .66rem var(--text); text-transform: uppercase; letter-spacing: .04em;
    border-radius: 980px; padding: .22rem .6rem; line-height: 1; text-decoration: none; cursor: pointer;
    color: var(--badgec); background: color-mix(in srgb, var(--badgec) 14%, transparent);
    transition: background .15s ease;
  }
  .pr-status:hover { background: color-mix(in srgb, var(--badgec) 26%, transparent); }
  .pr-status.merged { --badgec: var(--purple); }
  .pr-status.open { --badgec: var(--green); }
  .pr-status.closed { --badgec: var(--red); }
  .pr-status.draft { --badgec: var(--ink-faint); }

  .actions { display: flex; align-items: center; gap: 1.1rem; flex: none; padding-left: .5rem; }
  /* keep resting rows clean — reveal the move-to-column control on hover/focus */
  .move { opacity: 0; transition: opacity .18s ease; }
  .row:hover .move, .move:focus-within { opacity: 1; }
  @media (hover: none) { .move { opacity: 1; } }
  button.done {
    display: grid; place-items: center; width: 1.85rem; height: 1.85rem; line-height: 1;
    font: 700 .98rem var(--text); color: var(--green); background: color-mix(in srgb, var(--green) 13%, transparent);
    border: 0; border-radius: 50%; cursor: pointer;
    transition: transform .2s cubic-bezier(.2,.8,.2,1), background .18s ease, color .18s ease;
  }
  button.done:hover { background: var(--green); color: #fff; transform: scale(1.08); }
  button.done:active { transform: scale(.9); }
  select {
    font: 510 .8rem var(--text); color: var(--ink-dim); background: transparent;
    border: 0; border-radius: 8px; padding: .26rem .15rem; cursor: pointer; -webkit-appearance: none; appearance: none;
    transition: color .15s ease;
  }
  select:hover { color: var(--ink); }
  form { margin: 0; }

  /* waiting / someday: dimmed and tightened so they recede; full opacity on hover when you do want them */
  section.quiet { opacity: .5; margin-bottom: 1.5rem; transition: opacity .2s ease; }
  section.quiet:hover { opacity: 1; }
  section.quiet h2 { font-size: .82rem; margin-bottom: .5rem; }
  section.quiet .group { box-shadow: 0 1px 2px rgba(0,0,0,.03); }
  section.quiet .row { padding: .58rem 1.15rem; font-size: .9rem; }
  section.quiet .dot { transform: scale(.85); }

  .empty { color: var(--ink-dim); font: 600 1.6rem/1.3 var(--rounded); letter-spacing: -.02em; text-align: center; margin: 6rem 0; }
</style></head><body>{{body}}</body></html>`;
