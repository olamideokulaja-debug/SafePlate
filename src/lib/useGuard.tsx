// Shared two-factor confirmation hook. Returns { guard, modal }: call guard(
// label, run) to require an OTP before running a privileged action, and render
// {modal} somewhere in the component. Used by the Sterling and Regulator portals.
/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import { useState } from 'react'
import { otp6 } from './constants.ts'

export function useGuard() {
  const [pending, setPending] = useState(null)
  const [otp, setOtp] = useState('')
  const [toast, setToast] = useState('')
  function guard(label, run) { setOtp(''); setPending({ label, run }) }
  async function confirm() {
    if (!otp6(otp)) return
    const p = pending; setPending(null)
    // The action must be able to fail loudly. Without this, a rejected promise
    // escaped here and the click appeared to do nothing at all.
    try {
      await p.run()
      setToast(p.label + ' completed and written to the audit trail.')
    } catch (e) {
      setToast('Could not complete: ' + ((e && e.message) || 'the server refused this action.'))
    }
    setTimeout(() => setToast(''), 6000)
  }
  const modal = (
    <>
      {toast && <div className="toast">{toast}</div>}
      {pending && (
        <div className="modal-bg" onClick={() => setPending(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="kicker" style={{ color: 'var(--green)' }}>Two-factor confirmation</div>
            <h3 className="serif" style={{ fontSize: 19, margin: '8px 0 6px' }}>{pending.label}</h3>
            <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>Enter the 6-digit code sent to your registered phone to authorise this action.</p>
            <div className="field"><input value={otp} onChange={e => setOtp(e.target.value)} placeholder="6-digit code" maxLength={6} /></div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn block" onClick={() => setPending(null)}>Cancel</button>
              <button className="btn p block" onClick={confirm} disabled={!otp6(otp)}>Authorise</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
  return { guard, modal }
}

export default useGuard
