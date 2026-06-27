// Shared online-status helpers. Must match server's ONLINE_THRESHOLD_SECONDS.
export const ONLINE_MS = 300_000; // 5 min

/**
 * @param {string|null|undefined} iso
 * @returns {{ online: boolean, label: string|null }}
 */
export function lastSeen(iso) {
  if (!iso) return { online: false, label: null };

  const now = Date.now();
  const d = new Date(iso);
  const diff = now - d.getTime();

  if (diff < ONLINE_MS) return { online: true, label: null };

  const seconds = diff / 1000;

  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    return { online: false, label: `был(а) ${m} мин назад` };
  }

  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    return { online: false, label: `был(а) ${h} ч назад` };
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === yesterday.toDateString()) {
    const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return { online: false, label: `был вчера в ${time}` };
  }

  return {
    online: false,
    label: `был ${d.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })}`,
  };
}
