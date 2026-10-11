# HoloTracks

A searchable, fan-made Hololive original-song library with a cheerful pastel interface, official YouTube playback, talent filters, a site-managed queue, favourites, and browser-local playlists.

**HoloTracks does not create or edit YouTube playlists.** Search, filters, sorting, queues, favourites, and custom mixtapes are managed by the website. Video playback uses YouTube's official embedded player.

## Features

- Search song titles, artist names, alternate titles, and Japanese text.
- Multi-select talent filters and talent spotlight cards.
- Fresh releases view, newest/oldest sorting, title sorting, and optional view-count popularity sorting.
- Official YouTube embedded playback, queue controls, previous/next, shuffle, and repeat.
- Favourites and named playlists saved in the browser's local storage.
- Daily incremental catalogue updates, weekly full reconciliation, API retry/backoff, and tests.
- Responsive pastel UI using official Hololive profile artwork linked from the official talent site.

## Catalogue update design

The source is Holodex's Hololive + Original_Song search, using a page size of 50. The importer has two modes:

- **Incremental (daily):** request newest pages until it reaches a full page of IDs that are already in the saved catalogue. Only new IDs are added. If no songs or source-count metadata changed, the workflow does not create a commit or trigger a website deployment.
- **Full reconciliation (weekly):** scan every page from Holodex, refresh source metadata and view counts, and retain historical IDs that are temporarily absent from the index. A 25,000-record safety guard stops an unexpectedly large source response before it can replace the catalogue.

The scheduled workflows run daily at 04:23 UTC and perform the full reconciliation on Sundays at 04:43 UTC. GitHub scheduled jobs can start a little later than their cron time. You can also choose **Actions → Refresh Hololive catalogue → Run workflow** and select incremental or full mode. For an importer/schema change that needs a one-time backfill, include `[full-scan]` in that commit message; ordinary code/config pushes run incrementally.

The importer observes Retry-After on rate-limit responses, backs off on HTTP 429/5xx and timeouts, checks pagination, deduplicates video IDs, and writes through a temporary file before replacing data/songs.json. A failed run leaves the last successful catalogue intact.

## Setup

### 1. Holodex API key

1. Sign in to [Holodex](https://holodex.net/) and open **Account Settings → API Key**.
2. In the repository, open **Settings → Secrets and variables → Actions**.
3. Add the secret **HOLODEX_API_KEY**.
4. Run **Actions → Refresh Hololive catalogue** once using full mode if you need to initialise or rebuild the complete library.

The repository must have its own secret; GitHub Actions secrets are not shared from your other repositories.

### 2. Optional YouTube popularity metrics

Enable **YouTube Data API v3** in Google Cloud, create an API key restricted to that API, and store it as the repository secret **YOUTUBE_DATA_API_KEY**. This is a regular API key, not an OAuth client or refresh token. When configured, full weekly reconciliations refresh view counts in batches. If the key is absent or statistics temporarily fail, the catalogue still works and retains the last known counts.

### 3. GitHub Pages

In **Settings → Pages**, set the deployment source to **GitHub Actions**. The deployment workflow publishes the site after repository pushes and listens for a `catalogue-updated` repository-dispatch event. The refresh job commits `data/songs.json` only when it changes, then dispatches the deployment event after the commit is safely pushed. Unchanged incremental runs skip both the catalogue commit and the extra deployment.

## Run locally

Requires Node.js 20+; no npm dependencies are required.

~~~bash
npm test
node --check app.js
node --check scripts/update-catalog.mjs
HOLODEX_API_KEY=your_key node scripts/update-catalog.mjs --mode=incremental
HOLODEX_API_KEY=your_key node scripts/update-catalog.mjs --mode=full
HOLODEX_API_KEY=your_key node scripts/update-catalog.mjs --mode=full --dry-run
python -m http.server 8080
~~~

Then open http://localhost:8080. In PowerShell, set the key with $env:HOLODEX_API_KEY="your_key" before running Node.

## Fresh releases and release dates

The Fresh releases view clears conflicting search/talent filters, sorts newest-first, and shows videos published during the last 180 days. If the source contains no dates in that window, it falls back to the newest indexed videos. The importer prefers the video's publication timestamp to the availability timestamp for ordering.

## Artwork, attribution, and playback

Talent illustrations and profile avatars are loaded from the [official Hololive talent website](https://hololive.hololivepro.com/en/talents). Artwork and character rights remain with COVER Corporation and the respective rights holders. HoloTracks is an independent fan project and is not affiliated with or endorsed by COVER Corporation.

The website displays video thumbnails and plays videos through YouTube's official embedded player. It does not download or rehost audio/video. Playback can fail when a video is removed, age-restricted, region-restricted, or does not allow embedding. YouTube's player terms and privacy practices apply when the embedded player is loaded.

## Privacy

Favourites, personal mixtapes, and listening preferences are stored in browser localStorage. There is no account system or project-owned user database, so browser data does not automatically sync across devices. Loading talent artwork, YouTube thumbnails, or the embedded player makes requests to those providers.

## Validation

The refresh workflow runs the Node test suite plus syntax checks before querying Holodex. Tests cover normalisation, invalid IDs/statuses, deduplication, artist-credit inference, multi-page full imports, and incremental stopping once a page is fully known.
