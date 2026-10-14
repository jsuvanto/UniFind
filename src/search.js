(function exposeSearch(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.UnifindSearch = api;
})(typeof self !== 'undefined' ? self : globalThis, function createSearch() {
  'use strict';

  const POPULAR_CODE_POINTS = [
    0x2192, 0x2190, 0x2191, 0x2193, 0x2194, 0x21d2, 0x21d4,
    0x2713, 0x2714, 0x2715, 0x2716, 0x2717, 0x2718,
    0x00a9, 0x00ae, 0x2122, 0x00b0, 0x00b1, 0x00d7, 0x00f7,
    0x2260, 0x2248, 0x2264, 0x2265, 0x221e, 0x221a, 0x2211,
    0x03c0, 0x03b1, 0x03b2, 0x03b3, 0x03b4, 0x03bb, 0x03bc,
    0x20ac, 0x00a3, 0x00a5, 0x20bf, 0x00a2,
    0x2022, 0x2026, 0x2014, 0x2013, 0x2018, 0x2019, 0x201c, 0x201d,
    0x00b7, 0x00a7, 0x00b6, 0x2605, 0x2606, 0x2665, 0x2666,
    0x1f600, 0x1f44d, 0x1f389, 0x1f680, 0x1f4a1, 0x1f50d
  ];

  function normalize(value) {
    return String(value || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[_-]+/g, ' ')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  function hydrateRecord(row) {
    const [cp, name, category, block, aliasString = ''] = row;
    const aliases = aliasString ? aliasString.split('|') : [];
    const hex = cp.toString(16).toUpperCase().padStart(4, '0');
    const normalizedName = normalize(name);
    const normalizedAliases = normalize(aliases.join(' '));
    const normalizedBlock = normalize(block);
    return {
      cp,
      char: String.fromCodePoint(cp),
      hex,
      name,
      category,
      block,
      aliases,
      normalizedName,
      normalizedAliases,
      normalizedBlock,
      haystack: `${normalizedName} ${normalizedAliases} ${normalizedBlock} u ${hex.toLowerCase()}`
    };
  }

  function parseCodePointQuery(rawQuery) {
    const trimmed = String(rawQuery || '').trim();
    const explicitHex = trimmed.match(/^(?:u\+|0x|\\u\{?)([0-9a-f]{2,6})\}?$/i);
    if (explicitHex) return Number.parseInt(explicitHex[1], 16);
    if (/^[0-9a-f]{4,6}$/i.test(trimmed) && /[a-f]/i.test(trimmed)) {
      return Number.parseInt(trimmed, 16);
    }
    if (Array.from(trimmed).length === 1) return trimmed.codePointAt(0);
    return null;
  }

  function scoreRecord(record, normalizedQuery, tokens, exactCodePoint) {
    if (exactCodePoint !== null && record.cp === exactCodePoint) return -1000;
    if (!tokens.every((token) => record.haystack.includes(token))) return null;

    let score = 500;
    if (record.normalizedName === normalizedQuery) score = 0;
    else if (record.normalizedName.startsWith(normalizedQuery)) score = 20;
    else if (record.normalizedName.includes(normalizedQuery)) score = 70;
    else if (record.normalizedAliases.includes(normalizedQuery)) score = 100;
    else if (record.normalizedBlock === normalizedQuery) score = 170;

    for (const token of tokens) {
      const nameIndex = record.normalizedName.indexOf(token);
      const aliasIndex = record.normalizedAliases.indexOf(token);
      const blockIndex = record.normalizedBlock.indexOf(token);
      const bestIndex = Math.min(
        nameIndex < 0 ? 999 : nameIndex,
        aliasIndex < 0 ? 999 : aliasIndex + 20,
        blockIndex < 0 ? 999 : blockIndex + 40
      );
      score += bestIndex;
      if (record.normalizedName.split(' ').some((word) => word.startsWith(token))) score -= 18;
    }

    score += Math.min(record.name.length, 60) / 8;
    return score;
  }

  function defaultResults(recordsByCodePoint, recent, favorites, limit) {
    const ordered = [...recent, ...favorites, ...POPULAR_CODE_POINTS];
    const used = new Set();
    const results = [];

    for (const codePoint of ordered) {
      if (used.has(codePoint)) continue;
      const record = recordsByCodePoint.get(codePoint);
      if (!record) continue;
      used.add(codePoint);
      results.push(record);
      if (results.length >= limit) break;
    }

    return results;
  }

  function searchCharacters(records, rawQuery, options = {}) {
    const limit = options.limit || 80;
    const recent = options.recent || [];
    const favorites = options.favorites || [];
    const normalizedQuery = normalize(rawQuery);

    if (!normalizedQuery) {
      const byCodePoint = options.recordsByCodePoint || new Map(records.map((record) => [record.cp, record]));
      return defaultResults(byCodePoint, recent, favorites, limit);
    }

    const tokens = normalizedQuery.split(' ').filter(Boolean);
    const exactCodePoint = parseCodePointQuery(rawQuery);
    const favoriteSet = new Set(favorites);
    const recentRanks = new Map(recent.map((cp, index) => [cp, index]));
    const scored = [];

    for (const record of records) {
      let score = scoreRecord(record, normalizedQuery, tokens, exactCodePoint);
      if (score === null) continue;
      if (favoriteSet.has(record.cp)) score -= 12;
      if (recentRanks.has(record.cp)) score -= Math.max(2, 10 - recentRanks.get(record.cp));
      scored.push({ record, score });
    }

    scored.sort((a, b) => a.score - b.score || a.record.name.localeCompare(b.record.name));
    return scored.slice(0, limit).map(({ record }) => record);
  }

  return {
    POPULAR_CODE_POINTS,
    hydrateRecord,
    normalize,
    parseCodePointQuery,
    searchCharacters
  };
});
