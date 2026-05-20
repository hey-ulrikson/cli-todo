import { describe, expect, test } from 'bun:test';
import { allOk, formatChecks, runChecks } from '../src/doctor';

describe('runChecks', () => {
  test('flags missing claude binary', () => {
    const results = runChecks({
      claudeBinary: null,
      dbPath: '/tmp/nope.db',
      memoryDir: '/tmp/nope',
    });
    expect(results[0]?.ok).toBe(false);
    expect(allOk(results)).toBe(false);
  });

  test('passes when env is sane', () => {
    const results = runChecks({
      claudeBinary: '/usr/local/bin/claude',
      dbPath: import.meta.dir,
      memoryDir: import.meta.dir,
    });
    expect(results.every((r) => r.ok)).toBe(true);
  });
});

describe('formatChecks', () => {
  test('renders ✓/✗ per line', () => {
    const out = formatChecks([
      { label: 'A', ok: true },
      { label: 'B', ok: false, detail: 'fix it' },
    ]);
    expect(out).toBe('✓ A\n✗ B — fix it');
  });
});
