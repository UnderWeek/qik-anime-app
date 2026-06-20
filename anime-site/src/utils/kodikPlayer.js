// Kodik iframe postMessage API helpers
// Sends { method } and listens for { event, time? }

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

    if (msg.event === 'time' || msg.event === 'timeupdate') {
      callback({ type: 'time', time: Number(msg.time) || 0 })
    } else if (msg.event === 'play' || msg.event === 'started' || msg.event === 'resume') {
      callback({ type: 'play' })
    } else if (msg.event === 'pause' || msg.event === 'paused') {
      callback({ type: 'pause' })
    }
  }

  window.addEventListener('message', handler)
  return () => window.removeEventListener('message', handler)
}
