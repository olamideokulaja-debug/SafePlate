// Laboratory portal: sample queue, result submission (single + bulk Excel),
// accreditation checks. Lazy-loaded chunk (refactor item 1).
/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import { useState, useEffect, useMemo } from 'react'
import { SUPABASE_READY } from '../lib/config.ts'
import { statusKey } from '../lib/helpers.ts'
import * as XLSX from 'xlsx'
import { unzipSync, zipSync } from 'fflate'
import { store, labsView } from '../lib/store.ts'
import { MANDATORY_TESTS, slaExceeded } from '../lib/constants.ts'
import { t } from '../lib/i18n.ts'
import { toast } from '../lib/toast.ts'
import { AppealButton } from '../components/Appeals.tsx'
import Insights from '../components/Insights.tsx'
import LabAvailability from '../components/LabAvailability.tsx'

function LaboratoryModule({ session, tab, adminView }) {
  if (tab === 'availability') return <LabAvailability session={session} adminView={adminView} />
  return <LabQueue session={session} adminView={adminView} />
}


function LabQueue({ session, adminView }) {
  const [accreditedLabs, setAccreditedLabs] = useState(() => labsView().filter(l => l.accredited))
  useEffect(() => { store.accreditedLabList().then(list => { if (list && list.length) setAccreditedLabs(list) }).catch(() => {}) }, [])
  const [labName, setLabName] = useState(() => { const a = labsView().filter(l => l.accredited); return a[0] ? a[0].name : '' })
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const lab = accreditedLabs.find(l => l.name === labName)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkTech, setBulkTech] = useState('')
  const [bulkResult, setBulkResult] = useState(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  async function downloadResultWorkbook() {
    if (!lab) { toast('Select your laboratory first.', 'err'); return }
    let waiting = []
    try { waiting = await store.listAwaitingResults(lab.name) } catch (e) { waiting = [] }
    if (!waiting.length) { toast('No samples are currently awaiting results at this laboratory.', 'warn'); return }
    // Header row plus one pre-filled row per waiting client. The tech only
    // fills the three result columns, choosing Pass or Fail from a dropdown.
    const header = ['SAFEPLATE ID', 'Client name', 'Hepatitis A', 'Hepatitis E', 'Stool MC']
    const rows = waiting.map(o => [o.safeplateId, o.handlerName, '', '', ''])
    const aoa = [header, ...rows]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = [{ wch: 20 }, { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 14 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Results')
    // A short instructions sheet so the tech knows exactly what to do.
    const help = XLSX.utils.aoa_to_sheet([
      ['SafePlate bulk results, ' + lab.name],
      [''],
      ['1. Do not change the SAFEPLATE ID or Client name columns.'],
      ['2. For each client, choose Pass or Fail in the three result columns.'],
      ['3. Pass means the client is clear for that test. Fail means a referral is needed.'],
      ['4. Leave a row blank if that client has not been tested yet, and it will be skipped.'],
      ['5. Save the file and upload it back into SafePlate.'],
      [''],
      ['Accreditation number applied on upload: ' + (lab.accNo || lab.acc_no || 'none, results cannot be submitted')],
      ['Generated: ' + new Date().toLocaleString('en-GB')]
    ])
    help['!cols'] = [{ wch: 90 }]
    XLSX.utils.book_append_sheet(wb, help, 'Instructions')
    // SheetJS community build drops data validation, so we inject the Pass/Fail
    // dropdown into the sheet XML by hand: generate, unzip, patch, re-zip.
    const last = rows.length + 1
    const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    let outBytes = bytes
    try {
      const files = unzipSync(new Uint8Array(bytes))
      const sheetPath = Object.keys(files).find(k => /xl\/worksheets\/sheet1\.xml$/.test(k))
      if (sheetPath) {
        const dec = new TextDecoder(), enc = new TextEncoder()
        let xml = dec.decode(files[sheetPath])
        const dv = '<dataValidations count="1"><dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" sqref="C2:E' + last + '"><formula1>&quot;Pass,Fail&quot;</formula1></dataValidation></dataValidations>'
        if (xml.includes('</sheetData>')) { xml = xml.replace('</sheetData>', '</sheetData>' + dv); files[sheetPath] = enc.encode(xml); outBytes = zipSync(files) }
      }
    } catch (e) { /* fall back to the workbook without dropdowns */ }
    const blob = new Blob([outBytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a')
    a.href = url; a.download = 'SafePlate-Results-' + lab.name.replace(/[^A-Za-z0-9]+/g, '-') + '.xlsx'; a.click(); URL.revokeObjectURL(url)
    toast('Workbook ready with ' + waiting.length + ' waiting client' + (waiting.length === 1 ? '' : 's') + '.')
  }
  async function bulkUpload(file) {
    setBulkResult(null)
    if (!lab) { toast('Select your laboratory first.', 'err'); return }
    if (!(lab.accNo || lab.acc_no)) { toast('Your laboratory has no accreditation number yet, so results cannot be submitted.', 'err'); return }
    if (!bulkTech.trim()) { toast('Enter the technician ID that applies to this upload.', 'err'); return }
    // Read the workbook (or CSV) into a grid of rows.
    let grid = []
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheet = wb.Sheets['Results'] || wb.Sheets[wb.SheetNames[0]]
      grid = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' })
    } catch (e) { toast('Could not read that file. Upload the .xlsx workbook you downloaded.', 'err'); return }
    if (!grid.length || grid.length < 2) { toast('The workbook has no result rows.', 'err'); return }
    // Locate the columns from the header, tolerating either the friendly labels
    // or the old machine names.
    const head = grid[0].map(h => String(h || '').trim().toLowerCase())
    const find = (...names) => { for (const n of names) { const i = head.indexOf(n); if (i >= 0) return i } return -1 }
    const idx = {
      id: find('safeplate id', 'safeplate_id'),
      a: find('hepatitis a', 'hepatitis_a'),
      e: find('hepatitis e', 'hepatitis_e'),
      mc: find('stool mc', 'stool_mc', 'stool microscopy & culture (mc)')
    }
    if ([idx.id, idx.a, idx.e, idx.mc].some(v => v < 0)) { toast('Could not find the result columns. Use the workbook downloaded from this page.', 'err'); return }
    const norm = v => { const x = String(v == null ? '' : v).trim().toLowerCase(); if (['pass', 'negative', 'normal', 'clear'].includes(x)) return 'pass'; if (['fail', 'refer', 'positive', 'abnormal'].includes(x)) return 'refer'; return x }
    const T = MANDATORY_TESTS
    const all = grid.slice(1).map(c => ({
      safeplateId: String(c[idx.id] == null ? '' : c[idx.id]).trim().toUpperCase(),
      technicianId: bulkTech.trim(),
      accreditationNumber: (lab.accNo || lab.acc_no),
      results: { [T[0]]: norm(c[idx.a]), [T[1]]: norm(c[idx.e]), [T[2]]: norm(c[idx.mc]) }
    })).filter(r => r.safeplateId)
    // A row left entirely blank is an untested client, quietly skipped.
    const rows = all.filter(r => Object.values(r.results).some(v => v !== ''))
    if (!rows.length) { toast('No results were filled in. Choose Pass or Fail for at least one client.', 'err'); return }
    const bad = rows.filter(r => Object.values(r.results).some(v => !['pass', 'refer'].includes(v)))
    if (bad.length) { toast(bad.length + ' row(s) have a result that is not Pass or Fail. Every filled client needs both.', 'err'); return }
    const partial = rows.filter(r => Object.values(r.results).some(v => v === ''))
    if (partial.length) { toast(partial.length + ' client(s) have some but not all three results filled. Complete all three, or clear the row.', 'err'); return }
    setBulkBusy(true)
    try {
      if (SUPABASE_READY) {
        // Pre-flight: confirm this session's token actually carries the
        // laboratory role, since that is the commonest cause of a rejected
        // upload and the message is clearer before the round trip.
        const tokenRole = await store.currentTokenRole()
        if (tokenRole !== 'laboratory') {
          setBulkBusy(false)
          toast('This session is signed in as "' + (tokenRole || 'no role') + '", not as a laboratory, so results cannot be submitted. Sign out and sign in again through the Laboratory portal, then try once more.', 'err')
          return
        }
        const r = await store.bulkSubmitResults(rows)
        setBulkResult(r)
        toast('Uploaded: ' + r.submitted + ' submitted' + (r.quarantined ? ', ' + r.quarantined + ' quarantined' : '') + (r.notFound ? ', ' + r.notFound + ' not matched' : '') + '.', (r.notFound || r.failed) ? 'warn' : undefined)
      } else {
        let ok = 0
        for (const row of rows) {
          const o = orders.find(x => x.safeplateId === row.safeplateId && x.status === 'Scheduled')
          if (!o) continue
          const anyRefer = Object.values(row.results).some(v => v === 'refer')
          await store.updateOrder(o.id, { status: 'Submitted', results: row.results, technicianId: row.technicianId, submittedAt: new Date().toISOString(), reportedLsmoh: anyRefer })
          ok++
        }
        setBulkResult({ submitted: ok, quarantined: 0, notFound: rows.length - ok, failed: 0, total: rows.length })
        toast('Uploaded ' + ok + ' of ' + rows.length + ' results.')
      }
      refresh()
    } catch (e) { toast('Bulk upload failed: ' + (e.message || 'the server refused this action.'), 'err') }
    setBulkBusy(false)
  }
  async function refresh() { setLoading(true); setOrders(await store.listOrders(labName)); setLoading(false) }
  useEffect(() => { refresh() /* eslint-disable-next-line */ }, [labName])
  async function advance(o, status) {
    if (SUPABASE_READY) { try { await store.fn('advance-order', { orderId: o.id, status }); toast('Sample updated: ' + status + '.'); refresh(); return } catch (e) { toast('Could not update the sample: ' + (e.message || 'try again'), 'err'); return } }
    await store.updateOrder(o.id, { status }); toast('Sample updated: ' + status + '.'); refresh()
  }

  return (
    <div className="page"><div className="wrap">
      <div className="greeting"><h2 className="sec serif" style={{ margin: 0 }}>Laboratory queue</h2><span className="muted" style={{ fontSize: 13 }}>{session.name}</span></div>
      {(() => {
        const late = orders.filter(o => ['Scheduled', 'Sample Collected', 'Testing in Progress'].includes(o.status) && slaExceeded(o))
        if (!late.length) return null
        return <div className="note" style={{ marginBottom: 16, borderColor: '#b3261e', background: '#fdeeee' }}><b>{late.length} sample{late.length === 1 ? ' has' : 's have'} passed the 48-hour turnaround.</b> The Ministry is notified automatically when this happens. Submit these results first: {late.slice(0, 5).map(o => o.safeplateId).join(', ')}{late.length > 5 ? ' and others' : ''}.</div>
      })()}
      <div className="row-between" style={{ marginBottom: 16 }}>
        <span className="muted" style={{ fontSize: 13 }}>Viewing queue for:</span>
        <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select value={labName} onChange={e => setLabName(e.target.value)} style={{ padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 9, fontFamily: 'inherit', fontSize: 14 }}>{accreditedLabs.map(l => <option key={l.id}>{l.name}</option>)}</select>
          <span className="muted" style={{ fontSize: 12.5 }}>{lab && (lab.accNo || lab.acc_no) ? 'Accreditation ' + (lab.accNo || lab.acc_no) : 'Accreditation number pending'}</span>
        </span>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row-between" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3 className="serif" style={{ fontSize: 16, margin: 0 }}>Upload results in bulk</h3>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>Download a spreadsheet already listing every client waiting for results at this laboratory. Choose Pass or Fail for each, then upload it back.</div>
          </div>
          <button className="btn sm" onClick={() => setBulkOpen(v => !v)}>{bulkOpen ? 'Close' : 'Bulk upload'}</button>
        </div>
        {adminView && <div className="note" style={{ marginTop: 12, borderColor: 'var(--gold)', background: '#fdf8ee', fontSize: 13 }}>You are viewing this laboratory workspace as an LSMoH administrator. This is a read-only oversight view, so results cannot be submitted from here. Only the laboratory's own account can submit results.</div>}
        {bulkOpen && (
          <div style={{ marginTop: 14 }}>
            <div className="field" style={{ maxWidth: 260 }}><label>Technician ID for this batch</label><input value={bulkTech} onChange={e => setBulkTech(e.target.value)} placeholder="e.g. MLS-2291" /></div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn ghost sm" onClick={downloadResultWorkbook}>Download results workbook</button>
              <label className={'btn p sm' + (adminView ? ' disabled' : '')} style={{ cursor: adminView ? 'not-allowed' : 'pointer', margin: 0, opacity: adminView ? 0.55 : 1 }} title={adminView ? 'Read-only oversight view' : undefined}>
                {bulkBusy ? 'Uploading...' : 'Upload completed workbook'}
                <input type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style={{ display: 'none' }} disabled={bulkBusy || adminView} onChange={e => { const f = e.target.files && e.target.files[0]; if (f) bulkUpload(f); e.target.value = '' }} />
              </label>
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>The workbook lists each waiting client with their SAFEPLATE ID already filled in. For each of the three tests choose Pass or Fail from the dropdown. Leave a client's row blank to skip them this time. Your accreditation number is applied automatically on upload.</div>
            {bulkResult && (
              <div className="note" style={{ marginTop: 12, borderColor: (bulkResult.notFound || bulkResult.failed) ? 'var(--gold)' : '#bcdcbc', background: (bulkResult.notFound || bulkResult.failed) ? '#fdf8ee' : 'var(--green-pale)' }}>
                <b>{bulkResult.submitted} submitted</b> for Ministry review out of {bulkResult.total}.
                {bulkResult.quarantined ? ' ' + bulkResult.quarantined + ' quarantined (accreditation mismatch).' : ''}
                {bulkResult.notFound ? ' ' + bulkResult.notFound + ' had no waiting sample and were skipped.' : ''}
                {bulkResult.failed ? ' ' + bulkResult.failed + ' failed.' : ''}
                {Array.isArray(bulkResult.problems) && bulkResult.problems.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 12.5 }}>{bulkResult.problems.slice(0, 8).map((p, i) => <div key={i}>· <span className="mono">{p.safeplateId}</span>: {p.reason}</div>)}</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="note" style={{ marginBottom: 18 }}>You see only this laboratory's orders. Results are encrypted at rest (AES-256) in the connected build, and payment is released only after Ministry approval, not on upload.</div>
      <Insights session={session} />
      <AppealButton kind="laboratory" subject={labName} agency="LSMoH" by={session.email} label="Raise a dispute or appeal with the Ministry" />
      {loading && <p className="muted">Loading queue...</p>}
      {!loading && orders.length === 0 && <div className="placeholder">No orders in this laboratory's queue yet. New paid orders appear here automatically.</div>}
      {!loading && orders.map(o => <OrderCard key={o.id} order={o} lab={lab} onAdvance={advance} onRefresh={refresh} />)}
    </div></div>
  )
}


function OrderCard({ order, lab, onAdvance, onRefresh }) {
  const [results, setResults] = useState({})
  const [tech, setTech] = useState('')
  const [accNo, setAccNo] = useState('')
  const [fileName, setFileName] = useState('')
  const [err, setErr] = useState('')
  const sk = statusKey(order.status)
  const referred = order.results ? order.tests.filter(t => order.results[t] === 'refer') : []

  async function submit() {
    setErr('')
    if (order.tests.some(t => !results[t]) || !tech.trim() || !accNo.trim()) { setErr('Enter a result for every test, plus technician ID and accreditation number.'); return }
    if (SUPABASE_READY) { try { await store.fn('submit-result', { orderId: order.id, results, technicianId: tech.trim(), accreditationNumber: accNo.trim() }); onRefresh(); return } catch (e) { setErr(e.message); return } }
    if (accNo.trim() !== lab.accNo) { await store.updateOrder(order.id, { status: 'Quarantined', note: 'Accreditation number mismatch, referred to LSMoH for investigation.' }); onRefresh(); return }
    const ref = order.tests.filter(t => results[t] === 'refer')
    await store.updateOrder(order.id, { status: 'Submitted', results, technicianId: tech.trim(), accreditationNumber: accNo.trim(), resultFile: fileName || 'result.pdf', reportedLsmoh: ref.length > 0, biobankConfirm: ref.length > 0, submittedAt: new Date().toISOString() })
    await store.notify('LSMoH', 'Results submitted', order.handlerName + ' is pending Ministry review')
    onRefresh()
  }

  return (
    <div className="ord">
      <div className="top">
        <div><b style={{ fontFamily: 'Lora,serif', fontSize: 16 }}>{order.handlerName}</b><div className="muted" style={{ fontSize: 12.5 }}>{order.safeplateId} · {order.id}</div>
          {(order.appointmentDate || order.appointment_date) && <div style={{ fontSize: 12.5, color: 'var(--green)', fontWeight: 600, marginTop: 3 }}>Appointment: {new Date(order.appointmentDate || order.appointment_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}{(order.appointmentSlot || order.appointment_slot) ? ', ' + (order.appointmentSlot || order.appointment_slot) : ''}</div>}
        </div>
        <span className={'status ' + sk}>{order.status}</span>
      </div>
      {err && <div className="err" style={{ marginTop: 12 }}>{err}</div>}
      {order.status === 'Scheduled' && (
        <div className="row-between" style={{ marginTop: 14 }}>
          <button className="btn p sm" onClick={() => onAdvance(order, 'Sample Collected')}>Mark sample collected</button>
          <span style={{ display: 'flex', gap: 8 }}><button className="btn sm danger" onClick={() => onAdvance(order, 'No Show')}>No show</button><button className="btn sm danger" onClick={() => onAdvance(order, 'Spoiled sample')}>Spoiled sample</button></span>
        </div>
      )}
      {order.status === 'Sample Collected' && (
        <div className="row-between" style={{ marginTop: 14 }}><button className="btn p sm" onClick={() => onAdvance(order, 'Testing in Progress')}>Start testing</button><button className="btn sm danger" onClick={() => onAdvance(order, 'Spoiled sample')}>Spoiled sample</button></div>
      )}
      {order.status === 'Testing in Progress' && (
        <div style={{ marginTop: 14 }}>
          {order.tests.map(t => (
            <div className="res-grid" key={t}><span style={{ fontSize: 14 }}>{t}</span>
              <select value={results[t] || ''} onChange={e => setResults(r => ({ ...r, [t]: e.target.value }))} style={{ padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 8 }}>
                <option value="">Result...</option><option value="pass">Pass</option><option value="refer">Refer</option></select></div>
          ))}
          <div className="field" style={{ marginTop: 12 }}><label>Technician ID</label><input value={tech} onChange={e => setTech(e.target.value)} placeholder="e.g. TECH-2231" /></div>
          <div className="field"><label>Laboratory accreditation number</label><input value={accNo} onChange={e => setAccNo(e.target.value)} placeholder={lab.accNo} /></div>
          <div className="field"><label>Result PDF</label><input type="file" onChange={e => setFileName(e.target.files && e.target.files[0] ? e.target.files[0].name : '')} /></div>
          <button className="btn p block" onClick={submit}>Submit results for Ministry review</button>
          <p className="muted" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>An accreditation number that does not match {lab.accNo} quarantines the order and alerts LSMoH.</p>
        </div>
      )}
      {order.status === 'Submitted' && (
        <div style={{ marginTop: 14 }}>
          <div className="note" style={{ background: 'var(--green-pale)', borderColor: '#bcdcbc' }}>Submitted and pending Ministry review. Payment releases only after approval.</div>
          <table className="split-tbl" style={{ marginTop: 10 }}><tbody>{order.tests.map(t => (
            <tr key={t}><td>{t}</td><td style={{ textAlign: 'right', fontWeight: 600, color: order.results && order.results[t] === 'refer' ? '#b3261e' : 'var(--green)' }}>{order.results && order.results[t] === 'refer' ? 'Refer' : 'Pass'}</td></tr>
          ))}</tbody></table>
          {referred.length > 0 && (<div style={{ marginTop: 10 }}><div className="err">Communicable-disease result reported to LSMoH.</div><div className="note" style={{ marginTop: 8 }}>Sample referred to the Lagos Biobank for confirmatory testing.</div></div>)}
        </div>
      )}
      {order.status === 'No Show' && (<div className="row-between" style={{ marginTop: 14 }}><span className="muted" style={{ fontSize: 13.5 }}>Marked as no show. The food handler has been alerted to reschedule within 7 days.</span><button className="btn sm" onClick={() => onAdvance(order, 'Scheduled')}>Reschedule</button></div>)}
      {order.status === 'Spoiled sample' && (<div className="row-between" style={{ marginTop: 14 }}><span className="muted" style={{ fontSize: 13.5 }}>Sample flagged as spoiled. The food handler has been asked to return for re-collection.</span><button className="btn sm" onClick={() => onAdvance(order, 'Sample Collected')}>Re-collect</button></div>)}
      {order.status === 'Quarantined' && (<div className="err" style={{ marginTop: 14 }}>{order.note || 'Order quarantined and referred to LSMoH.'}</div>)}
    </div>
  )
}


export default LaboratoryModule
