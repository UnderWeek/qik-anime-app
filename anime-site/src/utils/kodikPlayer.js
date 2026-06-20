// Kodik iframe postMessage API
// Player sends: { key: 'kodik_player_time_update', value: seconds }
// Undocumented control via: kodikIframe.contentWindow.postMessage({ method }, '*')

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

export function playPause(iframeRef) {
  const cw = iframeRef.current?.contentWindow
  if (!cw) return false

  cw.postMessage(JSON.stringify({ method: 'playPause' }), '*')
  return true
}
