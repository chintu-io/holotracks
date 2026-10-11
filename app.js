'use strict';

(() => {
  const PAGE_SIZE = 60;
  const FRESH_WINDOW_DAYS = 180;
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
    sidebarCollapsed: 'holotracks:sidebar-collapsed:v1',
    lastBanner: 'holotracks:banner-last:v1',
  };
  const ids = [
    'search-input','artist-search','artist-filters','artist-count','show-all-artists',
    'clear-filters','nav-total','fav-total','hero-song-count','hero-artist-count','hero-updated',
    'source-status','catalogue-title-text','results-count','results-caption','sort-select',
    'type-all-count','type-original-count','type-cover-count','nav-original-total','nav-cover-total',
    'song-list','empty-state','empty-title','empty-copy','empty-reset','load-more','notice',
    'play-all','play-random','favorites-shortcut','mobile-filter-toggle',
    'mobile-player-toggle','sidebar','player-column','player-hide','youtube-player','youtube-fallback',
    'playing-thumb','playing-art-placeholder','playing-title','playing-artist','playing-favorite',
    'player-state','watch-youtube','play-pause','previous-song','next-song','queue-shuffle',
    'queue-repeat','queue-count','queue-list','clear-queue','create-playlist','playlist-list',
    'playlist-select','save-queue','play-selected-playlist','playlist-dialog','playlist-form',
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
  const state = {
    songs: [], filtered: [], visibleCount: PAGE_SIZE, talents: [], artistPortraits: new Map(),
    selectedArtists: new Set(),
    query: '', artistQuery: '',
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
  function pickBannerTalents() {
    const roster = state.talents.filter(item => item.slug && safeTalentImage(item.bannerImage || item.image));
    if (roster.length <= 3) return roster.slice(0, 3);
    const bySlug = new Map(roster.map(item => [item.slug, item]));
    let deck = readJSON(KEYS.bannerDeck, []);
    if (!Array.isArray(deck)) deck = [];
    deck = deck.filter((slug, index) => bySlug.has(slug) && deck.indexOf(slug) === index);
    if (deck.length < 3) {
      const alreadyQueued = new Set(deck);
      deck = [...deck, ...shuffled(roster.filter(item => !alreadyQueued.has(item.slug)).map(item => item.slug))];
    }
    const pickedSlugs = deck.splice(0, 3);
    const previous = readJSON(KEYS.lastBanner, []);
    if (Array.isArray(previous) &&
        [...pickedSlugs].sort().join('|') === [...previous].sort().join('|') &&
        deck.length) {
      const replacementIndex = deck.findIndex(slug => !pickedSlugs.includes(slug));
      if (replacementIndex >= 0) {
        const previousPick = pickedSlugs[2];
        pickedSlugs[2] = deck[replacementIndex];
        deck.splice(replacementIndex, 1);
        deck.push(previousPick);
      }
    }
    saveJSON(KEYS.bannerDeck, deck);
    saveJSON(KEYS.lastBanner, pickedSlugs);
    return pickedSlugs.map(slug => bySlug.get(slug)).filter(Boolean);
  }
  function renderHeroTalentArt() {
    const stage = el['hero-talent-art'];
    if (!stage) return;
    stage.querySelectorAll('.stage-talent').forEach(image => image.remove());
    const talents = pickBannerTalents();
    const slots = ['left', 'center', 'right'];
    talents.forEach((talent, index) => {
      const image = document.createElement('img');
      image.className = 'stage-talent stage-' + slots[index];
      image.src = safeTalentImage(talent.bannerImage) || safeTalentImage(ARTIST_IMAGES[talent.name]) || safeTalentImage(talent.image);
      image.alt = talent.name;
      image.loading = 'eager';
      image.decoding = 'async';
      image.onerror = () => { image.style.display = 'none'; };
      const caption = stage.querySelector('.stage-caption');
      stage.insertBefore(image, caption || null);
    });
  }
  function renderTalentSpotlight() {
    const palette = ['#3b5993','#7c3b6e','#8d4a36','#704367','#327b99','#3d6d9e','#8c5c32','#75498f','#774337','#a46d36','#69476d','#a84c36'];
    const roster = state.talents.filter(item => item.name && safeTalentImage(item.image));
    el['talent-strip'].innerHTML = roster.map((talent, index) =>
      '<button class="talent-card" type="button" data-spotlight-artist="' + escapeHTML(talent.name) +
      '" style="--talent:' + palette[index % palette.length] + '" title="Browse ' + escapeHTML(talent.name) + '">' +
      '<span class="talent-image"><img src="' + escapeHTML(safeTalentImage(talent.image)) +
      '" alt="" loading="lazy" decoding="async"><i>' +
      escapeHTML(talent.name.slice(0, 2).toUpperCase()) + '</i></span><strong>' +
      escapeHTML(talent.name) + '</strong></button>'
    ).join('');
    el['talent-strip'].querySelectorAll('img').forEach(image => {
      image.addEventListener('error', () => { image.style.display = 'none'; }, { once: true });
    });
    renderArtists();
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
  function resolveRosterPortrait(name) {
    if (ARTIST_IMAGES[name] && safeTalentImage(ARTIST_IMAGES[name])) return ARTIST_IMAGES[name];
    const target = artistKey(name);
    if (!target) return '';
    const alias = ARTIST_ALIASES[target];
    if (alias && ARTIST_IMAGES[alias]) return ARTIST_IMAGES[alias];
    const exact = state.talents.find(talent => artistKey(talent.name) === target);
    if (exact) return exact.image;
    if (target.length >= 5) {
      const close = state.talents
        .filter(talent => {
          const candidate = artistKey(talent.name);
          return candidate.length >= 5 && (candidate.includes(target) || target.includes(candidate));
        })
        .sort((a,b) => Math.abs(artistKey(a.name).length-target.length)-Math.abs(artistKey(b.name).length-target.length))[0];
      if (close) return close.image;
    }
    return '';
  }
  function buildArtistPortraitMap(artists) {
    const roster = state.talents.filter(talent => safeTalentImage(talent.image));
    const related = new Map();
    for (const song of state.songs) {
      const credits = [...new Set(artistsOf(song))];
      const creditedPortraits = credits.map(name => ({ name, image: resolveRosterPortrait(name) })).filter(item => item.image);
      for (const name of credits) {
        if (!artists.includes(name) || resolveRosterPortrait(name)) continue;
        const bag = related.get(name) || new Map();
        for (const item of creditedPortraits) {
          if (item.name === name) continue;
          bag.set(item.image, (bag.get(item.image) || 0) + 1);
        }
        related.set(name, bag);
      }
    }
    const fallbackPool = roster.length ? roster : Object.entries(ARTIST_IMAGES).map(([name,image])=>({name,image}));
    const stableHash = value => {
      let hash = 2166136261;
      for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
      return hash >>> 0;
    };
    const result = new Map();
    for (const name of artists) {
      let image = resolveRosterPortrait(name);
      if (!image) {
        const choices = [...(related.get(name) || new Map()).entries()].sort((a,b)=>b[1]-a[1]);
        image = choices[0]?.[0] || fallbackPool[stableHash(artistKey(name)) % fallbackPool.length]?.image || '';
      }
      result.set(name, image);
    }
    state.artistPortraits = result;
  }

  function renderArtists() {
    const counts = new Map();
    for (const item of state.songs) {
      for (const artist of artistsOf(item)) counts.set(artist, (counts.get(artist) || 0) + 1);
    }
    if (!state.artistPortraits.size && state.songs.length) buildArtistPortraitMap([...counts.keys()]);
    const query = state.artistQuery.toLocaleLowerCase();
    const rows = [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .filter(([artist]) => artist.toLocaleLowerCase().includes(query));
    el['artist-count'].textContent = counts.size;
    el['artist-filters'].innerHTML = rows.map(([artist, count]) => {
      const portrait = state.artistPortraits.get(artist) || resolveRosterPortrait(artist) || ARTIST_IMAGES[artist];
      const portraitMarkup = portrait
        ? '<img class="artist-avatar" src="' + portrait + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">'
        : '';
      return '<label class="artist-check"><input type="checkbox" data-artist="' + escapeHTML(artist) + '"' +
        (state.selectedArtists.has(artist) ? ' checked' : '') + '>' + portraitMarkup +
        '<span>' + escapeHTML(artist) + '</span><small>' + count + '</small></label>';
    }).join('') || '<p class="filter-empty">No matching talents.</p>';
    el['show-all-artists'].hidden = rows.length <= 12;
    if (rows.length > 12) el['show-all-artists'].textContent = 'Show all ' + rows.length + ' talents';
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
      if (state.selectedArtists.size && !artistsOf(item).some(artist => state.selectedArtists.has(artist))) return false;
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
    state.visibleCount = PAGE_SIZE;
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
  function renderSongs(append = false) {
    const visible = state.filtered.slice(0, state.visibleCount);
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
    el['song-list'].innerHTML = append ? el['song-list'].innerHTML + html : html;
    el['song-list'].setAttribute('aria-busy', 'false');
    el['empty-state'].hidden = visible.length > 0;
    el['load-more'].hidden = state.visibleCount >= state.filtered.length;
    el['results-count'].textContent = state.filtered.length.toLocaleString();
    if (!state.filtered.length) {
      el['empty-title'].textContent = state.view === 'favorites' ? 'No favourites yet' : 'No songs found';
      el['empty-copy'].textContent = state.view === 'fresh'
        ? 'No recent releases matched. Try All songs to browse the full archive.'
        : 'Try a different search or clear some filters.';
    }
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
  function renderPlaylists() {
    el['playlist-list'].innerHTML = state.playlists.map(playlist =>
      '<button type="button" class="playlist-row ' + (playlist.id === state.activePlaylist ? 'active' : '') +
      '" data-playlist="' + escapeHTML(playlist.id) + '"><span>♫ ' + escapeHTML(playlist.name) +
      '</span><small>' + playlist.songIds.length + '</small></button>'
    ).join('') || '<p class="filter-empty">No mixtapes yet. Use + to create one.</p>';
    el['playlist-select'].innerHTML = '<option value="">Choose playlist…</option>' + state.playlists.map(playlist =>
      '<option value="' + escapeHTML(playlist.id) + '">' + escapeHTML(playlist.name) + '</option>'
    ).join('');
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
      return '<div class="queue-track ' + (id === state.currentId ? 'current' : '') + '">' +
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
    el['player-column'].classList.toggle('mobile-open', open);
    document.body.classList.toggle('mobile-player-open', open);
    el['mobile-player-toggle'].setAttribute('aria-expanded', String(open));
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
            if (state.repeat && state.currentId) state.player.seekTo(0, true);
            else nextSong();
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
    const available = [...new Set(state.songs.flatMap(artistsOf))];
    const wanted = normalized(name);
    const match = available.find(artist => normalized(artist) === wanted) ||
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
    el['artist-search'].addEventListener('input', event => {
      state.artistQuery = event.target.value;
      renderArtists();
    });
    el['artist-filters'].addEventListener('change', event => {
      const input = event.target.closest('input[data-artist]');
      if (!input) return;
      input.checked ? state.selectedArtists.add(input.dataset.artist) : state.selectedArtists.delete(input.dataset.artist);
      state.view = 'all';
      state.activePlaylist = null;
      renderPlaylists();
      applyFilters();
      if (window.matchMedia && window.matchMedia('(max-width: 680px)').matches) {
        document.body.classList.remove('filters-open');
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
    el['load-more'].addEventListener('click', () => {
      state.visibleCount += PAGE_SIZE;
      renderSongs(true);
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
      if (playButton) playSong(playButton.dataset.queuePlay);
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
      }
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
    });
    el['playlist-form'].addEventListener('submit', event => {
      event.preventDefault();
      createPlaylist(el['playlist-name'].value);
      el['playlist-dialog'].close();
    });
    el['playlist-list'].addEventListener('click', event => {
      const button = event.target.closest('[data-playlist]');
      if (!button) return;
      state.activePlaylist = button.dataset.playlist;
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
      playlist.songIds = [...new Set([...playlist.songIds, ...state.queue])];
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
      playSong(playlist.songIds[0], playlist.songIds);
    });
    el['mobile-filter-toggle'].addEventListener('click', () => {
      document.body.classList.toggle('filters-open');
    });
    el['mobile-player-toggle'].addEventListener('click', () => {
      if (window.matchMedia && window.matchMedia('(max-width: 680px)').matches) {
        toggleMobilePlayerPanel();
      } else {
        el['player-column'].scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
    document.addEventListener('click', event => {
      if (!document.body.classList.contains('mobile-player-open')) return;
      if (event.target.closest('#player-column, #mobile-mini-player, #mobile-player-toggle')) return;
      toggleMobilePlayerPanel(false);
    });
    el['sidebar-collapse'].addEventListener('click', () => {
      setSidebarCollapsed(!document.body.classList.contains('sidebar-collapsed'));
    });
    el['player-hide'].addEventListener('click', () => {
      document.body.classList.toggle('compact-player');
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
    setSidebarCollapsed(!!readJSON(KEYS.sidebarCollapsed, false), false);
    await loadTalentRoster();
    try {
      const response = await fetch('data/songs.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      if (!Array.isArray(data.songs)) throw new Error('Catalogue schema is invalid');
      state.songs = data.songs.filter(item => item && typeof item.id === 'string' && item.id.trim());
      state.artistPortraits = new Map();
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
    renderArtists();
    renderPlaylists();
    applyFilters();
    renderQueue();
    renderPlayerMeta();
    renderCounts();
  }
  window.addEventListener('beforeunload', () => {
    saveJSON(KEYS.favorites, [...state.favorites]);
    saveJSON(KEYS.playlists, state.playlists);
  });
  init();
})();
