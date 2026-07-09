import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import {
  useTheme,
  Button,
  IconButton,
  Surface,
  Text as PaperText,
  Divider,
  Searchbar,
  Card,
} from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { io, Socket } from 'socket.io-client';
import { WebView } from 'react-native-webview';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { RootStackParamList } from '../navigation/AppNavigator';
import { backend } from '../api/backend';
import { getToken } from '../api/client';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import Avatar from '../components/Avatar';

type Props = NativeStackScreenProps<RootStackParamList, 'RoomWatch'>;

interface RoomMember {
  id: number;
  username?: string;
  avatarUrl?: string | null;
  avatarColor?: string;
  avatarFrame?: string | null;
}

interface ChatMessage {
  id?: number | string;
  userId?: number;
  username?: string;
  body: string;
  createdAt?: string;
  avatarUrl?: string | null;
  avatarColor?: string;
}

interface RoomState {
  playing?: boolean;
  time?: number;
  updatedAt?: string;
}

interface RoomVideo {
  url?: string;
  hls?: string;
  title?: string;
  poster?: string;
  anilibriaId?: string | number;
  source?: string;
}

interface WatchRoom {
  id: number | string;
  name?: string;
  code?: string;
  hostId?: number;
  host?: { id: number; username?: string };
  members?: RoomMember[];
  messages?: ChatMessage[];
  video?: RoomVideo | null;
  state?: RoomState;
  playing?: boolean;
  time?: number;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const VIDEO_HEIGHT = Math.round((SCREEN_WIDTH * 9) / 16);

// ---- HLS / embed player HTML ----
function buildPlayerHtml(video: RoomVideo | null | undefined): string {
  const rawSrc = video?.hls || video?.url || '';
  const isHls = /\.m3u8(\?|$)/i.test(rawSrc);
  const isEmbed = !isHls && /^https?:\/\//i.test(rawSrc) && !/\.(mp4|webm|ogg|m3u8)(\?|$)/i.test(rawSrc);

  // For embeds (kodik/iframes), render directly.
  if (isEmbed) {
    return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head>
<body style="margin:0;padding:0;background:#000;overflow:hidden">
<iframe src="${rawSrc}" style="width:100%;height:100%;border:0" allowfullscreen allow="autoplay;fullscreen;encrypted-media"></iframe>
</body></html>`;
  }

  const src = rawSrc;
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head>
<body style="margin:0;padding:0;background:#000;overflow:hidden">
<video id="v" style="width:100%;height:100%;object-fit:contain;background:#000" playsinline webkit-playsinline></video>
<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
<script>
(function(){
  var v=document.getElementById('v');
  var hls=null;
  var currentSrc="";
  function loadSrc(src){
    if(!src){return;}
    if(src===currentSrc){return;}
    currentSrc=src;
    try{if(hls){hls.destroy();hls=null;}}catch(e){}
    var isHls=/\\.m3u8(\\?|$)/i.test(src);
    if(isHls&&window.Hls&&Hls.isSupported()){
      hls=new Hls();
      hls.loadSource(src);
      hls.attachMedia(v);
    }else if(isHls&&v.canPlayType('application/vnd.apple.mpegurl')){
      v.src=src;
    }else{
      v.src=src;
    }
  }
  window._setSource=function(src){ loadSrc(src); try{v.play().catch(function(){});}catch(e){} };
  window._play=function(){ try{v.play().catch(function(){});}catch(e){} };
  window._pause=function(){ try{v.pause();}catch(e){} };
  window._seek=function(t){ try{if(v.duration&&t<=v.duration){v.currentTime=t;}}catch(e){} };
  window._getTime=function(){ try{return v.currentTime||0;}catch(e){return 0;} };
  loadSrc(${JSON.stringify(src)});
  if(window.__autoPlay){ try{v.play().catch(function(){});}catch(e){} }
})();
</script>
</body></html>`;
}

export default function RoomWatchScreen(props: Props) {
  const { navigation, route } = props;
  const { roomId } = route.params;
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user, addToast } = useAuth();

  const { data: room, loading, error, refetch } = useApi<WatchRoom>(
    () => backend.watchRoom(roomId),
    [roomId],
  );

  // ---- live state ----
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [video, setVideo] = useState<RoomVideo | null>(null);
  const [roomState, setRoomState] = useState<RoomState>({});
  const [connected, setConnected] = useState(false);

  // chat
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  // search
  const [searchQ, setSearchQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const webviewRef = useRef<WebView | null>(null);
  const chatListRef = useRef<FlatList<ChatMessage> | null>(null);
  const lastSeekRef = useRef<number>(0);

  const isHost = useMemo(() => {
    if (!room || !user) return false;
    return room.hostId === user.id || room.host?.id === user.id;
  }, [room, user]);

  // hydrate from REST snapshot
  useEffect(() => {
    if (!room) return;
    setMembers(room.members || []);
    setMessages(room.messages || []);
    setVideo(room.video || null);
    const st: RoomState = room.state || {};
    if (room.playing !== undefined) st.playing = room.playing;
    if (room.time !== undefined) st.time = room.time;
    setRoomState(st);
  }, [room]);

  // ---- WebSocket connection ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getToken();
      if (cancelled) return;
      const sock = io('https://quickik.ru/watch-rooms', {
        transports: ['websocket'],
        auth: { token },
      });
      socketRef.current = sock;

      sock.on('connect', () => {
        setConnected(true);
        sock.emit('room:join', { roomId });
      });
      sock.on('disconnect', () => setConnected(false));
      sock.on('connect_error', () => setConnected(false));

      sock.on('room:snapshot', (snap: any) => {
        if (!snap) return;
        if (Array.isArray(snap.members)) setMembers(snap.members);
        if (Array.isArray(snap.messages)) setMessages(snap.messages);
        if (snap.video !== undefined) setVideo(snap.video || null);
        if (snap.state) setRoomState(snap.state);
        else if (snap.playing !== undefined || snap.time !== undefined)
          setRoomState({ playing: snap.playing, time: snap.time });
      });

      sock.on('room:state', (st: any) => {
        if (!st) return;
        setRoomState((prev) => ({ ...prev, ...st }));
      });

      sock.on('room:members', (ms: any) => {
        if (Array.isArray(ms)) setMembers(ms);
      });

      sock.on('room:video', (v: any) => {
        setVideo(v || null);
      });

      sock.on('room:message', (m: any) => {
        if (!m) return;
        setMessages((prev) => {
          const key = (m.id != null ? m.id : `${m.userId}-${m.createdAt}-${m.body}`);
          if (prev.some((x) => (x.id != null ? x.id === m.id : false)) || prev.some((x) => `${x.userId}-${x.createdAt}-${x.body}` === key)) {
            return prev;
          }
          return [...prev, m];
        });
      });
    })();

    return () => {
      cancelled = true;
      const sock = socketRef.current;
      if (sock) {
        try {
          sock.emit('room:leave', { roomId });
          sock.disconnect();
        } catch {}
        socketRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // ---- apply incoming state to the player ----
  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv) return;
    const playing = roomState.playing;
    const time = roomState.time;
    if (typeof time === 'number' && Math.abs(time - lastSeekRef.current) > 1.5) {
      lastSeekRef.current = time;
      wv.injectJavaScript(`if(window._seek){window._seek(${time});}`);
    }
    if (playing === true) {
      wv.injectJavaScript(`if(window._play){window._play();}`);
    } else if (playing === false) {
      wv.injectJavaScript(`if(window._pause){window._pause();}`);
    }
  }, [roomState]);

  // ---- host: broadcast state via HTTP PATCH ----
  const patchState = useCallback(
    async (patch: Partial<RoomState>) => {
      setRoomState((prev) => ({ ...prev, ...patch }));
      if (isHost) {
        try {
          await backend.updateWatchRoomState(roomId, patch);
        } catch (e: any) {
          addToast('Не удалось обновить состояние', 'error');
        }
      }
    },
    [isHost, roomId, addToast],
  );

  const onPlayPause = useCallback(() => {
    const next = !roomState.playing;
    patchState({ playing: next });
  }, [roomState.playing, patchState]);

  const onSeek = useCallback(
    (delta: number) => {
      const cur = roomState.time || 0;
      patchState({ time: Math.max(0, cur + delta) });
    },
    [roomState.time, patchState],
  );

  // periodically report host time so others stay in sync
  useEffect(() => {
    if (!isHost || !roomState.playing) return;
    const iv = setInterval(() => {
      const wv = webviewRef.current;
      if (!wv) return;
      wv.injectJavaScript(
        `window.ReactNativeWebView.postMessage(JSON.stringify({type:'time',t:window._getTime?window._getTime():0}));true;`,
      );
    }, 4000);
    return () => clearInterval(iv);
  }, [isHost, roomState.playing]);

  const onWebViewMessage = useCallback(
    (event: any) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);
        if (msg?.type === 'time' && typeof msg.t === 'number' && isHost) {
          lastSeekRef.current = msg.t;
          backend.updateWatchRoomState(roomId, { time: msg.t }).catch(() => {});
        }
      } catch {}
    },
    [isHost, roomId],
  );

  // ---- chat ----
  const sendMessage = useCallback(async () => {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    const optimistic: ChatMessage = {
      userId: user?.id,
      username: user?.username,
      body,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft('');
    try {
      await backend.sendWatchRoomMessage(roomId, { body });
    } catch (e: any) {
      addToast(e?.message || 'Не удалось отправить сообщение', 'error');
    } finally {
      setSending(false);
    }
  }, [draft, user, roomId, addToast]);

  // ---- anilibria search ----
  const runSearch = useCallback(async () => {
    const q = searchQ.trim();
    if (!q) return;
    setSearching(true);
    try {
      const res = await backend.searchAnilibria(q);
      const list = Array.isArray(res) ? res : res?.releases || res?.data || res?.list || [];
      setResults(list);
    } catch (e: any) {
      addToast(e?.message || 'Поиск недоступен', 'error');
    } finally {
      setSearching(false);
    }
  }, [searchQ, addToast]);

  const selectVideo = useCallback(
    async (item: any) => {
      if (!user) return;
      const id = item?.id ?? item?.code;
      const title = item?.names?.ru || item?.name || item?.title || item?.names?.en || String(id);
      const poster = item?.posterUrl || item?.poster || item?.image || undefined;
      // prefer HLS from search payload if present
      let hls: string | undefined =
        item?.hls || item?.player?.hls || item?.player?.playlist || item?.videos?.[0]?.hls;
      const payload: RoomVideo = {
        source: 'anilibria',
        anilibriaId: id != null ? String(id) : undefined,
        title,
        poster,
        hls,
      };
      // If no hls in search result, try fetching the release/episode to resolve a stream.
      if (!hls && id != null) {
        try {
          const ep: any = await backend.anilibriaRelease(id);
          hls =
            ep?.player?.hls ||
            ep?.player?.playlist ||
            ep?.hls ||
            ep?.videos?.[0]?.hls ||
            ep?.player?.alternative?.hls;
          if (hls) payload.hls = hls;
        } catch {
          /* server may still resolve by anilibriaId */
        }
      }
      try {
        await backend.setWatchRoomVideo(roomId, payload);
        setVideo(payload);
        setShowSearch(false);
        addToast('Видео установлено', 'success');
      } catch (e: any) {
        addToast(e?.message || 'Не удалось установить видео', 'error');
      }
    },
    [user, roomId, addToast],
  );

  // ---- leave ----
  const onLeave = useCallback(async () => {
    try {
      await backend.leaveWatchRoom(roomId);
    } catch {
      /* ignore */
    }
    navigation.goBack();
  }, [roomId, navigation]);

  // set header title
  useEffect(() => {
    navigation.setOptions({ title: room?.name || `Комната #${roomId}` });
  }, [navigation, room?.name, roomId]);

  if (loading) return <LoadingState label="Подключение к комнате…" />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;
  if (!room) return <EmptyState icon="account-group-outline" message="Комната не найдена" />;

  const playerHtml = buildPlayerHtml(video);

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const mine = user && item.userId === user.id;
    return (
      <View style={[styles.msgRow, mine ? styles.msgRowMine : null]}>
        {!mine ? <Avatar user={item as any} size={28} /> : null}
        <View style={[styles.msgBubble, mine ? { backgroundColor: theme.colors.primary } : { backgroundColor: theme.colors.surfaceContainerHigh }]}>
          {!mine ? (
            <Text style={[styles.msgAuthor, { color: theme.colors.primary }]}>{item.username || 'Гость'}</Text>
          ) : null}
          <Text style={[styles.msgBody, { color: mine ? theme.colors.onPrimary : theme.colors.onSurface }]}>{item.body}</Text>
        </View>
      </View>
    );
  };

  const renderMember = ({ item }: { item: RoomMember }) => (
    <View style={styles.memberChip}>
      <Avatar user={item} size={36} />
      <Text style={[styles.memberName, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
        {item.username || 'Гость'}
      </Text>
    </View>
  );

  const renderResult = ({ item }: { item: any }) => {
    const title = item?.names?.ru || item?.name || item?.title || item?.names?.en || 'Без названия';
    const poster = item?.posterUrl || item?.poster || item?.image;
    return (
      <Card style={styles.resultCard} onPress={() => selectVideo(item)}>
        <Card.Title
          title={title}
          titleNumberOfLines={2}
          titleStyle={{ fontSize: 14, color: theme.colors.onSurface }}
        />
      </Card>
    );
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        {/* Player */}
        <View style={[styles.playerWrap, { backgroundColor: '#000' }]}>
          {video?.hls || video?.url ? (
            <WebView
              ref={(r) => { webviewRef.current = r; }}
              source={{ html: playerHtml, baseUrl: 'https://quickik.ru' }}
              originWhitelist={['*']}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled
              domStorageEnabled
              onMessage={onWebViewMessage}
              style={styles.webview}
            />
          ) : (
            <View style={styles.noVideo}>
              <MaterialCommunityIcons name="movie-off-outline" size={40} color="#888" />
              <Text style={styles.noVideoText}>Видео не выбрано</Text>
              {isHost ? (
                <Button mode="contained" onPress={() => setShowSearch(true)} style={{ marginTop: 12 }}>
                  Найти на AniLibria
                </Button>
              ) : null}
            </View>
          )}

          {/* connection badge */}
          <View style={[styles.badge, { backgroundColor: connected ? '#1b5e20' : '#424242' }]}>
            <Text style={styles.badgeText}>{connected ? 'В сети' : 'Подключение…'}</Text>
          </View>
        </View>

        {/* Host controls */}
        <Surface style={[styles.controls, { backgroundColor: theme.colors.surfaceContainer }]} elevation={0}>
          {video?.title ? (
            <Text style={[styles.videoTitle, { color: theme.colors.onSurface }]} numberOfLines={1}>
              {video.title}
            </Text>
          ) : null}
          <View style={styles.controlsRow}>
            {isHost ? (
              <>
                <IconButton
                  icon="rewind-10"
                  onPress={() => onSeek(-10)}
                  iconColor={theme.colors.onSurface}
                />
                <IconButton
                  icon={roomState.playing ? 'pause' : 'play'}
                  onPress={onPlayPause}
                  size={28}
                  iconColor={theme.colors.primary}
                />
                <IconButton
                  icon="fast-forward-10"
                  onPress={() => onSeek(10)}
                  iconColor={theme.colors.onSurface}
                />
                <View style={{ flex: 1 }} />
                <Button mode="text" onPress={() => setShowSearch(true)} icon="magnify">
                  Видео
                </Button>
              </>
            ) : (
              <>
                <MaterialCommunityIcons
                  name={roomState.playing ? 'play' : 'pause'}
                  size={20}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text style={[styles.syncText, { color: theme.colors.onSurfaceVariant }]}>
                  {roomState.playing ? 'Воспроизведение' : 'Пауза'}
                  {typeof roomState.time === 'number' ? `  •  ${formatTime(roomState.time)}` : ''}
                </Text>
                <View style={{ flex: 1 }} />
              </>
            )}
            <Button mode="outlined" compact onPress={onLeave} textColor={theme.colors.error}>
              Выйти
            </Button>
          </View>
        </Surface>

        {/* Members */}
        <View style={[styles.membersWrap, { backgroundColor: theme.colors.background }]}>
          <FlatList
            data={members}
            keyExtractor={(m, i) => String(m.id ?? i)}
            renderItem={renderMember}
            horizontal
            showsHorizontalScrollIndicator={false}
            ListEmptyComponent={
              <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}>
                Нет участников
              </Text>
            }
          />
        </View>

        <Divider />

        {/* Search overlay */}
        {showSearch ? (
          <View style={[styles.searchOverlay, { backgroundColor: theme.colors.background }]}>
            <View style={styles.searchHeader}>
              <Searchbar
                placeholder="Поиск на AniLibria…"
                value={searchQ}
                onChangeText={setSearchQ}
                onSubmitEditing={runSearch}
                style={{ flex: 1 }}
              />
              <IconButton icon="close" onPress={() => setShowSearch(false)} />
            </View>
            {searching ? (
              <ActivityIndicator style={{ padding: 16 }} color={theme.colors.primary} />
            ) : (
              <FlatList
                data={results}
                keyExtractor={(item, i) => String(item?.id ?? item?.code ?? i)}
                renderItem={renderResult}
                style={{ flex: 1 }}
                ListEmptyComponent={
                  <Text style={{ color: theme.colors.onSurfaceVariant, padding: 16, textAlign: 'center' }}>
                    {searchQ ? 'Ничего не найдено' : 'Введите запрос для поиска'}
                  </Text>
                }
              />
            )}
          </View>
        ) : (
          /* Chat */
          <View style={styles.flex}>
            <FlatList
              ref={(r) => { chatListRef.current = r; }}
              data={messages}
              keyExtractor={(m, i) => String(m.id ?? `${m.userId}-${m.createdAt}-${i}`)}
              renderItem={renderMessage}
              contentContainerStyle={{ padding: 12, paddingBottom: 8 }}
              onContentSizeChange={() =>
                chatListRef.current?.scrollToEnd({ animated: true })
              }
              ListEmptyComponent={
                <Text style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginTop: 24 }}>
                  Сообщений пока нет. Будьте первым!
                </Text>
              }
            />
            <Divider />
            <View style={[styles.inputRow, { backgroundColor: theme.colors.surfaceContainer }]}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Сообщение…"
                placeholderTextColor={theme.colors.onSurfaceVariant}
                style={[styles.input, { color: theme.colors.onSurface }]}
                editable={!sending}
              />
              <IconButton
                icon="send"
                onPress={sendMessage}
                disabled={!draft.trim() || sending}
                iconColor={theme.colors.primary}
              />
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function formatTime(s: number): string {
  if (!s || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  playerWrap: {
    width: '100%',
    height: VIDEO_HEIGHT,
    minHeight: 200,
  },
  webview: { flex: 1, backgroundColor: '#000' },
  noVideo: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noVideoText: { color: '#aaa', marginTop: 8 },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  controls: { paddingHorizontal: 8, paddingVertical: 4 },
  videoTitle: { fontSize: 14, fontWeight: '600', paddingHorizontal: 8, paddingTop: 6 },
  controlsRow: { flexDirection: 'row', alignItems: 'center' },
  syncText: { fontSize: 13, marginLeft: 8 },
  membersWrap: { paddingVertical: 8, paddingHorizontal: 8 },
  memberChip: { alignItems: 'center', marginRight: 14, width: 60 },
  memberName: { fontSize: 11, marginTop: 4, textAlign: 'center' },
  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 10,
    maxWidth: '100%',
  },
  msgRowMine: {
    justifyContent: 'flex-end',
  },
  msgBubble: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: '78%',
    marginLeft: 8,
  },
  msgAuthor: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
  msgBody: { fontSize: 14, lineHeight: 19 },
  searchOverlay: { flex: 1 },
  searchHeader: { flexDirection: 'row', alignItems: 'center', paddingRight: 0 },
  resultCard: { marginHorizontal: 12, marginVertical: 4, borderRadius: 14 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  input: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: 12,
    fontSize: 15,
  },
});
