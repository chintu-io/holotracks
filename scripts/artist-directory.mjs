/**
 * Helpers shared by the static artist-avatar builder and its unit tests.
 * Artist credits come from songs.json; official talent artwork is preferred
 * separately in the browser, while other artists can use their own channel ID.
 */
const CHANNEL_LABEL_ALIASES = new Map([
  // The catalogue credit omits the official channel suffix.
  ['asobimawaritai', 'asobimawari'],
]);

export function normalizeArtistKey(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\s·・•_\-‐‑–—|｜()[\]{}「」『』【】<>《》]+/g, ' ')
    .trim()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

export function validYoutubeChannelId(value) {
  return typeof value === 'string' && /^UC[A-Za-z0-9_-]{22}$/.test(value);
}

function creditsFor(song) {
  const raw = Array.isArray(song?.artists) && song.artists.length
    ? song.artists
    : [song?.artist || song?.channelName || 'Unknown artist'];
  return [...new Set(raw.map(value => String(value || '').trim()).filter(Boolean))];
}

/**
 * Build an alphabetical directory of every distinct catalogue credit.
 * Channel IDs are only associated with the same channel-name identity (plus
 * explicit aliases), never with unrelated artists from a collaboration.
 */
export function collectArtistDirectory(songs, talents = []) {
  const counts = new Map();
  const namesByKey = new Map();
  const channelVotes = new Map();
  const officialKeys = new Set(
    (Array.isArray(talents) ? talents : [])
      .map(talent => normalizeArtistKey(talent?.name))
      .filter(Boolean),
  );

  for (const song of Array.isArray(songs) ? songs : []) {
    for (const name of creditsFor(song)) {
      counts.set(name, (counts.get(name) || 0) + 1);
      const key = normalizeArtistKey(name);
      if (key && !namesByKey.has(key)) namesByKey.set(key, name);
    }

    const channelKey = normalizeArtistKey(song?.channelName);
    const channelId = song?.channelId;
    if (!channelKey || !validYoutubeChannelId(channelId)) continue;

    const creditKey = CHANNEL_LABEL_ALIASES.get(channelKey) || channelKey;
    const canonicalName = namesByKey.get(creditKey);
    if (!canonicalName) continue;

    let candidates = channelVotes.get(canonicalName);
    if (!candidates) {
      candidates = new Map();
      channelVotes.set(canonicalName, candidates);
    }
    candidates.set(channelId, (candidates.get(channelId) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([name, count]) => {
      const candidates = [...(channelVotes.get(name) || new Map()).entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      return {
        name,
        count,
        channelId: candidates[0]?.[0] || '',
        official: officialKeys.has(normalizeArtistKey(name)),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}
