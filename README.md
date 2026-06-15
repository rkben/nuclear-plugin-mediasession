# Nuclear MediaSession Plugin

Exposes Nuclear's playback to your desktop's media controls (MPRIS on Linux, and
the OS media overlay on other platforms) so you can play/pause, skip tracks, seek,
and see the current track's metadata and cover art from outside the app.

## How it works

Nuclear plugins run inside the Tauri **WebKitGTK webview**, which is a browser
context — there's no Node runtime and no way to open a D-Bus socket directly, so a
plugin can't speak the MPRIS D-Bus protocol itself. Instead this plugin drives the
standard Web [`navigator.mediaSession`](https://developer.mozilla.org/docs/Web/API/Media_Session_API)
API:

- On enable it sets up action handlers (`play`, `pause`, `stop`, `nexttrack`,
  `previoustrack`, `seekto`) wired to `api.Playback` and `api.Queue`.
- It mirrors the current queue item into `mediaSession.metadata` (title, artist,
  album, cover art) and the playback status/position into `mediaSession`.

On Linux, **WebKitGTK bridges the Media Session API to MPRIS**
(`org.mpris.MediaPlayer2`), so tools like `playerctl`, GNOME/KDE media widgets, and
media keys work without any native code.

> **Note:** the WebKitGTK → MPRIS bridge depends on your WebKitGTK build. Verify
> with `playerctl -l` while a track is playing in Nuclear.

## Development

```bash
pnpm install
pnpm typecheck   # type check
pnpm build       # bundle to dist/ (verification only)
```

Nuclear compiles `src/index.ts` in-browser, so the published plugin ships the
TypeScript source (see `main` in `package.json`).

## License

This is free and unencumbered software released into the public domain
([Unlicense](https://unlicense.org)). See `LICENSE`.
