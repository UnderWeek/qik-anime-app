// Kodik Player integration layer — abstraction over postMessage to Kodik iframe.
// Keeps Watch Party logic independent of Kodik implementation details.

let listenerInstalled = false

function parsePayload(data) {
  if (!data) return null
  if (typeof data === 'string') {
    try { return JSON.parse(data) } catch { return null }
  }
  if (typeof data === 'object') return data
  return null
}

// Maximum reasonable video length in seconds (24 hours)
const MAX_VIDEO_SECONDS = 86400

/**
 * Send a command to the Kodik player inside an iframe.
 * @param {React.RefObject<HTMLIFrameElement>} iframeRef
 * @param {'play'|'pause'|'seek'} method
 * @param {number} [value] — time in seconds (only for 'seek')
 */
export function sendKodikCommand(iframeRef, method, value) {
  const win = iframeRef.current?.contentWindow
  if (!win) return
  const payload = { key: 'kodik_player_api', value: { method, value } }
  try {
    win.postMessage(payload, '*')
    win.postMessage(JSON.stringify(payload), '*')
  } catch { /* cross-origin */ }
}

/**
 * Try to extract a valid video time (in seconds) from a Kodik event.
 * Returns the time or null if no valid time found.
 */
function extractTime(payload) {
  // Structured format: { value: { time: 123.4 } }
  if (payload.value && typeof payload.value === 'object') {
    const t = Number(payload.value.time ?? payload.value.currentTime)
    if (Number.isFinite(t) && t >= 0 && t < MAX_VIDEO_SECONDS) return t
  }
  // Top-level time field
  const topTime = Number(payload.currentTime ?? payload.time)
  if (Number.isFinite(topTime) && topTime >= 0 && topTime < MAX_VIDEO_SECONDS) return topTime
  // Bare number in value (Kodik sometimes sends this)
  const bare = Number(payload.value)
  if (Number.isFinite(bare) && bare >= 0 && bare < MAX_VIDEO_SECONDS) return bare
  return null
}

/**
 * Subscribe to Kodik player events.
 * Callback receives: { type: 'time', time: number } | { type: 'play' } | { type: 'pause' }
 * @param {React.RefObject<HTMLIFrameElement>} iframeRef
 * @param {(event: { type: string, time?: number }) => void} callback
 * @returns {() => void} unsubscribe function
 */
export function subscribeKodikEvents(iframeRef, callback) {
  function onMessage(event) {
    const frame = iframeRef.current
    if (!frame?.contentWindow || event.source !== frame.contentWindow) return

    const payload = parsePayload(event.data)
    if (!payload) return

    const key = String(payload.key || payload.type || payload.event || '').toLowerCase()

    // Time update
    const time = extractTime(payload)
    if (time !== null) {
      callback({ type: 'time', time })
    }

    // Play event
    if (key.includes('play') && !key.includes('isplaying') && !key.includes('playback')) {
      callback({ type: 'play' })
    }

    // Pause event
    if (key.includes('pause')) {
      callback({ type: 'pause' })
    }
  }

  if (!listenerInstalled) {
    window.addEventListener('message', onMessage)
    listenerInstalled = true
  }

  return () => {
    window.removeEventListener('message', onMessage)
    listenerInstalled = false
  }
}
