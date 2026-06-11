import { describe, expect, test } from 'bun:test';
import { WRITERS } from '../src/ai/run';

describe('WRITERS table', () => {
  test('declares one entry per write subcommand', () => {
    expect(Object.keys(WRITERS).sort()).toEqual(['do', 'done', 'edit'].sort());
  });

  test('verb strings are the UX contract', () => {
    expect(WRITERS.do.verb).toBe('Added');
    expect(WRITERS.done.verb).toBe('Done');
    expect(WRITERS.edit.verb).toBe('Done');
  });

  test('models match the cost/reasoning tier each subcommand needs', () => {
    expect(WRITERS.done.model).toBe('haiku');
    expect(WRITERS.do.model).toBe('sonnet');
    expect(WRITERS.edit.model).toBe('opus');
  });

  test('every entry has a non-empty prompt', () => {
    for (const w of Object.values(WRITERS)) {
      expect(w.prompt.length).toBeGreaterThan(0);
    }
  });
});
