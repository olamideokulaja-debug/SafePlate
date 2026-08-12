// Camera QR scanner for field verification.
/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import { useState, useEffect, useRef } from 'react'
import jsQR from 'jsqr'

export function QrScanner({ onFound, onClose }) {
  const videoRef = React.useRef(null)
  const canvasRef = React.useRef(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    let stream = null, raf = null, stopped = false
    async function start() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { setErr('This device or browser cannot open the camera. Type the ID instead.'); return }
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        const v = videoRef.current
        if (!v) return
        v.srcObject = stream; v.setAttribute('playsinline', 'true'); await v.play()
        const tick = () => {
          if (stopped) return
          const c = canvasRef.current
          if (v.readyState === v.HAVE_ENOUGH_DATA && c) {
            c.width = v.videoWidth; c.height = v.videoHeight
            const ctx = c.getContext('2d')
            ctx.drawImage(v, 0, 0, c.width, c.height)
            try {
              const img = ctx.getImageData(0, 0, c.width, c.height)
              const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })
              if (code && code.data) {
                const m = String(code.data).match(/SP-(?:W-)?LG-[0-9]+/i)
                if (m) { stopped = true; onFound(m[0].toUpperCase()); return }
              }
            } catch (e) { /* frame not ready */ }
          }
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      } catch (e) {
        setErr(e && e.name === 'NotAllowedError' ? 'Camera permission was refused. Allow the camera, or type the ID instead.' : 'The camera could not be opened. Type the ID instead.')
      }
    }
    start()
    return () => { stopped = true; if (raf) cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach(t => t.stop()) }
    // eslint-disable-next-line
  }, [])
  return (
    <div style={{ marginTop: 12, border: '1px solid var(--line)', borderRadius: 12, padding: 12, background: '#fafcfb' }}>
      <div className="row-between" style={{ alignItems: 'center', marginBottom: 8 }}>
        <span className="kicker" style={{ color: 'var(--green)' }}>Point the camera at the QR code</span>
        <button className="btn sm" onClick={onClose}>Close camera</button>
      </div>
      {err ? <div className="err">{err}</div> : (
        <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', background: '#000' }}>
          <video ref={videoRef} style={{ width: '100%', maxHeight: 320, objectFit: 'cover', display: 'block' }} muted />
          <div style={{ position: 'absolute', inset: '18%', border: '3px solid rgba(255,255,255,.85)', borderRadius: 12, pointerEvents: 'none' }} />
        </div>
      )}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <p className="muted" style={{ fontSize: 12, marginBottom: 0, marginTop: 8 }}>Scanning happens on this device. No image is uploaded or stored.</p>
    </div>
  )
}

export default QrScanner
