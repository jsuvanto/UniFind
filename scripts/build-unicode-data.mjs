import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const UCD_VERSION = process.env.UCD_VERSION || '18.0.0';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = resolve(ROOT, 'src', 'data', 'characters.json');
const BASE_URL = `https://www.unicode.org/Public/${UCD_VERSION}/ucd`;

async function download(name) {
  const url = `${BASE_URL}/${name}`;
  process.stdout.write(`Downloading ${url}\n`);
  const response = await fetch(url, {
    headers: { 'User-Agent': 'UniFind data builder/0.1' }
  });

  if (!response.ok) {
    throw new Error(`Could not download ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

function parseAliases(text) {
  const aliases = new Map();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, '').trim();
    if (!line) continue;

    const [hex, alias, type] = line.split(';').map((part) => part.trim());
    const codePoint = Number.parseInt(hex, 16);
    const existing = aliases.get(codePoint) || [];
    existing.push({ alias, type });
    aliases.set(codePoint, existing);
  }

  return aliases;
}

function parseBlocks(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*/, '').trim())
    .filter(Boolean)
    .map((line) => {
      const [range, name] = line.split(';').map((part) => part.trim());
      const [start, end] = range.split('..').map((hex) => Number.parseInt(hex, 16));
      return { start, end, name };
    });
}

function blockFor(codePoint, blocks) {
  let low = 0;
  let high = blocks.length - 1;

  while (low <= high) {
    const middle = (low + high) >> 1;
    const block = blocks[middle];
    if (codePoint < block.start) high = middle - 1;
    else if (codePoint > block.end) low = middle + 1;
    else return block.name;
  }

  return 'No Block';
}

function hangulName(codePoint) {
  const syllableIndex = codePoint - 0xac00;
  const leading = [
    'G', 'GG', 'N', 'D', 'DD', 'R', 'M', 'B', 'BB', 'S', 'SS',
    '', 'J', 'JJ', 'C', 'K', 'T', 'P', 'H'
  ];
  const vowel = [
    'A', 'AE', 'YA', 'YAE', 'EO', 'E', 'YEO', 'YE', 'O', 'WA',
    'WAE', 'OE', 'YO', 'U', 'WEO', 'WE', 'WI', 'YU', 'EU', 'YI', 'I'
  ];
  const trailing = [
    '', 'G', 'GG', 'GS', 'N', 'NJ', 'NH', 'D', 'L', 'LG', 'LM', 'LB',
    'LS', 'LT', 'LP', 'LH', 'M', 'B', 'BS', 'S', 'SS', 'NG', 'J', 'C',
    'K', 'T', 'P', 'H'
  ];
  const leadingIndex = Math.floor(syllableIndex / 588);
  const vowelIndex = Math.floor((syllableIndex % 588) / 28);
  const trailingIndex = syllableIndex % 28;
  return `HANGUL SYLLABLE ${leading[leadingIndex]}${vowel[vowelIndex]}${trailing[trailingIndex]}`;
}

function rangeName(rawName, codePoint) {
  const baseName = rawName.replace(/^</, '').replace(/, First>$/, '').toUpperCase();
  const hex = codePoint.toString(16).toUpperCase();

  if (baseName === 'HANGUL SYLLABLE') return hangulName(codePoint);
  if (baseName.includes('CJK IDEOGRAPH')) return `CJK UNIFIED IDEOGRAPH-${hex}`;
  if (baseName.includes('TANGUT IDEOGRAPH')) return `TANGUT IDEOGRAPH-${hex}`;
  if (baseName.includes('KHITAN SMALL SCRIPT CHARACTER')) {
    return `KHITAN SMALL SCRIPT CHARACTER-${hex}`;
  }
  return `${baseName}-${hex}`;
}

function preferredName(codePoint, unicodeName, aliases) {
  if (!unicodeName.startsWith('<')) return unicodeName;
  const candidates = aliases.get(codePoint) || [];
  const controlAlias = candidates.find(({ type }) => type === 'control');
  if (controlAlias) return controlAlias.alias.toUpperCase();
  return unicodeName.slice(1, -1).toUpperCase();
}

function aliasText(codePoint, aliases) {
  return (aliases.get(codePoint) || [])
    .map(({ alias }) => alias.toUpperCase())
    .filter((alias, index, all) => all.indexOf(alias) === index)
    .join('|');
}

function addRecord(records, codePoint, name, category, blocks, aliases) {
  if (category === 'Cs' || category === 'Cn' || category === 'Co') return;
  records.push([
    codePoint,
    name,
    category,
    blockFor(codePoint, blocks),
    aliasText(codePoint, aliases)
  ]);
}

function parseUnicodeData(text, blocks, aliases) {
  const records = [];
  let pendingRange = null;

  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    const fields = line.split(';');
    const codePoint = Number.parseInt(fields[0], 16);
    const unicodeName = fields[1];
    const category = fields[2];

    if (unicodeName.endsWith(', First>')) {
      pendingRange = { codePoint, unicodeName, category };
      continue;
    }

    if (unicodeName.endsWith(', Last>') && pendingRange) {
      for (let current = pendingRange.codePoint; current <= codePoint; current += 1) {
        addRecord(
          records,
          current,
          rangeName(pendingRange.unicodeName, current),
          pendingRange.category,
          blocks,
          aliases
        );
      }
      pendingRange = null;
      continue;
    }

    addRecord(
      records,
      codePoint,
      preferredName(codePoint, unicodeName, aliases),
      category,
      blocks,
      aliases
    );
  }

  return records;
}

const [unicodeData, blockData, aliasData] = await Promise.all([
  download('UnicodeData.txt'),
  download('Blocks.txt'),
  download('NameAliases.txt')
]);

const aliases = parseAliases(aliasData);
const blocks = parseBlocks(blockData);
const characters = parseUnicodeData(unicodeData, blocks, aliases);
const payload = {
  version: UCD_VERSION,
  generatedAt: new Date().toISOString(),
  characters
};

await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, JSON.stringify(payload));
process.stdout.write(`Wrote ${characters.length.toLocaleString('en')} characters to ${OUTPUT}\n`);
