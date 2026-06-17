import { effectiveUrgency, rank } from '../ranking';
import type { Status, Task } from '../task';
import { bold, color, countBadge, dim, marker, PLAIN, type RenderOpts, title, truncate } from './format';
import { metaSuffix, withOwnTagStripped } from './meta';

export function renderList(tasks: readonly Task[], nowSec: number, opts: RenderOpts = PLAIN): string {
  const open = tasks.filter((t) => t.status !== 'done').map(withOwnTagStripped);
  const sections: string[] = [];
  for (const status of SECTION_ORDER) {
    const inSection = open.filter((t) => t.status === status);
    if (inSection.length === 0) continue;
    sections.push(renderSection(status, inSection, nowSec, opts));
  }
  return sections.join('\n\n');
}

export function renderOneLine(task: Task, nowSec: number, opts: RenderOpts = PLAIN): string {
  return truncate(renderRow(task, nowSec, opts), opts.width);
}

function renderSection(
  status: Exclude<Status, 'done'>,
  tasks: readonly Task[],
  nowSec: number,
  opts: RenderOpts,
): string {
  const lines = rank(tasks, nowSec).map((t) => `  ${renderRow(t, nowSec, opts)}`).map((l) => truncate(l, opts.width));
  return [sectionHeader(status, tasks.length, opts), ...lines].join('\n');
}

function renderRow(task: Task, nowSec: number, opts: RenderOpts): string {
  const isDone = task.status === 'done';
  const u = effectiveUrgency(task, nowSec);
  const head = isDone
    ? `${color('✓', 'green', opts)} ${dim(task.title, opts)}`
    : `${marker(u, opts)} ${title(task.title, u, opts)}`;
  const meta = isDone ? '' : metaSuffix(task, nowSec, opts, { trimNoteToFirstSentence: false });
  return head + meta;
}

function sectionHeader(status: Exclude<Status, 'done'>, count: number, opts: RenderOpts): string {
  const { emoji, label } = STATUS_DISPLAY[status];
  const badge = countBadge(count);
  if (!opts.color) return `${emoji} ${label} ${badge}`;
  const styledHeader = `${bold(label, opts)} ${dim(badge, opts)}`;
  if (opts.width === Infinity) return styledHeader;
  // bold/dim wrap the text in ANSI codes, so measure the plain string instead.
  const headerWidth = `${label} ${badge}`.length;
  return `${styledHeader} ${rule(opts.width - headerWidth - 1, opts)}`;
}

function rule(width: number, opts: RenderOpts): string {
  return dim('─'.repeat(Math.max(3, width)), opts);
}

export const SECTION_ORDER = ['general', 'coding', 'review', 'waiting', 'someday'] as const satisfies readonly Exclude<Status, 'done'>[];

export const STATUS_DISPLAY: Record<Exclude<Status, 'done'>, { emoji: string; label: string }> = {
  general: { emoji: '📅', label: 'General' },
  coding: { emoji: '💻', label: 'Coding' },
  review: { emoji: '🔍', label: 'Reviews' },
  waiting: { emoji: '🤝', label: 'Waiting On' },
  someday: { emoji: '💭', label: 'Someday / Maybe' },
};
