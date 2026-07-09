// Type augmentation: RN Paper 5.15's MD3Colors type omits several MD3 tonal
// surface tokens that our custom theme (theme/theme.ts) defines at runtime.
// Declaring them here keeps useTheme().colors.* type-safe without runtime changes.
import 'react-native-paper';

declare module 'react-native-paper' {
  interface MD3Colors {
    surfaceContainer: string;
    surfaceContainerHigh: string;
    surfaceContainerLow?: string;
    surfaceContainerLowest?: string;
    surfaceContainerHighest?: string;
    inverseSurface: string;
    inverseOnSurface: string;
    inversePrimary: string;
    scrim: string;
    shadow: string;
  }

  interface MD3Theme {
    isDark?: boolean;
  }
}
