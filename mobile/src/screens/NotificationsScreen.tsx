import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  useTheme,
  Text,
  IconButton,
  Divider,
  Surface,
} from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import Screen from '../components/Screen';
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import SectionHeader from '../components/SectionHeader';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import backend from '../api/backend';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

interface NotifActor {
  id?: number;
  username?: string;
  avatarUrl?: string | null;
  avatarColor?: string;
}

interface QikNotification {
  id: number;
  type?: string;
  body?: string;
  text?: string;
  message?: string;
  read?: boolean;
  createdAt?: string;
  created_at?: string;
  actor?: NotifActor;
  fromUser?: NotifActor;
  user?: NotifActor;
  animeId?: number;
  animeTitle?: string;
  anime_title?: string;
}

type NotifType =
  | 'friend_request'
  | 'friend_accept'
  | 'anime_suggestion'
  | 'comment_reply'
  | 'system';

function normalizeType(t?: string): NotifType {
  switch (t) {
    case 'friend_request':
    case 'friend_accept':
    case 'anime_suggestion':
    case 'comment_reply':
    case 'system':
      return t;
    default:
      return 'system';
  }
}

function notifText(n: QikNotification): string {
  return n.body || n.text || n.message || 'Уведомление';
}

function notifActor(n: QikNotification): NotifActor | null {
  return n.actor || n.fromUser || n.user || null;
}

function notifTime(n: QikNotification): string {
  const raw = n.createdAt || n.created_at;
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'только что';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} мин назад`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ч назад`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} дн назад`;
  return d.toLocaleDateString('ru-RU');
}

const ICON_FOR_TYPE: Record<NotifType, { name: string; color: string }> = {
  friend_request: { name: 'account-plus-outline', color: '#6750A4' },
  friend_accept: { name: 'account-check-outline', color: '#2E7D32' },
  anime_suggestion: { name: 'lightbulb-on-outline', color: '#EF6C00' },
  comment_reply: { name: 'comment-reply-outline', color: '#0277BD' },
  system: { name: 'bell-outline', color: '#616161' },
};

export default function NotificationsScreen(props: Props) {
  const theme = useTheme();
  const { user, openAuthModal, addToast } = useAuth();
  const api = useApi<QikNotification[]>(() => backend.notifications(), []);

  const [busyId, setBusyId] = useState<number | null>(null);

  // Best-effort: mark all read on mount, then refetch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await backend.markAllRead();
      } catch {
        /* best-effort */
      }
      if (!cancelled) {
        api.refetch();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = useCallback(async () => {
    await api.refetch();
  }, [api]);

  const handleDelete = useCallback(
    async (n: QikNotification) => {
      if (!user) return openAuthModal();
      setBusyId(n.id);
      try {
        await backend.removeNotification(n.id);
        addToast('Уведомление удалено', 'success');
        await api.refetch();
      } catch {
        addToast('Не удалось удалить уведомление', 'error');
      } finally {
        setBusyId(null);
      }
    },
    [user, openAuthModal, addToast, api],
  );

  const notifications = api.data ?? [];

  if (api.error && notifications.length === 0) {
    return (
      <Screen refreshing={api.loading} onRefresh={onRefresh}>
        <ErrorState message="Не удалось загрузить уведомления" onRetry={onRefresh} />
      </Screen>
    );
  }

  return (
    <Screen refreshing={api.loading} onRefresh={onRefresh}>
      <SectionHeader title={`Уведомления${notifications.length ? ` · ${notifications.length}` : ''}`} />

      {api.loading && notifications.length === 0 ? (
        <LoadingState label="Загрузка уведомлений…" />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon="bell-off-outline"
          message="Нет уведомлений. Вы будете оповещены о новых событиях здесь."
        />
      ) : (
        <View style={styles.list}>
          {notifications.map((n, i) => {
            const t = normalizeType(n.type);
            const icon = ICON_FOR_TYPE[t];
            const actor = notifActor(n);
            const time = notifTime(n);
            const isUnread = n.read === false;
            return (
              <View key={`n-${n.id}`}>
                <Surface
                  style={[
                    styles.row,
                    { backgroundColor: theme.colors.surfaceContainer },
                    isUnread && { backgroundColor: theme.colors.surfaceContainerHigh },
                  ]}
                  elevation={0}
                >
                  <View
                    style={[
                      styles.iconWrap,
                      { backgroundColor: theme.colors.surfaceContainerHigh },
                    ]}
                  >
                    <MaterialCommunityIcons name={icon.name as any} size={22} color={icon.color} />
                  </View>

                  <View style={styles.body}>
                    <Text
                      variant="bodyMedium"
                      style={{ color: theme.colors.onSurface, flexShrink: 1 }}
                      numberOfLines={3}
                    >
                      {notifText(n)}
                    </Text>
                    <View style={styles.meta}>
                      {actor?.username ? (
                        <Text
                          variant="labelSmall"
                          style={{ color: theme.colors.primary }}
                          numberOfLines={1}
                        >
                          {actor.username}
                        </Text>
                      ) : null}
                      {time ? (
                        <Text
                          variant="labelSmall"
                          style={{ color: theme.colors.onSurfaceVariant }}
                        >
                          {time}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  {isUnread ? (
                    <View
                      style={[styles.dot, { backgroundColor: theme.colors.primary }]}
                    />
                  ) : null}

                  <IconButton
                    icon="close"
                    size={20}
                    iconColor={theme.colors.onSurfaceVariant}
                    onPress={() => handleDelete(n)}
                    disabled={busyId === n.id}
                    loading={busyId === n.id}
                    accessibilityLabel="Удалить"
                  />
                </Surface>
                {i < notifications.length - 1 ? <Divider /> : null}
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    gap: 10,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 2,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 2,
  },
});
