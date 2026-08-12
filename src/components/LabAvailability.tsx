// Lab availability scheduling, shared by the food-handler and laboratory portals.
/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import { useState, useEffect } from 'react'
import { store } from '../lib/store.ts'
import { toast } from '../lib/toast.ts'
import { t } from '../lib/i18n.ts'
import { WEEKDAYS, DEFAULT_SLOTS } from '../lib/constants.ts'

export function LabAvailability({ session }) {
  const [labs, setLabs] = useState([])
  const [labId, setLabId] = useState('')
  const [av, setAv] = useState({ days: {}, note: '' })
  const [busy, setBusy] = useState(false)
  const [newSlot, setNewSlot] = useState('')
  useEffect(() => { (async () => {
    try { const list = await store.accreditedLabList(); setLabs(list); if (list.length) { setLabId(list[0].id); loadFor(list[0].id) } } catch (e) { /* ignore */ }
  })() /* eslint-disable-next-line */ }, [])
  async function loadFor(id) {
    try { const a = await store.getLabAvailability(id); setAv(a && a.days ? a : { days: {}, note: '' }) } catch (e) { setAv({ days: {}, note: '' }) }
  }
  function toggleDay(d) {
    setAv(a => { const days = { ...(a.days || {}) }; if (days[d]) delete days[d]; else days[d] = [...DEFAULT_SLOTS]; return { ...a, days } })
  }
  function toggleSlot(d, slot) {
    setAv(a => { const days = { ...(a.days || {}) }; const cur = days[d] || []; days[d] = cur.includes(slot) ? cur.filter(x => x !== slot) : [...cur, slot]; return { ...a, days } })
  }
  function addSlot(d) {
    const v = newSlot.trim(); if (!v) return
    setAv(a => { const days = { ...(a.days || {}) }; days[d] = [...(days[d] || []), v]; return { ...a, days } })
    setNewSlot('')
  }
  async function save() {
    setBusy(true)
    try { await store.saveLabAvailability(labId, av); toast('Availability saved. Food handlers will only be offered these times.') }
    catch (e) { toast('Could not save availability: ' + (e.message || 'try again'), 'err') }
    setBusy(false)
  }
  const openDays = Object.keys(av.days || {})
  return (
    <div className="page"><div className="wrap">
      <div className="greeting"><h2 className="sec serif" style={{ margin: 0 }}>Testing availability</h2><span className="muted" style={{ fontSize: 13 }}>{session.name}</span></div>
      <div className="note" style={{ marginBottom: 16 }}>Set the days you accept samples and the time slots on each day. Food handlers booking with you can only choose from these, which stops appointments landing when you are closed.</div>
      {labs.length > 1 && (
        <div className="field" style={{ maxWidth: 340 }}><label>Laboratory</label><select value={labId} onChange={e => { setLabId(e.target.value); loadFor(e.target.value) }}>{labs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
      )}
      <div className="card">
        {WEEKDAYS.map(d => {
          const on = !!(av.days || {})[d]
          return (
            <div key={d} style={{ borderBottom: '1px solid var(--line)', padding: '12px 0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 600 }}>
                <input type="checkbox" checked={on} onChange={() => toggleDay(d)} style={{ width: 18, height: 18 }} />
                {d}
              </label>
              {on && (
                <div style={{ marginTop: 10, paddingLeft: 28 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[...new Set([...DEFAULT_SLOTS, ...((av.days || {})[d] || [])])].map(sl => {
                      const active = ((av.days || {})[d] || []).includes(sl)
                      return <button key={sl} className={'btn sm' + (active ? ' p' : '')} onClick={() => toggleSlot(d, sl)}>{sl}</button>
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                    <input value={newSlot} onChange={e => setNewSlot(e.target.value)} placeholder="Add a slot, e.g. 16:00 to 18:00" style={{ padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 9, fontFamily: 'inherit', fontSize: 13, flex: 1, maxWidth: 260 }} />
                    <button className="btn sm" onClick={() => addSlot(d)}>Add slot</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        <div className="field" style={{ marginTop: 14 }}><label>Note for applicants (optional)</label><input value={av.note || ''} onChange={e => setAv(a => ({ ...a, note: e.target.value }))} placeholder="e.g. Please arrive 15 minutes early with your SAFEPLATE ID" /></div>
        <div className="row-between" style={{ marginTop: 8, flexWrap: 'wrap', gap: 8 }}>
          <span className="muted" style={{ fontSize: 13 }}>{openDays.length ? openDays.length + ' day' + (openDays.length === 1 ? '' : 's') + ' open for sampling' : 'No days set. Food handlers will see you as unavailable for booking.'}</span>
          <button className="btn p" onClick={save} disabled={busy || !labId}>{busy ? 'Saving...' : 'Save availability'}</button>
        </div>
      </div>
    </div></div>
  )
}

export default LabAvailability
