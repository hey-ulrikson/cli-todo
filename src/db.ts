import { Database } from 'bun:sqlite';
import { STATUSES, URGENCIES } from './task';

export function openDb(path: string): Database {
  const db = new Database(path);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(SCHEMA);
  ensureColumn(db, 'tasks', 'due_at', 'INTEGER');
  return db;
}

function ensureColumn(db: Database, table: string, column: string, type: string): void {
  if (hasColumn(db, table, column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}

function hasColumn(db: Database, table: string, column: string): boolean {
  const cols = db.query(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return cols.some((c) => c.name === column);
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS tasks (
  id          INTEGER PRIMARY KEY,
  title       TEXT NOT NULL,
  note        TEXT,
  status      TEXT NOT NULL CHECK (status IN (${sqlList(STATUSES)})),
  urgency     TEXT NOT NULL CHECK (urgency IN (${sqlList(URGENCIES)})),
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  done_at     INTEGER,
  due_at      INTEGER
);

CREATE INDEX IF NOT EXISTS tasks_open
  ON tasks (status, urgency, created_at)
  WHERE status != 'done';
`;

function sqlList(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(',');
}
