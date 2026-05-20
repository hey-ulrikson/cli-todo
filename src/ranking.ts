import type { Task, Urgency } from './task';

const URGENCY_RANK: Record<Urgency, number> = { red: 0, yellow: 1, blue: 2 };
const DAY = 86_400;

export function rank(tasks: readonly Task[], nowSec: number): Task[] {
  return [...tasks].sort((a, b) => {
    const u = URGENCY_RANK[effectiveUrgency(a, nowSec)] - URGENCY_RANK[effectiveUrgency(b, nowSec)];
    if (u !== 0) return u;
    return b.created_at - a.created_at;
  });
}

export function effectiveUrgency(task: Task, nowSec: number): Urgency {
  if (task.urgency === 'blue') return 'blue';
  return moreUrgent(task.urgency, dateUrgency(task, nowSec));
}

function dateUrgency(task: Task, nowSec: number): Urgency {
  if (task.due_at === null) return 'blue';
  const daysOut = Math.floor((task.due_at - nowSec) / DAY);
  if (daysOut < 0) return 'red';
  if (daysOut <= 2) return 'yellow';
  return 'blue';
}

function moreUrgent(a: Urgency, b: Urgency): Urgency {
  return URGENCY_RANK[a] <= URGENCY_RANK[b] ? a : b;
}

export function isHiddenFromToday(task: Task, nowSec: number): boolean {
  if (task.due_at === null) return false;
  return task.due_at - nowSec > 7 * DAY;
}

export function dueHint(task: Task, nowSec: number): string | null {
  if (task.due_at === null) return null;
  const daysOut = Math.floor((task.due_at - nowSec) / DAY);
  if (daysOut < 0) return `overdue ${-daysOut}d`;
  if (daysOut === 0) return 'due today';
  if (daysOut === 1) return 'due tomorrow';
  return `due in ${daysOut}d`;
}
