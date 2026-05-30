// Avatar frame catalog. Some frames unlock at a given level.
export interface FrameDef {
  id: string;
  title: string;
  // CSS gradient/border color used on the frontend ring
  color: string;
  minLevel: number;
}

export const FRAMES: FrameDef[] = [
  { id: 'none', title: 'Без рамки', color: 'transparent', minLevel: 0 },
  { id: 'mint', title: 'Мятная', color: '#a6e3d0', minLevel: 0 },
  { id: 'lavender', title: 'Лавандовая', color: '#b8a6f0', minLevel: 0 },
  { id: 'peach', title: 'Персик', color: '#f0c9b8', minLevel: 2 },
  { id: 'rose', title: 'Роза', color: '#f7c9d9', minLevel: 3 },
  { id: 'gold', title: 'Золотая', color: 'linear-gradient(135deg,#ffd76a,#ffb347)', minLevel: 5 },
  { id: 'aurora', title: 'Аврора', color: 'linear-gradient(135deg,#b8a6f0,#a6e3d0,#f7c9d9)', minLevel: 8 },
  { id: 'legend', title: 'Легенда', color: 'linear-gradient(135deg,#ff5e8a,#7c5cff,#35c4a4)', minLevel: 12 },
];

export function frameById(id: string): FrameDef | undefined {
  return FRAMES.find((f) => f.id === id);
}

export function framesForLevel(level: number) {
  return FRAMES.map((f) => ({ ...f, unlocked: level >= f.minLevel }));
}
