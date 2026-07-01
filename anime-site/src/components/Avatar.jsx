import { uploadUrl } from '../api/backend.js'
import { frameColor } from '../utils/frames.js'
import { lastSeen } from '../utils/time.js'

export default function Avatar({ user, size = 34 }) {
  if (!user) return null
  const letter = (user.username || '?').charAt(0).toUpperCase()
  const bg = user.avatarColor || '#b8a6f0'
  const frame = user.avatarFrame && user.avatarFrame !== 'none' ? frameColor(user.avatarFrame) : null
  const status = user.lastSeenAt ? lastSeen(user.lastSeenAt) : null

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

  const avatarEl = !frame ? inner : (
    <span
      className="avatar-frame"
      style={{
        background: frame,
        padding: Math.max(2, Math.round(size * 0.07)),
        width: size + Math.max(2, Math.round(size * 0.07)) * 2,
        height: size + Math.max(2, Math.round(size * 0.07)) * 2,
      }}
    >
      {inner}
    </span>
  )

  if (!status?.online) return avatarEl

  const pad = frame ? Math.max(2, Math.round(size * 0.07)) : 0
  const totalSize = size + pad * 2

  return (
    <span
      className="avatar-wrap"
      title={status.label || undefined}
      style={{ position: 'relative', display: 'inline-flex', width: totalSize, height: totalSize }}
    >
      {avatarEl}
      <span className="online-dot" style={{ bottom: pad, right: pad }} />
    </span>
  )
}
