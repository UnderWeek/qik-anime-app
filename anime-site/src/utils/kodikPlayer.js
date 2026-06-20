// Kodik iframe postMessage API
// Docs: postMessage from player → { key: 'kodik_player_time_update', value: seconds }
//       postMessage to player → { method: 'playPause' } (undocumented, may not work)

export function sendKodikCommand(iframeRef, method) {
  const cw = iframeRef.current?.contentWindow
  if (!cw) return
  cw.postMessage(JSON.stringify({ method }), '*')
}

export function subscribeKodikEvents(iframeRef, callback) {
  function handler(event) {
    let msg = event.data
    if (typeof msg === 'string') {
      try { msg = JSON.parse(msg) } catch { return }
    }
    if (!msg || typeof msg !== 'object') return

    // Documented: { key: 'kodik_player_time_update', value: seconds }
    if (msg.key === 'kodik_player_time_update' && typeof msg.value === 'number') {
      callback({ type: 'time', time: msg.value })
    }
  }

  window.addEventListener('message', handler)
  return () => window.removeEventListener('message', handler)
}
