import { join } from 'node:path';
import { allOk, formatChecks, runChecks } from '../doctor';
import { resolveDbPath } from '../util';

export function runDoctor(): void {
  const results = runChecks({
    claudeBinary: Bun.which('claude'),
    ghBinary: Bun.which('gh'),
    dbPath: resolveDbPath(),
    memoryDir: join(import.meta.dir, '..', '..', 'memory'),
  });
  console.log(formatChecks(results));
  if (!allOk(results)) process.exit(1);
}
