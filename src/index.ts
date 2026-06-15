import type {
  ArtistCredit,
  ArtworkPurpose,
  ArtworkSet,
  NuclearPlugin,
  NuclearPluginAPI,
  PlaybackState,
  QueueItem,
} from '@nuclearplayer/plugin-sdk';

const formatArtistNames = (artists: ArtistCredit[]): string =>
  artists.map((a) => a.name).join(', ');

const pickArtworkUrl = (
  set: ArtworkSet | undefined,
  purpose: ArtworkPurpose,
): { url: string; width?: number; height?: number } | undefined => {
  if (!set?.items?.length) {
    return undefined;
  }
  const match =
    set.items.find((i) => i.url && i.purpose === purpose) ??
    set.items.find((i) => i.url);
  return match?.url
    ? { url: match.url, width: match.width, height: match.height }
    : undefined;
};

const hasMediaSession = (): boolean =>
  typeof navigator !== 'undefined' && 'mediaSession' in navigator;

const buildArtwork = (item: QueueItem): MediaImage[] => {
  const set = item.track.artwork;
  const art = pickArtworkUrl(set, 'cover') ?? pickArtworkUrl(set, 'thumbnail');
  if (!art) {
    return [];
  }
  return [
    {
      src: art.url,
      sizes: art.width && art.height ? `${art.width}x${art.height}` : undefined,
    },
  ];
};

const setMetadata = (item: QueueItem | undefined): void => {
  if (!hasMediaSession()) {
    return;
  }
  if (!item) {
    navigator.mediaSession.metadata = null;
    return;
  }
  const { track } = item;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: formatArtistNames(track.artists ?? []),
    album: track.album?.title ?? '',
    artwork: buildArtwork(item),
  });
};

const STATUS_MAP: Record<PlaybackState['status'], MediaSessionPlaybackState> = {
  playing: 'playing',
  paused: 'paused',
  stopped: 'none',
};

const setPlaybackState = (state: PlaybackState): void => {
  if (!hasMediaSession()) {
    return;
  }
  navigator.mediaSession.playbackState = STATUS_MAP[state.status];

  // setPositionState throws if duration is invalid or position > duration.
  if (state.status !== 'stopped' && state.duration > 0) {
    try {
      navigator.mediaSession.setPositionState({
        duration: state.duration,
        playbackRate: 1,
        position: Math.min(Math.max(state.seek, 0), state.duration),
      });
    } catch {
      // ignore invalid position updates
    }
  }
};

let unsubscribers: Array<() => void> = [];

const ALL_ACTIONS: MediaSessionAction[] = [
  'play',
  'pause',
  'stop',
  'nexttrack',
  'previoustrack',
  'seekto',
];

const registerHandlers = (api: NuclearPluginAPI): void => {
  if (!hasMediaSession()) {
    return;
  }
  const ms = navigator.mediaSession;
  ms.setActionHandler('play', () => void api.Playback.play());
  ms.setActionHandler('pause', () => void api.Playback.pause());
  ms.setActionHandler('stop', () => void api.Playback.stop());
  ms.setActionHandler('nexttrack', () => void api.Queue.goToNext());
  ms.setActionHandler('previoustrack', () => void api.Queue.goToPrevious());
  ms.setActionHandler('seekto', (details) => {
    if (typeof details.seekTime === 'number') {
      void api.Playback.seekTo(details.seekTime);
    }
  });
};

const clearHandlers = (): void => {
  if (!hasMediaSession()) {
    return;
  }
  for (const action of ALL_ACTIONS) {
    try {
      navigator.mediaSession.setActionHandler(action, null);
    } catch {
      // some actions may be unsupported in this webview
    }
  }
  navigator.mediaSession.metadata = null;
  navigator.mediaSession.playbackState = 'none';
};

const plugin: NuclearPlugin = {
  async onEnable(api: NuclearPluginAPI) {
    if (!hasMediaSession()) {
      api.Logger.warn(
        'navigator.mediaSession is unavailable in this webview; media controls will not be exposed.',
      );
      return;
    }

    registerHandlers(api);

    // Prime current state.
    setMetadata(await api.Queue.getCurrentItem());
    setPlaybackState(await api.Playback.getState());

    unsubscribers.push(
      api.Queue.subscribeToCurrentItem((item) => setMetadata(item)),
      api.Playback.subscribe((state) => setPlaybackState(state)),
    );

    api.Logger.info('MPRIS media controls enabled.');
  },

  async onDisable() {
    for (const off of unsubscribers) {
      off();
    }
    unsubscribers = [];
    clearHandlers();
  },
};

export default plugin;
