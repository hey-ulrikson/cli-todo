import { describe, expect, test } from 'bun:test';
import { describeSchema } from '../src/ai/schema';
import { STATUSES, URGENCIES } from '../src/task';

describe('describeSchema', () => {
  const out = describeSchema();

  test('lists every status value', () => {
    for (const s of STATUSES) {
      expect(out).toContain(`'${s}'`);
    }
  });

  test('lists every urgency value', () => {
    for (const u of URGENCIES) {
      expect(out).toContain(`'${u}'`);
    }
  });

  test('declares the tasks table with its columns', () => {
    expect(out).toContain('tasks(');
    for (const col of ['id', 'title', 'note', 'status', 'urgency', 'created_at', 'updated_at', 'done_at', 'due_at']) {
      expect(out).toContain(col);
    }
  });

  test('notes that timestamps are unix seconds', () => {
    expect(out.toLowerCase()).toContain('unix seconds');
  });
});
