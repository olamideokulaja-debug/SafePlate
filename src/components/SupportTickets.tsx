// Support ticket list (shown in regulator/admin views).
/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import { useState, useEffect } from 'react'
import { store } from '../lib/store.ts'

export function SupportTickets() {
  const [rows, setRows] = useState(null)
  const [q, setQ] = useState('')
  useEffect(() => { load() /* eslint-disable-next-line */ }, [])
  async function load() { try { setRows(await store.listTickets()) } catch (e) { setRows([]) } }
  if (!rows || rows.length === 0) return null
  const shown = rows.filter(t => smatch(q, t.subject, t.reporter, t.category, t.status))
  return (
    <div style={{ marginTop: 26 }}>
      <h3 className="serif" style={{ fontSize: 18, marginBottom: 4 }}>Support requests</h3>
      <p className="muted" style={{ marginTop: 0, fontSize: 13, marginBottom: 12 }}>Problems reported by the public and by users through the help centre.</p>
      <SearchBar value={q} onChange={setQ} placeholder="Search support requests..." />
      {shown.length === 0 && <div className="placeholder">No support requests match your search.</div>}
      {shown.slice(0, 50).map((t, i) => (
        <div className="ord" key={t.id || i}>
          <div className="top"><div><b>{t.subject}</b> <span className="muted" style={{ fontSize: 12 }}>· {t.category} · {t.reporter}</span></div><span className="badge" style={{ background: '#fdf1dd', color: '#9a6200' }}>{t.status || 'Open'}</span></div>
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{t.body}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{t.createdAt ? new Date(t.createdAt).toLocaleString('en-GB') : ''}</div>
        </div>
      ))}
    </div>
  )
}

export default SupportTickets
