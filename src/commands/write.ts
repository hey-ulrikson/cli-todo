import { createInterface } from 'node:readline';
import { runClaude, type Subcommand } from '../ai/run';
import { readPrompt } from '../io/readPrompt';
import { runToday } from './today';

export async function runWriter(sub: Subcommand, text: string, opts: { bg?: boolean } = {}): Promise<void> {
  const input = text.trim() || (await readPrompt());
  const { code, ask } = await runClaude(sub, input, opts.bg);
  if (code !== 0) process.exit(code);

  if (opts.bg) {
    console.log(`✅ ${DONE_LABEL[sub]}`);
    return;
  }

  if (ask) await applyFollowup(input, ask);
  runToday([]);
}

const DONE_LABEL: Record<Subcommand, string> = { do: 'added', done: 'done', edit: 'updated' };

/** Ask Claude's one follow-up question, then fold the answer back in as an edit. */
async function applyFollowup(input: string, question: string): Promise<void> {
  const answer = await askUser(question);
  if (!answer) return;
  const { code } = await runClaude('edit', `Just added: "${input}". Follow-up — ${question} The user answered: "${answer}". Apply that to the task just added.`);
  if (code !== 0) console.error("Couldn't apply your answer — the task was still added; edit it directly if needed.");
}

async function askUser(question: string): Promise<string> {
  if (!process.stdin.isTTY) return '';
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await new Promise<string>((resolve) => rl.question(`${question} (↵ to skip) › `, resolve));
    return answer.trim();
  } finally {
    rl.close();
  }
}
