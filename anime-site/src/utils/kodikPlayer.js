// Kodik iframe postMessage API
// Player sends: { key: 'kodik_player_time_update', value: seconds }
// Player listens: { key: 'kodik_player_api', value: { method, value? } }

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

export function sendKodikCommand(iframeRef, method, value) {
  const cw = iframeRef.current?.contentWindow
  if (!cw) return

  const payload = { key: 'kodik_player_api', value: { method } }
  if (value !== undefined) payload.value.value = value

  cw.postMessage(payload, '*')
  cw.postMessage(JSON.stringify(payload), '*')
}
