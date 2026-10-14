importScripts('./search.js');

let records = [];
let recordsByCodePoint = new Map();

async function initialize() {
  try {
    const response = await fetch('./data/characters.json');
    if (!response.ok) throw new Error(`Character database returned ${response.status}`);
    const payload = await response.json();
    records = payload.characters.map(UnifindSearch.hydrateRecord);
    recordsByCodePoint = new Map(records.map((record) => [record.cp, record]));
    postMessage({
      type: 'ready',
      count: records.length,
      version: payload.version
    });
  } catch (error) {
    postMessage({ type: 'error', message: error.message });
  }
}

self.onmessage = ({ data }) => {
  if (data.type !== 'search' || records.length === 0) return;
  const results = UnifindSearch.searchCharacters(records, data.query, {
    limit: data.limit,
    recent: data.recent,
    favorites: data.favorites,
    recordsByCodePoint
  }).map(({ haystack, normalizedName, normalizedAliases, normalizedBlock, ...record }) => record);

  postMessage({ type: 'results', id: data.id, results });
};

initialize();
