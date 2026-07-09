import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
} from 'react-native';
import {
  useTheme,
  Text,
  TextInput,
  Button,
  Card,
  Chip,
  Switch,
  IconButton,
  Dialog,
  Portal,
  Searchbar,
  ActivityIndicator,
  Surface,
  Divider,
} from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Screen from '../components/Screen';
import Avatar from '../components/Avatar';
import SectionHeader from '../components/SectionHeader';
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import backend from '../api/backend';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Admin'>;

interface AdminUser {
  id: number;
  username: string;
  email?: string;
  role?: string;
  avatarUrl?: string | null;
  avatarColor?: string;
  createdAt?: string;
}

const STAT_LABELS: Record<string, string> = {
  totalUsers: 'Пользователи',
  users: 'Пользователи',
  masters: 'Мастера',
  masterCount: 'Мастера',
  anime: 'Аниме',
  animeCount: 'Аниме',
  bookmarks: 'Закладки',
  bookmarkCount: 'Закладки',
  comments: 'Комментарии',
  commentCount: 'Комментарии',
  ratings: 'Оценки',
  ratingCount: 'Оценки',
  friends: 'Друзья',
  friendCount: 'Друзья',
  issues: 'Задачи',
  issueCount: 'Задачи',
  chats: 'Чаты',
  chatCount: 'Чаты',
  watchRooms: 'Комнаты',
  roomCount: 'Комнаты',
  notifications: 'Уведомления',
  progress: 'Прогресс',
  searches: 'Поиски',
  suggestions: 'Предложения',
};

const STAT_ICONS: Record<string, string> = {
  totalUsers: 'account-group',
  users: 'account-group',
  masters: 'shield-crown',
  masterCount: 'shield-crown',
  anime: 'filmstrip',
  animeCount: 'filmstrip',
  bookmarks: 'bookmark-multiple',
  bookmarkCount: 'bookmark-multiple',
  comments: 'comment-multiple',
  commentCount: 'comment-multiple',
  ratings: 'star',
  ratingCount: 'star',
  friends: 'account-multiple',
  friendCount: 'account-multiple',
  issues: 'bug',
  issueCount: 'bug',
  chats: 'chat',
  chatCount: 'chat',
  watchRooms: 'play-circle',
  roomCount: 'play-circle',
  notifications: 'bell',
  progress: 'play',
  searches: 'magnify',
  suggestions: 'lightbulb',
};

function humanizeKey(key: string): string {
  return STAT_LABELS[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

function iconForKey(key: string): string {
  return STAT_ICONS[key] || 'chart-bar';
}

function StatTile({ label, value, icon }: { label: string; value: any; icon: string }) {
  const theme = useTheme();
  return (
    <Surface style={[styles.statTile, { backgroundColor: theme.colors.surfaceContainer }]} elevation={0}>
      <View style={[styles.statIconWrap, { backgroundColor: theme.colors.primaryContainer }]}>
        <MaterialCommunityIcons name={icon as any} size={20} color={theme.colors.onPrimaryContainer} />
      </View>
      <Text style={[styles.statValue, { color: theme.colors.onSurface }]}>{String(value ?? 0)}</Text>
      <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]} numberOfLines={2}>
        {label}
      </Text>
    </Surface>
  );
}

export default function AdminScreen(_: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user, refreshUser, addToast, openAuthModal } = useAuth();

  const isAdmin = user?.role === 'admin';

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [claimSecret, setClaimSecret] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Debounce search.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const statsApi = useApi(() => backend.adminStats(), []);
  const usersApi = useApi(
    () => backend.adminUsers({ q: debouncedQuery || undefined }),
    [debouncedQuery],
  );

  const stats = statsApi.data as Record<string, any> | null;
  const usersRaw = usersApi.data as AdminUser[] | { users?: AdminUser[]; total?: number } | null;
  const users: AdminUser[] = useMemo(() => {
    if (!usersRaw) return [];
    if (Array.isArray(usersRaw)) return usersRaw;
    if (usersRaw.users) return usersRaw.users;
    return [];
  }, [usersRaw]);

  const statEntries = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats).filter(([, v]) => typeof v === 'number' || typeof v === 'string');
  }, [stats]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([statsApi.refetch(), usersApi.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [statsApi, usersApi]);

  const handleClaim = useCallback(async () => {
    if (!claimSecret.trim()) {
      addToast('Введите секретный код', 'error');
      return;
    }
    setClaiming(true);
    try {
      await backend.adminClaim(claimSecret.trim());
      await refreshUser();
      addToast('Права администратора получены', 'success');
      setClaimSecret('');
    } catch (e: any) {
      addToast(e?.message || 'Не удалось получить права', 'error');
    } finally {
      setClaiming(false);
    }
  }, [claimSecret, refreshUser, addToast]);

  const handleToggleMaster = useCallback(
    async (u: AdminUser) => {
      setTogglingId(u.id);
      try {
        await backend.adminToggleMaster(u.id);
        await usersApi.refetch();
        await statsApi.refetch();
        addToast(
          u.role === 'master' ? `${u.username} больше не мастер` : `${u.username} теперь мастер`,
          'success',
        );
      } catch (e: any) {
        addToast(e?.message || 'Не удалось изменить роль', 'error');
      } finally {
        setTogglingId(null);
      }
    },
    [usersApi, statsApi, addToast],
  );

  const handleDeleteUser = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await backend.adminDeleteUser(deleteTarget.id);
      addToast(`Пользователь ${deleteTarget.username} удалён`, 'success');
      setDeleteTarget(null);
      await Promise.all([usersApi.refetch(), statsApi.refetch()]);
    } catch (e: any) {
      addToast(e?.message || 'Не удалось удалить пользователя', 'error');
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, usersApi, statsApi, addToast]);

  // ---- Not logged in ----
  if (!user) {
    return (
      <Screen>
        <EmptyState
          icon="account-lock-outline"
          message="Войдите в аккаунт для доступа к админ-панели"
          action={openAuthModal}
          actionLabel="Войти"
        />
      </Screen>
    );
  }

  // ---- Not admin: claim flow ----
  if (!isAdmin) {
    return (
      <Screen refreshing={refreshing} onRefresh={handleRefresh}>
        <View style={styles.claimWrap}>
          <EmptyState
            icon="shield-lock-outline"
            message="Недостаточно прав. Введите секретный код администратора, чтобы получить доступ."
          />
          <Card style={[styles.claimCard, { backgroundColor: theme.colors.surfaceContainer }]}>
            <Card.Content>
              <Text variant="titleLarge" style={{ marginBottom: 12, color: theme.colors.onSurface }}>
                Стать админом
              </Text>
              <TextInput
                mode="outlined"
                label="ADMIN_SECRET"
                value={claimSecret}
                onChangeText={setClaimSecret}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                right={<TextInput.Icon icon="shield-key" />}
              />
              <Button
                mode="contained"
                onPress={handleClaim}
                loading={claiming}
                disabled={claiming}
                style={styles.claimBtn}
              >
                Подтвердить
              </Button>
            </Card.Content>
          </Card>
        </View>
      </Screen>
    );
  }

  // ---- Admin panel ----
  const isLoading = statsApi.loading && !stats;
  const isError = statsApi.error && !stats;

  const renderUser = ({ item }: { item: AdminUser }) => {
    const isMaster = item.role === 'master';
    const isToggling = togglingId === item.id;
    return (
      <Card style={[styles.userCard, { backgroundColor: theme.colors.surfaceContainer }]}>
        <View style={styles.userRow}>
          <Avatar user={item} size={44} />
          <View style={styles.userInfo}>
            <Text variant="titleSmall" numberOfLines={1} style={{ color: theme.colors.onSurface }}>
              {item.username}
            </Text>
            {item.email ? (
              <Text variant="bodySmall" numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant }}>
                {item.email}
              </Text>
            ) : null}
            <View style={styles.roleRow}>
              <Chip
                mode="flat"
                compact
                style={[
                  styles.roleChip,
                  isMaster
                    ? { backgroundColor: theme.colors.tertiaryContainer }
                    : { backgroundColor: theme.colors.secondaryContainer },
                ]}
                textStyle={{
                  color: isMaster ? theme.colors.onTertiaryContainer : theme.colors.onSecondaryContainer,
                  fontSize: 11,
                }}
              >
                {item.role === 'admin' ? 'Админ' : isMaster ? 'Мастер' : 'Пользователь'}
              </Chip>
            </View>
          </View>
          <View style={styles.userActions}>
            <View style={styles.toggleRow}>
              <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                Мастер
              </Text>
              {isToggling ? (
                <ActivityIndicator size={18} style={{ marginLeft: 4 }} />
              ) : (
                <Switch
                  value={isMaster}
                  onValueChange={() => handleToggleMaster(item)}
                  disabled={item.role === 'admin'}
                  color={theme.colors.primary}
                />
              )}
            </View>
            <IconButton
              icon="delete-outline"
              iconColor={theme.colors.error}
              size={22}
              onPress={() => setDeleteTarget(item)}
              disabled={item.role === 'admin'}
            />
          </View>
        </View>
      </Card>
    );
  };

  return (
    <Screen refreshing={refreshing} onRefresh={handleRefresh}>
      {/* Stats */}
      <SectionHeader title="Статистика" />

      {isLoading ? (
        <LoadingState label="Загрузка статистики…" />
      ) : isError ? (
        <ErrorState message={statsApi.error?.message} onRetry={() => statsApi.refetch()} />
      ) : statEntries.length === 0 ? (
        <EmptyState icon="chart-bar" message="Нет данных статистики" />
      ) : (
        <FlatList
          data={statEntries}
          keyExtractor={([key]) => key}
          numColumns={3}
          scrollEnabled={false}
          columnWrapperStyle={styles.statRow}
          contentContainerStyle={{ paddingBottom: 4 }}
          renderItem={({ item: [key, value] }) => (
            <StatTile label={humanizeKey(key)} value={value} icon={iconForKey(key)} />
          )}
        />
      )}

      {/* Users */}
      <SectionHeader title="Пользователи" />

      <Searchbar
        placeholder="Поиск по имени или email…"
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={[styles.searchbar, { backgroundColor: theme.colors.surfaceContainerHigh }]}
        inputStyle={{ color: theme.colors.onSurface }}
        icon="magnify"
        clearIcon="close"
      />

      {usersApi.loading && !usersRaw ? (
        <LoadingState label="Загрузка пользователей…" />
      ) : usersApi.error ? (
        <ErrorState message={usersApi.error?.message} onRetry={() => usersApi.refetch()} />
      ) : users.length === 0 ? (
        <EmptyState
          icon="account-search-outline"
          message={debouncedQuery ? 'Ничего не найдено' : 'Нет пользователей'}
        />
      ) : (
        <View style={styles.usersList}>
          {users.map((u, idx) => (
            <View key={String(u.id)}>
              {renderUser({ item: u })}
              {idx < users.length - 1 && <Divider style={{ marginVertical: 0 }} />}
            </View>
          ))}
        </View>
      )}

      {/* Delete confirmation */}
      <Portal>
        <Dialog
          visible={!!deleteTarget}
          onDismiss={() => (deleting ? null : setDeleteTarget(null))}
          style={{ backgroundColor: theme.colors.surfaceContainerHigh }}
        >
          <Dialog.Title>Удалить пользователя?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {`Пользователь «${deleteTarget?.username}» будет удалён безвозвратно вместе со всеми данными.`}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteTarget(null)} disabled={deleting}>
              Отмена
            </Button>
            <Button
              mode="contained"
              onPress={handleDeleteUser}
              loading={deleting}
              disabled={deleting}
              buttonColor={theme.colors.error}
              textColor={theme.colors.onError}
            >
              Удалить
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  claimWrap: {
    paddingBottom: 24,
  },
  claimCard: {
    borderRadius: 14,
    marginTop: 8,
  },
  claimBtn: {
    marginTop: 16,
    borderRadius: 14,
  },
  statTile: {
    flex: 1,
    margin: 4,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    minHeight: 104,
    justifyContent: 'center',
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
    lineHeight: 13,
  },
  statRow: {
    justifyContent: 'flex-start',
    gap: 0,
  },
  searchbar: {
    borderRadius: 14,
    marginBottom: 12,
  },
  usersList: {
    paddingBottom: 24,
  },
  userCard: {
    borderRadius: 14,
    marginVertical: 4,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  roleRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  roleChip: {
    height: 24,
    borderRadius: 8,
  },
  userActions: {
    alignItems: 'flex-end',
    gap: 0,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
