import type { Urgency } from '../task';

export type RenderOpts = {
  color: boolean;
  width: number;
};

export const PLAIN: RenderOpts = { color: false, width: Infinity };

export function ttyOpts(stream: { isTTY?: boolean; columns?: number } = process.stdout): RenderOpts {
  const color = !!stream.isTTY && process.env.NO_COLOR == null;
  const width = stream.columns && stream.columns > 0 ? stream.columns : Infinity;
  return { color, width };
}

export function title(text: string, u: Urgency, opts: RenderOpts): string {
  if (!opts.color) return text;
  if (u === 'red') return ansi(`1;${RED_FG}`, text);
  if (u === 'blue') return ansi('2', text);
  return text;
}

export function marker(u: Urgency, opts: RenderOpts): string {
  if (!opts.color) return URGENCY_GLYPH[u];
  return ansi(URGENCY_ANSI[u], '▍');
}

export function dim(text: string, opts: RenderOpts): string {
  return opts.color ? ansi('2', text) : text;
}

export function bold(text: string, opts: RenderOpts): string {
  return opts.color ? ansi('1', text) : text;
}

export function color(text: string, name: 'green', opts: RenderOpts): string {
  if (!opts.color) return text;
  if (name === 'green') return ansi('32', text);
  return text;
}

export function ansi(code: string, text: string): string {
  return `\x1b[${code}m${text}\x1b[0m`;
}

// The shared shape of a task-count badge — `today` and `list` both render it.
export function countBadge(count: number): string {
  return `· ${count}`;
}

export function truncate(s: string, max: number): string {
  if (max === Infinity) return s;
  let visible = 0;
  let out = '';
  let i = 0;
  while (i < s.length) {
    if (s[i] === '\x1b' && s[i + 1] === '[') {
      const end = s.indexOf('m', i);
      if (end === -1) break;
      out += s.slice(i, end + 1);
      i = end + 1;
      continue;
    }
    if (visible >= max - 1) {
      return `${out}…\x1b[0m`;
    }
    out += s[i];
    visible++;
    i++;
  }
  return out;
}

const URGENCY_GLYPH: Record<Urgency, string> = {
  red: '🔴',
  yellow: '🟡',
  blue: '🔵',
};

const RED_FG = '38;2;255;75;110'; // hot pink-red, 24-bit truecolor

const URGENCY_ANSI: Record<Urgency, string> = {
  red: `1;${RED_FG}`,
  yellow: '33',
  blue: '2;34',
};
