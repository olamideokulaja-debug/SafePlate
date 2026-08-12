// "Your data and privacy" panel (NDPA items 19-20).
//
// The privacy notice already promises the data subject rights of access,
// portability and erasure. This panel makes those promises actionable for a
// signed-in food handler: see the consent on record, download a portable copy of
// their data, and lodge an audited erasure request. Erasure is a request rather
// than an instant delete because certification and health records carry a
// statutory retention obligation, and the panel says so plainly.
/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import { useState } from 'react'
import { store } from '../lib/store.ts'
import { NDPA_CONSENT_VERSION } from '../lib/constants.ts'

export default function DataRights({ session, consent }: { session: any; consent?: any }) {
  const [busy, setBusy] = useState(false)
  const [erasure, setErasure] = useState<any>(null)
  const [confirming, setConfirming] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const consentGiven = consent?.given ?? consent?.consentGiven ?? true
  const consentAt = consent?.at || consent?.consentAt
  const consentVersion = consent?.version || consent?.consentVersion || NDPA_CONSENT_VERSION

  async function downloadData() {
    setBusy(true); setError('')
    try {
      const payload = await store.exportMyData(session)
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'safeplate-my-data-' + new Date().toISOString().slice(0, 10) + '.json'
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    } catch (e: any) {
      setError('Your data could not be prepared just now. Please try again.')
    }
    setBusy(false)
  }

  async function lodgeErasure() {
    setBusy(true); setError('')
    try {
      const out = await store.requestErasure(session, reason)
      setErasure(out); setConfirming(false)
    } catch (e: any) {
      setError('Your request could not be lodged just now. Please try again.')
    }
    setBusy(false)
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="kicker" style={{ color: 'var(--green)' }}>Your data and privacy</div>
      <h3 className="serif" style={{ fontSize: 18, margin: '4px 0 10px' }}>Rights under the Nigeria Data Protection Act</h3>

      <div className="note" style={{ marginBottom: 14, fontSize: 13.5 }}>
        {consentGiven
          ? <>You consented to SafePlate processing your personal and health data{consentAt ? <> on <b>{new Date(consentAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</b></> : ''} (consent version <span className="mono">{consentVersion}</span>). Certification decisions always involve a human reviewer.</>
          : <>We do not have a consent record on file for your account. If this looks wrong, please contact the Data Protection Officer.</>}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn" onClick={downloadData} disabled={busy}>
          {busy ? 'Preparing…' : 'Download my data'}
        </button>
        {!erasure && !confirming && (
          <button className="btn danger" onClick={() => setConfirming(true)} disabled={busy}>
            Request erasure
          </button>
        )}
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
        "Download my data" gives you a portable copy (portability). Test results are shown by status only, and your full National ID is masked, for your protection.
      </p>

      {confirming && (
        <div style={{ marginTop: 14, padding: 14, border: '1px solid var(--line)', borderRadius: 10, background: '#faf7f2' }}>
          <b style={{ fontSize: 14.5 }}>Request erasure of your record</b>
          <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            Because certification and health records are kept for a statutory
            public-health retention period, your request is sent to the Data
            Protection Officer to action rather than deleting your record
            immediately. You will keep a reference. While a valid certificate
            stands, erasure may be restricted by law, and the officer will explain
            any such restriction.
          </p>
          <div className="field">
            <label style={{ fontSize: 13 }}>Reason (optional)</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={2}
              placeholder="You do not have to give a reason."
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 10, fontSize: 14, fontFamily: 'inherit' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button className="btn" onClick={() => { setConfirming(false); setReason('') }} disabled={busy}>Cancel</button>
            <button className="btn danger" onClick={lodgeErasure} disabled={busy}>{busy ? 'Lodging…' : 'Lodge erasure request'}</button>
          </div>
        </div>
      )}

      {erasure && (
        <div className="ok-banner" style={{ marginTop: 14 }}>
          <div className="kicker" style={{ color: 'var(--green)' }}>Erasure request lodged</div>
          <p style={{ margin: '6px 0 0', fontSize: 14 }}>
            Your reference is <b className="mono">{erasure.reference}</b>. The Data
            Protection Officer will review it and contact you at your registered
            email. This request has been recorded in the audit trail.
          </p>
        </div>
      )}

      {error && <div className="err" style={{ marginTop: 12 }}>{error}</div>}
    </div>
  )
}
