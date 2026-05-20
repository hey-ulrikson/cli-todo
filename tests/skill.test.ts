import { describe, expect, test } from 'bun:test';
import dbSkill from '../.claude/skills/db/SKILL.md' with { type: 'text' };
import { STATUSES, URGENCIES } from '../src/task';

describe('SKILL.md is policy-only (schema lives in describeSchema)', () => {
  test('does not enumerate every status literal', () => {
    const enumeratesAll = STATUSES.every((s) => dbSkill.includes(`'${s}'`));
    expect(enumeratesAll).toBe(false);
  });

  test('does not enumerate every urgency literal', () => {
    const enumeratesAll = URGENCIES.every((u) => dbSkill.includes(`'${u}'`));
    expect(enumeratesAll).toBe(false);
  });

  test('does not declare the tasks(...) column list', () => {
    expect(dbSkill).not.toMatch(/tasks\s*\(\s*id\s*,/);
  });
});
