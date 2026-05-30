// Pure helpers for levels, XP and achievements.
// XP is derived from user activity so it stays consistent without extra storage.

export interface ActivityStats {
  watchedEpisodes: number;
  watchedSeconds: number;
  ratings: number;
  comments: number;
  bookmarks: number;
  friends: number;
  reZeroS4?: boolean;
}

// XP weights per activity
export function computeXp(s: ActivityStats): number {
  return (
    s.watchedEpisodes * 10 +
    Math.floor(s.watchedSeconds / 60) * 1 + // 1 xp per watched minute
    s.ratings * 5 +
    s.comments * 8 +
    s.bookmarks * 3 +
    s.friends * 15
  );
}

// Level curve: each level needs progressively more XP.
// xp needed to *reach* level n (1-indexed): 100 * (n-1)^1.5
export function levelForXp(xp: number): {
  level: number;
  xpInLevel: number;
  xpForNext: number;
  progress: number;
} {
  const xpToReach = (lvl: number) => Math.floor(100 * Math.pow(lvl - 1, 1.5));

  let level = 1;
  while (xp >= xpToReach(level + 1)) level++;

  const base = xpToReach(level);
  const next = xpToReach(level + 1);
  const xpInLevel = xp - base;
  const xpForNext = next - base;
  const progress = xpForNext > 0 ? Math.min(1, xpInLevel / xpForNext) : 1;

  return { level, xpInLevel, xpForNext, progress };
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string; // emoji for simplicity
  check: (s: ActivityStats) => boolean;
  goal?: (s: ActivityStats) => { current: number; target: number };
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_episode',
    title: 'Первый шаг',
    description: 'Посмотреть первую серию',
    icon: '🌱',
    check: (s) => s.watchedEpisodes >= 1,
    goal: (s) => ({ current: s.watchedEpisodes, target: 1 }),
  },
  {
    id: 'binge_10',
    title: 'Втянулся',
    description: 'Посмотреть 10 серий',
    icon: '🍿',
    check: (s) => s.watchedEpisodes >= 10,
    goal: (s) => ({ current: s.watchedEpisodes, target: 10 }),
  },
  {
    id: 'binge_100',
    title: 'Запойный зритель',
    description: 'Посмотреть 100 серий',
    icon: '🔥',
    check: (s) => s.watchedEpisodes >= 100,
    goal: (s) => ({ current: s.watchedEpisodes, target: 100 }),
  },
  {
    id: 'day_watched',
    title: 'Сутки в аниме',
    description: 'Насмотреть 24 часа',
    icon: '⏰',
    check: (s) => s.watchedSeconds >= 24 * 3600,
    goal: (s) => ({ current: Math.floor(s.watchedSeconds / 3600), target: 24 }),
  },
  {
    id: 'critic',
    title: 'Критик',
    description: 'Оценить 10 аниме',
    icon: '⭐',
    check: (s) => s.ratings >= 10,
    goal: (s) => ({ current: s.ratings, target: 10 }),
  },
  {
    id: 'talker',
    title: 'Болтун',
    description: 'Оставить 10 комментариев',
    icon: '💬',
    check: (s) => s.comments >= 10,
    goal: (s) => ({ current: s.comments, target: 10 }),
  },
  {
    id: 'collector',
    title: 'Коллекционер',
    description: 'Добавить 25 аниме в закладки',
    icon: '📚',
    check: (s) => s.bookmarks >= 25,
    goal: (s) => ({ current: s.bookmarks, target: 25 }),
  },
  {
    id: 'social',
    title: 'Свой человек',
    description: 'Завести первого друга',
    icon: '🤝',
    check: (s) => s.friends >= 1,
    goal: (s) => ({ current: s.friends, target: 1 }),
  },
  {
    id: 'popular',
    title: 'Популярный',
    description: 'Завести 5 друзей',
    icon: '🌟',
    check: (s) => s.friends >= 5,
    goal: (s) => ({ current: s.friends, target: 5 }),
  },
  {
    id: 'larp_monster',
    title: 'ЛАРП-монстр',
    description: 'Посмотреть серию 4 сезона Re:Zero',
    icon: '😈',
    check: (s) => !!s.reZeroS4,
  },
];

export function buildAchievements(s: ActivityStats) {
  return ACHIEVEMENTS.map((a) => {
    const unlocked = a.check(s);
    const goal = a.goal ? a.goal(s) : undefined;
    return {
      id: a.id,
      title: a.title,
      description: a.description,
      icon: a.icon,
      unlocked,
      progress: goal
        ? { current: Math.min(goal.current, goal.target), target: goal.target }
        : undefined,
    };
  });
}
