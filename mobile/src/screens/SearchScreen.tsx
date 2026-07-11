import { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, FlatList, Pressable, ActivityIndicator, Dimensions } from 'react-native';
import { useTheme, Searchbar, Text, Chip, Button } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import AnimeCard from '../components/AnimeCard';
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { cardWidth } from '../utils/layout';
import { api } from '../api/yummy';
import backend from '../api/backend';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Search'>;

const NUM_COLUMNS = 3;
const GUTTER = 12;
const SIDE_PAD = 12;
const COL_WIDTH = cardWidth(NUM_COLUMNS, GUTTER, SIDE_PAD);
const PAGE_SIZE = 24;

interface HistoryItem {
  id: number;
  query: string;
}

export default function SearchScreen(props: Props) {
  const { route, navigation } = props;
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user, addToast } = useAuth();

  const initialQ = route.params?.q ?? '';
  const [inputQuery, setInputQuery] = useState(initialQ);
  const [submittedQuery, setSubmittedQuery] = useState(initialQ.trim());

  const [results, setResults] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const reqIdRef = useRef(0);

  // React to inbound route param (deep-link / navigate with q).
  useEffect(() => {
    const q = route.params?.q ?? '';
    if (q !== inputQuery) {
      setInputQuery(q);
      setSubmittedQuery(q.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.q]);

  // Fetch first page whenever the submitted query changes.
  useEffect(() => {
    const q = submittedQuery.trim();
    if (!q) {
      setResults([]);
      setError(null);
      setHasMore(true);
      setPage(1);
      setLoading(false);
      return;
    }
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    api
      .search(q, { limit: PAGE_SIZE, offset: 0 })
      .then((arr) => {
        if (reqId !== reqIdRef.current) return;
        const r = Array.isArray(arr) ? arr : [];
        setResults(r);
        setHasMore(r.length >= PAGE_SIZE);
        setPage(1);
      })
      .catch((e) => {
        if (reqId === reqIdRef.current) setError(e);
      })
      .finally(() => {
        if (reqId === reqIdRef.current) setLoading(false);
      });
  }, [submittedQuery]);

  const loadMore = useCallback(() => {
    const q = submittedQuery.trim();
    if (!q || loading || loadingMore || !hasMore) return;
    const nextPage = page + 1;
    const reqId = ++reqIdRef.current;
    setLoadingMore(true);
    api
      .search(q, { limit: PAGE_SIZE, offset: nextPage * PAGE_SIZE - PAGE_SIZE })
      .then((arr) => {
        if (reqId !== reqIdRef.current) return;
        const r = Array.isArray(arr) ? arr : [];
        setResults((prev) => [...prev, ...r]);
        setHasMore(r.length >= PAGE_SIZE);
        setPage(nextPage);
      })
      .catch(() => {
        if (reqId === reqIdRef.current) {
          addToast('Не удалось загрузить ещё', 'error');
        }
      })
      .finally(() => {
        if (reqId === reqIdRef.current) setLoadingMore(false);
      });
  }, [submittedQuery, page, loading, loadingMore, hasMore, addToast]);

  // Search history (shown when query is empty).
  const { data: historyData, refetch: refetchHistory } = useApi<HistoryItem[]>(
    () => (user ? backend.searchHistory() : Promise.resolve([])),
    [user?.id, submittedQuery],
  );
  const history = Array.isArray(historyData) ? historyData : [];

  const runSearch = useCallback(
    (q: string) => {
      const trimmed = q.trim();
      setInputQuery(trimmed);
      setSubmittedQuery(trimmed);
      if (trimmed && user) {
        backend.saveSearch(trimmed).catch(() => {}).then(() => refetchHistory());
      }
    },
    [user, refetchHistory],
  );

  const onSubmit = useCallback(() => runSearch(inputQuery), [inputQuery, runSearch]);

  const removeHistory = useCallback(
    (id: number) => {
      backend
        .deleteSearch(id)
        .then(() => refetchHistory())
        .catch(() => addToast('Не удалось удалить', 'error'));
    },
    [refetchHistory, addToast],
  );

  const clearHistory = useCallback(() => {
    backend
      .clearSearchHistory()
      .then(() => refetchHistory())
      .catch(() => addToast('Не удалось очистить', 'error'));
  }, [refetchHistory, addToast]);

  const openAnime = useCallback(
    (item: any) => {
      const rawId = item?.anime_id ?? item?.anime_url ?? item?.url ?? item?.id;
      if (rawId == null) return;
      const id = String(rawId).replace(/^\/anime\//, '');
      const title = item?.title || item?.name || item?.ru_title;
      navigation.navigate('AnimeDetail', { id, title });
    },
    [navigation],
  );

  const keyOf = useCallback((item: any, index: number) => {
    const k = item?.anime_id ?? item?.anime_url ?? item?.url ?? item?.id;
    return k != null ? String(k) : `item-${index}`;
  }, []);

  const hasQuery = submittedQuery.trim().length > 0;
  const initialLoading = loading && page === 1 && results.length === 0;

  const renderCard = ({ item }: { item: any; index: number }) => (
    <View style={styles.cardSlot}>
      <AnimeCard item={item} onPress={openAnime} width={COL_WIDTH} />
    </View>
  );

  const ListHeader = (
    <View>
      {hasQuery && results.length > 0 && (
        <Text variant="bodyMedium" style={[styles.resultsCount, { color: theme.colors.onSurfaceVariant }]}>
          {results.length} результатов
        </Text>
      )}
      {!hasQuery && (
        <View style={styles.historyBlock}>
          <View style={styles.historyHead}>
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
              История поиска
            </Text>
            {history.length > 0 && (
              <Button mode="text" compact onPress={clearHistory} labelStyle={{ fontSize: 12 }}>
                Очистить
              </Button>
            )}
          </View>
          {!user ? (
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              Войдите, чтобы сохранять историю поиска.
            </Text>
          ) : history.length === 0 ? (
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              Здесь будут ваши недавние поисковые запросы.
            </Text>
          ) : (
            <View style={styles.chipsWrap}>
              {history.map((h) => (
                <Chip
                  key={h.id}
                  mode="outlined"
                  onPress={() => runSearch(h.query)}
                  onClose={() => removeHistory(h.id)}
                  style={styles.chip}
                  textStyle={{ color: theme.colors.onSurface }}
                >
                  {h.query}
                </Chip>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );

  const ListEmpty = hasQuery ? (
    initialLoading ? (
      <LoadingState label="Поиск…" />
    ) : error ? (
      <ErrorState message={error.message} onRetry={() => setSubmittedQuery((q) => q.trim())} />
    ) : (
      <EmptyState
        icon="magnify-close"
        message={`По запросу «${submittedQuery.trim()}» ничего не найдено`}
      />
    )
  ) : null;

  const ListFooter =
    loadingMore ? (
      <View style={styles.footer}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    ) : null;

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background, paddingTop: insets.top + 4 }]}>
      <View style={styles.searchWrap}>
        <Searchbar
          placeholder="Поиск аниме…"
          value={inputQuery}
          onChangeText={setInputQuery}
          onSubmitEditing={onSubmit}
          returnKeyType="search"
          icon="magnify"
          clearIcon="close"
          style={styles.searchbar}
          inputStyle={{ color: theme.colors.onSurface }}
        />
      </View>

      <FlatList
        data={hasQuery ? results : []}
        keyExtractor={keyOf}
        renderItem={renderCard}
        numColumns={NUM_COLUMNS}
        columnWrapperStyle={{ gap: GUTTER }}
        contentContainerStyle={{
          paddingHorizontal: SIDE_PAD,
          paddingBottom: insets.bottom + 100,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        ListFooterComponent={ListFooter}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        initialNumToRender={PAGE_SIZE}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  searchWrap: {
    paddingHorizontal: SIDE_PAD,
    paddingBottom: 8,
  },
  searchbar: {
    borderRadius: 14,
  },
  resultsCount: {
    marginTop: 8,
    marginBottom: 4,
  },
  historyBlock: {
    marginTop: 8,
    marginBottom: 4,
  },
  historyHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    marginBottom: 0,
  },
  cardSlot: {
    flex: 1 / NUM_COLUMNS,
    maxWidth: Dimensions.get('window').width / NUM_COLUMNS,
  },
  footer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});
