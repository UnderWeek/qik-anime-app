import { useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useTheme, Text, FAB } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { backend } from '../api/backend';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import Screen from '../components/Screen';
import Avatar from '../components/Avatar';
import { LoadingState, ErrorState, EmptyState } from '../components/States';

type Props = NativeStackScreenProps<RootStackParamList, 'Chats'>;

interface ChatUser {
  id?: number;
  username?: string;
  avatarUrl?: string | null;
  avatarColor?: string;
  avatarFrame?: string | null;
}

interface ChatItem {
  id: number | string;
  otherUser?: ChatUser;
  friend?: ChatUser;
  participant?: ChatUser;
  lastMessage?: string | null;
  lastMessageBody?: string | null;
  lastMessageAt?: string | null;
  updatedAt?: string | null;
  lastActivity?: string | null;
  unreadCount?: number;
  unread?: number;
}

function pickOtherUser(chat: ChatItem): ChatUser | undefined {
  return chat.otherUser || chat.friend || chat.participant;
}

function pickLastMessage(chat: ChatItem): string {
  return chat.lastMessage || chat.lastMessageBody || '';
}

function pickTimestamp(chat: ChatItem): string | null {
  return chat.lastMessageAt || chat.updatedAt || chat.lastActivity || null;
}

function formatTime(value: string | null): string {
  if (!value) return '';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    const pad = (n: number) => String(n).padStart(2, '0');
    if (sameDay) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      d.getFullYear() === yesterday.getFullYear() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getDate() === yesterday.getDate();
    if (isYesterday) return 'Вчера';
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
  } catch {
    return '';
  }
}

export default function ChatsScreen({ navigation }: Props) {
  const theme = useTheme();
  const { user, openAuthModal } = useAuth();
  const { data, loading, error, refetch } = useApi<ChatItem[]>(() => backend.listChats(), []);

  const handleOpenChat = useCallback(
    (chat: ChatItem) => {
      const other = pickOtherUser(chat);
      navigation.navigate('ChatThread', {
        chatId: chat.id,
        title: other?.username,
      });
    },
    [navigation],
  );

  const handleStartChat = useCallback(() => {
    if (!user) {
      openAuthModal();
      return;
    }
    navigation.navigate('Friends');
  }, [user, openAuthModal, navigation]);

  const chats = Array.isArray(data) ? data : [];

  return (
    <>
      <Screen refreshing={loading} onRefresh={() => refetch()}>
        {loading && !data ? (
          <LoadingState label="Загрузка чатов…" />
        ) : error ? (
          <ErrorState message={error.message} onRetry={() => refetch()} />
        ) : chats.length === 0 ? (
          <EmptyState
            icon="chat-outline"
            message="У вас пока нет чатов. Начните общение с друзьями!"
            action={handleStartChat}
            actionLabel="К друзьям"
          />
        ) : (
          <View style={styles.list}>
            {chats.map((chat) => {
              const other = pickOtherUser(chat);
              const preview = pickLastMessage(chat);
              const time = formatTime(pickTimestamp(chat));
              const unread = chat.unreadCount ?? chat.unread ?? 0;
              return (
                <Pressable
                  key={String(chat.id)}
                  onPress={() => handleOpenChat(chat)}
                  style={({ pressed }) => [
                    styles.row,
                    { backgroundColor: theme.colors.surfaceContainer },
                    pressed && { backgroundColor: theme.colors.surfaceContainerHigh },
                  ]}
                >
                  <Avatar user={other} size={50} />
                  <View style={styles.content}>
                    <View style={styles.topLine}>
                      <Text
                        variant="titleMedium"
                        numberOfLines={1}
                        style={[styles.name, { color: theme.colors.onSurface }]}
                      >
                        {other?.username || 'Пользователь'}
                      </Text>
                      {time ? (
                        <Text
                          variant="labelSmall"
                          style={{ color: theme.colors.onSurfaceVariant }}
                        >
                          {time}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.bottomLine}>
                      <Text
                        variant="bodyMedium"
                        numberOfLines={1}
                        style={[
                          styles.preview,
                          { color: theme.colors.onSurfaceVariant },
                          unread > 0 && { color: theme.colors.onSurface, fontWeight: '600' },
                        ]}
                      >
                        {preview || 'Нет сообщений'}
                      </Text>
                      {unread > 0 ? (
                        <View
                          style={[styles.badge, { backgroundColor: theme.colors.primary }]}
                        >
                          <Text
                            variant="labelSmall"
                            style={{ color: theme.colors.onPrimary, fontWeight: '700' }}
                          >
                            {unread > 99 ? '99+' : unread}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </Screen>

      <FAB
        icon="pencil-plus-outline"
        onPress={handleStartChat}
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color={theme.colors.onPrimary}
        label="Новый чат"
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    gap: 12,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  topLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    flexShrink: 1,
  },
  bottomLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  preview: {
    flexShrink: 1,
  },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    borderRadius: 14,
  },
});
