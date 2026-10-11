#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function mergeCatalogues(latest, candidate) {
  if (!latest || !Array.isArray(latest.songs) || !candidate || !Array.isArray(candidate.songs)) {
    throw new Error('Both catalogue inputs must be JSON objects with songs[] arrays.');
  }
  const byId = new Map();
  for (const song of latest.songs) {
    if (!song || typeof song.id !== 'string' || !song.id.trim()) continue;
    byId.set(song.id, { ...song });
  }
  for (const song of candidate.songs) {
    if (!song || typeof song.id !== 'string' || !song.id.trim()) continue;
    const existing = byId.get(song.id);
    if (!existing) {
      byId.set(song.id, { ...song });
      continue;
    }
    const isCover = existing.songType === 'cover' || song.songType === 'cover';
    byId.set(song.id, {
      ...song,
      ...existing,
      viewCount: existing.viewCount ?? song.viewCount ?? null,
      likeCount: existing.likeCount ?? song.likeCount ?? null,
      statisticsCheckedAt: existing.statisticsCheckedAt ?? song.statisticsCheckedAt,
      ...(isCover ? { songType: 'cover' } : {}),
    });
  }
  const songs = [...byId.values()].sort((a, b) =>
    (Date.parse(b.releaseDate || '') || 0) - (Date.parse(a.releaseDate || '') || 0) ||
    String(a.title || '').localeCompare(String(b.title || ''))
  );
  const topicTotals = {};
  for (const topic of new Set([
    ...Object.keys(candidate.sourceTotalByTopic || {}),
    ...Object.keys(latest.sourceTotalByTopic || {}),
  ])) {
    const values = [candidate.sourceTotalByTopic?.[topic], latest.sourceTotalByTopic?.[topic]]
      .map(Number).filter(Number.isFinite);
    topicTotals[topic] = values.length ? Math.max(...values) : null;
  }
  const latestGeneratedAt = Date.parse(latest.generatedAt || '') || 0;
  const candidateGeneratedAt = Date.parse(candidate.generatedAt || '') || 0;
  const latestFull = Date.parse(latest.lastFullReconciledAt || '') || 0;
  const candidateFull = Date.parse(candidate.lastFullReconciledAt || '') || 0;
  return {
    ...candidate,
    ...latest,
    schemaVersion: Math.max(Number(latest.schemaVersion) || 1, Number(candidate.schemaVersion) || 1),
    generatedAt: latestGeneratedAt >= candidateGeneratedAt ? latest.generatedAt : candidate.generatedAt,
    lastFullReconciledAt: latestFull >= candidateFull
      ? (latest.lastFullReconciledAt || null)
      : (candidate.lastFullReconciledAt || null),
    sourceTotal: Math.max(Number(latest.sourceTotal) || 0, Number(candidate.sourceTotal) || 0) || null,
    sourceTotalByTopic: topicTotals,
    pagesFetched: Math.max(Number(latest.pagesFetched) || 0, Number(candidate.pagesFetched) || 0),
    total: songs.length,
    songs,
  };
}
function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
function main(argv) {
  const [latestPath, candidatePath, outputPath] = argv;
  if (!latestPath || !candidatePath || !outputPath) {
    throw new Error('Usage: node scripts/merge-catalogues.mjs <latest-main.json> <candidate.json> <output.json>');
  }
  const latest = readJson(latestPath);
  const candidate = readJson(candidatePath);
  const merged = mergeCatalogues(latest, candidate);
  const temporaryPath = outputPath + '.merge-' + process.pid + '.tmp';
  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  fs.writeFileSync(temporaryPath, JSON.stringify(merged, null, 2) + '\n');
  fs.renameSync(temporaryPath, outputPath);
  console.log('Merged catalogue safely: ' + merged.total + ' unique videos.');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(error.stack || error.message || String(error)); process.exitCode = 1; }
}
