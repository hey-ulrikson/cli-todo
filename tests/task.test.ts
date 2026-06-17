import { describe, expect, test } from 'bun:test';
import { openDb } from '../src/db';
import { STATUSES, URGENCIES } from '../src/task';

describe('enum constants', () => {
  test('STATUSES lists every kanban column', () => {
    expect(STATUSES).toEqual(['someday', 'general', 'coding', 'review', 'waiting', 'done']);
  });

  test('URGENCIES lists every urgency level', () => {
    expect(URGENCIES).toEqual(['red', 'yellow', 'blue']);
  });

  test('DB CHECK constraint accepts every STATUSES value', () => {
    const db = openDb(':memory:');
    for (const s of STATUSES) {
      expect(() =>
        db.run(
          `INSERT INTO tasks (title, status, urgency, created_at, updated_at) VALUES ('t', '${s}', 'blue', 1, 1)`,
        ),
      ).not.toThrow();
    }
  });

  test('DB CHECK constraint accepts every URGENCIES value', () => {
    const db = openDb(':memory:');
    for (const u of URGENCIES) {
      expect(() =>
        db.run(
          `INSERT INTO tasks (title, status, urgency, created_at, updated_at) VALUES ('t', 'general', '${u}', 1, 1)`,
        ),
      ).not.toThrow();
    }
  });
});
