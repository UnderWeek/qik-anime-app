import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { ThemeProvider, useThemeCtx } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import AuthModalHost from './src/components/AuthModalHost';

function Inner() {
  const { theme, isDark } = useThemeCtx();
  return (
    <View style={styles.root}>
      <PaperProvider theme={theme}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <AuthProvider>
          <AppNavigator />
          <AuthModalHost />
        </AuthProvider>
      </PaperProvider>
    </View>
  );
}

export default function App() {
  return (
    <View style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <Inner />
        </ThemeProvider>
      </SafeAreaProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
