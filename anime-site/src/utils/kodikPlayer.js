// Kodik iframe postMessage API helpers
// Docs: https://kodik.info/api/player

function parsePayload(data) {
  if (typeof data === 'string') {
    try { return JSON.parse(data) } catch { return null }
  }
  return data && typeof data === 'object' ? data : null
}

export function sendKodikCommand(iframeRef, method, value) {
  console.log('[STEP2-SEND-TO-KODIK]', { method, value, hasIframe: !!iframeRef?.current, hasContentWindow: !!iframeRef?.current?.contentWindow })

  if (!iframeRef?.current?.contentWindow) return

  // Collect all target windows (main + nested iframes)
  const targets = [iframeRef.current.contentWindow]
  try {
    const frames = iframeRef.current.contentWindow?.frames
    if (frames) {
      for (let i = 0; i < frames.length; i++) {
        try { if (frames[i]) targets.push(frames[i]) } catch { /* ignore */ }
      }
    }
  } catch { /* ignore */ }

  // Try every format that Kodik could accept
  const formats = [
    { method },                                    // { method: 'play' }
    { key: method },                               // { key: 'play' }
    { type: method },                              // { type: 'play' }
    { event: method },                             // { event: 'play' }
    { action: method },                            // { action: 'play' }
  ]
  if (value !== undefined) {
    for (const f of formats) f.value = value
  }

  for (const cw of targets) {
    if (!cw) continue
    for (const payload of formats) {
      try { cw.postMessage(payload, '*') } catch { /* ignore */ }
      try { cw.postMessage(JSON.stringify(payload), '*') } catch { /* ignore */ }
    }
  }

  console.log('[STEP2-SENT]', { method, value, targets: targets.length, formats: formats.length })
}

export function subscribeKodikEvents(iframeRef, callback) {
  function handler(event) {
    const msg = parsePayload(event.data)
    if (!msg) return

    const type = msg.type || msg.key || ''
    if (!type) return

    if (type.includes('time') || type.includes('current_time')) {
      callback({ type: 'time', time: Number(msg.value) || Number(msg.time) || 0 })
    } else if (type.includes('started') || type.includes('play') || type.includes('resume')) {
      callback({ type: 'play' })
    } else if (type.includes('pause') || type.includes('paused')) {
      callback({ type: 'pause' })
    }
  }

  window.addEventListener('message', handler)
  return () => window.removeEventListener('message', handler)
}
