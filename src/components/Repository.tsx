// @ts-nocheck
// Central document repository (item 7). A single searchable, filterable archive of
// every document the platform produces: certificates, payment receipts, enforcement
// letters, QA audit reports, water-facility certificates and lab-result records.
// Documents are generated on demand from the underlying records (nothing is stored
// twice), so the repository always reflects live data. Scoped to LSMoH as the
// central archive; the same component could be given a narrower scope per portal.
import { useState, useEffect, useMemo } from 'react'
import { store, exportCsv } from '../lib/store.ts'
import { naira } from '../lib/constants.ts'
import { generateCertPDF, generateReceiptPDF, generateEnforcementLetter, generateQaReportPDF } from '../lib/helpers.ts'

const TYPES = [
  { id: 'certificate', label: 'Certificates' },
  { id: 'receipt', label: 'Receipts' },
  { id: 'enforcement', label: 'Enforcement letters' },
  { id: 'qa', label: 'QA reports' },
  { id: 'water', label: 'Water certificates' },
  { id: 'result', label: 'Lab results' },
]

export default function Repository({ session }) {
  const [docs, setDocs] = useState(null)
  const [type, setType] = useState('all')
  const [q, setQ] = useState('')
  useEffect(() => { load() /* eslint-disable-next-line */ }, [])

  async function load() {
    const [certs, orders, water, audits, establishments] = await Promise.all([
      store.listAllCertificates().catch(() => []),
      store.listAllOrders().catch(() => []),
      store.listAllWaterTests().catch(() => []),
      store.listLabAudits().catch(() => []),
      store.listEstablishments().catch(() => []),
    ])
    const rows = []
    // Certificates of Fitness
    for (const c of certs) {
      const id = c.safeplateId || c.safeplate_id
      rows.push({ kind: 'certificate', title: 'Certificate of Fitness', ref: id, name: c.name, date: c.issued, status: c.status, download: () => generateCertPDF(c) })
    }
    // Payment receipts (one per paid order)
    for (const o of orders) {
      const id = o.safeplateId || o.safeplate_id
      rows.push({ kind: 'receipt', title: 'Payment receipt', ref: id, name: o.handlerName || o.handler_name, date: o.createdAt || o.created_at, status: o.status, download: () => generateReceiptPDF({ reference: o.paymentRef || o.id, safeplateId: id, name: o.handlerName || o.handler_name, lab: o.lab, paidAt: o.createdAt || o.created_at, amount: 15000, type: 'FOOD' }) })
    }
    // Water-facility certificates / records
    for (const w of water) {
      rows.push({ kind: 'water', title: 'Water facility test', ref: w.swid || w.safeplateId || w.safeplate_id, name: w.facility || w.name, date: w.createdAt || w.created_at, status: w.status, download: null })
    }
    // Lab QA audit reports
    for (const a of audits) {
      rows.push({ kind: 'qa', title: 'Laboratory QA report', ref: a.labId || a.lab_id || a.id, name: a.labName || a.lab || 'Laboratory', date: a.ts || a.createdAt || a.created_at, status: a.grade || a.outcome, download: () => generateQaReportPDF({ answers: a.answers || {}, ts: a.ts }, { name: a.labName || a.lab || 'Laboratory', accreditationNumber: a.accreditationNumber || a.accNo || '', lga: a.lga || '' }) })
    }
    // Enforcement letters (for sanctioned establishments)
    for (const e of establishments) {
      if (!e.sanction && !e.compliance) continue
      rows.push({ kind: 'enforcement', title: 'Enforcement letter', ref: e.id || e.name, name: e.name, date: e.updatedAt || e.updated_at || e.createdAt || e.created_at, status: e.sanction || e.compliance, download: () => generateEnforcementLetter({ name: e.name, lga: e.lga, address: e.address, sanction: e.sanction || 'Compliance action', compliance: e.compliance }, { name: (session && session.name) || 'LSMoH', agency: (session && session.agency) || 'LSMoH', email: (session && session.email) || '' }) })
    }
    // Lab result records (metadata only; the actual panel is encrypted and access-controlled)
    for (const o of orders) {
      if (o.status !== 'Submitted' && o.status !== 'Approved' && o.status !== 'Rejected') continue
      rows.push({ kind: 'result', title: 'Lab result record', ref: o.safeplateId || o.safeplate_id, name: o.handlerName || o.handler_name, date: o.submittedAt || o.submitted_at || o.createdAt, status: o.status, download: null })
    }
    rows.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    setDocs(rows)
  }

  const shown = useMemo(() => {
    if (!docs) return []
    const ql = q.trim().toLowerCase()
    return docs.filter(d => (type === 'all' || d.kind === type) && (!ql || ((d.ref || '') + ' ' + (d.name || '') + ' ' + (d.title || '')).toLowerCase().includes(ql)))
  }, [docs, type, q])

  const counts = useMemo(() => {
    const c = {}
    for (const d of (docs || [])) c[d.kind] = (c[d.kind] || 0) + 1
    return c
  }, [docs])

  function exportIndex() {
    exportCsv(shown, [
      { label: 'Type', get: d => (TYPES.find(t => t.id === d.kind) || {}).label || d.kind },
      { label: 'Title', key: 'title' },
      { label: 'Reference', key: 'ref' },
      { label: 'Name', key: 'name' },
      { label: 'Date', get: d => d.date ? new Date(d.date).toLocaleDateString('en-GB') : '' },
      { label: 'Status', key: 'status' },
    ], 'safeplate-document-index.csv')
  }

  return (
    <div style={{ marginBottom: 26 }}>
      <h3 className="serif" style={{ fontSize: 18, marginBottom: 4 }}>Document repository</h3>
      <p className="muted" style={{ marginTop: 0, fontSize: 13, marginBottom: 14 }}>
        Central archive of every document the programme produces. Documents are built
        on demand from live records, so this always reflects current data. Medical
        result panels remain encrypted and are not downloadable here.
      </p>

      <div className="tiles" style={{ marginBottom: 14 }}>
        {TYPES.map(t => (
          <div key={t.id} className="tile" style={{ cursor: 'pointer', outline: type === t.id ? '2px solid var(--green)' : 'none' }} onClick={() => setType(type === t.id ? 'all' : t.id)}>
            <div className="v">{counts[t.id] || 0}</div><div className="k">{t.label}</div>
          </div>
        ))}
      </div>

      <div className="row-between" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by SAFEPLATE ID, name or title" style={{ flex: 1, minWidth: 220 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={type} onChange={e => setType(e.target.value)}>
            <option value="all">All types</option>
            {TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <button className="btn sm" onClick={exportIndex} disabled={!shown.length}>Export index (CSV)</button>
        </div>
      </div>

      {docs === null && <div className="skelrow"><div className="skel" style={{ height: 44 }} /><div className="skel" style={{ height: 180 }} /></div>}
      {docs && shown.length === 0 && <div className="placeholder">No documents match. Adjust the search or type filter.</div>}
      {docs && shown.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="tbl" style={{ width: '100%' }}>
            <thead><tr><th>Type</th><th>Reference</th><th>Name</th><th>Date</th><th>Status</th><th style={{ textAlign: 'right' }}>Document</th></tr></thead>
            <tbody>
              {shown.slice(0, 300).map((d, i) => (
                <tr key={i}>
                  <td>{d.title}</td>
                  <td className="mono" style={{ fontSize: 12.5 }}>{d.ref || '\u2014'}</td>
                  <td>{d.name || '\u2014'}</td>
                  <td className="muted" style={{ whiteSpace: 'nowrap' }}>{d.date ? new Date(d.date).toLocaleDateString('en-GB') : '\u2014'}</td>
                  <td>{d.status ? <span className="badge">{d.status}</span> : '\u2014'}</td>
                  <td style={{ textAlign: 'right' }}>{d.download ? <button className="btn xs" onClick={() => { try { d.download() } catch (e) { } }}>Download</button> : <span className="muted" style={{ fontSize: 12 }}>Record only</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {docs && shown.length > 300 && <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Showing the first 300 of {shown.length}. Narrow with search or export the full index.</p>}
    </div>
  )
}
