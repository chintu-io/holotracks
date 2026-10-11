#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_PATH = path.join(ROOT, 'data', 'songs.json');
const HOLODEX_SEARCH_URL = 'https://holodex.net/api/v2/search/videoSearch';
const PAGE_SIZE = 50;
const MAX_SONGS = 25000;
const API_TIMEOUT_MS = 30000;
const PAGE_DELAY_FULL_MS = 500;
const PAGE_DELAY_INCREMENTAL_MS = 250;
const TOPIC_TYPES = Object.freeze({ Original_Song: 'original', Music_Cover: 'cover' });

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error('Missing required environment variable: ' + name);
  return value;
}
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function retryAfterMs(response) {
  const header = response.headers.get('retry-after');
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null;
}

async function fetchJson(url, options = {}, label = 'API request') {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: { Accept: 'application/json', ...(options.headers || {}) },
      });
      const text = await response.text();
      let data;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        throw new Error(label + ' returned non-JSON HTTP ' + response.status + ': ' + text.slice(0, 180));
      }
      if (!response.ok) {
        const error = new Error(label + ' failed (HTTP ' + response.status + '): ' +
          String(data?.message || data?.error?.message || data?.error || ('HTTP ' + response.status)).slice(0, 350));
        error.status = response.status;
        error.retryAfterMs = retryAfterMs(response);
        throw error;
      }
      return data;
    } catch (error) {
      const retryable = error.name === 'AbortError' || error.status === 429 ||
        (error.status >= 500 && error.status <= 599);
      if (!retryable || attempt === 4) {
        if (error.name === 'AbortError') {
          throw new Error(label + ' timed out after ' + (API_TIMEOUT_MS / 1000) + ' seconds');
        }
        throw error;
      }
      const waitMs = Number.isFinite(error.retryAfterMs) && error.retryAfterMs !== null
        ? error.retryAfterMs
        : Math.min(20000, 700 * 2 ** (attempt - 1) + Math.floor(Math.random() * 250));
      // Respect a long server-imposed delay instead of quickly retrying into throttling.
      if (waitMs > 5 * 60 * 1000) {
        throw new Error(label + ' was rate-limited and requested a ' +
          Math.ceil(waitMs / 1000) + 's wait. Stopping this run safely; retry later.');
      }
      console.warn(label + ' attempt ' + attempt + '/4 failed (HTTP ' +
        (error.status || 'network') + '); waiting ' + Math.ceil(waitMs / 1000) + 's before retrying.');
      await delay(waitMs);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(label + ' failed after retries');
}

function firstString(...values) {
  return values.find(value => typeof value === 'string' && value.trim())?.trim() || '';
}
function firstDate(...values) {
  for (const value of values) {
    if (typeof value === 'string' && Number.isFinite(Date.parse(value))) return new Date(value).toISOString();
  }
  return '';
}
function safeCount(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== '' &&
        Number.isFinite(Number(value)) && Number(value) >= 0) return Math.floor(Number(value));
  }
  return null;
}
function generic(name) {
  return /hololive|holo\s*live|hololive production|cover corp|ホロライブ|ホロスターズ|holo\*?stars|hololive music/i.test(name || '');
}
function cleanName(name) {
  return String(name || '').replace(/\s*(?:Ch\.|Channel)\s*.*$/i, '').replace(/\s*[-|｜].*$/, '').replace(/\s+/g, ' ').trim();
}

export function normalizeRecord(item, { topic = 'Original_Song' } = {}) {
  if (!item || typeof item !== 'object') return null;
  const id = typeof item.id === 'string' ? item.id.trim() : '';
  if (!/^[\w-]{11}$/.test(id) ||
      ['live', 'upcoming', 'missing'].includes(String(item.status || '').toLowerCase())) return null;
  const channel = item.channel && typeof item.channel === 'object' ? item.channel : {};
  const englishName = firstString(channel.english_name, channel.englishName);
  const rawName = firstString(channel.name, englishName);
  const cleanedName = cleanName(englishName || rawName);
  const channelName = firstString(englishName, rawName, 'Unknown channel');
  const artist = cleanedName && !generic(cleanedName)
    ? cleanedName
    : (channelName && !generic(channelName) ? channelName : 'Hololive Official');
  return {
    id,
    title: firstString(item.title, id),
    artist,
    artists: [artist],
    channelName,
    channelId: firstString(channel.id, item.channel_id),
    // Schema migration: use YouTube's publish date for release ordering; availability is a fallback.
    releaseDate: firstDate(item.published_at, item.available_at, item.start_actual, item.start_scheduled),
    publishedAt: firstDate(item.published_at),
    viewCount: safeCount(item.view_count, item.viewCount, item.views, item.statistics?.viewCount),
    duration: safeCount(item.duration) || null,
    songType: TOPIC_TYPES[topic] || 'original',
    source: 'Holodex',
  };
}

function normMatch(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase()
    .replace(/[\s·・•_\-‐‑–—|｜()[\]{}「」『』【】<>《》]+/g, ' ').trim();
}
function japaneseAliases(value) {
  return [...new Set(String(value || '').match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]{2,}/gu) || [])]
    .filter(alias => !/ホロライブ|ホロスターズ|公式|チャンネル|生放送|配信|歌ってみた|オリジナル曲/.test(alias));
}
function addAlias(roster, artist, alias) {
  const canonical = String(artist || '').trim();
  const raw = String(alias || '').trim();
  if (!canonical || !raw || generic(canonical)) return;
  const normalized = normMatch(raw);
  if (normalized.length < 2 || generic(raw)) return;
  if (!roster.has(canonical)) roster.set(canonical, new Set());
  roster.get(canonical).add(normalized);
}
export function assignArtistCredits(rawItems, songs) {
  const roster = new Map();
  for (const item of rawItems) {
    const channel = item?.channel && typeof item.channel === 'object' ? item.channel : {};
    const englishName = firstString(channel.english_name, channel.englishName);
    const rawName = firstString(channel.name, englishName);
    const canonical = cleanName(englishName || rawName);
    if (!canonical || generic(canonical)) continue;
    addAlias(roster, canonical, canonical);
    addAlias(roster, canonical, englishName);
    addAlias(roster, canonical, cleanName(rawName));
    for (const alias of japaneseAliases(rawName)) addAlias(roster, canonical, alias);
  }
  const entries = [...roster.entries()]
    .map(([artist, aliases]) => ({ artist, aliases: [...aliases].sort((a, b) => b.length - a.length) }))
    .sort((a, b) => Math.max(...b.aliases.map(x => x.length)) - Math.max(...a.aliases.map(x => x.length)));
  return songs.map(song => {
    const normalizedTitle = normMatch(song.title);
    const found = new Set(song.artist && !generic(song.artist) ? [song.artist] : []);
    for (const entry of entries) {
      if (entry.aliases.some(alias => alias.length >= 3 && normalizedTitle.includes(alias))) found.add(entry.artist);
    }
    if (!found.size) found.add(song.artist || 'Hololive Official');
    const artists = [...found].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    return { ...song, artists, artist: artists[0] || song.artist || 'Hololive Official' };
  });
}
export function deduplicateSongs(songs) {
  const byId = new Map();
  for (const song of songs) {
    if (!song || !/^[\w-]{11}$/.test(song.id || '')) continue;
    const existing = byId.get(song.id);
    if (!existing) { byId.set(song.id, song); continue; }
    const oldDate = Date.parse(existing.releaseDate || '') || 0;
    const newDate = Date.parse(song.releaseDate || '') || 0;
    const songType = existing.songType === 'cover' || song.songType === 'cover' ? 'cover' : 'original';
    const shouldReplace = ((!existing.title || existing.title === existing.id) && song.title) || newDate > oldDate;
    byId.set(song.id, {
      ...(shouldReplace ? { ...existing, ...song } : existing),
      songType,
    });
  }
  return [...byId.values()].sort((a, b) =>
    (Date.parse(b.releaseDate || '') || 0) - (Date.parse(a.releaseDate || '') || 0) || a.title.localeCompare(b.title));
}
function sourceId(item) {
  return typeof item?.id === 'string' && /^[\w-]{11}$/.test(item.id.trim()) ? item.id.trim() : '';
}

/**
 * Full mode scans every matching page. Incremental mode scans newest-first and
 * stops when a page contains only IDs already present in the saved catalogue.
 */
export async function fetchAllHolodexResults(apiKey, { mode = 'full', knownIds = new Set(), topic = 'Original_Song' } = {}) {
  if (!['full', 'incremental'].includes(mode)) throw new Error('Unknown refresh mode: ' + mode);
  if (!Object.hasOwn(TOPIC_TYPES, topic)) throw new Error('Unknown Holodex topic: ' + topic);
  const rawItems = [];
  const pageStartIds = new Set();
  let reportedTotal = null;
  let offset = 0;
  let pages = 0;
  let stoppedAtKnownPage = false;

  while (true) {
    if (offset >= MAX_SONGS) {
      throw new Error('Catalogue exceeded ' + MAX_SONGS + ' results safety guard; existing catalogue was not overwritten.');
    }
    pages += 1;
    const payload = {
      sort: 'newest', target: ['stream'], conditions: [],
      topic: [topic], org: ['Hololive'],
      paginated: true, offset, limit: PAGE_SIZE,
    };
    const data = await fetchJson(HOLODEX_SEARCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-APIKEY': apiKey },
      body: JSON.stringify(payload),
    }, 'Holodex ' + topic + ' catalogue page ' + pages);

    if (!data || !Array.isArray(data.items)) {
      throw new Error('Holodex response on page ' + pages + ' did not contain items[].');
    }
    const page = data.items;
    if (page.length && sourceId(page[0])) {
      if (pageStartIds.has(sourceId(page[0]))) {
        throw new Error('Holodex repeated a previous page at offset ' + offset + '; refusing a partial catalogue.');
      }
      pageStartIds.add(sourceId(page[0]));
    }
    if (data.total !== null && data.total !== undefined &&
        Number.isFinite(Number(data.total)) && Number(data.total) >= 0) reportedTotal = Number(data.total);
    if (reportedTotal !== null && reportedTotal > MAX_SONGS) {
      throw new Error('Holodex reports ' + reportedTotal + ' results, beyond safety guard ' + MAX_SONGS + '; catalogue not overwritten.');
    }

    rawItems.push(...page);
    console.log('Fetched page ' + pages + ': ' + page.length + ' records (' + rawItems.length +
      (reportedTotal === null ? '' : ' / ' + reportedTotal) + ' raw records).');
    offset += page.length;
    if (page.length === 0 || page.length < PAGE_SIZE) break;

    if (mode === 'incremental') {
      const usableIds = page.map(sourceId).filter(Boolean);
      const hasNewId = usableIds.some(id => !knownIds.has(id));
      if (usableIds.length > 0 && !hasNewId) {
        stoppedAtKnownPage = true;
        console.log('Reached a page of already-known video IDs; stopping incremental scan.');
        break;
      }
    } else if (reportedTotal !== null && offset >= reportedTotal) {
      break;
    }

    await delay(mode === 'full' ? PAGE_DELAY_FULL_MS : PAGE_DELAY_INCREMENTAL_MS);
  }

  if (mode === 'full' && reportedTotal !== null && rawItems.length < reportedTotal) {
    throw new Error('Holodex reported ' + reportedTotal + ' records but returned only ' + rawItems.length +
      '; refusing to publish an incomplete catalogue.');
  }
  return { rawItems, reportedTotal, pages, stoppedAtKnownPage, complete: mode === 'full' };
}

async function fetchYouTubeViewCounts(ids, key) {
  const views = new Map();
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.searchParams.set('part', 'statistics');
    url.searchParams.set('id', batch.join(','));
    url.searchParams.set('key', key);
    const data = await fetchJson(url, {}, 'YouTube public-video statistics');
    for (const item of data.items || []) {
      const count = safeCount(item.statistics?.viewCount);
      if (count !== null) views.set(item.id, count);
    }
    if (i + 50 < ids.length) await delay(150);
  }
  return views;
}

export function buildCatalogue(rawItems, { generatedAt = new Date().toISOString(), pages = 0, reportedTotal = null, topic = 'Original_Song' } = {}) {
  if (!Object.hasOwn(TOPIC_TYPES, topic)) throw new Error('Unknown Holodex topic: ' + topic);
  const usable = rawItems.map(item => normalizeRecord(item, { topic })).filter(Boolean);
  const credited = assignArtistCredits(rawItems, usable);
  const songs = deduplicateSongs(credited);
  return {
    schemaVersion: 1,
    generatedAt,
    source: 'Holodex API v2',
    query: { org: 'Hololive', topic, target: ['stream'] },
    total: songs.length,
    sourceTotal: reportedTotal,
    pagesFetched: pages,
    songs,
  };
}

function readExistingCatalogue() {
  try {
    const parsed = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
    if (parsed && Array.isArray(parsed.songs)) return parsed;
  } catch {
    // Missing/invalid old data is treated as an empty initial import.
  }
  return {
    schemaVersion: 1, generatedAt: null, lastFullReconciledAt: null,
    source: 'Holodex API v2',
    query: { org: 'Hololive', topics: Object.keys(TOPIC_TYPES), target: ['stream'] },
    total: 0, sourceTotal: null, sourceTotalByTopic: {}, pagesFetched: 0, songs: [],
  };
}
function mergeSongs(existingSongs, incomingSongs, { preserveMissing = true } = {}) {
  const incomingById = new Map(incomingSongs.map(song => [song.id, song]));
  const result = [];
  for (const existing of existingSongs) {
    const incoming = incomingById.get(existing.id);
    if (incoming) {
      result.push({ ...existing, ...incoming, viewCount: incoming.viewCount ?? existing.viewCount ?? null });
      incomingById.delete(existing.id);
    } else if (preserveMissing) {
      // Retain historical entries when a source scan temporarily stops returning them.
      result.push(existing);
    }
  }
  result.push(...incomingById.values());
  return deduplicateSongs(result);
}
function stableSongs(songs) {
  return JSON.stringify([...songs].sort((a, b) => a.id.localeCompare(b.id)));
}
function modeFromArgs() {
  if (process.argv.includes('--full')) return 'full';
  const equalsArg = process.argv.find(value => value.startsWith('--mode='));
  if (equalsArg) return equalsArg.slice('--mode='.length);
  const index = process.argv.indexOf('--mode');
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return 'incremental';
}

async function main() {
  const apiKey = requireEnv('HOLODEX_API_KEY');
  const mode = modeFromArgs();
  if (!['incremental', 'full'].includes(mode)) {
    throw new Error('Invalid mode "' + mode + '". Use --mode=incremental or --mode=full.');
  }

  const existing = readExistingCatalogue();
  const oldSongs = existing.songs;
  const topicConfigs = [
    { topic: 'Original_Song', songType: 'original' },
    { topic: 'Music_Cover', songType: 'cover' },
  ];
  // Older catalogues predate songType and contain only Original_Song results.
  const knownIdsByTopic = new Map(topicConfigs.map(({ topic, songType }) => [
    topic,
    new Set(oldSongs.filter(song =>
      (song.songType === 'cover' ? 'cover' : 'original') === songType
    ).map(song => song.id)),
  ]));
  const globallyKnownIds = new Set(oldSongs.map(song => song.id));
  const startedAt = new Date().toISOString();
  console.log('Refreshing Hololive Original_Song + Music_Cover catalogue (' + mode + ' mode)…');
  console.log('Existing catalogue: ' + oldSongs.length + ' videos.');

  const scans = [];
  for (const { topic, songType } of topicConfigs) {
    const fetched = await fetchAllHolodexResults(apiKey, {
      mode, knownIds: knownIdsByTopic.get(topic), topic,
    });
    const catalogue = buildCatalogue(fetched.rawItems, {
      generatedAt: startedAt, pages: fetched.pages, reportedTotal: fetched.reportedTotal, topic,
    });
    scans.push({ topic, songType, fetched, catalogue });
    console.log(topic + ' scan: ' + fetched.rawItems.length + ' records, ' +
      catalogue.songs.length + ' playable entries.');
  }

  const scannedSongs = deduplicateSongs(scans.flatMap(scan => scan.catalogue.songs));
  const fetchedPages = scans.reduce((sum, scan) => sum + scan.fetched.pages, 0);
  const sourceTotalByTopic = Object.fromEntries(scans.map(scan => [
    scan.topic, scan.fetched.reportedTotal ?? existing.sourceTotalByTopic?.[scan.topic] ?? null,
  ]));
  const combinedSourceTotal = Object.values(sourceTotalByTopic).reduce(
    (sum, value) => sum + (Number.isFinite(Number(value)) ? Number(value) : 0), 0,
  );

  let incomingSongs = scannedSongs;
  if (mode === 'incremental') {
    incomingSongs = scannedSongs.filter(song => {
      const topic = song.songType === 'cover' ? 'Music_Cover' : 'Original_Song';
      return !knownIdsByTopic.get(topic).has(song.id);
    });
    console.log('New or newly classified video IDs found: ' + incomingSongs.length + '.');
  }

  let mergedSongs = mode === 'full'
    ? mergeSongs(oldSongs, scannedSongs, { preserveMissing: true })
    : mergeSongs(oldSongs, incomingSongs, { preserveMissing: true });

  const youtubeKey = process.env.YOUTUBE_DATA_API_KEY?.trim();
  if (youtubeKey) {
    const idsToRefresh = mode === 'full'
      ? scannedSongs.map(song => song.id)
      : mergedSongs.filter(song => !globallyKnownIds.has(song.id) && song.viewCount === null).map(song => song.id);
    if (idsToRefresh.length > 0) {
      try {
        const freshCounts = await fetchYouTubeViewCounts(idsToRefresh, youtubeKey);
        mergedSongs = mergedSongs.map(song =>
          freshCounts.has(song.id) ? { ...song, viewCount: freshCounts.get(song.id) } : song);
        console.log('Refreshed public view counts for ' + freshCounts.size + ' videos.');
      } catch (error) {
        console.warn('YouTube statistics refresh failed; keeping existing counts: ' + error.message);
      }
    } else {
      console.log('No new/missing view counts to fetch; skipping YouTube statistics requests.');
    }
  } else {
    console.log('YOUTUBE_DATA_API_KEY not set; popularity statistics refresh skipped.');
  }

  const songDataChanged = stableSongs(oldSongs) !== stableSongs(mergedSongs);
  const generatedAt = songDataChanged || !existing.generatedAt ? startedAt : existing.generatedAt;
  const catalogue = {
    schemaVersion: 1,
    generatedAt,
    lastFullReconciledAt: mode === 'full' ? startedAt : (existing.lastFullReconciledAt || null),
    lastMode: mode === 'incremental' && !songDataChanged ? (existing.lastMode || mode) : mode,
    source: 'Holodex API v2',
    query: { org: 'Hololive', topics: Object.keys(TOPIC_TYPES), target: ['stream'] },
    total: mergedSongs.length,
    sourceTotal: combinedSourceTotal || existing.sourceTotal || null,
    sourceTotalByTopic,
    pagesFetched: mode === 'full' ? fetchedPages : (existing.pagesFetched || fetchedPages),
    songs: mergedSongs,
  };

  console.log('Refresh summary: mode=' + mode + '; scanned=' + scans.reduce((sum, scan) => sum + scan.fetched.rawItems.length, 0) +
    '; pages=' + fetchedPages + '; catalogue=' + catalogue.total + '; changed=' + songDataChanged + '.');
  if (process.env.DRY_RUN === '1' || process.argv.includes('--dry-run')) {
    console.log('Dry run complete. No catalogue file written.');
    return;
  }

  const output = JSON.stringify(catalogue, null, 2) + '\n';
  const temp = OUTPUT_PATH + '.tmp';
  fs.writeFileSync(temp, output, 'utf8');
  JSON.parse(fs.readFileSync(temp, 'utf8'));
  fs.renameSync(temp, OUTPUT_PATH);
  console.log('Catalogue saved: ' + catalogue.total + ' songs; ' + mode + ' refresh completed.');
}

if (process.argv[1] && import.meta.url === new URL('file://' + path.resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error('Catalogue refresh failed:', error.stack || error);
    process.exitCode = 1;
  });
}
