import { useState, useCallback } from 'react';
import { Image } from 'expo-image';
import { posterFallbackChain } from '../api/yummy';

interface PosterProps {
  uri?: string | null;
  style?: any;
  contentFit?: 'cover' | 'contain';
}

// expo-image poster with imgproxy.yani.tv fallback when static.yani.tv fails (blocked in RF).
export default function Poster({ uri, style, contentFit = 'cover' }: PosterProps) {
  const chain = uri ? posterFallbackChain(uri) : [];
  const [attempt, setAttempt] = useState(0);

  const sources = uri ? [uri, ...chain] : [];
  const current = sources[Math.min(attempt, sources.length - 1)] || '';

  const onError = useCallback(() => {
    setAttempt((a) => (a < sources.length - 1 ? a + 1 : a));
  }, [sources.length]);

  if (!current) {
    return null;
  }

  return (
    <Image
      source={current}
      style={style}
      contentFit={contentFit}
      transition={150}
      cachePolicy="memory-disk"
      onError={onError}
    />
  );
}
