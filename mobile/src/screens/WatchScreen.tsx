import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, ScrollView, StyleSheet, Dimensions, useWindowDimensions } from 'react-native';
import {
  useTheme as usePaperTheme,
  Text,
  Chip,
  IconButton,
  Divider,
  ActivityIndicator,
  Surface,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { RootStackParamList } from '../navigation/AppNavigator';
import { api, poster as extractPoster } from '../api/yummy';
import { backend } from '../api/backend';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { LoadingState, ErrorState, EmptyState } from '../components/States';

type Props = NativeStackScreenProps<RootStackParamList, 'Watch'>;

interface VideoEntry {
  video_id: number;
  number: number | string;
  index?: number;
  duration?: number;
  iframe_url?: string;
  hls_url?: string;
  video_url?: string;
  data?: {
    dubbing?: string;
    player?: string;
    [k: string]: any;
  };
  // some payloads put dubbing/player at top level
  dubbing?: string;
  player?: string;
}

interface WatchedRow {
  episodeNumber?: string | number;
  second?: number;
  duration?: number;
  completed?: boolean;
}

const HLS_CDN = 'https://cdn.jsdelivr.net/npm/hls.js@latest';

function isHlsUrl(url?: string): boolean {
  if (!url) return false;
  return /\.m3u8(\?|$)/i.test(url) || /\/m3u8\//i.test(url);
}

// Normalize player URL: add protocol if missing (prevents "file://" errors in WebView).
function normalizePlayerUrl(url: string): string {
  if (url.startsWith('//')) return 'https:' + url;
  if (!url.startsWith('http')) return 'https://' + url;
  return url;
}

// Build an HTML page that embeds the player via iframe — exactly like the web frontend.
function buildIframeHtml(iframeUrl: string): string {
  const url = normalizePlayerUrl(iframeUrl);
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  html,body { margin:0; padding:0; height:100%; background:#000; overflow:hidden; }
  iframe { width:100%; height:100%; border:0; }
</style>
</head>
<body>
<iframe src="${url}" allowfullscreen allow="autoplay; fullscreen; encrypted-media"></iframe>
</body>
</html>`;
}

// Pick the best playable URL from a video entry.
function resolvePlayerUrl(entry: VideoEntry | undefined): { url: string; kind: 'hls' | 'iframe' } | null {
  if (!entry) return null;
  const candidates = [entry.hls_url, entry.video_url, entry.iframe_url];
  for (const c of candidates) {
    if (c && isHlsUrl(c)) return { url: normalizePlayerUrl(c), kind: 'hls' };
  }
  if (entry.iframe_url) return { url: entry.iframe_url, kind: 'iframe' as const };
  if (entry.video_url) return { url: entry.video_url, kind: 'iframe' as const };
  return null;
}

function buildHlsHtml(streamUrl: string, startAt: number): string {
  const start = Math.max(0, Math.floor(startAt || 0));
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  html,body { margin:0; padding:0; height:100%; background:#000; overflow:hidden; }
  #v { width:100%; height:100%; background:#000; }
</style>
</head>
<body>
<video id="v" playsinline webkit-playsinline controls autoplay></video>
<script src="${HLS_CDN}"></script>
<script>
(function(){
  var video = document.getElementById('v');
  var url = ${JSON.stringify(streamUrl)};
  var startAt = ${start};
  var lastPost = 0;

  function sendProgress(){
    try {
      var payload = {
        type: 'progress',
        currentTime: video.currentTime || 0,
        duration: video.duration || 0,
        paused: video.paused
      };
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    } catch(e){}
  }

  function start(){
    if (window.Hls && window.Hls.isSupported()) {
      var hls = new window.Hls({ enableWorker: true });
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(window.Hls.Events.MANIFEST_PARSED, function(){
        if (startAt && startAt > 0) {
          try { video.currentTime = startAt; } catch(e){}
        }
        var p = video.play();
        if (p && p.catch) p.catch(function(){});
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.addEventListener('loadedmetadata', function(){
        if (startAt && startAt > 0) {
          try { video.currentTime = startAt; } catch(e){}
        }
        var p = video.play();
        if (p && p.catch) p.catch(function(){});
      });
    } else {
      video.src = url;
    }
    setInterval(sendProgress, 4000);
    video.addEventListener('timeupdate', sendProgress);
    video.addEventListener('ended', function(){
      try {
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type:'ended', currentTime: video.currentTime||0, duration: video.duration||0 }));
      } catch(e){}
    });
  }

  if (window.Hls) { start(); }
  else { window.addEventListener('load', start); }
})();
</script>
</body>
</html>`;
}

export default function WatchScreen(props: Props) {
  const { route } = props;
  const { id, title, episode: resumeEpisode } = route.params;

  const theme = usePaperTheme();
  const { user, openAuthModal, addToast } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const playerHeight = Math.round((screenWidth * 9) / 16);

  // Fetch anime detail first to get the numeric anime_id for the videos API.
  const { data: animeDetail } = useApi<any>(
    () => api.anime(String(id)),
    [id],
  );
  const animeIdNum: number = animeDetail?.anime_id ?? animeDetail?.id ?? (typeof id === 'number' ? id : Number(id));
  const animeId = Number.isFinite(animeIdNum) ? animeIdNum : 0;

  const { data: videos, loading, error, refetch } = useApi<any[]>(
    () => (animeId > 0 ? api.videos(animeId) : Promise.resolve([])),
    [animeId],
  );

  const list: VideoEntry[] = useMemo(() => (Array.isArray(videos) ? videos : []), [videos]);

  // ---- dubbings ----
  const dubbings = useMemo(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    list.forEach((v) => {
      const d = v.data?.dubbing || v.dubbing || 'Озвучка';
      if (!seen.has(d)) {
        seen.add(d);
        out.push(d);
      }
    });
    return out;
  }, [list]);

  const [dub, setDub] = useState<string | null>(null);
  useEffect(() => {
    if (dubbings.length && !dub) setDub(dubbings[0]);
  }, [dubbings, dub]);

  // ---- players for selected dubbing ----
  const players = useMemo(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    list
      .filter((v) => (v.data?.dubbing || v.dubbing || 'Озвучка') === dub)
      .forEach((v) => {
        const p = v.data?.player || v.player || 'Плеер';
        if (!seen.has(p)) {
          seen.add(p);
          out.push(p);
        }
      });
    return out;
  }, [list, dub]);

  const [player, setPlayer] = useState<string | null>(null);
  useEffect(() => {
    if (players.length) setPlayer((prev) => (players.includes(prev || '') ? prev : players[0]));
  }, [players]);

  // ---- episodes for selected dubbing + player ----
  const episodes = useMemo(() => {
    return list
      .filter(
        (v) =>
          (v.data?.dubbing || v.dubbing || 'Озвучка') === dub &&
          (v.data?.player || v.player || 'Плеер') === player,
      )
      .sort((a, b) => (a.index || 0) - (b.index || 0));
  }, [list, dub, player]);

  const [currentVideoId, setCurrentVideoId] = useState<number | null>(null);

  // ---- watched / progress map ----
  const [watched, setWatched] = useState<Record<string, WatchedRow>>({});
  const watchedRef = useRef<Record<string, WatchedRow>>({});
  const [resumeSeconds, setResumeSeconds] = useState(0);

  useEffect(() => {
    if (!user || !animeId) {
      setWatched({});
      watchedRef.current = {};
      return;
    }
    let cancelled = false;
    backend
      .progressForAnime(animeId)
      .then((res: any) => {
        if (cancelled) return;
        const eps: any[] = res?.episodes || res || [];
        const map: Record<string, WatchedRow> = {};
        let resumeEp: WatchedRow | null = null;
        let resumeEpNumber: string | null = null;
        eps.forEach((e) => {
          const key = String(e.episodeNumber ?? e.episode ?? '');
          if (!key) return;
          map[key] = e;
          if (!e.completed) {
            resumeEp = e;
            resumeEpNumber = key;
          }
        });
        watchedRef.current = map;
        setWatched(map);
        // pre-load resume seconds for the incomplete episode
        if (resumeEp && resumeEpNumber) {
          setResumeSeconds(Number((resumeEp as any).second || 0));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user, animeId]);

  // ---- select current episode ----
  useEffect(() => {
    if (!episodes.length) {
      setCurrentVideoId(null);
      return;
    }
    if (currentVideoId && episodes.some((e) => e.video_id === currentVideoId)) return;

    // prefer resume episode from route param
    if (resumeEpisode != null) {
      const target = episodes.find((e) => String(e.number) === String(resumeEpisode));
      if (target) {
        setCurrentVideoId(target.video_id);
        const row = watchedRef.current[String(target.number)];
        setResumeSeconds(Number(row?.second || 0));
        return;
      }
    }
    // default to first
    const first = episodes[0];
    setCurrentVideoId(first.video_id);
    const row = watchedRef.current[String(first.number)];
    setResumeSeconds(Number(row?.second || 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodes, resumeEpisode]);

  const current = useMemo(
    () => episodes.find((e) => e.video_id === currentVideoId) || episodes[0],
    [episodes, currentVideoId],
  );

  const currentIndex = useMemo(
    () => (current ? episodes.findIndex((e) => e.video_id === current.video_id) : -1),
    [episodes, current],
  );

  const resolvedPlayer = useMemo(() => resolvePlayerUrl(current), [current]);

  // ---- save progress ----
  const lastSaveRef = useRef(0);
  const posterUrl = useMemo(() => {
    if (!animeDetail) return '';
    return extractPoster(animeDetail, 'big') || extractPoster(animeDetail, 'medium') || '';
  }, [animeDetail]);
  const saveProgress = useCallback(
    (second: number, duration: number) => {
      if (!user || !current || !animeId) return;
      const now = Date.now();
      if (now - lastSaveRef.current < 3000) return; // throttle
      lastSaveRef.current = now;
      const epNum = Number(current.number);
      if (!Number.isFinite(epNum)) return;
      backend
        .saveProgress({
          animeId,
          episode: epNum,
          second: Math.floor(second || 0),
          duration: Math.floor(duration || current.duration || 0),
          title: title,
          poster: posterUrl,
        })
        .then((row: any) => {
          if (row && row.episodeNumber != null) {
            const key = String(row.episodeNumber);
            watchedRef.current = { ...watchedRef.current, [key]: row };
            setWatched((prev) => ({ ...prev, [key]: row }));
          }
        })
        .catch(() => {});
    },
    [user, current, animeId, title],
  );

  // Mark episode visited for iframe players (best-effort progress)
  useEffect(() => {
    if (!user || !current || !animeId || !resolvedPlayer) return;
    if (resolvedPlayer.kind === 'hls') return; // HLS polls via onMessage
    const epNum = Number(current.number);
    if (!Number.isFinite(epNum)) return;
    backend
      .saveProgress({
        animeId,
        episode: epNum,
        second: 0,
        duration: Math.floor(current.duration || 0),
        title: title,
        poster: posterUrl,
      })
      .then((row: any) => {
        if (row && row.episodeNumber != null) {
          const key = String(row.episodeNumber);
          watchedRef.current = { ...watchedRef.current, [key]: row };
          setWatched((prev) => ({ ...prev, [key]: row }));
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.video_id, resolvedPlayer?.url]);

  // ---- WebView message handling (HLS progress) ----
  const onMessage = useCallback(
    (e: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(e.nativeEvent.data);
        if (data.type === 'progress' || data.type === 'ended') {
          saveProgress(Number(data.currentTime || 0), Number(data.duration || 0));
        }
      } catch {
        /* ignore */
      }
    },
    [saveProgress],
  );

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      const prev = episodes[currentIndex - 1];
      setCurrentVideoId(prev.video_id);
      setResumeSeconds(Number(watchedRef.current[String(prev.number)]?.second || 0));
    }
  }, [currentIndex, episodes]);

  const goNext = useCallback(() => {
    if (currentIndex >= 0 && currentIndex < episodes.length - 1) {
      const next = episodes[currentIndex + 1];
      setCurrentVideoId(next.video_id);
      setResumeSeconds(Number(watchedRef.current[String(next.number)]?.second || 0));
    }
  }, [currentIndex, episodes]);

  // ---- render ----
  if (!user) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]}>
        <View style={styles.center}>
          <MaterialCommunityIcons name="account-lock-outline" size={48} color={theme.colors.outline} />
          <Text variant="titleLarge" style={{ marginTop: 12, color: theme.colors.onSurface }}>
            Нужна авторизация
          </Text>
          <Text variant="bodyMedium" style={{ marginTop: 4, color: theme.colors.onSurfaceVariant }}>
            Войдите в аккаунт, чтобы смотреть серии.
          </Text>
          <Surface
            style={[styles.loginBtn, { marginTop: 20 }]}
            elevation={0}
            onTouchEnd={openAuthModal}
          >
            <Text style={{ color: theme.colors.primary, fontWeight: 600 }}>Войти</Text>
          </Surface>
        </View>
      </SafeAreaView>
    );
  }

  const stillLoading = loading || (!error && videos == null);

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]} edges={['bottom']}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <View style={styles.titleRow}>
          <Text variant="titleLarge" style={{ flexShrink: 1, fontWeight: 700 }} numberOfLines={2}>
            {title ? `Смотреть «${title}»` : 'Просмотр'}
          </Text>
        </View>

        {/* Player */}
        <View style={[styles.playerWrap, { height: playerHeight, backgroundColor: '#000' }]}>
          {stillLoading ? (
            <View style={styles.playerCenter}>
              <ActivityIndicator color={theme.colors.primary} />
              <Text style={{ color: '#fff', marginTop: 8, fontSize: 13 }}>Загрузка плеера…</Text>
            </View>
          ) : current && resolvedPlayer ? (
            resolvedPlayer.kind === 'hls' ? (
              <WebView
                source={{ html: buildHlsHtml(resolvedPlayer.url, resumeSeconds) }}
                style={{ flex: 1, height: playerHeight, backgroundColor: '#000' }}
                originWhitelist={['*']}
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                onMessage={onMessage}
                javaScriptEnabled
                domStorageEnabled
                renderLoading={() => (
                  <View style={styles.playerCenter}>
                    <ActivityIndicator color={theme.colors.primary} />
                  </View>
                )}
              />
            ) : (
              <WebView
                source={{ html: buildIframeHtml(resolvedPlayer.url) }}
                style={{ flex: 1, height: playerHeight, backgroundColor: '#000' }}
                originWhitelist={['*']}
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                javaScriptEnabled
                domStorageEnabled
                renderLoading={() => (
                  <View style={styles.playerCenter}>
                    <ActivityIndicator color={theme.colors.primary} />
                  </View>
                )}
              />
            )
          ) : (
            <View style={styles.playerCenter}>
              <Text style={{ color: '#fff', fontSize: 14 }}>Выберите эпизод</Text>
            </View>
          )}
        </View>

        {/* Prev / Next */}
        {episodes.length > 0 && current && (
          <View style={[styles.navRow, { backgroundColor: theme.colors.surfaceContainer }]}>
            <IconButton
              icon="chevron-left"
              size={24}
              disabled={currentIndex <= 0}
              onPress={goPrev}
              iconColor={theme.colors.onSurface}
            />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
                Эпизод {current.number}
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                {currentIndex + 1} / {episodes.length}
              </Text>
            </View>
            <IconButton
              icon="chevron-right"
              size={24}
              disabled={currentIndex < 0 || currentIndex >= episodes.length - 1}
              onPress={goNext}
              iconColor={theme.colors.onSurface}
            />
          </View>
        )}

        {/* States */}
        {error ? (
          <View style={{ padding: 16 }}>
            <ErrorState message={error.message} onRetry={refetch} />
          </View>
        ) : null}

        {!stillLoading && !error && list.length === 0 ? (
          <View style={{ padding: 16 }}>
            <EmptyState
              icon="television-off"
              message="Для этого аниме пока нет доступных плееров."
            />
          </View>
        ) : null}

        {/* Dubbings */}
        {dubbings.length > 1 ? (
          <View style={styles.section}>
            <Text variant="labelLarge" style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
              Озвучка
            </Text>
            <View style={styles.chipRow}>
              {dubbings.map((d) => (
                <Chip
                  key={d}
                  selected={d === dub}
                  onPress={() => setDub(d)}
                  style={styles.chip}
                  mode={d === dub ? 'flat' : 'outlined'}
                >
                  {d}
                </Chip>
              ))}
            </View>
          </View>
        ) : null}

        {/* Players */}
        {players.length > 1 ? (
          <View style={styles.section}>
            <Text variant="labelLarge" style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
              Плеер
            </Text>
            <View style={styles.chipRow}>
              {players.map((p) => (
                <Chip
                  key={p}
                  selected={p === player}
                  onPress={() => setPlayer(p)}
                  style={styles.chip}
                  mode={p === player ? 'flat' : 'outlined'}
                >
                  {p}
                </Chip>
              ))}
            </View>
          </View>
        ) : null}

        {/* Episodes */}
        {episodes.length > 0 ? (
          <View style={styles.section}>
            <Text variant="labelLarge" style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
              Эпизоды · {episodes.length}
            </Text>
            <View style={styles.episodeGrid}>
              {episodes.map((ep) => {
                const isActive = ep.video_id === current?.video_id;
                const sv = watched[String(ep.number)];
                const isWatched = sv?.completed;
                return (
                  <Surface
                    key={String(ep.video_id)}
                    style={[
                      styles.epBtn,
                      {
                        backgroundColor: isActive
                          ? theme.colors.primary
                          : isWatched
                            ? theme.colors.surfaceContainerHigh
                            : theme.colors.surfaceContainer,
                        borderColor: isWatched && !isActive ? theme.colors.primary : theme.colors.outlineVariant,
                      },
                    ]}
                    elevation={isActive ? 1 : 0}
                    onTouchEnd={() => {
                      setCurrentVideoId(ep.video_id);
                      setResumeSeconds(Number(watchedRef.current[String(ep.number)]?.second || 0));
                    }}
                  >
                    <Text
                      style={{
                        color: isActive ? theme.colors.onPrimary : theme.colors.onSurface,
                        fontWeight: isActive || isWatched ? 700 : 500,
                        fontSize: 13,
                      }}
                    >
                      {String(ep.number)}
                      {isWatched && !isActive ? ' ✓' : ''}
                    </Text>
                  </Surface>
                );
              })}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  titleRow: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
  },
  playerWrap: {
    width: '100%',
  },
  playerCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navRow: {
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  section: {
    paddingHorizontal: 12,
    marginTop: 18,
  },
  sectionLabel: {
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    marginBottom: 4,
  },
  episodeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  epBtn: {
    minWidth: 48,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  loginBtn: {
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
});
