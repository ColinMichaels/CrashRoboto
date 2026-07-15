import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const audioRoot = join(root, 'public/assets/audio');
const soundDesignSource = readFileSync(join(root, 'src/audio/recordedSoundDesign.ts'), 'utf8');
const musicCatalogSource = readFileSync(join(root, 'src/audio/musicCatalog.ts'), 'utf8');
const audioExtensions = new Set(['.aac', '.flac', '.m4a', '.mp3', '.oga', '.ogg', '.wav']);

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const expected = new Set();
const familyPattern = /\w+: variants\('([^']+)', '([^']+)', (\d+)/g;

for (const match of soundDesignSource.matchAll(familyPattern)) {
  const [, folder, cue, deliveredCount] = match;
  const runtimeCount = folder.startsWith('voice/') ? Number(deliveredCount) : 1;
  for (let index = 1; index <= runtimeCount; index += 1) {
    expected.add(`public/assets/audio/${folder}/${cue}__v${String(index).padStart(2, '0')}.mp3`);
  }
}

for (const match of musicCatalogSource.matchAll(/assets\/audio\/music\/([^'"`]+\.(?:mp3|ogg|wav|m4a))/g)) {
  expected.add(`public/assets/audio/music/${match[1]}`);
}

const shipped = new Set(
  walk(audioRoot)
    .filter((path) => audioExtensions.has(extname(path).toLowerCase()))
    .map((path) => relative(root, path)),
);

const missing = [...expected].filter((path) => !shipped.has(path)).sort();
const unused = [...shipped].filter((path) => !expected.has(path)).sort();

if (missing.length || unused.length) {
  if (missing.length) console.error(`Missing mapped audio:\n${missing.join('\n')}`);
  if (unused.length) console.error(`Unreferenced shipped audio:\n${unused.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Audio asset audit passed: ${shipped.size} mapped files, 0 unused.`);
}
