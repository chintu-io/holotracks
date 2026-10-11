import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeCatalogues } from './merge-catalogues.mjs';

function catalogue(songs, overrides = {}) {
  return {
    schemaVersion: 1, generatedAt: '2026-10-11T10:00:00.000Z',
    lastFullReconciledAt: null, sourceTotal: 10,
    sourceTotalByTopic: { Original_Song: 5, Music_Cover: 5 },
    pagesFetched: 1, songs, total: songs.length, ...overrides,
  };
}
test('merge preserves latest-main IDs and appends candidate-only records', () => {
  const latest = catalogue([
    { id: 'aaaaaaaaaaa', title: 'Latest title', releaseDate: '2026-01-02', songType: 'original', viewCount: 30 },
    { id: 'bbbbbbbbbbb', title: 'Main-only', releaseDate: '2026-01-01', songType: 'cover' },
  ]);
  const candidate = catalogue([
    { id: 'aaaaaaaaaaa', title: 'Stale title', releaseDate: '2025-01-02', songType: 'original', viewCount: 10 },
    { id: 'ccccccccccc', title: 'New candidate', releaseDate: '2026-01-03', songType: 'cover', viewCount: 5 },
  ], { generatedAt: '2026-10-11T10:05:00.000Z', sourceTotal: 12,
    sourceTotalByTopic: { Original_Song: 6, Music_Cover: 6 }, pagesFetched: 2 });
  const merged = mergeCatalogues(latest, candidate);
  assert.equal(merged.total, 3);
  assert.deepEqual(new Set(merged.songs.map(song => song.id)), new Set(['aaaaaaaaaaa','bbbbbbbbbbb','ccccccccccc']));
  assert.equal(merged.songs.find(song => song.id === 'aaaaaaaaaaa').title, 'Latest title');
  assert.equal(merged.songs.find(song => song.id === 'aaaaaaaaaaa').viewCount, 30);
  assert.equal(merged.songs.find(song => song.id === 'bbbbbbbbbbb').songType, 'cover');
  assert.equal(merged.songs.find(song => song.id === 'ccccccccccc').title, 'New candidate');
  assert.equal(merged.generatedAt, '2026-10-11T10:05:00.000Z');
  assert.equal(merged.sourceTotalByTopic.Original_Song, 6);
});
test('merge rejects malformed catalogue inputs', () => {
  assert.throws(() => mergeCatalogues({ songs: [] }, null), /Both catalogue inputs/);
});
