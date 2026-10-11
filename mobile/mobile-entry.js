import { Capacitor } from '@capacitor/core';
import { AppLauncher } from '@capacitor/app-launcher';

const YOUTUBE_APP_SCHEME = 'vnd.youtube://watch?v=';

function getVideoId(href) {
  try {
    const url = new URL(href, window.location.href);
    if (url.hostname === 'youtu.be') {
      return url.pathname.split('/').filter(Boolean)[0] || null;
    }
    return url.searchParams.get('v') || null;
  } catch {
    return null;
  }
}

function httpsWatchUrl(videoId) {
  return 'https://www.youtube.com/watch?v=' + encodeURIComponent(videoId);
}

async function openOfficialYouTube(videoId) {
  const appUrl = YOUTUBE_APP_SCHEME + encodeURIComponent(videoId);
  const webUrl = httpsWatchUrl(videoId);

  try {
    const appResult = await AppLauncher.openUrl({ url: appUrl });
    if (appResult?.completed) return;
  } catch {
    // The YouTube app may not be installed or may not handle its custom scheme.
  }

  try {
    const webResult = await AppLauncher.openUrl({ url: webUrl });
    if (webResult?.completed) return;
  } catch {
    // Fall through to normal browser navigation if the native launcher fails.
  }

  window.location.assign(webUrl);
}

let openingYouTube = false;

document.addEventListener('click', async (event) => {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;

  const target = event.target instanceof Element ? event.target : null;
  const link = target?.closest('#watch-youtube, #youtube-fallback');
  if (!link) return;

  const videoId = getVideoId(link.href);
  if (!videoId) return;

  event.preventDefault();
  event.stopPropagation();

  if (openingYouTube) return;
  openingYouTube = true;

  try {
    // Hand off to the official YouTube app. YouTube Premium background playback
    // remains handled by YouTube itself; the HoloTracks embed stays foreground-only.
    await openOfficialYouTube(videoId);
  } finally {
    openingYouTube = false;
  }
}, true);
