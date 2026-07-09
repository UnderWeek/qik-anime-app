import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useTheme, Button } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export function LoadingState({ label = 'Загрузка…' }: { label?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
      <MaterialCommunityIcons name="alert-circle-outline" size={48} color={theme.colors.error} />
      <Text style={[styles.label, { color: theme.colors.onSurfaceVariant, marginTop: 8 }]}>
        {message || 'Что-то пошло не так'}
      </Text>
      {onRetry && (
        <Button mode="outlined" onPress={onRetry} style={{ marginTop: 12 }}>
          Повторить
        </Button>
      )}
    </View>
  );
}

export function EmptyState({
  icon = 'inbox-outline',
  message,
  action,
  actionLabel,
}: {
  icon?: string;
  message: string;
  action?: () => void;
  actionLabel?: string;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
      <MaterialCommunityIcons name={icon as any} size={48} color={theme.colors.outline} />
      <Text style={[styles.label, { color: theme.colors.onSurfaceVariant, marginTop: 8 }]}>
        {message}
      </Text>
      {action && actionLabel && (
        <Button mode="contained" onPress={action} style={{ marginTop: 12 }}>
          {actionLabel}
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  label: {
    fontSize: 14,
    textAlign: 'center',
  },
});
