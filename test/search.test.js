const test = require('node:test');
const assert = require('node:assert/strict');
const {
  hydrateRecord,
  normalize,
  parseCodePointQuery,
  searchCharacters
} = require('../src/search.js');

const records = [
  [0x2192, 'RIGHTWARDS ARROW', 'Sm', 'Arrows', 'RIGHT ARROW'],
  [0x2190, 'LEFTWARDS ARROW', 'Sm', 'Arrows', 'LEFT ARROW'],
  [0x21d2, 'RIGHTWARDS DOUBLE ARROW', 'Sm', 'Arrows', 'IMPLIES'],
  [0x03c0, 'GREEK SMALL LETTER PI', 'Ll', 'Greek and Coptic', ''],
  [0x20ac, 'EURO SIGN', 'Sc', 'Currency Symbols', 'EURO'],
  [0x1f600, 'GRINNING FACE', 'So', 'Emoticons', '']
].map(hydrateRecord);

test('normalizes punctuation and diacritics for search', () => {
  assert.equal(normalize('Rightwards—Arrow'), 'rightwards arrow');
  assert.equal(normalize('Café'), 'cafe');
});

test('recognizes common code point query formats', () => {
  assert.equal(parseCodePointQuery('U+2192'), 0x2192);
  assert.equal(parseCodePointQuery('0x1F600'), 0x1f600);
  assert.equal(parseCodePointQuery('\\u{20AC}'), 0x20ac);
  assert.equal(parseCodePointQuery('→'), 0x2192);
});

test('finds characters by name and ranks the closest match first', () => {
  const results = searchCharacters(records, 'right arrow');
  assert.equal(results[0].cp, 0x2192);
  assert.ok(results.some((record) => record.cp === 0x21d2));
});

test('finds characters by alias', () => {
  const results = searchCharacters(records, 'implies');
  assert.equal(results[0].cp, 0x21d2);
});

test('finds an exact code point before fuzzy name matches', () => {
  const results = searchCharacters(records, 'U+03C0');
  assert.equal(results[0].char, 'π');
});

test('uses recent and favorite characters for an empty query', () => {
  const results = searchCharacters(records, '', {
    recent: [0x20ac],
    favorites: [0x03c0],
    recordsByCodePoint: new Map(records.map((record) => [record.cp, record]))
  });
  assert.deepEqual(results.slice(0, 2).map((record) => record.cp), [0x20ac, 0x03c0]);
});
