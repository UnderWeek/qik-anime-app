// Kodik iframe postMessage API
// Player sends: { key: 'kodik_player_time_update', value: seconds }
// Control only via URL params (no documented postMessage control)

export function subscribeKodikEvents(iframeRef, callback) {
  function handler(event) {
    let msg = event.data
    if (typeof msg === 'string') {
      try { msg = JSON.parse(msg) } catch { return }
    }
    if (!msg || typeof msg !== 'object') return

    if (msg.key === 'kodik_player_time_update' && typeof msg.value === 'number') {
      callback({ type: 'time', time: msg.value })
    }
  }

  window.addEventListener('message', handler)
  return () => window.removeEventListener('message', handler)
}

export function playPause(iframeRef, iframeUrl) {
  const iframe = iframeRef.current
  if (!iframe || !iframeUrl) return false

  const fullUrl = iframeUrl.startsWith('//') ? `https:${iframeUrl}` : iframeUrl
  const url = new URL(fullUrl)

  const wasAutoplay = url.searchParams.get('autoplay') === 'true'
  if (wasAutoplay) {
    url.searchParams.delete('autoplay')
  } else {
    url.searchParams.set('autoplay', 'true')
  }

  iframe.src = url.toString()
  return !wasAutoplay
}
