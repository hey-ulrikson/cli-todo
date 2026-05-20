import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function resolveDbPath(): string {
  const explicit = process.env.TODO_DB;
  if (explicit) return explicit;
  const home = process.env.HOME ?? '';
  const dataHome = process.env.XDG_DATA_HOME || `${home}/.local/share`;
  const path = `${dataHome}/todo/tasks.db`;
  mkdirSync(dirname(path), { recursive: true });
  return path;
}

export function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

export function startOfDaySec(nowSec: number): number {
  const d = new Date(nowSec * 1000);
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

export function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}
