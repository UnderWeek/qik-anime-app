// Player postMessage API (Radiant Media Player + HLS.js)
// Commands → iframe: { type: 'play'|'pause'|'seekTo'|'getTime', time?: seconds }
// Events ← iframe: { event: 'play'|'pause'|'seek'|'timeupdate'|'ended', time: seconds }

export function sendPlayerCommand(iframeRef, type, time) {
  const cw = iframeRef.current?.contentWindow
  if (!cw) return
  const msg = { type }
  if (time !== undefined) msg.time = time
  cw.postMessage(JSON.stringify(msg), '*')
}

export function subscribePlayerEvents(iframeRef, callback) {
  function handler(event) {
    let msg = event.data
    if (typeof msg === 'string') {
      try { msg = JSON.parse(msg) } catch { return }
    }
    if (!msg || typeof msg !== 'object') return

    const evt = msg.event
    const time = typeof msg.time === 'number' ? msg.time : undefined

    if (evt === 'play') {
      callback({ type: 'play', time })
    } else if (evt === 'pause') {
      callback({ type: 'pause', time })
    } else if (evt === 'seek') {
      callback({ type: 'seek', time })
    } else if (evt === 'timeupdate') {
      callback({ type: 'time', time })
    } else if (evt === 'ended') {
      callback({ type: 'ended', time })
    }
  }

  window.addEventListener('message', handler)
  return () => window.removeEventListener('message', handler)
}
