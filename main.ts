// A token launch radar (Node 22, standard library only), entered in make.fun's token-radar-01.
//
// The program reads the sealed snapshot from /input/snapshot.json (or --input <file|dir>), prices
// every pre-token protocol with the anchored model in lib/model.ts, writes the ranked board to
// /output/board.json, writes the dashboard's data to /output/data.js, copies this repository's
// dashboard/ and screenshots/ into /output, and writes /output/dossier.json last with
// buildDossier from vendor/makefun-board.ts — the same bytes the scorer rebuilds and compares.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
//
// The run is deterministic: no clock, no randomness, every ordering tie broken by slug, so two
// runs on the same snapshot write the same bytes.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

/** The gate's caps, mirrored so the program refuses a board it would refuse, before handing it in. */
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_MAX = 4;
const SCREENSHOT_MAX_BYTES = 524_288;
const DASHBOARD_MAX_FILES = 400;
const DASHBOARD_MAX_BYTES = 4_194_304;
const PLAIN_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_MAGIC = [0xff, 0xd8, 0xff];

function fail(message: string): never {
  process.stderr.write(`token radar: ${message}\n`);
  process.exit(1);
}

/** --name <value> or --name=<value> out of the arguments, or the fallback. */
function arg(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1]!;
  const withEquals = process.argv.find((a) => a.startsWith(`--${name}=`));
  return withEquals === undefined ? fallback : withEquals.slice(name.length + 3);
}

const inputArg = arg('input', process.env.MAKEFUN_INPUT_DIR ?? '/input');
const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) fail(`no snapshot at ${inputFile}: pass --input <snapshot.json|directory> or mount the sealed /input`);
const out = arg('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
const { board, data } = buildRadar(snapshot);
const issue = boardIssue(board, snapshot);
if (issue !== null) fail(`the model wrote a board the gate refuses: ${issue}`);

/** Copy one directory's regular files into `to`, skipping names that start with a dot. */
function copyFiles(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const path = join(from, name);
    if (!statSync(path).isFile()) continue;
    copyFileSync(path, join(to, name));
    copied.push(name);
  }
  return copied;
}

/** Whether a file opens with the PNG or the JPEG magic bytes. */
function isImage(path: string): boolean {
  const head = readFileSync(path).subarray(0, 8);
  const opens = (magic: number[]): boolean => head.length >= magic.length && magic.every((b, i) => head[i] === b);
  return opens(PNG_MAGIC) || opens(JPEG_MAGIC);
}

// The screenshots are part of the hand-in: check them here, where a fix is still cheap, against
// the same shape the gate reads — plain names, whole images, within the byte cap.
const shotDir = join(here, 'screenshots');
const shotNames = existsSync(shotDir) ? readdirSync(shotDir).filter((n) => !n.startsWith('.') && statSync(join(shotDir, n)).isFile()) : [];
if (shotNames.length < 3 || shotNames.length > SCREENSHOT_MAX) fail(`screenshots/ holds ${shotNames.length} images: hand in 3 — the board, a detail view and a filtered view`);
for (const name of shotNames) {
  if (!PLAIN_NAME.test(name)) fail(`screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters`);
  const size = statSync(join(shotDir, name)).size;
  if (size > SCREENSHOT_MAX_BYTES) fail(`screenshots/${name} is ${size} bytes, over the ${SCREENSHOT_MAX_BYTES} cap`);
  if (!isImage(join(shotDir, name))) fail(`screenshots/${name} is not a whole PNG or JPEG`);
}

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(out, 'data.js'), dataScript(data));
const dashFiles = copyFiles(join(here, 'dashboard'), join(out, 'dashboard'));
const shots = copyFiles(shotDir, join(out, 'screenshots'));

// The dossier is written last: the scorer rebuilds it from this /output and compares bytes.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, { text_max_bytes: TEXT_MAX_BYTES, screenshots: { max: SCREENSHOT_MAX, max_bytes: SCREENSHOT_MAX_BYTES }, dashboard: { max_files: DASHBOARD_MAX_FILES, max_bytes: DASHBOARD_MAX_BYTES } }),
);

process.stdout.write(
  `token radar: ${snapshot.protocols.length} protocols (${data.counts.pre_token} pre-token, ${data.counts.live} traded), watchlist ${snapshot.watchlist.length}, board ${board.length} rows (${data.counts.early} early below the floor)\n` +
    `token radar: wrote board.json, data.js, dashboard/ (${dashFiles.length} files), screenshots/ (${shots.length} images) and dossier.json under ${out}\n`,
);
