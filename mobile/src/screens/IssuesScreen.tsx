import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  Linking,
  Alert,
} from 'react-native';
import {
  useTheme,
  Text,
  Card,
  Button,
  FAB,
  Dialog,
  Portal,
  TextInput,
  Chip,
  SegmentedButtons,
  IconButton,
  Menu,
  Divider,
  ActivityIndicator,
  Surface,
} from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

import Screen from '../components/Screen';
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import SectionHeader from '../components/SectionHeader';
import Avatar from '../components/Avatar';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { uploadUrl } from '../api/client';
import backend from '../api/backend';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Issues'>;

interface IssueAssignee {
  id: number;
  username: string;
  avatarUrl?: string | null;
  avatarColor?: string;
}

interface IssueAttachment {
  id: number;
  url: string;
  filename?: string;
  type?: string;
  createdAt?: string;
}

interface Issue {
  id: number;
  title: string;
  status: string;
  assignee?: IssueAssignee | null;
  attachments?: IssueAttachment[];
  createdAt?: string;
  author?: IssueAssignee | null;
}

const STATUS_VALUES: { label: string; value: string }[] = [
  { label: 'Все', value: '' },
  { label: 'Открыт', value: 'open' },
  { label: 'В работе', value: 'in_progress' },
  { label: 'Готово', value: 'done' },
];

const STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
  open: { label: 'Открыт', color: '#E8743B', icon: 'alert-circle-outline' },
  in_progress: { label: 'В работе', color: '#3B82F6', icon: 'progress-clock' },
  done: { label: 'Готово', color: '#2E7D32', icon: 'check-circle-outline' },
};

function statusChip(status: string, theme: any) {
  const meta = STATUS_META[status] || {
    label: status || '—',
    color: theme.colors.outline,
    icon: 'circle-outline',
  };
  return (
    <Chip
      mode="flat"
      compact
      icon={meta.icon as any}
      style={[styles.chip, { backgroundColor: meta.color + '22' }]}
      textStyle={{ color: meta.color, fontSize: 12, fontWeight: '600' }}
    >
      {meta.label}
    </Chip>
  );
}

export default function IssuesScreen(props: Props) {
  const theme = useTheme();
  const { user, addToast, openAuthModal } = useAuth();

  const [statusFilter, setStatusFilter] = useState<string>('');
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const [detailIssue, setDetailIssue] = useState<Issue | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingIssue, setDeletingIssue] = useState(false);

  const canManage =
    !!user && (user.role === 'master' || user.role === 'admin');

  const { data, loading, error, refetch } = useApi<Issue[]>(
    () => backend.listIssues(statusFilter),
    [statusFilter],
  );

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const openCreate = useCallback(() => {
    if (!user) {
      openAuthModal();
      return;
    }
    if (!canManage) {
      addToast('Недостаточно прав', 'error');
      return;
    }
    setNewTitle('');
    setCreateOpen(true);
  }, [user, canManage, openAuthModal, addToast]);

  const handleCreate = useCallback(async () => {
    const title = newTitle.trim();
    if (!title) {
      addToast('Введите название', 'error');
      return;
    }
    setCreating(true);
    try {
      await backend.createIssue(title);
      setCreateOpen(false);
      setNewTitle('');
      addToast('Задача создана', 'success');
      await refetch();
    } catch (e: any) {
      addToast(e?.message || 'Не удалось создать', 'error');
    } finally {
      setCreating(false);
    }
  }, [newTitle, addToast, refetch]);

  const openDetail = useCallback((issue: Issue) => {
    setDetailIssue(issue);
    setStatusMenuOpen(false);
  }, []);

  const refreshDetail = useCallback(async (issueId: number) => {
    setDetailLoading(true);
    try {
      // Refetch the whole list and find the updated issue
      await refetch();
    } finally {
      setDetailLoading(false);
    }
  }, [refetch]);

  const handleUpdateStatus = useCallback(
    async (issueId: number, status: string) => {
      setStatusMenuOpen(false);
      try {
        await backend.updateIssue(issueId, status);
        addToast('Статус обновлён', 'success');
        setDetailIssue((prev) => (prev ? { ...prev, status } : prev));
        await refetch();
      } catch (e: any) {
        addToast(e?.message || 'Ошибка обновления', 'error');
      }
    },
    [addToast, refetch],
  );

  const handleAssign = useCallback(
    async (issueId: number) => {
      try {
        await backend.assignIssue(issueId);
        addToast('Задача взята в работу', 'success');
        await refetch();
        setDetailIssue((prev) =>
          prev
            ? {
                ...prev,
                assignee: user
                  ? {
                      id: user.id,
                      username: user.username,
                      avatarUrl: user.avatarUrl ?? null,
                      avatarColor: user.avatarColor,
                    }
                  : prev.assignee,
              }
            : prev,
        );
      } catch (e: any) {
        addToast(e?.message || 'Ошибка назначения', 'error');
      }
    },
    [addToast, refetch, user],
  );

  const pickAttachment = useCallback(async () => {
    if (!detailIssue) return;
    Alert.alert(
      'Вложение',
      'Выберите источник',
      [
        {
          text: 'Камера',
          onPress: async () => {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (!perm.granted) {
              addToast('Нет доступа к камере', 'error');
              return;
            }
            const res = await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.All,
              quality: 0.8,
            });
            if (!res.canceled && res.assets[0]) {
              const a = res.assets[0];
              await doUpload(detailIssue.id, {
                uri: a.uri,
                name: a.fileName || `attachment-${Date.now()}`,
                type: a.mimeType || 'image/jpeg',
              });
            }
          },
        },
        {
          text: 'Галерея',
          onPress: async () => {
            const perm =
              await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
              addToast('Нет доступа к галерее', 'error');
              return;
            }
            const res = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.All,
              quality: 0.8,
            });
            if (!res.canceled && res.assets[0]) {
              const a = res.assets[0];
              await doUpload(detailIssue.id, {
                uri: a.uri,
                name: a.fileName || `attachment-${Date.now()}`,
                type: a.mimeType || 'image/jpeg',
              });
            }
          },
        },
        {
          text: 'Файл',
          onPress: async () => {
            try {
              const res = await DocumentPicker.getDocumentAsync({
                copyToCacheDirectory: true,
              });
              if (!res.canceled && res.assets[0]) {
                const a = res.assets[0];
                await doUpload(detailIssue.id, {
                  uri: a.uri,
                  name: a.name,
                  type: a.mimeType || 'application/octet-stream',
                });
              }
            } catch (e: any) {
              addToast(e?.message || 'Ошибка выбора файла', 'error');
            }
          },
        },
        { text: 'Отмена', style: 'cancel' },
      ],
    );
  }, [detailIssue, addToast]);

  const doUpload = useCallback(
    async (
      issueId: number,
      asset: { uri: string; name?: string; type?: string },
    ) => {
      setUploading(true);
      try {
        await backend.uploadAttachment(issueId, asset);
        addToast('Вложение добавлено', 'success');
        const result = await refetch();
        // Sync detail view with updated attachments from server
        if (result) {
          const updated = result.find((i) => i.id === issueId);
          if (updated) setDetailIssue(updated);
        }
      } catch (e: any) {
        addToast(e?.message || 'Ошибка загрузки', 'error');
      } finally {
        setUploading(false);
      }
    },
    [addToast, refetch],
  );

  const handleDeleteAttachment = useCallback(
    async (issueId: number, attachmentId: number) => {
      try {
        await backend.deleteAttachment(issueId, attachmentId);
        addToast('Вложение удалено', 'success');
        setDetailIssue((prev) =>
          prev
            ? {
                ...prev,
                attachments: (prev.attachments || []).filter(
                  (a) => a.id !== attachmentId,
                ),
              }
            : prev,
        );
        await refetch();
      } catch (e: any) {
        addToast(e?.message || 'Ошибка удаления', 'error');
      }
    },
    [addToast, refetch],
  );

  const handleDeleteIssue = useCallback(
    async (issueId: number) => {
      Alert.alert(
        'Удалить задачу?',
        'Действие нельзя отменить.',
        [
          { text: 'Отмена', style: 'cancel' },
          {
            text: 'Удалить',
            style: 'destructive',
            onPress: async () => {
              setDeletingIssue(true);
              try {
                await backend.deleteIssue(issueId);
                addToast('Задача удалена', 'success');
                setDetailIssue(null);
                await refetch();
              } catch (e: any) {
                addToast(e?.message || 'Ошибка удаления', 'error');
              } finally {
                setDeletingIssue(false);
              }
            },
          },
        ],
      );
    },
    [addToast, refetch],
  );

  const renderItem = useCallback(
    ({ item }: { item: Issue }) => (
      <Pressable onPress={() => openDetail(item)}>
        <Card
          style={[styles.card, { backgroundColor: theme.colors.surfaceContainer }]}
          mode="elevated"
        >
          <Card.Content style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <Text
                variant="titleMedium"
                style={{ color: theme.colors.onSurface, flex: 1 }}
                numberOfLines={2}
              >
                {item.title}
              </Text>
              {statusChip(item.status, theme)}
            </View>
            <Divider style={{ marginVertical: 8 }} />
            <View style={styles.cardMeta}>
              {item.assignee ? (
                <View style={styles.assigneeRow}>
                  <Avatar user={item.assignee} size={24} />
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant, marginLeft: 6 }}
                  >
                    {item.assignee.username}
                  </Text>
                </View>
              ) : (
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  Не назначен
                </Text>
              )}
              {!!item.attachments?.length && (
                <View style={styles.attachBadge}>
                  <MaterialCommunityIcons
                    name="paperclip"
                    size={14}
                    color={theme.colors.onSurfaceVariant}
                  />
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant, marginLeft: 2 }}
                  >
                    {item.attachments.length}
                  </Text>
                </View>
              )}
            </View>
          </Card.Content>
        </Card>
      </Pressable>
    ),
    [theme, openDetail],
  );

  // ---- Permission gate ----
  if (!canManage) {
    return (
      <Screen refreshing={loading} onRefresh={handleRefresh}>
        <EmptyState
          icon="lock-outline"
          message="Недостаточно прав"
          action={undefined}
          actionLabel={undefined}
        />
      </Screen>
    );
  }

  return (
    <>
      <Screen refreshing={loading} onRefresh={handleRefresh}>
        <SegmentedButtons
          value={statusFilter}
          onValueChange={setStatusFilter}
          buttons={STATUS_VALUES.map((s) => ({
            value: s.value,
            label: s.label,
          }))}
          density="small"
          style={styles.segment}
        />

        <SectionHeader title={`Задачи${data ? ` (${data.length})` : ''}`} />

        {loading && !data ? (
          <LoadingState label="Загрузка задач…" />
        ) : error ? (
          <ErrorState message={error.message} onRetry={refetch} />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon="bug-check-outline"
            message="Задач не найдено"
            action={openCreate}
            actionLabel="Создать задачу"
          />
        ) : (
          <FlatList
            data={data}
            renderItem={renderItem}
            keyExtractor={(item) => String(item.id)}
            scrollEnabled={false}
            contentContainerStyle={{ paddingBottom: 16 }}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          />
        )}
      </Screen>

      <FAB
        icon="plus"
        onPress={openCreate}
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color={theme.colors.onPrimary}
        label="Новая"
      />

      {/* Create Dialog */}
      <Portal>
        <Dialog
          visible={createOpen}
          onDismiss={() => (creating ? null : setCreateOpen(false))}
          style={{ backgroundColor: theme.colors.surface }}
        >
          <Dialog.Title>Новая задача</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Название"
              value={newTitle}
              onChangeText={setNewTitle}
              mode="outlined"
              autoFocus
              multiline
              maxLength={300}
              style={{ backgroundColor: theme.colors.surface }}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCreateOpen(false)} disabled={creating}>
              Отмена
            </Button>
            <Button mode="contained" onPress={handleCreate} loading={creating}>
              Создать
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Detail Dialog */}
      <Portal>
        <Dialog
          visible={!!detailIssue}
          onDismiss={() => (detailLoading ? null : setDetailIssue(null))}
          style={{ backgroundColor: theme.colors.surface }}
        >
          {detailIssue && (
            <>
              <Dialog.Title style={{ paddingRight: 40 }}>
                {detailIssue.title}
              </Dialog.Title>
              <Dialog.Content>
                {/* Status row */}
                <Text
                  variant="labelLarge"
                  style={{ color: theme.colors.onSurfaceVariant, marginBottom: 6 }}
                >
                  Статус
                </Text>
                <View style={styles.statusRow}>
                  <Menu
                    visible={statusMenuOpen}
                    onDismiss={() => setStatusMenuOpen(false)}
                    anchor={
                      <Pressable onPress={() => setStatusMenuOpen(true)}>
                        {statusChip(detailIssue.status, theme)}
                      </Pressable>
                    }
                  >
                    {STATUS_VALUES.filter((s) => s.value).map((s) => (
                      <Menu.Item
                        key={s.value}
                        title={s.label}
                        onPress={() =>
                          handleUpdateStatus(detailIssue.id, s.value)
                        }
                        leadingIcon={
                          STATUS_META[s.value]?.icon as any
                        }
                      />
                    ))}
                  </Menu>
                  {detailLoading && (
                    <ActivityIndicator
                      size="small"
                      color={theme.colors.primary}
                      style={{ marginLeft: 8 }}
                    />
                  )}
                </View>

                <Divider style={{ marginVertical: 12 }} />

                {/* Assignee */}
                <Text
                  variant="labelLarge"
                  style={{ color: theme.colors.onSurfaceVariant, marginBottom: 6 }}
                >
                  Исполнитель
                </Text>
                <View style={styles.assigneeRow}>
                  {detailIssue.assignee ? (
                    <>
                      <Avatar user={detailIssue.assignee} size={32} />
                      <Text
                        variant="bodyMedium"
                        style={{
                          color: theme.colors.onSurface,
                          marginLeft: 8,
                          flex: 1,
                        }}
                      >
                        {detailIssue.assignee.username}
                      </Text>
                    </>
                  ) : (
                    <Text
                      variant="bodyMedium"
                      style={{
                        color: theme.colors.onSurfaceVariant,
                        flex: 1,
                      }}
                    >
                      Не назначен
                    </Text>
                  )}
                  <Button
                    mode="outlined"
                    compact
                    onPress={() => handleAssign(detailIssue.id)}
                    disabled={
                      !!detailIssue.assignee &&
                      detailIssue.assignee.id === user?.id
                    }
                  >
                    Взять себе
                  </Button>
                </View>

                <Divider style={{ marginVertical: 12 }} />

                {/* Attachments */}
                <View style={styles.attachHeader}>
                  <Text
                    variant="labelLarge"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    Вложения
                  </Text>
                  <Button
                    mode="text"
                    compact
                    icon="paperclip-plus"
                    onPress={pickAttachment}
                    loading={uploading}
                    disabled={uploading}
                  >
                    Добавить
                  </Button>
                </View>
                {detailIssue.attachments &&
                detailIssue.attachments.length > 0 ? (
                  <View style={{ marginTop: 4 }}>
                    {detailIssue.attachments.map((att) => (
                      <Surface
                        key={att.id}
                        style={[
                          styles.attachItem,
                          { backgroundColor: theme.colors.surfaceContainer },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name="file-outline"
                          size={20}
                          color={theme.colors.onSurfaceVariant}
                        />
                        <Text
                          variant="bodySmall"
                          numberOfLines={1}
                          style={{
                            color: theme.colors.onSurface,
                            flex: 1,
                            marginLeft: 8,
                          }}
                        >
                          {att.filename || `Вложение #${att.id}`}
                        </Text>
                        <IconButton
                          icon="open-in-new"
                          size={18}
                          onPress={() => {
                            const url = uploadUrl(att.url);
                            if (url) Linking.openURL(url);
                          }}
                        />
                        <IconButton
                          icon="trash-can-outline"
                          size={18}
                          iconColor={theme.colors.error}
                          onPress={() =>
                            handleDeleteAttachment(detailIssue.id, att.id)
                          }
                        />
                      </Surface>
                    ))}
                  </View>
                ) : (
                  <Text
                    variant="bodySmall"
                    style={{
                      color: theme.colors.onSurfaceVariant,
                      marginTop: 4,
                    }}
                  >
                    Нет вложений
                  </Text>
                )}

                {detailIssue.createdAt && (
                  <Text
                    variant="bodySmall"
                    style={{
                      color: theme.colors.onSurfaceVariant,
                      marginTop: 12,
                    }}
                  >
                    Создано: {new Date(detailIssue.createdAt).toLocaleString('ru-RU')}
                  </Text>
                )}
              </Dialog.Content>
              <Dialog.Actions>
                <Button
                  mode="text"
                  textColor={theme.colors.error}
                  onPress={() => handleDeleteIssue(detailIssue.id)}
                  loading={deletingIssue}
                  disabled={deletingIssue}
                >
                  Удалить
                </Button>
                <Button onPress={() => setDetailIssue(null)}>
                  Закрыть
                </Button>
              </Dialog.Actions>
            </>
          )}
        </Dialog>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  segment: {
    marginTop: 8,
  },
  card: {
    borderRadius: 14,
  },
  cardContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  assigneeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attachBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    height: 26,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    borderRadius: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attachHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  attachItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginBottom: 6,
  },
});
