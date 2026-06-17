import { Database } from 'bun:sqlite';
import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

describe('openDb status-CHECK migration', () => {
  let dir: string;
  afterEach(() => dir && rmSync(dir, { recursive: true, force: true }));

  test('rebuilds a stale CHECK, preserves all data, and accepts the new status', () => {
    dir = mkdtempSync(join(tmpdir(), 'todo-mig-'));
    const path = join(dir, 'tasks.db');

    // a DB created before `review` existed — its CHECK rejects 'review'
    const old = new Database(path);
    old.exec(
      `CREATE TABLE tasks (id INTEGER PRIMARY KEY, title TEXT NOT NULL, note TEXT,
         status TEXT NOT NULL CHECK (status IN ('someday','general','coding','waiting','done')),
         urgency TEXT NOT NULL CHECK (urgency IN ('red','yellow','blue')),
         created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, done_at INTEGER, due_at INTEGER);
       CREATE INDEX tasks_open ON tasks (status, urgency, created_at) WHERE status != 'done';`,
    );
    old.run(
      "INSERT INTO tasks (id,title,note,status,urgency,created_at,updated_at,done_at,due_at) VALUES (1,'PR 9 Review','Alice','coding','yellow',111,222,null,333)",
    );
    old.close();

    const db = openDb(path);
    expect(db.query('SELECT * FROM tasks').all()).toEqual([
      { id: 1, title: 'PR 9 Review', note: 'Alice', status: 'coding', urgency: 'yellow', created_at: 111, updated_at: 222, done_at: null, due_at: 333 },
    ]);
    expect(() =>
      db.run("INSERT INTO tasks (title, status, urgency, created_at, updated_at) VALUES ('r', 'review', 'red', 1, 1)"),
    ).not.toThrow();
    expect(db.query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE name='tasks_open'").all()).toHaveLength(1);
  });
});
