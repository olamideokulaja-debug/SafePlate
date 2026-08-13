// Officer portal: field verification, inspections, water sampling, offline sync.
// Lazy-loaded chunk (refactor item 1).
/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import { useState, useEffect, useMemo } from 'react'
import { smatch, timeAgo } from '../lib/helpers.ts'
import { store, labsView, OFFLINE } from '../lib/store.ts'
import { LAGOS_LGAS, SANCTION_LADDER, SANCTION_SEVERE } from '../lib/constants.ts'
import { t } from '../lib/i18n.ts'
import { toast } from '../lib/toast.ts'
import { compressImage } from '../lib/image.ts'
import { Seal, CrossSeal } from '../components/Seals.tsx'
import QrScanner from '../components/QrScanner.tsx'
import SearchBar from '../components/SearchBar.tsx'

function OfficerProgress({ session }) {
  const [rows, setRows] = useState(null)
  useEffect(() => { store.listInspections(session.agency, session.email).then(setRows).catch(() => setRows([])) /* eslint-disable-next-line */ }, [])
  if (!rows) return null
  const target = Number(session.target) || 20
  const now = new Date()
  const thisMonth = rows.filter(r => { const d = new Date(r.ts); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() })
  const done = thisMonth.filter(r => r.kind === 'inspection').length
  const pct = Math.min(100, Math.round((done / target) * 100))
  const met = done >= target
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="row-between" style={{ alignItems: 'baseline' }}>
        <div>
          <div className="kicker" style={{ color: 'var(--accent, var(--green))' }}>Your target this month</div>
          <div style={{ fontFamily: 'Lora,serif', fontSize: 20 }}>{done} of {target} inspections</div>
        </div>
        <span className="badge" style={met ? { background: '#e7f4ec', color: '#0a6b39' } : { background: '#fdf1dd', color: '#9a6200' }}>{met ? 'Target met' : (target - done) + ' to go'}</span>
      </div>
      <div className="bartrack" style={{ marginTop: 12, height: 12 }}><span className="barfill" style={{ width: pct + '%', background: met ? 'var(--green)' : 'var(--gold)' }} /></div>
      <div className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>{thisMonth.filter(r => r.kind === 'verify').length} certificate checks and {thisMonth.filter(r => r.kind === 'water').length} water samples also logged this month.</div>
    </div>
  )
}


function OfflineBar({ session }) {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine !== false)
  const [pending, setPending] = useState(OFFLINE.queue().length)
  const [warm, setWarm] = useState(OFFLINE.get('warmedAt'))
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const up = () => setOnline(true), down = () => setOnline(false)
    window.addEventListener('online', up); window.addEventListener('offline', down)
    const t = setInterval(() => setPending(OFFLINE.queue().length), 2500)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); clearInterval(t) }
  }, [])
  useEffect(() => { if (online) { sync() } /* eslint-disable-next-line */ }, [online])
  async function sync() {
    if (busy) return
    setBusy(true)
    try {
      const res = await store.syncOutbox()
      if (res && res.sent) toast('Synced ' + res.sent + ' offline record' + (res.sent === 1 ? '' : 's') + '.')
      if (res && res.failed) toast(res.failed + ' record' + (res.failed === 1 ? '' : 's') + ' could not sync and will be retried.', 'warn')
      const w = await store.warmOfflineCache(session)
      if (w) setWarm(new Date().toISOString())
    } catch (e) { /* stay quiet, retried on next reconnect */ }
    setPending(OFFLINE.queue().length)
    setBusy(false)
  }
  if (online && !pending) return (
    <div className="note" style={{ marginBottom: 14, fontSize: 13 }}>
      Working online. {warm ? 'Your offline copy was last refreshed ' + timeAgo(warm) + '.' : 'Preparing your offline copy...'}
      <button className="btn sm" style={{ marginLeft: 10 }} onClick={sync} disabled={busy}>{busy ? 'Refreshing...' : 'Refresh offline copy'}</button>
    </div>
  )
  return (
    <div className="note" style={{ marginBottom: 14, borderColor: online ? 'var(--gold)' : '#b3261e', background: online ? '#fdf8ee' : '#fdeeee' }}>
      <b>{online ? 'Back online' : 'Working offline'}.</b>{' '}
      {online
        ? (pending ? pending + ' record' + (pending === 1 ? '' : 's') + ' waiting to sync.' : 'Everything is synced.')
        : 'Inspections and checks you record now are saved on this device and will sync when you have signal.'}
      {online && pending > 0 && <button className="btn p sm" style={{ marginLeft: 10 }} onClick={sync} disabled={busy}>{busy ? 'Syncing...' : 'Sync now'}</button>}
      {!online && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{pending > 0 ? pending + ' record' + (pending === 1 ? '' : 's') + ' saved on this device. ' : ''}Certificate checks use the copy stored on this device, so a handler who is not in that copy cannot be checked until you have signal.</div>}
    </div>
  )
}


function OfficerModule({ session, tab }) {
  const status = session.status || 'Active'
  if (status !== 'Active') return (
    <div className="page"><div className="wrap">
      <div className="card" style={{ textAlign: 'center', maxWidth: 520, margin: '0 auto' }}>
        <div className="kicker" style={{ color: 'var(--gold-deep)' }}>Awaiting approval</div>
        <h3 className="serif" style={{ fontSize: 22 }}>Your officer account is pending</h3>
        <p className="muted">Your {session.agency} administrator needs to approve your account and assign your badge and area before you can begin field work. You will be notified once approved.</p>
      </div>
    </div></div>
  )
  return (
    <div className="page"><div className="wrap">
      <div className="greeting"><h2 className="sec serif" style={{ margin: 0 }}>{session.agency} field officer</h2><span className="muted" style={{ fontSize: 13 }}>{session.name}{session.badge ? ' · ' + session.badge : ''}{session.lga ? ' · ' + session.lga : ''}</span></div>
      <OfflineBar session={session} />
      {(tab === 'field' || tab === 'activity') && <OfficerProgress session={session} />}
      {tab === 'field' && <OfficerField session={session} />}
      {tab === 'inspect' && <OfficerInspect session={session} />}
      {tab === 'water' && <OfficerWater session={session} />}
      {tab === 'activity' && <OfficerActivity session={session} />}
    </div></div>
  )
}


function OfficerField({ session }) {
  const [id, setId] = useState('')
  const [res, setRes] = useState(undefined)
  const [busy, setBusy] = useState(false)
  const [scan, setScan] = useState(false)
  async function check(value) {
    const q = (value ?? id).trim()
    if (!q) return; setId(q); setBusy(true)
    const r = await store.verifyCertificate(q)
    setRes(r || null)
    try { await store.createInspection({ officer: session.name, officerEmail: session.email, agency: session.agency, kind: 'verify', subject: q.toUpperCase(), outcome: r ? r.status : 'Not found' }) } catch (e) { /* ignore */ }
    setBusy(false); toast('Field check logged.')
  }
  return (
    <div>
      <div className="note" style={{ marginBottom: 16 }}>Verify a food handler certificate on the spot. Every check is logged to the audit trail under your badge.</div>
      <div className="field" style={{ maxWidth: 380 }}><label>SAFEPLATE ID</label><input value={id} onChange={e => setId(e.target.value)} placeholder="SP-LG-YYYYNNNNN" onKeyDown={e => e.key === 'Enter' && check()} /></div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn p sm" onClick={() => check()} disabled={busy}>{busy ? 'Checking...' : 'Check certificate'}</button>
        <button className="btn sm" onClick={() => setScan(v => !v)}>{scan ? 'Close camera' : 'Scan QR code'}</button>
      </div>
      {scan && <div style={{ maxWidth: 420 }}><QrScanner onClose={() => setScan(false)} onFound={code => { setScan(false); check(code) }} /></div>}
      {res === null && <div className="err" style={{ marginTop: 14 }}>No certificate found for that ID. The handler may be unregistered.</div>}
      {res && (
        <div className={'trust ' + (res.status === 'VALID' ? 'ok' : 'no')} style={{ marginTop: 16 }}>
          <div className="seal-wrap">{res.status === 'VALID' ? <Seal size={92} /> : <CrossSeal size={92} />}</div>
          <div className="who2" style={{ flex: 1, minWidth: 180 }}>
            <span className={'badge ' + res.status}>{res.status}</span>
            <b style={{ marginTop: 8 }}>{res.name}</b>
            <div className="mono" style={{ fontSize: 13, color: 'var(--muted)' }}>{res.safeplateId || res.safeplate_id}</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>Expires {new Date(res.expiry || res.expiry_date).toLocaleDateString('en-GB')}</div>
          </div>
          {res.photo && <img src={res.photo} alt="" style={{ width: 90, height: 106, objectFit: 'cover', borderRadius: 10, border: '2px solid var(--line)' }} />}
        </div>
      )}
    </div>
  )
}


function OfficerInspect({ session }) {
  const [targets, setTargets] = useState([])
  const [open, setOpen] = useState(null)
  const [outcome, setOutcome] = useState('Compliant')
  const [sanction, setSanction] = useState('')
  const [note, setNote] = useState('')
  const [photos, setPhotos] = useState([])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  async function addPhotos(files) {
    const list = Array.from(files || []).slice(0, 4 - photos.length)
    for (const f of list) {
      try { const d = await compressImage(f, 220); setPhotos(p => (p.length >= 4 ? p : [...p, d])) }
      catch (e) { toast('Could not read that photograph.', 'err') }
    }
  }
  const lab = session.agency === 'HEFAMAA'
  useEffect(() => { load() /* eslint-disable-next-line */ }, [])
  async function load() { setTargets(lab ? labsView() : await store.listEstablishments()) }
  async function submit(tgt) {
    const name = tgt.name
    setBusy(true)
    const pics = photos.filter(Boolean)
    try {
      await store.createInspection({ officer: session.name, officerEmail: session.email, agency: session.agency, kind: 'inspection', subject: name, outcome, note, photos: pics })
      // An inspection is what turns a self-registered premises into a verified
      // one, and it closes any open complaint marker on that establishment.
      if (!lab && (tgt.verified === false || tgt.underReview)) {
        try { await store.updateEstablishment(tgt.id, { verified: true, underReview: false, compliance: outcome }) } catch (e) { /* non-blocking */ }
      }
      if (sanction) {
        if (SANCTION_SEVERE.includes(sanction)) {
          await store.createInspection({ officer: session.name, officerEmail: session.email, agency: session.agency, kind: 'sanction', subject: name, sanction, sanctionStatus: 'Recommended', note, targetId: tgt.id, photos: pics })
          toast(sanction + ' recommended, sent to your supervisor for approval.', 'warn')
        } else {
          if (!lab) await store.updateEstablishment(tgt.id, { sanction, appeal: null })
          await store.createInspection({ officer: session.name, officerEmail: session.email, agency: session.agency, kind: 'sanction', subject: name, sanction, sanctionStatus: 'Applied', targetId: tgt.id, photos: pics })
          toast(sanction + ' applied.', 'warn')
        }
      } else { toast('Inspection recorded for ' + name + '.') }
      setOpen(null); setOutcome('Compliant'); setSanction(''); setNote(''); setPhotos([]); load()
    } catch (e) { toast('Could not save the inspection: ' + (e.message || 'try again'), 'err') }
    setBusy(false)
  }
  return (
    <div>
      <div className="note" style={{ marginBottom: 16 }}>Record an inspection of {lab ? 'a laboratory' : 'an establishment'}. A warning applies immediately; a fine, closure or licence action is sent to your supervisor for approval.</div>
      <SearchBar value={q} onChange={setQ} placeholder={lab ? 'Search laboratories...' : 'Search establishments by name or LGA...'} />
      {targets.filter(x => smatch(q, x.name, x.lga || x.area, x.compliance)).length === 0 && <div className="placeholder">No {lab ? 'laboratories' : 'establishments'} match your search.</div>}
      {targets.filter(x => smatch(q, x.name, x.lga || x.area, x.compliance)).sort((a, b) => (b.assignedTo === session.email ? 1 : 0) - (a.assignedTo === session.email ? 1 : 0)).map(tgt => (
        <div className="ord" key={tgt.id} style={tgt.assignedTo === session.email ? { borderColor: 'var(--green)' } : undefined}>
          {tgt.assignedTo === session.email && <span className="badge" style={{ background: '#e7f4ec', color: '#0a6b39', marginBottom: 8 }}>Assigned to you</span>}
          <div className="top"><div><b style={{ fontFamily: 'Lora,serif', fontSize: 16 }}>{tgt.name}</b><div className="muted" style={{ fontSize: 12.5 }}>{(tgt.lga || tgt.area || '')}{tgt.compliance ? ' · ' + tgt.compliance : ''}{tgt.sanction ? ' · ' + tgt.sanction : ''}</div></div>{open !== tgt.id && <button className="btn sm" onClick={() => setOpen(tgt.id)}>Inspect</button>}</div>
          {open === tgt.id && (
            <div style={{ marginTop: 12 }}>
              <div className="field"><label>Outcome</label><select value={outcome} onChange={e => setOutcome(e.target.value)}><option>Compliant</option><option>Minor issues</option><option>Major issues</option></select></div>
              <div className="field"><label>Sanction (optional)</label><select value={sanction} onChange={e => setSanction(e.target.value)}><option value="">None</option>{SANCTION_LADDER.map(x => <option key={x} value={x}>{x}{SANCTION_SEVERE.includes(x) ? ' (needs approval)' : ''}</option>)}</select></div>
              <div className="field"><label>Note</label><textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="What did you observe?" /></div>
              <div className="field">
                <label>Inspection photographs (up to 4)</label>
                <input type="file" accept="image/*" capture="environment" multiple onChange={e => { addPhotos(e.target.files); e.target.value = '' }} />
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Attach evidence from the site. Photographs are stored on the inspection record and visible to your supervisor.</div>
                {photos.filter(Boolean).length > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    {photos.filter(Boolean).map((src, i) => (
                      <div key={i} style={{ position: 'relative' }}>
                        <img src={src} alt={'Inspection photo ' + (i + 1)} style={{ width: 74, height: 74, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)', display: 'block' }} />
                        <button onClick={() => setPhotos(p => p.filter((_, j) => j !== i))} aria-label="Remove photo" style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', border: '1px solid var(--line)', background: '#fff', cursor: 'pointer', lineHeight: 1, fontSize: 12 }}>x</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="row-between"><button className="btn ghost sm" onClick={() => { setOpen(null); setPhotos([]) }}>Cancel</button><button className="btn p sm" onClick={() => submit(tgt)} disabled={busy}>{busy ? 'Saving...' : 'Submit inspection'}</button></div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}


function OfficerWater({ session }) {
  const [f, setF] = useState({ facility: '', lga: '', source: 'Borehole', contact: '' })
  const [done, setDone] = useState('')
  async function submit() {
    if (!f.facility.trim()) return
    const swid = 'SP-W-LG-' + new Date().getFullYear() + String(Math.floor(Math.random() * 900000) + 100000)
    await store.createWaterTest({ swid, facility: f.facility, lga: f.lga, source: f.source, officer: session.name, contact: f.contact, lab: 'Pending assignment', amount: 65000, status: 'Submitted, pending LASEPA', ownerEmail: 'field', ts: new Date().toISOString() })
    await store.createInspection({ officer: session.name, officerEmail: session.email, agency: 'LASEPA', kind: 'water', subject: f.facility, outcome: 'Sample collected' })
    setDone(swid); setF({ facility: '', lga: '', source: 'Borehole', contact: '' }); toast('Water sample submitted for testing.')
  }
  return (
    <div>
      <div className="note" style={{ marginBottom: 16 }}>Log a water sample collected in the field. It enters the LASEPA water queue for laboratory testing.</div>
      {done && <div className="ord" style={{ marginBottom: 14 }}><b>Sample submitted</b><div className="mono" style={{ fontSize: 13, color: 'var(--muted)' }}>{done}</div></div>}
      <div className="card">
        <div className="field"><label>Facility name</label><input value={f.facility} onChange={e => setF({ ...f, facility: e.target.value })} placeholder="e.g. Grill House, Lekki" /></div>
        <div className="field"><label>LGA</label><select value={f.lga} onChange={e => setF({ ...f, lga: e.target.value })}><option value="">Select LGA</option>{LAGOS_LGAS.map(l => <option key={l}>{l}</option>)}</select></div>
        <div className="field"><label>Water source</label><select value={f.source} onChange={e => setF({ ...f, source: e.target.value })}><option>Borehole</option><option>Public mains</option><option>Water vendor</option></select></div>
        <div className="field"><label>Facility contact</label><input value={f.contact} onChange={e => setF({ ...f, contact: e.target.value })} placeholder="080..." /></div>
        <button className="btn p sm" onClick={submit} disabled={!f.facility.trim()}>Submit sample for testing</button>
      </div>
    </div>
  )
}


function OfficerActivity({ session }) {
  const [rows, setRows] = useState(null)
  useEffect(() => { store.listInspections(session.agency, session.email).then(setRows) /* eslint-disable-next-line */ }, [])
  if (!rows) return <div className="skelrow"><div className="skel" style={{ height: 60 }} /><div className="skel" style={{ height: 60 }} /></div>
  if (!rows.length) return <div className="placeholder">No field activity logged yet. Your checks, inspections and samples will appear here.</div>
  return (
    <div>
      <div className="note" style={{ marginBottom: 16 }}>Your logged field checks, inspections and samples.</div>
      {rows.map((r, i) => (
        <div className="ord" key={r.id || i}>
          <div className="top"><div><b>{r.subject}</b> <span className="muted" style={{ fontSize: 12 }}>· {r.kind}{r.outcome ? ' · ' + r.outcome : ''}{r.sanction ? ' · ' + r.sanction : ''}</span></div><span className="muted" style={{ fontSize: 12 }}>{r.ts ? new Date(r.ts).toLocaleString('en-GB') : ''}</span></div>
          {r.note && <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{r.note}</div>}
          {Array.isArray(r.photos) && r.photos.length > 0 && <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>{r.photos.map((src, k) => <img key={k} src={src} alt="" style={{ width: 58, height: 58, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line)' }} />)}</div>}
          {r.sanctionStatus && <span className="badge" style={{ marginTop: 8, background: (r.sanctionStatus === 'Applied' || r.sanctionStatus === 'Approved') ? '#e7f4ec' : '#fdf1dd', color: (r.sanctionStatus === 'Applied' || r.sanctionStatus === 'Approved') ? '#0a6b39' : '#9a6200' }}>{r.sanctionStatus}</span>}
        </div>
      ))}
    </div>
  )
}


export default OfficerModule
