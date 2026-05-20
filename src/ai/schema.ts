import { STATUSES, URGENCIES } from '../task';

export function describeSchema(): string {
  return [
    'Schema:',
    '```',
    'tasks(',
    '  id INTEGER PRIMARY KEY,',
    '  title TEXT NOT NULL,',
    '  note TEXT,',
    `  status TEXT NOT NULL CHECK (status IN (${quoteList(STATUSES)})),`,
    `  urgency TEXT NOT NULL CHECK (urgency IN (${quoteList(URGENCIES)})),`,
    '  created_at INTEGER NOT NULL,  -- Unix seconds',
    '  updated_at INTEGER NOT NULL,  -- Unix seconds',
    '  done_at INTEGER,              -- Unix seconds, or NULL',
    '  due_at INTEGER                -- Unix seconds at noon UTC of the deadline date, or NULL',
    ')',
    '```',
    '',
    `- \`status\` ∈ {${STATUSES.join(', ')}}`,
    `- \`urgency\` ∈ {${URGENCIES.join(', ')}}`,
    '- All timestamps are unix seconds.',
    '- Tasks with `status=waiting` must have `urgency=yellow`.',
  ].join('\n');
}

function quoteList(values: readonly string[]): string {
  return values.map((v) => `'${v}'`).join(',');
}
