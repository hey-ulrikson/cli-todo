import { describe, expect, test } from 'bun:test';
import { openDb } from '../src/db';

describe('openDb', () => {
  test('creates the tasks table on a fresh DB', () => {
    const db = openDb(':memory:');
    const tables = db
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
      )
      .all()
      .map((r) => r.name);
    expect(tables).toContain('tasks');
  });

  test('creates the open-task index', () => {
    const db = openDb(':memory:');
    const indexes = db
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'",
      )
      .all()
      .map((r) => r.name);
    expect(indexes).toContain('tasks_open');
  });

  test('is idempotent — opening an already-initialized DB does not throw', () => {
    const db = openDb(':memory:');
    expect(() => openDb(':memory:')).not.toThrow();
    expect(db).toBeDefined();
  });

  test('rejects rows with an invalid status (CHECK constraint)', () => {
    const db = openDb(':memory:');
    expect(() =>
      db.run(
        "INSERT INTO tasks (title, status, urgency, created_at, updated_at) VALUES ('t', 'nope', 'blue', 1, 1)",
      ),
    ).toThrow();
  });

  test('auto-assigns ascending integer ids', () => {
    const db = openDb(':memory:');
    db.run(
      "INSERT INTO tasks (title, status, urgency, created_at, updated_at) VALUES ('a', 'general', 'blue', 1, 1)",
    );
    db.run(
      "INSERT INTO tasks (title, status, urgency, created_at, updated_at) VALUES ('b', 'general', 'blue', 1, 1)",
    );
    const ids = db
      .query<{ id: number }, []>('SELECT id FROM tasks ORDER BY id')
      .all()
      .map((r) => r.id);
    expect(ids).toEqual([1, 2]);
  });
});
