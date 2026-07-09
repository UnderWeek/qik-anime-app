import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import {
  useTheme,
  Text,
  Searchbar,
  Button,
  IconButton,
  Menu,
  Divider,
  ActivityIndicator,
} from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import Screen from '../components/Screen';
import Avatar from '../components/Avatar';
import SectionHeader from '../components/SectionHeader';
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import backend from '../api/backend';

type Props = NativeStackScreenProps<RootStackParamList, 'Friends'>;

interface FriendUser {
  id: number;
  username: string;
  avatarUrl?: string | null;
  avatarColor?: string;
  avatarFrame?: string | null;
}

interface PendingRequest {
  id?: number;
  requestId?: number;
  fromUser?: FriendUser;
  requester?: FriendUser;
  user?: FriendUser;
  // flat shape fallback
  username?: string;
  avatarUrl?: string | null;
  avatarColor?: string;
  avatarFrame?: string | null;
}

function pickPendingUser(req: PendingRequest): FriendUser {
  return (
    req.fromUser ||
    req.requester ||
    req.user || {
      id: (req as any).id ?? (req as any).userId ?? 0,
      username: req.username || 'Пользователь',
      avatarUrl: req.avatarUrl,
      avatarColor: req.avatarColor,
      avatarFrame: req.avatarFrame,
    }
  );
}

function pickRequestId(req: PendingRequest): number {
  return req.requestId ?? req.id ?? pickPendingUser(req).id;
}

export default function FriendsScreen(props: Props) {
  const { navigation } = props;
  const theme = useTheme();
  const { user, openAuthModal, addToast } = useAuth();

  const friendsApi = useApi<FriendUser[]>(() => backend.listFriends(), []);
  const pendingApi = useApi<PendingRequest[]>(() => backend.pendingFriends(), []);

  const refreshing = friendsApi.loading || pendingApi.loading;

  const onRefresh = useCallback(async () => {
    await Promise.all([friendsApi.refetch(), pendingApi.refetch()]);
  }, [friendsApi, pendingApi]);

  // ---- search ----
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FriendUser[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [requestedIds, setRequestedIds] = useState<Set<number>>(new Set());
  const [busyId, setBusyId] = useState<number | null>(null);

  const debounceTimer = useMemo(() => ({ t: null as any }), []);

  const runSearch = useCallback(
    (q: string) => {
      if (!user) {
        openAuthModal();
        return;
      }
      const trimmed = q.trim();
      if (!trimmed) {
        setSearchResults(null);
        setSearchError(null);
        return;
      }
      setSearching(true);
      setSearchError(null);
      backend
        .searchUsers(trimmed)
        .then((res: any) => {
          const list: FriendUser[] = Array.isArray(res) ? res : res?.users ?? [];
          setSearchResults(
            list.filter((u) => (user ? u.id !== user.id : true)),
          );
        })
        .catch(() => {
          setSearchError('Ошибка поиска');
          setSearchResults([]);
        })
        .finally(() => setSearching(false));
    },
    [user, openAuthModal],
  );

  const onChangeQuery = useCallback(
    (text: string) => {
      setQuery(text);
      if (debounceTimer.t) clearTimeout(debounceTimer.t);
      debounceTimer.t = setTimeout(() => runSearch(text), 400);
    },
    [runSearch, debounceTimer],
  );

  useEffect(() => {
    return () => {
      if (debounceTimer.t) clearTimeout(debounceTimer.t);
    };
  }, [debounceTimer]);

  // ---- actions ----
  const handleAccept = async (req: PendingRequest) => {
    if (!user) return openAuthModal();
    const id = pickRequestId(req);
    setBusyId(id);
    try {
      await backend.acceptFriend(id);
      addToast('Заявка принята', 'success');
      await Promise.all([friendsApi.refetch(), pendingApi.refetch()]);
    } catch {
      addToast('Не удалось принять заявку', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleDecline = async (req: PendingRequest) => {
    if (!user) return openAuthModal();
    const other = pickPendingUser(req).id;
    setBusyId(other);
    try {
      await backend.removeFriend(other);
      addToast('Заявка отклонена', 'success');
      await pendingApi.refetch();
    } catch {
      addToast('Не удалось отклонить заявку', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleRemoveFriend = async (friend: FriendUser, close: () => void) => {
    if (!user) return openAuthModal();
    close();
    setBusyId(friend.id);
    try {
      await backend.removeFriend(friend.id);
      addToast('Друг удалён', 'success');
      await friendsApi.refetch();
    } catch {
      addToast('Не удалось удалить друга', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleStartChat = async (friend: FriendUser, close: () => void) => {
    if (!user) return openAuthModal();
    close();
    setBusyId(friend.id);
    try {
      const res: any = await backend.startChat(friend.id);
      const chatId = res?.id ?? res?.chatId ?? res?.chat?.id;
      if (chatId != null) {
        navigation.navigate('ChatThread', { chatId, title: friend.username });
      } else {
        addToast('Не удалось открыть чат', 'error');
      }
    } catch {
      addToast('Не удалось начать чат', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleRequestFriend = async (target: FriendUser) => {
    if (!user) return openAuthModal();
    setBusyId(target.id);
    try {
      await backend.requestFriend(target.id);
      addToast('Заявка отправлена', 'success');
      setRequestedIds((prev) => new Set(prev).add(target.id));
    } catch {
      addToast('Не удалось отправить заявку', 'error');
    } finally {
      setBusyId(null);
    }
  };

  // ---- menu state ----
  const [menuFor, setMenuFor] = useState<number | null>(null);

  const friends = friendsApi.data ?? [];
  const pending = pendingApi.data ?? [];

  const error = friendsApi.error || pendingApi.error;

  if (error && !friends.length && !pending.length) {
    return (
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
        <ErrorState message="Не удалось загрузить друзей" onRetry={onRefresh} />
      </Screen>
    );
  }

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      {/* Search */}
      <View style={styles.searchWrap}>
        <Searchbar
          placeholder="Найти пользователей…"
          value={query}
          onChangeText={onChangeQuery}
          style={[styles.searchbar, { backgroundColor: theme.colors.surfaceContainerHigh }]}
          inputStyle={{ color: theme.colors.onSurface }}
          iconColor={theme.colors.onSurfaceVariant}
          placeholderTextColor={theme.colors.onSurfaceVariant}
          returnKeyType="search"
          onSubmitEditing={() => runSearch(query)}
        />
      </View>

      {/* Search results */}
      {searchResults !== null && (
        <View style={styles.section}>
          <SectionHeader title="Результаты поиска" />
          {searching ? (
            <View style={styles.centerSmall}>
              <ActivityIndicator color={theme.colors.primary} />
            </View>
          ) : searchError ? (
            <Text style={[styles.muted, { color: theme.colors.onSurfaceVariant }]}>
              {searchError}
            </Text>
          ) : searchResults.length === 0 ? (
            <Text style={[styles.muted, { color: theme.colors.onSurfaceVariant }]}>
              Никого не найдено
            </Text>
          ) : (
            searchResults.map((u) => {
              const requested = requestedIds.has(u.id);
              return (
                <View
                  key={`sr-${u.id}`}
                  style={[
                    styles.userRow,
                    { backgroundColor: theme.colors.surfaceContainer },
                  ]}
                >
                  <Avatar user={u} size={40} />
                  <Text
                    style={[styles.username, { color: theme.colors.onSurface }]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {u.username}
                  </Text>
                  <Button
                    mode={requested ? 'outlined' : 'contained'}
                    compact
                    onPress={() => handleRequestFriend(u)}
                    disabled={requested || busyId === u.id}
                    loading={busyId === u.id}
                  >
                    {requested ? 'Отправлено' : 'Добавить'}
                  </Button>
                </View>
              );
            })
          )}
        </View>
      )}

      {/* Pending requests */}
      {pending.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="Входящие заявки" />
          {pending.map((req) => {
            const fromUser = pickPendingUser(req);
            const rid = pickRequestId(req);
            return (
              <View
                key={`p-${rid}-${fromUser.id}`}
                style={[
                  styles.userRow,
                  { backgroundColor: theme.colors.surfaceContainer },
                ]}
              >
                <Avatar user={fromUser} size={40} />
                <Text
                  style={[styles.username, { color: theme.colors.onSurface }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {fromUser.username}
                </Text>
                <View style={styles.actionsRow}>
                  <IconButton
                    icon="check"
                    size={20}
                    iconColor={theme.colors.primary}
                    onPress={() => handleAccept(req)}
                    disabled={busyId === rid}
                    accessibilityLabel="Принять"
                  />
                  <IconButton
                    icon="close"
                    size={20}
                    iconColor={theme.colors.error}
                    onPress={() => handleDecline(req)}
                    disabled={busyId === fromUser.id}
                    accessibilityLabel="Отклонить"
                  />
                </View>
              </View>
            );
          })}
          <Divider />
        </View>
      )}

      {/* Friends list */}
      <View style={styles.section}>
        <SectionHeader title={`Друзья${friends.length ? ` · ${friends.length}` : ''}`} />
        {friendsApi.loading && !friends.length ? (
          <LoadingState label="Загрузка друзей…" />
        ) : friends.length === 0 ? (
          <EmptyState
            icon="account-group-outline"
            message="У вас пока нет друзей. Найдите пользователей через поиск выше."
          />
        ) : (
          friends.map((friend) => {
            const isMenuOpen = menuFor === friend.id;
            return (
              <View
                key={`f-${friend.id}`}
                style={[
                  styles.userRow,
                  { backgroundColor: theme.colors.surfaceContainer },
                ]}
              >
                <Avatar user={friend} size={40} />
                <Text
                  style={[styles.username, { color: theme.colors.onSurface }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {friend.username}
                </Text>

                <Menu
                  visible={isMenuOpen}
                  onDismiss={() => setMenuFor(null)}
                  anchor={
                    <IconButton
                      icon="dots-vertical"
                      onPress={() => {
                        if (!user) return openAuthModal();
                        setMenuFor(friend.id);
                      }}
                      disabled={busyId === friend.id}
                      accessibilityLabel="Действия"
                    />
                  }
                  contentStyle={{ backgroundColor: theme.colors.surfaceContainerHigh }}
                >
                  <Menu.Item
                    leadingIcon="chat-outline"
                    title="Написать"
                    onPress={() => handleStartChat(friend, () => setMenuFor(null))}
                  />
                  <Divider />
                  <Menu.Item
                    leadingIcon="account-remove-outline"
                    title="Удалить"
                    onPress={() => handleRemoveFriend(friend, () => setMenuFor(null))}
                  />
                </Menu>
              </View>
            );
          })
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    marginTop: 4,
  },
  searchbar: {
    borderRadius: 14,
    elevation: 0,
  },
  section: {
    marginTop: 8,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 8,
    gap: 12,
  },
  username: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  muted: {
    fontSize: 14,
    paddingVertical: 8,
  },
  centerSmall: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});
