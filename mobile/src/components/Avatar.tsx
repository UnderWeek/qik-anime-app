import { View, Text, StyleSheet } from 'react-native';
import { useTheme, Avatar as PaperAvatar } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { uploadUrl } from '../api/client';

const FRAME_COLORS: Record<string, string> = {
  mint: '#7FE3B0',
  lavender: '#B9A0FF',
  peach: '#FFC79A',
  rose: '#FF8FA3',
  gold: '#FFD24A',
  aurora: '#5EE6D0',
  legend: '#FF5E5E',
};

interface AvatarProps {
  user?: { avatarUrl?: string | null; avatarColor?: string; avatarFrame?: string | null; username?: string } | null;
  size?: number;
}

export default function Avatar({ user, size = 44 }: AvatarProps) {
  const theme = useTheme();
  const frameColor = user?.avatarFrame ? FRAME_COLORS[user.avatarFrame] : undefined;
  const initial = (user?.username?.[0] || '?').toUpperCase();

  const inner = user?.avatarUrl ? (
    <PaperAvatar.Image
      size={size - (frameColor ? 6 : 0)}
      source={{ uri: uploadUrl(user.avatarUrl) }}
    />
  ) : (
    <PaperAvatar.Text
      size={size - (frameColor ? 6 : 0)}
      label={initial}
      style={{ backgroundColor: user?.avatarColor || theme.colors.primary }}
    />
  );

  if (!frameColor) return inner;

  return (
    <View
      style={[
        styles.frame,
        { width: size, height: size, borderRadius: size / 2, borderColor: frameColor },
      ]}
    >
      {inner}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
