import { describe, expect, test } from 'bun:test';
import { PLAIN, renderToday } from '../src/render';
import type { Task } from '../src/task';
import { SPEC_TASKS } from './fixtures/seed';

const generalBlue = (id: number, title: string, created_at: number): Task => ({
  id,
  title,
  note: null,
  status: 'general',
  urgency: 'blue',
  created_at,
  updated_at: created_at,
  done_at: null,
  due_at: null,
});

const generalYellow = (id: number, title: string, created_at: number): Task => ({
  ...generalBlue(id, title, created_at),
  urgency: 'yellow',
});

describe('renderToday', () => {
  test('matches the spec today example byte-for-byte', () => {
    const expected = [
      '🎯 Focus · 1',
      '🔴 Prepare for new intern — Friday 2026-05-08, due Mon 2026-05-11',
      '',
      '💻 Coding · 1',
      '🟡 PR101 (Alice) — CI/CD fix',
    ].join('\n');
    expect(renderToday(SPEC_TASKS, 0)).toBe(expected);
  });

  test('splits coding-status tasks into their own session; general work stays in Focus', () => {
    const tasks: Task[] = [
      generalYellow(1, 'write the spec', 2),
      { ...generalYellow(2, 'fix the parser bug', 1), status: 'coding' },
    ];
    const expected = [
      '🎯 Focus · 1',
      '🟡 write the spec',
      '',
      '💻 Coding · 1',
      '🟡 fix the parser bug',
    ].join('\n');
    expect(renderToday(tasks, 0)).toBe(expected);
  });

  test('review-status tasks land in Reviews; a review word in a coding title does not', () => {
    const tasks: Task[] = [
      { ...generalYellow(1, 'PR 99 Review', 1_700_000_000), status: 'review' },
      { ...generalYellow(2, 'Review my own design notes', 1_699_999_999), status: 'coding' },
    ];
    const expected = ['💻 Coding · 1', '🟡 Review my own design notes', '', '🔍 Reviews · 1', '🟡 PR 99 Review'].join('\n');
    expect(renderToday(tasks, 1_700_000_000)).toBe(expected);
  });

  test('strips the "Own" tag from every section — an untagged task is the user\'s by default', () => {
    const tasks: Task[] = [
      { ...generalYellow(1, 'PR 202 Finish', 2), status: 'coding', note: 'helper fn. Own.' },
      { ...generalYellow(2, 'Make TDD a skill', 1), status: 'coding', note: 'Own.' },
      { ...generalYellow(3, 'Reply Eve', 3), status: 'general', note: 'Own.' },
    ];
    const expected = [
      '🎯 Focus · 1',
      '🟡 Reply Eve',
      '',
      '💻 Coding · 2',
      '🟡 PR 202 Finish — helper fn',
      '🟡 Make TDD a skill',
    ].join('\n');
    expect(renderToday(tasks, 0)).toBe(expected);
  });

  test('appends a done-today footer when the count is positive', () => {
    const out = renderToday(SPEC_TASKS, 0, PLAIN, 3);
    expect(out.endsWith('\n\n✓ 3 done today')).toBe(true);
  });

  test('omits the done-today footer when nothing was completed', () => {
    expect(renderToday(SPEC_TASKS, 0, PLAIN, 0)).not.toContain('done today');
  });

  test('excludes waiting and bare-blue tasks', () => {
    const out = renderToday(SPEC_TASKS, 0);
    expect(out).not.toContain('PR103');
    expect(out).not.toContain('PR104');
    expect(out).not.toContain('PR102');
    expect(out).not.toContain('interview');
  });

  test('drops blue tasks regardless of due date — blue is an explicit "not now"', () => {
    const today = 1_700_000_000;
    const day = 86_400;
    const withDue: Task = { ...generalBlue(1, 'doc update', today), due_at: today + 5 * day };
    const noDue = generalBlue(2, 'low priority idea', today);
    expect(renderToday([withDue, noDue], today)).toBe('');
  });

  test('drops waiting tasks regardless of urgency', () => {
    const t: Task = { ...generalBlue(1, 'PR awaiting reply', 1_700_000_000), status: 'waiting', urgency: 'yellow' };
    expect(renderToday([t], 1_700_000_000)).toBe('');
  });

  test('renders a single eligible task', () => {
    const onlyOne = SPEC_TASKS.filter((t) => t.id === 1);
    expect(renderToday(onlyOne, 0)).toBe('🎯 Focus · 1\n🔴 Prepare for new intern — Friday 2026-05-08, due Mon 2026-05-11');
  });

  test('excludes done tasks', () => {
    const out = renderToday(SPEC_TASKS, 0);
    expect(out).not.toContain('Invite Bob to Acme');
  });

  test('first-sentence extraction trims at the first ". "', () => {
    const t: Task = {
      id: 1,
      title: 'multi-sentence',
      note: 'First sentence here. Second sentence ignored.',
      status: 'general',
      urgency: 'red',
      created_at: 1,
      updated_at: 1,
      done_at: null,
      due_at: null,
    };
    expect(renderToday([t], 0)).toBe('🎯 Focus · 1\n🔴 multi-sentence — First sentence here');
  });

  test('returns empty string when no open tasks remain', () => {
    expect(renderToday([], 0)).toBe('');
  });

  test('hides tasks whose due_at is more than 7 days out', () => {
    const today = 1_700_000_000;
    const day = 86_400;
    const tasks: Task[] = [
      { ...generalYellow(1, 'soon', today), due_at: today + 3 * day },
      { ...generalYellow(2, 'far future', today), due_at: today + 30 * day },
    ];
    const out = renderToday(tasks, today);
    expect(out).toContain('soon');
    expect(out).not.toContain('far future');
  });

  test('appends a date hint and uses effective urgency (yellow promotes on date)', () => {
    const today = 1_700_000_000;
    const day = 86_400;
    const tasks: Task[] = [
      { ...generalYellow(1, 'overdue task', today), due_at: today - 2 * day },
      { ...generalYellow(2, 'due soon', today), due_at: today + day },
    ];
    const out = renderToday(tasks, today);
    expect(out).toContain('🔴 overdue task (overdue 2d)');
    expect(out).toContain('🟡 due soon (due tomorrow)');
  });

  test('puts review-status tasks in their own section below Focus and Coding, titles untouched', () => {
    const tasks: Task[] = [
      ...SPEC_TASKS,
      { ...generalYellow(100, 'PR 99 Review', 95 * 3600), status: 'review' },
    ];
    const expected = [
      '🎯 Focus · 1',
      '🔴 Prepare for new intern — Friday 2026-05-08, due Mon 2026-05-11',
      '',
      '💻 Coding · 1',
      '🟡 PR101 (Alice) — CI/CD fix',
      '',
      '🔍 Reviews · 1',
      '🟡 PR 99 Review',
    ].join('\n');
    expect(renderToday(tasks, 0)).toBe(expected);
  });

  test('reviews-only output starts with the header and a single item', () => {
    const tasks: Task[] = [{ ...generalYellow(1, 'PR 7 Review', 1_700_000_000), status: 'review' }];
    expect(renderToday(tasks, 1_700_000_000)).toBe('🔍 Reviews · 1\n🟡 PR 7 Review');
  });

  test('the review word in a non-review-status title is no longer special — it stays in Focus', () => {
    const tasks: Task[] = [{ ...generalYellow(1, 'Review my reading list', 1_700_000_000), status: 'general' }];
    expect(renderToday(tasks, 1_700_000_000)).toBe('🎯 Focus · 1\n🟡 Review my reading list');
  });

  test('strips the trailing period from a rendered note', () => {
    const tasks: Task[] = [{ ...generalYellow(1, 'PR 205 Review', 1_700_000_000), status: 'review', note: 'Dave, re-review.' }];
    expect(renderToday(tasks, 1_700_000_000)).toBe('🔍 Reviews · 1\n🟡 PR 205 Review — Dave, re-review');
  });
});
