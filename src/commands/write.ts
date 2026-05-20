import { runClaude, WRITERS, type Subcommand } from '../ai/run';
import { readPrompt } from '../io/readPrompt';
import { runList } from './list';
import { runToday } from './today';

export async function runWriter(sub: Subcommand, text: string): Promise<void> {
  const writer = WRITERS[sub];
  const input = writer.takesInput ? text.trim() || (await readPrompt()) : '';
  const { code } = await runClaude(sub, input);
  if (code !== 0) process.exit(code);
  console.log(`✅ ${writer.verb}`);
  console.log();
  if (writer.followup === 'today') runToday([]);
  else runList();
}
