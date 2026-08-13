// Food Handler portal: registration, testing journey, dashboard, lab booking.
// Lazy-loaded chunk (refactor item 1).
/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import { useState, useEffect, useMemo } from 'react'
import { WATERFALL } from '../lib/constants.ts'
import { makeSafeplateId, journeyStep, generateReceiptPDF } from '../lib/helpers.ts'
import { QRCodeSVG } from 'qrcode.react'
import { store, labsView } from '../lib/store.ts'
import { naira, FEE, MANDATORY_TESTS, LAGOS_LGAS, NDPA_CONSENT_VERSION, WEEKDAYS, DEFAULT_SLOTS, PALETTE, STEP_LABELS, isValidEmail, isValidPhone } from '../lib/constants.ts'
import { t } from '../lib/i18n.ts'
import { toast } from '../lib/toast.ts'
import { compressImage } from '../lib/image.ts'
import { PAYSTACK_READY, PAYSTACK_PUBLIC_KEY, SUPABASE_READY, payWithPaystack } from '../lib/config.ts'
import NavIcon from '../components/NavIcon.tsx'
import { AppealButton } from '../components/Appeals.tsx'
import LabAvailability from '../components/LabAvailability.tsx'
import DataRights from '../components/DataRights.tsx'
import { downloadCertReminder } from '../lib/calendar.ts'

function FoodDashboard({ data, session, onNew, onRenew }) {
  const { h, cert, order } = data
  const step = journeyStep(order, cert)
  const valid = cert && cert.status === 'VALID'
  const st = (order && order.status) || ''
  const issue = /Rejected|Flagged/.test(st)
  const days = cert && cert.expiry ? Math.ceil((new Date(cert.expiry).getTime() - Date.now()) / 86400000) : null
  return (
    <div className="page"><div className="wrap">
      <div className="greeting"><h2 className="sec serif" style={{ margin: 0 }}>Hello, {(h.name || '').split(' ')[0]}</h2><span className="muted" style={{ fontSize: 13 }}>{session.title}</span></div>
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="row-between">
          <div><div className="kicker" style={{ color: 'var(--green)' }}>Your SAFEPLATE ID</div><div className="mono" style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink)' }}>{h.safeplateId}</div></div>
          {valid ? <span className="badge VALID">CERTIFIED</span> : <span className="badge" style={{ background: issue ? '#fdeeee' : '#fdf3e0', color: issue ? '#b3261e' : '#8a5a00' }}>{issue ? st : 'IN PROGRESS'}</span>}
        </div>
      </div>
      <FoodJourney step={step} />
      {!valid && order && (() => {
        const started = order.createdAt || order.created_at
        if (!started) return null
        const base = new Date(started).getTime()
        const soon = new Date(base + (step >= 5 ? 3 : 2) * 86400000)
        const what = step >= 5 ? 'Ministry decision expected by' : 'Laboratory results expected by'
        const late = Date.now() > soon.getTime()
        return (
          <div className="note" style={{ marginBottom: 16, borderColor: late ? '#b3261e' : 'var(--line)' }}>
            {(order.appointmentDate || order.appointment_date) && step < 5 && <><b>Your appointment: {new Date(order.appointmentDate || order.appointment_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}{(order.appointmentSlot || order.appointment_slot) ? ', ' + (order.appointmentSlot || order.appointment_slot) : ''}</b>. </>}
            {what} <b>{soon.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</b>.
            {late ? ' This is now overdue and has been escalated to the Ministry for follow-up.' : ' Laboratories work to a 48-hour turnaround.'}
          </div>
        )
      })()}
      {valid && (
        <div className="card">
          <div className="row-between" style={{ alignItems: 'flex-start' }}>
            <div>
              <div className="kicker" style={{ color: 'var(--green)' }}>Certificate of Fitness</div>
              <h3 className="serif" style={{ fontSize: 20, margin: '4px 0' }}>{h.name}</h3>
              <div className="muted" style={{ fontSize: 13 }}>{cert.cert_no || cert.certNo || ''}</div>
              <div style={{ marginTop: 10, fontSize: 14 }}>Expires {new Date(cert.expiry).toLocaleDateString('en-GB')}</div>
              <div style={{ fontWeight: 700, color: days <= 30 ? '#b3261e' : 'var(--green)', marginTop: 2 }}>{days > 0 ? days + ' days remaining' : 'Expired, renew now'}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                <button className="btn g" onClick={() => generateCertPDF(cert)}>Download certificate (PDF)</button>
                {h.paymentRef && <button className="btn" onClick={() => generateReceiptPDF({ reference: h.paymentRef, safeplateId: h.safeplateId, name: h.name, lab: h.lab, paidAt: h.paidAt, amount: h.paidAmount || FEE, type: 'FOOD' })}>Payment receipt</button>}
                <button className="btn" onClick={() => downloadCertReminder(cert)}>Add renewal reminder to calendar</button>
              </div>
            </div>
            {(cert.photo || h.photo) && <img src={cert.photo || h.photo} alt="" style={{ width: 96, height: 112, objectFit: 'cover', borderRadius: 10, border: '2px solid var(--green)' }} />}
          </div>
        </div>
      )}
      {cert && days !== null && days <= 30 && (
        <div className="card" style={{ marginTop: 16, borderColor: days > 0 ? 'var(--gold)' : '#b3261e', borderWidth: 2 }}>
          <div className="row-between" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div className="kicker" style={{ color: days > 0 ? '#9a6200' : '#b3261e' }}>{days > 0 ? 'Renewal due' : 'Certificate expired'}</div>
              <h3 className="serif" style={{ fontSize: 18, margin: '4px 0' }}>{days > 0 ? 'Your certificate expires in ' + days + ' days' : 'Your certificate has expired'}</h3>
              <div className="muted" style={{ fontSize: 13 }}>Renewal repeats the full test panel and costs {naira(FEE)}. Your SAFEPLATE ID and details stay the same, so you only choose a laboratory and pay.</div>
            </div>
            <button className="btn p" onClick={onRenew}>Renew now</button>
          </div>
        </div>
      )}
      {issue && <AppealButton kind="result" subject={h.safeplateId} agency="LSMoH" by={session.email} label="Lodge an appeal on this result" />}
      {!valid && !issue && <div className="note" style={{ marginTop: 4 }}>Your test is progressing. Once the Ministry approves your result, your Certificate of Fitness appears here.</div>}
      <DataRights session={session} consent={{ given: h.consentGiven, at: h.consentAt, version: h.consentVersion }} />
      <button className="btn ghost sm" style={{ marginTop: 16 }} onClick={onNew}>Start a new registration</button>
    </div></div>
  )
}


function FoodHandlerModule({ session }) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({ name: session.name || '', phone: '', dob: '', gender: '', address: '', lga: '', nin: '', email: session.email || '', employer: '', employerAddress: '', photo: '', safeplateId: '', lab: null, paid: false })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const nextDue = useMemo(() => { const d = new Date(); d.setMonth(d.getMonth() + 6); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) }, [])
  const [checking, setChecking] = useState(true)
  const [mine, setMine] = useState(null)
  const [showWizard, setShowWizard] = useState(false)
  const [renewing, setRenewing] = useState(false)
  const [ninState, setNinState] = useState({ status: 'idle', name: '', reason: '' })
  const [ninOverride, setNinOverride] = useState(false)
  async function verifyNin() {
    const nin = (form.nin || '').replace(/\s+/g, '')
    if (!/^\d{11}$/.test(nin)) { setNinState({ status: 'error', reason: 'Enter your 11-digit NIN first.' }); return }
    setNinState({ status: 'checking', name: '', reason: '' })
    try {
      const r = await store.verifyNin(nin)
      if (r.ok) {
        // In demo mode there is no real name to compare; just mark verified.
        setNinState({ status: 'verified', name: r.fullName || '', reason: '' })
        if (r.fullName && !form.name) setF('name', r.fullName)
      } else {
        setNinState({ status: r.unavailable ? 'unavailable' : 'error', name: '', reason: r.reason || 'This NIN could not be verified.' })
      }
    } catch (e) { setNinState({ status: 'unavailable', name: '', reason: (e.message || 'Verification service is unreachable.') }) }
  }
  const draftKey = 'sp_draft_' + (session.email || 'anon')
  const [draft, setDraft] = useState(null)
  const [avail, setAvail] = useState(null)
  const [availMap, setAvailMap] = useState({})
  const [paymentRef, setPaymentRef] = useState('')
  const [paidStamp, setPaidStamp] = useState('')
  const [labs, setLabs] = useState(() => labsView())
  useEffect(() => { store.allLabs().then(setLabs).catch(() => {}) }, [])
  // Must come after `labs` is declared: a dependency array referencing a
  // const declared later in the component throws a temporal dead zone error
  // on every render, which blanks the whole portal.
  useEffect(() => {
    if (step !== 2 || !labs.length) return
    let cancelled = false
    Promise.all(labs.filter(l => l.accredited).map(async l => {
      try { const a = await store.getLabAvailability(l.id); return [l.id, a && a.days ? a : null] } catch (e) { return [l.id, null] }
    })).then(pairs => { if (!cancelled) setAvailMap(Object.fromEntries(pairs)) })
    return () => { cancelled = true }
    // eslint-disable-next-line
  }, [step, labs])
  function openDaysLabel(labId) {
    const a = availMap[labId]
    if (!a || !a.days) return null
    const names = WEEKDAYS.filter(d => (a.days[d] || []).length)
    if (!names.length) return null
    return names.map(d => d.slice(0, 3)).join(', ')
  }
  useEffect(() => {
    if (!showWizard || renewing || step === 0 || step >= 4) return
    try { localStorage.setItem(draftKey, JSON.stringify({ form, step, savedAt: Date.now() })) } catch (e) { /* storage unavailable */ }
  }, [form, step, showWizard, renewing, draftKey])
  useEffect(() => {
    try { const raw = localStorage.getItem(draftKey); if (raw) { const d = JSON.parse(raw); if (d && d.form && d.form.name) setDraft(d) } } catch (e) { /* ignore */ }
  }, [draftKey])
  function resumeDraft() { if (!draft) return; setForm(draft.form); setStep(draft.step || 1); setShowWizard(true); setDraft(null); toast('Registration resumed where you left off.') }
  function discardDraft() { try { localStorage.removeItem(draftKey) } catch (e) { /* ignore */ } setDraft(null) }
  useEffect(() => { (async () => { try { const hh = await store.getMyHandler(session); if (hh) { const cert = await store.verifyCertificate(hh.safeplateId); const order = await store.getOrderFor(hh.safeplateId); setMine({ h: hh, cert, order }) } } catch (e) { /* ignore */ } setChecking(false) })() /* eslint-disable-next-line */ }, [])

  async function register() {
    setErr('')
    if (!form.name.trim() || !form.phone.trim()) { setErr('Name and phone number are required to register.'); return }
    if (!form.dob || !form.gender || !form.lga) { setErr('Date of birth, gender and LGA are required.'); return }
    if (!/^0\d{10}$/.test((form.phone || '').replace(/\s+/g, ''))) { setErr('Enter a valid 11-digit phone number, e.g. 08031234567.'); return }
    if (form.email && !isValidEmail(form.email)) { setErr('That email address does not look valid. Check it, or leave it blank.'); return }
    if (!/^\d{11}$/.test((form.nin || '').replace(/\s+/g, ''))) { setErr('A valid 11-digit NIN is required.'); return }
    if (ninState.status !== 'verified' && !ninOverride) { setErr('Please verify your NIN with NIMC before continuing. Use the Verify button next to the NIN field.'); return }
    if (!form.photo) { setErr('A passport photo is required. It is printed on your certificate to prevent anyone else using it.'); return }
    if (!form.consent) { setErr('You must agree to the processing of your personal data before you can register. This is required by the Nigeria Data Protection Act.'); return }
    if (!/^0?\d{10,11}$/.test(form.phone.replace(/\s+/g, ''))) { setErr('Enter a valid Nigerian phone number.'); return }
    setBusy(true)
    try {
      if (await store.phoneExists(form.phone)) { setErr('An account already exists for this phone number. Recover it from the sign-in screen.'); setBusy(false); return }
      setF('safeplateId', makeSafeplateId()); setStep(1)
    } finally { setBusy(false) }
  }
  function chooseLab(lab) {
    if (!lab.accredited) { setErr('That laboratory is not currently accredited. Choose an accredited laboratory.'); return }
    setErr(''); setF('lab', lab); setStep(3)
    setAvail(null); setF('apptDate', ''); setF('apptSlot', '')
    store.getLabAvailability(lab.id).then(a => setAvail(a && a.days && Object.keys(a.days).length ? a : null)).catch(() => setAvail(null))
  }
  // Offer the next 21 days that fall on a day the laboratory actually opens.
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
  async function pay() {
    if (avail && (!form.apptDate || !form.apptSlot)) { setErr('Choose an appointment date and time slot before paying.'); return }
    setErr(''); setBusy(true)
    try {
      const escrowPayload = { safeplateId: form.safeplateId, name: form.name, lab: form.lab.name, amount: FEE, status: 'HELD', type: 'FOOD', ts: new Date().toISOString() }
      const { reference } = await payWithPaystack({ email: form.email, amountNaira: FEE, reference: 'SP-' + form.safeplateId + (renewing ? '-R' + Date.now().toString().slice(-5) : '') })
      const paidAt = new Date().toISOString()
      if (PAYSTACK_READY) { const v = await fetch('/api/paystack-verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reference, safeplateId: form.safeplateId, escrow: escrowPayload }) }); if (!v.ok) throw new Error('Payment verification failed') }
      const now = Date.now(), day = 86400000
      const certificate = { safeplateId: form.safeplateId, name: form.name, panel: MANDATORY_TESTS.join(', '), lab: form.lab.name, issued: null, expiry: new Date(now + 182 * day).toISOString(), status: 'PENDING_RESULTS' }
      await store.saveHandler({ ninVerified: ninState.status === 'verified', ninVerifiedAt: new Date().toISOString(), ninVerifiedBy: ninState.status === 'verified' ? 'NIMC' : (ninOverride ? 'Supervisor override' : null), consentGiven: true, consentAt: new Date().toISOString(), consentVersion: NDPA_CONSENT_VERSION, safeplateId: form.safeplateId, name: form.name, phone: form.phone, dob: form.dob, gender: form.gender, address: form.address, lga: form.lga, nin: form.nin, email: form.email, employer: form.employer, employerAddress: form.employerAddress, photo: form.photo, lab: form.lab.name, tests: MANDATORY_TESTS, fee: FEE, waterfall: WATERFALL, paid: true, certificate, paymentRef: reference, paidAt, paidAmount: FEE, createdAt: new Date().toISOString() })
      await store.createOrder({ appointmentDate: form.apptDate || null, appointmentSlot: form.apptSlot || null, id: 'ORD-' + form.safeplateId.replace('SP-LG-', '') + (renewing ? '-R' + Date.now().toString().slice(-5) : ''), safeplateId: form.safeplateId, handlerName: form.name, phone: form.phone, lab: form.lab.name, tests: MANDATORY_TESTS, status: 'Scheduled', createdAt: new Date().toISOString() })
      if (!SUPABASE_READY) await store.createEscrow(escrowPayload)
      await store.notify('laboratory', 'New test order', form.name + ' booked ' + form.lab.name)
      await store.notify(session.email, 'Payment received', naira(FEE) + ' held in escrow for your test')
      await store.dispatch(form.phone, 'sms', 'SafePlate: your ' + naira(FEE) + ' test payment is confirmed. ID ' + form.safeplateId)
      try { localStorage.removeItem(draftKey) } catch (e) { /* ignore */ }
      setPaymentRef(reference); setPaidStamp(paidAt)
      setF('paid', true); setStep(4); toast('Payment received, held in escrow.')
    } catch (e) { setErr('Payment could not be completed. Your test order is saved for 48 hours, try again.') } finally { setBusy(false) }
  }

  if (checking) return <div className="page"><div className="wrap"><div className="skelrow"><div className="skel" style={{height:80}} /><div className="skel" style={{height:120}} /><div className="skel" style={{height:180}} /></div></div></div>
  function startRenewal() {
    const h = mine.h || {}
    setForm(f => ({ ...f, name: h.name || f.name, phone: h.phone || '', dob: h.dob || '', gender: h.gender || '', address: h.address || '', lga: h.lga || '', nin: h.nin || '', email: h.email || session.email || '', employer: h.employer || '', photo: h.photo || f.photo, safeplateId: h.safeplateId, lab: null, paid: false }))
    setRenewing(true); setShowWizard(true); setStep(1); setErr('')
  }
  if (mine && !showWizard) return <FoodDashboard data={mine} session={session} onNew={() => { setRenewing(false); setShowWizard(true); setStep(0) }} onRenew={startRenewal} />

  return (
    <div className="page"><div className="wrap">
      {draft && !renewing && step === 0 && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--gold)', borderWidth: 2 }}>
          <div className="row-between" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div className="kicker" style={{ color: '#9a6200' }}>Unfinished registration</div>
              <h3 className="serif" style={{ fontSize: 17, margin: '4px 0' }}>Carry on where you left off</h3>
              <div className="muted" style={{ fontSize: 13 }}>We saved these details on {new Date(draft.savedAt).toLocaleDateString('en-GB')}. Nothing has been paid yet.</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn sm" onClick={discardDraft}>Start fresh</button>
              <button className="btn p sm" onClick={resumeDraft}>Resume</button>
            </div>
          </div>
        </div>
      )}
      {renewing && <div className="note" style={{ marginBottom: 16, borderColor: 'var(--gold)' }}>You are renewing certificate <b className="mono">{form.safeplateId}</b>. Your details are already filled in. Choose your laboratory and pay {naira(FEE)} to book the full retest.</div>}
      <div className="greeting"><h2 className="sec serif" style={{ margin: 0 }}>{t('fh_title')}</h2><span className="muted" style={{ fontSize: 13 }}>{session.title}</span></div>
      <FoodJourney step={step} />
      <div className="steps">{STEP_LABELS.map((l, i) => <div key={l} className={'s ' + (i === step ? 'on' : '') + (i < step ? ' done' : '')} title={l} />)}</div>
      {err && <div className="err">{err}</div>}

      {step === 0 && (
        <div className="card">
          <div className="wizard-head"><h3 className="serif" style={{ margin: 0, fontSize: 21 }}>{t('fh_s1')}</h3><span className="st">Step 1 of 4</span></div>
          <p className="muted" style={{ marginTop: 4 }}>Your details are verified and you receive a unique, traceable ID.</p>
          <div className="field"><label>{t('lbl_fullname')}</label><input value={form.name} onChange={e => setF('name', e.target.value)} placeholder="First and last name" /></div>
          <div className="field"><label>{t('lbl_phone')}</label><input value={form.phone} onChange={e => setF('phone', e.target.value)} placeholder="080..." /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field"><label>Date of birth</label><input type="date" value={form.dob} onChange={e => setF('dob', e.target.value)} /></div>
            <div className="field"><label>Gender</label><select value={form.gender} onChange={e => setF('gender', e.target.value)}><option value="">Select...</option><option>Female</option><option>Male</option><option>Prefer not to say</option></select></div>
          </div>
          <div className="field"><label>Home address</label><input value={form.address} onChange={e => setF('address', e.target.value)} placeholder="Street and area" /></div>
          <div className="field"><label>LGA</label><select value={form.lga} onChange={e => setF('lga', e.target.value)}><option value="">Select your LGA...</option>{LAGOS_LGAS.map(l => <option key={l}>{l}</option>)}</select></div>
          <div className="field"><label>{t('lbl_nin')} <span style={{ color: 'var(--green)' }}>(required, verified with NIMC)</span></label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={form.nin} onChange={e => { setF('nin', e.target.value); setNinState({ status: 'idle', name: '', reason: '' }) }} placeholder="11-digit NIN" inputMode="numeric" style={{ flex: 1 }} />
              <button className="btn sm" onClick={verifyNin} disabled={ninState.status === 'checking'}>{ninState.status === 'checking' ? 'Checking...' : ninState.status === 'verified' ? 'Verified' : 'Verify'}</button>
            </div>
            {ninState.status === 'verified' && <div style={{ fontSize: 12.5, color: 'var(--green)', fontWeight: 600, marginTop: 6 }}>NIN verified with NIMC{ninState.name ? ': ' + ninState.name : ''}.</div>}
            {ninState.status === 'error' && <div className="err" style={{ marginTop: 8 }}>{ninState.reason}</div>}
            {ninState.status === 'unavailable' && (
              <div className="note" style={{ marginTop: 8, borderColor: 'var(--gold)', background: '#fdf8ee', fontSize: 12.5 }}>
                {ninState.reason} If you are a SafePlate supervisor and NIMC is genuinely down, you may admit this applicant manually.
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, cursor: 'pointer' }}><input type="checkbox" checked={ninOverride} onChange={e => setNinOverride(e.target.checked)} /> Admit without NIMC verification (recorded in the audit trail)</label>
              </div>
            )}
          </div>
          <div className="field"><label>{t('lbl_email')}</label><input value={form.email} onChange={e => setF('email', e.target.value)} placeholder="you@example.com" /></div>
          <div className="field"><label>{t('lbl_employer')}</label><input value={form.employer} onChange={e => setF('employer', e.target.value)} placeholder="Restaurant, hotel or company" /></div>
          <div className="field"><label>Employer address (optional)</label><input value={form.employerAddress} onChange={e => setF('employerAddress', e.target.value)} placeholder="Where you work" /></div>
          <div className="field"><label>Passport photo <span style={{ color: 'var(--green)' }}>(required)</span></label><input type="file" accept="image/*" onChange={async e => { const f = e.target.files && e.target.files[0]; if (f) { try { setF('photo', await compressImage(f)) } catch { /* ignore */ } } }} /><div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Your photo is printed on your certificate so it cannot be used by anyone else.</div>{form.photo && <img src={form.photo} alt="preview" style={{ marginTop: 8, width: 84, height: 96, objectFit: 'cover', borderRadius: 10, border: '2px solid var(--green)' }} />}</div>
          <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '14px 16px', margin: '4px 0 14px', background: '#fafcfb' }}>
            <div className="kicker" style={{ color: 'var(--green)', marginBottom: 8 }}>Consent to process your data</div>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', fontSize: 13.5, lineHeight: 1.55 }}>
              <input type="checkbox" checked={!!form.consent} onChange={e => setF('consent', e.target.checked)} style={{ marginTop: 3, width: 18, height: 18, flex: '0 0 auto' }} />
              <span>
                I agree that Lagos State may store and process the personal data I have provided, including my name, date of birth, contact details, address, National Identification Number and photograph, together with my test results, for the purpose of food handler certification and public health regulation under the Nigeria Data Protection Act 2023.
                <span style={{ display: 'block', marginTop: 8, color: 'var(--muted)', fontSize: 12.5 }}>
                  Your results are held encrypted and are visible only to the Ministry of Health and to you. Employers and the public can see whether your certificate is valid, never your medical results. Data is retained while your certification is active and for the statutory period after. You may request a copy of your data, or ask for it to be corrected, at any time.
                </span>
              </span>
            </label>
          </div>
          <button className="btn p block" onClick={register} disabled={busy || !form.consent}>{busy ? 'Checking...' : t('btn_create_id')}</button>
        </div>
      )}
      {step === 1 && (
        <div className="card">
          <div className="wizard-head"><h3 className="serif" style={{ margin: 0, fontSize: 21 }}>{t('fh_s2')}</h3><span className="st">Step 2 of 4</span></div>
          <div className="note" style={{ marginTop: 6, marginBottom: 16 }}>{tr('fh_id_assigned')} <b>{form.safeplateId}</b>. Keep it, it identifies you across every test cycle.</div>
          {MANDATORY_TESTS.map(t => <div key={t} className="lab-row on" style={{ cursor: 'default' }}><span>{t}</span><span className="pill ok">{tr('fh_mandatory')}</span></div>)}
          <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>Next testing window will be set for <b>{nextDue}</b>. Reminders go out 14 and 2 days before.</p>
          <button className="btn p block" onClick={() => setStep(2)}>{t('btn_choose_lab')}</button>
        </div>
      )}
      {step === 2 && (
        <div className="card">
          <div className="wizard-head"><h3 className="serif" style={{ margin: 0, fontSize: 21 }}>{t('fh_s3')}</h3><span className="st">Step 3 of 4</span></div>
          <p className="muted" style={{ marginTop: 4 }}>Accreditation is checked in real time. Unaccredited labs cannot take your order.</p>
          {labs.map(l => (
            <button key={l.id} className={'lab-row ' + (l.accredited ? '' : 'off')} onClick={() => chooseLab(l)}>
              <span><b style={{ fontFamily: 'Lora,serif' }}>{l.name}</b><div className="meta">{l.area} · results in {l.turnaround}{l.mobile ? ' · mobile collection' : ''}</div>
                {l.accredited && (openDaysLabel(l.id)
                  ? <div className="meta" style={{ color: 'var(--green)', fontWeight: 600 }}>Sampling days: {openDaysLabel(l.id)}</div>
                  : <div className="meta">No published appointment times</div>)}
              </span>
              <span className={'pill ' + (l.accredited ? 'ok' : 'no')}>{l.accredited ? 'Accredited' : 'Not accredited'}</span>
            </button>
          ))}
        </div>
      )}
      {step === 3 && (
        <div className="card">
          <div className="wizard-head"><h3 className="serif" style={{ margin: 0, fontSize: 21 }}>{t('fh_s4')}</h3><span className="st">Step 4 of 4</span></div>
          <p className="muted" style={{ marginTop: 4 }}>Your {naira(FEE)} is held in Sterling Bank escrow and released only after the Ministry approves your results. Payment is by Paystack.</p>
          {avail && (
            <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '14px 16px', marginBottom: 14, background: '#fafcfb' }}>
              <div className="kicker" style={{ color: 'var(--green)', marginBottom: 8 }}>Book your sample appointment</div>
              <div className="field"><label>Date</label><select value={form.apptDate || ''} onChange={e => { setF('apptDate', e.target.value); setF('apptSlot', '') }}><option value="">Select a date</option>{bookableDates().map(d => <option key={d.iso} value={d.iso}>{d.label}</option>)}</select></div>
              {form.apptDate && (() => {
                const chosen = bookableDates().find(d => d.iso === form.apptDate)
                const slots = chosen ? (avail.days[chosen.day] || []) : []
                return (
                  <div className="field"><label>Time slot</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {slots.map(sl => <button key={sl} className={'btn sm' + (form.apptSlot === sl ? ' p' : '')} onClick={() => setF('apptSlot', sl)}>{sl}</button>)}
                    </div>
                  </div>
                )
              })()}
              {avail.note && <div className="muted" style={{ fontSize: 12.5 }}>{avail.note}</div>}
            </div>
          )}
          {!avail && form.lab && <div className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>This laboratory has not published appointment times. Contact them directly to arrange your sample once you have paid.</div>}
          <table className="split-tbl"><tbody>
            <tr><td>Laboratory</td><td>{form.lab?.name}</td></tr>
            <tr><td>Test panel</td><td>Hepatitis A, Hepatitis E, Stool MC</td></tr>
            <tr className="tot"><td>Amount held in escrow</td><td>{naira(FEE)}</td></tr>
          </tbody></table>
          <button className="btn p block" style={{ marginTop: 18 }} onClick={pay} disabled={busy}>{busy ? 'Processing with Paystack...' : 'Pay ' + naira(FEE) + ' into escrow'}</button>
        </div>
      )}
      {step === 4 && (
        <div className="ok-banner">
          <div className="kicker" style={{ color: 'var(--green)' }}>Escrow funded</div>
          <h3 className="serif" style={{ fontSize: 22, margin: '8px 0' }}>{tr('fh_done')}</h3>
          <p className="muted" style={{ marginTop: 0 }}>The laboratory has been notified. After your sample is tested and the Ministry approves the result, your Certificate of Fitness is issued and becomes publicly verifiable by the QR below.</p>
          <div className="cert">
            <div className="kicker" style={{ color: 'var(--green)' }}>SafePlate certificate</div>
            <h4 className="serif" style={{ fontSize: 20, margin: '6px 0 2px' }}>{form.name}</h4>
            <div className="muted" style={{ fontSize: 13.5 }}>{form.safeplateId}</div>
            <div className="qwrap"><QRCodeSVG value={window.location.origin + '/#/verify/' + form.safeplateId} size={128} fgColor={PALETTE.navy} level="M" /></div>
            <div className="muted" style={{ fontSize: 12.5 }}>Status once approved: valid for 6 months</div>
          </div>
          <button className="btn" style={{ marginTop: 14 }} onClick={() => generateReceiptPDF({ reference: paymentRef, safeplateId: form.safeplateId, name: form.name, lab: form.lab && form.lab.name, paidAt: paidStamp, amount: FEE, type: 'FOOD' })}>Download payment receipt</button>
        </div>
      )}
    </div></div>
  )
}




function FoodJourney({ step }) {
  const stages = [
    { label: 'Register', icon: 'testing' },
    { label: 'Test panel', icon: 'queue' },
    { label: 'Choose lab', icon: 'accreditation' },
    { label: 'Pay', icon: 'fund' },
    { label: 'Sample & testing', icon: 'review' },
    { label: 'Ministry review', icon: 'audit' },
    { label: 'Certified', icon: 'verify' }
  ]
  const current = Math.min(step, stages.length - 1)
  return (
    <div className="journey">
      <div className="jtitle">Your certification journey</div>
      <div className="jtrack">
        {stages.map((st, i) => {
          const state = i < current ? 'done' : i === current ? 'now' : 'todo'
          return (
            <div key={i} className={'jstep ' + state}>
              <div className="jicon">{i < current ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg> : <NavIcon id={st.icon} />}</div>
              <span className="jlabel">{st.label}</span>
            </div>
          )
        })}
      </div>
      <div className="jnote muted">{current <= 3 ? 'Complete the steps above to submit your sample. After that, the laboratory tests it and the Ministry reviews the result before your certificate is issued.' : 'Payment received. Give your sample at your chosen laboratory, they test it, then the Ministry reviews and issues your Certificate of Fitness.'}</div>
    </div>
  )
}


export default FoodHandlerModule
