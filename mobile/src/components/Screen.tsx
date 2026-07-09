import { View, StyleSheet, RefreshControl, FlatList } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReactNode, useCallback } from 'react';

interface ScreenProps {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
}

// Themed screen wrapper respecting safe-area insets.
export default function Screen({ children, refreshing, onRefresh, padded = true }: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
          paddingTop: insets.top + 4,
          paddingHorizontal: padded ? 12 : 0,
        },
      ]}
    >
      <FlatList
        data={[{ key: 'content' }]}
        renderItem={() => <View style={padded ? {} : {}}>{children}</View>}
        keyExtractor={(item) => item.key}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
          ) : undefined
        }
        scrollEnabled={!!onRefresh}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
