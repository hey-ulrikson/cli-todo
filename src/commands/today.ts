import { openDb } from '../db';
import { countDoneSince, loadOpenTasks } from '../queries';
import { renderToday, ttyOpts } from '../render';
import { nowSec, resolveDbPath, startOfDaySec } from '../util';

export function runToday(_argv: readonly string[]): void {
  const db = openDb(resolveDbPath());
  const now = nowSec();
  const doneToday = countDoneSince(db, startOfDaySec(now));
  const out = renderToday(loadOpenTasks(db), now, ttyOpts(), doneToday);
  if (out) console.log(out);
}
