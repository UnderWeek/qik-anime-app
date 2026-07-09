import { Dimensions } from 'react-native';

export const SCREEN_WIDTH = Dimensions.get('window').width;

// Card width for a 3-column poster grid with 12px gutters.
export function cardWidth(columns = 3, gutter = 12, sidePad = 12): number {
  const available = SCREEN_WIDTH - sidePad * 2 - gutter * (columns - 1);
  return Math.floor(available / columns);
}
