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
    const result = await AppLauncher.openUrl({
      url: YOUTUBE_APP_SCHEME + encodeURIComponent(videoId)
    });
    if (result?.completed) return;

    await AppLauncher.openUrl({ url: httpsWatchUrl(videoId) });
  } catch (error) {
    try {
      await AppLauncher.openUrl({ url: httpsWatchUrl(videoId) });
    } catch {
      window.location.assign(httpsWatchUrl(videoId));
    }
  } finally {
    openingYouTube = false;
  }
}, true);
