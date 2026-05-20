import { describe, expect, test } from 'bun:test';
import { WRITERS } from '../src/ai/run';

describe('WRITERS table', () => {
  test('declares one entry per write subcommand', () => {
    expect(Object.keys(WRITERS).sort()).toEqual(
      ['add', 'clean', 'do', 'done', 'move'].sort(),
    );
  });

  test('verb strings are the UX contract', () => {
    expect(WRITERS.add.verb).toBe('Added');
    expect(WRITERS.done.verb).toBe('Done');
    expect(WRITERS.do.verb).toBe('Done');
    expect(WRITERS.move.verb).toBe('Moved');
    expect(WRITERS.clean.verb).toBe('Cleaned');
  });

  test('models match the cost/reasoning tier each subcommand needs', () => {
    expect(WRITERS.done.model).toBe('haiku');
    expect(WRITERS.move.model).toBe('haiku');
    expect(WRITERS.add.model).toBe('sonnet');
    expect(WRITERS.do.model).toBe('opus');
    expect(WRITERS.clean.model).toBe('opus');
  });

  test('every entry has a non-empty prompt', () => {
    for (const w of Object.values(WRITERS)) {
      expect(w.prompt.length).toBeGreaterThan(0);
    }
  });
});
