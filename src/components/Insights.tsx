// Shared insights/dashboard widget used by several portals.
/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import { useState, useEffect } from 'react'
import { WATER_WATERFALL } from '../lib/constants.ts'
import { store, labsView } from '../lib/store.ts'
import { naira, CHART, WATERFALL, statusColor } from '../lib/constants.ts'
import { t } from '../lib/i18n.ts'
import { Donut, Bars, ChartCard } from './Charts.tsx'

export function Insights({ session }) {
  const [d, setD] = useState(null)
  useEffect(() => { let on = true; compute().then(x => { if (on) setD(x) }); return () => { on = false } /* eslint-disable-next-line */ }, [])
  async function compute() {
    const role = session.role, agency = session.agency
    if (role === 'sterling') {
      const esc = await store.listEscrow(); const sum = a => a.reduce((x, e) => x + (e.amount || 0), 0)
      const held = esc.filter(e => e.status === 'HELD'), rel = esc.filter(e => e.status === 'RELEASED')
      return { v: 'sterling', heldAmt: sum(held), relAmt: sum(rel), food: esc.filter(e => e.type !== 'WATER').length, water: esc.filter(e => e.type === 'WATER').length }
    }
    if (role === 'laboratory') { const o = await store.listAllOrders(); const by = {}; o.forEach(x => by[x.status || 'Scheduled'] = (by[x.status || 'Scheduled'] || 0) + 1); return { v: 'lab', by } }
    if (role === 'employer') { const b = await store.getBusiness(session.email); const staff = (b && b.staff) || []; const by = {}; staff.forEach(x => by[x.status] = (by[x.status] || 0) + 1); return { v: 'employer', by, total: staff.length } }
    if (role === 'regulator' && agency === 'LASEPA') { const w = await store.listAllWaterTests(); const by = {}; w.forEach(x => by[x.status || 'Pending'] = (by[x.status || 'Pending'] || 0) + 1); return { v: 'lasepa', by, total: w.length } }
    if (role === 'regulator' && agency === 'HEFAMAA') { const labs = labsView(); const acc = labs.filter(l => l.accredited).length; return { v: 'hefamaa', acc, non: labs.length - acc, total: labs.length } }
    if (role === 'regulator' && agency === 'LSMoH') {
      const orders = await store.listAllOrders(); const certs = await store.listAllCertificates()
      const ordersBy = {}; orders.forEach(o => { ordersBy[o.status || 'Scheduled'] = (ordersBy[o.status || 'Scheduled'] || 0) + 1 })
      const certBy = {}; certs.forEach(c => { const st = c.status || 'VALID'; certBy[st] = (certBy[st] || 0) + 1 })
      return { v: 'lsmoh', ordersBy, certBy, totalOrders: orders.length, totalCerts: certs.length }
    }
    if (role === 'food_handler') return { v: 'none' }
    return { v: 'none' }
  }
  if (!d || d.v === 'none') return null

  if (d.v === 'sterling') return (
    <div className="chartgrid">
      <ChartCard title="Escrow position" hint="by value"><Donut center={naira(d.heldAmt + d.relAmt)} sub="in system" data={[{ label: 'Held in escrow', value: d.heldAmt || 0.0001, display: naira(d.heldAmt), color: CHART[1] }, { label: 'Released', value: d.relAmt || 0.0001, display: naira(d.relAmt), color: CHART[0] }]} /></ChartCard>
      <ChartCard title="Where a ₦15,000 food fee goes" hint="five-way waterfall"><Bars unit="naira" data={WATERFALL.map((w, i) => ({ label: w.who.split(',')[0], value: w.amount, color: CHART[i % CHART.length] }))} /></ChartCard>
      <ChartCard title="Where a ₦65,000 water fee goes" hint="four-way waterfall"><Bars unit="naira" data={WATER_WATERFALL.map((w, i) => ({ label: w.who.split(',')[0], value: w.amount, color: CHART[i % CHART.length] }))} /></ChartCard>
      <ChartCard title="Transactions by type"><Bars data={[{ label: 'Food handler', value: d.food, color: CHART[0] }, { label: 'Water facility', value: d.water, color: CHART[3] }]} /></ChartCard>
    </div>
  )
  if (d.v === 'lsmoh') { const ok = Object.keys(d.ordersBy), ck = Object.keys(d.certBy); return (
    <div className="chartgrid">
      <ChartCard title="Certificates by status" hint="statewide"><Donut center={String(d.totalCerts)} sub="certificates" data={ck.length ? ck.map(x => ({ label: x, value: d.certBy[x], display: String(d.certBy[x]), color: x === 'VALID' ? CHART[0] : x === 'EXPIRED' ? CHART[1] : '#b3261e' })) : [{ label: 'None', value: 1, display: '0', color: CHART[6] }]} /></ChartCard>
      <ChartCard title="Test orders by stage" hint="the review pipeline"><Bars data={ok.length ? ok.map(x => ({ label: x, value: d.ordersBy[x], color: statusColor(x) })) : [{ label: 'No orders', value: 0 }]} /></ChartCard>
    </div>
  ) }
  if (d.v === 'lab') { const k = Object.keys(d.by); return (
    <div className="chartgrid"><ChartCard title="Testing pipeline" hint="orders by status, all accredited labs"><Bars data={k.length ? k.map(x => ({ label: x, value: d.by[x], color: statusColor(x) })) : [{ label: 'No orders yet', value: 0 }]} /></ChartCard></div>
  )}
  if (d.v === 'employer') { const k = Object.keys(d.by); return (
    <div className="chartgrid"><ChartCard title="Team compliance" hint={d.total + ' staff'}><Donut center={d.total} sub="team" data={k.length ? k.map(x => ({ label: x, value: d.by[x], color: statusColor(x) })) : [{ label: 'No staff yet', value: 1, color: 'var(--line)' }]} /></ChartCard></div>
  )}
  if (d.v === 'lasepa') { const k = Object.keys(d.by); return (
    <div className="chartgrid"><ChartCard title="Water facilities" hint={d.total + ' tests'}><Donut center={d.total} sub="facilities" data={k.length ? k.map(x => ({ label: x, value: d.by[x], color: statusColor(x) })) : [{ label: 'No water tests yet', value: 1, color: 'var(--line)' }]} /></ChartCard></div>
  )}
  if (d.v === 'hefamaa') return (
    <div className="chartgrid"><ChartCard title="Laboratory accreditation" hint={d.total + ' labs'}><Donut center={d.acc + '/' + d.total} sub="accredited" data={[{ label: 'Accredited', value: d.acc, color: CHART[0] }, { label: 'Not accredited', value: d.non || 0.0001, color: CHART[4] }]} /></ChartCard></div>
  )
  return null
}

export default Insights
