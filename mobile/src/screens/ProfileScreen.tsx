import { useState, useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import {
  useTheme,
  Text,
  IconButton,
  Button,
  SegmentedButtons,
  Chip,
  Card,
  Surface,
  ProgressBar,
} from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Screen from '../components/Screen';
import Avatar from '../components/Avatar';
import AnimeCard from '../components/AnimeCard';
import SectionHeader from '../components/SectionHeader';
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { backend } from '../api/backend';
import { uploadUrl } from '../api/client';
import { fixUrl } from '../api/yummy';
import { cardWidth } from '../utils/layout';
import { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const BANNER_HEIGHT = 180;
const AVATAR_SIZE = 96;
const SCREEN_W = Dimensions.get('window').width;

function formatHours(totalSeconds?: number): string {
  if (!totalSeconds) return '0 ч';
  const hours = Math.floor(totalSeconds / 3600);
  if (hours >= 1) return `${hours} ч`;
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes} мин`;
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function ProfileScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { user, logout, openAuthModal } = useAuth();

  const [tab, setTab] = useState('stats');

  const profileApi = useApi(
    () => (user ? backend.profile(user.id) : Promise.resolve(null)),
    [user?.id],
  );
  const bookmarksApi = useApi(
    () => (user ? backend.userBookmarks(user.id) : Promise.resolve([])),
    [user?.id],
  );
  const historyApi = useApi(
    () => (user ? backend.watchHistory(user.id) : Promise.resolve([])),
    [user?.id],
  );
  const friendsApi = useApi(
    () => (user ? backend.userFriends(user.id) : Promise.resolve([])),
    [user?.id],
  );
  const genresApi = useApi(
    () => (user ? backend.genreBreakdown(user.id) : Promise.resolve([])),
    [user?.id],
  );

  const refreshAll = async () => {
    await Promise.all([
      profileApi.refetch(),
      bookmarksApi.refetch(),
      historyApi.refetch(),
      friendsApi.refetch(),
      genresApi.refetch(),
    ]);
  };

  const profile = profileApi.data as any;
  const profileUser = profile?.user ?? profile ?? user;
  const stats = profile?.stats ?? profile;
  const achievements: any[] = profile?.achievements ?? [];
  const frames: any[] = profile?.availableFrames ?? profile?.frames ?? [];

  const genreBars = useMemo(() => {
    const list = (genresApi.data as any[]) ?? [];
    if (!list.length) return [];
    const max = Math.max(...list.map((g) => g?.count ?? 0), 1);
    return list
      .map((g) => ({
        genre: g.genre ?? g.name ?? '—',
        count: g.count ?? 0,
        ratio: (g.count ?? 0) / max,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [genresApi.data]);

  const cw3 = cardWidth(3);
  const cw2 = cardWidth(2);

  if (!user) {
    return (
      <Screen>
        <EmptyState
          icon="account-circle-outline"
          message="Войдите, чтобы увидеть свой профиль, статистику и закладки"
          action={openAuthModal}
          actionLabel="Войти"
        />
      </Screen>
    );
  }

  if (profileApi.loading && !profile) {
    return (
      <Screen>
        <LoadingState label="Загрузка профиля…" />
      </Screen>
    );
  }

  if (profileApi.error && !profile) {
    return (
      <Screen>
        <ErrorState message={profileApi.error.message} onRetry={profileApi.refetch} />
      </Screen>
    );
  }

  const isMaster = user.role === 'master' || user.role === 'admin';
  const isAdmin = user.role === 'admin';

  const actionCards: { label: string; icon: string; target: keyof RootStackParamList; color: string }[] = [
    { label: 'Друзья', icon: 'account-group-outline', target: 'Friends', color: '#4CAF50' },
    { label: 'Чаты', icon: 'chat-outline', target: 'Chats', color: '#2196F3' },
    { label: 'Комнаты', icon: 'movie-open-outline', target: 'Rooms', color: '#FF9800' },
    { label: 'Квиз', icon: 'help-circle-outline', target: 'Quiz', color: '#9C27B0' },
    { label: 'Рейтинги', icon: 'trophy-outline', target: 'Ratings', color: '#FFC107' },
    { label: 'Календарь', icon: 'calendar-month-outline', target: 'Schedule', color: '#E91E63' },
    { label: 'Поиск', icon: 'magnify', target: 'Search', color: '#00BCD4' },
    { label: 'Настройки', icon: 'cog-outline', target: 'Settings', color: '#607D8B' },
  ];

  return (
    <Screen refreshing={profileApi.loading} onRefresh={refreshAll} padded={false}>
      {/* Header: banner + avatar + actions */}
      <View>
        <View style={styles.bannerWrap}>
          <Image
            source={uploadUrl(profile?.bannerUrl ?? user.bannerUrl)}
            style={styles.banner}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
          <View style={styles.bannerOverlay} />
          <View style={styles.headerActions}>
            <IconButton
              icon="pencil"
              iconColor="#fff"
              size={22}
              onPress={() => navigation.navigate('EditProfile')}
              style={styles.headerBtn}
            />
            <IconButton
              icon="logout"
              iconColor="#fff"
              size={22}
              onPress={logout}
              style={styles.headerBtn}
            />
          </View>
        </View>

        <View style={styles.avatarRow}>
          <View style={styles.avatarWrap}>
            <Avatar user={profileUser ?? user} size={AVATAR_SIZE} />
          </View>
          <View style={styles.identity}>
            <Text variant="titleLarge" style={{ color: theme.colors.onSurface }} numberOfLines={1}>
              {profileUser?.username ?? user.username}
            </Text>
            {profileUser?.bio ? (
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}
                numberOfLines={3}
              >
                {profileUser.bio}
              </Text>
            ) : null}
            {((profile?.level != null || profileUser?.level != null) || (profile?.xp != null || profileUser?.xp != null)) && (
              <View style={styles.levelRow}>
                <Surface style={[styles.levelBadge, { backgroundColor: theme.colors.primary }]} elevation={0}>
                  <Text style={{ color: theme.colors.onPrimary, fontWeight: '700', fontSize: 12 }}>
                    Ур. {typeof profile?.level === 'object' ? profile.level.level : (profile?.level ?? profileUser?.level)}
                  </Text>
                </Surface>
                <View style={styles.xpWrap}>
                  <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 11, marginBottom: 2 }}>
                    {profile?.xp ?? profileUser?.xp ?? 0} XP
                  </Text>
                  <ProgressBar
                    progress={typeof profile?.level === 'object' ? profile.level.progress : (profile?.xpProgress ?? profile?.progressToNext ?? 0)}
                    color={theme.colors.primary}
                    style={{ height: 5, borderRadius: 3 }}
                  />
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatTile
            icon="play-circle-outline"
            label="Серий"
            value={String(stats?.episodesWatched ?? stats?.episodes ?? 0)}
            color={theme.colors.primary}
          />
          <StatTile
            icon="clock-outline"
            label="Часов"
            value={formatHours(stats?.totalSeconds ?? stats?.secondsWatched)}
            color={theme.colors.tertiary}
          />
          <StatTile
            icon="comment-multiple-outline"
            label="Коммент."
            value={String(stats?.comments ?? stats?.commentCount ?? 0)}
            color={theme.colors.secondary}
          />
          <StatTile
            icon="bookmark-multiple-outline"
            label="Закладки"
            value={String(stats?.bookmarks ?? stats?.bookmarkCount ?? 0)}
            color={theme.colors.primary}
          />
          <StatTile
            icon="account-group-outline"
            label="Друзья"
            value={String(stats?.friends ?? stats?.friendCount ?? 0)}
            color={theme.colors.tertiary}
          />
        </View>

        {/* Action grid — quick access to Friends, Chats, Rooms, Quiz etc. */}
        <View style={styles.actionGrid}>
          {actionCards.map((a) => (
            <Card
              key={a.target}
              style={[styles.actionCard, { backgroundColor: theme.colors.surfaceContainer }]}
              mode="contained"
              onPress={() => navigation.navigate(a.target as any)}
            >
              <View style={styles.actionInner}>
                <MaterialCommunityIcons name={a.icon as any} size={24} color={a.color} />
                <Text variant="labelSmall" style={{ color: theme.colors.onSurface, marginTop: 6 }} numberOfLines={1}>
                  {a.label}
                </Text>
              </View>
            </Card>
          ))}
          {isMaster && (
            <Card
              style={[styles.actionCard, { backgroundColor: theme.colors.surfaceContainer }]}
              mode="contained"
              onPress={() => navigation.navigate('Issues')}
            >
              <View style={styles.actionInner}>
                <MaterialCommunityIcons name="bug-check-outline" size={24} color="#FF5722" />
                <Text variant="labelSmall" style={{ color: theme.colors.onSurface, marginTop: 6, textAlign: 'center' }} numberOfLines={2}>
                  Баг-трекер
                </Text>
              </View>
            </Card>
          )}
          {isAdmin && (
            <Card
              style={[styles.actionCard, { backgroundColor: theme.colors.surfaceContainer }]}
              mode="contained"
              onPress={() => navigation.navigate('Admin')}
            >
              <View style={styles.actionInner}>
                <MaterialCommunityIcons name="shield-crown-outline" size={24} color="#FFD700" />
                <Text variant="labelSmall" style={{ color: theme.colors.onSurface, marginTop: 6 }} numberOfLines={1}>
                  Админка
                </Text>
              </View>
            </Card>
          )}
        </View>

        {frames.length > 0 ? (
          <View style={styles.section}>
            <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 6 }}>
              Доступные рамки
            </Text>
            <View style={styles.chipRow}>
              {frames.map((f) => (
                <Chip key={f?.id ?? f} mode="outlined" style={{ marginRight: 6, marginBottom: 6 }}>
                  {f?.title ?? f?.id ?? String(f)}
                </Chip>
              ))}
            </View>
          </View>
        ) : null}

        {achievements.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title="Достижения" />
            <View style={styles.chipRow}>
              {achievements.map((a, i) => (
                <Chip
                  key={a?.id ?? i}
                  mode="outlined"
                  style={{ marginRight: 6, marginBottom: 6 }}
                  avatar={a?.emoji ? <Text style={{ fontSize: 14 }}>{a.emoji}</Text> : undefined}
                >
                  {a?.name ?? a?.title ?? '—'}
                </Chip>
              ))}
            </View>
          </View>
        ) : null}
      </View>

      {/* Tabs */}
      <View style={styles.tabsWrap}>
        <SegmentedButtons
          value={tab}
          onValueChange={setTab}
          density="medium"
          buttons={[
            { value: 'stats', label: 'Статистика' },
            { value: 'bookmarks', label: 'Закладки' },
            { value: 'history', label: 'История' },
            { value: 'friends', label: 'Друзья' },
          ]}
        />
      </View>

      {tab === 'stats' && (
        <View style={styles.tabContent}>
          <SectionHeader title="Жанры" />
          {genresApi.loading && !genreBars.length ? (
            <LoadingState label="Загрузка статистики…" />
          ) : genresApi.error ? (
            <ErrorState message={genresApi.error.message} onRetry={genresApi.refetch} />
          ) : !genreBars.length ? (
            <EmptyState icon="chart-bar" message="Нет данных о просмотренных жанрах" />
          ) : (
            <Card style={styles.card} mode="contained">
              <View style={styles.cardInner}>
                {genreBars.map((g) => (
                  <View key={g.genre} style={styles.barRow}>
                    <Text
                      style={{ color: theme.colors.onSurface, fontSize: 13, width: 110 }}
                      numberOfLines={1}
                    >
                      {g.genre}
                    </Text>
                    <View style={{ flex: 1, marginHorizontal: 8 }}>
                      <ProgressBar
                        progress={g.ratio}
                        color={theme.colors.primary}
                        style={{ height: 8, borderRadius: 4 }}
                      />
                    </View>
                    <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}>
                      {g.count}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          )}
        </View>
      )}

      {tab === 'bookmarks' && (
        <View style={styles.tabContent}>
          <SectionHeader title="Закладки" />
          {bookmarksApi.loading ? (
            <LoadingState label="Загрузка закладок…" />
          ) : bookmarksApi.error ? (
            <ErrorState message={bookmarksApi.error.message} onRetry={bookmarksApi.refetch} />
          ) : !((bookmarksApi.data as any[]) ?? []).length ? (
            <EmptyState icon="bookmark-off-outline" message="Здесь будут ваши закладки" />
          ) : (
            <View style={styles.grid}>
              {((bookmarksApi.data as any[]) ?? []).map((b, i) => {
                const item = b?.anime ?? b;
                return (
                  <AnimeCard
                    key={b?.id ?? item?.id ?? i}
                    item={item}
                    width={cw3}
                    onPress={(it) =>
                      navigation.navigate('AnimeDetail', {
                        id: it.id,
                        title: it.title || it.ru_title,
                      })
                    }
                  />
                );
              })}
            </View>
          )}
        </View>
      )}

      {tab === 'history' && (
        <View style={styles.tabContent}>
          <SectionHeader title="История просмотров" />
          {historyApi.loading ? (
            <LoadingState label="Загрузка истории…" />
          ) : historyApi.error ? (
            <ErrorState message={historyApi.error.message} onRetry={historyApi.refetch} />
          ) : !((historyApi.data as any[]) ?? []).length ? (
            <EmptyState icon="history" message="История пуста" />
          ) : (
            <View>
              {((historyApi.data as any[]) ?? []).map((h, i) => {
                const title = h?.title || h?.animeTitle || 'Без названия';
                const poster = h?.poster || h?.posterUrl;
                const ep = h?.episode ?? h?.episodeNumber;
                return (
                  <Card key={h?.id ?? i} style={styles.historyCard} mode="contained">
                    <View style={styles.historyRow}>
                      {poster ? (
                        <Image
                          source={typeof poster === 'string'
                            ? (poster.startsWith('/uploads') ? uploadUrl(poster) : fixUrl(poster))
                            : uploadUrl(poster)}
                          style={styles.historyPoster}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                        />
                      ) : (
                        <View style={[styles.historyPoster, { backgroundColor: theme.colors.surfaceVariant }]} />
                      )}
                      <View style={styles.historyMeta}>
                        <Text
                          variant="bodyMedium"
                          style={{ color: theme.colors.onSurface }}
                          numberOfLines={2}
                        >
                          {title}
                        </Text>
                        {ep != null && (
                          <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12, marginTop: 2 }}>
                            Серия {ep}
                          </Text>
                        )}
                        {h?.updatedAt ? (
                          <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 11, marginTop: 2 }}>
                            {formatDate(h.updatedAt)}
                          </Text>
                        ) : null}
                        <Button
                          mode="text"
                          compact
                          onPress={() =>
                            navigation.navigate('Watch', {
                              id: h.animeId ?? h.anime_id ?? h.id,
                              title,
                              episode: ep,
                            })
                          }
                          style={{ alignSelf: 'flex-start', marginTop: 2 }}
                        >
                          Продолжить
                        </Button>
                      </View>
                    </View>
                  </Card>
                );
              })}
            </View>
          )}
        </View>
      )}

      {tab === 'friends' && (
        <View style={styles.tabContent}>
          <SectionHeader title="Друзья" />
          {friendsApi.loading ? (
            <LoadingState label="Загрузка друзей…" />
          ) : friendsApi.error ? (
            <ErrorState message={friendsApi.error.message} onRetry={friendsApi.refetch} />
          ) : !((friendsApi.data as any[]) ?? []).length ? (
            <EmptyState
              icon="account-group-outline"
              message="У вас пока нет друзей"
              action={() => navigation.navigate('Friends')}
              actionLabel="Найти друзей"
            />
          ) : (
            <View style={styles.grid2}>
              {((friendsApi.data as any[]) ?? []).map((f, i) => {
                const friend = f?.friend ?? f?.user ?? f;
                return (
                  <Card
                    key={f?.id ?? friend?.id ?? i}
                    style={[styles.friendCard, { width: cw2 }]}
                    mode="contained"
                    onPress={() => navigation.navigate('Chats')}
                  >
                    <View style={styles.friendInner}>
                      <Avatar user={friend} size={64} />
                      <Text
                        variant="bodyMedium"
                        style={{ color: theme.colors.onSurface, marginTop: 8, textAlign: 'center' }}
                        numberOfLines={1}
                      >
                        {friend?.username ?? 'Пользователь'}
                      </Text>
                    </View>
                  </Card>
                );
              })}
            </View>
          )}
        </View>
      )}
    </Screen>
  );
}

function StatTile({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  color: string;
}) {
  const theme = useTheme();
  return (
    <Surface
      style={[styles.statTile, { backgroundColor: theme.colors.surfaceContainer }]}
      elevation={0}
    >
      <MaterialCommunityIcons name={icon as any} size={20} color={color} />
      <Text style={{ color: theme.colors.onSurface, fontSize: 15, fontWeight: '700', marginTop: 4 }}>
        {value}
      </Text>
      <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 11 }}>{label}</Text>
    </Surface>
  );
}

const styles = StyleSheet.create({
  bannerWrap: {
    width: SCREEN_W,
    height: BANNER_HEIGHT,
    backgroundColor: 'rgba(128,128,128,0.2)',
    position: 'relative',
  },
  banner: {
    width: '100%',
    height: '100%',
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  headerActions: {
    position: 'absolute',
    top: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 2,
  },
  headerBtn: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    margin: 6,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: -AVATAR_SIZE / 2,
    paddingHorizontal: 16,
  },
  avatarWrap: {
    borderRadius: AVATAR_SIZE,
    backgroundColor: 'transparent',
    marginRight: 14,
  },
  identity: {
    flex: 1,
    paddingBottom: 8,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  levelBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 8,
  },
  xpWrap: {
    flex: 1,
    maxWidth: 180,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    marginTop: 16,
    gap: 8,
  },
  statTile: {
    width: (SCREEN_W - 12 * 2 - 8 * 4) / 5,
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    marginTop: 16,
    gap: 8,
  },
  actionCard: {
    width: (SCREEN_W - 12 * 2 - 8 * 3) / 4,
    borderRadius: 14,
  },
  actionInner: {
    padding: 14,
    alignItems: 'center',
  },
  section: {
    paddingHorizontal: 12,
    marginTop: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tabsWrap: {
    paddingHorizontal: 12,
    marginTop: 16,
  },
  tabContent: {
    paddingHorizontal: 12,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 14,
    marginTop: 4,
  },
  cardInner: {
    padding: 12,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  grid2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  historyCard: {
    borderRadius: 14,
    marginBottom: 10,
  },
  historyRow: {
    flexDirection: 'row',
    padding: 10,
  },
  historyPoster: {
    width: 70,
    height: 100,
    borderRadius: 8,
  },
  historyMeta: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  friendCard: {
    borderRadius: 14,
    marginBottom: 12,
  },
  friendInner: {
    padding: 16,
    alignItems: 'center',
  },
});
