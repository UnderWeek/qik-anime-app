import { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import {
  useTheme,
  Button,
  Text,
  Card,
  TextInput,
  Dialog,
  Portal,
  ActivityIndicator,
  Divider,
} from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import Screen from '../components/Screen';
import Avatar from '../components/Avatar';
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import SectionHeader from '../components/SectionHeader';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import backend from '../api/backend';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Rooms'>;

interface WatchRoom {
  id: number;
  code: string;
  owner?: { id: number; username?: string; avatarUrl?: string | null; avatarColor?: string } | null;
  ownerId?: number;
  participantsCount?: number;
  participants?: any[];
  currentAnimeTitle?: string;
  animeTitle?: string;
  title?: string;
  isPlaying?: boolean;
  createdAt?: string;
}

export default function RoomsScreen(props: Props) {
  const { navigation } = props;
  const theme = useTheme();
  const { user, openAuthModal, addToast } = useAuth();

  const { data, loading, error, refetch } = useApi<WatchRoom[]>(
    () => backend.listWatchRooms(),
    [],
  );

  const [joinDialogVisible, setJoinDialogVisible] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!user) {
      openAuthModal();
      return;
    }
    setCreating(true);
    try {
      const room = await backend.createWatchRoom({});
      addToast('Комната создана', 'success');
      navigation.navigate('RoomWatch', { roomId: room.id });
    } catch (e: any) {
      addToast(e?.message || 'Не удалось создать комнату', 'error');
    } finally {
      setCreating(false);
    }
  }, [user, openAuthModal, addToast, navigation]);

  const handleJoinByCode = useCallback(async () => {
    const code = joinCode.trim();
    if (!code) {
      addToast('Введите код комнаты', 'error');
      return;
    }
    setJoining(true);
    try {
      const room = await backend.joinWatchRoom(code);
      setJoinDialogVisible(false);
      setJoinCode('');
      navigation.navigate('RoomWatch', { roomId: room.id });
    } catch (e: any) {
      addToast(e?.message || 'Комната не найдена', 'error');
    } finally {
      setJoining(false);
    }
  }, [joinCode, addToast, navigation]);

  const handleOpenRoom = useCallback(
    (roomId: number) => {
      navigation.navigate('RoomWatch', { roomId });
    },
    [navigation],
  );

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Auth required gate
  if (!user) {
    return (
      <Screen>
        <EmptyState
          icon="lock-outline"
          message="Войдите, чтобы смотреть аниме вместе с друзьями в комнатах"
          action={openAuthModal}
          actionLabel="Войти"
        />
      </Screen>
    );
  }

  if (loading && !data) {
    return (
      <Screen>
        <LoadingState label="Загрузка комнат…" />
      </Screen>
    );
  }

  if (error && !data) {
    return (
      <Screen>
        <ErrorState message={error.message} onRetry={refetch} />
      </Screen>
    );
  }

  const rooms = data || [];

  const renderItem = ({ item }: { item: WatchRoom }) => {
    const owner = item.owner;
    const ownerName = owner?.username || `Пользователь #${item.ownerId ?? '?'}`;
    const participantsCount =
      item.participantsCount ?? (item.participants?.length ?? 0);
    const animeTitle =
      item.currentAnimeTitle || item.animeTitle || item.title;

    return (
      <Pressable onPress={() => handleOpenRoom(item.id)}>
        <Card style={styles.card} mode="contained">
          <Card.Content style={styles.cardContent}>
            <View style={styles.roomHeader}>
              <View style={styles.roomCodeWrap}>
                <MaterialCommunityIcons
                  name="movie-open-outline"
                  size={20}
                  color={theme.colors.primary}
                />
                <Text variant="titleMedium" style={styles.roomCode}>
                  {item.code}
                </Text>
              </View>
              {item.isPlaying ? (
                <View style={[styles.liveBadge, { backgroundColor: theme.colors.primary }]}>
                  <Text style={[styles.liveText, { color: theme.colors.onPrimary }]}>
                    LIVE
                  </Text>
                </View>
              ) : null}
            </View>

            {animeTitle ? (
              <Text
                variant="bodyMedium"
                style={[styles.animeTitle, { color: theme.colors.onSurface }]}
                numberOfLines={2}
              >
                {animeTitle}
              </Text>
            ) : (
              <Text
                variant="bodyMedium"
                style={[styles.animeTitle, { color: theme.colors.onSurfaceVariant }]}
              >
                Видео не выбрано
              </Text>
            )}

            <Divider style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} />

            <View style={styles.metaRow}>
              <View style={styles.ownerWrap}>
                <Avatar user={owner} size={28} />
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSurfaceVariant }}
                  numberOfLines={1}
                >
                  {ownerName}
                </Text>
              </View>
              <View style={styles.participantsWrap}>
                <MaterialCommunityIcons
                  name="account-group-outline"
                  size={16}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {participantsCount}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      </Pressable>
    );
  };

  return (
    <Screen refreshing={loading} onRefresh={onRefresh}>
      <View style={styles.actionsRow}>
        <Button
          mode="contained"
          icon="plus"
          onPress={handleCreate}
          loading={creating}
          disabled={creating}
          style={styles.actionButton}
          contentStyle={styles.actionContent}
        >
          Создать комнату
        </Button>
        <Button
          mode="outlined"
          icon="key-variant"
          onPress={() => setJoinDialogVisible(true)}
          style={styles.actionButton}
          contentStyle={styles.actionContent}
        >
          Войти по коду
        </Button>
      </View>

      <SectionHeader title="Активные комнаты" />

      {rooms.length === 0 ? (
        <EmptyState
          icon="television-off"
          message="Пока нет активных комнат. Создайте свою или войдите по коду."
        />
      ) : (
        <View style={styles.list}>
          {rooms.map((item) => (
            <View key={String(item.id)} style={{ marginBottom: 10 }}>
              {renderItem({ item })}
            </View>
          ))}
        </View>
      )}

      <Portal>
        <Dialog
          visible={joinDialogVisible}
          onDismiss={() => {
            if (!joining) setJoinDialogVisible(false);
          }}
        >
          <Dialog.Title>Войти по коду</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Код комнаты"
              value={joinCode}
              onChangeText={setJoinCode}
              mode="outlined"
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="ABC123"
              disabled={joining}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => setJoinDialogVisible(false)}
              disabled={joining}
            >
              Отмена
            </Button>
            <Button onPress={handleJoinByCode} loading={joining} disabled={joining}>
              Войти
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  actionButton: {
    flex: 1,
  },
  actionContent: {
    paddingVertical: 6,
  },
  list: {
    paddingBottom: 16,
  },
  card: {
    borderRadius: 14,
  },
  cardContent: {
    padding: 12,
    gap: 8,
  },
  roomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roomCodeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roomCode: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  liveBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  animeTitle: {
    marginTop: 2,
  },
  divider: {
    marginVertical: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ownerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  participantsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
