import { WRITERS, type Subcommand } from './ai/run';
import { runWriter } from './commands/write';
import { runDoctor } from './commands/doctor';
import { runList } from './commands/list';
import { runServe } from './commands/serve';
import { runToday } from './commands/today';

await main(Bun.argv.slice(2));

async function main(argv: readonly string[]): Promise<void> {
  const cmd = argv[0] ?? 'list';
  const bg = argv.includes('--bg') || argv.includes('-q');
  const rest = argv.slice(1).filter((a) => a !== '--bg' && a !== '-q');
  try {
    if (isWriter(cmd)) return await runWriter(cmd, rest.join(' '), { bg });
    switch (cmd) {
      case 'list':
        return runList();
      case 'today':
        return runToday(rest);
      case 'serve':
        return runServe();
      case 'doctor':
        return runDoctor();
      default:
        console.error(`Unknown command: ${cmd}`);
        process.exit(1);
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

function isWriter(cmd: string): cmd is Subcommand {
  return cmd in WRITERS;
}
