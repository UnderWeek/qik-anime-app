import { useState, useCallback } from 'react';
import { View, StyleSheet, Linking } from 'react-native';
import {
  useTheme,
  Text,
  Switch,
  List,
  Button,
  Divider,
  Surface,
  SegmentedButtons,
  Card,
} from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Screen from '../components/Screen';
import SectionHeader from '../components/SectionHeader';
import { useAuth } from '../context/AuthContext';
import { useThemeCtx } from '../context/ThemeContext';
import { backend } from '../api/backend';
import { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const APP_VERSION = '1.0.0';

interface NavRow {
  key: string;
  title: string;
  description?: string;
  icon: string;
  target: keyof RootStackParamList;
}

const NAV_ROWS: NavRow[] = [
  { key: 'edit', title: 'Редактировать профиль', description: 'Имя, аватар, баннер', icon: 'account-edit-outline', target: 'EditProfile' },
  { key: 'friends', title: 'Друзья', description: 'Список и заявки', icon: 'account-group-outline', target: 'Friends' },
  { key: 'notifications', title: 'Уведомления', description: 'Все события', icon: 'bell-outline', target: 'Notifications' },
  { key: 'rooms', title: 'Комнаты', description: 'Совместный просмотр', icon: 'movie-outline', target: 'Rooms' },
  { key: 'quiz', title: 'Квиз', description: 'Угадай аниме', icon: 'help-circle-outline', target: 'Quiz' },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const { isDark, setTheme } = useThemeCtx();
  const { user, logout } = useAuth();
  const navigation = useNavigation<Nav>();

  const [serverInfo, setServerInfo] = useState<string | null>(null);
  const [loadingServer, setLoadingServer] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const role = user?.role;
  const isMaster = role === 'master' || role === 'admin';
  const isAdmin = role === 'admin';

  const loadServerInfo = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingServer(true);
    setServerError(null);
    try {
      const info = await backend.adminServer();
      setServerInfo(typeof info === 'string' ? info : JSON.stringify(info));
    } catch (e: any) {
      setServerError(e?.message || 'Недоступно');
    } finally {
      setLoadingServer(false);
    }
  }, [isAdmin]);

  const handleRow = (target: keyof RootStackParamList) => {
    navigation.navigate(target as any);
  };

  const themeValue = isDark ? 'dark' : 'light';

  return (
    <Screen>
      <View style={styles.container}>
        {/* Тема */}
        <Card style={[styles.card, { backgroundColor: theme.colors.surfaceContainer }]} elevation={0}>
          <Card.Content>
            <SectionHeader title="Оформление" />
            <View style={styles.themeRow}>
              <View style={styles.themeLabel}>
                <MaterialCommunityIcons
                  name={isDark ? 'weather-night' : 'white-balance-sunny'}
                  size={22}
                  color={theme.colors.onSurface}
                />
                <Text variant="bodyLarge" style={{ color: theme.colors.onSurface, marginLeft: 12 }}>
                  {isDark ? 'Тёмная тема' : 'Светлая тема'}
                </Text>
              </View>
              <Switch
                value={isDark}
                onValueChange={(v) => setTheme(v ? 'dark' : 'light')}
                color={theme.colors.primary}
              />
            </View>
            <SegmentedButtons
              value={themeValue}
              onValueChange={(v) => setTheme(v as 'light' | 'dark')}
              style={{ marginTop: 12 }}
              buttons={[
                { value: 'light', label: 'Светлая', icon: 'white-balance-sunny' },
                { value: 'dark', label: 'Тёмная', icon: 'weather-night' },
              ]}
            />
          </Card.Content>
        </Card>

        {/* Аккаунт */}
        <SectionHeader title="Аккаунт" />
        <Surface style={[styles.group, { backgroundColor: theme.colors.surfaceContainerHigh }]} elevation={0}>
          {NAV_ROWS.map((row, idx) => (
            <View key={row.key}>
              <List.Item
                title={row.title}
                description={row.description}
                titleStyle={{ color: theme.colors.onSurface }}
                descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
                left={(props) => (
                  <List.Icon
                    {...props}
                    icon={row.icon}
                    color={theme.colors.primary}
                  />
                )}
                right={(props) => (
                  <List.Icon {...props} icon="chevron-right" color={theme.colors.outline} />
                )}
                onPress={() => handleRow(row.target)}
              />
              {idx < NAV_ROWS.length - 1 && <Divider style={{ marginLeft: 56 }} />}
            </View>
          ))}
        </Surface>

        {/* Управление (мастер/админ) */}
        {isMaster && (
          <>
            <SectionHeader title="Управление" />
            <Surface style={[styles.group, { backgroundColor: theme.colors.surfaceContainerHigh }]} elevation={0}>
              <List.Item
                title="Баг-трекер"
                description="Задачи и баг-репорты"
                titleStyle={{ color: theme.colors.onSurface }}
                descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
                left={(props) => (
                  <List.Icon {...props} icon="bug-check-outline" color={theme.colors.primary} />
                )}
                right={(props) => (
                  <List.Icon {...props} icon="chevron-right" color={theme.colors.outline} />
                )}
                onPress={() => handleRow('Issues')}
              />
              {isAdmin && (
                <>
                  <Divider style={{ marginLeft: 56 }} />
                  <List.Item
                    title="Админка"
                    description="Пользователи и статистика"
                    titleStyle={{ color: theme.colors.onSurface }}
                    descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
                    left={(props) => (
                      <List.Icon {...props} icon="shield-account-outline" color={theme.colors.primary} />
                    )}
                    right={(props) => (
                      <List.Icon {...props} icon="chevron-right" color={theme.colors.outline} />
                    )}
                    onPress={() => handleRow('Admin')}
                  />
                </>
              )}
            </Surface>
          </>
        )}

        {/* Выход */}
        {user && (
          <Button
            mode="contained"
            onPress={logout}
            style={styles.logoutBtn}
            contentStyle={styles.logoutContent}
            icon="logout"
            buttonColor={theme.colors.error}
            textColor={theme.colors.onError}
          >
            Выйти из аккаунта
          </Button>
        )}

        {/* О приложении */}
        <SectionHeader title="О приложении" />
        <Surface style={[styles.group, { backgroundColor: theme.colors.surfaceContainerHigh }]} elevation={0}>
          <List.Item
            title="Версия"
            description={APP_VERSION}
            titleStyle={{ color: theme.colors.onSurface }}
            descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
            left={(props) => (
              <List.Icon {...props} icon="information-outline" color={theme.colors.primary} />
            )}
          />
          <Divider style={{ marginLeft: 56 }} />
          <List.Item
            title="Тема оформления"
            description={isDark ? 'Тёмная' : 'Светлая'}
            titleStyle={{ color: theme.colors.onSurface }}
            descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
            left={(props) => (
              <List.Icon {...props} icon="palette-outline" color={theme.colors.primary} />
            )}
          />
          <Divider style={{ marginLeft: 56 }} />
          <List.Item
            title="Сервер"
            description={
              isAdmin
                ? loadingServer
                  ? 'Загрузка…'
                  : serverError || serverInfo || 'Нажмите для обновления'
                : 'QIK Anime Backend'
            }
            titleStyle={{ color: theme.colors.onSurface }}
            descriptionStyle={{
              color: serverError ? theme.colors.error : theme.colors.onSurfaceVariant,
            }}
            left={(props) => (
              <List.Icon {...props} icon="server-network" color={theme.colors.primary} />
            )}
            onPress={isAdmin ? loadServerInfo : undefined}
          />
        </Surface>

        <Text variant="bodySmall" style={[styles.footer, { color: theme.colors.onSurfaceVariant }]}>
          QIK Anime · {APP_VERSION}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
  },
  card: {
    borderRadius: 14,
    marginTop: 8,
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  themeLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  group: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  logoutBtn: {
    marginTop: 16,
    borderRadius: 14,
  },
  logoutContent: {
    paddingVertical: 6,
  },
  footer: {
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 8,
  },
});
