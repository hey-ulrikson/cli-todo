import { effectiveUrgency, isHiddenFromToday, rank } from '../ranking';
import type { Task } from '../task';
import { countBadge, dim, marker, PLAIN, type RenderOpts, title, truncate } from './format';
import { metaSuffix, withOwnTagStripped } from './meta';

export function renderToday(
  tasks: readonly Task[],
  nowSec: number,
  opts: RenderOpts = PLAIN,
  doneToday = 0,
): string {
  const eligible = rank(tasks.filter((t) => isEligibleForToday(t, nowSec)), nowSec).map(withOwnTagStripped);
  const reviews = eligible.filter(isReviewTask).map(withReviewWordStripped);
  const nonReview = eligible.filter((t) => !isReviewTask(t));
  const coding = nonReview.filter((t) => t.status === 'coding');
  const focus = nonReview.filter((t) => t.status !== 'coding');
  return [
    todaySection('🎯 Focus', focus, nowSec, opts),
    todaySection('💻 Coding', coding, nowSec, opts),
    todaySection('🔍 Reviews', reviews, nowSec, opts),
    doneTodayFooter(doneToday, opts),
  ].filter((s) => s !== '').join('\n\n');
}

function todaySection(header: string, tasks: readonly Task[], nowSec: number, opts: RenderOpts): string {
  if (tasks.length === 0) return '';
  const lines = tasks.map((t) => renderTodayLine(t, nowSec, opts));
  return [dim(`${header} ${countBadge(tasks.length)}`, opts), ...lines].join('\n');
}

function renderTodayLine(task: Task, nowSec: number, opts: RenderOpts): string {
  const u = effectiveUrgency(task, nowSec);
  const head = `${marker(u, opts)} ${title(task.title, u, opts)}`;
  return truncate(head + metaSuffix(task, nowSec, opts, { trimNoteToFirstSentence: true }), opts.width);
}

function doneTodayFooter(count: number, opts: RenderOpts): string {
  return count > 0 ? dim(`✓ ${count} done today`, opts) : '';
}

function isEligibleForToday(task: Task, nowSec: number): boolean {
  if (task.status === 'done' || task.status === 'waiting') return false;
  if (isHiddenFromToday(task, nowSec)) return false;
  if (effectiveUrgency(task, nowSec) === 'blue') return false;
  return true;
}

function isReviewTask(task: Task): boolean {
  return /\breview/i.test(task.title);
}

function withReviewWordStripped(task: Task): Task {
  const isReReview = /\bre-?review\b/i.test(`${task.title} ${task.note ?? ''}`);
  const stripped = task.title
    .replace(/\bre-?review\w*\b/gi, '')
    .replace(/\breview\w*\b/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-—–:,.]+|[\s\-—–:,.]+$/g, '')
    .trim();
  return { ...task, title: isReReview ? `↻ ${stripped}` : stripped };
}
