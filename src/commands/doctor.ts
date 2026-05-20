import { join } from 'node:path';
import { allOk, formatChecks, runChecks } from '../doctor';
import { resolveDbPath } from '../util';

export function runDoctor(): void {
  const claudeBinary = Bun.which('claude');
  const results = runChecks({
    claudeBinary,
    dbPath: resolveDbPath(),
    memoryDir: join(import.meta.dir, '..', '..', 'memory'),
  });
  console.log(formatChecks(results));
  if (!allOk(results)) process.exit(1);
}
