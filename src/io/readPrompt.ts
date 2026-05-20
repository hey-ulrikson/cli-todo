import { createInterface } from 'node:readline';

export async function readPrompt(): Promise<string> {
  const input = process.stdin.isTTY ? await readLine() : (await Bun.stdin.text()).trim();
  if (!input) throw new Error('no input provided');
  return input;
}

async function readLine(): Promise<string> {
  process.stdout.write('› ');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const line = await new Promise<string>((resolve) => {
    rl.once('line', resolve);
    rl.once('close', () => resolve(''));
  });
  rl.close();
  return line.trim();
}
