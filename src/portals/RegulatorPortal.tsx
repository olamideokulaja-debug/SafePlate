// Regulator portal (LSMoH / LASEPA / HEFAMAA): result review, certificates,
// complaints, enforcement, lab accreditation & QA audit, water review, audit
// log, analytics, officer admin. Largest portal; lazy-loaded chunk.
/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import { useState, useEffect, useMemo } from 'react'
import { makeWaterCertSeries } from '../lib/water.ts'
import { SUPABASE_READY } from '../lib/config.ts'
import { smatch, timeAgo, qaGrade, auditCat, auditCatColor, generateEnforcementLetter, generateQaReportPDF, generateCertPDF } from '../lib/helpers.ts'
import { store, labsView, normaliseCert } from '../lib/store.ts'
import { naira, CHART, WATERFALL, WATER_WATERFALL, FUND_PER_TXN, FEE, WATER_FEE, LAGOS_LGAS, SANCTION_LADDER, SANCTION_SEVERE, MINI, METRICS, AUDIT_CATS, MANDATORY_TESTS, slaExceeded, statusColor } from '../lib/constants.ts'
import { LAB_QA_TEMPLATE, QA_OUTCOMES } from '../lib/audit-template.ts'
import { waterChecks } from '../lib/water.ts'
import { t } from '../lib/i18n.ts'
import { toast } from '../lib/toast.ts'
import useGuard from '../lib/useGuard.tsx'
import { Donut, Bars, Line, ChartCard } from '../components/Charts.tsx'
import SearchBar from '../components/SearchBar.tsx'
import Insights from '../components/Insights.tsx'
import NavIcon from '../components/NavIcon.tsx'
import { AppealsList } from '../components/Appeals.tsx'
import SupportTickets from '../components/SupportTickets.tsx'

function OfficersAdmin({ agency }) {
  const [officers, setOfficers] = useState([])
  const [nf, setNf] = useState({ name: '', email: '', phone: '', badge: '', lga: '', target: '20' })
  const [pf, setPf] = useState({})
  const [q, setQ] = useState('')
  useEffect(() => { load() /* eslint-disable-next-line */ }, [])
  async function load() { setOfficers(await store.listOfficers(agency)) }
  async function add() {
    if (!nf.name.trim() || !nf.email.trim()) return
    if (nf.phone && !/^0\d{10}$/.test(nf.phone.replace(/\s+/g, ''))) { toast('Enter a valid 11-digit phone number, e.g. 08031234567.', 'err'); return }
    if (nf.badge && officers.some(o => (o.badge || '') === nf.badge.trim())) { toast('That badge number is already in use.', 'err'); return }
    try {
      await store.addOfficer({ ...nf, badge: nf.badge.trim(), target: Number(nf.target) || 20, agency, status: 'Active' })
      setNf({ name: '', email: '', phone: '', badge: '', lga: '', target: '20' }); toast('Officer added to the roster.'); load()
    } catch (e) { toast('Could not add this officer: ' + (e.message || 'the server refused the change.'), 'err') }
  }
  async function approve(o) {
    const patch = pf[o.id] || {}
    let badge = (patch.badge || o.badge || '').trim()
    if (!badge) {
      // Generate the next free badge for this agency rather than a random one,
      // which could collide with a badge already issued.
      const used = new Set(officers.map(x => (x.badge || '').trim()).filter(Boolean))
      let n = 101
      while (used.has(agency + '-' + n)) n++
      badge = agency + '-' + n
    }
    if (officers.some(x => x.id !== o.id && (x.badge || '') === badge)) { toast('That badge number is already in use. Enter a different one.', 'err'); return }
    try {
      await store.updateOfficer(o.id, { status: 'Active', badge, lga: patch.lga || o.lga || '' })
      toast('Officer approved and activated.'); load()
    } catch (e) { toast('Could not approve this officer: ' + (e.message || 'the server refused the change.'), 'err') }
  }
  async function setStatus(o, status) { try { await store.updateOfficer(o.id, { status }); toast('Officer ' + status.toLowerCase() + '.'); load() } catch (e) { toast('Could not update this officer: ' + (e.message || 'the server refused the change.'), 'err') } }
  if (!officers) return <div className="skelrow"><div className="skel" style={{ height: 74 }} /><div className="skel" style={{ height: 140 }} /></div>
  const pending = officers.filter(o => o.status === 'Pending')
  const active = officers.filter(o => o.status !== 'Pending')
  return (
    <div>
      <div className="note" style={{ marginBottom: 16 }}>Field officers who inspect, sanction, verify and sample on behalf of {agency}. Add them here, or approve officers who have self-registered.</div>
      <div className="tiles" style={{ marginBottom: 16 }}>
        <div className="tile"><div className="v">{officers.length}</div><div className="k">Officers</div></div>
        <div className="tile"><div className="v">{officers.filter(o => o.status === 'Active').length}</div><div className="k">Active</div></div>
        <div className="tile"><div className="v">{pending.length}</div><div className="k">Pending approval</div></div>
        <div className="tile"><div className="v">{officers.filter(o => o.status === 'Suspended').length}</div><div className="k">Suspended</div></div>
      </div>
      {pending.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 className="serif" style={{ fontSize: 17, marginBottom: 8 }}>Pending approvals</h3>
          {pending.map(o => (
            <div className="ord" key={o.id}>
              <div className="top"><div><b>{o.name}</b> <span className="muted" style={{ fontSize: 12 }}>· {o.email}</span></div><span className="badge" style={{ background: '#fdf1dd', color: '#9a6200' }}>Pending</span></div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <input placeholder="Badge no." value={(pf[o.id] || {}).badge || ''} onChange={e => setPf({ ...pf, [o.id]: { ...(pf[o.id] || {}), badge: e.target.value } })} style={MINI} />
                <select value={(pf[o.id] || {}).lga || ''} onChange={e => setPf({ ...pf, [o.id]: { ...(pf[o.id] || {}), lga: e.target.value } })} style={MINI}><option value="">Assign LGA</option>{LAGOS_LGAS.map(l => <option key={l}>{l}</option>)}</select>
                <button className="btn p sm" onClick={() => approve(o)}>Approve</button>
                <button className="btn sm danger" onClick={() => setStatus(o, 'Declined')}>Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <h3 className="serif" style={{ fontSize: 17, marginBottom: 8 }}>Add an officer</h3>
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input placeholder="Full name" value={nf.name} onChange={e => setNf({ ...nf, name: e.target.value })} style={MINI} />
          <input placeholder="Email" value={nf.email} onChange={e => setNf({ ...nf, email: e.target.value })} style={MINI} />
          <input placeholder="Phone" value={nf.phone} onChange={e => setNf({ ...nf, phone: e.target.value })} style={MINI} />
          <input placeholder="Badge no." value={nf.badge} onChange={e => setNf({ ...nf, badge: e.target.value })} style={MINI} />
          <select value={nf.lga} onChange={e => setNf({ ...nf, lga: e.target.value })} style={MINI}><option value="">LGA</option>{LAGOS_LGAS.map(l => <option key={l}>{l}</option>)}</select>
          <input placeholder="Monthly target" type="number" min="1" value={nf.target} onChange={e => setNf({ ...nf, target: e.target.value })} style={MINI} />
          <button className="btn p sm" onClick={add}>Add officer</button>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 10, marginBottom: 0 }}>The officer signs in with this email and is active immediately. Officers who self-register appear above for your approval.</p>
      </div>
      <div className="row-between" style={{ alignItems: 'baseline' }}><h3 className="serif" style={{ fontSize: 17, marginBottom: 8 }}>Roster</h3><button className="btn sm" onClick={() => exportCsv(active, [{ label: 'Name', key: 'name' }, { label: 'Badge', key: 'badge' }, { label: 'Area', key: 'lga' }, { label: 'Target', get: o => o.target || 20 }, { label: 'Email', key: 'email' }, { label: 'Status', key: 'status' }], 'safeplate-officers.csv')}>Export CSV</button></div>
      <SearchBar value={q} onChange={setQ} placeholder="Search officers by name, badge, area or email..." />
      <div style={{ overflowX: 'auto' }}>
        <table className="audit-tbl">
          <thead><tr><th>Name</th><th>Badge</th><th>Area</th><th>Target</th><th>Contact</th><th>Status</th><th></th></tr></thead>
          <tbody>{active.filter(o => smatch(q, o.name, o.badge, o.lga, o.email)).length === 0 ? <tr><td colSpan={7} className="muted" style={{ padding: 16 }}>{active.length ? 'No officers match your search.' : 'No active officers yet.'}</td></tr> : active.filter(o => smatch(q, o.name, o.badge, o.lga, o.email)).map(o => (
            <tr key={o.id}>
              <td>{o.name}</td>
              <td className="mono">{o.badge || '\u2014'}</td>
              <td>{o.lga || '\u2014'}</td>
              <td><input type="number" min="1" defaultValue={o.target || 20} aria-label={'Monthly target for ' + o.name} onBlur={e => { const v = Number(e.target.value) || 20; if (v !== (o.target || 20)) { store.updateOfficer(o.id, { target: v }).then(() => { toast('Target updated for ' + o.name + '.'); load() }) } }} style={{ width: 62, padding: '5px 7px', border: '1px solid var(--line)', borderRadius: 7, fontFamily: 'inherit', fontSize: 13 }} /></td>
              <td className="muted">{o.email}</td>
              <td><span className="badge" style={o.status === 'Active' ? { background: '#e7f4ec', color: '#0a6b39' } : { background: '#fdeaea', color: '#b3261e' }}>{o.status}</span></td>
              <td>{o.status === 'Active' ? <button className="btn xs danger" onClick={() => setStatus(o, 'Suspended')}>Suspend</button> : o.status === 'Suspended' ? <button className="btn xs" onClick={() => setStatus(o, 'Active')}>Reactivate</button> : null}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  )
}


function SanctionApprovals({ agency }) {
  const [rows, setRows] = useState(null)
  useEffect(() => { load() /* eslint-disable-next-line */ }, [])
  async function load() { const all = await store.listInspections(agency); setRows(all.filter(r => r.kind === 'sanction' && r.sanctionStatus === 'Recommended')) }
  async function decide(r, ok) {
    await store.updateInspection(r.id, { sanctionStatus: ok ? 'Approved' : 'Declined' })
    if (ok && r.targetId) { try { await store.updateEstablishment(r.targetId, { sanction: r.sanction, appeal: null }) } catch (e) { /* ignore */ } }
    toast(ok ? (r.sanction + ' approved and applied.') : 'Recommendation declined.', ok ? '' : 'warn'); load()
  }
  if (!rows || !rows.length) return null
  return (
    <div style={{ marginTop: 24 }}>
      <h3 className="serif" style={{ fontSize: 18, marginBottom: 4 }}>Sanction approvals</h3>
      <p className="muted" style={{ marginTop: 0, fontSize: 13, marginBottom: 12 }}>Severe sanctions recommended by field officers, awaiting supervisor sign-off.</p>
      {rows.map((r, i) => (
        <div className="ord" key={r.id || i}>
          <div className="top"><div><b>{r.subject}</b> <span className="muted" style={{ fontSize: 12 }}>· {r.sanction} · recommended by {r.officer}</span></div><span className="badge" style={{ background: '#fdf1dd', color: '#9a6200' }}>Recommended</span></div>
          {r.note && <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{r.note}</div>}
          {Array.isArray(r.photos) && r.photos.length > 0 && <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>{r.photos.map((src, k) => <img key={k} src={src} alt="Inspection evidence" style={{ width: 68, height: 68, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line)' }} />)}</div>}
          <div className="row-between" style={{ marginTop: 10 }}><button className="btn sm" onClick={() => decide(r, false)}>Decline</button><button className="btn sm danger" onClick={() => decide(r, true)}>Approve and apply</button></div>
        </div>
      ))}
    </div>
  )
}


function RegulatorHome({ session, onTab }) {
  const agency = session.agency || 'LSMoH'
  const [att, setAtt] = useState(null)
  useEffect(() => { (async () => {
    try {
      if (agency === 'LSMoH') {
        const orders = await store.listAllOrders(); const submitted = orders.filter(o => o.status === 'Submitted').length
        const overdue = orders.filter(o => ['Scheduled', 'Sample Collected', 'Testing in Progress'].includes(o.status) && slaExceeded(o)).length
        const appeals = (await store.listAppeals('LSMoH').catch(() => [])).filter(a => a.status === 'Open').length
        const tickets = (await store.listTickets().catch(() => [])).filter(t => (t.status || 'Open') === 'Open').length
        const cmp = (await store.listComplaints().catch(() => [])).filter(c => (c.status || 'Open') === 'Open').length
        setAtt([{ n: submitted, label: 'results awaiting your review', tab: 'Review', go: 'review' }, { n: overdue, label: 'samples past the 48-hour laboratory SLA', tab: 'Review', go: 'review' }, { n: appeals, label: 'appeals to decide', tab: 'Review', go: 'review' }, { n: cmp, label: 'public reports open', tab: 'Complaints', go: 'complaints' }, { n: tickets, label: 'support requests open', tab: 'Review', go: 'review' }])
      } else if (agency === 'LASEPA') {
        const w = await store.listAllWaterTests(); const pending = w.filter(x => x.status === 'Submitted, pending LASEPA').length
        const appeals = (await store.listAppeals('LASEPA').catch(() => [])).filter(a => a.status === 'Open').length
        const complaints = (await store.listComplaints().catch(() => [])).filter(c => (c.status || 'Open') === 'Open').length
        setAtt([{ n: pending, label: 'water results awaiting approval', tab: 'Water', go: 'water' }, { n: complaints, label: 'public reports to triage', tab: 'Complaints', go: 'complaints' }, { n: appeals, label: 'appeals to decide', tab: 'Enforcement', go: 'enforcement' }])
      } else {
        const pend = (await store.listPendingLabs().catch(() => [])).length
        setAtt([{ n: pend, label: 'laboratory registrations to approve', tab: 'Accreditation', go: 'accreditation' }])
      }
    } catch (e) { setAtt([]) }
  })() /* eslint-disable-next-line */ }, [])
  return (
    <>
      <div className="tiles">{METRICS.map(m => <div className="tile" key={m.k}><div className="v">{m.v}</div><div className="k">{m.k}</div></div>)}</div>
      {att && att.some(a => a.n > 0) && (
        <div className="ord" style={{ borderColor: 'var(--green)', background: '#f6faf7', marginBottom: 16 }}>
          <b style={{ fontFamily: 'Lora,serif', fontSize: 16 }}>Needs your attention today</b>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
            {att.filter(a => a.n > 0).map((a, i) => <button key={i} className="attn-pill" onClick={() => onTab && a.go && onTab(a.go)} title={'Go to the ' + a.tab + ' tab'}><b style={{ fontSize: 18 }}>{a.n}</b> {a.label} <span className="muted">· open {a.tab}</span></button>)}
          </div>
        </div>
      )}
      {att && !att.some(a => a.n > 0) && <div className="note" style={{ marginBottom: 16 }}>Nothing needs your immediate attention. All queues are clear.</div>}
      <Insights session={session} />
    </>
  )
}


function RegulatorModule({ session, tab, onTab }) {
  const agency = session.agency || 'LSMoH'
  const { guard, modal } = useGuard()
  async function audit(action, subject) { await store.appendAudit({ actor: session.name, role: agency, action, subject }) }
  return (
    <div className="page"><div className="wrap">
      <div className="greeting"><h2 className="sec serif" style={{ margin: 0 }}>{agency} portal</h2><span className="muted" style={{ fontSize: 13 }}>{session.name}</span></div>
      {tab === 'home' && <RegulatorHome session={session} onTab={onTab} />}
      {tab === 'review' && <><AnomalySignals /><LabScorecards /><div style={{ marginBottom: 26 }}><h3 className="serif" style={{ fontSize: 18, marginBottom: 4 }}>Analytics</h3><p className="muted" style={{ marginTop: 0, fontSize: 13, marginBottom: 14 }}>Live operational metrics across the programme.</p><Analytics /></div><LSMoHReview session={session} guard={guard} audit={audit} /><AppealsList agency="LSMoH" /><SupportTickets /></>}
      {tab === 'certificates' && <CertAdmin guard={guard} audit={audit} />}
      {tab === 'enforcement' && <><Enforcement guard={guard} audit={audit} agency={agency} session={session} /><AppealsList agency="LASEPA" /></>}
      {tab === 'complaints' && <ComplaintsQueue session={session} audit={audit} readOnly={agency === 'LSMoH'} />}
      {tab === 'accreditation' && <Accreditation guard={guard} audit={audit} session={session} />}
      {tab === 'water' && <WaterReview session={session} guard={guard} audit={audit} />}
      {tab === 'officers' && <><OfficersAdmin agency={session.agency} /><SanctionApprovals agency={session.agency} /></>}
      {tab === 'audit' && <>{agency === 'LSMoH' && <><FaqManager session={session} /><ErasureQueue guard={guard} /></>}<AuditPanel /></>}
      {modal}
    </div></div>
  )
}


function LSMoHReview({ session, guard, audit }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)
  const [selected, setSelected] = useState({})
  function toggleSel(id) { setSelected(s => ({ ...s, [id]: !s[id] })) }
  async function refresh() {
    setLoading(true)
    setSelected({})
    const all = await store.listAllOrders()
    let queue = all.filter(o => o.status === 'Submitted')
    // Live results are encrypted at rest, so fetch the decrypted panel for review.
    // Without this the reviewer would see no result at all for each test.
    if (SUPABASE_READY) {
      queue = await Promise.all(queue.map(async o => {
        if (o.results) return o
        try { const r = await store.fn('decrypt-result', { orderId: o.id }); return { ...o, results: (r && r.results) || null } } catch (e) { return { ...o, results: null } }
      }))
    }
    setOrders(queue); setLoading(false)
  }
  useEffect(() => { refresh() }, [])
  async function approveAll() {
    const clean = orders.filter(o => o.results && !(o.tests || []).some(t => o.results[t] === 'refer'))
    if (!clean.length) { toast('No clean, readable results are ready to approve.', 'warn'); return }
    await runBulk(clean.map(o => o.id))
  }
  async function approveSelected() {
    const ids = orders.filter(o => selected[o.id]).map(o => o.id)
    if (!ids.length) { toast('Tick the results you want to approve first.', 'warn'); return }
    await runBulk(ids)
  }
  async function runBulk(ids) {
    setBulkBusy(true)
    try {
      if (SUPABASE_READY) {
        const r = await store.bulkApproveResults(ids)
        const parts = []
        if (r.approved) parts.push(r.approved + ' certified')
        if (r.referred) parts.push(r.referred + ' referred')
        if (r.failed) parts.push(r.failed + ' failed')
        toast('Bulk approval complete: ' + (parts.join(', ') || 'nothing to do') + '.', r.failed ? 'warn' : undefined)
      } else {
        let ok = 0, lastErr = ''
        for (const id of ids) { const o = orders.find(x => x.id === id); if (!o) continue; try { await approve(o); ok++ } catch (e) { lastErr = (e && e.message) || 'server refused' } }
        toast(ok ? ('Approved ' + ok + ' result' + (ok === 1 ? '' : 's') + '.') : ('No results could be approved: ' + lastErr), ok ? undefined : 'err')
      }
      refresh()
    } catch (e) { toast('Bulk approval failed: ' + (e.message || 'the server refused this action.'), 'err') }
    setBulkBusy(false)
  }

  async function approve(o) {
    if (SUPABASE_READY) { await store.fn('approve-result', { orderId: o.id, decision: 'approve' }); toast('Result approved, certificate issued.'); refresh(); return }
    const anyRefer = o.results && o.tests.some(t => o.results[t] === 'refer')
    if (anyRefer) { await store.updateOrder(o.id, { status: 'Rejected' }); await audit('Result rejected, referral pathway triggered, escrow held', o.safeplateId); toast('Result rejected, referral pathway triggered.', 'warn') }
    else {
      const now = Date.now(), day = 86400000
      const holderPhoto = await store.getHandlerPhoto(o.safeplateId)
      await store.issueCertificate({ safeplateId: o.safeplateId, name: o.handlerName, panel: o.tests.join(', '), lab: o.lab, issued: new Date(now).toISOString(), expiry: new Date(now + 182 * day).toISOString(), status: 'VALID', photo: holderPhoto })
      await store.createRelease({ safeplateId: o.safeplateId, name: o.handlerName, lab: o.lab, amount: FEE, status: 'Instructed', approvedBy: session.name, ts: new Date().toISOString() })
      await store.updateOrder(o.id, { status: 'Approved' })
      await audit('Approved, certificate issued, escrow release instructed to Sterling Bank', o.safeplateId)
      await store.notify('sterling', 'Escrow release instructed', o.safeplateId)
      await store.notify('all', 'Certificate issued', o.handlerName + ' is now certified')
      await store.dispatch(o.phone, 'sms', 'SafePlate: your Certificate of Fitness is issued. Verify at ' + o.safeplateId)
      toast('Result approved, certificate issued.')
    }
    refresh()
  }
  async function flag(o) { if (SUPABASE_READY) { await store.fn('approve-result', { orderId: o.id, decision: 'flag' }); toast('Result flagged for review.', 'warn'); refresh(); return } await store.updateOrder(o.id, { status: 'Flagged' }); await audit('Flagged for further review, escrow held', o.safeplateId); toast('Result flagged for review.', 'warn'); refresh() }
  const shown = orders.filter(o => { const q = search.trim().toLowerCase(); return !q || (o.safeplateId || '').toLowerCase().includes(q) || (o.handlerName || '').toLowerCase().includes(q) })

  return (
    <div>
      <div className="field" style={{ maxWidth: 360 }}><label>Search this queue by SAFEPLATE ID or name</label><input value={search} onChange={e => setSearch(e.target.value)} placeholder="SP-LG-... or name" /></div>
      {!loading && orders.filter(o => o.results && !(o.tests || []).some(t => o.results[t] === 'refer')).length > 1 && (
        <div className="ord" style={{ borderColor: 'var(--green)', background: '#f6faf7' }}>
          <div className="row-between" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div><b style={{ fontFamily: 'Lora,serif', fontSize: 16 }}>{orders.filter(o => o.results && !(o.tests || []).some(t => o.results[t] === 'refer')).length} clean results ready</b><div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>Approve every readable, all-pass result at once. Referred or unreadable results are left for individual review.</div></div>
            <button className="btn p sm" onClick={() => guard('Approve all clean results', approveAll)} disabled={bulkBusy}>{bulkBusy ? 'Approving...' : 'Approve all clean'}</button>
          </div>
        </div>
      )}
      {loading && <p className="muted">Loading results awaiting review...</p>}
      {!loading && shown.length === 0 && <div className="placeholder">No results are awaiting Ministry review. Submitted laboratory results appear here.</div>}
      {!loading && shown.length > 0 && (() => {
        const selCount = shown.filter(o => selected[o.id]).length
        const cleanShown = shown.filter(o => o.results && !(o.tests || []).some(t => o.results[t] === 'refer'))
        return (
          <div className="row-between" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn ghost sm" onClick={() => setSelected(Object.fromEntries(cleanShown.map(o => [o.id, true])))}>Select all clean</button>
              {selCount > 0 && <button className="btn ghost sm" onClick={() => setSelected({})}>Clear ({selCount})</button>}
            </div>
            <button className="btn p sm" disabled={bulkBusy || selCount === 0} onClick={() => guard('Approve ' + selCount + ' selected result' + (selCount === 1 ? '' : 's'), approveSelected)}>{bulkBusy ? 'Approving...' : 'Approve selected' + (selCount ? ' (' + selCount + ')' : '')}</button>
          </div>
        )
      })()}
      {!loading && shown.map(o => (
        <div className="ord" key={o.id} style={selected[o.id] ? { borderColor: 'var(--green)', boxShadow: '0 0 0 1px var(--green)' } : undefined}>
          <div className="top"><div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <input type="checkbox" checked={!!selected[o.id]} onChange={() => toggleSel(o.id)} style={{ marginTop: 4, width: 17, height: 17 }} title="Select for bulk approval" />
            <div><b style={{ fontFamily: 'Lora,serif', fontSize: 16 }}>{o.handlerName}</b><div className="muted" style={{ fontSize: 12.5 }}>{o.safeplateId} · {o.lab}</div></div></div>
            <span className={'status ' + (slaExceeded(o) ? 'Flag' : 'Submitted')}>{slaExceeded(o) ? 'SLA exceeded, escalated' : 'Within 48h SLA'}</span></div>
          {!o.results && <div className="err" style={{ marginTop: 10 }}>The laboratory result panel could not be read for this order. Do not approve it. Contact the laboratory and report this through Help and support.</div>}
          <table className="split-tbl" style={{ marginTop: 8 }}><tbody>{o.tests.map(t => (
            <tr key={t}><td>{t}</td><td style={{ textAlign: 'right', fontWeight: 600, color: !o.results ? 'var(--muted)' : o.results[t] === 'refer' ? '#b3261e' : 'var(--green)' }}>{!o.results ? 'Not available' : o.results[t] === 'refer' ? 'Refer' : 'Pass'}</td></tr>
          ))}</tbody></table>
          <div className="row-between" style={{ marginTop: 12 }}>
            <button className="btn p sm" onClick={() => guard('Approve results for ' + o.safeplateId, () => approve(o))} disabled={!o.results} title={!o.results ? 'The result panel could not be read, so it cannot be approved' : ''}>Approve</button>
            <button className="btn sm danger" onClick={() => guard('Flag ' + o.safeplateId + ' for review', () => flag(o))}>Flag for review</button>
          </div>
        </div>
      ))}
    </div>
  )
}


function CertAdmin({ guard, audit }) {
  const [rows, setRows] = useState(null)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { load() /* eslint-disable-next-line */ }, [])
  async function load() { const all = await store.listAllCertificates(); all.sort((a, b) => String(b.issued || '').localeCompare(String(a.issued || ''))); setRows(all) }
  async function revoke(c) { const cid = c.safeplateId || c.safeplate_id; setBusy(true); if (SUPABASE_READY) { await store.fn('revoke-certificate', { safeplateId: cid }) } else { await store.revokeCertificate(cid); await audit('Certificate revoked', cid) } await load(); toast('Certificate revoked.', 'warn'); setBusy(false) }
  if (!rows) return <div className="skelrow"><div className="skel" style={{height:74}} /><div className="skel" style={{height:44}} /><div className="skel" style={{height:220}} /></div>
  const ql = q.trim().toLowerCase()
  const key = c => ((c.safeplateId || c.safeplate_id || '') + ' ' + (c.name || '') + ' ' + (c.cert_no || c.certNo || c.series || '') + ' ' + (c.status || '') + ' ' + (c.lab || '')).toLowerCase()
  const shown = rows.filter(c => !ql || key(c).includes(ql))
  const counts = rows.reduce((a, c) => { a[c.status] = (a[c.status] || 0) + 1; return a }, {})
  const _wk = 604800000, _n = Date.now()
  const issuedThisWk = rows.filter(c => c.issued && _n - new Date(c.issued).getTime() <= _wk).length
  const issuedLastWk = rows.filter(c => { const d = c.issued ? _n - new Date(c.issued).getTime() : 1e18; return d > _wk && d <= 2 * _wk }).length
  const issuedDelta = issuedThisWk - issuedLastWk
  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>Every Certificate of Fitness issued statewide. Search, download a copy, or revoke where compliance requires it.</p>
      <div className="tiles" style={{ marginBottom: 14 }}>
        <div className="tile"><div className="v">{rows.length}</div><div className="k">Certificates issued</div>{issuedThisWk + issuedLastWk > 0 && <div className="trend" style={{ color: issuedDelta >= 0 ? 'var(--green)' : '#b3261e' }}>{issuedDelta >= 0 ? '\u25b2 ' : '\u25bc '}{Math.abs(issuedDelta)} vs last week</div>}</div>
        <div className="tile"><div className="v">{counts['VALID'] || 0}</div><div className="k">Valid</div></div>
        <div className="tile"><div className="v">{counts['EXPIRED'] || 0}</div><div className="k">Expired</div></div>
        <div className="tile"><div className="v">{counts['REVOKED'] || 0}</div><div className="k">Revoked</div></div>
      </div>
      <div className="audsearch" style={{ maxWidth: 460 }}><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by SAFEPLATE ID, name, certificate number or status..." /></div>
      <div className="row-between" style={{ alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
        <div className="muted" style={{ fontSize: 12.5 }}>Showing {Math.min(shown.length, 200)} of {shown.length}{shown.length !== rows.length ? ' matching (' + rows.length + ' total)' : ' certificates'}.</div>
        <button className="btn sm" onClick={() => exportCsv(shown, [{ label: 'SAFEPLATE ID', get: c => c.safeplateId || c.safeplate_id }, { label: 'Name', key: 'name' }, { label: 'Cert No', get: c => c.cert_no || c.certNo || c.series || '' }, { label: 'Laboratory', key: 'lab' }, { label: 'Issued', key: 'issued' }, { label: 'Expiry', key: 'expiry' }, { label: 'Status', key: 'status' }], 'safeplate-certificates.csv')}>Export CSV</button>
      </div>
      {shown.length === 0 && <div className="placeholder">No certificates match your search.</div>}
      {shown.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="audit-tbl">
            <thead><tr><th>Photo</th><th>SAFEPLATE ID</th><th>Name</th><th>Cert No</th><th>Laboratory</th><th>Issued</th><th>Expiry</th><th>Status</th><th></th></tr></thead>
            <tbody>{shown.slice(0, 200).map((c, i) => { const cid = c.safeplateId || c.safeplate_id; const cno = c.cert_no || c.certNo || c.series || '\u2014'; return (
              <tr key={cid + i}>
                <td>{c.photo ? <img src={c.photo} alt="" style={{ width: 34, height: 40, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line)', display: 'block' }} /> : <span style={{ width: 34, height: 40, borderRadius: 6, background: 'var(--green-pale)', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{(c.name || '?').split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase()}</span>}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{cid}</td>
                <td>{c.name}</td>
                <td className="muted" style={{ whiteSpace: 'nowrap' }}>{cno}</td>
                <td>{c.lab}</td>
                <td className="muted" style={{ whiteSpace: 'nowrap' }}>{c.issued ? new Date(c.issued).toLocaleDateString('en-GB') : '\u2014'}</td>
                <td className="muted" style={{ whiteSpace: 'nowrap' }}>{new Date(c.expiry || c.expiry_date).toLocaleDateString('en-GB')}</td>
                <td><span className={'badge ' + c.status}>{c.status}</span></td>
                <td><div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button className="btn xs" onClick={() => generateCertPDF(c)}>PDF</button>
                  {c.status === 'VALID' && <button className="btn xs danger" onClick={() => guard('Revoke certificate ' + cid, () => revoke(c))} disabled={busy}>Revoke</button>}
                </div></td>
              </tr>
            ) })}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}


function ComplaintsQueue({ session, audit, readOnly }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  useEffect(() => { load() /* eslint-disable-next-line */ }, [])
  async function load() { setLoading(true); try { setRows(await store.listComplaints()) } catch (e) { setRows([]) } setLoading(false) }
  async function decide(c, outcome) {
    try {
      await store.triageComplaint(c.id, { status: 'Closed', outcome, triagedBy: session.email, triagedAt: new Date().toISOString() })
      await audit('Complaint triaged: ' + outcome, c.id)
      toast('Complaint closed as ' + outcome.toLowerCase() + '.')
      load()
    } catch (e) { toast('Could not update the complaint: ' + (e.message || 'try again'), 'err') }
  }
  const open = rows.filter(c => (c.status || 'Open') === 'Open')
  const closed = rows.filter(c => (c.status || 'Open') !== 'Open')
  return (
    <div>
      <div className="tiles">
        <div className="tile"><div className="v">{open.length}</div><div className="k">Open reports</div></div>
        <div className="tile"><div className="v">{closed.length}</div><div className="k">Triaged</div></div>
        <div className="tile"><div className="v">{rows.length}</div><div className="k">Total received</div></div>
      </div>
      <div className="note" style={{ marginBottom: 16 }}>Anonymous public reports. Each one schedules an inspection and marks the establishment as under review internally. A report is intelligence, not evidence, so it never applies a sanction on its own.{readOnly ? ' You are viewing these for oversight. LASEPA triages and closes them.' : ' Close it once an officer has looked.'}</div>
      <SearchBar value={q} onChange={setQ} placeholder="Search reports by establishment, LGA or detail..." />
      {loading && <p className="muted">Loading reports...</p>}
      {!loading && open.length === 0 && <div className="placeholder">No open reports. Anything the public submits will appear here for triage.</div>}
      {open.filter(c => smatch(q, c.establishment, c.lga, c.detail)).map(c => (
        <div className="ord" key={c.id}>
          <div className="top"><div><b style={{ fontFamily: 'Lora,serif', fontSize: 16 }}>{c.establishment}</b><div className="muted" style={{ fontSize: 12.5 }}>{[c.lga, c.id].filter(Boolean).join(' · ')} · {timeAgo(c.createdAt || c.created_at)}</div></div><span className="badge" style={{ background: '#fdf1dd', color: '#9a6200' }}>Open</span></div>
          <p style={{ fontSize: 14, margin: '10px 0' }}>{c.detail}</p>
          {Array.isArray(c.photos) && c.photos.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              {c.photos.map((ph, i) => <a key={i} href={ph} target="_blank" rel="noreferrer"><img src={ph} alt={'Evidence ' + (i + 1)} style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--line)' }} /></a>)}
            </div>
          )}
          {!readOnly && (
            <div className="row-between" style={{ flexWrap: 'wrap', gap: 8 }}>
              <button className="btn sm" onClick={() => decide(c, 'No further action')}>No further action</button>
              <button className="btn p sm" onClick={() => decide(c, 'Inspected, close')}>Inspected, close</button>
            </div>
          )}
        </div>
      ))}
      {closed.length > 0 && (<>
        <h3 className="serif" style={{ fontSize: 17, marginTop: 24 }}>Recently triaged</h3>
        {closed.slice(0, 15).map(c => (
          <div className="ord" key={c.id}><div className="top"><div><b style={{ fontFamily: 'Lora,serif', fontSize: 15 }}>{c.establishment}</b><div className="muted" style={{ fontSize: 12.5 }}>{c.id} · {c.outcome}</div></div><span className="badge" style={{ background: '#e7f4ec', color: '#0a6b39' }}>Closed</span></div></div>
        ))}
      </>)}
    </div>
  )
}


function Enforcement({ guard, audit, agency, session }) {
  const [ests, setEsts] = useState([])
  const [q, setQ] = useState('')
  const [officers, setOfficers] = useState([])
  const [addOpen, setAddOpen] = useState(false)
  const [nf, setNf] = useState({ name: '', lga: '' })
  async function addEst() {
    if (nf.name.trim().length < 3 || !nf.lga) { toast('Enter a name and select an LGA.', 'err'); return }
    try { await store.createEstablishment({ name: nf.name.trim(), lga: nf.lga, verified: true, registeredBy: (session && session.email) || '', compliance: 'Not yet inspected' }); await audit('Establishment registered', nf.name.trim()); toast('Establishment added to the register.'); setNf({ name: '', lga: '' }); setAddOpen(false); refresh() } catch (e) { toast('Could not add the establishment: ' + (e.message || 'try again'), 'err') }
  }
  async function refresh() { setEsts(await store.listEstablishments()); try { setOfficers((await store.listOfficers(agency || 'LASEPA')).filter(o => o.status === 'Active')) } catch (e) { setOfficers([]) } }
  useEffect(() => { refresh() /* eslint-disable-next-line */ }, [])
async function assign(e, email) {
    try {
      await store.updateEstablishment(e.id, { assignedTo: email || null })
      await audit(email ? 'Case assigned to officer' : 'Case unassigned', e.name)
      toast(email ? 'Assigned to ' + ((officers.find(o => o.email === email) || {}).name || email) + '.' : 'Unassigned.')
      refresh()
    } catch (err) { toast('Could not assign the case: ' + (err.message || 'permission denied'), 'err') }
  }
async function escalate(e) {
    const idx = e.sanction ? SANCTION_LADDER.indexOf(e.sanction) : -1
    const next = SANCTION_LADDER[Math.min(idx + 1, SANCTION_LADDER.length - 1)]
    try {
      await store.updateEstablishment(e.id, { sanction: next, appeal: null })
      await audit('Sanction escalated to ' + next, e.name)
      toast('Sanction escalated to ' + next + '. Generating enforcement letter...')
      try { generateEnforcementLetter({ ...e, sanction: next }, session) } catch (le) { /* letter is optional */ }
      refresh()
    } catch (err) { toast('Could not escalate the sanction: ' + (err.message || 'permission denied'), 'err') }
  }
  async function appeal(e) { await store.updateEstablishment(e.id, { appeal: 'Under review' }); await audit('Appeal lodged and under review', e.name); refresh() }
  return (
    <div>
      <div className="note" style={{ marginBottom: 16 }}>Enforcement is an escalating ladder with an appeals pathway. The aim is compliance as the outcome, not fines as the output.</div>
      <div className="row-between" style={{ alignItems: 'center', marginBottom: 10 }}>
        <span className="muted" style={{ fontSize: 13 }}>{ests.filter(e => e.verified === false).length > 0 ? ests.filter(e => e.verified === false).length + ' self-registered premises await verification' : 'All premises on the register are verified'}</span>
        <button className="btn sm" onClick={() => setAddOpen(v => !v)}>{addOpen ? 'Cancel' : 'Add establishment'}</button>
      </div>
      {addOpen && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="field"><label>Establishment name</label><input value={nf.name} onChange={e => setNf({ ...nf, name: e.target.value })} placeholder="e.g. Mama Nkechi Kitchen" /></div>
          <div className="field"><label>LGA</label><select value={nf.lga} onChange={e => setNf({ ...nf, lga: e.target.value })}><option value="">Select LGA</option>{LAGOS_LGAS.map(l => <option key={l}>{l}</option>)}</select></div>
          <button className="btn p sm" onClick={addEst}>Add to register</button>
        </div>
      )}
      <SearchBar value={q} onChange={setQ} placeholder="Search facilities by name, LGA, compliance or sanction..." />
      {ests.filter(e => smatch(q, e.name, e.lga, e.compliance, e.sanction)).length === 0 && <div className="placeholder">No facilities match your search.</div>}
      {ests.filter(e => smatch(q, e.name, e.lga, e.compliance, e.sanction)).map(e => (
        <div className="ord" key={e.id}>
          <div className="top"><div><b style={{ fontFamily: 'Lora,serif', fontSize: 16 }}>{e.name}</b><div className="muted" style={{ fontSize: 12.5 }}>{e.lga} · {e.compliance}</div></div>{e.appeal && <span className="status Sample">Appeal {e.appeal}</span>}</div>
          {(e.verified === false || e.underReview) && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '2px 0 10px' }}>
              {e.verified === false && <span className="badge" style={{ background: '#fdf1dd', color: '#9a6200' }}>Self-registered, unverified</span>}
              {e.underReview && <span className="badge" style={{ background: '#fdeeee', color: '#b3261e' }}>Complaint under review</span>}
            </div>
          )}
          <div className="ladder">{SANCTION_LADDER.map(r => <span key={r} className={'rung ' + (e.sanction === r ? 'on' : '')}>{r}</span>)}</div>
          {officers.length > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0' }}><span className="muted" style={{ fontSize: 12.5 }}>Assigned officer:</span><select value={e.assignedTo || ''} onChange={ev => assign(e, ev.target.value)} style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13 }}><option value="">Unassigned</option>{officers.map(o => <option key={o.id} value={o.email}>{o.name}{o.lga ? ' (' + o.lga + ')' : ''}</option>)}</select></div>}
          <div className="row-between"><div style={{ display: 'flex', gap: 8 }}><button className="btn sm danger" onClick={() => guard('Escalate sanction for ' + e.name, () => escalate(e))}>Escalate sanction</button>{e.sanction && <button className="btn sm" onClick={() => generateEnforcementLetter(e, session)}>Generate letter</button>}</div><button className="btn sm" onClick={() => guard('Lodge appeal for ' + e.name, () => appeal(e))}>Lodge appeal</button></div>
        </div>
      ))}
    </div>
  )
}


function LabQaAudit({ lab, session, onDone, onCancel }) {
  const [answers, setAnswers] = useState({})
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const g = qaGrade(answers)
  const set = (id, v) => setAnswers(a => ({ ...a, [id]: v }))
  function markAll(v) { const next = {}; LAB_QA_TEMPLATE.flatMap(x => x.items).forEach(i => { next[i.id] = v }); setAnswers(next) }
  async function save() {
    if (!g.complete) { toast('Answer every criterion, or mark it not applicable, before saving.', 'err'); return }
    setBusy(true)
    try {
      const rec = await store.createLabAudit({
        labId: lab.id, labName: lab.name, auditor: session.name, auditorEmail: session.email,
        answers, score: g.score, applicable: g.applicable, met: g.met,
        criticalFailures: g.criticalFailures.map(c => c.id), outcome: g.band.outcome, note,
        validUntil: g.band.months ? new Date(Date.now() + g.band.months * 30 * 86400000).toISOString() : null
      })
      toast('QA audit saved: ' + g.score + '%, ' + g.band.outcome + '.')
      onDone(rec, g)
    } catch (e) { toast('Could not save the audit: ' + (e.message || 'try again'), 'err') }
    setBusy(false)
  }
  return (
    <div className="card" style={{ marginBottom: 18, borderColor: 'var(--navy)', borderWidth: 2 }}>
      <div className="row-between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="kicker" style={{ color: 'var(--navy)' }}>HEFAMAA QA audit</div>
          <h3 className="serif" style={{ fontSize: 19, margin: '4px 0' }}>{lab.name}</h3>
          <div className="muted" style={{ fontSize: 13 }}>Mark each criterion as met, not met, or not applicable. Criteria marked critical fail the audit outright if unmet.</div>
        </div>
        <div style={{ textAlign: 'right', minWidth: 150 }}>
          <div style={{ fontFamily: 'Lora,serif', fontSize: 30, color: g.band.tone === 'ok' ? 'var(--green)' : g.band.tone === 'warn' ? '#9a6200' : '#b3261e' }}>{g.score}%</div>
          <div className="muted" style={{ fontSize: 12 }}>{g.met} of {g.applicable} met · {g.answered}/{g.applicable} answered</div>
          <span className={'pill ' + (g.band.tone === 'ok' ? 'ok' : 'no')} style={{ marginTop: 6, display: 'inline-block' }}>{g.band.outcome}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
        <button className="btn sm" onClick={() => markAll('met')}>Mark all met</button>
        <button className="btn sm" onClick={() => setAnswers({})}>Clear</button>
      </div>
      {LAB_QA_TEMPLATE.map(sec => (
        <div key={sec.section} style={{ marginBottom: 18 }}>
          <h4 className="serif" style={{ fontSize: 15, margin: '0 0 8px', color: 'var(--navy)' }}>{sec.section}</h4>
          {sec.items.map(it => {
            const a = answers[it.id]
            return (
              <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200, fontSize: 13.5 }}>
                  {it.text}{it.critical && <span className="badge" style={{ background: '#fdeeee', color: '#b3261e', marginLeft: 8, fontSize: 10 }}>critical</span>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[['met', 'Met'], ['not', 'Not met'], ['na', 'N/A']].map(([v, lbl]) => (
                    <button key={v} className={'btn sm' + (a === v ? ' p' : '')} style={a === v && v === 'not' ? { background: '#b3261e', borderColor: '#b3261e', color: '#fff' } : undefined} onClick={() => set(it.id, v)}>{lbl}</button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ))}
      {g.criticalFailures.length > 0 && (
        <div className="note" style={{ borderColor: '#b3261e', background: '#fdeeee', marginBottom: 12 }}>
          <b>{g.criticalFailures.length} critical requirement{g.criticalFailures.length === 1 ? '' : 's'} not met.</b> This audit fails regardless of the overall score: {g.criticalFailures.map(c => c.id).join(', ')}.
        </div>
      )}
      <div className="field"><label>Auditor notes</label><textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Findings, corrective actions required, and the date by which they must be completed." style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 10, fontSize: 14.5, fontFamily: 'inherit' }} /></div>
      <div className="row-between" style={{ flexWrap: 'wrap', gap: 8 }}>
        <button className="btn sm" onClick={onCancel}>Cancel</button>
        <button className="btn p sm" onClick={save} disabled={busy || !g.complete}>{busy ? 'Saving...' : g.complete ? 'Save audit (' + g.band.outcome + ')' : 'Answer all ' + g.applicable + ' criteria'}</button>
      </div>
    </div>
  )
}


function Accreditation({ guard, audit, session }) {
  const [labs, setLabs] = useState(labsView())
  const [pending, setPending] = useState([])
  const [q, setQ] = useState('')
  const [auditing, setAuditing] = useState(null)
  const [summaries, setSummaries] = useState({})
  async function refreshLabs() {
    let all = []
    try { all = await store.allLabs(); setLabs(all) } catch (e) { all = labsView(); setLabs(all) }
    let pend = []
    try { pend = await store.listPendingLabs(); setPending(pend) } catch (e) { setPending([]) }
    const map = {}
    await Promise.all([...all, ...pend].map(async l => { try { const a = await store.labAuditSummary(l.id); if (a) map[l.id] = a } catch (e) { /* ignore */ } }))
    setSummaries(map)
  }
  function auditOf(l) { return summaries[l.id] || null }
  async function issueNumber(l) {
    const accNo = await store.issueAccNo(l.id)
    await audit('Accreditation number ' + accNo + ' issued to ' + l.name, l.name)
    toast(l.name + ' issued accreditation number ' + accNo + '.')
    refreshLabs()
  }
  function auditPassed(l) { const a = auditOf(l); return !!a && ['Accredited', 'Provisional'].includes(a.outcome) }
  useEffect(() => { refreshLabs() /* eslint-disable-next-line */ }, [])
  async function toggle(l) { await store.setLabAccredited(l.id, !l.accredited); await audit((l.accredited ? 'Accreditation suspended for ' : 'Accreditation granted for ') + l.name, l.name); refreshLabs() }
  async function approveReg(l) {
    if (!auditPassed(l)) { toast('Run the QA audit first. A laboratory can only be accredited once it meets the criteria.', 'err'); return }
    const a = auditOf(l)
    const accNo = await store.approveLab(l.id)
    await audit('Laboratory accreditation approved for ' + l.name + ' (QA audit ' + a.score + '%, ' + a.outcome + '), accreditation number ' + accNo, l.name)
    toast(l.name + ' accredited as ' + accNo + '. It can now receive samples.'); refreshLabs()
  }
  async function declineReg(l) { await store.declineLab(l.id); await audit('Laboratory registration declined for ' + l.name, l.name); toast(l.name + ' registration declined.', 'warn'); refreshLabs() }
  async function onAuditDone(rec, g) {
    await audit('QA audit completed: ' + rec.score + '%, ' + rec.outcome + (g.criticalFailures.length ? ', ' + g.criticalFailures.length + ' critical failure(s)' : ''), rec.labName)
    // A failed audit on an accredited laboratory suspends it immediately.
    const lab = [...labs, ...pending].find(x => x.id === rec.labId)
    if (lab && lab.accredited && rec.outcome === 'Not accredited') {
      try { await store.setLabAccredited(lab.id, false); await audit('Accreditation suspended after failed QA audit', rec.labName); toast(rec.labName + ' suspended after a failed audit.', 'warn') } catch (e) { /* surfaced below */ }
    }
    setAuditing(null); refreshLabs()
  }
  return (
    <div>
      <div className="note" style={{ marginBottom: 16 }}>HEFAMAA accredits laboratories against a fixed set of criteria covering licensing, personnel, premises, equipment, quality management, sample handling, biosafety and records. A laboratory must pass the QA audit before it can be accredited, and a failed audit on an accredited laboratory suspends it at once. Suspension removes it from the food handler booking list immediately.</div>
      <div className="note" style={{ marginBottom: 16, borderColor: 'var(--gold)', background: '#fdf8ee', fontSize: 13 }}>The criteria set is drafted from standard laboratory accreditation practice and needs HEFAMAA sign-off before live use. Scoring: 85% or above accredits for 24 months, 70 to 84% gives 6 months provisional, below 70% fails. Any unmet critical criterion fails the audit whatever the score.</div>
      {auditing && <LabQaAudit lab={auditing} session={session} onDone={onAuditDone} onCancel={() => setAuditing(null)} />}
      {pending.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <h3 className="serif" style={{ fontSize: 17, marginBottom: 4 }}>Pending laboratory registrations</h3>
          <p className="muted" style={{ marginTop: 0, fontSize: 13, marginBottom: 12 }}>New laboratories awaiting accreditation. Approving one makes it available to food handlers.</p>
          {pending.map(l => (
            <div className="ord" key={l.id}>
              <div className="top"><div><b style={{ fontFamily: 'Lora,serif', fontSize: 16 }}>{l.name}</b><div className="muted" style={{ fontSize: 12.5 }}>{[l.lga || l.area, l.contactPerson, l.phone].filter(Boolean).join(' · ')}</div>{l.address && <div className="muted" style={{ fontSize: 12 }}>{l.address}</div>}</div><span className="badge" style={{ background: '#fdf1dd', color: '#9a6200' }}>Pending</span></div>
              {auditOf(l) ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0', flexWrap: 'wrap' }}>
                  <span className={'pill ' + (auditPassed(l) ? 'ok' : 'no')}>QA audit {auditOf(l).score}% · {auditOf(l).outcome}</span>
                  <span className="muted" style={{ fontSize: 12 }}>{timeAgo(auditOf(l).ts)}</span>
                  <button className="btn sm" onClick={() => generateQaReportPDF(auditOf(l), l)}>Audit report</button>
                </div>
              ) : <div className="muted" style={{ fontSize: 12.5, margin: '10px 0' }}>No QA audit on record. The laboratory cannot be accredited until it passes one.</div>}
              <div className="row-between" style={{ marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
                <button className="btn sm danger" onClick={() => guard('Decline registration for ' + l.name, () => declineReg(l))}>Decline</button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn sm" onClick={() => setAuditing(l)}>{auditOf(l) ? 'Re-run QA audit' : 'Run QA audit'}</button>
                  <button className="btn p sm" onClick={() => guard('Accredit ' + l.name, () => approveReg(l))} disabled={!auditPassed(l)}>Approve accreditation</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <h3 className="serif" style={{ fontSize: 17, marginBottom: 8 }}>Accredited &amp; listed laboratories</h3>
      <SearchBar value={q} onChange={setQ} placeholder="Search laboratories by name, area or accreditation number..." />
      {labs.filter(l => smatch(q, l.name, l.area, l.accNo)).length === 0 && <div className="placeholder">No laboratories match your search.</div>}
      {labs.filter(l => smatch(q, l.name, l.area, l.accNo)).map(l => (
        <div className="ord" key={l.id}>
          <div className="top"><div><b style={{ fontFamily: 'Lora,serif', fontSize: 16 }}>{l.name}</b><div className="muted" style={{ fontSize: 12.5 }}>{l.area} · {l.accNo || l.acc_no || (l.accredited ? 'accreditation number not issued' : 'not yet accredited')}</div></div><span className={'pill ' + (l.accredited ? 'ok' : 'no')}>{l.accredited ? 'Accredited' : 'Not accredited'}</span></div>
          {auditOf(l) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0', flexWrap: 'wrap' }}>
              <span className={'pill ' + (auditPassed(l) ? 'ok' : 'no')}>QA audit {auditOf(l).score}% · {auditOf(l).outcome}</span>
              <span className="muted" style={{ fontSize: 12 }}>{timeAgo(auditOf(l).ts)}</span>
              <button className="btn sm" onClick={() => generateQaReportPDF(auditOf(l), l)}>Audit report</button>
            </div>
          )}
          {l.accredited && !(l.accNo || l.acc_no) && (
            <div className="note" style={{ marginBottom: 10, borderColor: 'var(--gold)', background: '#fdf8ee', fontSize: 13 }}>
              This laboratory was accredited without an accreditation number.
              <button className="btn sm" style={{ marginLeft: 10 }} onClick={() => guard('Issue an accreditation number to ' + l.name, () => issueNumber(l))}>Issue accreditation number</button>
            </div>
          )}
          <div className="row-between" style={{ marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
            <button className="btn sm" onClick={() => setAuditing(l)}>{auditOf(l) ? 'Re-run QA audit' : 'Run QA audit'}</button>
            <button className={'btn sm ' + (l.accredited ? 'danger' : 'p')} onClick={() => guard((l.accredited ? 'Suspend accreditation for ' : 'Grant accreditation to ') + l.name, () => toggle(l))}>{l.accredited ? 'Suspend accreditation' : 'Grant accreditation'}</button>
          </div>
        </div>
      ))}
    </div>
  )
}


function LabScorecards() {
  const [rows, setRows] = useState(null)
  useEffect(() => {
    let on = true
    Promise.all([
      store.listAllOrders().catch(() => []),
      store.listAllCertificates().catch(() => []),
    ]).then(([orders, certs]) => {
      if (!on) return
      const labs = {}
      orders.forEach(o => {
        if (!o.lab) return
        const r = labs[o.lab] || (labs[o.lab] = { lab: o.lab, orders: 0, withResults: 0, flagged: 0, certs: 0 })
        r.orders++
        if (o.results) r.withResults++
        if (/Rejected|Flagged/.test(o.status || '')) r.flagged++
      })
      certs.forEach(c => { if (c.lab && labs[c.lab]) labs[c.lab].certs++ })
      const list = Object.values(labs).map(r => ({
        ...r,
        completion: r.orders ? Math.round((r.withResults / r.orders) * 100) : 0,
        flagRate: r.orders ? Math.round((r.flagged / r.orders) * 100) : 0,
      })).sort((a, b) => b.orders - a.orders)
      setRows(list)
    })
    return () => { on = false }
  }, [])
  return (
    <div style={{ marginBottom: 26 }}>
      <h3 className="serif" style={{ fontSize: 18, marginBottom: 4 }}>Laboratory scorecards</h3>
      <p className="muted" style={{ marginTop: 0, fontSize: 13, marginBottom: 14 }}>
        Throughput and outcomes per accredited laboratory. A very low flag rate on
        high volume, or stalled completion, is worth a closer look.
      </p>
      {rows === null && <div className="muted">Loading…</div>}
      {rows && rows.length === 0 && <div className="note">No laboratory activity recorded yet.</div>}
      {rows && rows.length > 0 && (
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map(r => (
            <div key={r.lab} className="card">
              <div className="row-between" style={{ flexWrap: 'wrap', gap: 8 }}>
                <b style={{ fontSize: 15 }}>{r.lab}</b>
                <span className="muted" style={{ fontSize: 12.5 }}>{r.orders} order{r.orders === 1 ? '' : 's'}</span>
              </div>
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 10 }}>
                <div><div style={{ fontSize: 20, fontWeight: 700 }}>{r.completion}%</div><div className="muted" style={{ fontSize: 12 }}>Results submitted</div></div>
                <div><div style={{ fontSize: 20, fontWeight: 700 }}>{r.certs}</div><div className="muted" style={{ fontSize: 12 }}>Certificates issued</div></div>
                <div><div style={{ fontSize: 20, fontWeight: 700, color: r.flagRate === 0 && r.orders >= 8 ? '#9a6200' : 'inherit' }}>{r.flagRate}%</div><div className="muted" style={{ fontSize: 12 }}>Flag rate</div></div>
              </div>
              <div style={{ marginTop: 12, height: 8, borderRadius: 99, background: 'var(--line)', overflow: 'hidden' }}>
                <div style={{ width: r.completion + '%', height: '100%', background: 'var(--green)' }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AnomalySignals() {
  const [signals, setSignals] = useState(null)
  useEffect(() => {
    let on = true
    Promise.all([
      store.listAllOrders().catch(() => []),
      store.listAllCertificates().catch(() => []),
      store.listComplaints().catch(() => []),
    ]).then(([orders, certs, complaints]) => {
      if (!on) return
      const out = []

      // 1) Labs with an unusually high pass rate. A lab that never fails a sample
      //    is a classic quality-and-integrity red flag worth a human look.
      const byLab = {}
      orders.forEach(o => {
        if (!o.lab || !o.results) return
        const rec = byLab[o.lab] || (byLab[o.lab] = { total: 0, pass: 0 })
        rec.total++
        const failed = /Rejected|Flagged/.test(o.status || '') || (o.results && Object.values(o.results).some(v => /fail|positive|detected/i.test(String(v))))
        if (!failed) rec.pass++
      })
      Object.entries(byLab).forEach(([lab, r]) => {
        if (r.total >= 8) {
          const rate = r.pass / r.total
          if (rate >= 0.98) out.push({ level: 'high', title: lab + ' passes nearly every sample', detail: Math.round(rate * 100) + '% pass rate across ' + r.total + ' results. Review a sample of this lab\u2019s submissions.' })
        }
      })

      // 2) Certificates issued suspiciously fast after the order was created.
      const certById = {}; certs.forEach(c => { certById[c.safeplateId || c.safeplate_id] = c })
      let fast = 0
      orders.forEach(o => {
        const c = certById[o.safeplateId]
        if (!c) return
        const created = new Date(o.createdAt || o.created_at).getTime()
        const issued = new Date(c.issued || c.issued_at || 0).getTime()
        if (issued && created && (issued - created) < 2 * 3600000 && issued >= created) fast++
      })
      if (fast >= 3) out.push({ level: 'high', title: fast + ' certificates issued within two hours of testing', detail: 'Turnaround this fast is implausible for the mandated panel and may indicate results were not run. Verify the underlying lab work.' })

      // 3) Complaint clusters by establishment.
      const byEst = {}
      complaints.forEach(c => { const k = (c.establishment || '').trim().toLowerCase(); if (k) byEst[k] = (byEst[k] || 0) + 1 })
      Object.entries(byEst).forEach(([est, n]) => {
        if (n >= 3) out.push({ level: 'medium', title: 'Multiple complaints about the same establishment', detail: n + ' separate reports name "' + est + '". Consider prioritising an inspection.' })
      })

      // 4) Expired certificates still marked valid (data integrity).
      const now = Date.now()
      const staleValid = certs.filter(c => (c.status === 'VALID') && c.expiry && new Date(c.expiry).getTime() < now).length
      if (staleValid > 0) out.push({ level: 'medium', title: staleValid + ' certificate' + (staleValid === 1 ? '' : 's') + ' past expiry but still marked valid', detail: 'These should have lapsed. Check the expiry job and revoke if appropriate.' })

      setSignals(out)
    })
    return () => { on = false }
  }, [])

  const TONE = { high: { bg: '#f7eaea', fg: '#a4271d', dot: '#b3261e', label: 'High' }, medium: { bg: '#fdf3e3', fg: '#9a6200', dot: '#FBAE40', label: 'Review' } }
  return (
    <div style={{ marginBottom: 26 }}>
      <h3 className="serif" style={{ fontSize: 18, marginBottom: 4 }}>Integrity signals</h3>
      <p className="muted" style={{ marginTop: 0, fontSize: 13, marginBottom: 14 }}>
        Automated checks that flag patterns worth a human look. A signal is a
        prompt to investigate, never a finding of wrongdoing on its own.
      </p>
      {signals === null && <div className="muted">Scanning…</div>}
      {signals && signals.length === 0 && <div className="note">No anomalies detected in the current data.</div>}
      {signals && signals.length > 0 && (
        <div style={{ display: 'grid', gap: 10 }}>
          {signals.map((s, i) => {
            const tn = TONE[s.level] || TONE.medium
            return (
              <div key={i} className="card" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ flexShrink: 0, marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 6, background: tn.bg, color: tn.fg, padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 99, background: tn.dot }} />{tn.label}
                </span>
                <div style={{ minWidth: 0 }}>
                  <b style={{ fontSize: 14.5 }}>{s.title}</b>
                  <div className="muted" style={{ fontSize: 13, marginTop: 3 }}>{s.detail}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FaqManager({ session }) {
  const [faqs, setFaqs] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  useEffect(() => { store.listFaqs().then(setFaqs).catch(() => setFaqs([])) }, [])
  function update(i, field, val) { setFaqs(fs => fs.map((f, j) => j === i ? { ...f, [field]: val } : f)) }
  function add() { setFaqs(fs => [...(fs || []), { id: 'faq-' + Date.now(), question: '', answer: '' }]) }
  function remove(i) { setFaqs(fs => fs.filter((_, j) => j !== i)) }
  function move(i, dir) { setFaqs(fs => { const a = [...fs]; const j = i + dir; if (j < 0 || j >= a.length) return a;[a[i], a[j]] = [a[j], a[i]]; return a }) }
  async function save() {
    setBusy(true); setMsg('')
    try { const saved = await store.saveFaqs(faqs, session && session.email); setFaqs(saved); setMsg('Saved. The public FAQ page is updated.'); toast('FAQ content saved.') }
    catch (e) { setMsg('Could not save: ' + (e.message || 'try again')) }
    setBusy(false)
  }
  return (
    <div style={{ marginBottom: 26 }}>
      <h3 className="serif" style={{ fontSize: 18, marginBottom: 4 }}>FAQ content</h3>
      <p className="muted" style={{ marginTop: 0, fontSize: 13, marginBottom: 14 }}>
        Questions and answers shown on the public Help centre. Changes go live for
        everyone when you save.
      </p>
      {faqs === null && <div className="muted">Loading…</div>}
      {faqs && faqs.map((f, i) => (
        <div key={f.id || i} className="card" style={{ marginBottom: 10 }}>
          <div className="row-between" style={{ marginBottom: 8 }}>
            <span className="muted" style={{ fontSize: 12 }}>Question {i + 1}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn xs" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
              <button className="btn xs" onClick={() => move(i, 1)} disabled={i === faqs.length - 1} aria-label="Move down">↓</button>
              <button className="btn xs danger" onClick={() => remove(i)}>Remove</button>
            </div>
          </div>
          <div className="field" style={{ marginBottom: 8 }}><input value={f.question} onChange={e => update(i, 'question', e.target.value)} placeholder="Question" aria-label="Question" /></div>
          <div className="field" style={{ marginBottom: 0 }}><textarea value={f.answer} onChange={e => update(i, 'answer', e.target.value)} placeholder="Answer" rows={3} aria-label="Answer" /></div>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 10, marginTop: 6, alignItems: 'center' }}>
        <button className="btn" onClick={add}>Add question</button>
        <button className="btn p" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save FAQ content'}</button>
        {msg && <span className="muted" style={{ fontSize: 13 }}>{msg}</span>}
      </div>
    </div>
  )
}

function ErasureQueue({ guard }) {
  const [rows, setRows] = useState(null)
  const [note, setNote] = useState({})
  async function load() { try { setRows(await store.listErasureRequests()) } catch (e) { setRows([]) } }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [])
  async function resolve(r, outcome) {
    await store.resolveErasure(r.safeplateId, outcome, note[r.safeplateId] || '', 'Data Protection Officer')
    toast(outcome === 'upheld' ? 'Erasure upheld and personal data minimised.' : 'Erasure request declined and recorded.')
    load()
  }
  return (
    <div style={{ marginBottom: 26 }}>
      <h3 className="serif" style={{ fontSize: 18, marginBottom: 4 }}>Erasure requests (NDPA)</h3>
      <p className="muted" style={{ marginTop: 0, fontSize: 13, marginBottom: 14 }}>
        Data subjects who have asked for their record to be erased. Upholding a
        request minimises personal data while keeping the certification skeleton
        required for the statutory public-health record. Declining must be
        justified, for example an unexpired certificate that must stand.
      </p>
      {rows === null && <div className="muted">Loading…</div>}
      {rows && rows.length === 0 && <div className="note">No erasure requests are pending.</div>}
      {rows && rows.length > 0 && (
        <div style={{ display: 'grid', gap: 12 }}>
          {rows.map(r => (
            <div key={r.safeplateId} className="card">
              <div className="row-between" style={{ flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <b>{r.name || 'Unnamed record'}</b>
                  <div className="mono" style={{ fontSize: 13, color: 'var(--muted)' }}>{r.safeplateId}</div>
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                    Reference <span className="mono">{r.erasureRef || 'n/a'}</span>
                    {r.erasureAt && <> · lodged {new Date(r.erasureAt).toLocaleDateString('en-GB')}</>}
                  </div>
                </div>
              </div>
              <div className="field" style={{ marginTop: 10 }}>
                <input value={note[r.safeplateId] || ''} onChange={e => setNote(n => ({ ...n, [r.safeplateId]: e.target.value }))} placeholder="Decision note (required to decline)" />
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="btn danger sm" onClick={() => guard('Uphold erasure for ' + r.safeplateId + ' and minimise their personal data', () => resolve(r, 'upheld'))}>Uphold erasure</button>
                <button className="btn sm" disabled={!(note[r.safeplateId] || '').trim()} onClick={() => guard('Decline erasure for ' + r.safeplateId, () => resolve(r, 'declined'))} title={(note[r.safeplateId] || '').trim() ? '' : 'A note is required to decline'}>Decline with reason</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AuditPanel() {
  const [rows, setRows] = useState([])
  const [view, setView] = useState('tracker')
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  useEffect(() => { store.listAudit().then(setRows) }, [])
  function exportAuditCsv() {
    exportCsv(rows, [{ label: 'Timestamp', key: 'ts' }, { label: 'Role', key: 'role' }, { label: 'Actor', key: 'actor' }, { label: 'Action', key: 'action' }, { label: 'Subject', key: 'subject' }, { label: 'IP', key: 'ip' }], 'safeplate-audit-trail.csv')
  }
  function exportTxt() {
    const header = 'timestamp\trole\tactor\taction\tsubject\tip'
    const body = rows.map(r => [r.ts, r.role, r.actor, r.action, r.subject || '', r.ip].join('\t'))
    const blob = new Blob([[header].concat(body).join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'safeplate-audit-trail.txt'; a.click(); URL.revokeObjectURL(url)
  }
  const cats = {}; rows.forEach(r => { const c = auditCat(r.action).cat; cats[c] = (cats[c] || 0) + 1 })
  const catList = Object.keys(cats)
  const actors = new Set(rows.map(r => r.actor)).size
  const today = rows.filter(r => new Date(r.ts).toDateString() === new Date().toDateString()).length
  const DAYS = 14
  const byDay = new Array(DAYS).fill(0)
  const midnight = new Date(); midnight.setHours(0, 0, 0, 0)
  rows.forEach(r => { const d = new Date(r.ts); d.setHours(0, 0, 0, 0); const idx = DAYS - 1 - Math.round((midnight - d) / 86400000); if (idx >= 0 && idx < DAYS) byDay[idx]++ })
  const dayLabels = byDay.map((_, i) => i === 0 ? '14d' : i === 7 ? '7d' : i === DAYS - 1 ? 'today' : '')
  const ql = q.trim().toLowerCase()
  const fromT = from ? new Date(from + 'T00:00:00').getTime() : null
  const toT = to ? new Date(to + 'T23:59:59').getTime() : null
  const shown = rows.filter(r => (filter === 'all' || auditCat(r.action).cat === filter) && (!ql || (r.action + ' ' + r.actor + ' ' + (r.subject || '') + ' ' + r.role).toLowerCase().includes(ql)) && (!fromT || new Date(r.ts).getTime() >= fromT) && (!toT || new Date(r.ts).getTime() <= toT))
  return (
    <div>
      <div className="row-between" style={{ marginBottom: 14 }}>
        <div className="viewtog"><button className={view === 'tracker' ? 'on' : ''} onClick={() => setView('tracker')}>Tracker</button><button className={view === 'table' ? 'on' : ''} onClick={() => setView('table')}>Table</button></div>
        <button className="btn sm" onClick={exportAuditCsv} disabled={!rows.length}>Export CSV</button>
        <button className="btn sm" onClick={exportTxt} disabled={!rows.length}>Export tamper-evident report</button>
      </div>
      <div className="note" style={{ marginBottom: 16 }}>Append-only. Entries cannot be edited or deleted. Actor, role, IP and timestamp are captured on every action.</div>
      {rows.length === 0 && <div className="placeholder">No audit entries yet. Approvals, releases, enforcement and accreditation actions are logged here.</div>}
      {rows.length > 0 && (
        <>
          <div className="tiles" style={{ marginBottom: 16 }}>
            <div className="tile"><div className="v">{rows.length}</div><div className="k">Total events</div></div>
            <div className="tile"><div className="v">{today}</div><div className="k">Logged today</div></div>
            <div className="tile"><div className="v">{actors}</div><div className="k">Distinct actors</div></div>
            <div className="tile"><div className="v">{catList.length}</div><div className="k">Action types</div></div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="audsearch" style={{ flex: 1, minWidth: 220 }}><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by actor, action or SAFEPLATE ID..." /></div>
            <label style={{ fontSize: 12.5, color: 'var(--muted)' }}>From <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13 }} /></label>
            <label style={{ fontSize: 12.5, color: 'var(--muted)' }}>To <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13 }} /></label>
            {(from || to) && <button className="btn sm" onClick={() => { setFrom(''); setTo('') }}>Clear dates</button>}
          </div>
          <div className="chartgrid">
            <ChartCard title="Actions by type" hint="whole trail"><Bars data={catList.map(k => ({ label: k, value: cats[k], color: auditCatColor(k) }))} /></ChartCard>
            <ChartCard title="Activity over time" hint="events per day, 14 days"><Line series={byDay} labels={dayLabels} /></ChartCard>
          </div>
          {view === 'tracker' && (
            <>
              <div className="audchips">
                <button className={'audchip' + (filter === 'all' ? ' on' : '')} onClick={() => setFilter('all')}>All ({rows.length})</button>
                {catList.map(k => <button key={k} className={'audchip' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}><i style={{ background: auditCatColor(k) }} />{k} ({cats[k]})</button>)}
              </div>
              {shown.length === 0 && <div className="placeholder">No events match your search or filter.</div>}
              <div className="timeline">
                {shown.map((r, i) => { const c = auditCat(r.action); return (
                  <div className="tlrow" key={i}>
                    <div className="tldot" style={{ borderColor: c.color, color: c.color }}><NavIcon id={c.icon} /></div>
                    <div className="tlbody"><div className="tltop"><b>{r.action}</b><span className="tltime">{timeAgo(r.ts)}</span></div><div className="tlmeta muted">{r.actor} · {r.role}{r.subject ? ' · ' + r.subject : ''}</div></div>
                  </div>
                ) })}
              </div>
            </>
          )}
          {view === 'table' && (
            <div style={{ overflowX: 'auto' }}><table className="audit-tbl">
              <thead><tr><th>When</th><th>Actor</th><th>Role</th><th>Action</th><th>Subject</th></tr></thead>
              <tbody>{shown.map((r, i) => (<tr key={i}><td className="muted">{new Date(r.ts).toLocaleString('en-GB')}</td><td>{r.actor}</td><td>{r.role}</td><td>{r.action}</td><td className="muted">{r.subject || ''}</td></tr>))}</tbody>
            </table></div>
          )}
        </>
      )}
    </div>
  )
}


function WaterReview({ session, guard, audit }) {
  const [tests, setTests] = useState([])
  const [loading, setLoading] = useState(true)
  const [bulkBusy, setBulkBusy] = useState(false)
  async function refresh() { setLoading(true); setTests(await store.listAllWaterTests()); setLoading(false) }
  useEffect(() => { refresh() }, [])

  async function approve(w) {
    if (SUPABASE_READY) {
      try { await store.fn('approve-water', { swid: w.swid, decision: 'approve' }); toast('Water result approved, certificate issued.'); refresh() }
      catch (e) { toast('Could not approve this water result: ' + (e.message || 'please try again.'), 'err'); throw e }
      return
    }
    const now = Date.now(), day = 86400000
    const series = makeWaterCertSeries()
    await store.issueCertificate({ safeplateId: w.swid, name: w.facility, panel: 'Potable water quality', lab: w.lab, issued: new Date(now).toISOString(), expiry: new Date(now + 182 * day).toISOString(), status: 'VALID', series })
    await store.releaseEscrow(w.swid, 'LASEPA')
    await store.updateWaterTest(w.swid, { status: 'Certified', certSeries: series })
    await audit('Water result approved, certificate issued, 80/10/5/5 disbursed', w.swid)
    await store.notify(w.ownerEmail, 'Water certificate issued', w.facility + ' is now certified')
    await store.notify('all', 'Facility water certified', w.facility)
    await store.dispatch(w.contact, 'sms', 'SafePlate: ' + w.facility + ' water certificate issued, ref ' + series)
    toast('Water result approved, certificate issued.')
    refresh()
  }
  async function flag(w) { if (SUPABASE_READY) { try { await store.fn('approve-water', { swid: w.swid, decision: 'flag' }); toast('Water result flagged, retest required.', 'warn'); refresh() } catch (e) { toast('Could not flag this water result: ' + (e.message || 'please try again.'), 'err'); throw e } return } await store.updateWaterTest(w.swid, { status: 'Flagged, retest required' }); await audit('Water result flagged, retest required', w.swid); toast('Water result flagged, retest required.', 'warn'); refresh() }
  async function approveAllWater() {
    const clean = tests.filter(w => w.status === 'Submitted, pending LASEPA' && waterChecks(w.results).every(c => c.ok))
    if (!clean.length) { toast('No clean water results are ready to approve.', 'warn'); return }
    setBulkBusy(true)
    let ok = 0; let lastErr = ''
    for (const w of clean) { try { await approve(w); ok++ } catch (e) { lastErr = (e && e.message) || 'server refused' } }
    setBulkBusy(false)
    if (ok === 0) toast('No water results could be approved: ' + (lastErr || 'the server refused this action.'), 'err')
    else if (ok < clean.length) toast('Approved ' + ok + ' of ' + clean.length + '. The rest failed: ' + lastErr, 'warn')
    else toast('Bulk approval complete: ' + ok + ' water certificate' + (ok === 1 ? '' : 's') + ' issued.')
  }

  const pending = tests.filter(w => w.status === 'Submitted, pending LASEPA')
  const done = tests.filter(w => w.status !== 'Submitted, pending LASEPA')

  return (
    <div>
      <div className="note" style={{ marginBottom: 16 }}>LASEPA is the approving authority for water. Readings are checked against WHO and NAFDAC benchmarks. Approval disburses the {naira(WATER_FEE)} fee 80/10/5/5.</div>
      {!loading && tests.filter(w => w.status === 'Submitted, pending LASEPA' && waterChecks(w.results).every(c => c.ok)).length > 1 && (
        <div className="ord" style={{ borderColor: 'var(--green)', background: '#f6faf7' }}>
          <div className="row-between" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div><b style={{ fontFamily: 'Lora,serif', fontSize: 16 }}>{tests.filter(w => w.status === 'Submitted, pending LASEPA' && waterChecks(w.results).every(c => c.ok)).length} clean water results ready</b><div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>Approve every result that meets all WHO and NAFDAC benchmarks. Any failing reading is left for individual review.</div></div>
            <button className="btn p sm" onClick={() => guard('Approve all clean water results', approveAllWater)} disabled={bulkBusy}>{bulkBusy ? 'Approving...' : 'Approve all clean'}</button>
          </div>
        </div>
      )}
      {loading && <p className="muted">Loading water results...</p>}
      {!loading && pending.length === 0 && <div className="placeholder">No water results awaiting LASEPA approval.</div>}
      {pending.map(w => (
        <div className="ord" key={w.swid}>
          <div className="top"><div><b style={{ fontFamily: 'Lora,serif', fontSize: 16 }}>{w.facility}</b><div className="muted" style={{ fontSize: 12.5 }}>{w.swid} · {w.source} · {w.lab}</div></div><span className="status HELD">Pending LASEPA</span></div>
          <table className="split-tbl"><tbody>{waterChecks(w.results).map(c => (
            <tr key={c.k}><td>{c.k} <span className="muted">({c.bench})</span></td><td style={{ textAlign: 'right', fontWeight: 600, color: c.ok ? 'var(--green)' : '#b3261e' }}>{c.v} {c.ok ? 'pass' : 'fail'}</td></tr>
          ))}</tbody></table>
          <div className="row-between" style={{ marginTop: 12 }}>
            <button className="btn p sm" onClick={() => guard('Approve water result for ' + w.swid, () => approve(w))}>Approve and certify</button>
            <button className="btn sm danger" onClick={() => guard('Flag water result for ' + w.swid, () => flag(w))}>Flag, require retest</button>
          </div>
        </div>
      ))}
      {done.length > 0 && (
        <>
          <h3 className="serif" style={{ fontSize: 17, marginTop: 24 }}>Reviewed facilities</h3>
          {done.map(w => (
            <div className="ord" key={w.swid}><div className="top"><div><b style={{ fontFamily: 'Lora,serif', fontSize: 15 }}>{w.facility}</b><div className="muted" style={{ fontSize: 12.5 }}>{w.swid}{w.certSeries ? ' · ' + w.certSeries : ''}</div></div><span className={'status ' + (w.status === 'Certified' ? 'RELEASED' : 'Flag')}>{w.status}</span></div></div>
          ))}
        </>
      )}
    </div>
  )
}


function Analytics() {
  const [d, setD] = useState(null)
  useEffect(() => {
    Promise.all([store.listAllOrders(), store.listEscrow(), store.listAllWaterTests(), store.listAllCertificates()]).then(([orders, esc, water, certs]) => {
      const by = {}; orders.forEach(o => by[o.status || 'Scheduled'] = (by[o.status || 'Scheduled'] || 0) + 1)
      const cby = {}; certs.forEach(c => cby[c.status || 'VALID'] = (cby[c.status || 'VALID'] || 0) + 1)
      const sum = a => a.reduce((x, e) => x + (e.amount || 0), 0)
      const rel = esc.filter(e => e.status === 'RELEASED'), held = esc.filter(e => e.status === 'HELD')
      setD({ by, cby, heldAmt: sum(held), relAmt: sum(rel), relN: rel.length, food: esc.filter(e => e.type !== 'WATER').length, water: esc.filter(e => e.type === 'WATER').length, valid: cby['VALID'] || 0, orders: orders.length, waterN: water.length })
    })
  }, [])
  if (!d) return <div className="skelrow"><div className="skel" style={{height:74}} /><div className="skel" style={{height:230}} /></div>
  const certColor = k => k === 'VALID' ? CHART[0] : k === 'EXPIRED' ? CHART[1] : CHART[4]
  return (
    <div>
      <div className="tiles" style={{ marginBottom: 16 }}>
        <div className="tile"><div className="v">{d.valid}</div><div className="k">Valid certificates</div></div>
        <div className="tile"><div className="v">{d.orders}</div><div className="k">Total test orders</div></div>
        <div className="tile"><div className="v">{d.relN}</div><div className="k">Escrow releases</div></div>
        <div className="tile"><div className="v">{naira(d.relAmt)}</div><div className="k">Disbursed to date</div></div>
      </div>
      <div className="chartgrid">
        <ChartCard title="Certificates by status" hint="live"><Donut center={d.valid} sub="valid" data={Object.keys(d.cby).length ? Object.keys(d.cby).map(k => ({ label: k, value: d.cby[k], color: certColor(k) })) : [{ label: 'None yet', value: 1, color: 'var(--line)' }]} /></ChartCard>
        <ChartCard title="Testing pipeline" hint="orders by status"><Bars data={Object.keys(d.by).length ? Object.keys(d.by).map(k => ({ label: k, value: d.by[k], color: statusColor(k) })) : [{ label: 'No orders', value: 0 }]} /></ChartCard>
        <ChartCard title="Escrow held vs released" hint="by value"><Donut center={naira(d.heldAmt + d.relAmt)} sub="in system" data={[{ label: 'Held', value: d.heldAmt || 0.0001, display: naira(d.heldAmt), color: CHART[1] }, { label: 'Released', value: d.relAmt || 0.0001, display: naira(d.relAmt), color: CHART[0] }]} /></ChartCard>
        <ChartCard title="Where a ₦15,000 fee goes" hint="five-way waterfall"><Donut center="₦15k" sub="per test" data={WATERFALL.map((w, i) => ({ label: w.who.split(',')[0], value: w.amount, display: naira(w.amount), color: CHART[i % CHART.length] }))} /></ChartCard>
        <ChartCard title="Volume by type" hint="food vs water"><Bars data={[{ label: 'Food handler', value: d.food, color: CHART[0] }, { label: 'Water facility', value: d.water, color: CHART[3] }]} /></ChartCard>
      </div>
    </div>
  )
}


export default RegulatorModule
