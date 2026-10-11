# HoloTracks

A fan-made, searchable catalogue of Hololive original-song videos with a site-managed YouTube player, queue, artist filters, favourites, and browser-local playlists.

**This project never creates or edits YouTube playlists.** Playback uses the official YouTube embedded player. Search, filtering, sorting, favourites, and custom queues operate against a catalogue JSON file hosted with the site.

## What is included

- Paginated Holodex import using `Hololive` + `Original_Song`; all result pages are processed instead of stopping at the first 50.
- A local catalogue (`data/songs.json`) so searches and artist filtering do not call Holodex for each interaction.
- Daily catalogue refresh using GitHub Actions, plus a manual workflow trigger.
- Optional popularity metrics refreshed in batches with YouTube's public-video statistics endpoint. This needs a Google API key only—not OAuth or a refresh token.
- Search by title and artist; multiple artist checkboxes; newest/oldest/title/popularity sorting when view counts are available.
- Official YouTube video embeds, queue, next/previous, shuffle/repeat, favourites, and named playlists saved in the current browser.
- Responsive layout with no framework or runtime dependencies.
- Validation, deduplication by YouTube video ID, retry/backoff, a maximum-result safety guard, and atomic JSON replacement. Failed/partial syncs should not replace the last successful catalogue.

## Setup

### 1. Configure Holodex

1. Sign in to [Holodex](https://holodex.net/) and open **Account Settings → API Key**.
2. In this repository, open **Settings → Secrets and variables → Actions → New repository secret**.
3. Name it `HOLODEX_API_KEY` and paste your API key as its value.
4. Open **Actions → Refresh Hololive catalogue → Run workflow**.

The catalogue is intentionally empty until that first successful sync. This repository needs its own secret; secrets are not shared from your other repositories.

### Optional: popularity sorting

Enable **YouTube Data API v3** in a Google Cloud project, create an API key, and save it as repository secret `YOUTUBE_DATA_API_KEY`. This is a regular API key—not an OAuth client or refresh token. It enables view-count sorting where metrics are available. Without it the catalogue still works, but popularity may be unavailable.

### 2. Enable GitHub Pages

1. Open **Settings → Pages**.
2. Set the build/deployment source to **GitHub Actions**.
3. Open **Actions → Deploy HoloTracks to GitHub Pages** and run the workflow, or push a commit to `main`.
4. GitHub will show the site URL in Pages settings and the workflow output.

The catalogue updater runs daily at 04:23 UTC. When `data/songs.json` changes, the workflow commits it and that commit triggers a site deployment.

## Run locally

Requires Node.js 20+; there are no npm dependencies.

```bash
npm test
HOLODEX_API_KEY=your_key node scripts/update-catalog.mjs
python -m http.server 8080
```

Then open `http://localhost:8080`. In PowerShell, set the key with `$env:HOLODEX_API_KEY="your_key"` before running Node. For a read-only source/API refresh check, run `node scripts/update-catalog.mjs --dry-run`.

## Catalogue scope and attribution

The source query returns Holodex video-search results for `org: Hololive`, `topic: Original_Song`, and target `stream`. Completeness depends on records and topic tags available from Holodex; videos not indexed there may not appear automatically. Artist credits use channel metadata plus best-effort title matching for collaborations, because structured artist credits are not guaranteed for every video.

This project uses the [Holodex API](https://docs.holodex.net/) and links back to Holodex for attribution. It displays video thumbnails and plays videos through YouTube's official embedded player; it does not download or rehost audio/video. Playback may be unavailable when a video is removed, age-restricted, or embedding is disabled. YouTube's player terms and privacy practices apply when the player is loaded.

Hololive, its talents, recordings, artwork, and related trademarks remain the property of their respective rights holders. HoloTracks is an independent fan project and is not affiliated with or endorsed by COVER Corporation.

## Data and privacy

Favourites, personal playlists, and playback preferences are stored in the browser's `localStorage`; there is no account or project-owned user database. Browser-local data does not automatically sync between devices. Loading the YouTube player or thumbnails makes requests to YouTube domains.

## Checks

```bash
npm test
node --check app.js
node --check scripts/update-catalog.mjs
```
