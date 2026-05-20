import type { Database } from 'bun:sqlite';
import type { Task } from '../../src/task';

const HOUR = 3600;

export const SPEC_TASKS: Task[] = [
  {
    id: 1,
    title: 'Prepare for new intern',
    note: 'Friday 2026-05-08, due Mon 2026-05-11',
    status: 'general',
    urgency: 'red',
    created_at: 100 * HOUR,
    updated_at: 100 * HOUR,
    done_at: null,
    due_at: null,
  },
  {
    id: 2,
    title: 'PR101 (Alice)',
    note: 'CI/CD fix',
    status: 'coding',
    urgency: 'yellow',
    created_at: 90 * HOUR,
    updated_at: 90 * HOUR,
    done_at: null,
    due_at: null,
  },
  {
    id: 3,
    title: 'PR102 — feature rollout',
    note: null,
    status: 'coding',
    urgency: 'blue',
    created_at: 80 * HOUR,
    updated_at: 80 * HOUR,
    done_at: null,
    due_at: null,
  },
  {
    id: 4,
    title: 'PR103',
    note: 'Replace proxy with direct OAuth',
    status: 'waiting',
    urgency: 'blue',
    created_at: 70 * HOUR,
    updated_at: 70 * HOUR,
    done_at: null,
    due_at: null,
  },
  {
    id: 5,
    title: 'PR104',
    note: 'Asset categorization',
    status: 'waiting',
    urgency: 'blue',
    created_at: 60 * HOUR,
    updated_at: 60 * HOUR,
    done_at: null,
    due_at: null,
  },
  {
    id: 6,
    title: 'Run `interview` script',
    note: null,
    status: 'someday',
    urgency: 'blue',
    created_at: 50 * HOUR,
    updated_at: 50 * HOUR,
    done_at: null,
    due_at: null,
  },
  {
    id: 7,
    title: 'Invite Bob to Acme',
    note: null,
    status: 'done',
    urgency: 'blue',
    created_at: 40 * HOUR,
    updated_at: 40 * HOUR,
    done_at: 40 * HOUR,
    due_at: null,
  },
];

export function seedDb(db: Database, tasks: readonly Task[]): void {
  const shifted = shiftToNow(tasks);
  const insert = db.prepare(
    'INSERT INTO tasks (id, title, note, status, urgency, created_at, updated_at, done_at, due_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  );
  const tx = db.transaction(() => {
    for (const t of shifted) {
      insert.run(
        t.id,
        t.title,
        t.note,
        t.status,
        t.urgency,
        t.created_at,
        t.updated_at,
        t.done_at,
        t.due_at,
      );
    }
  });
  tx();
}

function shiftToNow(tasks: readonly Task[]): Task[] {
  const maxCreated = Math.max(...tasks.map((t) => t.created_at));
  const offset = Math.floor(Date.now() / 1000) - maxCreated;
  return tasks.map((t) => ({
    ...t,
    created_at: t.created_at + offset,
    updated_at: t.updated_at + offset,
    done_at: t.done_at === null ? null : t.done_at + offset,
  }));
}
