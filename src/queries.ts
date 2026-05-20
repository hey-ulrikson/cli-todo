import type { Database } from 'bun:sqlite';
import type { Task } from './task';

export function loadOpenTasks(db: Database): Task[] {
  return db
    .query<Task, []>(
      `SELECT id, title, note, status, urgency, created_at, updated_at, done_at, due_at
         FROM tasks
        WHERE status != 'done'`,
    )
    .all();
}

export function countDoneSince(db: Database, sinceSec: number): number {
  return (
    db
      .query<{ n: number }, [number]>(
        `SELECT COUNT(*) AS n FROM tasks WHERE status = 'done' AND done_at >= ?`,
      )
      .get(sinceSec)?.n ?? 0
  );
}

export function loadTaskById(db: Database, id: number): Task | null {
  return db
    .query<Task, [number]>(
      `SELECT id, title, note, status, urgency, created_at, updated_at, done_at, due_at
         FROM tasks
        WHERE id = ?`,
    )
    .get(id);
}
