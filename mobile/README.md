# HoloTracks for Android

This is the Capacitor-based Android wrapper for the existing HoloTracks website. The website remains the canonical catalogue and is not rewritten by the Android build.

## Build an APK with GitHub Actions

1. Push this branch or open its pull request.
2. Open **Actions → Build Android APK**.
3. Wait for the workflow to finish successfully.
4. Open the run and download the `holotracks-debug-apk` artifact.
5. Extract the ZIP and install `app-debug.apk` on your Android phone. You may need to allow installation from your browser or file manager.

You can also run the workflow manually through **Actions → Build Android APK → Run workflow** after the workflow exists on the default branch.

## Local build

Requires Node.js 22, Java 21, Android SDK platform 36, and Android build tools 36.0.0.

```bash
npm install
npm test
npm run mobile:prepare
npx cap add android       # only on first setup
npx cap sync android
cd android
./gradlew assembleDebug
```

The APK is generated at `android/app/build/outputs/apk/debug/app-debug.apk`.

## YouTube and background playback

HoloTracks uses YouTube's official embedded player for in-app playback. YouTube's developer policies prohibit third-party clients from keeping embedded YouTube video/audio playing through a hidden or background player. A YouTube Premium subscription does not change that restriction for HoloTracks' embedded player.

On Android, tapping **Watch on YouTube** or **Open this video on YouTube** hands the selected video to the official YouTube app. If YouTube Premium is active on that device/account, background playback and lock-screen controls are then provided by YouTube. The handoff is for the selected video only; it does not transfer HoloTracks' custom queue or mixtape into YouTube.

This approach intentionally does not extract audio from YouTube, hide the video player, bypass membership restrictions, or imitate Premium inside HoloTracks.
