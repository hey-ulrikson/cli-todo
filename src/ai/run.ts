import { openDb } from '../db';
import { loadOpenTasks } from '../queries';
import { startSpinner } from '../spinner';
import { resolveDbPath, todayDate } from '../util';
import type { Task } from '../task';
import { MEMORY } from './memory';
import { describeSchema } from './schema';
import donePrompt from '../prompts/done.md' with { type: 'text' };
import doPrompt from '../prompts/do.md' with { type: 'text' };
import editPrompt from '../prompts/edit.md' with { type: 'text' };
import dbSkill from '../../.claude/skills/db/SKILL.md' with { type: 'text' };

export type Subcommand = 'done' | 'do' | 'edit';

export interface ClaudeResult {
  code: number;
}

export async function runClaude(sub: Subcommand, userText: string): Promise<ClaudeResult> {
  const spinner = startSpinner(`claude ${sub}`);
  try {
    const proc = spawnClaude(WRITERS[sub].model);
    proc.stdin.write(buildPrompt(sub, userText));
    await proc.stdin.end();
    const [, code] = await Promise.all([streamStatus(proc.stdout, spinner.update), proc.exited]);
    return { code: code ?? 1 };
  } finally {
    spinner.stop();
  }
}

export interface Writer {
  model: string;
  prompt: string;
}

export const WRITERS: Record<Subcommand, Writer> = {
  do: { model: 'sonnet', prompt: doPrompt },
  done: { model: 'haiku', prompt: donePrompt },
  edit: { model: 'opus', prompt: editPrompt },
};

function spawnClaude(model: string): Bun.Subprocess<'pipe', 'pipe', 'inherit'> {
  try {
    return Bun.spawn(
      ['claude', '-p', '--model', model, '--allowed-tools', 'Bash', '--output-format', 'stream-json', '--verbose'],
      {
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'inherit',
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/ENOENT|not found/i.test(msg)) {
      throw new Error("Can't find the `claude` binary on PATH — install Claude Code first.");
    }
    throw err;
  }
}

function buildPrompt(sub: Subcommand, userText: string): string {
  const dbPath = resolveDbPath();
  const open = loadOpenTasks(openDb(dbPath));
  return [
    '## DB schema',
    describeSchema(),
    '',
    '## DB access conventions (shared)',
    stripFrontmatter(dbSkill),
    '',
    '## Task',
    WRITERS[sub].prompt,
    '',
    `Today's date: ${todayDate()}`,
    `DB path: ${dbPath}`,
    '',
    'Open tasks (id<TAB>status<TAB>urgency<TAB>due=<YYYY-MM-DD or ->\ttitle — note):',
    renderTasksTsv(open),
    '',
    'Reference (people, projects, glossary, conventions):',
    '---',
    MEMORY,
    '---',
    '',
    'User input:',
    userText.trim() || '(none)',
  ].join('\n');
}

function stripFrontmatter(md: string): string {
  return md.startsWith('---') ? md.replace(/^---[\s\S]*?\n---\n?/, '') : md;
}

function renderTasksTsv(tasks: readonly Task[]): string {
  if (tasks.length === 0) return '(none)';
  return tasks.map(taskRow).join('\n');
}

function taskRow(t: Task): string {
  const due = t.due_at ? new Date(t.due_at * 1000).toISOString().slice(0, 10) : '-';
  const note = t.note ? ` — ${t.note.replace(/\s+/g, ' ').slice(0, 200)}` : '';
  return `${t.id}\t${t.status}\t${t.urgency}\tdue=${due}\t${t.title}${note}`;
}

async function streamStatus(stream: ReadableStream<Uint8Array>, onStatus: (label: string) => void): Promise<void> {
  let buffer = '';
  const decoder = new TextDecoder();
  for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(chunk, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      const event = parseEvent(line);
      if (!event) continue;
      const status = statusFor(event);
      if (status) onStatus(status);
    }
  }
}

function parseEvent(line: string): StreamEvent | null {
  try {
    return JSON.parse(line) as StreamEvent;
  } catch {
    return null;
  }
}

interface StreamEvent {
  type: string;
  message?: { content?: Array<{ type: string; text?: string; name?: string; input?: unknown }> };
}

function statusFor(event: StreamEvent): string | null {
  if (event.type !== 'assistant') return null;
  const blocks = event.message?.content ?? [];
  for (const block of blocks) {
    if (block.type === 'tool_use' && block.name === 'Bash') {
      return bashStatus(block.input);
    }
    if (block.type === 'text' && typeof block.text === 'string' && block.text.trim()) {
      return `claude: ${oneLine(block.text, 60)}`;
    }
  }
  return null;
}

function bashStatus(input: unknown): string {
  if (input && typeof input === 'object') {
    const o = input as Record<string, unknown>;
    if (typeof o.description === 'string' && o.description.trim()) return `bash: ${oneLine(o.description, 60)}`;
    if (typeof o.command === 'string') return `bash: ${oneLine(o.command, 60)}`;
  }
  return 'bash: …';
}

function oneLine(s: string, max: number): string {
  const flat = s.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
