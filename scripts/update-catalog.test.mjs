import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeRecord, assignArtistCredits, deduplicateSongs, buildCatalogue, fetchAllHolodexResults,
} from './update-catalog.mjs';

const idA = 'abcdefghijk';
const idB = 'lmnopqrstuv';
function record(id, overrides = {}) {
  return {
    id, title: 'Example original song', status: 'past',
    available_at: '2025-06-01T00:00:00.000Z',
    published_at: '2025-05-31T22:00:00.000Z',
    channel: { id: 'UCExampleChannel', english_name: 'Mori Calliope', name: 'Mori Calliope Ch. hololive-EN' },
    ...overrides,
  };
}

test('normalizeRecord maps video fields and prefers YouTube publication date', () => {
  const song = normalizeRecord(record(idA, { view_count: '12450', duration: 181 }));
  assert.equal(song.id, idA);
  assert.equal(song.artist, 'Mori Calliope');
  assert.equal(song.releaseDate, '2025-05-31T22:00:00.000Z');
  assert.equal(song.viewCount, 12450);
  assert.equal(song.duration, 181);
  assert.equal(song.songType, 'original');
});

test('normalizeRecord labels Music_Cover records separately from originals', () => {
  const song = normalizeRecord(record(idA), { topic: 'Music_Cover' });
  assert.equal(song.songType, 'cover');
});

test('normalizeRecord rejects malformed IDs and non-playable statuses', () => {
  assert.equal(normalizeRecord(record('short')), null);
  assert.equal(normalizeRecord(record(idA, { status: 'upcoming' })), null);
  assert.equal(normalizeRecord(record(idA, { status: 'missing' })), null);
});

test('deduplicateSongs keeps one record per ID and retains newer metadata', () => {
  const songs = [
    { ...normalizeRecord(record(idA)), title: 'Older title', releaseDate: '2024-01-01T00:00:00.000Z' },
    { ...normalizeRecord(record(idA)), title: 'Newer title', releaseDate: '2025-01-01T00:00:00.000Z' },
    normalizeRecord(record(idB, { title: 'Another song' })),
  ];
  const result = deduplicateSongs(songs);
  assert.equal(result.length, 2);
  assert.equal(result.find(song => song.id === idA).title, 'Newer title');
});

test('deduplicateSongs prefers cover classification when one video matches both topics', () => {
  const original = normalizeRecord(record(idA));
  const cover = normalizeRecord(record(idA), { topic: 'Music_Cover' });
  const result = deduplicateSongs([original, cover]);
  assert.equal(result.length, 1);
  assert.equal(result[0].songType, 'cover');
});

test('artist-credit inference detects collaboration names in English and Japanese', () => {
  const raw = [
    record(idA, { title: 'Mori Calliope × Hoshimachi Suisei — Song' }),
    record(idB, { title: '星街すいせい Original Track', channel: { english_name: 'Hoshimachi Suisei', name: 'Suisei Channel 星街すいせい' } }),
  ];
  const credited = assignArtistCredits(raw, raw.map(normalizeRecord).filter(Boolean));
  assert.ok(credited[0].artists.includes('Mori Calliope'));
  assert.ok(credited[0].artists.includes('Hoshimachi Suisei'));
  assert.ok(credited[1].artists.includes('Hoshimachi Suisei'));
});

test('buildCatalogue deduplicates IDs and returns documented schema', () => {
  const catalogue = buildCatalogue([
    record(idA), record(idA, { title: 'Duplicate' }), record(idB, { title: 'Another song' }),
  ], { generatedAt: '2026-10-11T00:00:00.000Z', pages: 1, reportedTotal: 3 });
  assert.equal(catalogue.schemaVersion, 1);
  assert.equal(catalogue.total, 2);
  assert.equal(catalogue.pagesFetched, 1);
  assert.equal(catalogue.songs.length, 2);
  assert.ok(catalogue.songs.every(song => Array.isArray(song.artists) && song.artists.length > 0));
  assert.ok(catalogue.songs.every(song => song.songType === 'original'));
  const covers = buildCatalogue([record(idA)], { topic: 'Music_Cover' });
  assert.equal(covers.query.topic, 'Music_Cover');
  assert.ok(covers.songs.every(song => song.songType === 'cover'));
});

test('full fetch paginates beyond 50 until source total is reached', async () => {
  const original = globalThis.fetch;
  const offsets = [];
  globalThis.fetch = async (_url, options = {}) => {
    const payload = JSON.parse(options.body);
    offsets.push(payload.offset);
    const length = payload.offset === 0 ? 50 : 1;
    const items = Array.from({ length }, (_, i) =>
      record(String(payload.offset + i + 1).padStart(11, '0')));
    return new Response(JSON.stringify({ total: 51, items }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const result = await fetchAllHolodexResults('test-key');
    assert.deepEqual(offsets, [0, 50]);
    assert.equal(result.rawItems.length, 51);
    assert.equal(result.reportedTotal, 51);
    assert.equal(result.pages, 2);
    assert.equal(result.complete, true);
  } finally {
    globalThis.fetch = original;
  }
});

test('fetch uses the requested Holodex topic', async () => {
  const original = globalThis.fetch;
  const payloads = [];
  globalThis.fetch = async (_url, options = {}) => {
    payloads.push(JSON.parse(options.body));
    return new Response(JSON.stringify({ total: 1, items: [record(idA)] }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  };
  try {
    const result = await fetchAllHolodexResults('test-key', { topic: 'Music_Cover' });
    assert.deepEqual(payloads.map(payload => payload.topic), [['Music_Cover']]);
    assert.equal(result.rawItems.length, 1);
    assert.equal(buildCatalogue(result.rawItems, { topic: 'Music_Cover' }).songs[0].songType, 'cover');
  } finally {
    globalThis.fetch = original;
  }
});

test('incremental fetch stops at a page containing only known video IDs', async () => {
  const original = globalThis.fetch;
  const offsets = [];
  const knownIds = new Set(Array.from({ length: 50 }, (_, i) => String(i + 1).padStart(11, '0')));
  globalThis.fetch = async (_url, options = {}) => {
    const payload = JSON.parse(options.body);
    offsets.push(payload.offset);
    const items = Array.from({ length: 50 }, (_, i) => record(String(i + 1).padStart(11, '0')));
    return new Response(JSON.stringify({ total: 3160, items }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const result = await fetchAllHolodexResults('test-key', { mode: 'incremental', knownIds });
    assert.deepEqual(offsets, [0]);
    assert.equal(result.rawItems.length, 50);
    assert.equal(result.pages, 1);
    assert.equal(result.stoppedAtKnownPage, true);
    assert.equal(result.complete, false);
  } finally {
    globalThis.fetch = original;
  }
});

test('incremental fetch gets new page then stops when the next page is already known', async () => {
  const original = globalThis.fetch;
  const offsets = [];
  const knownIds = new Set(Array.from({ length: 50 }, (_, i) => String(i + 51).padStart(11, '0')));
  globalThis.fetch = async (_url, options = {}) => {
    const payload = JSON.parse(options.body);
    offsets.push(payload.offset);
    const start = payload.offset === 0 ? 1 : 51;
    const items = Array.from({ length: 50 }, (_, i) => record(String(start + i).padStart(11, '0')));
    return new Response(JSON.stringify({ total: 3160, items }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const result = await fetchAllHolodexResults('test-key', { mode: 'incremental', knownIds });
    assert.deepEqual(offsets, [0, 50]);
    assert.equal(result.pages, 2);
    assert.equal(result.stoppedAtKnownPage, true);
  } finally {
    globalThis.fetch = original;
  }
});
