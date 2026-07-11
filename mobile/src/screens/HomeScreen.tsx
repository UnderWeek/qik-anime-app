import React, { useCallback } from 'react';
import { View, StyleSheet, FlatList, Pressable } from 'react-native';
import { useTheme, Text, Surface, IconButton } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import Screen from '../components/Screen';
import AnimeCard from '../components/AnimeCard';
import Poster from '../components/Poster';
import SectionHeader from '../components/SectionHeader';
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/yummy';
import backend from '../api/backend';
import { RootStackParamList } from '../navigation/AppNavigator';
import { cardWidth } from '../utils/layout';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const RAIL_CARD_WIDTH = 128;
const RAIL_CARD_GAP = 12;

// Human-readable Russian titles for known feed sections.
const SECTION_TITLES: Record<string, string> = {
  ongoing: 'Сейчас выходит',
  ongoingList: 'Сейчас выходит',
  popular: 'Популярное',
  popularList: 'Популярное',
  new: 'Новинки',
  news: 'Новинки',
  newest: 'Новинки',
  recent: 'Недавно добавленное',
  recommendations: 'Рекомендации',
  recommended: 'Рекомендации',
  franchises: 'Франшизы',
  franchise: 'Франшизы',
  top: 'Топ аниме',
  topRated: 'Топ по рейтингу',
  scheduled: 'Расписание выхода',
  schedule: 'Расписание выхода',
  random: 'Случайное',
  completed: 'Завершённое',
  anons: 'Анонсы',
  season: 'Этого сезона',
  thisSeason: 'Этого сезона',
};

function titleFor(key: string): string {
  if (SECTION_TITLES[key]) return SECTION_TITLES[key];
  // prettify camelCase / snake_case -> capitalized words
  const words = key.replace(/[_-]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').split(' ');
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Extract an array of items from a feed value that may be a raw array or an
// object wrapper like { items, title, ... }.
function asItems(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.items)) return value.items;
  if (value && Array.isArray(value.data)) return value.data;
  if (value && Array.isArray(value.list)) return value.list;
  return [];
}

export default function HomeScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();

  const feedApi = useApi(() => api.feed(), []);
  const continueApi = useApi(
    () => (user ? backend.continueWatching(12) : Promise.resolve(null)),
    [user?.id],
  );

  const feed = feedApi.data;
  const continueItems = continueApi.data;

  const refreshing = feedApi.loading || continueApi.loading;

  const refetch = useCallback(async () => {
    await Promise.all([feedApi.refetch(), continueApi.refetch()]);
  }, [feedApi, continueApi]);

  const goToDetail = useCallback(
    (item: any) => {
      const id = item?.id || item?.alias || item?.url;
      const title = item?.title || item?.ru_title || item?.name;
      if (id != null) {
        navigation.navigate('AnimeDetail', { id, title });
      }
    },
    [navigation],
  );

  const sections: { key: string; title: string; items: any[] }[] = React.useMemo(() => {
    if (!feed) return [];
    try {
      const out: { key: string; title: string; items: any[] }[] = [];
      const source = feed && typeof feed === 'object' ? feed : {};
      if (Array.isArray(feed)) {
        out.push({ key: 'feed', title: 'Лента', items: feed.slice(0, 20) });
      } else {
        for (const key of Object.keys(source).slice(0, 12)) {
          try {
            const items = asItems(source[key]);
            if (items.length > 0) {
              out.push({ key, title: titleFor(key), items: items.slice(0, 20) });
            }
          } catch { /* skip malformed sections */ }
        }
        if (out.length === 0) {
          const flat = Object.values(source).flatMap((v) => asItems(v));
          if (flat.length > 0) out.push({ key: 'all', title: 'Лента', items: flat.slice(0, 20) });
        }
      }
      return out;
    } catch {
      return [];
    }
  }, [feed]);

  // ----- renderers -----

  const renderContinueItem = ({ item }: { item: any }) => {
    const posterUrl = item?.poster || item?.posterUrl || item?.poster_url || '';
    const title = item?.title || item?.ru_title || item?.name || 'Без названия';
    const ep = item?.episode ?? item?.episodeNumber ?? item?.lastEpisode;
    return (
      <View style={styles.continueCard}>
        <PressableCard onPress={() => goToDetail(item)} width={RAIL_CARD_WIDTH}>
          <View style={styles.posterBox}>
            {posterUrl ? (
              <Poster uri={posterUrl} style={styles.poster} />
            ) : (
              <View style={[styles.poster, styles.posterPlaceholder]}>
                <MaterialCommunityIcons name="image-off-outline" size={28} color={theme.colors.outline} />
              </View>
            )}
            {ep != null && (
              <View style={styles.epBadge}>
                <Text style={styles.epText}>Эп. {ep}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.continueTitle, { color: theme.colors.onSurface }]} numberOfLines={2}>
            {title}
          </Text>
        </PressableCard>
      </View>
    );
  };

  const renderAnimeCard = ({ item }: { item: any }) => (
    <AnimeCard item={item} onPress={goToDetail} width={RAIL_CARD_WIDTH} />
  );

  const renderSection = ({ item: section }: { item: { key: string; title: string; items: any[] } }) => (
    <View style={styles.section}>
      <SectionHeader title={section.title} />
      <FlatList
        data={section.items}
        renderItem={renderAnimeCard}
        keyExtractor={(it, i) => String(it?.id || it?.alias || i)}
        horizontal
        showsHorizontalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ width: RAIL_CARD_GAP }} />}
        contentContainerStyle={styles.railContent}
      />
    </View>
  );

  // ----- states -----

  const header = (
    <Surface style={[styles.appBar, { backgroundColor: theme.colors.surface }]} elevation={1}>
      <Text variant="titleLarge" style={[styles.appTitle, { color: theme.colors.onSurface }]}>
        QIK Anime
      </Text>
      <View style={styles.appActions}>
        <IconButton
          icon="magnify"
          size={24}
          iconColor={theme.colors.onSurface}
          onPress={() => navigation.navigate('Search')}
          accessibilityLabel="Поиск"
        />
        <IconButton
          icon="bell-outline"
          size={24}
          iconColor={theme.colors.onSurface}
          onPress={() => navigation.navigate('Notifications')}
          accessibilityLabel="Уведомления"
        />
      </View>
    </Surface>
  );

  // Body: build a list of "blocks" — continue rail (optional) + feed sections.
  const blocks: any[] = [];
  if (user && continueItems && Array.isArray(continueItems) && continueItems.length > 0) {
    blocks.push({ key: 'continue', type: 'continue', items: continueItems });
  }
  sections.forEach((s) => blocks.push({ key: s.key, type: 'section', section: s }));

  const showLoading = feedApi.loading && !feed;
  const showError = !showLoading && feedApi.error && !feed;

  let body: React.ReactNode;
  if (showLoading) {
    body = <LoadingState label="Загружаем ленту…" />;
  } else if (showError) {
    body = (
      <ErrorState
        message={feedApi.error?.message || 'Не удалось загрузить ленту'}
        onRetry={() => feedApi.refetch()}
      />
    );
  } else if (!feed || sections.length === 0) {
    body = (
      <EmptyState
        icon="home-search-outline"
        message="Лента пуста. Попробуйте обновить."
        action={refetch}
        actionLabel="Обновить"
      />
    );
  } else {
    body = (
      <View>
        {blocks.map((b) =>
          b.type === 'continue' ? (
            <View style={styles.section} key={b.key}>
              <SectionHeader title="Продолжить просмотр" />
              <FlatList
                data={b.items}
                renderItem={renderContinueItem}
                keyExtractor={(it: any, i: number) => String(it?.animeId || it?.id || i)}
                horizontal
                showsHorizontalScrollIndicator={false}
                ItemSeparatorComponent={() => <View style={{ width: RAIL_CARD_GAP }} />}
                contentContainerStyle={styles.railContent}
              />
            </View>
          ) : (
            <View key={b.key}>{renderSection({ item: b.section })}</View>
          ),
        )}
      </View>
    );
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refetch}>
      {header}
      {body}
    </Screen>
  );
}

// Small pressable card wrapper for the continue-watching rail.
function PressableCard({
  children,
  onPress,
  width,
}: {
  children: React.ReactNode;
  onPress: () => void;
  width: number;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.cardShell,
        { width, backgroundColor: theme.colors.surfaceContainer, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    marginBottom: 4,
  },
  appTitle: {
    fontWeight: '800',
    marginLeft: 8,
  },
  appActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  section: {
    marginBottom: 8,
  },
  railContent: {
    paddingHorizontal: 0,
    paddingVertical: 4,
  },
  continueCard: {},
  cardShell: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  touchable: {
    borderRadius: 14,
  },
  posterBox: {
    width: RAIL_CARD_WIDTH,
    aspectRatio: 2 / 3,
    backgroundColor: 'rgba(128,128,128,0.15)',
    position: 'relative',
  },
  poster: {
    width: RAIL_CARD_WIDTH,
    aspectRatio: 2 / 3,
  },
  posterPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  epBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  epText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  continueTitle: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 15,
    padding: 8,
  },
});
