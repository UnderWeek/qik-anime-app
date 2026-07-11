import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

// Material 3 palette tuned for QIK Anime.
// Light and dark schemes share the same hue family (violet/indigo) with a
// warm secondary to keep the anime-poster-heavy UI vibrant.

const lightColors = {
  primary: '#6750A4',
  onPrimary: '#FFFFFF',
  primaryContainer: '#EADDFF',
  onPrimaryContainer: '#21005D',
  secondary: '#625B71',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#E8DEF8',
  onSecondaryContainer: '#1D192B',
  tertiary: '#7D5260',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#FFD8E4',
  onTertiaryContainer: '#31111D',
  error: '#B3261E',
  onError: '#FFFFFF',
  errorContainer: '#F9DEDC',
  onErrorContainer: '#410E0B',
  background: '#FFFBFE',
  onBackground: '#1C1B1F',
  surface: '#FFFBFE',
  onSurface: '#1C1B1F',
  surfaceVariant: '#E7E0EC',
  onSurfaceVariant: '#49454F',
  outline: '#79747E',
  outlineVariant: '#CAC4D0',
  surfaceContainer: '#F3EDF7',
  surfaceContainerHigh: '#ECE6F0',
  inverseSurface: '#313033',
  inverseOnSurface: '#F4EFF4',
  inversePrimary: '#D0BCFF',
  shadow: '#000000',
  scrim: '#000000',
  elevation: {
    level0: 'transparent',
    level1: 'rgb(247, 243, 249)',
    level2: 'rgb(243, 237, 246)',
    level3: 'rgb(238, 232, 244)',
    level4: 'rgb(236, 230, 243)',
    level5: 'rgb(233, 227, 241)',
  },
};

const darkColors = {
  primary: '#D0BCFF',
  onPrimary: '#381E72',
  primaryContainer: '#4F378B',
  onPrimaryContainer: '#EADDFF',
  secondary: '#CCC2DC',
  onSecondary: '#332D41',
  secondaryContainer: '#4A4458',
  onSecondaryContainer: '#E8DEF8',
  tertiary: '#EFB8C8',
  onTertiary: '#492532',
  tertiaryContainer: '#633B48',
  onTertiaryContainer: '#FFD8E4',
  error: '#F2B8B5',
  onError: '#601410',
  errorContainer: '#8C1D18',
  onErrorContainer: '#F9DEDC',
  background: '#1a1b25',
  onBackground: '#E6E1E5',
  surface: '#1a1b25',
  onSurface: '#E6E1E5',
  surfaceVariant: '#49454F',
  onSurfaceVariant: '#CAC4D0',
  outline: '#938F99',
  outlineVariant: '#49454F',
  surfaceContainer: '#242430',
  surfaceContainerHigh: '#2A2B37',
  inverseSurface: '#E6E1E5',
  inverseOnSurface: '#313033',
  inversePrimary: '#6750A4',
  shadow: '#000000',
  scrim: '#000000',
  elevation: {
    level0: 'transparent',
    level1: 'rgb(37, 35, 42)',
    level2: 'rgb(44, 40, 49)',
    level3: 'rgb(49, 44, 56)',
    level4: 'rgb(51, 46, 58)',
    level5: 'rgb(52, 49, 63)',
  },
};

export const lightTheme = {
  ...MD3LightTheme,
  colors: lightColors,
  roundness: 14,
};

export const darkTheme = {
  ...MD3DarkTheme,
  colors: darkColors,
  roundness: 14,
};

export type AppTheme = typeof lightTheme;
