import { describe, expect, test } from 'bun:test';
import { runWriter } from '../src/commands/write';

describe('runWriter', () => {
  test('is the single entry point for all write subcommands', () => {
    expect(typeof runWriter).toBe('function');
    expect(runWriter.length).toBe(2);
  });
});
