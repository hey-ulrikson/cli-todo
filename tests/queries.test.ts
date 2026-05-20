import { describe, expect, test } from 'bun:test';
import { openDb } from '../src/db';
import { loadOpenTasks } from '../src/queries';

describe('loadOpenTasks', () => {
  test('returns only rows whose status is not done', () => {
    const db = openDb(':memory:');
    db.run(
      `INSERT INTO tasks (title, note, status, urgency, created_at, updated_at)
       VALUES (?, NULL, 'general', 'yellow', 1, 1),
              (?, NULL, 'done',    'blue',   1, 1)`,
      ['open', 'closed'],
    );
    const open = loadOpenTasks(db);
    expect(open).toHaveLength(1);
    expect(open[0]?.title).toBe('open');
  });

  test('includes due_at when set', () => {
    const db = openDb(':memory:');
    db.run(
      `INSERT INTO tasks (title, note, status, urgency, created_at, updated_at, due_at)
       VALUES ('t', NULL, 'general', 'yellow', 1, 1, 1700100000)`,
    );
    expect(loadOpenTasks(db)[0]?.due_at).toBe(1700100000);
  });
});
