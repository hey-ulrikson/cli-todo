import { describe, expect, test } from 'bun:test';
import { prNumber } from '../src/commands/serve';

describe('prNumber', () => {
  test('pulls the leading PR number from a title', () => {
    expect(prNumber('PR 637 Review')).toBe(637);
  });

  test('ignores trailing note text', () => {
    expect(prNumber('PR 508 Review — Ibrahim')).toBe(508);
  });

  test('returns null when there is no PR ref', () => {
    expect(prNumber('Buy milk')).toBeNull();
  });

  test('only matches a PR ref anchored at the start', () => {
    expect(prNumber('Reply to PR 12')).toBeNull();
  });
});
