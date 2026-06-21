// Kodik player control via server-side proxy (same-origin iframe)
// Proxy injects a control script that listens for { kodikCommand } postMessage

export function sendPlayerCommand(iframeRef, command, time) {
  const cw = iframeRef.current?.contentWindow
  if (!cw) return
  const msg = { kodikCommand: command }
  if (time !== undefined) msg.time = time
  cw.postMessage(msg, '*')
}

export function proxyUrl(originalUrl) {
  if (!originalUrl) return ''
  return `/api/player-proxy?url=${encodeURIComponent(originalUrl)}`
}
