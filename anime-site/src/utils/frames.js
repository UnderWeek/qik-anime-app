// Mirror of the backend frame catalog — used to render avatar rings client-side.
export const FRAMES = {
  none: 'transparent',
  mint: '#a6e3d0',
  lavender: '#b8a6f0',
  peach: '#f0c9b8',
  rose: '#f7c9d9',
  gold: 'linear-gradient(135deg,#ffd76a,#ffb347)',
  aurora: 'linear-gradient(135deg,#b8a6f0,#a6e3d0,#f7c9d9)',
  legend: 'linear-gradient(135deg,#ff5e8a,#7c5cff,#35c4a4)',
}

export function frameColor(id) {
  return FRAMES[id] || 'transparent'
}
