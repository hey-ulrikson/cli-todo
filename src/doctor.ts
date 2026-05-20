import { existsSync } from 'node:fs';

export interface CheckResult {
  label: string;
  ok: boolean;
  detail?: string;
}

export interface DoctorEnv {
  claudeBinary: string | null;
  dbPath: string;
  memoryDir: string;
}

export function runChecks(env: DoctorEnv): CheckResult[] {
  return [
    checkClaudeBinary(env.claudeBinary),
    checkDbPath(env.dbPath),
    checkMemoryDir(env.memoryDir),
  ];
}

function checkClaudeBinary(path: string | null): CheckResult {
  if (path) return { label: `claude binary at ${path}`, ok: true };
  return {
    label: 'claude binary on PATH',
    ok: false,
    detail: 'install Claude Code (https://claude.com/claude-code)',
  };
}

function checkDbPath(path: string): CheckResult {
  if (existsSync(path)) return { label: `DB exists at ${path}`, ok: true };
  return {
    label: `DB exists at ${path}`,
    ok: false,
    detail: 'will be created on first write',
  };
}

function checkMemoryDir(path: string): CheckResult {
  if (existsSync(path)) return { label: `memory/ readable at ${path}`, ok: true };
  return { label: `memory/ readable at ${path}`, ok: false };
}

export function formatChecks(results: readonly CheckResult[]): string {
  return results
    .map((r) => {
      const dot = r.ok ? '✓' : '✗';
      const tail = r.detail ? ` — ${r.detail}` : '';
      return `${dot} ${r.label}${tail}`;
    })
    .join('\n');
}

export function allOk(results: readonly CheckResult[]): boolean {
  return results.every((r) => r.ok);
}
