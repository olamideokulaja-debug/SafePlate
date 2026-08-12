// Employer portal: premises registration, team enrolment/testing, water tests.
// Lazy-loaded chunk (refactor item 1).
/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import { useState, useEffect, useMemo } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { store, labsView } from '../lib/store.ts'
import { naira, FEE, WATER_FEE, MANDATORY_TESTS, LAGOS_LGAS, WEEKDAYS, STAFF_STATUSES } from '../lib/constants.ts'
import { WATER_SOURCES, makeWaterId } from '../lib/water.ts'
import { t } from '../lib/i18n.ts'
import { toast } from '../lib/toast.ts'
import { AppealButton } from '../components/Appeals.tsx'
import Insights from '../components/Insights.tsx'
import LabAvailability from '../components/LabAvailability.tsx'

function EmployerModule({ session, tab }) {
  if (tab === 'water') return <EmployerWater session={session} />
  if (tab === 'premises') return <EmployerPremises session={session} />
  return <EmployerTeam session={session} />
}


function EmployerPremises({ session }) {
  const [rows, setRows] = useState([])
  const [f, setF] = useState({ name: '', lga: '', address: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  useEffect(() => { load() /* eslint-disable-next-line */ }, [])
  async function load() { try { const all = await store.listEstablishments(); setRows(all.filter(e => e.registeredBy === session.email)) } catch (e) { setRows([]) } }
  async function submit() {
    setMsg('')
    if (f.name.trim().length < 3) { setMsg('Enter the name of your establishment.'); return }
    if (!f.lga) { setMsg('Select the LGA where the establishment operates.'); return }
    setBusy(true)
    try {
      await store.createEstablishment({ name: f.name.trim(), lga: f.lga, verified: false, registeredBy: session.email, compliance: 'Not yet inspected' })
      toast('Premises registered. It stays unverified until an officer inspects it.')
      setF({ name: '', lga: '', address: '' }); load()
    } catch (e) { setMsg('Could not register the premises: ' + (e.message || 'please try again.')) }
    setBusy(false)
  }
  return (
    <div className="page"><div className="wrap">
      <div className="greeting"><h2 className="sec serif" style={{ margin: 0 }}>Your premises</h2><span className="muted" style={{ fontSize: 13 }}>{session.name}</span></div>
      <div className="note" style={{ marginBottom: 16 }}>Register each place you operate so it appears on the Lagos State register. A premises you register yourself is marked Unverified until an officer has inspected it, so it cannot be presented as an inspection record.</div>
      <div className="card" style={{ marginBottom: 18 }}>
        <h3 className="serif" style={{ fontSize: 17, marginTop: 0 }}>Register a premises</h3>
        <div className="field"><label>Establishment name</label><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="e.g. Mama Nkechi Kitchen" /></div>
        <div className="field"><label>LGA</label><select value={f.lga} onChange={e => setF({ ...f, lga: e.target.value })}><option value="">Select LGA</option>{LAGOS_LGAS.map(l => <option key={l}>{l}</option>)}</select></div>
        <div className="field"><label>Street address</label><input value={f.address} onChange={e => setF({ ...f, address: e.target.value })} placeholder="Street and area" /></div>
        {msg && <div className="err" style={{ marginBottom: 10 }}>{msg}</div>}
        <button className="btn p" onClick={submit} disabled={busy}>{busy ? 'Registering...' : 'Register premises'}</button>
      </div>
      <h3 className="serif" style={{ fontSize: 17 }}>Registered premises</h3>
      {rows.length === 0 && <div className="placeholder">You have not registered any premises yet. Add one above so inspectors can find you on the register.</div>}
      {rows.map(e => (
        <div className="ord" key={e.id}>
          <div className="top"><div><b style={{ fontFamily: 'Lora,serif', fontSize: 16 }}>{e.name}</b><div className="muted" style={{ fontSize: 12.5 }}>{e.lga} · {e.compliance || 'Not yet inspected'}</div></div>
            {e.verified ? <span className="badge" style={{ background: '#e7f4ec', color: '#0a6b39' }}>Verified</span> : <span className="badge" style={{ background: '#fdf1dd', color: '#9a6200' }}>Unverified</span>}
          </div>
        </div>
      ))}
    </div></div>
  )
}


function EmployerTeam({ session }) {
  const [biz, setBiz] = useState(undefined)
  const [name, setName] = useState('')
  const [lga, setLga] = useState('')
  const [sName, setSName] = useState('')
  const [sPhone, setSPhone] = useState('')
  const [msgErr, setMsgErr] = useState(false)
  const [labs, setLabs] = useState([])
  const [labId, setLabId] = useState('')
  const [avail, setAvail] = useState(null)
  const [appt, setAppt] = useState({ date: '', slot: '' })
  useEffect(() => { store.accreditedLabList().then(l => { setLabs(l); if (l.length && !labId) pickLab(l[0].id, l) }).catch(() => {}) /* eslint-disable-next-line */ }, [])
  async function pickLab(id, list) {
    setLabId(id); setAppt({ date: '', slot: '' }); setAvail(null)
    try { const a = await store.getLabAvailability(id); setAvail(a && a.days && Object.keys(a.days).length ? a : null) } catch (e) { setAvail(null) }
  }
  function bookableDates() {
    if (!avail || !avail.days) return []
    const out = []
    for (let i = 1; i <= 21; i++) {
      const d = new Date(); d.setDate(d.getDate() + i)
      const nm = WEEKDAYS[(d.getDay() + 6) % 7]
      if ((avail.days[nm] || []).length) out.push({ iso: d.toISOString().slice(0, 10), label: d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }), day: nm })
    }
    return out
  }
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function load() {
    const b = await store.getBusiness(session.email) || null
    // Reflect Ministry approvals on the employer view: refresh each enrolled
    // member's status from their live certificate / order rather than the value
    // frozen at enrolment.
    if (b && Array.isArray(b.staff) && b.staff.some(x => x.safeplateId)) {
      let changed = false
      await Promise.all(b.staff.map(async x => {
        if (!x.safeplateId) return
        try {
          const cert = await store.verifyCertificate(x.safeplateId)
          if (cert && cert.status === 'VALID') { if (x.status !== 'Certified') { x.status = 'Certified'; changed = true } return }
          if (cert && cert.status === 'EXPIRED') { if (x.status !== 'Expired') { x.status = 'Expired'; changed = true } return }
          const order = await store.getOrderFor(x.safeplateId)
          if (order) {
            let st = x.status
            if (order.status === 'Submitted') st = 'Awaiting Ministry review'
            else if (order.status === 'Approved') st = 'Certified'
            else if (order.status === 'Rejected') st = 'Referred, retest needed'
            else if (order.status === 'Flagged') st = 'Under review'
            else if (/Collected|Testing|Scheduled/.test(order.status || '')) st = 'In testing'
            if (st !== x.status) { x.status = st; changed = true }
          }
        } catch (e) { /* ignore per-member errors */ }
      }))
      if (changed) { try { await store.saveBusiness(session.email, b) } catch (e) { /* ignore */ } }
    }
    setBiz(b)
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [])

  async function create() {
    if (!name.trim()) return
    const b = { name: name.trim(), lga: lga.trim(), staff: [] }
    await store.saveBusiness(session.email, b); setBiz(b)
  }
  async function addStaff() {
    if (!sName.trim() || !sPhone.trim()) return
    if (!/^0\d{10}$/.test(sPhone.replace(/\s+/g, ''))) { setMsgErr(true); setMsg('Enter a valid 11-digit phone number for the staff member, e.g. 08031234567.'); return }
    const b = { ...biz, staff: [...biz.staff, { id: 'S' + Date.now(), name: sName.trim(), phone: sPhone.trim(), status: 'Not registered' }] }
    await store.saveBusiness(session.email, b); setBiz(b); setSName(''); setSPhone('')
  }
  async function bulkPay() {
    setBusy(true); setMsg(''); setMsgErr(false)
    const pending = biz.staff.filter(x => x.status === 'Not registered')
    if (!pending.length) { setMsgErr(true); setMsg('No unregistered staff to enrol.'); setBusy(false); return }
    const chosen = labs.find(l => l.id === labId)
    if (!chosen) { setMsgErr(true); setMsg('Choose the laboratory your team will attend.'); setBusy(false); return }
    const chosenLabName = chosen.name
    if (avail && (!appt.date || !appt.slot)) { setMsgErr(true); setMsg('Choose an appointment date and time slot at ' + chosenLabName + ' before paying.'); setBusy(false); return }
    try {
      if (SUPABASE_READY) {
        if (PAYSTACK_READY) { await payWithPaystack({ email: session.email, amountNaira: pending.length * FEE, reference: 'EMP-' + Date.now() }) }
        const res = await store.fn('bulk-enroll', { staff: pending.map(x => ({ name: x.name, phone: x.phone })), lab: chosenLabName, appointmentDate: appt.date || null, appointmentSlot: appt.slot || null, employer: session.email })
        const created = (res && res.created) || []
        created.forEach(c => { const m = biz.staff.find(x => x.status === 'Not registered' && x.name === c.name && x.phone === c.phone); if (m) { m.safeplateId = c.safeplateId; m.status = 'Pending results' } })
      } else {
        for (const x of pending) {
          const id = makeSafeplateId()
          await store.createOrder({ id: 'ORD-' + id.replace('SP-LG-', ''), safeplateId: id, handlerName: x.name, phone: x.phone, lab: chosenLabName, tests: MANDATORY_TESTS, status: 'Scheduled', appointmentDate: appt.date || null, appointmentSlot: appt.slot || null, createdAt: new Date().toISOString() })
          await store.createEscrow({ safeplateId: id, name: x.name, lab: chosenLabName, amount: FEE, status: 'HELD', type: 'FOOD', ts: new Date().toISOString() })
          x.safeplateId = id; x.status = 'Pending results'
        }
      }
      const b = { ...biz }; await store.saveBusiness(session.email, b); setBiz(b)
      setMsgErr(false); setMsg('Enrolled and paid for ' + pending.length + ' staff, ' + naira(pending.length * FEE) + ' into escrow.')
      toast('Enrolled ' + pending.length + ' staff into testing.')
    } catch (e) {
      setMsgErr(true); setMsg('Could not complete enrolment: ' + (e.message || 'please try again.'))
      toast('Enrolment could not complete.', 'err')
    }
    setBusy(false)
  }
  async function bulkAddCsv(file) {
    setMsg('')
    let text = ''
    try { text = await file.text() } catch (e) { setMsgErr(true); setMsg('Could not read that file.'); return }
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    const rows = []
    for (const line of lines) {
      const parts = line.split(',').map(x => x.trim())
      if (!parts[0] || !parts[1]) continue
      if (/^(full ?)?name$/i.test(parts[0])) continue
      rows.push({ id: 'S' + Date.now() + Math.floor(Math.random() * 100000), name: parts[0], phone: parts[1], email: parts[2] || '', status: 'Not registered' })
    }
    if (!rows.length) { setMsgErr(true); setMsg('No valid rows found. Use columns: name, phone, email (optional).'); return }
    const b = { ...biz, staff: [...biz.staff, ...rows] }
    await store.saveBusiness(session.email, b); setBiz(b)
    setMsgErr(false); setMsg('Added ' + rows.length + ' staff from file. Use Register and bulk-pay below to enrol them.')
  }
  function downloadTemplate() {
    const csv = 'name,phone,email\nAdaeze Nwosu,08031110001,ada@example.com\nBode Adekunle,08031110002,\n'
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'safeplate-staff-template.csv'; a.click()
  }

  if (biz === undefined) return <div className="page"><div className="wrap"><p className="muted">Loading...</p></div></div>

  if (biz === null) {
    return (
      <div className="page"><div className="wrap center-narrow">
        <div className="kicker">Employer</div>
        <h2 className="sec serif">Register your establishment</h2>
        <p className="sub">Set up your business once, then add and manage your team's compliance.</p>
        <div className="card">
          <div className="field"><label>Business name</label><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Grill House" /></div>
          <div className="field"><label>LGA</label><input value={lga} onChange={e => setLga(e.target.value)} placeholder="e.g. Lekki" /></div>
          <button className="btn p block" onClick={create} disabled={!name.trim()}>Create establishment</button>
        </div>
      </div></div>
    )
  }

  const counts = biz.staff.reduce((a, s) => { a[s.status] = (a[s.status] || 0) + 1; return a }, {})
  const pendingCount = biz.staff.filter(s => s.status === 'Not registered').length

  return (
    <div className="page"><div className="wrap">
      <div className="greeting"><h2 className="sec serif" style={{ margin: 0 }}>{biz.name}</h2><span className="muted" style={{ fontSize: 13 }}>{biz.lga} · {session.name}</span></div>
      <div className="tiles">
        <div className="tile"><div className="v">{biz.staff.length}</div><div className="k">Team size</div></div>
        <div className="tile"><div className="v">{counts['Certified'] || 0}</div><div className="k">Certified</div></div>
        <div className="tile"><div className="v">{counts['Pending results'] || 0}</div><div className="k">Pending</div></div>
        <div className="tile"><div className="v">{(counts['Overdue'] || 0) + (counts['Not registered'] || 0)}</div><div className="k">Action needed</div></div>
      </div>
      <div className="note" style={{ marginBottom: 18 }}>You see each member's compliance status only, never their medical results. A compliance digest is emailed weekly.</div>
      <Insights session={session} />

      {msg && <div className="note" style={{ background: msgErr ? '#fdeeee' : 'var(--green-pale)', borderColor: msgErr ? '#e6b5b0' : '#bcdcbc', marginBottom: 16 }}>{msg}</div>}

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 className="serif" style={{ margin: '0 0 12px', fontSize: 18 }}>Add a team member</h3>
        <div className="row-between" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 1, marginBottom: 0, minWidth: 160 }}><label>Name</label><input value={sName} onChange={e => setSName(e.target.value)} placeholder="Full name" /></div>
          <div className="field" style={{ flex: 1, marginBottom: 0, minWidth: 140 }}><label>Phone</label><input value={sPhone} onChange={e => setSPhone(e.target.value)} placeholder="080..." /></div>
          <button className="btn sm" onClick={addStaff}>Add</button>
        </div>
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
          <label className="muted" style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Or bulk-upload your whole team from a CSV (columns: name, phone, email optional)</label>
          <div className="row-between" style={{ alignItems: 'center' }}>
            <input type="file" accept=".csv,text/csv" onChange={e => { const f = e.target.files && e.target.files[0]; if (f) bulkAddCsv(f); e.target.value = '' }} />
            <button className="btn ghost sm" onClick={downloadTemplate}>Download template</button>
          </div>
        </div>
      </div>
      <AppealButton kind="establishment" subject={biz.name} agency="LASEPA" by={session.email} label="Appeal a sanction or compliance decision" />

      {pendingCount > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h3 className="serif" style={{ fontSize: 17, marginTop: 0 }}>Book testing for your team</h3>
          <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>Choose the laboratory your staff will attend and, where the laboratory publishes times, the appointment slot. Everyone in this batch is booked together.</p>
          <div className="field"><label>Laboratory</label>
            <select value={labId} onChange={e => pickLab(e.target.value, labs)}>
              {labs.length === 0 && <option value="">No accredited laboratories available</option>}
              {labs.map(l => <option key={l.id} value={l.id}>{l.name}{l.area ? ' (' + l.area + ')' : ''}</option>)}
            </select>
          </div>
          {avail ? (
            <>
              <div className="field"><label>Appointment date</label>
                <select value={appt.date} onChange={e => setAppt({ date: e.target.value, slot: '' })}>
                  <option value="">Select a date</option>
                  {bookableDates().map(d => <option key={d.iso} value={d.iso}>{d.label}</option>)}
                </select>
              </div>
              {appt.date && (() => {
                const chosen = bookableDates().find(d => d.iso === appt.date)
                const slots = chosen ? (avail.days[chosen.day] || []) : []
                return (
                  <div className="field"><label>Time slot</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {slots.map(sl => <button key={sl} className={'btn sm' + (appt.slot === sl ? ' p' : '')} onClick={() => setAppt(a => ({ ...a, slot: sl }))}>{sl}</button>)}
                    </div>
                  </div>
                )
              })()}
              {avail.note && <div className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>{avail.note}</div>}
            </>
          ) : labId ? <div className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>This laboratory has not published appointment times. Contact them directly to arrange when your team should attend.</div> : null}
          <div className="row-between" style={{ flexWrap: 'wrap', gap: 8 }}>
            <span className="muted" style={{ fontSize: 13.5 }}>{pendingCount} member{pendingCount === 1 ? '' : 's'} not yet registered.</span>
            <button className="btn p sm" onClick={bulkPay} disabled={busy}>{busy ? 'Processing...' : 'Register & bulk-pay ' + naira(pendingCount * FEE)}</button>
          </div>
        </div>
      )}

      {biz.staff.length === 0 && <div className="placeholder">No team members yet. Add your first above.</div>}
      {biz.staff.map(x => (
        <div className="ord" key={x.id}>
          <div className="top">
            <div><b style={{ fontFamily: 'Lora,serif', fontSize: 15 }}>{x.name}</b><div className="muted" style={{ fontSize: 12.5 }}>{x.phone}{x.safeplateId ? ' · ' + x.safeplateId : ''}</div></div>
            <span className={'pill ' + (STAFF_STATUSES[x.status] || 'no')}>{x.status}</span>
          </div>
        </div>
      ))}
    </div></div>
  )
}


function EmployerWater({ session }) {
  const [tests, setTests] = useState([])
  const [step, setStep] = useState('list') // list | form | lab | done
  const [f, setF] = useState({ facility: '', lga: '', source: WATER_SOURCES[0], officer: '', contact: '', lab: null, swid: '' })
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setF(o => ({ ...o, [k]: v }))
  const accreditedLabs = labsView().filter(l => l.accredited)

  async function load() { setTests(await store.listWaterTests(session.email)) }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [])

  function toLab() { if (!f.facility.trim() || !f.officer.trim()) return; setStep('lab') }
  async function pay(lab) {
    setBusy(true)
    const swid = makeWaterId()
    const escrowPayload = { safeplateId: swid, name: f.facility.trim(), lab: lab.name, amount: WATER_FEE, status: 'HELD', type: 'WATER', ts: new Date().toISOString() }
    let reference
    try { const rr = await payWithPaystack({ email: session.email, amountNaira: WATER_FEE, reference: 'SPW-' + swid }); reference = rr.reference } catch (e) { setBusy(false); return }
    if (PAYSTACK_READY) { const v = await fetch('/api/paystack-verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reference, safeplateId: swid, escrow: escrowPayload }) }); if (!v.ok) { setBusy(false); return } }
    await store.createWaterTest({ swid, facility: f.facility.trim(), lga: f.lga.trim(), source: f.source, officer: f.officer.trim(), contact: f.contact.trim(), lab: lab.name, amount: WATER_FEE, status: 'Submitted, pending LASEPA', results: { ph: '7.2', turbidity: '1.8 NTU', ecoli: '0 CFU/100ml' }, ownerEmail: session.email, ts: new Date().toISOString() })
    if (!SUPABASE_READY) await store.createEscrow(escrowPayload)
    await store.notify('LASEPA', 'Water result submitted', f.facility.trim() + ' pending LASEPA review')
    await store.dispatch(f.contact, 'sms', 'SafePlate: your ' + naira(WATER_FEE) + ' water test payment is confirmed for ' + f.facility.trim())
    set('swid', swid); setBusy(false); setStep('done'); load()
  }

  if (step === 'form') {
    return (
      <div className="page"><div className="wrap center-narrow">
        <button className="btn ghost" onClick={() => setStep('list')} style={{ paddingLeft: 0, marginBottom: 12 }}>&larr; Back</button>
        <div className="kicker">Water testing</div>
        <h2 className="sec serif">Register a facility for water testing</h2>
        <div className="card">
          <div className="field"><label>Facility name</label><input value={f.facility} onChange={e => set('facility', e.target.value)} placeholder="e.g. Grill House, Lekki" /></div>
          <div className="field"><label>LGA</label><input value={f.lga} onChange={e => set('lga', e.target.value)} placeholder="e.g. Lekki" /></div>
          <div className="field"><label>Water source</label><select value={f.source} onChange={e => set('source', e.target.value)}>{WATER_SOURCES.map(x => <option key={x}>{x}</option>)}</select></div>
          <div className="field"><label>Responsible officer</label><input value={f.officer} onChange={e => set('officer', e.target.value)} placeholder="Officer name" /></div>
          <div className="field"><label>Officer contact</label><input value={f.contact} onChange={e => set('contact', e.target.value)} placeholder="080..." /></div>
          <button className="btn p block" onClick={toLab} disabled={!f.facility.trim() || !f.officer.trim()}>Choose a laboratory</button>
        </div>
      </div></div>
    )
  }
  if (step === 'lab') {
    return (
      <div className="page"><div className="wrap center-narrow">
        <button className="btn ghost" onClick={() => setStep('form')} style={{ paddingLeft: 0, marginBottom: 12 }}>&larr; Back</button>
        <div className="kicker">Water testing</div>
        <h2 className="sec serif">Choose a LASEPA-accredited laboratory</h2>
        <p className="sub">{naira(WATER_FEE)} is paid into Sterling Bank escrow and released only after LASEPA approves the water result.</p>
        {accreditedLabs.map(l => (
          <button key={l.id} className="lab-row" onClick={() => pay(l)} disabled={busy}>
            <span><b style={{ fontFamily: 'Lora,serif' }}>{l.name}</b><div className="meta">{l.area} · results in {l.turnaround}</div></span>
            <span className="pill ok">{busy ? 'Processing...' : 'Pay ' + naira(WATER_FEE)}</span>
          </button>
        ))}
      </div></div>
    )
  }
  if (step === 'done') {
    return (
      <div className="page"><div className="wrap">
        <div className="ok-banner">
          <div className="kicker" style={{ color: 'var(--green)' }}>Escrow funded</div>
          <h3 className="serif" style={{ fontSize: 22, margin: '8px 0' }}>Facility registered and paid.</h3>
          <p className="muted" style={{ marginTop: 0 }}>SAFEPLATE-W ID <b>{f.swid}</b>. Results have been submitted for LASEPA review. Once approved, a Facility Water Quality Certificate is issued and becomes publicly verifiable.</p>
          <button className="btn p" onClick={() => setStep('list')}>Back to my facilities</button>
        </div>
      </div></div>
    )
  }

  return (
    <div className="page"><div className="wrap">
      <div className="greeting"><h2 className="sec serif" style={{ margin: 0 }}>Water testing</h2><button className="btn p sm" onClick={() => { setF({ facility: '', lga: '', source: WATER_SOURCES[0], officer: '', contact: '', lab: null, swid: '' }); setStep('form') }}>Register a facility</button></div>
      <div className="note" style={{ marginBottom: 18 }}>Potable water testing runs as a separate {naira(WATER_FEE)} workstream, approved by LASEPA, with an 80/10/5/5 waterfall.</div>
      {tests.length === 0 && <div className="placeholder">No facilities registered yet. Register one to begin.</div>}
      {tests.map(w => (
        <div className="ord" key={w.swid}>
          <div className="top">
            <div><b style={{ fontFamily: 'Lora,serif', fontSize: 16 }}>{w.facility}</b><div className="muted" style={{ fontSize: 12.5 }}>{w.swid} · {w.source} · {w.lab}</div></div>
            <span className={'status ' + (w.status === 'Certified' ? 'RELEASED' : w.status.indexOf('Flagged') === 0 ? 'Flag' : 'HELD')}>{w.status}</span>
          </div>
          {w.status === 'Certified' && w.certSeries && (
            <div className="row-between" style={{ marginTop: 10 }}>
              <span className="muted" style={{ fontSize: 12.5 }}>Certificate {w.certSeries}. Verify at #/verify/{w.swid}</span>
              <div style={{ background: '#fff', padding: 6, borderRadius: 8, border: '1px solid var(--line)' }}><QRCodeSVG value={window.location.origin + '/#/verify/' + w.swid} size={64} fgColor={PALETTE.navy} level="M" /></div>
            </div>
          )}
        </div>
      ))}
    </div></div>
  )
}


export default EmployerModule
