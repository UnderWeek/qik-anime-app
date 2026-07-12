import { useState, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  useTheme,
  SegmentedButtons,
  List,
  Badge,
  Text,
  Surface,
} from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import Screen from '../components/Screen';
import Poster from '../components/Poster';
import Avatar from '../components/Avatar';
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import { useApi } from '../hooks/useApi';
import { backend } from '../api/backend';
import { poster as extractPoster } from '../api/yummy';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Ratings'>;

type RatingTab = 'anime' | 'openings' | 'endings' | 'users';

const TAB_LABELS: Record<RatingTab, string> = {
  anime: 'Аниме',
  openings: 'Опенинги',
  endings: 'Эндинги',
  users: 'Пользователи',
};

const TAB_TO_SEGMENT: Record<RatingTab, string> = {
  anime: 'anime',
  openings: 'openings',
  endings: 'endings',
  users: 'users',
};

function resolveTab(tab?: string): RatingTab {
  if (tab === 'openings' || tab === 'endings' || tab === 'users') return tab;
  return 'anime';
}

function rankColor(rank: number): string {
  if (rank === 1) return '#FFD24A'; // Gold
  if (rank === 2) return '#C0C0C0'; // Silver
  if (rank === 3) return '#CD7F32'; // Bronze
  return undefined as any; // fall back to theme
}

export default function RatingsScreen(props: Props) {
  const theme = useTheme();
  const { route } = props;
  const [activeTab, setActiveTab] = useState<RatingTab>(() =>
    resolveTab(route.params?.tab),
  );

  const fetcher = useMemo(() => {
    switch (activeTab) {
      case 'anime':
        return () => backend.topAnime();
      case 'openings':
        return () => backend.topOpenings();
      case 'endings':
        return () => backend.topEndings();
      case 'users':
        return () => backend.topUsers();
    }
  }, [activeTab]);

  const { data, loading, error, refetch } = useApi<any[]>(fetcher, [activeTab]);
  const items = Array.isArray(data) ? data : data ? [data] : [];

  const handleAnimePress = (item: any) => {
    const id = item?.animeId ?? item?.id ?? item?.anime_id;
    if (id != null) {
      props.navigation.navigate('AnimeDetail', {
        id,
        title: item?.title || item?.ru_title || item?.name,
      });
    }
  };

  const renderItem = (item: any, index: number) => {
    const rank = index + 1;
    const rc = rankColor(rank);

    if (activeTab === 'anime') {
      const title =
        item?.title || item?.ru_title || item?.name || 'Без названия';
      const posterUrl =
        item?.posterUrl ||
        item?.poster_url ||
        extractPoster(item, 'small') ||
        '';
      const avg =
        item?.averageRating ??
        item?.average_rating ??
        item?.rating ??
        item?.score;
      return (
        <List.Item
          key={`anime-${rank}-${item?.id ?? index}`}
          title={title}
          titleNumberOfLines={2}
          description={
            avg != null
              ? `Средний рейтинг: ${Number(avg).toFixed(2)}`
              : 'Нет оценок'
          }
          descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
          left={() => (
            <View style={styles.rowLeft}>
              <RankBadge rank={rank} colorOverride={rc} />
              <Poster
                uri={posterUrl}
                style={styles.posterThumb}
                contentFit="cover"
              />
            </View>
          )}
          right={() =>
            avg != null ? (
              <View style={styles.scoreWrap}>
                <MaterialCommunityIcons
                  name="star"
                  size={18}
                  color={theme.colors.primary}
                />
                <Text style={[styles.score, { color: theme.colors.primary }]}>
                  {Number(avg).toFixed(1)}
                </Text>
              </View>
            ) : null
          }
          onPress={() => handleAnimePress(item)}
          style={[styles.item, { backgroundColor: theme.colors.surfaceContainer }]}
          titleStyle={{ color: theme.colors.onSurface, fontWeight: '600' }}
        />
      );
    }

    if (activeTab === 'openings' || activeTab === 'endings') {
      const title =
        item?.animeTitle ||
        item?.title ||
        item?.ru_title ||
        item?.name ||
        'Без названия';
      const type = item?.type || (activeTab === 'openings' ? 'Opening' : 'Ending');
      const score =
        item?.averageRating ??
        item?.average_rating ??
        item?.rating ??
        item?.score;
      return (
        <List.Item
          key={`${activeTab}-${rank}-${item?.id ?? index}`}
          title={title}
          titleNumberOfLines={2}
          description={`Тип: ${type}`}
          descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
          left={() => (
            <View style={styles.rowLeft}>
              <RankBadge rank={rank} colorOverride={rc} />
              <View
                style={[
                  styles.musicIcon,
                  { backgroundColor: theme.colors.surfaceContainerHigh },
                ]}
              >
                <MaterialCommunityIcons
                  name={activeTab === 'openings' ? 'music-note' : 'music-note-eighth'}
                  size={22}
                  color={theme.colors.primary}
                />
              </View>
            </View>
          )}
          right={() =>
            score != null ? (
              <View style={styles.scoreWrap}>
                <MaterialCommunityIcons
                  name="star"
                  size={18}
                  color={theme.colors.primary}
                />
                <Text style={[styles.score, { color: theme.colors.primary }]}>
                  {Number(score).toFixed(1)}
                </Text>
              </View>
            ) : null
          }
          onPress={() => handleAnimePress(item)}
          style={[styles.item, { backgroundColor: theme.colors.surfaceContainer }]}
          titleStyle={{ color: theme.colors.onSurface, fontWeight: '600' }}
        />
      );
    }

    // users
    const username = item?.username || item?.name || 'Пользователь';
    const level = item?.level ?? item?.levelNumber;
    const xp = item?.xp ?? item?.experience;
    return (
      <List.Item
        key={`user-${rank}-${item?.id ?? index}`}
        title={username}
        titleNumberOfLines={1}
        description={
          level != null
            ? `Уровень ${level}${xp != null ? ` · ${xp} XP` : ''}`
            : xp != null
              ? `${xp} XP`
              : undefined
        }
        descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
        left={() => (
          <View style={styles.rowLeft}>
            <RankBadge rank={rank} colorOverride={rc} />
            <Avatar user={item} size={44} />
          </View>
        )}
        right={() =>
          level != null ? (
            <View style={styles.scoreWrap}>
              <MaterialCommunityIcons
                name="trophy"
                size={18}
                color={theme.colors.primary}
              />
              <Text style={[styles.score, { color: theme.colors.primary }]}>
                {level}
              </Text>
            </View>
          ) : null
        }
        style={[styles.item, { backgroundColor: theme.colors.surfaceContainer }]}
        titleStyle={{ color: theme.colors.onSurface, fontWeight: '600' }}
      />
    );
  };

  return (
    <Screen refreshing={loading} onRefresh={refetch}>
      <View style={styles.segmentWrap}>
        <SegmentedButtons
          value={TAB_TO_SEGMENT[activeTab]}
          onValueChange={(v) => setActiveTab(v as RatingTab)}
          buttons={(Object.keys(TAB_LABELS) as RatingTab[]).map((t) => ({
            value: TAB_TO_SEGMENT[t],
            label: TAB_LABELS[t],
          }))}
          density="small"
        />
      </View>

      <View style={styles.listWrap}>
        {loading && items.length === 0 ? (
          <LoadingState label="Загрузка рейтинга…" />
        ) : error ? (
          <ErrorState
            message={error.message || 'Не удалось загрузить рейтинг'}
            onRetry={refetch}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon="trophy-outline"
            message={`В рейтинге «${TAB_LABELS[activeTab]}» пока пусто`}
          />
        ) : (
          <View style={styles.list}>
            {items.map((item, index) => renderItem(item, index))}
          </View>
        )}
      </View>
    </Screen>
  );
}

function RankBadge({
  rank,
  colorOverride,
}: {
  rank: number;
  colorOverride?: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.rankWrap}>
      <Badge
        size={28}
        style={{
          backgroundColor: colorOverride || theme.colors.primary,
          fontWeight: '700',
        }}
      >
        {rank}
      </Badge>
    </View>
  );
}

const styles = StyleSheet.create({
  segmentWrap: {
    marginBottom: 12,
  },
  listWrap: {
    flex: 1,
  },
  list: {
    gap: 8,
  },
  item: {
    borderRadius: 14,
    paddingRight: 12,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rankWrap: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterThumb: {
    width: 46,
    height: 64,
    borderRadius: 6,
  },
  musicIcon: {
    width: 46,
    height: 46,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'center',
  },
  score: {
    fontSize: 15,
    fontWeight: '700',
  },
});
