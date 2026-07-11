import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  useTheme,
  Divider,
  Surface,
  IconButton,
} from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth, QikUser } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import backend from '../api/backend';
import { uploadUrl } from '../api/client';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

const AVATAR_COLORS = [
  '#6750A4',
  '#7FE3B0',
  '#B9A0FF',
  '#FFC79A',
  '#FF8FA3',
  '#FFD24A',
  '#5EE6D0',
  '#FF5E5E',
  '#42A5F5',
  '#FF7043',
  '#26A69A',
  '#8D6E63',
];

const FRAMES: { label: string; value: string | null }[] = [
  { label: 'Нет', value: 'none' },
  { label: 'Мята', value: 'mint' },
  { label: 'Лаванда', value: 'lavender' },
  { label: 'Персик', value: 'peach' },
  { label: 'Роза', value: 'rose' },
  { label: 'Золото', value: 'gold' },
  { label: 'Аврора', value: 'aurora' },
  { label: 'Легенда', value: 'legend' },
];

export default function EditProfileScreen({ navigation }: Props) {
  const theme = useTheme();
  const { user, refreshUser, addToast } = useAuth();
  const insets = useSafeAreaInsets();

  const [username, setUsername] = useState(user?.username ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [avatarColor, setAvatarColor] = useState(user?.avatarColor ?? AVATAR_COLORS[0]);
  const [avatarFrame, setAvatarFrame] = useState<string | null>(user?.avatarFrame || 'none');
  const [avatarUrl, setAvatarUrl] = useState<string | null | undefined>(user?.avatarUrl);
  const [bannerUrl, setBannerUrl] = useState<string | null | undefined>(user?.bannerUrl);

  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const previewUser: QikUser = {
    ...(user as QikUser),
    username,
    avatarColor,
    avatarFrame,
    avatarUrl,
    bannerUrl,
  };

  const pickAvatar = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setUploadingAvatar(true);
      const res = await backend.uploadImage({
        uri: asset.uri,
        name: `avatar-${Date.now()}.jpg`,
        type: 'image/jpeg',
      });
      const uploaded: string | undefined = res?.url ?? res?.path ?? res?.file;
      if (uploaded) {
        setAvatarUrl(uploaded);
        addToast('Аватар загружен', 'success');
      } else {
        addToast('Не удалось загрузить аватар', 'error');
      }
    } catch (e: any) {
      addToast(e?.message || 'Ошибка загрузки аватара', 'error');
    } finally {
      setUploadingAvatar(false);
    }
  }, [addToast]);

  const pickBanner = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setUploadingBanner(true);
      const res = await backend.uploadImage({
        uri: asset.uri,
        name: `banner-${Date.now()}.jpg`,
        type: 'image/jpeg',
      });
      const uploaded: string | undefined = res?.url ?? res?.path ?? res?.file;
      if (uploaded) {
        setBannerUrl(uploaded);
        addToast('Баннер загружен', 'success');
      } else {
        addToast('Не удалось загрузить баннер', 'error');
      }
    } catch (e: any) {
      addToast(e?.message || 'Ошибка загрузки баннера', 'error');
    } finally {
      setUploadingBanner(false);
    }
  }, [addToast]);

  const handleSave = useCallback(async () => {
    const trimmed = username.trim();
    if (!trimmed) {
      addToast('Введите имя пользователя', 'error');
      return;
    }
    setSaving(true);
    try {
      await backend.updateProfile({
        username: trimmed,
        bio: bio.trim(),
        avatarColor,
        avatarFrame,
        avatarUrl,
        bannerUrl,
      });
      await refreshUser();
      addToast('Профиль обновлён', 'success');
      navigation.goBack();
    } catch (e: any) {
      addToast(e?.message || 'Не удалось сохранить профиль', 'error');
    } finally {
      setSaving(false);
    }
  }, [username, bio, avatarColor, avatarFrame, avatarUrl, bannerUrl, refreshUser, addToast, navigation]);

  return (
    <SafeAreaView
      edges={['bottom']}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Banner preview */}
        <View style={styles.bannerWrap}>
          {bannerUrl ? (
            <Image source={{ uri: uploadUrl(bannerUrl) }} style={styles.banner} resizeMode="cover" />
          ) : (
            <View
              style={[styles.banner, { backgroundColor: theme.colors.surfaceContainer }]}
            >
              <MaterialCommunityIcons
                name="image"
                size={48}
                color={theme.colors.onSurfaceVariant}
              />
            </View>
          )}
          <Surface
            style={[styles.bannerBtn, { backgroundColor: theme.colors.surfaceContainerHigh }]}
            elevation={2}
          >
            <Button
              mode="text"
              onPress={pickBanner}
              loading={uploadingBanner}
              disabled={uploadingBanner || saving}
              labelStyle={{ fontSize: 13 }}
            >
              {uploadingBanner ? 'Загрузка…' : 'Сменить баннер'}
            </Button>
          </Surface>
        </View>

        {/* Avatar preview + change */}
        <View style={styles.avatarRow}>
          <Avatar user={previewUser} size={88} />
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Button
              mode="outlined"
              onPress={pickAvatar}
              loading={uploadingAvatar}
              disabled={uploadingAvatar || saving}
              icon="camera"
            >
              {uploadingAvatar ? 'Загрузка…' : 'Сменить аватар'}
            </Button>
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}
            >
              PNG или JPG, квадрат 1:1
            </Text>
          </View>
        </View>

        <Divider style={styles.divider} />

        {/* Username */}
        <Text variant="titleMedium" style={styles.label}>
          Имя пользователя
        </Text>
        <TextInput
          mode="outlined"
          value={username}
          onChangeText={setUsername}
          placeholder="username"
          autoCapitalize="none"
          autoCorrect={false}
          left={<TextInput.Icon icon="account" />}
          style={styles.input}
        />

        {/* Bio */}
        <Text variant="titleMedium" style={[styles.label, { marginTop: 16 }]}>
          О себе
        </Text>
        <TextInput
          mode="outlined"
          value={bio}
          onChangeText={setBio}
          placeholder="Расскажите о себе…"
          multiline
          numberOfLines={4}
          style={styles.input}
          left={<TextInput.Icon icon="text" />}
        />

        {/* Avatar color */}
        <Text variant="titleMedium" style={[styles.label, { marginTop: 16 }]}>
          Цвет аватара
        </Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 10 }}>
          Виден, если нет изображения
        </Text>
        <View style={styles.swatchRow}>
          {AVATAR_COLORS.map((c) => {
            const selected = avatarColor === c;
            return (
              <TouchableOpacity
                key={c}
                onPress={() => setAvatarColor(c)}
                style={[
                  styles.swatch,
                  { backgroundColor: c, borderColor: theme.colors.outline },
                  selected ? { borderWidth: 3, borderColor: theme.colors.onSurface } : null,
                ]}
              >
                {selected ? (
                  <MaterialCommunityIcons name="check" size={18} color="#fff" />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Avatar frame */}
        <Text variant="titleMedium" style={[styles.label, { marginTop: 16 }]}>
          Рамка аватара
        </Text>
        <View style={styles.frameRow}>
          {FRAMES.map((f) => {
            const selected = avatarFrame === f.value;
            return (
              <TouchableOpacity
                key={f.label}
                onPress={() => setAvatarFrame(f.value)}
                style={[
                  styles.frameChip,
                  {
                    backgroundColor: selected
                      ? theme.colors.primary
                      : theme.colors.surfaceContainer,
                    borderColor: selected ? theme.colors.primary : theme.colors.outlineVariant,
                  },
                ]}
              >
                <Text
                  variant="bodyMedium"
                  style={{
                    color: selected ? theme.colors.onPrimary : theme.colors.onSurface,
                  }}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Divider style={styles.divider} />
      </ScrollView>

      {/* Save FAB-like footer */}
      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.colors.surface,
            paddingBottom: insets.bottom + 8,
            borderTopColor: theme.colors.outlineVariant,
          },
        ]}
      >
        <Button
          mode="outlined"
          onPress={() => navigation.goBack()}
          disabled={saving}
          style={styles.footerBtn}
        >
          Отмена
        </Button>
        <Button
          mode="contained"
          onPress={handleSave}
          loading={saving}
          disabled={saving || uploadingAvatar || uploadingBanner}
          style={[styles.footerBtn, { flex: 2 }]}
        >
          {saving ? 'Сохранение…' : 'Сохранить'}
        </Button>
      </View>
    </SafeAreaView>
  );
}

const BANNER_H = Math.round(Dimensions.get('window').width * 9 / 16);

const styles = StyleSheet.create({
  container: { flex: 1 },
  bannerWrap: { margin: 12, borderRadius: 14, overflow: 'hidden' },
  banner: { width: '100%', height: BANNER_H, justifyContent: 'center', alignItems: 'center' },
  bannerBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    borderRadius: 12,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  divider: { marginVertical: 16, marginHorizontal: 12 },
  label: { paddingHorizontal: 12, marginBottom: 8 },
  input: { marginHorizontal: 12 },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 10,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  frameRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
  },
  frameChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerBtn: { flex: 1 },
});
