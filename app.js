'use strict';

(() => {
  const PAGE_ROWS = 10;
  const FRESH_WINDOW_DAYS = 180;
  const BANNER_ROTATE_MS = 7000;
  const ARTIST_IMAGES = {
    'Hoshimachi Suisei': 'https://hololive.hololivepro.com/wp-content/uploads/2020/06/Hoshimachi-Suisei_pr-img_01.png',
    'Sakura Miko': 'https://hololive.hololivepro.com/wp-content/uploads/2020/06/Sakura-Miko_pr-img_01.webp',
    'Houshou Marine': 'https://hololive.hololivepro.com/wp-content/uploads/2020/06/Houshou-Marine_pr-img_01.png',
    'Mori Calliope': 'https://hololive.hololivepro.com/wp-content/uploads/2020/07/Mori-Calliope_megane_07.png',
    'Shirakami Fubuki': 'https://hololive.hololivepro.com/wp-content/uploads/2020/06/Shirakami-Fubuki_pr-img_01.webp',
    'Usada Pekora': 'https://hololive.hololivepro.com/wp-content/uploads/2020/06/Usada-Pekora_pr-img_01.webp',
    'Inugami Korone': 'https://hololive.hololivepro.com/wp-content/uploads/2020/06/Inugami-Korone_pr-img_01.png',
    'Nekomata Okayu': 'https://hololive.hololivepro.com/wp-content/uploads/2020/06/Nekomata-Okayu_pr-img_01.png',
    'Ookami Mio': 'https://hololive.hololivepro.com/wp-content/uploads/2020/06/Ookami-Mio_pr-img_01.webp',
    'Shiranui Flare': 'https://hololive.hololivepro.com/wp-content/uploads/2020/06/Shiranui-Flare_pr-img_01.png',
    'AZKi': 'https://hololive.hololivepro.com/wp-content/uploads/2020/06/AZKi_pr-img_01.webp',
    'Takanashi Kiara': 'https://hololive.hololivepro.com/wp-content/uploads/2020/07/Takanashi-Kiara_pr-img_01.webp',
    'Tokino Sora': 'https://hololive.hololivepro.com/wp-content/uploads/2020/06/Tokino-Sora_pr-img_01.webp',
    'Nakiri Ayame': 'https://hololive.hololivepro.com/wp-content/uploads/2020/06/Nakiri-Ayame_pr-img_01.webp',
    'Tokoyami Towa': 'https://hololive.hololivepro.com/wp-content/uploads/2020/06/Tokoyami-Towa_pr-img_01.webp',
  };
  const KEYS = {
    favorites: 'holotracks:favorites:v1',
    playlists: 'holotracks:playlists:v1',
    shuffle: 'holotracks:shuffle:v1',
    repeat: 'holotracks:repeat:v1',
    bannerDeck: 'holotracks:banner-deck:v1',
    sidebarCollapsed: 'holotracks:sidebar-collapsed:v2',
    lastBanner: 'holotracks:banner-last:v1',
  };
  const ids = [
    'search-input','search-button','global-search-form','artist-search','artist-filters','artist-count','show-all-artists',
    'talent-picker-toggle','talent-picker-count','talent-picker-dialog','talent-picker-close','talent-picker-done','talent-picker-selected','browse-all-talents',
    'clear-filters','nav-total','fav-total','hero-song-count','hero-artist-count','hero-updated',
    'source-status','catalogue-title-text','results-count','results-caption','sort-select',
    'type-all-count','type-original-count','type-cover-count','nav-original-total','nav-cover-total',
    'song-list','pagination','empty-state','empty-title','empty-copy','empty-reset','notice',
    'play-all','play-random','favorites-shortcut','mobile-filter-toggle',
    'mobile-player-toggle','sidebar','player-column','player-hide','youtube-player','youtube-fallback',
    'playing-thumb','playing-art-placeholder','playing-title','playing-artist','playing-favorite',
    'player-state','watch-youtube','play-pause','previous-song','next-song','queue-shuffle',
    'queue-repeat','queue-count','queue-list','clear-queue','create-playlist','playlist-list',
    'playlist-select','save-queue','play-selected-playlist','playlist-dialog','playlist-form','cancel-playlist',
    'playlist-name','talent-strip','sidebar-collapse','mobile-mini-player','mobile-mini-thumb','mobile-mini-expand','mobile-mini-title','mobile-mini-artist','mobile-mini-toggle','mobile-mini-next','hero-talent-art',
  ];
  const el = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
  const readJSON = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  };
  const saveJSON = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch { showNotice('Browser storage is unavailable; the latest changes may not persist.'); }
  };
  const LATEST_MIX_PLAYLIST_ID = 'holotracks-smart-latest-50-originals-covers';
  const LATEST_MIX_PLAYLIST_KIND = 'latest-50-originals-covers';
  const LATEST_MIX_PLAYLIST_NAME = 'Latest 50 Originals & Covers';

  const state = {
    songs: [], filtered: [], currentPage: 1, talents: [], artistPortraits: new Map(),
    selectedArtists: new Set(),
    query: '', artistQuery: '', artistCategory: 'all',
    view: 'all', songType: 'all',
    activePlaylist: null,
    favorites: new Set(readJSON(KEYS.favorites, [])),
    playlists: readJSON(KEYS.playlists, []),
    queue: [], currentId: null,
    shuffle: readJSON(KEYS.shuffle, false),
    repeat: readJSON(KEYS.repeat, false),
    player: null, playerReady: false, pendingVideoId: null,
    usingFreshFallback: false,
  };

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[character]));
  }
  function showNotice(message) {
    el.notice.textContent = message;
    el.notice.hidden = !message;
  }
  function titleOf(item) { return item.title || item.id; }
  function artistsOf(item) {
    return Array.isArray(item.artists) && item.artists.length
      ? item.artists
      : [item.artist || item.channelName || 'Unknown artist'];
  }
  function songById(id) { return state.songs.find(item => item.id === id); }
  function deduplicateCatalogue(songs) {
    const byId = new Map();
    for (const song of songs) {
      if (!song || typeof song.id !== 'string' || !song.id.trim()) continue;
      const existing = byId.get(song.id);
      if (!existing) {
        byId.set(song.id, { ...song });
      } else if (song.songType === 'cover') {
        // A video tagged as both topics should keep the catalogue's cover label.
        existing.songType = 'cover';
      }
    }
    return [...byId.values()];
  }
  function dateValue(item) {
    const value = Date.parse(item.releaseDate || item.publishedAt || item.availableAt || '');
    return Number.isFinite(value) ? value : 0;
  }
  function dateText(item) {
    const value = dateValue(item);
    return value
      ? new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(value)
      : 'Date unknown';
  }
  function thumbnail(item) {
    return 'https://i.ytimg.com/vi/' + encodeURIComponent(item.id) + '/hqdefault.jpg';
  }
  function formatViews(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return '';
    if (number >= 1e9) return (number / 1e9).toFixed(1) + 'B views';
    if (number >= 1e6) return (number / 1e6).toFixed(1) + 'M views';
    if (number >= 1e3) return (number / 1e3).toFixed(1) + 'K views';
    return number + ' views';
  }
  function normalized(value) {
    return String(value || '').normalize('NFKC').toLocaleLowerCase()
      .replace(/[\s·・•_\-‐‑–—|｜()[\]{}「」『』【】<>《》]+/g, ' ').trim();
  }

  function safeTalentImage(value) {
    try {
      const url = new URL(value);
      return url.origin === 'https://hololive.hololivepro.com' &&
        url.pathname.includes('/wp-content/uploads/') &&
        /\.(?:png|webp|jpe?g|avif)$/i.test(url.pathname) ? url.href : '';
    } catch { return ''; }
  }
  function safeArtistPortrait(value) {
    const official = safeTalentImage(value);
    if (official) return official;
    return /^assets\/artist-avatars\/UC[A-Za-z0-9_-]{22}\.(?:webp|png|jpe?g)$/i.test(String(value || ''))
      ? value
      : '';
  }
  function fallbackTalentRoster() {
    return Object.entries(ARTIST_IMAGES).map(([name, image]) => ({
      slug: normalized(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      name, image, profileUrl: 'https://hololive.hololivepro.com/en/talents/',
    }));
  }
  function shuffled(values) {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index--) {
      const swap = Math.floor(Math.random() * (index + 1));
      [result[index], result[swap]] = [result[swap], result[index]];
    }
    return result;
  }
  function pickBannerTalent() {
    const roster = state.talents.filter(item => item.slug && safeTalentImage(item.bannerImage || item.image));
    if (!roster.length) return null;
    const bySlug = new Map(roster.map(item => [item.slug, item]));
    let deck = readJSON(KEYS.bannerDeck, []);
    if (!Array.isArray(deck)) deck = [];
    deck = deck.filter((slug, index) => bySlug.has(slug) && deck.indexOf(slug) === index);

    // Rotate one featured talent per visit, exhausting the shuffled deck before reshuffling.
    if (!deck.length) {
      deck = shuffled(roster.map(item => item.slug));
      const previous = readJSON(KEYS.lastBanner, []);
      const previousSlugs = Array.isArray(previous)
        ? previous
        : (typeof previous === 'string' ? [previous] : []);
      if (deck.length > 1 && previousSlugs.includes(deck[0])) {
        const replacementIndex = deck.findIndex(slug => !previousSlugs.includes(slug));
        if (replacementIndex > 0) [deck[0], deck[replacementIndex]] = [deck[replacementIndex], deck[0]];
      }
    }

    const pickedSlug = deck.shift();
    saveJSON(KEYS.bannerDeck, deck);
    saveJSON(KEYS.lastBanner, pickedSlug);
    return bySlug.get(pickedSlug) || roster[0];
  }
  function renderHeroTalentArt({ transition = false } = {}) {
    const stage = el['hero-talent-art'];
    if (!stage) return;
    const previous = stage.querySelector('.stage-featured:not(.is-exiting)');
    const talent = pickBannerTalent();
    if (!talent) return;

    const image = document.createElement('img');
    image.className = 'stage-talent stage-featured is-entering';
    const imageSource = safeTalentImage(talent.bannerImage) ||
      safeTalentImage(ARTIST_IMAGES[talent.name]) || safeTalentImage(talent.image);
    image.alt = talent.name + ' — featured Hololive talent';
    image.loading = 'eager';
    image.decoding = 'async';
    image.onerror = () => {
      image.remove();
      if (previous) previous.classList.remove('is-exiting');
    };
    image.onload = () => {
      if (!transition || !previous) {
        image.classList.remove('is-entering');
        image.classList.add('is-visible');
        if (previous) previous.remove();
        return;
      }
      window.requestAnimationFrame(() => {
        image.classList.remove('is-entering');
        image.classList.add('is-visible');
        previous.classList.add('is-exiting');
        window.setTimeout(() => previous.remove(), 720);
      });
    };
    stage.appendChild(image);
    image.src = imageSource;
  }
  let heroRotationTimer = null;
  function startHeroRotation() {
    if (heroRotationTimer !== null) window.clearInterval(heroRotationTimer);
    heroRotationTimer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      renderHeroTalentArt({ transition: true });
    }, BANNER_ROTATE_MS);
  }
  const TALENT_SET_SIZE = 10;
  const TALENT_ROTATE_MS = 60000;
  const TALENT_FADE_MS = 650;
  let talentSpotlightRoster = [];
  let talentSpotlightPage = 0;
  let talentSpotlightTimer = null;
  let talentSpotlightFadeTimer = null;

  function visibleSpotlightNames() {
    return new Set(
      [...el['talent-strip'].querySelectorAll('[data-spotlight-artist]')]
        .map(card => artistKey(card.dataset.spotlightArtist)),
    );
  }

  function shuffleSpotlightAvoiding(previousNames) {
    const roster = state.talents.filter(item => item.name && safeTalentImage(item.image));
    let candidate = shuffled(roster);
    // Avoid a visually repetitive transition at the end of the cycle.
    for (let attempt = 0; attempt < 16 && candidate.length > TALENT_SET_SIZE; attempt += 1) {
      const firstSet = candidate.slice(0, TALENT_SET_SIZE);
      if (!firstSet.some(item => previousNames.has(artistKey(item.name)))) break;
      candidate = shuffled(roster);
    }
    return candidate;
  }

  function renderTalentSpotlightSet() {
    const strip = el['talent-strip'];
    if (!strip) return;
    const palette = ['#3b5993','#7c3b6e','#8d4a36','#704367','#327b99','#3d6d9e','#8c5c32','#75498f','#774337','#a46d36','#69476d','#a84c36'];
    const start = talentSpotlightPage * TALENT_SET_SIZE;
    const visible = talentSpotlightRoster.slice(start, start + TALENT_SET_SIZE);

    strip.innerHTML = visible.map((talent, index) =>
      '<button class="talent-card" type="button" data-spotlight-artist="' + escapeHTML(talent.name) +
      '" style="--talent:' + palette[index % palette.length] + '" title="Browse ' + escapeHTML(talent.name) + '">' +
      '<span class="talent-image"><img src="' + escapeHTML(safeTalentImage(talent.image)) +
      '" alt="" loading="eager" decoding="async"><i>' +
      escapeHTML(talent.name.slice(0, 2).toUpperCase()) + '</i></span><strong>' +
      escapeHTML(talent.name) + '</strong></button>'
    ).join('');

    strip.querySelectorAll('img').forEach(image => {
      image.addEventListener('error', () => { image.style.display = 'none'; }, { once: true });
    });
  }

  function rotateTalentSpotlightSet() {
    const strip = el['talent-strip'];
    if (!strip || document.hidden ||
        (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      return;
    }

    if (talentSpotlightFadeTimer !== null) window.clearTimeout(talentSpotlightFadeTimer);
    const currentNames = visibleSpotlightNames();
    strip.classList.add('is-fading');

    talentSpotlightFadeTimer = window.setTimeout(() => {
      const pageCount = Math.max(1, Math.floor(talentSpotlightRoster.length / TALENT_SET_SIZE));
      if (talentSpotlightPage + 1 >= pageCount) {
        talentSpotlightRoster = shuffleSpotlightAvoiding(currentNames);
        talentSpotlightPage = 0;
      } else {
        talentSpotlightPage += 1;
      }

      renderTalentSpotlightSet();
      // Two frames ensure the replacement cards are painted at full opacity
      // rather than blending with the previous set.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        strip.classList.remove('is-fading');
        talentSpotlightFadeTimer = null;
      }));
    }, TALENT_FADE_MS);
  }

  function renderTalentSpotlight() {
    // Randomize the order at startup, then fade between still groups of ten.
    // Using complete groups means all visible sets have a balanced layout;
    // the one remaining talent (when the roster isn't divisible by ten) gets
    // another chance to appear after the next reshuffle.
    talentSpotlightRoster = shuffled(
      state.talents.filter(item => item.name && safeTalentImage(item.image))
    );
    talentSpotlightPage = 0;
    if (talentSpotlightTimer !== null) window.clearInterval(talentSpotlightTimer);
    if (talentSpotlightFadeTimer !== null) window.clearTimeout(talentSpotlightFadeTimer);
    el['talent-strip'].classList.remove('is-fading');
    renderTalentSpotlightSet();
    renderArtists();

    talentSpotlightTimer = window.setInterval(rotateTalentSpotlightSet, TALENT_ROTATE_MS);
  }

  async function loadTalentRoster() {
    try {
      const response = await fetch('data/talents.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      const roster = Array.isArray(data.talents) ? data.talents : [];
      state.talents = roster.filter(item =>
        item && typeof item.slug === 'string' && typeof item.name === 'string' &&
        safeTalentImage(item.image)
      );
    } catch {
      state.talents = [];
    }
    if (!state.talents.length) state.talents = fallbackTalentRoster();
    for (const talent of state.talents) ARTIST_IMAGES[talent.name] = talent.image;
    renderHeroTalentArt();
    renderTalentSpotlight();
    startHeroRotation();
  }

  async function loadArtistPortraitManifest() {
    try {
      const response = await fetch('data/artist-portraits.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      const images = data && data.images && typeof data.images === 'object' ? data.images : {};
      state.artistPortraits = new Map(
        Object.entries(images)
          .map(([name, url]) => [artistKey(name), safeArtistPortrait(url)])
          .filter(([key, url]) => key && url),
      );
    } catch {
      // Local development and failed optional image syncs should still show
      // every artist; the UI renders a neutral music icon when no portrait exists.
      state.artistPortraits = new Map();
    }
  }

  function sortSongs(items) {
    const mode = el['sort-select'].value;
    const list = [...items];
    list.sort((a, b) => {
      if (mode === 'oldest') return dateValue(a) - dateValue(b);
      if (mode === 'title') return titleOf(a).localeCompare(titleOf(b));
      if (mode === 'popular') return (Number(b.viewCount) || -1) - (Number(a.viewCount) || -1);
      return dateValue(b) - dateValue(a);
    });
    return list;
  }
  function isRecent(item) {
    const date = dateValue(item);
    return date > 0 && date >= Date.now() - FRESH_WINDOW_DAYS * 86400000;
  }

  function artistKey(value) {
    return normalized(value).replace(/[^\p{L}\p{N}]/gu, '');
  }
  const ARTIST_ALIASES = {
    suisei: 'Hoshimachi Suisei', miko: 'Sakura Miko', marine: 'Houshou Marine',
    calliope: 'Mori Calliope', fubuki: 'Shirakami Fubuki', pekora: 'Usada Pekora',
    korone: 'Inugami Korone', okayu: 'Nekomata Okayu', mio: 'Ookami Mio',
    flare: 'Shiranui Flare', kiara: 'Takanashi Kiara', sora: 'Tokino Sora',
    ayame: 'Nakiri Ayame', towa: 'Tokoyami Towa', kanata: 'Amane Kanata',
    aqua: 'Minato Aqua', shion: 'Murasaki Shion', gura: 'Gawr Gura',
    fauna: 'Ceres Fauna', mumei: 'Nanashi Mumei', ame: 'Watson Amelia',
    chloe: 'Sakamata Chloe', sana: 'Tsukumo Sana',
  };
  function setSidebarCollapsed(collapsed, persist = true) {
    document.body.classList.toggle('sidebar-collapsed', !!collapsed);
    el['sidebar-collapse'].textContent = collapsed ? '›' : '‹';
    el['sidebar-collapse'].title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
    el['sidebar-collapse'].setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    el['sidebar-collapse'].setAttribute('aria-pressed', String(!!collapsed));
    if (persist) saveJSON(KEYS.sidebarCollapsed, !!collapsed);
  }
  function resolveRosterTalent(name) {
    const target = artistKey(name);
    if (!target) return null;

    const exact = state.talents.find(talent => artistKey(talent.name) === target);
    if (exact) return exact;

    const alias = ARTIST_ALIASES[target];
    if (alias) {
      const aliased = state.talents.find(talent => artistKey(talent.name) === artistKey(alias));
      if (aliased) return aliased;
    }

    // Some channels append a standard label to the talent name. Only accept
    // these known suffixes so guest artists are not misidentified by a fuzzy
    // substring match (for example, "Alpha Betta" becoming "Alpha").
    const suffixes = ['official', 'hololive', 'hololiveproduction', 'channel', 'topic'];
    for (const talent of state.talents) {
      const candidate = artistKey(talent.name);
      if (!candidate || target.length <= candidate.length || !target.startsWith(candidate)) continue;
      if (suffixes.includes(target.slice(candidate.length))) return talent;
    }
    return null;
  }

  function songMatchesSelectedTalents(song) {
    if (!state.selectedArtists.size) return true;
    const selectedKeys = new Set([...state.selectedArtists].map(name => {
      const talent = resolveRosterTalent(name);
      return artistKey(talent?.name || name);
    }));
    for (const credit of artistsOf(song)) {
      if (selectedKeys.has(artistKey(credit))) return true;
      const talent = resolveRosterTalent(credit);
      if (talent && selectedKeys.has(artistKey(talent.name))) return true;
    }
    return false;
  }

  function renderArtists() {
    // Include every current official talent, even with zero catalogue songs,
    // then add every distinct non-roster artist credit.
    const directory = new Map();
    for (const talent of state.talents) {
      if (!talent || typeof talent.name !== 'string' || !safeTalentImage(talent.image)) continue;
      const key = artistKey(talent.name);
      if (key && !directory.has(key)) {
        directory.set(key, { name: talent.name, count: 0, category: 'official' });
      }
    }

    for (const song of state.songs) {
      const creditedThisSong = new Set();
      for (const credit of new Set(artistsOf(song))) {
        const talent = resolveRosterTalent(credit);
        const name = talent?.name || credit;
        const key = artistKey(name);
        if (!key || creditedThisSong.has(key)) continue;
        creditedThisSong.add(key);
        let item = directory.get(key);
        if (!item) {
          item = { name, count: 0, category: 'other' };
          directory.set(key, item);
        }
        item.count += 1;
      }
    }

    const allRows = [...directory.values()]
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    const officialCount = allRows.filter(item => item.category === 'official').length;
    const categoryCounts = {
      all: allRows.length,
      official: officialCount,
      other: allRows.length - officialCount,
    };
    const query = artistKey(state.artistQuery);
    const rows = allRows
      .filter(item => state.artistCategory === 'all' || item.category === state.artistCategory)
      .filter(item => !query || artistKey(item.name).includes(query));

    el['artist-count'].textContent = allRows.length.toLocaleString();
    el['artist-filters'].innerHTML = rows.map(item => {
      const artist = item.name;
      const count = item.count;
      const officialTalent = item.category === 'official' ? resolveRosterTalent(artist) : null;
      const portrait = safeTalentImage(officialTalent?.image) ||
        safeTalentImage(ARTIST_IMAGES[artist]) ||
        safeArtistPortrait(state.artistPortraits.get(artistKey(artist)));
      const portraitMarkup = portrait
        ? '<span class="artist-avatar-frame"><img class="artist-avatar" src="' + escapeHTML(portrait) +
          '" alt="" loading="lazy" decoding="async"><span class="artist-avatar-fallback" aria-hidden="true">♫</span></span>'
        : '<span class="artist-avatar-frame image-unavailable"><span class="artist-avatar-fallback" aria-hidden="true">♫</span></span>';
      const categoryLabel = item.category === 'official' ? 'Official talent' : 'Guest, alumni or other credit';
      return '<label class="artist-check" title="' + escapeHTML(categoryLabel + ': ' + artist) + '">' +
        '<input type="checkbox" data-artist="' + escapeHTML(artist) + '"' +
        (state.selectedArtists.has(artist) ? ' checked' : '') + '>' + portraitMarkup +
        '<span class="artist-name">' + escapeHTML(artist) + '</span><small title="' + count.toLocaleString() +
        ' matching catalogue videos">' + count.toLocaleString() + '</small></label>';
    }).join('') || '<p class="filter-empty">No artists match this category and search. Try another category or name.</p>';

    // Image failures affect only the portrait, never directory membership.
    el['artist-filters'].querySelectorAll('.artist-avatar').forEach(image => {
      image.addEventListener('error', () => {
        image.closest('.artist-avatar-frame')?.classList.add('image-unavailable');
      }, { once: true });
    });

    document.querySelectorAll('[data-artist-category]').forEach(button => {
      const category = button.dataset.artistCategory || 'all';
      button.classList.toggle('is-active', category === state.artistCategory);
      button.setAttribute('aria-pressed', String(category === state.artistCategory));
      const badge = button.querySelector('[data-category-count]');
      if (badge) badge.textContent = (categoryCounts[category] || 0).toLocaleString();
    });

    const selectedCount = state.selectedArtists.size;
    el['talent-picker-count'].textContent = selectedCount ? String(selectedCount) : 'Browse';
    if (selectedCount) {
      el['talent-picker-selected'].textContent =
        selectedCount + ' artist' + (selectedCount === 1 ? '' : 's') + ' selected · matching songs are shown together';
    } else if (state.artistCategory === 'official') {
      el['talent-picker-selected'].textContent = 'Official talents · select one or more to filter songs';
    } else if (state.artistCategory === 'other') {
      el['talent-picker-selected'].textContent = 'Guests, alumni & other credits · select to filter songs';
    } else {
      el['talent-picker-selected'].textContent = 'All artists · no filters applied';
    }
    el['talent-picker-toggle'].classList.toggle('has-selection', selectedCount > 0);
    el['talent-picker-toggle'].setAttribute('aria-label', selectedCount
      ? 'Browse artists; ' + selectedCount + ' selected'
      : 'Browse artist filters');
    document.querySelectorAll('[data-spotlight-artist]').forEach(button => {
      const wanted = normalized(button.dataset.spotlightArtist);
      const selectedName = [...state.selectedArtists].some(name => normalized(name) === wanted);
      button.classList.toggle('selected', selectedName);
    });
  }

    function renderCounts() {
    el['nav-total'].textContent = state.songs.length.toLocaleString();
    el['fav-total'].textContent = state.favorites.size.toLocaleString();
    el['hero-song-count'].textContent = state.songs.length.toLocaleString();
    el['hero-artist-count'].textContent = new Set(state.songs.flatMap(artistsOf)).size.toLocaleString();
    const coverCount = state.songs.filter(item => item.songType === 'cover').length;
    const originalCount = state.songs.length - coverCount;
    el['type-all-count'].textContent = state.songs.length.toLocaleString();
    el['type-original-count'].textContent = originalCount.toLocaleString();
    el['type-cover-count'].textContent = coverCount.toLocaleString();
    el['nav-original-total'].textContent = originalCount.toLocaleString();
    el['nav-cover-total'].textContent = coverCount.toLocaleString();
  }
  function applyFilters() {
    const query = state.query.trim().toLocaleLowerCase();
    const selectedPlaylist = state.playlists.find(playlist => playlist.id === state.activePlaylist);
    let list = state.songs.filter(item => {
      const itemType = item.songType === 'cover' ? 'cover' : 'original';
      if (state.songType !== 'all' && itemType !== state.songType) return false;
      if (state.view === 'favorites' && !state.favorites.has(item.id)) return false;
      if (selectedPlaylist && !selectedPlaylist.songIds.includes(item.id)) return false;
      if (!songMatchesSelectedTalents(item)) return false;
      const searchable = [titleOf(item), item.titleOriginal, item.titleJapanese, item.channelName, ...artistsOf(item)]
        .filter(Boolean).join(' ').toLocaleLowerCase();
      return !query || searchable.includes(query);
    });

    list = sortSongs(list);
    state.usingFreshFallback = false;
    if (state.view === 'fresh') {
      const recent = list.filter(isRecent);
      if (recent.length) {
        list = recent;
      } else {
        list = list.slice(0, 60);
        state.usingFreshFallback = true;
      }
    }
    state.filtered = list;
    state.currentPage = 1;
    renderSongs();
    renderCounts();

    if (state.view === 'favorites') {
      el['catalogue-title-text'].textContent = 'Your favourites';
      el['results-caption'].textContent = 'The Hololive songs you have saved with a little heart.';
    } else if (selectedPlaylist) {
      el['catalogue-title-text'].textContent = selectedPlaylist.name;
      el['results-caption'].textContent = 'Songs saved in this browser mixtape.';
    } else if (state.view === 'fresh') {
      el['catalogue-title-text'].textContent = 'Fresh releases';
      el['results-caption'].textContent = state.usingFreshFallback
        ? 'Showing the newest indexed songs because no dates fell inside the recent-release window.'
        : 'Videos published in the last ' + FRESH_WINDOW_DAYS + ' days, newest first.';
    } else {
      el['catalogue-title-text'].textContent = state.songType === 'cover'
        ? 'Hololive cover songs'
        : state.songType === 'original' ? 'Original songs' : 'All music';
      el['results-caption'].textContent = state.songType === 'cover'
        ? 'Holodex videos tagged as Music_Cover, ready to explore.'
        : state.songType === 'original'
          ? 'Holodex videos tagged as Original_Song, ready to explore.'
          : 'Original songs and fan-performed covers from across the Hololive universe.';
    }
    document.querySelectorAll('[data-view]').forEach(button => {
      button.classList.toggle('active', button.dataset.view === state.view);
    });
    document.querySelectorAll('[data-sidebar-song-type]').forEach(button => {
      const active = state.view === 'all' && !state.activePlaylist && button.dataset.sidebarSongType === state.songType;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    document.querySelectorAll('[data-song-type]').forEach(button => {
      const active = button.dataset.songType === state.songType;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }
  function getPageSize() {
    const template = window.getComputedStyle(el['song-list']).gridTemplateColumns;
    const columns = template && template !== 'none' ? template.trim().split(/\s+/).filter(Boolean).length : 3;
    return Math.max(1, columns) * PAGE_ROWS;
  }

  function renderSongs() {
    const pageSize = getPageSize();
    const totalPages = Math.max(1, Math.ceil(state.filtered.length / pageSize));
    state.currentPage = Math.min(Math.max(1, state.currentPage), totalPages);
    const pageStart = (state.currentPage - 1) * pageSize;
    const visible = state.filtered.slice(pageStart, pageStart + pageSize);
    const html = visible.map(item => {
      const artists = artistsOf(item).join(', ');
      const favorite = state.favorites.has(item.id);
      const songType = item.songType === 'cover' ? 'cover' : 'original';
      const songTypeLabel = songType === 'cover' ? 'COVER' : 'ORIGINAL';
      return '<article class="song-card" data-id="' + escapeHTML(item.id) + '">' +
        '<div class="song-art"><img loading="lazy" src="' + thumbnail(item) + '" alt="Thumbnail for ' +
        escapeHTML(titleOf(item)) + '" onerror="this.style.opacity=\'.12\'">' +
        '<button class="quick-play" data-action="play" data-id="' + escapeHTML(item.id) +
        '" aria-label="Play ' + escapeHTML(titleOf(item)) + '">▶</button></div>' +
        '<div class="song-card-body"><div class="song-title" title="' + escapeHTML(titleOf(item)) + '">' +
        escapeHTML(titleOf(item)) + '</div><div class="song-artist" title="' + escapeHTML(artists) + '">' +
        escapeHTML(artists) + '</div><div class="song-card-meta"><span class="song-kind song-kind-' + songType + '">' +
        songTypeLabel + '</span><span>' + dateText(item) + '</span><span>' + formatViews(item.viewCount) +
        '</span></div><div class="song-card-actions">' +
        '<button class="mini-action" data-action="play" data-id="' + escapeHTML(item.id) + '">▶ Play</button>' +
        '<button class="mini-action ' + (favorite ? 'is-favorite' : '') + '" data-action="favorite" data-id="' +
        escapeHTML(item.id) + '" aria-label="Toggle favourite">' + (favorite ? '♥' : '♡') + ' Save</button>' +
        '<button class="mini-action" data-action="queue" data-id="' + escapeHTML(item.id) + '">＋ Queue</button>' +
        '</div></div></article>';
    }).join('');
    el['song-list'].innerHTML = html;
    el['song-list'].setAttribute('aria-busy', 'false');
    el['empty-state'].hidden = state.filtered.length > 0;
    renderPagination();
    el['results-count'].textContent = state.filtered.length.toLocaleString();
    if (!state.filtered.length) {
      el['empty-title'].textContent = state.view === 'favorites' ? 'No favourites yet' : 'No songs found';
      el['empty-copy'].textContent = state.view === 'fresh'
        ? 'No recent releases matched. Try All songs to browse the full archive.'
        : 'Try a different search or clear some filters.';
    }
  }
  function renderPagination() {
    const container = el['pagination'];
    const total = state.filtered.length;
    const pageSize = getPageSize();
    const totalPages = Math.ceil(total / pageSize);
    if (!container) return;
    if (totalPages <= 1) {
      container.hidden = true;
      container.innerHTML = '';
      return;
    }

    const current = Math.min(Math.max(1, state.currentPage), totalPages);
    const firstIndex = (current - 1) * pageSize + 1;
    const lastIndex = Math.min(current * pageSize, total);
    const candidates = new Set([1, totalPages]);
    for (let page = Math.max(2, current - 2); page <= Math.min(totalPages - 1, current + 2); page++) {
      candidates.add(page);
    }
    const pages = [...candidates].sort((a, b) => a - b);
    const pageButtons = [];
    let previous = 0;
    for (const page of pages) {
      if (previous && page - previous > 1) {
        pageButtons.push('<span class="pagination-ellipsis" aria-hidden="true">…</span>');
      }
      pageButtons.push(
        '<button class="pagination-button pagination-number' + (page === current ? ' active' : '') +
        '" type="button" data-page="' + page + '"' +
        (page === current ? ' aria-current="page" disabled' : '') +
        ' aria-label="Page ' + page + '">' + page + '</button>'
      );
      previous = page;
    }

    container.innerHTML =
      '<div class="pagination-summary" aria-live="polite">Showing ' +
      firstIndex.toLocaleString() + '–' + lastIndex.toLocaleString() + ' of ' +
      total.toLocaleString() + ' songs <span>· Page ' + current.toLocaleString() +
      ' of ' + totalPages.toLocaleString() + '</span></div>' +
      '<div class="pagination-controls">' +
      '<button class="pagination-button pagination-direction" type="button" data-page="1"' +
      (current === 1 ? ' disabled' : '') + ' aria-label="First page" title="First page">«</button>' +
      '<button class="pagination-button pagination-direction" type="button" data-page="' + (current - 1) + '"' +
      (current === 1 ? ' disabled' : '') + ' aria-label="Previous page">‹ <span>Prev</span></button>' +
      pageButtons.join('') +
      '<button class="pagination-button pagination-direction" type="button" data-page="' + (current + 1) + '"' +
      (current === totalPages ? ' disabled' : '') + ' aria-label="Next page"><span>Next</span> ›</button>' +
      '<button class="pagination-button pagination-direction" type="button" data-page="' + totalPages + '"' +
      (current === totalPages ? ' disabled' : '') + ' aria-label="Last page" title="Last page">»</button>' +
      '</div>';
    container.hidden = false;
  }

  function persistFavorites() {
    saveJSON(KEYS.favorites, [...state.favorites]);
    renderCounts();
  }
  function toggleFavorite(id) {
    state.favorites.has(id) ? state.favorites.delete(id) : state.favorites.add(id);
    persistFavorites();
    applyFilters();
    renderPlayerMeta();
  }
  function refreshLatest50Playlist() {
    // Smart mixtape: rebuild from the current catalogue so new releases replace
    // older entries on the next visit. Original songs and covers share one
    // newest-first list, capped at 50 items total.
    const songIds = state.songs
      .filter(item => item.songType === 'original' || item.songType === 'cover')
      .sort((a, b) => dateValue(b) - dateValue(a) || titleOf(a).localeCompare(titleOf(b)))
      .slice(0, 50)
      .map(item => item.id);

    let playlist = state.playlists.find(item =>
      item.id === LATEST_MIX_PLAYLIST_ID || item.smartType === LATEST_MIX_PLAYLIST_KIND
    );
    if (!playlist) {
      // Avoid replacing a user-created mixtape with the same name.
      const nameInUse = state.playlists.some(item =>
        String(item.name || '').toLocaleLowerCase() === LATEST_MIX_PLAYLIST_NAME.toLocaleLowerCase()
      );
      playlist = {
        id: LATEST_MIX_PLAYLIST_ID,
        name: nameInUse ? LATEST_MIX_PLAYLIST_NAME + ' · Auto' : LATEST_MIX_PLAYLIST_NAME,
        songIds: [],
        smartType: LATEST_MIX_PLAYLIST_KIND,
      };
      state.playlists.unshift(playlist);
    }
    playlist.smartType = LATEST_MIX_PLAYLIST_KIND;
    playlist.name = playlist.name || LATEST_MIX_PLAYLIST_NAME;
    playlist.songIds = songIds;

    // Keep the automatic playlist at the top of My Mixtapes.
    state.playlists = [playlist, ...state.playlists.filter(item => item !== playlist)];
    saveJSON(KEYS.playlists, state.playlists);
    return playlist;
  }

  function renderPlaylists() {
    el['playlist-list'].innerHTML = state.playlists.map(playlist => {
      const isSmart = playlist.smartType === LATEST_MIX_PLAYLIST_KIND;
      const count = Array.isArray(playlist.songIds) ? playlist.songIds.length : 0;
      return '<button type="button" class="playlist-row ' + (playlist.id === state.activePlaylist ? 'active' : '') +
        (isSmart ? ' playlist-row-smart' : '') + '" data-playlist="' + escapeHTML(playlist.id) +
        '"><span class="playlist-row-label">♫ ' + escapeHTML(playlist.name) + '</span>' +
        (isSmart ? '<i class="playlist-smart-badge">AUTO</i>' : '') +
        '<small>' + count + '</small></button>';
    }).join('') || '<p class="filter-empty">No mixtapes yet. Use + to create one.</p>';
    el['playlist-select'].innerHTML = '<option value="">Choose playlist…</option>' + state.playlists.map(playlist =>
      '<option value="' + escapeHTML(playlist.id) + '">' + escapeHTML(playlist.name) + '</option>'
    ).join('');
  }

  function playLatest50Playlist(playlist) {
    if (!playlist || !Array.isArray(playlist.songIds) || !playlist.songIds.length) {
      showNotice('The latest-song mixtape is empty until the catalogue has loaded.');
      return;
    }

    state.activePlaylist = playlist.id;
    state.view = 'all';
    state.songType = 'all';
    state.query = '';
    state.selectedArtists.clear();
    el['search-input'].value = '';
    el['sort-select'].value = 'newest';
    renderArtists();

    // This smart mix is intended to play newest-first and loop the whole queue.
    state.shuffle = false;
    state.repeat = true;
    saveJSON(KEYS.shuffle, false);
    saveJSON(KEYS.repeat, true);
    renderPlaylists();
    el['playlist-select'].value = playlist.id;
    applyFilters();
    updatePlayerButtons();
    playSong(playlist.songIds[0], playlist.songIds);
    showNotice('Playing the latest ' + playlist.songIds.length +
      ' originals and covers. Repeat queue is on, so it will start again after the final song.');
  }
    function createPlaylist(name) {
    const clean = name.trim();
    if (!clean) return;
    if (state.playlists.some(playlist => playlist.name.toLocaleLowerCase() === clean.toLocaleLowerCase())) {
      showNotice('A mixtape with that name already exists.');
      return;
    }
    const playlist = {
      id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
      name: clean,
      songIds: [],
    };
    state.playlists.push(playlist);
    state.activePlaylist = playlist.id;
    state.view = 'all';
    saveJSON(KEYS.playlists, state.playlists);
    renderPlaylists();
    applyFilters();
    showNotice('Created mixtape "' + clean + '".');
  }
  function playSong(id, queue = null) {
    if (!songById(id)) return;
    if (queue) {
      state.queue = queue.map(item => typeof item === 'string' ? item : item.id).filter(value => songById(value));
    } else if (!state.queue.includes(id)) {
      state.queue = [id, ...state.queue.filter(value => value !== state.currentId)];
    }
    state.currentId = id;
    renderQueue();
    renderPlayerMeta();
    updatePlayerButtons();
    if (state.playerReady && state.player) {
      state.player.loadVideoById(id);
    } else {
      state.pendingVideoId = id;
      loadYouTubeAPI();
    }

    // On phones, make the video/player visible as soon as a track is started.
    // Defer until click bubbling completes so the outside-click listener cannot
    // immediately close the panel that this interaction just opened.
    if (window.matchMedia && window.matchMedia('(max-width: 680px)').matches) {
      window.setTimeout(() => toggleMobilePlayerPanel(true), 0);
    }
  }
  function addToQueue(id) {
    if (!songById(id)) return;
    if (!state.queue.includes(id)) state.queue.push(id);
    renderQueue();
    showNotice('Added "' + titleOf(songById(id)) + '" to the queue.');
  }
  function nextSong() {
    if (!state.queue.length) return;
    const currentIndex = state.queue.indexOf(state.currentId);
    if (state.shuffle) {
      const candidates = state.queue.filter(id => id !== state.currentId);
      if (candidates.length) playSong(candidates[Math.floor(Math.random() * candidates.length)]);
      else if (state.repeat && state.currentId) playSong(state.currentId);
      return;
    }
    const nextIndex = currentIndex + 1;
    if (nextIndex < state.queue.length) {
      playSong(state.queue[nextIndex]);
    } else if (state.repeat && state.queue.length) {
      playSong(state.queue[0]);
    } else {
      if (state.playerReady && state.player) state.player.pauseVideo();
      el['player-state'].textContent = 'Queue finished · add another song';
      if (el['play-pause']) el['play-pause'].textContent = '▶';
    }
  }
  function previousSong() {
    if (!state.queue.length) return;
    const index = state.queue.indexOf(state.currentId);
    if (state.playerReady && state.player && state.player.getCurrentTime() > 3) {
      state.player.seekTo(0, true);
      return;
    }
    if (index > 0) playSong(state.queue[index - 1]);
    else if (state.repeat && state.queue.length) playSong(state.queue[state.queue.length - 1]);
  }
  function renderQueue() {
    el['queue-count'].textContent = state.queue.length.toLocaleString();
    el['queue-list'].innerHTML = state.queue.length ? state.queue.map(id => {
      const item = songById(id);
      if (!item) return '';
      return '<div class="queue-track ' + (id === state.currentId ? 'current' : '') + '" data-queue-track="' + escapeHTML(id) + '">' +
        '<img class="queue-track-art" loading="lazy" src="' + thumbnail(item) + '" alt="">' +
        '<div class="queue-track-info"><strong>' + escapeHTML(titleOf(item)) + '</strong><span>' +
        escapeHTML(artistsOf(item).join(', ')) + '</span></div><div class="queue-track-actions">' +
        '<button class="queue-track-play" data-queue-play="' + escapeHTML(id) + '" aria-label="Play this song">▶</button>' +
        '<button class="queue-track-remove" data-queue-remove="' + escapeHTML(id) + '" aria-label="Remove from queue">×</button>' +
        '</div></div>';
    }).join('') : '<div class="queue-empty"><span>≋</span><p>Your queue is empty.<br><small>Add songs and your mini mixtape will appear here.</small></p></div>';
    updatePlayerButtons();
  }
  function renderPlayerMeta() {
    const item = songById(state.currentId);
    el['playing-title'].textContent = item ? titleOf(item) : 'Nothing playing yet';
    el['playing-artist'].textContent = item ? artistsOf(item).join(', ') : 'The queue is ready when you are';
    el['playing-thumb'].hidden = !item;
    if (item) el['playing-thumb'].src = thumbnail(item);
    el['playing-art-placeholder'].hidden = !!item;
    el['watch-youtube'].hidden = !item;
    el['youtube-fallback'].hidden = !item;
    const url = item ? 'https://www.youtube.com/watch?v=' + encodeURIComponent(item.id) : 'https://www.youtube.com/';
    el['watch-youtube'].href = url;
    el['youtube-fallback'].href = url;
    el['playing-favorite'].disabled = !item;
    el['playing-favorite'].classList.toggle('is-favorite', !!item && state.favorites.has(item.id));
    el['playing-favorite'].textContent = item && state.favorites.has(item.id) ? '♥' : '♡';
    el['mobile-mini-player'].hidden = !item;
    document.body.classList.toggle('has-mobile-player', !!item);
    el['mobile-mini-title'].textContent = item ? titleOf(item) : 'Nothing playing yet';
    el['mobile-mini-artist'].textContent = item ? artistsOf(item).join(', ') : 'Choose a song to start listening';
    if (item) el['mobile-mini-thumb'].src = thumbnail(item);
    el['mobile-mini-thumb'].hidden = !item;
  }
  function updatePlayerButtons() {
    const hasCurrent = !!state.currentId;
    el['play-pause'].disabled = !hasCurrent;
    el['mobile-mini-toggle'].disabled = !hasCurrent || !state.playerReady;
    el['mobile-mini-next'].disabled = !hasCurrent;
    el['previous-song'].disabled = !hasCurrent;
    el['next-song'].disabled = !hasCurrent;
    el['queue-shuffle'].classList.toggle('active', state.shuffle);
    el['queue-repeat'].classList.toggle('active', state.repeat);
    if (state.playerReady && state.player) {
      try {
        const playing = state.player.getPlayerState() === window.YT.PlayerState.PLAYING;
        el['play-pause'].textContent = playing ? 'Ⅱ' : '▶';
        el['play-pause'].setAttribute('aria-label', playing ? 'Pause' : 'Play');
        el['play-pause'].title = playing ? 'Pause' : 'Play';
        el['mobile-mini-toggle'].textContent = playing ? 'Ⅱ' : '▶';
        el['mobile-mini-toggle'].setAttribute('aria-label', playing ? 'Pause song' : 'Play song');
      } catch {}
    }
  }
  function togglePlayback() {
    if (!state.playerReady || !state.player) return;
    const playing = state.player.getPlayerState() === window.YT.PlayerState.PLAYING;
    playing ? state.player.pauseVideo() : state.player.playVideo();
  }

  function toggleMobilePlayerPanel(force) {
    const open = typeof force === 'boolean' ? force : !el['player-column'].classList.contains('mobile-open');

    // Player and filter panels are mutually exclusive on phones.
    // Minimize to the mini-player without interrupting playback.
    document.body.classList.remove('compact-player');
    document.body.classList.remove('filters-open');
    el['mobile-filter-toggle'].setAttribute('aria-expanded', 'false');
    el['player-column'].classList.toggle('mobile-open', open);
    document.body.classList.toggle('mobile-player-open', open);
    el['mobile-player-toggle'].setAttribute('aria-expanded', String(open));
    el['player-hide'].setAttribute('aria-expanded', String(open));
    el['player-hide'].setAttribute('aria-label', open ? 'Minimize player and return to library' : 'Collapse player panel');
    el['player-hide'].title = open ? 'Minimize player and return to library' : 'Collapse player panel';
    if (open) el['player-column'].scrollTop = 0;
  }

  function loadYouTubeAPI() {
    if (window.YT && window.YT.Player) { createYouTubePlayer(); return; }
    if (document.getElementById('youtube-api-script')) return;
    const script = document.createElement('script');
    script.id = 'youtube-api-script';
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
    window.onYouTubeIframeAPIReady = () => createYouTubePlayer();
  }
  function createYouTubePlayer() {
    if (state.player) return;
    state.player = new window.YT.Player('youtube-player', {
      width: '100%',
      height: '100%',
      videoId: state.pendingVideoId || undefined,
      playerVars: { playsinline: 1, rel: 0, origin: location.origin },
      events: {
        onReady: () => {
          state.playerReady = true;
          if (state.pendingVideoId) state.player.loadVideoById(state.pendingVideoId);
          updatePlayerButtons();
        },
        onStateChange: event => {
          if (event.data === window.YT.PlayerState.ENDED) {
            // "Repeat queue" loops the whole queue, not just the current track.
            nextSong();
          } else if (event.data === window.YT.PlayerState.PLAYING) {
            el['player-state'].textContent = 'Playing on YouTube';
          } else if (event.data === window.YT.PlayerState.PAUSED) {
            el['player-state'].textContent = 'Paused';
          } else if (event.data === window.YT.PlayerState.BUFFERING) {
            el['player-state'].textContent = 'Loading your song…';
          }
          updatePlayerButtons();
        },
        onError: () => {
          el['player-state'].textContent = 'Video unavailable';
          showNotice('This video cannot play in the embedded player. Try "Watch on YouTube".');
          updatePlayerButtons();
        },
      },
    });
  }

  function setView(view) {
    if (view === 'fresh') {
      activateFreshReleases();
      return;
    }
    state.view = view;
    state.activePlaylist = null;
    renderPlaylists();
    applyFilters();
  }
  function activateFreshReleases() {
    state.view = 'fresh';
    state.activePlaylist = null;
    state.selectedArtists.clear();
    state.query = '';
    el['search-input'].value = '';
    el['artist-search'].value = '';
    el['sort-select'].value = 'newest';
    renderArtists();
    renderPlaylists();
    applyFilters();
    showNotice(state.usingFreshFallback
      ? 'No indexed dates fell inside the recent-release window, so we are showing the newest songs we could sort.'
      : 'Fresh releases selected — recently published songs first.');
    el['catalogue'].scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function resetFilters() {
    state.songType = 'all';
    state.selectedArtists.clear();
    state.query = '';
    state.artistQuery = '';
    state.artistCategory = 'all';
    state.view = 'all';
    state.activePlaylist = null;
    el['search-input'].value = '';
    el['artist-search'].value = '';
    el['sort-select'].value = 'newest';
    renderArtists();
    renderPlaylists();
    applyFilters();
    showNotice('Filters cleared. Happy listening!');
  }
  function activateAllSongs() {
    state.selectedArtists.clear();
    state.query = '';
    state.artistQuery = '';
    state.view = 'all';
    state.activePlaylist = null;
    el['search-input'].value = '';
    el['artist-search'].value = '';
    el['sort-select'].value = 'newest';
    renderArtists();
    renderPlaylists();
    applyFilters();
    showNotice('Browsing the full library — search a song or choose an oshi to begin.');
    el['catalogue'].scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function selectSpotlightArtist(name) {
    const rosterTalent = resolveRosterTalent(name);
    const available = [...new Set(state.songs.flatMap(artistsOf))];
    const wanted = normalized(name);
    const match = rosterTalent?.name || available.find(artist => normalized(artist) === wanted) ||
      available.find(artist => normalized(artist).includes(wanted) || wanted.includes(normalized(artist)));
    if (!match) {
      showNotice('No catalogue entries were found for ' + name + ' yet.');
      return;
    }
    state.view = 'all';
    state.activePlaylist = null;
    state.selectedArtists.clear();
    state.selectedArtists.add(match);
    state.query = '';
    el['search-input'].value = '';
    renderArtists();
    renderPlaylists();
    applyFilters();
    showNotice('Showing songs credited to ' + match + '.');
    el['catalogue'].scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function setupDesktopVideoDock() {
    const column = el['player-column'];
    const playerCard = column?.querySelector('.player-card');
    if (!column || !playerCard) return;

    let dockThreshold = Infinity;
    let scheduledFrame = 0;

    const isWideDesktop = () =>
      !!(window.matchMedia && window.matchMedia('(min-width: 1221px)').matches);

    const applyDockState = () => {
      scheduledFrame = 0;
      const shouldDock = isWideDesktop() && window.scrollY >= dockThreshold;
      document.body.classList.toggle('player-docked', shouldDock);
    };

    const scheduleDockUpdate = () => {
      if (scheduledFrame) return;
      scheduledFrame = window.requestAnimationFrame(applyDockState);
    };

    const measureDockThreshold = () => {
      // Measure only while in normal document flow, then pin the player only
      // when its full-size card would otherwise have scrolled mostly away.
      document.body.classList.remove('player-docked');
      if (!isWideDesktop()) {
        dockThreshold = Infinity;
        applyDockState();
        return;
      }
      const rect = playerCard.getBoundingClientRect();
      dockThreshold = Math.max(0, rect.top + window.scrollY + playerCard.offsetHeight - 110);
      applyDockState();
    };

    window.addEventListener('scroll', scheduleDockUpdate, { passive: true });
    window.addEventListener('resize', measureDockThreshold, { passive: true });
    measureDockThreshold();
  }

  function initEvents() {
    document.querySelectorAll('[data-view]').forEach(button => {
      button.addEventListener('click', () => setView(button.dataset.view));
    });
    document.querySelectorAll('[data-song-type]').forEach(button => {
      button.addEventListener('click', () => {
        state.songType = button.dataset.songType;
        applyFilters();
      });
    });
    document.querySelectorAll('[data-sidebar-song-type]').forEach(button => {
      button.addEventListener('click', () => {
        state.songType = button.dataset.sidebarSongType;
        state.view = 'all';
        state.activePlaylist = null;
        renderPlaylists();
        applyFilters();
      });
    });
    el['search-input'].addEventListener('input', event => {
      state.query = event.target.value;
      applyFilters();
    });
    el['global-search-form'].addEventListener('submit', event => {
      event.preventDefault();
      state.query = el['search-input'].value;
      applyFilters();
      const target = document.getElementById('music-library') || el['song-list'];
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Remove the persistent focus-within glow after the search action.
      el['search-button'].blur();
      el['search-input'].blur();
    });
    const closeTalentPicker = () => {
      const dialog = el['talent-picker-dialog'];
      if (typeof dialog.close === 'function' && dialog.open) {
        try {
          dialog.close();
          return;
        } catch { /* Fall back to the non-modal open state below. */ }
      }
      dialog.removeAttribute('open');
    };
    const openTalentPicker = () => {
      const dialog = el['talent-picker-dialog'];
      // Refresh the roster before opening so both entry points always show the
      // latest catalogue, including when the user opens the picker quickly.
      renderArtists();
      if (!dialog.open) {
        if (typeof dialog.showModal === 'function') {
          try { dialog.showModal(); }
          catch { dialog.setAttribute('open', ''); }
        } else {
          dialog.setAttribute('open', '');
        }
      }
      el['artist-search'].focus({ preventScroll: true });
    };
    el['talent-picker-toggle'].addEventListener('click', event => {
      event.preventDefault();
      openTalentPicker();
    });
    el['browse-all-talents'].addEventListener('click', event => {
      event.preventDefault();
      openTalentPicker();
    });
    el['talent-picker-close'].addEventListener('click', closeTalentPicker);
    el['talent-picker-done'].addEventListener('click', closeTalentPicker);
    el['talent-picker-dialog'].addEventListener('click', event => {
      if (event.target === el['talent-picker-dialog']) closeTalentPicker();
    });
    el['artist-search'].addEventListener('input', event => {
      state.artistQuery = event.target.value;
      renderArtists();
    });
    document.querySelectorAll('[data-artist-category]').forEach(button => {
      button.addEventListener('click', () => {
        state.artistCategory = button.dataset.artistCategory || 'all';
        renderArtists();
      });
    });
    el['artist-filters'].addEventListener('change', event => {
      const input = event.target.closest('input[data-artist]');
      if (!input) return;
      input.checked ? state.selectedArtists.add(input.dataset.artist) : state.selectedArtists.delete(input.dataset.artist);
      renderArtists();
      state.view = 'all';
      state.activePlaylist = null;
      renderPlaylists();
      applyFilters();
      if (window.matchMedia && window.matchMedia('(max-width: 680px)').matches) {
        document.body.classList.remove('filters-open');
      }
    });
    let lastObservedPageSize = getPageSize();
    window.addEventListener('resize', () => {
      const nextPageSize = getPageSize();
      if (nextPageSize !== lastObservedPageSize) {
        lastObservedPageSize = nextPageSize;
        state.currentPage = 1;
        renderSongs();
      }
    });
    el['sort-select'].addEventListener('change', applyFilters);
    el['clear-filters'].addEventListener('click', resetFilters);
    el['empty-reset'].addEventListener('click', resetFilters);
    el['show-all-artists'].addEventListener('click', () => {
      el['artist-filters'].style.maxHeight = 'none';
      el['show-all-artists'].hidden = true;
    });
    el['song-list'].addEventListener('click', event => {
      const button = event.target.closest('[data-action]');
      if (!button) return;
      const id = button.dataset.id;
      if (button.dataset.action === 'play') playSong(id);
      if (button.dataset.action === 'queue') addToQueue(id);
      if (button.dataset.action === 'favorite') toggleFavorite(id);
    });
    el['talent-strip'].addEventListener('click', event => {
      const button = event.target.closest('[data-spotlight-artist]');
      if (button) selectSpotlightArtist(button.dataset.spotlightArtist);
    });
    el['pagination'].addEventListener('click', event => {
      const button = event.target.closest('[data-page]');
      if (!button || button.disabled) return;
      const nextPage = Number(button.dataset.page);
      const totalPages = Math.ceil(state.filtered.length / getPageSize());
      if (!Number.isInteger(nextPage) || nextPage < 1 || nextPage > totalPages ||
          nextPage === state.currentPage) return;
      state.currentPage = nextPage;
      renderSongs();
      const target = document.getElementById('music-library') || el['song-list'];
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    el['play-all'].addEventListener('click', () => {
      if (state.filtered.length) playSong(state.filtered[0].id, state.filtered.map(item => item.id));
    });
    el['play-random'].addEventListener('click', () => {
      if (state.filtered.length) playSong(state.filtered[Math.floor(Math.random() * state.filtered.length)].id);
    });
    el['favorites-shortcut'].addEventListener('click', () => setView('favorites'));
    el['playing-favorite'].addEventListener('click', () => {
      if (state.currentId) toggleFavorite(state.currentId);
    });
    el['clear-queue'].addEventListener('click', () => {
      state.queue = [];
      state.currentId = null;
      if (state.playerReady && state.player) state.player.stopVideo();
      renderQueue();
      renderPlayerMeta();
      updatePlayerButtons();
      el['player-state'].textContent = 'Queue cleared';
    });
    el['queue-list'].addEventListener('click', event => {
      const playButton = event.target.closest('[data-queue-play]');
      const removeButton = event.target.closest('[data-queue-remove]');
      if (playButton) {
        playSong(playButton.dataset.queuePlay);
        return;
      }
      if (removeButton) {
        const removedId = removeButton.dataset.queueRemove;
        state.queue = state.queue.filter(id => id !== removedId);
        if (state.currentId === removedId) {
          state.currentId = null;
          if (state.playerReady && state.player) state.player.stopVideo();
        }
        renderQueue();
        renderPlayerMeta();
        updatePlayerButtons();
        return;
      }
      const track = event.target.closest('[data-queue-track]');
      if (track) playSong(track.dataset.queueTrack);
    });
    el['previous-song'].addEventListener('click', previousSong);
    el['next-song'].addEventListener('click', nextSong);
    el['play-pause'].addEventListener('click', togglePlayback);
    el['mobile-mini-toggle'].addEventListener('click', togglePlayback);
    el['mobile-mini-next'].addEventListener('click', nextSong);
    el['mobile-mini-expand'].addEventListener('click', () => toggleMobilePlayerPanel());
    el['queue-shuffle'].addEventListener('click', () => {
      state.shuffle = !state.shuffle;
      saveJSON(KEYS.shuffle, state.shuffle);
      updatePlayerButtons();
      showNotice(state.shuffle ? 'Shuffle is on.' : 'Shuffle is off.');
    });
    el['queue-repeat'].addEventListener('click', () => {
      state.repeat = !state.repeat;
      saveJSON(KEYS.repeat, state.repeat);
      updatePlayerButtons();
      showNotice(state.repeat ? 'Repeat queue is on.' : 'Repeat queue is off.');
    });
    el['create-playlist'].addEventListener('click', () => {
      el['playlist-name'].value = '';
      el['playlist-dialog'].showModal();
      el['playlist-name'].focus({ preventScroll: true });
    });
    // Cancellation must never be blocked by the required playlist-name field.
    el['cancel-playlist'].addEventListener('click', () => el['playlist-dialog'].close());
    el['playlist-dialog'].addEventListener('click', event => {
      if (event.target === el['playlist-dialog']) el['playlist-dialog'].close();
    });
    el['playlist-form'].addEventListener('submit', event => {
      event.preventDefault();
      createPlaylist(el['playlist-name'].value);
      el['playlist-dialog'].close();
    });
    el['playlist-list'].addEventListener('click', event => {
      const button = event.target.closest('[data-playlist]');
      if (!button) return;
      const playlist = state.playlists.find(item => item.id === button.dataset.playlist);
      if (!playlist) return;
      if (playlist.smartType === LATEST_MIX_PLAYLIST_KIND) {
        playLatest50Playlist(playlist);
        return;
      }
      state.activePlaylist = playlist.id;
      state.view = 'all';
      renderPlaylists();
      applyFilters();
    });
    el['save-queue'].addEventListener('click', () => {
      const playlist = state.playlists.find(item => item.id === el['playlist-select'].value);
      if (!playlist) {
        showNotice('Choose a mixtape first.');
        return;
      }
      if (playlist.smartType === LATEST_MIX_PLAYLIST_KIND) {
        showNotice('This automatic mixtape refreshes itself from the newest originals and covers.');
        return;
      }
      playlist.songIds = [...new Set([...(Array.isArray(playlist.songIds) ? playlist.songIds : []), ...state.queue])];
      saveJSON(KEYS.playlists, state.playlists);
      renderPlaylists();
      showNotice('Queue saved to "' + playlist.name + '".');
    });
    el['play-selected-playlist'].addEventListener('click', () => {
      const playlist = state.playlists.find(item => item.id === el['playlist-select'].value);
      if (!playlist || !playlist.songIds.length) {
        showNotice('Choose a mixtape with songs first.');
        return;
      }
      if (playlist.smartType === LATEST_MIX_PLAYLIST_KIND) {
        playLatest50Playlist(playlist);
        return;
      }
      playSong(playlist.songIds[0], playlist.songIds);
    });
    el['mobile-filter-toggle'].addEventListener('click', () => {
      const willOpen = !document.body.classList.contains('filters-open');
      if (willOpen && document.body.classList.contains('mobile-player-open')) {
        toggleMobilePlayerPanel(false);
      }
      document.body.classList.toggle('filters-open', willOpen);
      el['mobile-filter-toggle'].setAttribute('aria-expanded', String(willOpen));
      if (willOpen) document.body.classList.remove('compact-player');
    });
    el['mobile-player-toggle'].addEventListener('click', () => {
      if (window.matchMedia && window.matchMedia('(max-width: 680px)').matches) {
        toggleMobilePlayerPanel();
      } else {
        el['player-column'].scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
    document.addEventListener('click', event => {
      if (document.body.classList.contains('mobile-player-open') &&
          !event.target.closest('#player-column, #mobile-mini-player, #mobile-player-toggle')) {
        toggleMobilePlayerPanel(false);
      }
      if (document.body.classList.contains('filters-open')) {
        const pickedDestination = event.target.closest(
          '#sidebar [data-view], #sidebar [data-sidebar-song-type], #sidebar [data-playlist]'
        );
        const clickedOutsideDrawer = !event.target.closest('#sidebar, #mobile-filter-toggle');
        if (pickedDestination || clickedOutsideDrawer) {
          document.body.classList.remove('filters-open');
          el['mobile-filter-toggle'].setAttribute('aria-expanded', 'false');
        }
      }
    });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      if (document.body.classList.contains('mobile-player-open')) toggleMobilePlayerPanel(false);
      if (document.body.classList.contains('filters-open')) {
        document.body.classList.remove('filters-open');
        el['mobile-filter-toggle'].setAttribute('aria-expanded', 'false');
      }
    });
    el['sidebar-collapse'].addEventListener('click', () => {
      if (window.matchMedia && window.matchMedia('(max-width: 680px)').matches &&
          document.body.classList.contains('filters-open')) {
        document.body.classList.remove('filters-open');
        el['mobile-filter-toggle'].setAttribute('aria-expanded', 'false');
        return;
      }
      setSidebarCollapsed(!document.body.classList.contains('sidebar-collapsed'));
    });
    el['player-hide'].addEventListener('click', () => {
      if (window.matchMedia && window.matchMedia('(max-width: 680px)').matches) {
        if (el['player-column'].classList.contains('mobile-open')) {
          // Minimize the overlay to the fixed mini-player; keep playback running.
          toggleMobilePlayerPanel(false);
        } else {
          // If reached in normal page flow, preserve the existing inline compact mode.
          document.body.classList.toggle('compact-player');
        }
      } else {
        document.body.classList.toggle('compact-player');
      }
    });
    document.addEventListener('keydown', event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        el['search-input'].focus();
      }
    });
  }
  async function init() {
    initEvents();
    setupDesktopVideoDock();
    setSidebarCollapsed(!!readJSON(KEYS.sidebarCollapsed, false), false);
    await loadTalentRoster();
    await loadArtistPortraitManifest();
    try {
      const response = await fetch('data/songs.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      if (!Array.isArray(data.songs)) throw new Error('Catalogue schema is invalid');
      state.songs = deduplicateCatalogue(data.songs);
      el['source-status'].textContent = state.songs.length
        ? 'Catalogue ready · ' + state.songs.length.toLocaleString() + ' songs'
        : 'Waiting for first catalogue sync';
      const date = data.generatedAt || data.lastFullReconciledAt;
      el['hero-updated'].textContent = date
        ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date))
        : 'Waiting';
      if (!state.songs.length) {
        showNotice('The song catalogue is empty until the first successful Holodex refresh. Add HOLODEX_API_KEY under repository Actions secrets, then run "Refresh Hololive catalogue".');
      } else {
        showNotice('');
      }
    } catch (error) {
      el['source-status'].textContent = 'Catalogue load failed';
      showNotice('Could not load the song catalogue (' + error.message + '). Refresh the page to retry.');
    }
    refreshLatest50Playlist();
    renderArtists();
    renderPlaylists();
    applyFilters();
    renderQueue();
    renderPlayerMeta();
    renderCounts();
  }
  window.addEventListener('beforeunload', () => {
    if (heroRotationTimer !== null) window.clearInterval(heroRotationTimer);
    saveJSON(KEYS.favorites, [...state.favorites]);
    saveJSON(KEYS.playlists, state.playlists);
  });
  init();
})();
