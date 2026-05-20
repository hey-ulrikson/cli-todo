import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MEMORY_DIR = join(import.meta.dir, '..', '..', 'memory');
const FILES = ['people.md', 'projects.md', 'glossary.md', 'conventions.md'] as const;

export const MEMORY: string = FILES.flatMap((name) => {
  const path = join(MEMORY_DIR, name);
  if (!existsSync(path)) return [];
  return [`# ${name}`, readFileSync(path, 'utf8')];
}).join('\n\n');
