// Public directory of establishments and their compliance status (item 37).
//
// The discovery counterpart to the verify page: instead of checking one ID you
// already hold, a member of the public can search food businesses in their area
// and see, honestly, which are compliant, which are under sanction, and which
// have not yet been inspected. Anonymous and read-only; no session required.
/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import { useState, useEffect, useMemo } from 'react'
import { store } from '../lib/store.ts'
import { LAGOS_LGAS } from '../lib/constants.ts'
import SearchBar from './SearchBar.tsx'

// Map a raw compliance value to an honest, public-facing label and tone.
// We never overstate: an uninspected premises is shown as exactly that, not as
// "compliant", and a sanctioned one is shown plainly.
function statusOf(e: any) {
  const c = (e.compliance || '').toLowerCase()
  if (e.sanction && /suspen/i.test(e.sanction)) return { label: 'Suspended', tone: 'no', note: e.appeal ? 'Suspended, under appeal' : 'Operating licence suspended' }
  if (c === 'compliant') return { label: 'Compliant', tone: 'ok', note: 'Inspected and compliant' }
  if (c === 'non-compliant') return { label: 'Non-compliant', tone: 'no', note: e.sanction ? ('Sanction: ' + e.sanction) : 'Failed inspection' }
  if (c === 'overdue') return { label: 'Renewal overdue', tone: 'warn', note: e.sanction ? ('Sanction: ' + e.sanction) : 'Certification lapsed, renewal due' }
  return { label: 'Not yet inspected', tone: 'muted', note: 'Registered, awaiting first inspection' }
}

const TONE_STYLE: Record<string, any> = {
  ok:     { bg: '#eaf5ea', fg: '#006600', dot: '#006600' },
  warn:   { bg: '#fdf3e3', fg: '#9a6a13', dot: '#FBAE40' },
  no:     { bg: '#f7eaea', fg: '#a4271d', dot: '#b3261e' },
  muted:  { bg: '#eef1f4', fg: '#516072', dot: '#8a99a8' },
}

function StatusBadge({ s }: { s: any }) {
  const t = TONE_STYLE[s.tone] || TONE_STYLE.muted
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: t.bg, color: t.fg, padding: '4px 11px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}>
      <span style={{ width: 7, height: 7, borderRadius: 99, background: t.dot }} />
      {s.label}
    </span>
  )
}

export default function Directory() {
  const [rows, setRows] = useState<any[] | null>(null)
  const [err, setErr] = useState(false)
  const [q, setQ] = useState('')
  const [lga, setLga] = useState('')
  const [onlyCompliant, setOnlyCompliant] = useState(false)

  useEffect(() => {
    let on = true
    store.listEstablishments()
      .then((list: any[]) => { if (on) setRows(Array.isArray(list) ? list : []) })
      .catch(() => { if (on) { setErr(true); setRows([]) } })
    return () => { on = false }
  }, [])

  const filtered = useMemo(() => {
    const list = (rows || []).map(e => ({ e, s: statusOf(e) }))
    const needle = q.trim().toLowerCase()
    return list
      .filter(({ e }) => !lga || e.lga === lga)
      .filter(({ e }) => !needle || (e.name || '').toLowerCase().includes(needle))
      .filter(({ s }) => !onlyCompliant || s.tone === 'ok')
      .sort((a, b) => (a.e.name || '').localeCompare(b.e.name || ''))
  }, [rows, q, lga, onlyCompliant])

  const compliantCount = useMemo(() => (rows || []).filter(e => statusOf(e).tone === 'ok').length, [rows])

  return (
    <div className="page"><div className="wrap" style={{ maxWidth: 860 }}>
      <div className="greeting" style={{ marginBottom: 6 }}>
        <h2 className="sec serif" style={{ margin: 0 }}>Certified establishments directory</h2>
      </div>
      <div className="note" style={{ marginBottom: 18 }}>
        Search food businesses registered with SafePlate and see their current
        inspection status. A listing shows what the last inspection found. If a
        place you know is not listed, it may not yet be registered, and you can
        report a concern.
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <SearchBar value={q} onChange={setQ} placeholder="Search by establishment name" hint="Type part of a name, for example 'Mama' or 'Grill'" />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
          <div style={{ flex: '1 1 220px' }}>
            <select value={lga} onChange={e => setLga(e.target.value)} style={{ width: '100%', padding: '11px 13px', border: '1px solid var(--line)', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', background: '#fff' }}>
              <option value="">All LGAs</option>
              {LAGOS_LGAS.map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={onlyCompliant} onChange={e => setOnlyCompliant(e.target.checked)} />
            Compliant only
          </label>
        </div>
      </div>

      {rows === null && <div className="muted" style={{ padding: 24, textAlign: 'center' }}>Loading directory…</div>}

      {rows && (
        <>
          <div className="muted" style={{ fontSize: 13, margin: '0 2px 12px' }}>
            {filtered.length} of {rows.length} establishment{rows.length === 1 ? '' : 's'}
            {compliantCount > 0 && <> · {compliantCount} currently compliant</>}
          </div>

          {filtered.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: 30 }}>
              <b>No establishments match your search.</b>
              <p className="muted" style={{ marginBottom: 0 }}>Try a different name or LGA, or clear the filters.</p>
            </div>
          )}

          <div style={{ display: 'grid', gap: 12 }}>
            {filtered.map(({ e, s }) => (
              <div key={e.id} className="card" style={{ display: 'flex', gap: 14, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                  <b style={{ fontSize: 16 }}>{e.name}</b>
                  <div className="muted" style={{ fontSize: 13, marginTop: 3 }}>
                    {e.lga ? e.lga + ', Lagos' : 'Lagos'}
                  </div>
                  <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>{s.note}</div>
                </div>
                <div style={{ flexShrink: 0 }}><StatusBadge s={s} /></div>
              </div>
            ))}
          </div>

          <p className="muted" style={{ fontSize: 12.5, marginTop: 18, lineHeight: 1.7 }}>
            Status reflects the most recent inspection recorded by a Lagos State
            regulator. "Not yet inspected" means a premises has registered but has
            not had its first inspection, and is not a judgement either way.
          </p>
        </>
      )}
    </div></div>
  )
}
