// Kodik iframe postMessage API
// Docs: player sends { key: 'kodik_player_time_update', value: seconds }
// Control: URL parameters autoplay + start_from (Kodik has no postMessage control API)

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

export function playPause(iframeRef, iframeUrl, currentPosition) {
  const iframe = iframeRef.current
  if (!iframe || !iframeUrl) return

  const url = new URL(iframeUrl)
  url.searchParams.set('start_from', String(Math.floor(currentPosition)))

  const wasAutoplay = url.searchParams.get('autoplay') === 'true'
  if (wasAutoplay) {
    url.searchParams.delete('autoplay')
  } else {
    url.searchParams.set('autoplay', 'true')
  }

  // Force reload with cache-bust
  url.searchParams.set('_t', String(Date.now()))
  iframe.src = url.toString()

  return !wasAutoplay // new state: true = playing
}
