import { View, StyleSheet, RefreshControl, ScrollView } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReactNode } from 'react';

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

  const content = (
    <View style={padded ? {} : {}}>{children}</View>
  );

  if (onRefresh) {
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
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
          }
        >
          {content}
        </ScrollView>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
          paddingTop: insets.top + 4,
          paddingHorizontal: padded ? 12 : 0,
          paddingBottom: insets.bottom + 100,
        },
      ]}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
