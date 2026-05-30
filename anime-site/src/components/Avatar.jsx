import { uploadUrl } from '../api/backend.js'
import { frameColor } from '../utils/frames.js'

export default function Avatar({ user, size = 34 }) {
  if (!user) return null
  const letter = (user.username || '?').charAt(0).toUpperCase()
  const bg = user.avatarColor || '#b8a6f0'
  const frame = user.avatarFrame && user.avatarFrame !== 'none' ? frameColor(user.avatarFrame) : null

  const inner = (
    <span
      className="avatar"
      style={{
        background: user.avatarUrl ? undefined : bg,
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
      }}
      aria-hidden
    >
      {user.avatarUrl ? (
        <img
          src={uploadUrl(user.avatarUrl)}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
        />
      ) : (
        letter
      )}
    </span>
  )

  if (!frame) return inner

  // wrap with a gradient ring
  const pad = Math.max(2, Math.round(size * 0.07))
  return (
    <span
      className="avatar-frame"
      style={{
        background: frame,
        padding: pad,
        width: size + pad * 2,
        height: size + pad * 2,
      }}
    >
      {inner}
    </span>
  )
}
