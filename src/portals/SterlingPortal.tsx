// Sterling Bank portal (escrow releases, reconciliation, reporting, admin).
// First portal extracted into its own lazy-loaded chunk (refactor item 1).
/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import { useState, useEffect } from 'react'
import ReportingModule from '../components/Reporting.tsx'
import { isValidEmail, isValidPhone } from '../lib/constants.ts'
import { SUPABASE_READY } from '../lib/config.ts'
import { smatch } from '../lib/helpers.ts'
import { store, labsView, exportCsv } from '../lib/store.ts'
import { naira, WATERFALL, WATER_WATERFALL, FUND_PER_TXN, FEE, CHART } from '../lib/constants.ts'
import { WATER_FUND } from '../lib/water.ts'
import { t } from '../lib/i18n.ts'
import { toast } from '../lib/toast.ts'
import useGuard from '../lib/useGuard.tsx'
import { Donut, Bars, Line, ChartCard } from '../components/Charts.tsx'
import SearchBar from '../components/SearchBar.tsx'
import Insights from '../components/Insights.tsx'

const BENEFICIARIES = [
  { id: 'private-lab', name: 'Private Laboratory', note: 'Food test execution, 76.5% of the food fee' },
  { id: 'lsmoh', name: 'Lagos State Ministry of Health', note: 'Oversight & regulation, 10%' },
  { id: 'lasepa', name: 'LASEPA', note: 'Water enforcement 80% of water fee; food enforcement 3.5%' },
  { id: 'technology', name: 'Technology Partner', note: 'Platform operations, 5%' },
  { id: 'sterling', name: 'Sterling Bank', note: 'Financial partner & escrow, 5%' }
]


function Beneficiaries() {
  const [rows, setRows] = useState({})
  const [busy, setBusy] = useState('')
  useEffect(() => { load() /* eslint-disable-next-line */ }, [])
  async function load() { try { const list = await store.listBeneficiaries(); const map = {}; list.forEach(b => { map[b.id] = b }); setRows(map) } catch (e) { /* ignore */ } }
  const set = (id, k, v) => setRows(r => ({ ...r, [id]: { ...(r[id] || {}), [k]: v } }))
  async function save(b) {
    const c = rows[b.id] || {}
    if (c.accountNumber && !/^\d{10}$/.test(String(c.accountNumber).replace(/\s+/g, ''))) { toast('Account number must be exactly 10 digits.', 'err'); return }
    setBusy(b.id)
    try { await store.saveBeneficiary(b.id, { name: b.name, bankName: c.bankName || '', accountNumber: c.accountNumber || '', accountName: c.accountName || '' }); toast(b.name + ' bank details saved.') }
    catch (e) { toast('Could not save bank details: ' + (e.message || 'permission denied'), 'err') }
    setBusy('')
  }
  return (
    <>
      <div className="note" style={{ marginBottom: 16 }}>Bank account details for each party in the disbursement waterfall. When escrow is released, each party is paid to the account recorded here. Only Sterling Bank and regulators can see or edit these details.</div>
      {BENEFICIARIES.map(b => { const c = rows[b.id] || {}; return (
        <div className="ord" key={b.id}>
          <div className="top"><div><b style={{ fontFamily: 'Lora,serif', fontSize: 16 }}>{b.name}</b><div className="muted" style={{ fontSize: 12.5 }}>{b.note}</div></div>{c.accountNumber && /^\d{10}$/.test(String(c.accountNumber)) ? <span className="badge" style={{ background: '#e7f4ec', color: '#0a6b39' }}>On file</span> : <span className="badge" style={{ background: '#fdf1dd', color: '#9a6200' }}>Not set</span>}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10, marginTop: 10 }}>
            <div className="field" style={{ margin: 0 }}><label>Bank</label><input value={c.bankName || ''} onChange={e => set(b.id, 'bankName', e.target.value)} placeholder="e.g. Sterling Bank" /></div>
            <div className="field" style={{ margin: 0 }}><label>Account number</label><input value={c.accountNumber || ''} onChange={e => set(b.id, 'accountNumber', e.target.value)} placeholder="10-digit NUBAN" inputMode="numeric" /></div>
            <div className="field" style={{ margin: 0 }}><label>Account name</label><input value={c.accountName || ''} onChange={e => set(b.id, 'accountName', e.target.value)} placeholder="Registered account name" /></div>
          </div>
          <button className="btn p sm" style={{ marginTop: 12 }} onClick={() => save(b)} disabled={busy === b.id}>{busy === b.id ? 'Saving...' : 'Save bank details'}</button>
        </div>
      ) })}
    </>
  )
}


function SterlingModule({ session, tab, onTab }) {
  const { guard, modal } = useGuard()
  const [escrow, setEscrow] = useState([])
  const [releases, setReleases] = useState([])
  const [q, setQ] = useState('')
  const [batchBusy, setBatchBusy] = useState(false)
  const [batchDone, setBatchDone] = useState(0)
  async function refresh() { setEscrow(await store.listEscrow()); setReleases(await store.listReleases()) }
  useEffect(() => { refresh() }, [])

  const held = escrow.filter(e => e.status === 'HELD')
  const released = escrow.filter(e => e.status === 'RELEASED')
  const instructedIds = new Set(releases.filter(r => r.status === 'Instructed').map(r => r.safeplateId))
  const pending = held.filter(e => instructedIds.has(e.safeplateId))
  const sum = arr => arr.reduce((a, e) => a + (e.amount || 0), 0)
  const fundOf = e => e.type === 'WATER' ? WATER_FUND : FUND_PER_TXN
  const fundRemitted = released.reduce((a, e) => a + fundOf(e), 0)
  const tiles = [
    { k: 'Escrow balance', v: naira(sum(held)) },
    { k: 'Released to date', v: naira(sum(released)) },
    { k: 'Fund remitted', v: naira(fundRemitted) },
    { k: 'Pending release', v: naira(sum(pending)) }
  ]

  async function release(e) {
    try {
      if (SUPABASE_READY) { await store.fn('release-escrow', { safeplateId: e.safeplateId }); toast('Escrow released, full waterfall disbursed.'); refresh(); return }
      await store.releaseEscrow(e.safeplateId, session.name)
      await store.appendAudit({ actor: session.name, role: 'Sterling Bank', action: 'Escrow released, full waterfall disbursed', subject: e.safeplateId })
      await store.notify('laboratory', 'Payment released', e.safeplateId + ', ' + naira(e.amount))
      toast('Escrow released, full waterfall disbursed.')
      refresh()
    } catch (err) { toast('Could not release: ' + (err.message || 'please try again.'), 'err') }
  }

  async function releaseAll() {
    const list = escrow.filter(e => e.status === 'HELD' && new Set(releases.filter(r => r.status === 'Instructed').map(r => r.safeplateId)).has(e.safeplateId))
    setBatchBusy(true); setBatchDone(0)
    let ok = 0
    for (const e of list) {
      try {
        if (SUPABASE_READY) { await store.fn('release-escrow', { safeplateId: e.safeplateId }) }
        else { await store.releaseEscrow(e.safeplateId, session.name); await store.appendAudit({ actor: session.name, role: 'Sterling Bank', action: 'Escrow released, full waterfall disbursed', subject: e.safeplateId }); await store.notify('laboratory', 'Payment released', e.safeplateId + ', ' + naira(e.amount)) }
        ok++; setBatchDone(ok)
      } catch (err) { toast('Some releases could not complete: ' + (err.message || 'try again'), 'err') }
    }
    setBatchBusy(false)
    toast('Released ' + ok + ' approved payment' + (ok === 1 ? '' : 's') + '.')
    refresh()
  }

  return (
    <div className="page"><div className="wrap">
      <div className="greeting"><h2 className="sec serif" style={{ margin: 0 }}>Sterling Bank escrow</h2><span className="muted" style={{ fontSize: 13 }}>{session.name}</span></div>

      {tab === 'home' && (<>
        <div className="tiles">
          <div className="tile"><div className="v">{naira(sum(held))}</div><div className="k">Held in escrow</div></div>
          <div className="tile"><div className="v">{naira(sum(released))}</div><div className="k">Released to date</div></div>
          <div className="tile"><div className="v">{pending.length}</div><div className="k">Awaiting release</div></div>
          <div className="tile"><div className="v">{naira(fundRemitted)}</div><div className="k">Fund remitted</div></div>
        </div>
        {pending.length > 0 ? <div className="ord" style={{ borderColor: 'var(--green)', background: '#f6faf7', marginBottom: 16 }}><b style={{ fontFamily: 'Lora,serif', fontSize: 16 }}>Needs your attention today</b><div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}><button className="attn-pill" onClick={() => onTab && onTab('batch')} title="Go to the Batch release tab"><b style={{ fontSize: 18 }}>{pending.length}</b> approved payment{pending.length === 1 ? '' : 's'} awaiting release <span className="muted">· open Batch release</span></button><button className="attn-pill" onClick={() => onTab && onTab('releases')} title="Go to the Releases tab"><b style={{ fontSize: 18 }}>{naira(sum(pending))}</b> total to disburse <span className="muted">· open Releases</span></button></div></div> : <div className="note" style={{ marginBottom: 16 }}>Nothing is awaiting release. Every Ministry-approved payment has been disbursed.</div>}
        <Insights session={session} />
      </>)}

      {tab === 'ledger' && (<>
        <div className="tiles">
          <div className="tile"><div className="v">{naira(sum(held) + sum(released))}</div><div className="k">Total in system</div></div>
          <div className="tile"><div className="v">{naira(sum(held))}</div><div className="k">Held in escrow</div></div>
          <div className="tile"><div className="v">{naira(sum(released))}</div><div className="k">Released to date</div></div>
          <div className="tile"><div className="v">{escrow.length}</div><div className="k">Transactions</div></div>
        </div>
        <div className="note" style={{ marginBottom: 16 }}>Every escrow transaction, food handler and water facility, held or released. Sterling Bank never sees test results or medical data.</div>
        <Insights session={session} />
        <div className="row-between" style={{ alignItems: 'baseline', margin: '22px 0 4px' }}><h3 className="serif" style={{ fontSize: 18, margin: 0 }}>Escrow ledger</h3><button className="btn sm" onClick={() => exportCsv(escrow, [{ label: 'SAFEPLATE ID', key: 'safeplateId' }, { label: 'Name', key: 'name' }, { label: 'Laboratory', key: 'lab' }, { label: 'Type', get: e => e.type === 'WATER' ? 'Water' : 'Food handler' }, { label: 'Amount', key: 'amount' }, { label: 'Status', key: 'status' }], 'safeplate-escrow-ledger.csv')}>Export CSV</button></div>
        <p className="muted" style={{ marginTop: 0, fontSize: 13, marginBottom: 14 }}>Full transaction record. Search by any field.</p>
        <SearchBar value={q} onChange={setQ} placeholder="Search by ID, name, laboratory, type or status..." />
        <div style={{ overflowX: 'auto' }}><table className="audit-tbl">
          <thead><tr><th>SAFEPLATE ID</th><th>Name</th><th>Laboratory</th><th>Type</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>{escrow.filter(e => smatch(q, e.safeplateId, e.name, e.lab, e.type === 'WATER' ? 'water' : 'food handler', e.status)).map(e => (<tr key={e.safeplateId}><td className="mono">{e.safeplateId}</td><td>{e.name}</td><td>{e.lab}</td><td>{e.type === 'WATER' ? 'Water' : 'Food handler'}</td><td>{naira(e.amount)}</td><td><span className={'status ' + e.status}>{e.status}</span></td></tr>))}</tbody>
        </table></div>
      </>)}

      {tab === 'releases' && (<>
        <div className="tiles">
          <div className="tile"><div className="v">{pending.length}</div><div className="k">Awaiting release</div></div>
          <div className="tile"><div className="v">{naira(sum(pending))}</div><div className="k">Pending amount</div></div>
          <div className="tile"><div className="v">{naira(sum(released))}</div><div className="k">Released to date</div></div>
          <div className="tile"><div className="v">{released.length}</div><div className="k">Releases done</div></div>
        </div>
        <div className="note" style={{ marginBottom: 16 }}>Ministry-approved instructions awaiting disbursement, and recent releases. Each release disburses the full waterfall atomically, all legs or none.</div>
        {pending.length === 0 && <div className="placeholder">No approved releases are pending. When the Ministry approves a result, the instruction appears here to execute.</div>}
        {pending.length > 1 && <div className="ord" style={{ borderColor: 'var(--green)' }}><div className="row-between"><div><b style={{ fontFamily: 'Lora,serif', fontSize: 16 }}>{pending.length} approved payments awaiting release</b><div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>Total {naira(sum(pending))}. Release individually below, or all at once from the Batch release tab.</div></div></div></div>}
        {pending.map(e => (
          <div className="ord" key={e.safeplateId}>
            <div className="top"><div><b style={{ fontFamily: 'Lora,serif', fontSize: 16 }}>{e.name}</b><div className="muted" style={{ fontSize: 12.5 }}>{e.safeplateId} · {e.lab} · {e.type === 'WATER' ? 'Water facility' : 'Food handler'}</div></div><span className="status HELD">Approved, pending release</span></div>
            <table className="split-tbl"><tbody>{(e.type === 'WATER' ? WATER_WATERFALL : WATERFALL).map(w => <tr key={w.who}><td>{w.who} <span className="muted">({w.pct}%)</span></td><td>{naira(w.amount)}</td></tr>)}<tr className="tot"><td>Total to disburse</td><td>{naira(e.amount)}</td></tr></tbody></table>
            <button className="btn p sm" style={{ marginTop: 12 }} onClick={() => guard('Release escrow for ' + e.safeplateId, () => release(e))}>Release full waterfall</button>
          </div>
        ))}
        {released.length > 0 && (<><h3 className="serif" style={{ fontSize: 17, marginTop: 24 }}>Recently released</h3>{released.slice(0, 20).map(e => (<div className="ord" key={e.safeplateId}><div className="top"><div><b style={{ fontFamily: 'Lora,serif', fontSize: 15 }}>{e.name}</b><div className="muted" style={{ fontSize: 12.5 }}>{e.safeplateId} · {naira(e.amount)}</div></div><span className="status RELEASED">Released</span></div></div>))}</>)}
      </>)}

      {tab === 'batch' && (<>
        <div className="tiles">
          <div className="tile"><div className="v">{pending.length}</div><div className="k">Approved, awaiting release</div></div>
          <div className="tile"><div className="v">{naira(sum(pending))}</div><div className="k">Total to disburse</div></div>
          <div className="tile"><div className="v">{pending.filter(e => e.type !== 'WATER').length}</div><div className="k">Food handler</div></div>
          <div className="tile"><div className="v">{pending.filter(e => e.type === 'WATER').length}</div><div className="k">Water facility</div></div>
        </div>
        <div className="note" style={{ marginBottom: 16 }}>Release every payment the Ministry has already approved in a single action. Each disburses its full waterfall atomically, all legs or none. Amounts and legs are shown before you confirm.</div>
        {pending.length === 0 ? <div className="placeholder">Nothing is awaiting release right now. Approved payments from the Ministry and LASEPA will appear here.</div> : (<>
          <div className="ord" style={{ borderColor: 'var(--green)', background: '#f6faf7' }}>
            <div className="row-between" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div><b style={{ fontFamily: 'Lora,serif', fontSize: 19 }}>{pending.length} approved payment{pending.length === 1 ? '' : 's'} ready</b><div className="muted" style={{ fontSize: 13, marginTop: 4 }}>Total {naira(sum(pending))} across {pending.filter(e => e.type !== 'WATER').length} food handler and {pending.filter(e => e.type === 'WATER').length} water. Disbursing to labs, LASEPA, LSMoH, technology and Sterling per waterfall.</div></div>
              <button className="btn p" onClick={() => guard('Release all ' + pending.length + ' Ministry-approved payments, ' + naira(sum(pending)), releaseAll)} disabled={batchBusy}>{batchBusy ? 'Releasing ' + batchDone + ' of ' + pending.length + '...' : 'Release all ' + pending.length}</button>
            </div>
          </div>
          <div style={{ overflowX: 'auto', marginTop: 14 }}><table className="audit-tbl">
            <thead><tr><th>SAFEPLATE ID</th><th>Name</th><th>Type</th><th>Amount</th></tr></thead>
            <tbody>{pending.map(e => (<tr key={e.safeplateId}><td className="mono">{e.safeplateId}</td><td>{e.name}</td><td>{e.type === 'WATER' ? 'Water' : 'Food handler'}</td><td>{naira(e.amount)}</td></tr>))}<tr className="tot"><td colSpan={3}>Total</td><td>{naira(sum(pending))}</td></tr></tbody>
          </table></div>
        </>)}
      </>)}

      {tab === 'fund' && (<>
        <div className="tiles">
          <div className="tile"><div className="v">{naira(fundRemitted)}</div><div className="k">Total remitted</div></div>
          <div className="tile"><div className="v">{naira(released.filter(e => e.type !== 'WATER').length * FUND_PER_TXN)}</div><div className="k">From food handlers</div></div>
          <div className="tile"><div className="v">{naira(released.filter(e => e.type === 'WATER').length * WATER_FUND)}</div><div className="k">From water</div></div>
          <div className="tile"><div className="v">{released.length}</div><div className="k">Released transactions</div></div>
        </div>
        <div className="note" style={{ marginBottom: 16 }}>The 10% oversight line (formerly the COVID-19 Dedicated Fund, now the State Regulatory Fund) is remitted as {naira(FUND_PER_TXN)} on every released food test and {naira(WATER_FUND)} on every water test.</div>
        <div className="ord"><div className="row-between"><b style={{ fontFamily: 'Lora,serif', fontSize: 18 }}>Total remitted to date</b><span style={{ fontFamily: 'Lora,serif', fontSize: 22, color: 'var(--navy)' }}>{naira(fundRemitted)}</span></div><div className="muted" style={{ fontSize: 13, marginTop: 6 }}>Across {released.length} released transaction{released.length === 1 ? '' : 's'}: {released.filter(e => e.type !== 'WATER').length} food handler and {released.filter(e => e.type === 'WATER').length} water.</div></div>
      </>)}

      {tab === 'beneficiaries' && (<><div className="tiles"><div className="tile"><div className="v">{BENEFICIARIES.length}</div><div className="k">Waterfall beneficiaries</div></div></div><h3 className="serif" style={{ fontSize: 18, margin: '4px 0 4px' }}>Beneficiary bank details</h3><Beneficiaries /></>)}

      {tab === 'reconcile' && (<>
        <div className="tiles">
          <div className="tile"><div className="v">{naira(sum(held))}</div><div className="k">Held</div></div>
          <div className="tile"><div className="v">{naira(sum(released))}</div><div className="k">Released</div></div>
          <div className="tile"><div className="v">{naira(fundRemitted)}</div><div className="k">Remitted to State</div></div>
          <div className="tile"><div className="v">{naira(sum(held) + sum(released))}</div><div className="k">Net position</div></div>
        </div>
        <div className="note" style={{ marginBottom: 16 }}>End-of-day totals reconciling held, released and remitted balances.</div>
        <Reconcile escrow={escrow} />
      </>)}
      {tab === 'reports' && <ReportingModule session={session} scope="sterling" />}
      {tab === 'admin' && <SterlingAdmin session={session} />}
      {modal}
    </div></div>
  )
}
function SterlingAdmin({ session }) {
  const [rows, setRows] = useState([])
  const [nf, setNf] = useState({ name: '', email: '', phone: '', accessLevel: 'Viewer' })
  const [busy, setBusy] = useState(false)
  useEffect(() => { load() /* eslint-disable-next-line */ }, [])
  async function load() { try { setRows(await store.listBankStaff()) } catch (e) { setRows([]) } }
  const LEVELS = ['Viewer', 'Officer', 'Administrator']
  async function add() {
    if (!nf.name.trim() || !isValidEmail(nf.email)) { toast('Enter a name and a valid email.', 'err'); return }
    if (nf.phone && !isValidPhone(nf.phone)) { toast('Enter a valid 11-digit phone number, or leave it blank.', 'err'); return }
    setBusy(true)
    try { await store.saveBankStaff({ ...nf, addedBy: session.email }); toast(nf.name + ' added.'); setNf({ name: '', email: '', phone: '', accessLevel: 'Viewer' }); load() }
    catch (e) { toast('Could not add staff: ' + (e.message || 'try again'), 'err') }
    setBusy(false)
  }
  async function setStatus(r, status) {
    try { await store.setBankStaffStatus(r.id, status); toast(r.name + ' ' + status.toLowerCase() + '.'); load() }
    catch (e) { toast('Could not update: ' + (e.message || 'try again'), 'err') }
  }
  async function setLevel(r, accessLevel) {
    try { await store.saveBankStaff({ ...r, accessLevel }); toast(r.name + ' set to ' + accessLevel + '.'); load() }
    catch (e) { toast('Could not update: ' + (e.message || 'try again'), 'err') }
  }
  return (
    <div>
      <div className="tiles">
        <div className="tile"><div className="v">{rows.length}</div><div className="k">Bank users</div></div>
        <div className="tile"><div className="v">{rows.filter(r => r.status === 'Active').length}</div><div className="k">Active</div></div>
        <div className="tile"><div className="v">{rows.filter(r => r.accessLevel === 'Administrator').length}</div><div className="k">Administrators</div></div>
      </div>
      <div className="note" style={{ marginBottom: 16 }}>Manage who at Sterling Bank can access this portal and what they may do. Viewers see the ledger and reports. Officers may instruct releases. Administrators may also manage users. Access levels are recorded, and every change is written to the audit trail.</div>
      <div className="card" style={{ marginBottom: 18 }}>
        <h3 className="serif" style={{ fontSize: 17, marginTop: 0 }}>Add a bank user</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field"><label>Full name</label><input value={nf.name} onChange={e => setNf({ ...nf, name: e.target.value })} placeholder="Name" /></div>
          <div className="field"><label>Email</label><input value={nf.email} onChange={e => setNf({ ...nf, email: e.target.value })} placeholder="name@sterling.ng" /></div>
          <div className="field"><label>Phone (optional)</label><input value={nf.phone} onChange={e => setNf({ ...nf, phone: e.target.value })} placeholder="08031234567" inputMode="numeric" /></div>
          <div className="field"><label>Access level</label><select value={nf.accessLevel} onChange={e => setNf({ ...nf, accessLevel: e.target.value })}>{LEVELS.map(l => <option key={l}>{l}</option>)}</select></div>
        </div>
        <button className="btn p" onClick={add} disabled={busy}>{busy ? 'Adding...' : 'Add user'}</button>
      </div>
      <h3 className="serif" style={{ fontSize: 17 }}>Bank users</h3>
      {rows.length === 0 && <div className="placeholder">No bank users added yet.</div>}
      {rows.map(r => (
        <div className="ord" key={r.id}>
          <div className="top">
            <div><b style={{ fontFamily: 'Lora,serif', fontSize: 15 }}>{r.name}</b><div className="muted" style={{ fontSize: 12.5 }}>{r.email}{r.phone ? ' · ' + r.phone : ''}</div></div>
            <span className="badge" style={{ background: r.status === 'Active' ? '#e7f4ec' : '#fdeeee', color: r.status === 'Active' ? '#0a6b39' : '#b3261e' }}>{r.status}</span>
          </div>
          <div className="row-between" style={{ flexWrap: 'wrap', gap: 8, marginTop: 10, alignItems: 'center' }}>
            <select value={r.accessLevel} onChange={e => setLevel(r, e.target.value)} style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13 }}>{LEVELS.map(l => <option key={l}>{l}</option>)}</select>
            {r.status === 'Active'
              ? <button className="btn sm danger" onClick={() => setStatus(r, 'Suspended')}>Suspend</button>
              : <button className="btn sm" onClick={() => setStatus(r, 'Active')}>Reactivate</button>}
          </div>
        </div>
      ))}
    </div>
  )
}


function Reconcile({ escrow }) {
  const [id, setId] = useState('')
  const [hit, setHit] = useState(undefined)
  function find() { const clean = id.trim().toUpperCase(); setHit(escrow.find(e => e.safeplateId === clean) || null) }
  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>Reconcile any transaction by SAFEPLATE ID.</p>
      <div className="field" style={{ maxWidth: 360 }}><label>SAFEPLATE ID</label><input value={id} onChange={e => setId(e.target.value)} placeholder="SP-LG-YYYYNNNNN" onKeyDown={e => e.key === 'Enter' && find()} /></div>
      <button className="btn p sm" onClick={find}>Reconcile</button>
      {hit === null && <div className="err" style={{ marginTop: 14 }}>No escrow transaction found for that ID.</div>}
      {hit && (
        <div className="ord" style={{ marginTop: 16 }}>
          <div className="top"><div><b style={{ fontFamily: 'Lora,serif', fontSize: 16 }}>{hit.name}</b><div className="muted" style={{ fontSize: 12.5 }}>{hit.safeplateId} · {hit.lab}</div></div><span className={'status ' + hit.status}>{hit.status}</span></div>
          <table className="split-tbl"><tbody>{(hit.type === 'WATER' ? WATER_WATERFALL : WATERFALL).map(w => <tr key={w.who}><td>{w.who} <span className="muted">({w.pct}%)</span></td><td>{naira(w.amount)}</td></tr>)}<tr className="tot"><td>Total</td><td>{naira(hit.amount)}</td></tr></tbody></table>
          {hit.releasedTs && <div className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>Released {new Date(hit.releasedTs).toLocaleString('en-GB')} by {hit.releasedBy}.</div>}
        </div>
      )}
    </div>
  )
}


export default SterlingModule
