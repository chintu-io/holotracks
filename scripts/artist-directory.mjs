/**
 * Shared artist directory rules for the browser and artwork manifest builder.
 * Credits from channel metadata can be people, groups, organizations or projects.
 * Keep genuine credits even when no portrait is available.
 */
const CHANNEL_LABEL_ALIASES = new Map([
  ['asobimawaritai', 'asobimawari'],
  // These catalogue credits use a shortened display name from the channel name.
  ['peanutskun', 'peanuts'],
  ['seitenchannel', 'seiten'],
  ['unitbpredebut', 'unitbpre'],
]);

const NON_ARTIST_LABELS = new Set([
  'hololiveofficial', 'hololiveproduction', 'hololive', 'hololiveenglish',
  'hololiveindonesia', 'hololiveregloss', 'hololiveflowglow',
  'hololiveofficialchannel', 'covercorp', 'covercorporation', 'holoearth',
  'hololivealternative', 'holostars', 'holostarsenglish', 'holostarsofficial',
]);

export function normalizeArtistKey(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\s·・•_\-‐‑–—|｜()[\]{}「」『』【】<>《》]+/g, ' ')
    .trim()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

export function isNonArtistLabel(value) {
  const key = normalizeArtistKey(value);
  if (!key) return true;
  return NON_ARTIST_LABELS.has(key) ||
    /^(?:hololive|holostars|covercorp|covercorporation)(?:official|production|english|indonesia|regloss|flowglow|channel|ch)?$/.test(key);
}

const COMBINED_OFFICIAL_CREDITS = new Map([
  ['fuwawamococoabyssgard', ['Fuwawa Abyssgard', 'Mococo Abyssgard']],
  ['fuwawaandmococoabyssgard', ['Fuwawa Abyssgard', 'Mococo Abyssgard']],
  ['fuwawamococo', ['Fuwawa Abyssgard', 'Mococo Abyssgard']],
  ['fuwawaandmococo', ['Fuwawa Abyssgard', 'Mococo Abyssgard']],
  ['fuwamoco', ['Fuwawa Abyssgard', 'Mococo Abyssgard']],
]);

/**
 * Expand the known FUWAMOCO duo credit only when both members are present in
 * the official roster; otherwise preserve the source text unchanged.
 */
export function expandKnownArtistCredits(value, talents = []) {
  const raw = String(value || '').trim();
  if (!raw) return [];
  const pair = COMBINED_OFFICIAL_CREDITS.get(normalizeArtistKey(raw));
  if (!pair) return [raw];

  const byKey = new Map((Array.isArray(talents) ? talents : [])
    .map(talent => {
      const name = typeof talent === 'string' ? talent : talent?.name;
      return [normalizeArtistKey(name), name];
    })
    .filter(([key, name]) => key && typeof name === 'string' && name.trim()));
  const resolved = pair.map(name => byKey.get(normalizeArtistKey(name)));
  return resolved.every(Boolean) ? [...new Set(resolved)] : [raw];
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
 * Build an alphabetical directory of distinct catalogue artist credits.
 * Organization-wide/channel/project labels are omitted from the artist list.
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

  const catalogueSongs = Array.isArray(songs) ? songs : [];
  for (const song of catalogueSongs) {
    const seenInSong = new Set();
    for (const rawName of creditsFor(song)) {
      for (const name of expandKnownArtistCredits(rawName, talents)) {
        if (isNonArtistLabel(name)) continue;
        const key = normalizeArtistKey(name);
        if (!key || seenInSong.has(key)) continue;
        seenInSong.add(key);
        counts.set(name, (counts.get(name) || 0) + 1);
        if (!namesByKey.has(key)) namesByKey.set(key, name);
      }
    }
  }

  for (const song of catalogueSongs) {
    const channelKey = normalizeArtistKey(song?.channelName);
    const channelId = song?.channelId;
    if (!channelKey || !validYoutubeChannelId(channelId)) continue;

    const creditKey = CHANNEL_LABEL_ALIASES.get(channelKey) || channelKey;
    const canonicalName = namesByKey.get(creditKey);
    if (!canonicalName || isNonArtistLabel(canonicalName)) continue;

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
