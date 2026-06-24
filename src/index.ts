// A todo app that's just a markdown file. `todo` lists, `todo add` appends,
// `todo done <n>` checks the n-th open item. Edit TODO.md by hand anytime.
const FILE = process.env.TODO_FILE || `${process.env.HOME ?? '.'}/TODO.md`;

main(Bun.argv.slice(2));

async function main(argv: readonly string[]): Promise<void> {
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case undefined:
    case 'list':
      return list(await read());
    case 'add':
      return add(rest.join(' ').trim());
    case 'done':
      return done(rest.map(Number));
    default:
      fail('usage: todo [list] | todo add <text> | todo done <n...>');
  }
}

function list(lines: string[]): void {
  const open = lines.filter(isOpen);
  if (open.length === 0) return console.log('nothing to do ☀️');
  open.forEach((line, i) => console.log(`  ${i + 1}. ${text(line)}`));
}

async function add(task: string): Promise<void> {
  if (!task) fail('add what? — todo add <text>');
  const lines = await read();
  lines.push(`- [ ] ${task}`);
  await write(lines);
  console.log(`added: ${task}`);
}

async function done(numbers: number[]): Promise<void> {
  if (numbers.length === 0 || numbers.some((n) => !Number.isInteger(n) || n < 1)) {
    fail('done which? — todo done <n...> (numbers from `todo list`)');
  }
  const lines = await read();
  const openLineIndices = lines.map((l, i) => (isOpen(l) ? i : -1)).filter((i) => i >= 0);
  for (const n of numbers) {
    const idx = openLineIndices[n - 1];
    if (idx === undefined) {
      console.log(`no open item #${n}`);
      continue;
    }
    const marked = lines[idx]!.replace('- [ ]', '- [x]');
    lines[idx] = marked;
    console.log(`done: ${text(marked)}`);
  }
  await write(lines);
}

function isOpen(line: string): boolean {
  return line.trimStart().startsWith('- [ ]');
}

function text(line: string): string {
  return line.replace(/^\s*- \[[ x]\]\s*/, '');
}

async function read(): Promise<string[]> {
  const file = Bun.file(FILE);
  if (!(await file.exists())) return [];
  return (await file.text()).split('\n').filter((l) => l !== '');
}

async function write(lines: string[]): Promise<void> {
  await Bun.write(FILE, lines.join('\n') + '\n');
}

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}
