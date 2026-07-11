import { Pressable, View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import Poster from './Poster';

interface AnimeCardProps {
  item: any;
  onPress: (item: any) => void;
  onLongPress?: (item: any) => void;
  width?: number;
}

export default function AnimeCard({ item, onPress, onLongPress, width = 140 }: AnimeCardProps) {
  const theme = useTheme();
  const posterUrl = item?.posterUrl || item?.poster_url || extractPoster(item);
  const title = item?.title || item?.name || item?.ru_title || 'Без названия';
  const ratingRaw = item?.rating;
  const rating = typeof ratingRaw === 'object' ? ratingRaw?.average ?? ratingRaw?.score : ratingRaw;

  return (
    <Pressable
      onPress={() => onPress(item)}
      onLongPress={onLongPress ? () => onLongPress(item) : undefined}
      delayLongPress={400}
      style={({ pressed }) => [
        styles.card,
        { width, backgroundColor: theme.colors.surfaceContainer, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={[styles.posterWrap, { width }]}>
        <Poster
          uri={posterUrl}
          style={[styles.poster, { width }]}
        />
      </View>
      <View style={styles.meta}>
        <Text style={[styles.title, { color: theme.colors.onSurface }]} numberOfLines={2}>
          {title}
        </Text>
        {rating != null && (
          <Text style={[styles.rating, { color: theme.colors.primary }]}>★ {Number(rating).toFixed(2)}</Text>
        )}
      </View>
    </Pressable>
  );
}

function extractPoster(item: any): string {
  if (!item) return '';
  const p = item.poster;
  if (!p) return '';
  for (const s of ['medium', 'small', 'big', 'huge', 'mega', 'fullsize']) {
    if (p[s]) {
      let u = p[s];
      if (u.startsWith('//')) u = `https:${u}`;
      if (u.startsWith('/')) u = `https://static.yani.tv${u}`;
      return u;
    }
  }
  return '';
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
  },
  posterWrap: {
    aspectRatio: 2 / 3,
    backgroundColor: 'rgba(128,128,128,0.15)',
  },
  poster: {
    aspectRatio: 2 / 3,
  },
  meta: {
    padding: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 16,
  },
  rating: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '700',
  },
});
