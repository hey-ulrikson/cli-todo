import { openDb } from '../db';
import { loadOpenTasks } from '../queries';
import { renderList, ttyOpts } from '../render';
import { nowSec, resolveDbPath } from '../util';

export function runList(): void {
  const db = openDb(resolveDbPath());
  const out = renderList(loadOpenTasks(db), nowSec(), ttyOpts());
  if (out) console.log(out);
}
