import { dueHint } from '../ranking';
import type { Task } from '../task';
import { dim, type RenderOpts } from './format';

export type MetaOpts = { trimNoteToFirstSentence: boolean };

export function metaSuffix(task: Task, nowSec: number, opts: RenderOpts, meta: MetaOpts): string {
  const hint = dueHint(task, nowSec);
  const hintBlock = hint ? ` ${dim(`(${hint})`, opts)}` : '';
  const noteText = task.note ? stripTrailingPeriod(meta.trimNoteToFirstSentence ? firstSentence(task.note) : task.note) : '';
  const noteBlock = noteText ? ` ${dim(`— ${noteText}`, opts)}` : '';
  return hintBlock + noteBlock;
}

/** A note is one phrase — the closing period reads as clutter in a scannable list. */
export function stripTrailingPeriod(s: string): string {
  return s.replace(/\.\s*$/, '');
}

// An untagged task is the user's by default — others always carry a name — so
// the "Own" tag is pure noise in any rendered view.
export function withOwnTagStripped(task: Task): Task {
  if (!task.note) return task;
  const note = task.note.replace(/\s*\bown\b\.?/gi, '').replace(/\s+/g, ' ').trim();
  return { ...task, note: note || null };
}

function firstSentence(note: string): string {
  const idx = note.indexOf('. ');
  if (idx === -1) return note.replace(/\.$/, '');
  return note.slice(0, idx);
}
