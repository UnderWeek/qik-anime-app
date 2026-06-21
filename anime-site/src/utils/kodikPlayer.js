window.addEventListener("message", (e) => {
  if (e.origin.includes("kodik")) {
    console.log(JSON.stringify(e.data, null, 2));
  }
});

// Kodik/Flowplayer iframe postMessage API
// Player sends: { key: 'kodik_player_time_update', value: seconds }
// Flowplayer API: { method: 'toggle'|'play'|'pause'|'mute'|'unmute' }

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

export function togglePlayPause(iframeRef) {
  const cw = iframeRef.current?.contentWindow
  if (!cw) return

  // Try multiple formats that Flowplayer / Kodik might accept
  const payloads = [
    { method: 'toggle' },
    { key: 'kodik_player_api', value: { method: 'playPause' } },
  ]

  for (const p of payloads) {
    try { cw.postMessage(p, '*') } catch { /* ignore */ }
    try { cw.postMessage(JSON.stringify(p), '*') } catch { /* ignore */ }
  }
}
