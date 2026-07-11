import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
  RefreshControl,
  FlatList,
} from 'react-native';
import {
  Text,
  Button,
  IconButton,
  Chip,
  Menu,
  Divider,
  TextInput,
  Surface,
  useTheme,
  ActivityIndicator,
} from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { RootStackParamList } from '../navigation/AppNavigator';
import { api, poster as posterUrl, upgradePoster } from '../api/yummy';
import { backend } from '../api/backend';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import Poster from '../components/Poster';
import Avatar from '../components/Avatar';
import AnimeCard from '../components/AnimeCard';
import SectionHeader from '../components/SectionHeader';
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import { SCREEN_WIDTH } from '../utils/layout';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = NativeStackScreenProps<RootStackParamList, 'AnimeDetail'>;

const BOOKMARK_STATUSES: { value: string; label: string; icon: string }[] = [
  { value: 'watching', label: 'Смотрю', icon: 'play' },
  { value: 'planned', label: 'В планах', icon: 'calendar-clock' },
  { value: 'completed', label: 'Просмотрено', icon: 'check-circle' },
  { value: 'on_hold', label: 'Отложено', icon: 'pause-circle' },
  { value: 'dropped', label: 'Брошено', icon: 'close-circle' },
  { value: 'favorite', label: 'Любимое', icon: 'heart' },
];

const STATUS_LABELS: Record<string, string> = {
  ongoing: 'Онгоинг',
  released: 'Вышел',
  announced: 'Анонс',
  ongoing_: 'Онгоинг',
};

function formatTime(iso?: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function safe<T>(p: Promise<T>): Promise<T | null> {
  return p.then(
    (v) => v,
    () => null,
  );
}

export default function AnimeDetailScreen(props: Props) {
  const { navigation, route } = props;
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user, openAuthModal, addToast } = useAuth();

  const animeId = route.params.id;
  const animeIdNum = typeof animeId === 'number' ? animeId : Number(animeId) || 0;

  // ---- data ----
  const {
    data: anime,
    loading,
    error,
    refetch: refetchAnime,
  } = useApi(() => api.anime(animeId), [animeId]);

  const {
    data: bookmark,
    refetch: refetchBookmark,
  } = useApi(() => safe(backend.getBookmark(animeId)), [animeId, user?.id]);

  const {
    data: rating,
    refetch: refetchRating,
  } = useApi(() => safe(backend.getRating(animeId)), [animeId, user?.id]);

  const {
    data: openingRatings,
    refetch: refetchOpening,
  } = useApi(() => safe(backend.getOpeningRatings(animeId)), [animeId, user?.id]);

  const {
    data: comments,
    refetch: refetchComments,
  } = useApi(() => safe(backend.listComments(animeId)), [animeId, user?.id]);

  const {
    data: recs,
  } = useApi(() => safe(api.recommendations(animeId)), [animeId]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refetchAnime(),
      refetchBookmark(),
      refetchRating(),
      refetchOpening(),
      refetchComments(),
    ]);
    setRefreshing(false);
  }, [refetchAnime, refetchBookmark, refetchRating, refetchOpening, refetchComments]);

  // ---- derived anime fields ----
  const a: any = anime || {};
  const titleRu = a.title || a.ru_title || a.name || route.params.title || 'Без названия';
  const titleOrig = a.title_orig || a.original_title || a.en_title || a.romaji;
  const description = a.description || a.description_html || '';
  const genres: string[] = a.genres
    ? Array.isArray(a.genres)
      ? a.genres.map((g: any) => (typeof g === 'string' ? g : g.name || g.title || ''))
      : []
    : [];
  const score = typeof a.score === 'object' ? (a.score?.average ?? a.score?.score) : (a.score ?? a.rating ?? a.averageRating);
  const status = a.status ? STATUS_LABELS[a.status] || a.status : '';
  const episodes = a.episodes ?? a.episodes_total ?? a.count;
  const year = a.year || (a.aired_on ? String(a.aired_on).slice(0, 4) : '');
  const studio = a.studio?.name || a.studio || (Array.isArray(a.studios) ? a.studios.map((s: any) => s.name).join(', ') : '');

  const heroPoster = useMemo(() => {
    const u = posterUrl(a, 'huge') || posterUrl(a, 'big') || posterUrl(a, 'medium');
    return u ? upgradePoster(u, 'huge') : '';
  }, [a]);
  const backdrop = useMemo(() => {
    const u = posterUrl(a, 'mega') || heroPoster;
    return u;
  }, [a, heroPoster]);

  // ---- description expand ----
  const [expanded, setExpanded] = useState(false);

  // ---- bookmark menu ----
  const [bookmarkMenu, setBookmarkMenu] = useState(false);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const currentStatus: string | null = (bookmark as any)?.status || null;

  const requireAuth = useCallback((): boolean => {
    if (!user) {
      openAuthModal();
      return false;
    }
    return true;
  }, [user, openAuthModal]);

  const setBookmarkStatus = useCallback(
    async (status: string) => {
      setBookmarkMenu(false);
      if (!requireAuth()) return;
      if (!animeIdNum) return;
      setBookmarkBusy(true);
      try {
        await backend.upsertBookmark({ animeId: animeIdNum, status });
        addToast('Закладка обновлена', 'success');
        refetchBookmark();
      } catch (e: any) {
        addToast(e?.message || 'Не удалось сохранить закладку', 'error');
      } finally {
        setBookmarkBusy(false);
      }
    },
    [requireAuth, animeIdNum, addToast, refetchBookmark],
  );

  const removeBookmark = useCallback(async () => {
    setBookmarkMenu(false);
    if (!requireAuth()) return;
    setBookmarkBusy(true);
    try {
      await backend.removeBookmark(animeId);
      addToast('Закладка удалена', 'success');
      refetchBookmark();
    } catch (e: any) {
      addToast(e?.message || 'Не удалось удалить закладку', 'error');
    } finally {
      setBookmarkBusy(false);
    }
  }, [requireAuth, animeId, addToast, refetchBookmark]);

  // ---- rating ----
  const myRating: number | null = (rating as any)?.score ?? null;
  const [ratingBusy, setRatingBusy] = useState(false);

  const setRating = useCallback(
    async (score: number) => {
      if (!requireAuth()) return;
      if (!animeIdNum) return;
      setRatingBusy(true);
      try {
        if (myRating === score) {
          await backend.removeRating(animeId);
        } else {
          await backend.rate(animeIdNum, score);
        }
        refetchRating();
      } catch (e: any) {
        addToast(e?.message || 'Не удалось оценить', 'error');
      } finally {
        setRatingBusy(false);
      }
    },
    [requireAuth, animeIdNum, animeId, myRating, refetchRating, addToast],
  );

  // ---- opening / ending ratings ----
  const opData: any = (openingRatings as any) || {};
  const myOpScore: number | null = opData?.opening?.score ?? null;
  const myEdScore: number | null = opData?.ending?.score ?? null;
  const [opBusy, setOpBusy] = useState(false);

  const setOpRating = useCallback(
    async (type: 'opening' | 'ending', score: number) => {
      if (!requireAuth()) return;
      if (!animeIdNum) return;
      setOpBusy(true);
      try {
        const current = type === 'opening' ? myOpScore : myEdScore;
        if (current === score) {
          await backend.removeOpeningRating(animeId, type);
        } else {
          await backend.rateOpening({ animeId: animeIdNum, type, score });
        }
        refetchOpening();
      } catch (e: any) {
        addToast(e?.message || 'Не удалось оценить', 'error');
      } finally {
        setOpBusy(false);
      }
    },
    [requireAuth, animeIdNum, animeId, myOpScore, myEdScore, refetchOpening, addToast],
  );

  // ---- comments ----
  const [commentBody, setCommentBody] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);
  const commentsList: any[] = Array.isArray(comments) ? comments : (comments as any)?.items || [];

  const submitComment = useCallback(async () => {
    const body = commentBody.trim();
    if (!body) return;
    if (!requireAuth()) return;
    if (!animeIdNum) return;
    setCommentBusy(true);
    try {
      await backend.addComment({ animeId: animeIdNum, body });
      setCommentBody('');
      addToast('Комментарий добавлен', 'success');
      refetchComments();
    } catch (e: any) {
      addToast(e?.message || 'Не удалось добавить комментарий', 'error');
    } finally {
      setCommentBusy(false);
    }
  }, [commentBody, requireAuth, animeIdNum, addToast, refetchComments]);

  const likeComment = useCallback(
    async (id: number) => {
      if (!requireAuth()) return;
      try {
        await backend.likeComment(id);
        refetchComments();
      } catch (e: any) {
        addToast(e?.message || 'Не удалось лайкнуть', 'error');
      }
    },
    [requireAuth, refetchComments, addToast],
  );

  const deleteComment = useCallback(
    async (id: number) => {
      if (!requireAuth()) return;
      try {
        await backend.deleteComment(id);
        addToast('Комментарий удалён', 'success');
        refetchComments();
      } catch (e: any) {
        addToast(e?.message || 'Не удалось удалить', 'error');
      }
    },
    [requireAuth, refetchComments, addToast],
  );

  const recsList: any[] = Array.isArray(recs) ? recs : (recs as any)?.items || [];

  // ---- render ----
  if (loading && !anime) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.colors.background }]}>
        <LoadingState label="Загрузка аниме…" />
      </View>
    );
  }

  if (error && !anime) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.colors.background }]}>
        <ErrorState message={error.message} onRetry={refetchAnime} />
      </View>
    );
  }

  const toggleExpanded = () => {
    LayoutAnimation.easeInEaseOut();
    setExpanded((v) => !v);
  };

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: theme.colors.background }]} edges={['bottom']}>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
      >
        {/* Hero backdrop */}
        <View style={styles.heroWrap}>
          {backdrop ? (
            <Poster
              uri={backdrop}
              style={styles.backdrop}
              contentFit="cover"
            />
          ) : null}
          <View
            style={[
              styles.backdropScrim,
              { backgroundColor: theme.dark ? 'rgba(10,10,20,0.78)' : 'rgba(20,15,40,0.55)' },
            ]}
          />
          <View style={styles.heroRow}>
            <View style={styles.posterBox}>
              {heroPoster ? (
                <Poster uri={heroPoster} style={styles.heroPoster} contentFit="cover" />
              ) : (
                <View
                  style={[
                    styles.heroPoster,
                    { backgroundColor: theme.colors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center' },
                  ]}
                >
                  <MaterialCommunityIcons name="image-off-outline" size={32} color={theme.colors.outline} />
                </View>
              )}
            </View>
            <View style={styles.heroMeta}>
              <Text style={styles.heroTitle} variant="titleLarge" numberOfLines={3}>
                {titleRu}
              </Text>
              {titleOrig && titleOrig !== titleRu ? (
                <Text style={styles.heroOrig} numberOfLines={2}>
                  {titleOrig}
                </Text>
              ) : null}
              {score != null ? (
                <View style={styles.scoreRow}>
                  <MaterialCommunityIcons name="star" size={18} color="#FFC107" />
                  <Text style={styles.scoreText}>{Number(score).toFixed(2)}</Text>
                </View>
              ) : null}
              <View style={styles.metaChips}>
                {status ? <Text style={styles.metaText}>{status}</Text> : null}
                {year ? <Text style={styles.metaDot}>· {year}</Text> : null}
                {episodes != null ? <Text style={styles.metaDot}>· {episodes} эп.</Text> : null}
              </View>
              {studio ? (
                <Text style={styles.studioText} numberOfLines={2}>
                  {studio}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* Action row */}
        <View style={[styles.actionRow, { gap: 8 }]}>
          <Button
            mode="contained"
            icon="play"
            style={styles.watchBtn}
            labelStyle={styles.watchLabel}
            onPress={() => navigation.navigate('Watch', { id: animeId, title: titleRu })}
          >
            Смотреть
          </Button>
          <Menu
            visible={bookmarkMenu}
            onDismiss={() => setBookmarkMenu(false)}
            anchor={
              <IconButton
                icon={currentStatus ? 'bookmark' : 'bookmark-plus'}
                iconColor={currentStatus ? theme.colors.primary : theme.colors.onSurfaceVariant}
                onPress={() => {
                  if (!requireAuth()) return;
                  setBookmarkMenu(true);
                }}
                disabled={bookmarkBusy}
                style={styles.bookmarkBtn}
              />
            }
          >
            {BOOKMARK_STATUSES.map((s) => (
              <Menu.Item
                key={s.value}
                onPress={() => setBookmarkStatus(s.value)}
                title={s.label}
                leadingIcon={currentStatus === s.value ? 'check' : s.icon}
                disabled={bookmarkBusy}
              />
            ))}
            {currentStatus ? (
              <>
                <Divider />
                <Menu.Item
                  onPress={removeBookmark}
                  title="Удалить закладку"
                  leadingIcon="bookmark-remove"
                  disabled={bookmarkBusy}
                />
              </>
            ) : null}
          </Menu>
        </View>

        {currentStatus ? (
          <View style={styles.bookmarkBadgeRow}>
            <Chip
              icon={() => {
                const s = BOOKMARK_STATUSES.find((x) => x.value === currentStatus);
                return (
                  <MaterialCommunityIcons
                    name={(s?.icon as any) || 'bookmark'}
                    size={16}
                    color={theme.colors.primary}
                  />
                );
              }}
              style={{ backgroundColor: theme.colors.primaryContainer }}
            >
              {BOOKMARK_STATUSES.find((x) => x.value === currentStatus)?.label || currentStatus}
            </Chip>
          </View>
        ) : null}

        {/* Genres */}
        {genres.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.chipsRow}>
              {genres.map((g) => (
                <Chip key={g} style={styles.chip} compact mode="outlined">
                  {g}
                </Chip>
              ))}
            </View>
          </View>
        ) : null}

        {/* Description */}
        {description ? (
          <View style={styles.section}>
            <SectionHeader title="Описание" />
            <Pressable onPress={toggleExpanded}>
              <Text
                style={[styles.description, { color: theme.colors.onSurfaceVariant }]}
                numberOfLines={expanded ? undefined : 5}
              >
                {description.replace(/<[^>]+>/g, '')}
              </Text>
              <Text style={[styles.expandLink, { color: theme.colors.primary }]}>
                {expanded ? 'Свернуть' : 'Читать далее'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Rating widget */}
        <View style={styles.section}>
          <SectionHeader title="Ваша оценка" />
          <Text style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
            {myRating ? `Вы поставили ${myRating} из 10` : 'Оцените аниме от 1 до 10'}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 4 }}>
            <View style={styles.scoreRow10}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                const active = myRating === n;
                return (
                  <Pressable
                    key={n}
                    onPress={() => setRating(n)}
                    disabled={ratingBusy}
                    style={[
                      styles.scoreBtn,
                      {
                        backgroundColor: active ? theme.colors.primary : theme.colors.surfaceContainerHigh,
                        borderColor: active ? theme.colors.primary : theme.colors.outlineVariant,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.scoreBtnText,
                        { color: active ? theme.colors.onPrimary : theme.colors.onSurfaceVariant },
                      ]}
                    >
                      {n}
                    </Text>
                  </Pressable>
                );
              })}
              {ratingBusy ? (
                <ActivityIndicator style={{ marginLeft: 8 }} size="small" color={theme.colors.primary} />
              ) : null}
            </View>
          </ScrollView>
        </View>

        {/* OP / ED ratings */}
        <View style={styles.section}>
          <SectionHeader title="Оценки опенинга и эндинга" />
          <OpeningEndingRow
            label="Опенинг"
            value={myOpScore}
            busy={opBusy}
            onPick={(n) => setOpRating('opening', n)}
            theme={theme}
          />
          <Divider style={{ marginVertical: 8 }} />
          <OpeningEndingRow
            label="Эндинг"
            value={myEdScore}
            busy={opBusy}
            onPick={(n) => setOpRating('ending', n)}
            theme={theme}
          />
        </View>

        {/* Comments */}
        <View style={styles.section}>
          <SectionHeader title={`Комментарии${commentsList.length ? ` · ${commentsList.length}` : ''}`} />
          <View style={[styles.commentInputRow, { backgroundColor: theme.colors.surfaceContainer }]}>
            <TextInput
              value={commentBody}
              onChangeText={setCommentBody}
              placeholder={user ? 'Написать комментарий…' : 'Войдите, чтобы комментировать'}
              mode="flat"
              style={[styles.commentInput, { backgroundColor: 'transparent' }]}
              multiline
              maxLength={1000}
              editable={!!user}
              onFocus={() => {
                if (!user) openAuthModal();
              }}
            />
            <IconButton
              icon="send"
              iconColor={theme.colors.primary}
              onPress={submitComment}
              disabled={commentBusy || !commentBody.trim()}
              loading={commentBusy}
            />
          </View>

          {commentsList.length === 0 ? (
            <EmptyState icon="comment-off-outline" message="Пока нет комментариев. Будьте первым!" />
          ) : (
            commentsList.map((c) => (
              <CommentItem
                key={c.id ?? c._id}
                comment={c}
                currentUserId={user?.id}
                onLike={() => likeComment(c.id ?? c._id)}
                onDelete={() => deleteComment(c.id ?? c._id)}
                theme={theme}
              />
            ))
          )}
        </View>

        {/* Recommendations */}
        {recsList.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title="Рекомендации" />
            <FlatList
              horizontal
              data={recsList}
              keyExtractor={(item: any, i: number) => String(item.id ?? item._id ?? i)}
              renderItem={({ item }) => (
                <AnimeCard
                  item={item}
                  width={130}
                  onPress={(it) =>
                    navigation.navigate('AnimeDetail', {
                      id: it.id ?? it.code ?? it.url,
                      title: it.title || it.ru_title || it.name,
                    })
                  }
                />
              )}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 2, paddingVertical: 2 }}
            />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

// FlatList is imported from 'react-native' at the top of this file.

function OpeningEndingRow({
  label,
  value,
  busy,
  onPick,
  theme,
}: {
  label: string;
  value: number | null;
  busy: boolean;
  onPick: (n: number) => void;
  theme: any;
}) {
  return (
    <View>
      <Text style={[styles.opLabel, { color: theme.colors.onSurfaceVariant }]}>
        {label}
        {value ? ` · ${value}/10` : ''}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 4 }}>
        <View style={styles.scoreRow10}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
            const active = value === n;
            return (
              <Pressable
                key={n}
                onPress={() => onPick(n)}
                disabled={busy}
                style={[
                  styles.scoreBtn,
                  {
                    backgroundColor: active ? theme.colors.primary : theme.colors.surfaceContainerHigh,
                    borderColor: active ? theme.colors.primary : theme.colors.outlineVariant,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.scoreBtnText,
                    { color: active ? theme.colors.onPrimary : theme.colors.onSurfaceVariant },
                  ]}
                >
                  {n}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function CommentItem({
  comment,
  currentUserId,
  onLike,
  onDelete,
  theme,
}: {
  comment: any;
  currentUserId?: number;
  onLike: () => void;
  onDelete: () => void;
  theme: any;
}) {
  const author = comment.user || comment.author || {};
  const liked = !!comment.liked;
  const likes = comment.likes ?? comment.likesCount ?? 0;
  const isOwn = currentUserId != null && (author.id === currentUserId || comment.userId === currentUserId);

  return (
    <Surface style={[styles.commentCard, { backgroundColor: theme.colors.surfaceContainer }]} elevation={0}>
      <View style={styles.commentHead}>
        <Avatar user={author} size={34} />
        <View style={styles.commentHeadMeta}>
          <Text style={[styles.commentUser, { color: theme.colors.onSurface }]} numberOfLines={1}>
            {author.username || 'Гость'}
          </Text>
          {comment.createdAt || comment.created_at ? (
            <Text style={[styles.commentTime, { color: theme.colors.onSurfaceVariant }]}>
              {formatTime(comment.createdAt || comment.created_at)}
            </Text>
          ) : null}
        </View>
        {isOwn ? (
          <IconButton icon="delete-outline" size={20} iconColor={theme.colors.error} onPress={onDelete} />
        ) : null}
      </View>
      <Text style={[styles.commentBody, { color: theme.colors.onSurface }]}>
        {comment.body || comment.text || ''}
      </Text>
      <View style={styles.commentActions}>
        <Pressable onPress={onLike} style={styles.likeBtn}>
          <MaterialCommunityIcons
            name={liked ? 'heart' : 'heart-outline'}
            size={18}
            color={liked ? theme.colors.error : theme.colors.onSurfaceVariant}
          />
          {likes > 0 ? (
            <Text style={[styles.likeCount, { color: theme.colors.onSurfaceVariant }]}>{likes}</Text>
          ) : null}
        </Pressable>
      </View>
    </Surface>
  );
}

const HERO_HEIGHT = 280;
const HERO_POSTER_W = Math.min(130, SCREEN_WIDTH * 0.34);
const HERO_POSTER_H = HERO_POSTER_W * 1.5;

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  heroWrap: {
    height: HERO_HEIGHT,
    overflow: 'hidden',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HERO_HEIGHT,
    width: SCREEN_WIDTH,
  },
  backdropScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  heroRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    paddingBottom: 18,
  },
  posterBox: {
    marginRight: 14,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  heroPoster: {
    width: HERO_POSTER_W,
    height: HERO_POSTER_H,
    borderRadius: 12,
  },
  heroMeta: {
    flex: 1,
    paddingBottom: 2,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 20,
    lineHeight: 24,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroOrig: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    marginTop: 2,
    fontStyle: 'italic',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  scoreText: {
    color: '#FFC107',
    fontWeight: '800',
    fontSize: 15,
    marginLeft: 4,
  },
  metaChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    alignItems: 'center',
  },
  metaText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12,
    fontWeight: '600',
  },
  metaDot: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
  },
  studioText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 14,
  },
  watchBtn: {
    flex: 1,
    borderRadius: 14,
  },
  watchLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  bookmarkBtn: {
    borderWidth: 1,
    borderColor: 'transparent',
  },
  bookmarkBadgeRow: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 18,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
  },
  expandLink: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
  },
  hint: {
    fontSize: 13,
    marginBottom: 8,
  },
  scoreRow10: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 8,
  },
  scoreBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  scoreBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  opLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 14,
    paddingHorizontal: 8,
    marginBottom: 10,
  },
  commentInput: {
    flex: 1,
    fontSize: 14,
    maxHeight: 120,
  },
  commentCard: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  commentHead: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentHeadMeta: {
    flex: 1,
    marginLeft: 10,
  },
  commentUser: {
    fontSize: 14,
    fontWeight: '700',
  },
  commentTime: {
    fontSize: 11,
    marginTop: 1,
  },
  commentBody: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  likeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
    gap: 4,
  },
  likeCount: {
    fontSize: 13,
    fontWeight: '600',
  },
});
