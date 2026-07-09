import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Text,
} from 'react-native';
import { useTheme, Searchbar, Chip, IconButton } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../api/yummy';
import { RootStackParamList } from '../navigation/AppNavigator';
import AnimeCard from '../components/AnimeCard';
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import { cardWidth } from '../utils/layout';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const COLUMN_COUNT = 3;
const PAGE_SIZE = 24;

// Static filter option sets (YummyAnime catalog metadata shapes vary, so we
// derive chips dynamically from the catalog response when available and fall
// back to these sensible defaults).
const TYPE_OPTIONS = [
  { value: 'tv', label: 'ТВ' },
  { value: 'movie', label: 'Фильм' },
  { value: 'ova', label: 'OVA' },
  { value: 'ona', label: 'ONA' },
  { value: 'special', label: 'Спешл' },
];

const ORDER_OPTIONS = [
  { value: 'rating', label: 'По рейтингу' },
  { value: 'new', label: 'Новинки' },
  { value: 'views', label: 'По просмотрам' },
  { value: 'alphabet', label: 'По алфавиту' },
];

interface FilterState {
  type: string | null;
  status: string | null;
  season: string | null;
  order: string | null;
  genres: string[];
}

const EMPTY_FILTERS: FilterState = {
  type: null,
  status: null,
  season: null,
  order: null,
  genres: [],
};

export default function CatalogScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();

  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);

  // Catalog metadata (genres, types, years, seasons).
  const [catalog, setCatalog] = useState<any>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<Error | null>(null);

  // Grid data + pagination.
  const [items, setItems] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [gridError, setGridError] = useState<Error | null>(null);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Filters panel toggle.
  const [showFilters, setShowFilters] = useState(false);

  // Latest filters in a ref so onEndReached reads fresh values without
  // re-creating the callback.
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const pageRef = useRef(page);
  pageRef.current = page;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const reachedEndRef = useRef(reachedEnd);
  reachedEndRef.current = reachedEnd;
  const loadingMoreRef = useRef(loadingMore);
  loadingMoreRef.current = loadingMore;

  // ---- fetch catalog metadata once ----
  const fetchCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const data = await api.catalog();
      setCatalog(data);
    } catch (e: any) {
      setCatalogError(e);
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  // ---- build list params from filters ----
  const buildParams = useCallback((pageNum: number, f: FilterState) => {
    const params: any = { limit: PAGE_SIZE, page: pageNum };
    if (f.type) params.type = f.type;
    if (f.status) params.status = f.status;
    if (f.season) params.season = f.season;
    if (f.order) params.order = f.order;
    if (f.genres.length) params.genres = f.genres;
    return params;
  }, []);

  // ---- fetch a page ----
  const loadPage = useCallback(
    async (pageNum: number, replace: boolean) => {
      const f = filtersRef.current;
      const params = buildParams(pageNum, f);
      try {
        const res: any = await api.list(params);
        const rows: any[] = Array.isArray(res) ? res : res?.items || res?.data || res?.list || [];
        if (replace) {
          setItems(rows);
        } else {
          setItems((prev) => (pageNum === 1 ? rows : [...prev, ...rows]));
        }
        setReachedEnd(rows.length < PAGE_SIZE);
        setPage(pageNum);
      } catch (e: any) {
        setGridError(e);
      }
    },
    [buildParams],
  );

  // ---- initial / filter change load ----
  const reload = useCallback(async () => {
    setLoadingInitial(true);
    setGridError(null);
    setReachedEnd(false);
    try {
      await loadPage(1, true);
    } finally {
      setLoadingInitial(false);
    }
  }, [loadPage]);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // ---- infinite scroll ----
  const onEndReached = useCallback(async () => {
    if (loadingMoreRef.current || reachedEndRef.current) return;
    setLoadingMore(true);
    try {
      const next = pageRef.current + 1;
      const prevLen = itemsRef.current.length;
      await loadPage(next, false);
      // guard against no-growth loops
      if (itemsRef.current.length === prevLen) setReachedEnd(true);
    } finally {
      setLoadingMore(false);
    }
  }, [loadPage]);

  // ---- pull to refresh ----
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchCatalog(), loadPage(1, true)]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchCatalog, loadPage]);

  // ---- search submit ----
  const onSubmitSearch = useCallback(() => {
    const q = query.trim();
    if (!q) return;
    navigation.navigate('Search', { q });
  }, [query, navigation]);

  // ---- filter handlers ----
  const toggleGenre = useCallback((value: string) => {
    setFilters((prev) => {
      const has = prev.genres.includes(value);
      return {
        ...prev,
        genres: has ? prev.genres.filter((g) => g !== value) : [...prev.genres, value],
      };
    });
  }, []);

  const setSingle = useCallback(
    (key: keyof FilterState, value: string | null) => {
      setFilters((prev) => ({ ...prev, [key]: prev[key] === value ? null : value }));
    },
    [],
  );

  const clearFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setQuery('');
  }, []);

  // ---- derived filter option lists from catalog metadata ----
  const genreOptions = useMemo<any[]>(() => {
    if (!catalog) return [];
    const g = catalog.genres || catalog.genre || [];
    if (Array.isArray(g)) return g;
    if (Array.isArray(g?.list)) return g.list;
    return [];
  }, [catalog]);

  const yearOptions = useMemo<{ value: string; label: string }[]>(() => {
    if (!catalog) return [];
    const y = catalog.years || catalog.year || [];
    let arr: any[] = [];
    if (Array.isArray(y)) arr = y;
    else if (Array.isArray(y?.list)) arr = y.list;
    return arr
      .map((item: any) =>
        typeof item === 'object' ? { value: String(item.value ?? item.id ?? item.year), label: String(item.label ?? item.name ?? item.value) } : { value: String(item), label: String(item) },
      )
      .slice(0, 8);
  }, [catalog]);

  const statusOptions = useMemo<{ value: string; label: string }[]>(() => {
    if (!catalog) return [];
    const s = catalog.statuses || catalog.status || [];
    let arr: any[] = [];
    if (Array.isArray(s)) arr = s;
    else if (Array.isArray(s?.list)) arr = s.list;
    return arr
      .map((item: any) =>
        typeof item === 'object' ? { value: String(item.value ?? item.id), label: String(item.label ?? item.name ?? item.value) } : { value: String(item), label: String(item) },
      )
      .slice(0, 6);
  }, [catalog]);

  const activeFilterCount =
    (filters.type ? 1 : 0) +
    (filters.status ? 1 : 0) +
    (filters.season ? 1 : 0) +
    (filters.order ? 1 : 0) +
    filters.genres.length;

  const cw = cardWidth(COLUMN_COUNT);

  const renderItem = useCallback(
    ({ item }: { item: any }) => (
      <View style={{ width: cw, marginRight: 12 }}>
        <AnimeCard
          item={item}
          width={cw}
          onPress={(it) =>
            navigation.navigate('AnimeDetail', {
              id: it.id ?? it.url ?? it.code,
              title: it.title || it.ru_title || it.name,
            })
          }
        />
      </View>
    ),
    [cw, navigation],
  );

  const keyExtractor = useCallback((item: any, index: number) => {
    const id = item.id ?? item.url ?? item.code ?? index;
    return String(id);
  }, []);

  // ---- List header (searchbar + filter chips) ----
  const ListHeader = (
    <View style={styles.header}>
      <Searchbar
        placeholder="Поиск аниме…"
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={onSubmitSearch}
        style={[styles.searchbar, { backgroundColor: theme.colors.surfaceContainer }]}
        inputStyle={{ color: theme.colors.onSurface }}
        placeholderTextColor={theme.colors.onSurfaceVariant}
        iconColor={theme.colors.onSurfaceVariant}
        returnKeyType="search"
      />

      <View style={styles.filterBar}>
        <Chip
          selected={showFilters}
          onPress={() => setShowFilters((v) => !v)}
          mode="outlined"
          style={styles.chip}
          selectedColor={theme.colors.primary}
        >
          Фильтры{activeFilterCount ? ` (${activeFilterCount})` : ''}
        </Chip>
        {activeFilterCount > 0 && (
          <Chip onPress={clearFilters} mode="outlined" style={styles.chip} icon="close">
            Сбросить
          </Chip>
        )}
      </View>

      {showFilters && (
        <View style={[styles.filtersPanel, { backgroundColor: theme.colors.surfaceContainer }]}>
          {/* Type */}
          <Text style={[styles.filterLabel, { color: theme.colors.onSurfaceVariant }]}>Тип</Text>
          <View style={styles.chipRow}>
            {TYPE_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                selected={filters.type === o.value}
                onPress={() => setSingle('type', o.value)}
                mode="outlined"
                style={styles.chip}
                selectedColor={theme.colors.primary}
              >
                {o.label}
              </Chip>
            ))}
          </View>

          {/* Status */}
          {statusOptions.length > 0 && (
            <>
              <Text style={[styles.filterLabel, { color: theme.colors.onSurfaceVariant }]}>Статус</Text>
              <View style={styles.chipRow}>
                {statusOptions.map((o) => (
                  <Chip
                    key={o.value}
                    selected={filters.status === o.value}
                    onPress={() => setSingle('status', o.value)}
                    mode="outlined"
                    style={styles.chip}
                    selectedColor={theme.colors.primary}
                  >
                    {o.label}
                  </Chip>
                ))}
              </View>
            </>
          )}

          {/* Year (acts as season filter) */}
          {yearOptions.length > 0 && (
            <>
              <Text style={[styles.filterLabel, { color: theme.colors.onSurfaceVariant }]}>Год</Text>
              <View style={styles.chipRow}>
                {yearOptions.map((o) => (
                  <Chip
                    key={o.value}
                    selected={filters.season === o.value}
                    onPress={() => setSingle('season', o.value)}
                    mode="outlined"
                    style={styles.chip}
                    selectedColor={theme.colors.primary}
                  >
                    {o.label}
                  </Chip>
                ))}
              </View>
            </>
          )}

          {/* Order */}
          <Text style={[styles.filterLabel, { color: theme.colors.onSurfaceVariant }]}>Сортировка</Text>
          <View style={styles.chipRow}>
            {ORDER_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                selected={filters.order === o.value}
                onPress={() => setSingle('order', o.value)}
                mode="outlined"
                style={styles.chip}
                selectedColor={theme.colors.primary}
              >
                {o.label}
              </Chip>
            ))}
          </View>

          {/* Genres */}
          {genreOptions.length > 0 && (
            <>
              <Text style={[styles.filterLabel, { color: theme.colors.onSurfaceVariant }]}>Жанры</Text>
              <View style={styles.chipRow}>
                {genreOptions.slice(0, 12).map((g: any) => {
                  const val = typeof g === 'object' ? String(g.value ?? g.id ?? g.slug) : String(g);
                  const label = typeof g === 'object' ? String(g.label ?? g.name ?? g.value) : String(g);
                  return (
                    <Chip
                      key={val}
                      selected={filters.genres.includes(val)}
                      onPress={() => toggleGenre(val)}
                      mode="outlined"
                      style={styles.chip}
                      selectedColor={theme.colors.primary}
                    >
                      {label}
                    </Chip>
                  );
                })}
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );

  // ---- Loading / error states for the very first load ----
  if (catalogLoading && loadingInitial && items.length === 0) {
    return <LoadingState label="Загрузка каталога…" />;
  }
  if (catalogError && !catalog) {
    return (
      <ErrorState
        message="Не удалось загрузить каталог"
        onRetry={() => {
          fetchCatalog();
          reload();
        }}
      />
    );
  }
  if (gridError && items.length === 0) {
    return (
      <ErrorState
        message={gridError.message || 'Не удалось загрузить аниме'}
        onRetry={reload}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top + 4 }]}>
      <FlatList
        data={items}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        numColumns={COLUMN_COUNT}
        columnWrapperStyle={{ justifyContent: 'flex-start' }}
        contentContainerStyle={{
          paddingHorizontal: 12,
          paddingBottom: insets.bottom + 96,
        }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={ListHeader}
        ListHeaderComponentStyle={{ marginBottom: 8 }}
        ListEmptyComponent={
          !loadingInitial ? (
            <EmptyState
              icon="magnify"
              message="Ничего не найдено. Попробуйте изменить фильтры."
              action={activeFilterCount ? clearFilters : undefined}
              actionLabel={activeFilterCount ? 'Сбросить фильтры' : undefined}
            />
          ) : null
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footer}>
              <ActivityIndicator color={theme.colors.primary} />
              <Text style={[styles.footerText, { color: theme.colors.onSurfaceVariant }]}>
                Загрузка…
              </Text>
            </View>
          ) : reachedEnd && items.length > 0 ? (
            <Text style={[styles.endText, { color: theme.colors.onSurfaceVariant }]}>
              Это всё
            </Text>
          ) : null
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      />

      {/* Floating filter toggle for quick access */}
      {showFilters && (
        <View
          style={[styles.fabWrap, { bottom: insets.bottom + 90 }]}
          pointerEvents="box-none"
        >
          <IconButton
            icon="filter-variant-remove"
            mode="contained"
            containerColor={theme.colors.primary}
            iconColor={theme.colors.onPrimary}
            onPress={clearFilters}
            accessibilityLabel="Сбросить фильтры"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    marginBottom: 8,
  },
  searchbar: {
    borderRadius: 14,
    elevation: 0,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 8,
  },
  filtersPanel: {
    marginTop: 8,
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 14,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  footerText: {
    fontSize: 13,
  },
  endText: {
    textAlign: 'center',
    fontSize: 12,
    paddingVertical: 16,
  },
  fabWrap: {
    position: 'absolute',
    right: 16,
  },
});
