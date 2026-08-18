// @ts-nocheck
// Shared reporting module: date-ranged activity/financial report with CSV + PDF
// export. Used by the Sterling portal (financial scope) and the regulator portals
// (activity scope). scope='sterling' shows revenue/disbursement; other scopes hide them.
import { useState, useEffect } from 'react'
import { jsPDF } from 'jspdf'
import { store, exportCsv } from '../lib/store.ts'
import { naira, FEE } from '../lib/constants.ts'

export default function ReportingModule({ session, scope }) {
  const [range, setRange] = useState('30')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { load() /* eslint-disable-next-line */ }, [range])
  async function load() {
    setLoading(true)
    try {
      const [certs, orders, escrow, releases, water] = await Promise.all([
        store.listAllCertificates().catch(() => []),
        store.listAllOrders().catch(() => []),
        store.listEscrow().catch(() => []),
        store.listReleases().catch(() => []),
        store.listAllWaterTests().catch(() => [])
      ])
      const days = Number(range)
      const since = days ? Date.now() - days * 86400000 : 0
      const inRange = ts => !since || (ts && new Date(ts).getTime() >= since)
      const certsR = certs.filter(c => inRange(c.issued))
      const ordersR = orders.filter(o => inRange(o.createdAt || o.created_at))
      const relR = releases.filter(r => inRange(r.ts))
      const foodRevenue = ordersR.length * FEE
      const disbursed = escrow.filter(e => e.status === 'RELEASED' && inRange(e.releasedTs || e.released_ts)).reduce((a, e) => a + (e.amount || 0), 0)
      setData({
        certsIssued: certsR.length,
        certsValid: certs.filter(c => c.status === 'VALID').length,
        ordersCreated: ordersR.length,
        awaitingReview: orders.filter(o => o.status === 'Submitted').length,
        waterTests: water.filter(w => inRange(w.createdAt || w.created_at)).length,
        revenue: foodRevenue,
        disbursed,
        releases: relR.length,
        byStatus: ['Scheduled', 'Submitted', 'Approved', 'Rejected', 'Flagged'].map(st => ({ status: st, n: orders.filter(o => o.status === st).length })),
        certsList: certsR
      })
    } catch (e) { setData(null) }
    setLoading(false)
  }
  function exportSummary() {
    if (!data) return
    const rows = [
      { metric: 'Certificates issued (period)', value: data.certsIssued },
      { metric: 'Certificates currently valid', value: data.certsValid },
      { metric: 'Test orders created (period)', value: data.ordersCreated },
      { metric: 'Awaiting Ministry review', value: data.awaitingReview },
      { metric: 'Water tests (period)', value: data.waterTests },
      { metric: 'Food testing revenue (period)', value: data.revenue },
      { metric: 'Escrow disbursed (period)', value: data.disbursed },
      { metric: 'Releases (period)', value: data.releases }
    ]
    exportCsv(rows, [{ label: 'Metric', key: 'metric' }, { label: 'Value', key: 'value' }], 'safeplate-report-' + range + 'd.csv')
  }
  function exportPdf() {
    if (!data) return
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    const W = doc.internal.pageSize.getWidth(), M = 54; let y = 58
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(0, 102, 0)
    doc.text('SAFEPLATE ' + (scope === 'sterling' ? 'FINANCIAL' : 'ACTIVITY') + ' REPORT', M, y); y += 18
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(90, 90, 90)
    doc.text('Period: last ' + range + ' days  ·  Generated ' + new Date().toLocaleString('en-GB'), M, y); y += 22
    doc.setDrawColor(0, 102, 0); doc.setLineWidth(1.2); doc.line(M, y, W - M, y); y += 24
    const line = (k, v) => { doc.setTextColor(110, 110, 110); doc.setFontSize(11); doc.text(k, M, y); doc.setTextColor(20, 20, 20); doc.setFont('helvetica', 'bold'); doc.text(String(v), W - M, y, { align: 'right' }); doc.setFont('helvetica', 'normal'); y += 20 }
    line('Certificates issued', data.certsIssued)
    line('Certificates currently valid', data.certsValid)
    line('Test orders created', data.ordersCreated)
    line('Awaiting Ministry review', data.awaitingReview)
    line('Water tests', data.waterTests)
    if (scope === 'sterling') { line('Food testing revenue', naira(data.revenue)); line('Escrow disbursed', naira(data.disbursed)); line('Releases processed', data.releases) }
    doc.save('SafePlate-Report-' + range + 'd.pdf')
  }
  return (
    <div>
      <div className="row-between" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['7', '7 days'], ['30', '30 days'], ['90', '90 days'], ['0', 'All time']].map(([v, l]) => (
            <button key={v} className={'btn sm' + (range === v ? ' p' : '')} onClick={() => setRange(v)}>{l}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn sm" onClick={exportSummary} disabled={!data}>Export CSV</button>
          <button className="btn sm" onClick={exportPdf} disabled={!data}>Export PDF</button>
        </div>
      </div>
      {loading && <p className="muted">Compiling report...</p>}
      {data && (<>
        <div className="tiles">
          <div className="tile"><div className="v">{data.certsIssued}</div><div className="k">Certificates issued</div></div>
          <div className="tile"><div className="v">{data.ordersCreated}</div><div className="k">Test orders</div></div>
          <div className="tile"><div className="v">{data.waterTests}</div><div className="k">Water tests</div></div>
          <div className="tile"><div className="v">{data.awaitingReview}</div><div className="k">Awaiting review</div></div>
        </div>
        {scope === 'sterling' && (
          <div className="tiles">
            <div className="tile"><div className="v">{naira(data.revenue)}</div><div className="k">Food testing revenue</div></div>
            <div className="tile"><div className="v">{naira(data.disbursed)}</div><div className="k">Escrow disbursed</div></div>
            <div className="tile"><div className="v">{data.releases}</div><div className="k">Releases</div></div>
            <div className="tile"><div className="v">{data.certsValid}</div><div className="k">Valid certificates</div></div>
          </div>
        )}
        <div className="card">
          <h3 className="serif" style={{ fontSize: 16, marginTop: 0 }}>Test orders by stage</h3>
          {data.byStatus.map(r => {
            const max = Math.max(1, ...data.byStatus.map(x => x.n))
            return (
              <div key={r.status} style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '8px 0' }}>
                <span style={{ width: 90, fontSize: 13 }}>{r.status}</span>
                <div style={{ flex: 1, background: 'var(--line)', borderRadius: 6, height: 18, overflow: 'hidden' }}><div style={{ width: (r.n / max * 100) + '%', background: 'var(--green)', height: '100%' }} /></div>
                <span style={{ width: 34, textAlign: 'right', fontWeight: 700, fontSize: 13 }}>{r.n}</span>
              </div>
            )
          })}
        </div>
      </>)}
    </div>
  )
}


