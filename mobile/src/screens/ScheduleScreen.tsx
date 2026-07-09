import { useState, useMemo, useCallback } from 'react';
import { View, StyleSheet, FlatList, Pressable } from 'react-native';
import {
  useTheme,
  Text,
  SegmentedButtons,
  Surface,
  Divider,
  ActivityIndicator,
} from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import Screen from '../components/Screen';
import Poster from '../components/Poster';
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import { useApi } from '../hooks/useApi';
import { api } from '../api/yummy';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Schedule'>;

interface ScheduleItem {
  id?: string | number;
  title?: string;
  name?: string;
  ru_title?: string;
  episode?: number;
  last_episode?: number;
  poster?: any;
  posterUrl?: string;
  poster_url?: string;
  [k: string]: any;
}

interface DayGroup {
  day: number; // 1..7 (Mon..Sun)
  items: ScheduleItem[];
}

// Russian weekday labels indexed 1..7 (Пн..Вс).
const DAY_LABELS: Record<number, string> = {
  1: 'Пн',
  2: 'Вт',
  3: 'Ср',
  4: 'Чт',
  5: 'Пт',
  6: 'Сб',
  7: 'Вс',
};

const DAY_FULL: Record<number, string> = {
  1: 'Понедельник',
  2: 'Вторник',
  3: 'Среда',
  4: 'Четверг',
  5: 'Пятница',
  6: 'Суббота',
  7: 'Воскресенье',
};

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 7];

// Today's weekday (ISO: Mon=1..Sun=7).
function todayWeekday(): number {
  const d = new Date().getDay(); // 0=Sun..6=Sat
  return d === 0 ? 7 : d;
}

// Normalize the YummyAnime schedule payload into a map weekday(1..7) -> items[].
function normalizeSchedule(raw: any): Record<number, ScheduleItem[]> {
  const map: Record<number, ScheduleItem[]> = {};
  for (const d of DAY_ORDER) map[d] = [];

  if (!raw) return map;

  // Case 1: array of day groups [{ day/weekday, list/items }] — typical YummyAnime shape.
  if (Array.isArray(raw)) {
    for (const grp of raw) {
      const day = normalizeDay(grp?.day ?? grp?.weekday ?? grp?.id);
      const items: ScheduleItem[] = grp?.list ?? grp?.items ?? grp?.releases ?? [];
      if (day && map[day]) {
        map[day] = items;
      } else if (Array.isArray(grp) && !day) {
        // Fallback: flat array of items with day-of-week fields on each.
      }
    }
    return map;
  }

  // Case 2: object keyed by day string/number { "1": [...], "mon": [...] }.
  if (typeof raw === 'object') {
    for (const key of Object.keys(raw)) {
      const day = normalizeDay(key);
      const val = (raw as any)[key];
      const items: ScheduleItem[] = Array.isArray(val) ? val : val?.list ?? val?.items ?? [];
      if (day && map[day]) {
        map[day] = items;
      }
    }
    return map;
  }

  return map;
}

function normalizeDay(v: any): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return v >= 1 && v <= 7 ? v : null;
  const s = String(v).toLowerCase().trim();
  if (/^\d+$/.test(s)) {
    const n = parseInt(s, 10);
    return n >= 1 && n <= 7 ? n : null;
  }
  const map: Record<string, number> = {
    mon: 1, monday: 1, пн: 1, понедельник: 1,
    tue: 2, tuesday: 2, вт: 2, вторник: 2,
    wed: 3, wednesday: 3, ср: 3, среда: 3,
    thu: 4, thursday: 4, чт: 4, четверг: 4,
    fri: 5, friday: 5, пт: 5, пятница: 5,
    sat: 6, saturday: 6, сб: 6, суббота: 6,
    sun: 7, sunday: 7, вс: 7, воскресресенье: 7, воскресенье: 7,
  };
  return map[s] ?? null;
}

function itemPosterUrl(item: ScheduleItem): string {
  if (item.posterUrl) return item.posterUrl;
  if (item.poster_url) return item.poster_url;
  if (item.poster && typeof item.poster === 'object') {
    for (const s of ['medium', 'small', 'big', 'huge', 'mega', 'fullsize']) {
      const u = item.poster[s];
      if (u) {
        let url = u;
        if (url.startsWith('//')) url = `https:${url}`;
        if (url.startsWith('/')) url = `https://static.yani.tv${url}`;
        return url;
      }
    }
  }
  return '';
}

function itemTitle(item: ScheduleItem): string {
  return item.title || item.name || item.ru_title || 'Без названия';
}

function itemEpisode(item: ScheduleItem): number | null {
  const ep = item.episode ?? item.last_episode ?? item.episode_number ?? item.ep;
  return typeof ep === 'number' ? ep : null;
}

export default function ScheduleScreen(props: Props) {
  const { navigation } = props;
  const theme = useTheme();
  const [selectedDay, setSelectedDay] = useState<number>(todayWeekday());

  const { data, loading, error, refetch } = useApi<any>(() => api.schedule(), []);

  const schedule = useMemo(() => normalizeSchedule(data), [data]);
  const dayItems = useMemo(() => schedule[selectedDay] ?? [], [schedule, selectedDay]);

  const handleItemPress = useCallback(
    (item: ScheduleItem) => {
      const id = item.id ?? item.code ?? item.slug ?? item.url;
      if (id == null) return;
      navigation.navigate('AnimeDetail', { id: id as string | number, title: itemTitle(item) });
    },
    [navigation],
  );

  const segmented = useMemo(
    () =>
      DAY_ORDER.map((d) => ({
        value: String(d),
        label: DAY_LABELS[d],
      })),
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: ScheduleItem }) => {
      const ep = itemEpisode(item);
      return (
        <Pressable
          onPress={() => handleItemPress(item)}
          style={({ pressed }) => [
            styles.row,
            { backgroundColor: theme.colors.surfaceContainer },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Poster uri={itemPosterUrl(item)} style={styles.thumb} contentFit="cover" />
          <View style={styles.rowMeta}>
            <Text
              variant="bodyLarge"
              numberOfLines={2}
              style={{ color: theme.colors.onSurface, fontWeight: '600' }}
            >
              {itemTitle(item)}
            </Text>
            {ep != null && (
              <View style={[styles.epBadge, { backgroundColor: theme.colors.primary }]}>
                <Text style={[styles.epText, { color: theme.colors.onPrimary }]}>
                  Эпизод {ep}
                </Text>
              </View>
            )}
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color={theme.colors.outline}
          />
        </Pressable>
      );
    },
    [theme, handleItemPress],
  );

  const keyExtractor = useCallback((item: ScheduleItem, index: number) => {
    return String(item.id ?? item.code ?? item.slug ?? index);
  }, []);

  if (loading && !data) {
    return (
      <Screen padded={false}>
        <LoadingState label="Загрузка расписания…" />
      </Screen>
    );
  }

  if (error && !data) {
    return (
      <Screen padded={false}>
        <ErrorState message="Не удалось загрузить расписание" onRetry={refetch} />
      </Screen>
    );
  }

  return (
    <Screen refreshing={loading} onRefresh={refetch} padded={false}>
      <View style={styles.inner}>
        <Surface style={[styles.tabsSurface, { backgroundColor: theme.colors.surfaceContainerHigh }]}>
          <SegmentedButtons
            value={String(selectedDay)}
            onValueChange={(v) => setSelectedDay(Number(v))}
            buttons={segmented}
            density="small"
          />
        </Surface>

        <Text variant="titleLarge" style={[styles.dayTitle, { color: theme.colors.onSurface }]}>
          {DAY_FULL[selectedDay]}
        </Text>

        {loading && data ? (
          <View style={styles.overlayLoading}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : null}

        {dayItems.length === 0 ? (
          <EmptyState
            icon="calendar-blank-outline"
            message="В этот день нет выходящих релизов"
          />
        ) : (
          <FlatList
            data={dayItems}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            ItemSeparatorComponent={() => <Divider style={{ marginHorizontal: 12 }} />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            scrollEnabled={false}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  inner: {
    flex: 1,
  },
  tabsSurface: {
    borderRadius: 14,
    marginHorizontal: 12,
    marginTop: 8,
    padding: 4,
  },
  dayTitle: {
    fontWeight: '700',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  thumb: {
    width: 48,
    aspectRatio: 2 / 3,
    borderRadius: 8,
    backgroundColor: 'rgba(128,128,128,0.15)',
  },
  rowMeta: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  epBadge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  epText: {
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 16,
  },
  overlayLoading: {
    paddingVertical: 8,
    alignItems: 'center',
  },
});
