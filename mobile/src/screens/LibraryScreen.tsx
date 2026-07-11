import { useCallback, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, FlatList } from 'react-native';
import {
  SegmentedButtons,
  Menu,
  Text,
  Divider,
  useTheme,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AnimeCard from '../components/AnimeCard';
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { cardWidth } from '../utils/layout';
import backend from '../api/backend';
import { RootStackParamList } from '../navigation/AppNavigator';

type BookmarkStatus = 'watching' | 'planned' | 'completed' | 'on_hold' | 'dropped';

interface BookmarkItem {
  animeId: number;
  title: string;
  posterUrl?: string;
  episodesWatched?: number;
  status: string;
}

const STATUS_OPTIONS: { value: BookmarkStatus; label: string }[] = [
  { value: 'watching', label: 'Смотрю' },
  { value: 'planned', label: 'В планах' },
  { value: 'completed', label: 'Просмотрено' },
  { value: 'on_hold', label: 'Отложено' },
  { value: 'dropped', label: 'Брошено' },
];

const STATUS_LABELS: Record<BookmarkStatus, string> = {
  watching: 'Смотрю',
  planned: 'В планах',
  completed: 'Просмотрено',
  on_hold: 'Отложено',
  dropped: 'Брошено',
};

const NUM_COLUMNS = 3;
const GUTTER = 12;
const SIDE_PAD = 12;
const COL_WIDTH = cardWidth(NUM_COLUMNS, GUTTER, SIDE_PAD);

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function LibraryScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const { user, openAuthModal, addToast } = useAuth();

  const [activeStatus, setActiveStatus] = useState<BookmarkStatus>('watching');
  const [menu, setMenu] = useState<{ item: BookmarkItem; x: number; y: number; w: number; h: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const fetcher = useCallback(() => backend.listBookmarks(activeStatus), [activeStatus]);
  const { data, loading, error, refetch } = useApi<BookmarkItem[]>(fetcher, [activeStatus]);

  const handlePressItem = useCallback(
    (item: BookmarkItem) => {
      navigation.navigate('AnimeDetail', { id: item.animeId, title: item.title });
    },
    [navigation],
  );

  const handleLongPress = useCallback((item: BookmarkItem) => (e: any) => {
    // nativeEvent provides pageX/pageY of the touch; fall back to measure.
    const ne = e?.nativeEvent;
    if (ne && (ne.pageX != null || ne.absoluteX != null) && ne.locationX != null) {
      const px = ne.pageX ?? ne.absoluteX;
      const py = ne.pageY ?? ne.absoluteY;
      setMenu({ item, x: px, y: py, w: ne.locationX, h: ne.locationY });
      return;
    }
    setMenu({ item, x: 0, y: 0, w: 0, h: 0 });
  }, []);

  const closeMenu = useCallback(() => setMenu(null), []);

  const changeStatus = useCallback(
    async (item: BookmarkItem, status: BookmarkStatus) => {
      closeMenu();
      if (busy) return;
      setBusy(true);
      try {
        await backend.upsertBookmark({
          animeId: item.animeId,
          status,
          episodes: item.episodesWatched,
        });
        addToast('Статус обновлён', 'success');
        await refetch();
      } catch {
        addToast('Не удалось изменить статус', 'error');
      } finally {
        setBusy(false);
      }
    },
    [busy, closeMenu, refetch, addToast],
  );

  const removeBookmark = useCallback(
    async (item: BookmarkItem) => {
      closeMenu();
      if (busy) return;
      setBusy(true);
      try {
        await backend.removeBookmark(item.animeId);
        addToast('Удалено из библиотеки', 'success');
        await refetch();
      } catch {
        addToast('Не удалось удалить', 'error');
      } finally {
        setBusy(false);
      }
    },
    [busy, closeMenu, refetch, addToast],
  );

  if (!user) {
    return (
      <View style={[styles.flex, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
        <EmptyState
          icon="bookmark-off-outline"
          message="Войдите, чтобы видеть свою библиотеку"
          action={openAuthModal}
          actionLabel="Войти"
        />
      </View>
    );
  }

  const items = data || [];

  const renderCard = ({ item, index }: { item: BookmarkItem; index: number }) => (
    <Pressable
      onLongPress={handleLongPress(item)}
      style={styles.cardSlot}
    >
      <AnimeCard item={item} onPress={handlePressItem} width={COL_WIDTH} />
    </Pressable>
  );

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background, paddingTop: insets.top + 4 }]}>
      <View style={styles.header}>
        <Text variant="titleLarge" style={{ color: theme.colors.onSurface }}>
          Библиотека
        </Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
          {items.length} {pluralize(items.length, ['запись', 'записи', 'записей'])}
        </Text>
      </View>

      <View style={styles.segmentWrap}>
        <SegmentedButtons
          value={activeStatus}
          onValueChange={(v) => setActiveStatus(v as BookmarkStatus)}
          buttons={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          density="small"
        />
      </View>

      {loading ? (
        <LoadingState label="Загрузка библиотеки…" />
      ) : error ? (
        <ErrorState message={error.message} onRetry={refetch} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="bookmark-outline"
          message={`В разделе «${STATUS_LABELS[activeStatus]}» пока пусто`}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item, index) => `${item.animeId}-${index}`}
          renderItem={renderCard}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={{
            paddingHorizontal: SIDE_PAD,
            paddingBottom: insets.bottom + 100,
          }}
          columnWrapperStyle={{ gap: GUTTER }}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={loading}
        />
      )}

      <Menu
        visible={!!menu}
        onDismiss={closeMenu}
        anchor={menu ? { x: menu.x, y: menu.y } : { x: 0, y: 0 }}
      >
        <Menu.Item
          leadingIcon="play-outline"
          onPress={() => menu && changeStatus(menu.item, 'watching')}
          title="В «Смотрю»"
        />
        <Menu.Item
          leadingIcon="calendar-clock"
          onPress={() => menu && changeStatus(menu.item, 'planned')}
          title="В «В планах»"
        />
        <Menu.Item
          leadingIcon="check-circle-outline"
          onPress={() => menu && changeStatus(menu.item, 'completed')}
          title="В «Просмотрено»"
        />
        <Menu.Item
          leadingIcon="pause-circle-outline"
          onPress={() => menu && changeStatus(menu.item, 'on_hold')}
          title="В «Отложено»"
        />
        <Menu.Item
          leadingIcon="stop-circle-outline"
          onPress={() => menu && changeStatus(menu.item, 'dropped')}
          title="В «Брошено»"
        />
        <Divider />
        <Menu.Item
          leadingIcon="trash-can-outline"
          onPress={() => menu && removeBookmark(menu.item)}
          title="Удалить из библиотеки"
        />
      </Menu>
    </View>
  );
}

function pluralize(n: number, forms: [string, string, string]): string {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1];
  return forms[2];
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: SIDE_PAD,
    paddingTop: 8,
    paddingBottom: 4,
  },
  segmentWrap: {
    paddingHorizontal: SIDE_PAD,
    paddingVertical: 8,
  },
  cardSlot: {
    flex: 1,
    alignItems: 'center',
  },
});
