import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Image,
} from 'react-native';
import {
  useTheme,
  Text,
  TextInput,
  IconButton,
  ActivityIndicator,
  Button,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { RootStackParamList } from '../navigation/AppNavigator';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { backend } from '../api/backend';
import { uploadUrl } from '../api/client';
import Avatar from '../components/Avatar';
import { LoadingState, ErrorState, EmptyState } from '../components/States';

interface ChatSender {
  id: number;
  username: string;
  avatarColor?: string;
  avatarUrl?: string | null;
  lastSeenAt?: string | null;
}

interface ChatMessage {
  id: number;
  body: string;
  imageUrl?: string | null;
  createdAt: string;
  sender: ChatSender | null;
}

type Props = NativeStackScreenProps<RootStackParamList, 'ChatThread'>;

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export default function ChatThreadScreen(props: Props) {
  const { navigation, route } = props;
  const { chatId, title } = route.params;
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user, openAuthModal, addToast } = useAuth();

  const { data, loading, error, refetch } = useApi<ChatMessage[]>(
    () => backend.chatMessages(chatId),
    [chatId],
  );

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  // Header title
  useEffect(() => {
    navigation.setOptions({ title: title || 'Чат' });
  }, [navigation, title]);

  // Poll for new messages every 5s
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 5000);
    return () => clearInterval(interval);
  }, [refetch]);

  // Scroll to bottom when messages arrive
  useEffect(() => {
    if (data && data.length > 0) {
      const t = setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 80);
      return () => clearTimeout(t);
    }
  }, [data]);

  const handleSend = useCallback(async () => {
    const body = text.trim();
    if (!body) return;
    if (!user) {
      openAuthModal();
      return;
    }
    setSending(true);
    try {
      await backend.sendChatMessage(chatId, { body });
      setText('');
      await refetch();
    } catch (e: any) {
      addToast(e?.message || 'Не удалось отправить сообщение', 'error');
    } finally {
      setSending(false);
    }
  }, [text, user, chatId, openAuthModal, addToast, refetch]);

  const messages = data || [];

  const renderItem = ({ item, index }: { item: ChatMessage; index: number }) => {
    const isOwn = user && item.sender?.id === user.id;
    const prev = messages[index - 1];
    const showAvatar = !prev || prev.sender?.id !== item.sender?.id;

    if (isOwn) {
      return (
        <View style={styles.rowOwn}>
          <View style={[styles.bubble, styles.ownBubble, { backgroundColor: theme.colors.primary }]}>
            {item.imageUrl ? (
              <Image
                source={{ uri: uploadUrl(item.imageUrl) }}
                style={styles.messageImage}
                resizeMode="cover"
              />
            ) : null}
            {item.body ? (
              <Text style={[styles.messageText, { color: theme.colors.onPrimary }]}>
                {item.body}
              </Text>
            ) : null}
          </View>
          <Text style={[styles.time, { color: theme.colors.onSurfaceVariant }]}>
            {formatTime(item.createdAt)}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.rowOther}>
        <View style={styles.avatarCol}>
          {showAvatar ? (
            <Avatar user={item.sender || undefined} size={32} />
          ) : (
            <View style={{ width: 32 }} />
          )}
        </View>
        <View style={styles.bubbleCol}>
          {showAvatar && item.sender ? (
            <Text style={[styles.senderName, { color: theme.colors.onSurfaceVariant }]}>
              {item.sender.username}
            </Text>
          ) : null}
          <View style={[styles.bubble, styles.otherBubble, { backgroundColor: theme.colors.surfaceContainerHigh }]}>
            {item.imageUrl ? (
              <Image
                source={{ uri: uploadUrl(item.imageUrl) }}
                style={styles.messageImage}
                resizeMode="cover"
              />
            ) : null}
            {item.body ? (
              <Text style={[styles.messageText, { color: theme.colors.onSurface }]}>
                {item.body}
              </Text>
            ) : null}
          </View>
          <Text style={[styles.time, { color: theme.colors.onSurfaceVariant }]}>
            {formatTime(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  // Auth gate
  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
        <EmptyState
          icon="lock-outline"
          message="Войдите в аккаунт, чтобы переписываться."
          action={openAuthModal}
          actionLabel="Войти"
        />
      </View>
    );
  }

  if (loading && !data) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
        <LoadingState label="Загрузка сообщений…" />
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
        <ErrorState message={error.message} onRetry={refetch} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <FlatList
        ref={listRef}
        data={messages}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 8 },
        ]}
        onContentSizeChange={() => {
          if (messages.length > 0) {
            listRef.current?.scrollToEnd({ animated: false });
          }
        }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <MaterialCommunityIcons
              name="chat-outline"
              size={48}
              color={theme.colors.outline}
            />
            <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
              Сообщений пока нет. Напишите первым!
            </Text>
          </View>
        }
      />

      <View
        style={[
          styles.inputBar,
          {
            backgroundColor: theme.colors.surface,
            paddingBottom: insets.bottom + 8,
            borderColor: theme.colors.outlineVariant,
          },
        ]}
      >
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Сообщение…"
          mode="outlined"
          dense
          style={styles.input}
          multiline
          maxLength={2000}
          right={
            sending ? (
              <TextInput.Affix text="" />
            ) : undefined
          }
        />
        <IconButton
          icon="send"
          mode="contained"
          containerColor={theme.colors.primary}
          iconColor={theme.colors.onPrimary}
          onPress={handleSend}
          disabled={sending || !text.trim()}
          loading={sending}
          accessibilityLabel="Отправить"
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexGrow: 1,
  },
  rowOwn: {
    alignItems: 'flex-end',
    marginVertical: 4,
    alignSelf: 'flex-end',
    maxWidth: '82%',
  },
  rowOther: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 4,
    maxWidth: '82%',
  },
  avatarCol: {
    marginRight: 8,
    marginBottom: 2,
  },
  bubbleCol: {
    flex: 1,
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  ownBubble: {
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 4,
  },
  senderName: {
    fontSize: 12,
    marginBottom: 2,
    marginLeft: 4,
  },
  time: {
    fontSize: 10,
    marginTop: 2,
    marginHorizontal: 4,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    fontSize: 15,
    backgroundColor: 'transparent',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 24,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
  },
});
