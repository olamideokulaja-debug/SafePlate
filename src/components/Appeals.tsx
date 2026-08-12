// Appeal lodging button and the agency-side appeals list. Shared across the
// food-handler, employer and regulator portals.
/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import { useState, useEffect } from 'react'
import { store } from '../lib/store.ts'
import { toast } from '../lib/toast.ts'

export function AppealButton({ kind, subject, agency, by, label }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  async function submit() { if (!reason.trim()) return; setBusy(true); try { await store.createAppeal({ kind, subject, agency, appellant: by || 'unknown', reason: reason.trim() }); setDone(true); toast('Appeal lodged with ' + agency + '. You will be contacted with the outcome.') } catch (e) { toast('Could not lodge the appeal, please try again.', 'err') } setBusy(false) }
  if (done) return <div className="note" style={{ marginTop: 12 }}>Your appeal has been lodged with {agency}. You will be contacted with the outcome.</div>
  return (
    <div style={{ marginTop: 12 }}>
      {!open && <button className="btn sm" onClick={() => setOpen(true)}>{label || 'Lodge an appeal'}</button>}
      {open && (
        <div className="card">
          <div className="kicker" style={{ color: 'var(--green)' }}>Lodge an appeal to {agency}</div>
          <div className="field"><label>Reason for appeal</label><textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Explain why you believe this decision should be reviewed" /></div>
          <div className="row-between"><button className="btn ghost sm" onClick={() => setOpen(false)}>Cancel</button><button className="btn p sm" onClick={submit} disabled={busy || !reason.trim()}>{busy ? 'Submitting...' : 'Submit appeal'}</button></div>
        </div>
      )}
    </div>
  )
}


export function AppealsList({ agency }) {
  const [rows, setRows] = useState(null)
  useEffect(() => { load() /* eslint-disable-next-line */ }, [])
  async function load() { setRows(await store.listAppeals(agency)) }
  async function resolve(a, status) { await store.resolveAppeal(a.id, status === 'Upheld' ? 'Appeal upheld, decision reversed' : 'Appeal declined, decision stands', status); load() }
  if (!rows) return null
  return (
    <div style={{ marginTop: 26 }}>
      <h3 className="serif" style={{ fontSize: 18, marginBottom: 4 }}>Appeals</h3>
      <p className="muted" style={{ marginTop: 0, fontSize: 13, marginBottom: 12 }}>Appeals lodged for {agency} review, from food handlers, employers and laboratories.</p>
      {rows.length === 0 && <div className="placeholder">No appeals lodged.</div>}
      {rows.map((a, i) => (
        <div className="ord" key={a.id || i} style={{ marginBottom: 10 }}>
          <div className="top"><div><b>{a.subject}</b> <span className="muted" style={{ fontSize: 12 }}>· {a.kind} · {a.appellant}</span></div><span className="badge" style={a.status === 'Open' ? { background: '#fdf3e0', color: '#8a5a00' } : { background: 'var(--green-pale)', color: 'var(--green)' }}>{a.status}</span></div>
          <div className="muted" style={{ fontSize: 13.5, marginTop: 6 }}>{a.reason}</div>
          {a.status === 'Open' && <div className="row-between" style={{ marginTop: 10 }}><button className="btn sm" onClick={() => resolve(a, 'Declined')}>Decline</button><button className="btn p sm" onClick={() => resolve(a, 'Upheld')}>Uphold appeal</button></div>}
          {a.resolution && <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>Outcome: {a.resolution}</div>}
        </div>
      ))}
    </div>
  )
}

