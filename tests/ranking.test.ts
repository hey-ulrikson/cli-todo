import { describe, expect, test } from 'bun:test';
import { effectiveUrgency, rank } from '../src/ranking';
import type { Task } from '../src/task';

const TODAY = 1_700_000_000;
const DAY = 86_400;

const task = (over: Partial<Task> & { id: number }): Task => ({
  id: over.id,
  title: over.title ?? `task ${over.id}`,
  note: over.note ?? null,
  status: over.status ?? 'general',
  urgency: over.urgency ?? 'blue',
  created_at: over.created_at ?? 0,
  updated_at: over.updated_at ?? 0,
  done_at: over.done_at ?? null,
  due_at: over.due_at ?? null,
});

describe('rank', () => {
  test('orders by urgency: red before yellow before blue', () => {
    const tasks = [
      task({ id: 1, urgency: 'blue' }),
      task({ id: 2, urgency: 'red' }),
      task({ id: 3, urgency: 'yellow' }),
    ];
    expect(rank(tasks, TODAY).map((t) => t.id)).toEqual([2, 3, 1]);
  });

  test('within the same urgency, newer tasks come first', () => {
    const tasks = [
      task({ id: 1, urgency: 'blue', created_at: 100 }),
      task({ id: 2, urgency: 'blue', created_at: 300 }),
      task({ id: 3, urgency: 'blue', created_at: 200 }),
    ];
    expect(rank(tasks, TODAY).map((t) => t.id)).toEqual([2, 3, 1]);
  });

  test('an overdue yellow task ranks above a yellow with no due date', () => {
    const tasks = [
      task({ id: 1, urgency: 'yellow', created_at: 100 }),
      task({ id: 2, urgency: 'yellow', created_at: 50, due_at: TODAY - DAY }),
    ];
    expect(rank(tasks, TODAY).map((t) => t.id)).toEqual([2, 1]);
  });

  test('does not mutate its input', () => {
    const tasks = [task({ id: 1, urgency: 'blue' }), task({ id: 2, urgency: 'red' })];
    const original = [...tasks];
    rank(tasks, TODAY);
    expect(tasks).toEqual(original);
  });
});

describe('effectiveUrgency', () => {
  test('uses stored urgency when no due date is set', () => {
    expect(effectiveUrgency(task({ id: 1, urgency: 'red' }), TODAY)).toBe('red');
    expect(effectiveUrgency(task({ id: 2, urgency: 'blue' }), TODAY)).toBe('blue');
  });

  test('stored blue is sticky — never auto-promoted by date (blue is an explicit user choice)', () => {
    expect(effectiveUrgency(task({ id: 1, urgency: 'blue', due_at: TODAY - DAY }), TODAY)).toBe(
      'blue',
    );
    expect(effectiveUrgency(task({ id: 2, urgency: 'blue', due_at: TODAY }), TODAY)).toBe('blue');
    expect(effectiveUrgency(task({ id: 3, urgency: 'blue', due_at: TODAY + 5 * DAY }), TODAY)).toBe(
      'blue',
    );
  });

  test('overdue stored-yellow → red', () => {
    expect(effectiveUrgency(task({ id: 1, urgency: 'yellow', due_at: TODAY - DAY }), TODAY)).toBe(
      'red',
    );
  });

  test('a far-future due date never demotes a stored red urgency', () => {
    expect(effectiveUrgency(task({ id: 1, urgency: 'red', due_at: TODAY + 30 * DAY }), TODAY)).toBe(
      'red',
    );
  });

  test('takes the more urgent of stored vs date-derived', () => {
    expect(effectiveUrgency(task({ id: 1, urgency: 'yellow', due_at: TODAY + 5 * DAY }), TODAY)).toBe(
      'yellow',
    );
  });
});
