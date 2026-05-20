export interface Spinner {
  update: (label: string) => void;
  stop: () => void;
}

export function startSpinner(initial: string): Spinner {
  return process.stderr.isTTY ? animatedSpinner(initial) : loggingSpinner(initial);
}

function animatedSpinner(initial: string): Spinner {
  const start = Date.now();
  let label = initial;
  let frame = 0;
  const render = (): void => {
    process.stderr.write(`${CLEAR_LINE}${FRAMES[frame++ % FRAMES.length]} ${label} (${elapsed(start)})`);
  };
  render();
  const handle = setInterval(render, 80);
  return {
    update: (next) => { label = next; },
    stop: () => {
      clearInterval(handle);
      process.stderr.write(CLEAR_LINE);
    },
  };
}

function loggingSpinner(initial: string): Spinner {
  const start = Date.now();
  let label = initial;
  const log = (next: string): void => {
    label = next;
    process.stderr.write(`→ ${label}…\n`);
  };
  log(initial);
  return {
    update: (next) => { if (next !== label) log(next); },
    stop: () => process.stderr.write(`✓ done (${elapsed(start)})\n`),
  };
}

function elapsed(start: number): string {
  return `${((Date.now() - start) / 1000).toFixed(1)}s`;
}

const CLEAR_LINE = '\r\x1b[K';
const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
