import { supabase, MODE } from './supabaseClient.js'

/* ---------- helpers ---------- */
export function haversine(a, b) {
  if (!a || !b) return Infinity
  const R = 6371, toRad = d => d * Math.PI / 180
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng)
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

// Nearest-neighbour ordering of facilities that have coordinates.
export function orderRoute(list) {
  const pts = list.filter(f => typeof f.lat === 'number' && typeof f.lng === 'number')
  if (pts.length <= 2) return pts
  const remaining = pts.slice()
  const route = [remaining.shift()]
  while (remaining.length) {
    const last = route[route.length - 1]
    let bi = 0, bd = Infinity
    remaining.forEach((f, i) => { const d = haversine(last, f); if (d < bd) { bd = d; bi = i } })
    route.push(remaining.splice(bi, 1)[0])
  }
  return route
}

/* ---------- daily route clustering ----------
   With real coordinates we can work the geography out directly: group the
   facilities into k compact clusters (k-means), keep each within the day's
   capacity, then order each day nearest-neighbour. Exact, instant, and it
   cannot be truncated the way an AI answer can. */
export function clusterDays(items, k, cap) {
  const pts = (items || []).filter(f => typeof f.lat === 'number' && typeof f.lng === 'number')
  if (!pts.length) return []
  k = Math.max(1, Math.min(k, pts.length))
  // Seed with points that are far apart, so clusters do not collapse together.
  const cents = [{ lat: pts[0].lat, lng: pts[0].lng }]
  while (cents.length < k) {
    let best = pts[0], bd = -1
    for (const p of pts) {
      let d = Infinity
      for (const c of cents) { const x = haversine(c, p); if (x < d) d = x }
      if (d > bd) { bd = d; best = p }
    }
    cents.push({ lat: best.lat, lng: best.lng })
  }
  let assign = new Array(pts.length).fill(0)
  for (let it = 0; it < 14; it++) {
    let moved = false
    for (let j = 0; j < pts.length; j++) {
      let bi = 0, bd = Infinity
      for (let i = 0; i < k; i++) { const d = haversine(cents[i], pts[j]); if (d < bd) { bd = d; bi = i } }
      if (assign[j] !== bi) { assign[j] = bi; moved = true }
    }
    for (let i = 0; i < k; i++) {
      const g = pts.filter((_, j) => assign[j] === i)
      if (g.length) cents[i] = { lat: g.reduce((s, x) => s + x.lat, 0) / g.length, lng: g.reduce((s, x) => s + x.lng, 0) / g.length }
    }
    if (!moved) break
  }
  const groups = Array.from({ length: k }, () => [])
  pts.forEach((p, j) => groups[assign[j]].push(p))
  // Keep each day within capacity: shed the point furthest from its centre to
  // the nearest day that still has room.
  if (cap && cap > 0) {
    for (let pass = 0; pass < 6; pass++) {
      let changed = false
      for (let i = 0; i < k; i++) {
        while (groups[i].length > cap) {
          let fi = 0, fd = -1
          groups[i].forEach((p, idx) => { const d = haversine(cents[i], p); if (d > fd) { fd = d; fi = idx } })
          const p = groups[i][fi]
          let ti = -1, td = Infinity
          for (let t = 0; t < k; t++) { if (t === i || groups[t].length >= cap) continue; const d = haversine(cents[t], p); if (d < td) { td = d; ti = t } }
          if (ti < 0) break
          groups[i].splice(fi, 1); groups[ti].push(p); changed = true
        }
      }
      if (!changed) break
    }
  }
  return groups.filter(g => g.length).map(g => orderRoute(g))
}

/* ---------- oldest-first day planning (second round) ----------
   The second assessment is a continuation of the first, so the team should
   revisit in the same order they first saw the facilities: oldest baseline
   first. We sort by the first-assessment date, cut the list into day-sized
   chunks in that order, then order each day's stops nearest-neighbour so the
   driving within a day is still tight. dateOf(f) returns a sortable string
   (e.g. '2026-03-04'); facilities with no baseline date sort to the end. */
export function clusterDaysByDate(items, perDay, dateOf) {
  const cap = Math.max(1, perDay || 14)
  const withKey = (items || []).map(f => ({ f, k: (dateOf && dateOf(f)) || '9999-99-99' }))
  withKey.sort((a, b) => a.k < b.k ? -1 : a.k > b.k ? 1 : 0)
  const ordered = withKey.map(x => x.f)
  const days = []
  for (let i = 0; i < ordered.length; i += cap) days.push(ordered.slice(i, i + cap))
  // keep the chronological day order, but order the stops inside each day by geography
  return days.map(g => {
    const routed = orderRoute(g)
    // orderRoute drops points without coords; keep those too, appended in date order
    if (routed.length === g.length) return routed
    const inRoute = new Set(routed)
    return routed.concat(g.filter(f => !inRoute.has(f)))
  })
}

export function googleMapsDirUrl(ordered) {
  const pts = ordered.filter(f => typeof f.lat === 'number' && typeof f.lng === 'number')
  if (!pts.length) return ''
  const path = pts.map(f => f.lat + ',' + f.lng).join('/')
  return 'https://www.google.com/maps/dir/' + path
}

/* ---------- CSV ---------- */
export function parseCSV(text) {
  const rows = []; let field = '', row = [], inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else inQ = false }
      else field += c
    } else {
      if (c === '"') inQ = true
      else if (c === ',') { row.push(field); field = '' }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else if (c === '\r') { /* skip */ }
      else field += c
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows.filter(r => r.some(x => x && x.trim() !== ''))
}

function pick(obj, keys) { for (const k of keys) { if (obj[k] !== undefined && obj[k] !== '') return obj[k] } return '' }

export function facilitiesFromCSV(text) {
  const rows = parseCSV(text)
  if (rows.length < 2) return []
  const headers = rows[0].map(h => h.trim().toLowerCase())
  return rows.slice(1).map(r => {
    const o = {}; headers.forEach((h, i) => { o[h] = (r[i] || '').trim() })
    const lat = parseFloat(pick(o, ['lat', 'latitude']))
    const lng = parseFloat(pick(o, ['lng', 'lon', 'long', 'longitude']))
    return {
      name: pick(o, ['name', 'facility', 'facility name']) || 'Unnamed facility',
      category: pick(o, ['category', 'licensed category', 'type']),
      area: pick(o, ['area', 'lga', 'location']) || 'Unassigned',
      address: pick(o, ['address']),
      last_visit: pick(o, ['last_visit', 'previous', 'previous monitoring date', 'last visit']),
      lat: isNaN(lat) ? null : lat,
      lng: isNaN(lng) ? null : lng
    }
  })
}

/* ---------- optional geocode (OpenStreetMap Nominatim, best-effort, no key) ---------- */
export async function geocode(address) {
  const q = encodeURIComponent(address + ', Lagos, Nigeria')
  const res = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + q, { headers: { 'Accept': 'application/json' } })
  const j = await res.json()
  if (j && j[0]) return { lat: parseFloat(j[0].lat), lng: parseFloat(j[0].lon) }
  return null
}

/* ---------- facilities store (Supabase or demo/localStorage) ---------- */
const LS_FAC = 'realms_facilities'
const LS_ASG = 'realms_assignments'
function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || '[]') } catch (e) { return [] } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) { /* ignore */ } }
function uid() { return 'loc_' + Math.random().toString(36).slice(2, 10) }

function nullEmpty(v) { return (v === '' || v === undefined) ? null : v }
function cleanRow(obj) { const o = { ...obj }; Object.keys(o).forEach(k => { if (o[k] === '') o[k] = null }); return o }

// A weak connection can leave a query hanging or failing. This gives each read a
// time limit and a couple of retries with a short backoff, so a brief dip recovers
// on its own instead of silently returning nothing. Throws only after all tries fail,
// so the caller can tell a real failure from a genuinely empty result.
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('The database did not respond in time. Check your connection and try again.')), ms)
    promise.then(v => { clearTimeout(t); resolve(v) }, e => { clearTimeout(t); reject(e) })
  })
}
async function runQuery(fn, { tries = 3, timeout = 12000 } = {}) {
  let lastErr
  for (let i = 0; i < tries; i++) {
    try {
      const { data, error } = await withTimeout(fn(), timeout)
      if (error) throw error
      return data || []
    } catch (e) {
      lastErr = e
      if (i < tries - 1) await new Promise(r => setTimeout(r, 600 * (i + 1)))
    }
  }
  throw lastErr
}

// Remember the last data a query returned, so a later failure can fall back to it
// instead of showing nothing. The cache is only ever READ when the live query fails,
// so a working connection always wins; a brief drop shows the last real picture,
// clearly marked as possibly out of date rather than silently stale.
function cacheKey(name) { return 'realms_cache_' + name }
function cacheSave(name, rows) {
  try { localStorage.setItem(cacheKey(name), JSON.stringify({ at: new Date().toISOString(), rows })) } catch (e) { /* quota, ignore */ }
}
function cacheLoad(name) {
  try { const raw = localStorage.getItem(cacheKey(name)); if (!raw) return null; const p = JSON.parse(raw); if (p && Array.isArray(p.rows)) return p } catch (e) {}
  return null
}
// Returns { rows, stale, cachedAt }. stale=true means the live read failed and these
// rows came from the last successful load. In demo mode there is no server to fail,
// so it just returns the local rows as fresh.
async function listResilient(name, liveFn, localFn) {
  if (MODE !== 'supabase') return { rows: await localFn(), stale: false, cachedAt: null }
  try {
    const rows = await liveFn()
    cacheSave(name, rows)
    return { rows, stale: false, cachedAt: null }
  } catch (e) {
    const cached = cacheLoad(name)
    if (cached) return { rows: cached.rows, stale: true, cachedAt: cached.at, error: e }
    throw e
  }
}

export const facilities = {
  async list() {
    if (MODE === 'supabase') {
      return await runQuery(() => supabase.from('facilities').select('*').order('area', { ascending: true }))
    }
    return lsGet(LS_FAC)
  },
  async addMany(items, userId) {
    if (MODE === 'supabase') {
      const rows = items.map(f => ({ ...cleanRow(f), created_by: userId || null }))
      const { data, error } = await supabase.from('facilities').insert(rows).select()
      if (error) throw error
      return data || []
    }
    const cur = lsGet(LS_FAC); const added = items.map(f => ({ ...f, id: uid() }))
    lsSet(LS_FAC, cur.concat(added)); return added
  },
  async remove(id) {
    if (MODE === 'supabase') { const { error } = await supabase.from('facilities').delete().eq('id', id); if (error) throw error; return }
    lsSet(LS_FAC, lsGet(LS_FAC).filter(f => f.id !== id))
  },
  async update(id, patch) {
    if (MODE === 'supabase') { const { error } = await supabase.from('facilities').update(cleanRow(patch)).eq('id', id); if (error) throw error; return }
    lsSet(LS_FAC, lsGet(LS_FAC).map(f => f.id === id ? { ...f, ...patch } : f))
  }
}

export const assignments = {
  async list() {
    if (MODE === 'supabase') {
      const { data, error } = await supabase.from('assignments').select('*').order('visit_date', { ascending: true })
      if (error) throw error
      return data || []
    }
    return lsGet(LS_ASG)
  },
  async add(a, userId) {
    if (MODE === 'supabase') {
      const { data, error } = await supabase.from('assignments').insert([{ ...cleanRow(a), created_by: userId || null }]).select()
      if (error) throw error
      return (data && data[0]) || a
    }
    const cur = lsGet(LS_ASG); const rec = { ...a, id: uid(), created_at: new Date().toISOString() }
    lsSet(LS_ASG, cur.concat([rec])); return rec
  }
}

/* ---------- visits (Engage, Stage 4) ---------- */
const LS_VIS = 'realms_visits'
export const visits = {
  async list() {
    if (MODE === 'supabase') {
      return await runQuery(() => supabase.from('visits').select('*').order('created_at', { ascending: false }))
    }
    return lsGet(LS_VIS)
  },
  // Like list(), but on a failed live read falls back to the last successful load
  // and flags it stale, so the dashboard can show yesterday's picture rather than a dash.
  async listCached() {
    return await listResilient('visits',
      () => runQuery(() => supabase.from('visits').select('*').order('created_at', { ascending: false })),
      () => lsGet(LS_VIS))
  },
  async add(v, userId) {
    if (MODE === 'supabase') {
      const { data, error } = await supabase.from('visits').insert([{ ...cleanRow(v), created_by: userId || null }]).select()
      if (error) throw error
      return (data && data[0]) || v
    }
    const cur = lsGet(LS_VIS); const rec = { ...v, id: uid(), created_at: new Date().toISOString() }
    lsSet(LS_VIS, [rec].concat(cur)); return rec
  },
  async update(id, patch) {
    if (MODE === 'supabase') { const { error } = await supabase.from('visits').update(cleanRow(patch)).eq('id', id); if (error) throw error; return }
    lsSet(LS_VIS, lsGet(LS_VIS).map(v => v.id === id ? { ...v, ...patch } : v))
  },
  async addMany(rows, userId) {
    if (!rows || !rows.length) return []
    if (MODE === 'supabase') {
      const clean = rows.map(r => ({ ...cleanRow(r), created_by: userId || null }))
      const out = []
      for (let i = 0; i < clean.length; i += 100) {
        const { data, error } = await supabase.from('visits').insert(clean.slice(i, i + 100)).select()
        if (error) throw error
        out.push(...(data || []))
      }
      return out
    }
    const cur = lsGet(LS_VIS); const recs = rows.map(r => ({ ...r, id: uid(), created_at: new Date().toISOString() }))
    lsSet(LS_VIS, recs.concat(cur)); return recs
  }
}

/* ---------- AI (Claude proxy) ---------- */
export async function askAI(body) {
  try {
    const r = await fetch('/api/ai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) })
    return await r.json().catch(() => ({ ok: false, reason: 'bad_response' }))
  } catch (e) { return { ok: false, reason: 'network' } }
}

/* ---------- HQ access requests (only the exco account admits HQ users) ---------- */
const LS_ACC = 'realms_access'
export const access = {
  async list() {
    if (MODE === 'supabase') { const { data, error } = await supabase.from('access_requests').select('*').order('created_at', { ascending: false }); if (error) throw error; return data || [] }
    return lsGet(LS_ACC)
  },
  async mine(userId, role) {
    if (!userId) return null
    const r = role || 'rhsc_hq'
    if (MODE === 'supabase') { const { data } = await supabase.from('access_requests').select('*').eq('user_id', userId).eq('role', r).maybeSingle(); return data || null }
    return lsGet(LS_ACC).find(x => x.user_id === userId && x.role === r) || null
  },
  async request(r) {
    if (MODE === 'supabase') {
      const { data, error } = await supabase.from('access_requests').upsert({ ...cleanRow(r), status: 'pending' }, { onConflict: 'user_id,role' }).select()
      if (error) throw error
      return (data && data[0]) || r
    }
    const cur = lsGet(LS_ACC).filter(x => !(x.user_id === r.user_id && x.role === r.role))
    const rec = { ...r, id: uid(), status: 'pending', created_at: new Date().toISOString() }
    lsSet(LS_ACC, [rec].concat(cur)); return rec
  },
  async decide(id, status, by) {
    const patch = { status, decided_by: by || null, decided_at: new Date().toISOString() }
    if (MODE === 'supabase') { const { error } = await supabase.from('access_requests').update(patch).eq('id', id); if (error) throw error; return }
    lsSet(LS_ACC, lsGet(LS_ACC).map(r => r.id === id ? { ...r, ...patch } : r))
  }
}

/* ---------- notifications + call logs (customer service follow-ups) ---------- */
const LS_NOTIF = 'realms_notifications'
export const notifications = {
  async list() {
    if (MODE === 'supabase') { const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }); if (error) throw error; return data || [] }
    return lsGet(LS_NOTIF)
  },
  async add(n, userId) {
    if (MODE === 'supabase') { const { data, error } = await supabase.from('notifications').insert([{ ...cleanRow(n), created_by: userId || null }]).select(); if (error) throw error; return (data && data[0]) || n }
    const cur = lsGet(LS_NOTIF); const rec = { ...n, id: uid(), created_at: new Date().toISOString() }; lsSet(LS_NOTIF, [rec].concat(cur)); return rec
  }
}
const LS_CALL = 'realms_calls'
export const calls = {
  async list() {
    if (MODE === 'supabase') { const { data, error } = await supabase.from('calls').select('*').order('created_at', { ascending: false }); if (error) throw error; return data || [] }
    return lsGet(LS_CALL)
  },
  async add(c, userId) {
    if (MODE === 'supabase') { const { data, error } = await supabase.from('calls').insert([{ ...cleanRow(c), created_by: userId || null }]).select(); if (error) throw error; return (data && data[0]) || c }
    const cur = lsGet(LS_CALL); const rec = { ...c, id: uid(), created_at: new Date().toISOString() }; lsSet(LS_CALL, [rec].concat(cur)); return rec
  }
}

/* ---------- evidence storage (Supabase Storage; falls back to inline data URL) ---------- */
function dataUrlToBlob(dataUrl) {
  const parts = dataUrl.split(','); const meta = parts[0] || ''; const b64 = parts[1] || ''
  const mime = (meta.match(/:(.*?);/) || [])[1] || 'application/octet-stream'
  const bin = atob(b64); const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: mime })
}
export async function uploadEvidence(visitId, type, dataUrl) {
  if (MODE !== 'supabase' || !supabase) return dataUrl
  try {
    const blob = dataUrlToBlob(dataUrl)
    const ext = type === 'voice' ? 'webm' : 'jpg'
    const path = (visitId || 'v') + '/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.' + ext
    const { error } = await supabase.storage.from('evidence').upload(path, blob, { contentType: blob.type, upsert: false })
    if (error) throw error
    const { data } = supabase.storage.from('evidence').getPublicUrl(path)
    return (data && data.publicUrl) || dataUrl
  } catch (e) { return dataUrl }
}

/* ---------- notifications (posts to the /api/notify serverless function) ---------- */
export async function sendNotify(payload) {
  try {
    const res = await fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const j = await res.json().catch(() => ({ ok: false, reason: 'bad_response' }))
    if (!res.ok) return { ok: false, reason: j.reason || ('http_' + res.status) }
    return j
  } catch (e) { return { ok: false, reason: 'network' } }
}

/* ---------- live facilities: Realms Consulting, Alimosho & Ifako-Ijaiye (first visits completed; second visits due Aug 2026) ---------- */
const LIVE_FACILITIES = [
  { name: 'Rave Dental Clinic', category: 'Dental Clinic', area: 'Ifako-Ijaiye', address: '5B College Road, Ogba', last_visit: '2026-02-23', fv_status: 'Registered', fv_beds: '' },
  { name: 'Life Oasis Hospital', category: 'Hospital', area: 'Ifako-Ijaiye', address: '65 Oyemekun Street, off College Road, Ifako Ijaiye', last_visit: '2026-02-23', fv_status: 'Registered', fv_beds: '6' },
  { name: 'The Mercy Grace Hospital', category: 'Hospital', area: 'Ifako-Ijaiye', address: '49, Oshooa Street, Ifako Ijaye', last_visit: '2026-02-23', fv_status: 'Registered', fv_beds: '9' },
  { name: 'Finesse Specialist Dental Clinic & Surgery', category: 'Dental Clinic', area: 'Alimosho', address: '109 Abeokuta Expressway, Iyana Ipaja', last_visit: '2026-02-24', fv_status: 'Registration in progress', fv_beds: '' },
  { name: 'Mucas Hospital', category: 'Hospital', area: 'Alimosho', address: '19, Ogun Street, Adealu B/Stop, Dopemu', last_visit: '2026-02-24', fv_status: 'Registered', fv_beds: '13' },
  { name: 'D\'Great Ark Hospital', category: 'Hospital', area: 'Alimosho', address: '28, Modupe Ayoade Street, Araromi Bus Stop, Lagos Abeokuta Express Way', last_visit: '2026-02-24', fv_status: 'Registered', fv_beds: '11' },
  { name: 'Krown Hospital', category: 'Hospital', area: 'Alimosho', address: '11, Alhaji Sekoni Street, Off Alimosho Road, Iyana Ipaja, Lagos', last_visit: '2026-02-24', fv_status: 'Registered', fv_beds: '23' },
  { name: 'Zoe Medical Laboratory', category: 'Laboratory', area: 'Alimosho', address: '81, Alimosho Road, Off Alaguntan B/Stop, Alimosho LGA, Iyana Ipaja, Lagos state', last_visit: '2026-02-24', fv_status: 'Registered', fv_beds: '' },
  { name: 'Faith Hill Specialist Hospital', category: 'Specialist Hospital', area: 'Alimosho', address: '87, Alimosho Road, Alagutan B/Stop, Iyana Ipaja, Lagos', last_visit: '2026-02-24', fv_status: 'Registered', fv_beds: '13' },
  { name: 'Samily Medical Diagnostic Centre', category: 'Diagnostic Centre', area: 'Alimosho', address: '1 Kola Oguyale street beside Occeanic bank iyana ipaja', last_visit: '2026-02-24', fv_status: 'Registered', fv_beds: '' },
  { name: 'Graph Diagnostic Center', category: 'Diagnostic Centre', area: 'Alimosho', address: '33 New Ipaja Road, Ipaja', last_visit: '2026-02-24', fv_status: 'Registered', fv_beds: '' },
  { name: 'Sofey-Medical Laboratory and Blood Bank', category: 'Laboratory', area: 'Alimosho', address: '6 Sunny Alebiosu Street, Iyana Ipaja', last_visit: '2026-02-24', fv_status: 'Registered', fv_beds: '' },
  { name: 'Famacare Diagnostic Centre', category: 'Diagnostic Centre', area: 'Ifako-Ijaiye', address: '558 Lagos Abeokuta Expressway', last_visit: '2026-02-25', fv_status: 'Registration in progress', fv_beds: '' },
  { name: 'True Test Medical Diagnostics', category: 'Diagnostic Centre', area: 'Ifako-Ijaiye', address: '473b Lagos-Abeokuta Expy, U-turn bus/stop, Abule Egba, Lagos', last_visit: '2026-02-25', fv_status: 'Registration in progress', fv_beds: '' },
  { name: 'Ahmadiyya Muslim Hospital', category: 'Hospital', area: 'Ifako-Ijaiye', address: 'KLM 27, Abeokuta Express Way, Ojokoro', last_visit: '2026-02-25', fv_status: 'Registered', fv_beds: '23' },
  { name: 'Chygor-Cole Specialist Hospital', category: 'Specialist Hospital', area: 'Ifako-Ijaiye', address: '123 Agbe road, Jibowu estate, Abule Egba', last_visit: '2026-02-25', fv_status: 'Registered', fv_beds: '16' },
  { name: 'Apex Crown Eye Clinic', category: 'Eye Clinic', area: 'Ifako-Ijaiye', address: 'Akintode family complex, Agbado Ijaiye road', last_visit: '2026-02-25', fv_status: 'Registered', fv_beds: '' },
  { name: 'Mac Medical Diagnostic Centre', category: 'Diagnostic Centre', area: 'Ifako-Ijaiye', address: '46 Agbado Oja Road, Ijaiye, Ojokoro, Lagos', last_visit: '2026-02-25', fv_status: 'Registered', fv_beds: '' },
  { name: 'Health Embassy Diagnostics', category: 'Diagnostic Centre', area: 'Ifako-Ijaiye', address: '54 Agbado Oja Road, Ijaiye, Ojokoro, Lagos', last_visit: '2026-02-25', fv_status: 'Registered', fv_beds: '' },
  { name: 'True Love Convalescent Home', category: 'Convalescent Home', area: 'Ifako-Ijaiye', address: '54, Agbado Station Road, Ijaye, Ojokoro', last_visit: '2026-02-25', fv_status: 'Registered', fv_beds: '8' },
  { name: 'Uptown Medical Centre', category: 'Hospital', area: 'Ifako-Ijaiye', address: '60 Agbado Station Road, off Ijaiye b/stop Ijaiye Ojokoro', last_visit: '2026-02-25', fv_status: 'Registered', fv_beds: '21' },
  { name: 'D Champions Nursing Home', category: 'Nursing Home', area: 'Ifako-Ijaiye', address: '1 Akibu Adeniji Street, Ijaiye, Ojokoro', last_visit: '2026-02-25', fv_status: 'Registered', fv_beds: '4' },
  { name: 'Victorian Clinic', category: 'Clinic', area: 'Ifako-Ijaiye', address: '5 Anne Street, Alagbado', last_visit: '2026-02-25', fv_status: 'Registered', fv_beds: '' },
  { name: 'Efosa Medical Centre', category: 'Hospital', area: 'Ifako-Ijaiye', address: '4 Almuruf Adeola Street, Jankara, Ijaiye', last_visit: '2026-02-25', fv_status: 'Registered', fv_beds: '9' },
  { name: 'Q - Health Laboratory And Diagnostics', category: 'Diagnostic Centre', area: 'Ifako-Ijaiye', address: '90 Nureni Yusuf Road, Kola', last_visit: '2026-02-25', fv_status: 'Registered', fv_beds: '' },
  { name: 'Cavesbury Hospital', category: 'Hospital', area: 'Ifako-Ijaiye', address: 'The Caresbury off Abraham Afolabi Str, Lagos Abeokuta expressway, Ojokoro', last_visit: '2026-02-26', fv_status: 'Registered', fv_beds: '14' },
  { name: 'Solidarity Convalescent Home', category: 'Convalescent Home', area: 'Ifako-Ijaiye', address: '22, Oguntana Street, Ijaye Ojokoro', last_visit: '2026-02-26', fv_status: 'Registered', fv_beds: '6' },
  { name: 'Longing Hospital', category: 'Hospital', area: 'Ifako-Ijaiye', address: '3 - 5, Josepha Close, off Ogundeji Oguntona Street, by Ajala bus stop, Lagos', last_visit: '2026-02-26', fv_status: 'Registered', fv_beds: '40' },
  { name: 'Bisam Hospital', category: 'Hospital', area: 'Ifako-Ijaiye', address: '612 Lagos Abeokuta Expressway, Lagos', last_visit: '2026-02-26', fv_status: 'Registered', fv_beds: '8' },
  { name: 'Olutomi Nursing Home', category: 'Nursing Home', area: 'Ifako-Ijaiye', address: '8B Showemimo Street, Adura b/stop, Alagbado, Ifako', last_visit: '2026-02-26', fv_status: 'Registered', fv_beds: '4' },
  { name: 'St. Margaret’s Vision Care Cantre', category: 'Eye Clinic', area: 'Ifako-Ijaiye', address: '640b Lagos Abeokuta express way, by Clem road, Salolo busstop, Alagbado, Lagos', last_visit: '2026-02-26', fv_status: 'Registered', fv_beds: '' },
  { name: 'Shalom Medical Centre', category: 'Hospital', area: 'Ifako-Ijaiye', address: '4 Oyero Street, Alagbado, Ifako', last_visit: '2026-02-26', fv_status: 'Registered', fv_beds: '14' },
  { name: 'Rem-Yems Hospital', category: 'Hospital', area: 'Ifako-Ijaiye', address: '7 Fatunbi Street, Alagbado, Lagos', last_visit: '2026-02-26', fv_status: 'Registered', fv_beds: '9' },
  { name: 'Jomafort Maternity Home', category: 'Maternity Home', area: 'Ifako-Ijaiye', address: '4, Sunday Alade Street, Ojoko, Ifako Ijaiye', last_visit: '2026-02-26', fv_status: 'Registered', fv_beds: '4' },
  { name: 'Life Builders Hospital', category: 'Hospital', area: 'Ifako-Ijaiye', address: '45, Lamina Ganiyu Street, Alakuko, Dalemo, Lagos State', last_visit: '2026-02-26', fv_status: 'Registered', fv_beds: '14' },
  { name: 'Horama Eye Clinic', category: 'Eye Clinic', area: 'Ifako-Ijaiye', address: 'Suite B11, The Libra Plaza, 87/89 Baale Animashaun Road, beside Justrite, Alakuko, Lagos', last_visit: '2026-02-26', fv_status: 'Registration in progress', fv_beds: '' },
  { name: 'Precious Gift Medicals', category: 'Hospital', area: 'Ifako-Ijaiye', address: '81, Adenekan Street, Alakuko', last_visit: '2026-02-26', fv_status: 'Registered', fv_beds: '16' },
  { name: 'Geo-Marie Hospital', category: 'Hospital', area: 'Ifako-Ijaiye', address: '3 Adepegba Street, Abule - Egba', last_visit: '2026-02-27', fv_status: 'Registered', fv_beds: '12' },
  { name: 'Best Assurance Laboratory', category: 'Laboratory', area: 'Ifako-Ijaiye', address: '1 Sanni Balogun Street, off Ayowole Egba Ifako', last_visit: '2026-02-27', fv_status: 'Registered', fv_beds: '' },
  { name: 'Still Water Hospital', category: 'Hospital', area: 'Ifako-Ijaiye', address: '53/54 Agbe Road Abule Egba', last_visit: '2026-02-27', fv_status: 'Registered', fv_beds: '11' },
  { name: 'Standard Life Care Hospital', category: 'Hospital', area: 'Ifako-Ijaiye', address: '5, Paul street, Off Sanni Balogun street New Oko Oba Abule Egba', last_visit: '2026-02-27', fv_status: 'Registered', fv_beds: '22' },
  { name: 'Grace Fountain Medical Centre', category: 'Hospital', area: 'Ifako-Ijaiye', address: '11, Ileogbo Street, Abule-Egba', last_visit: '2026-02-27', fv_status: 'Registered', fv_beds: '9' },
  { name: 'The phoenix Medical Centre', category: 'Hospital', area: 'Ifako-Ijaiye', address: '25a, Olaniyi Street, Oko Oba', last_visit: '2026-02-27', fv_status: 'Registered', fv_beds: '5' },
  { name: 'First Mainland Hospital', category: 'Hospital', area: 'Ifako-Ijaiye', address: '66, Sanni Balogun Street, Abule-Egba', last_visit: '2026-02-27', fv_status: 'Registered', fv_beds: '16' },
  { name: 'Kingdom Health Hospital', category: 'Hospital', area: 'Ifako-Ijaiye', address: '205, Olaniyi Street, New Oko-Oba', last_visit: '2026-02-27', fv_status: 'Registered', fv_beds: '8' },
  { name: 'Dandy Medical Centre', category: 'Hospital', area: 'Ifako-Ijaiye', address: '3, Olayiwola Street, Charity Road Oko Oba Abule Egba', last_visit: '', fv_status: 'Registered', fv_beds: '7' },
  { name: 'Samom Medical Centre', category: 'Hospital', area: 'Ifako-Ijaiye', address: '5, Anu-Oluwapo Street, Ijaiye', last_visit: '', fv_status: 'Registered', fv_beds: '6' },
  { name: 'Masol Hospital and Maternity Home', category: 'Hospital', area: 'Ifako-Ijaiye', address: 'Oko-Oba Road, Abule Egba, Lagos.', last_visit: '', fv_status: 'Registered', fv_beds: '20' },
  { name: 'FMH Medical Center', category: 'Hospital', area: 'Ifako-Ijaiye', address: '5 Progress College Road, off Car wash, new oko Oba', last_visit: '', fv_status: 'Registered', fv_beds: '5' },
  { name: 'Anthony Cardinal Okojie Medical Centre', category: 'Hospital', area: 'Ifako-Ijaiye', address: '1 Akinsegun Street, Oko-Oba Rd, Abule Egba, Lagos', last_visit: '', fv_status: 'Registered', fv_beds: '6' },
  { name: 'Precise Diagnostics', category: 'Diagnostic Centre', area: 'Ifako-Ijaiye', address: '1 Ayodel Close, off Jonathan Coker Road, Iju', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Eagle Hospital and Health Consultancy Services', category: 'Hospital', area: 'Ifako-Ijaiye', address: '35 Charity Road, New Oko-oba,', last_visit: '', fv_status: 'Registered', fv_beds: '4' },
  { name: 'Madek Hospital', category: 'Hospital', area: 'Ifako-Ijaiye', address: '19 Abimbola Awoliyi Estate, Oko-Oba', last_visit: '', fv_status: 'Registered', fv_beds: '6' },
  { name: 'Ayodele Medical Centre', category: 'Hospital', area: 'Ifako-Ijaiye', address: '1 Ayodele Close, off Jonathan Coker Road, Iju', last_visit: '', fv_status: 'Registered', fv_beds: '36' },
  { name: 'Vital Hope Dental Clinic', category: 'Dental Clinic', area: 'Ifako-Ijaiye', address: '17b Olayiwola Street, New Oko- Oba', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Hallmark Diagnostics Centre', category: 'Diagnostic Centre', area: 'Ifako-Ijaiye', address: '1 Olayiwola Street, beside NNPC filling station, Abule- Egba, New Oko Oba', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Monike Medical Laboratory and Diagnostic Centre', category: 'Diagnostic Centre', area: 'Alimosho', address: '9 Akowonjo Road, Shasha Round About Bus stop', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Kintel Eye Clinic', category: 'Eye Clinic', area: 'Alimosho', address: '1 Olufemi Ojo Street, by C.K.C Junction, Shasha Road, Shasha', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Joenel Medical Laboratory Services', category: 'Laboratory', area: 'Alimosho', address: '52 Shasha Road, Beside Access Bank, Roundabout Akowonjo, Lagos', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Blossom Rose Hospital', category: 'Hospital', area: 'Ifako-Ijaiye', address: '10, Feed Williams Street, Iju-Ishaga', last_visit: '', fv_status: 'Registered', fv_beds: '2' },
  { name: 'Saint Crost Hospital', category: 'Hospital', area: 'Ifako-Ijaiye', address: '208, Iju Road, Iju-Ishaga Lagos', last_visit: '', fv_status: 'Registered', fv_beds: '13' },
  { name: 'Osuntuyi Hospital', category: 'Hospital', area: 'Ifako-Ijaiye', address: '255, Iju Water Works Rd, Ishaga, Agege', last_visit: '', fv_status: 'Registered', fv_beds: '30' },
  { name: 'O&G Healthcare', category: 'Hospital', area: 'Ifako-Ijaiye', address: '4b, Balogun Street, Iju Ishaga, Lagos', last_visit: '', fv_status: 'Registered', fv_beds: '6' },
  { name: 'Sarry-At Memorial Maternity Home.', category: 'Maternity Home', area: 'Ifako-Ijaiye', address: '9 Omo Ojule Street, Balogun, Iju', last_visit: '', fv_status: 'Registered', fv_beds: '6' },
  { name: 'God’s Presence Hospital', category: 'Hospital', area: 'Ifako-Ijaiye', address: '17, Mokin Street Akinde Street, Off Balogun Road, Ifako Ijaiye', last_visit: '', fv_status: 'Registered', fv_beds: '7' },
  { name: 'AquarLibra Maternity home', category: 'Maternity Home', area: 'Ifako-Ijaiye', address: '1, Ogunbusola Street, Off Balogun Road, Iju Ishaga', last_visit: '', fv_status: 'Registered', fv_beds: '8' },
  { name: 'Rays And Waves Radiology Clinic', category: 'Diagnostic Centre', area: 'Ifako-Ijaiye', address: '66A Iju Road, Ifako Ijaiye', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Goodnews Diagnostic Services', category: 'Diagnostic Centre', area: 'Ifako-Ijaiye', address: '154 Iju Road, Ifako-Ijaiye', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Olumade Dental Clinic', category: 'Dental Clinic', area: 'Ifako-Ijaiye', address: '154 Iju Road, Ifako Ijaiye', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Emerald Hospital', category: 'Hospital', area: 'Ifako-Ijaiye', address: '29 jungle B/Stop, African Church road, Ifako Ijaiye', last_visit: '', fv_status: 'Registered', fv_beds: '5' },
  { name: 'Cheers Medical Diagnostic Centre', category: 'Diagnostic Centre', area: 'Ifako-Ijaiye', address: '94 Iju Road, Ifako Ijaiye', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Life Channel Medical Diagnostic Centre', category: 'Diagnostic Centre', area: 'Ifako-Ijaiye', address: '146, Iju Road, Fagba Bus Stop, Iju, Lagos', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Oris Medical Laboratory', category: 'Laboratory', area: 'Ifako-Ijaiye', address: '44 Ajayi Road, Mechanic Bus Stop, Ogba', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Ariyibi Medical Laboratory', category: 'Laboratory', area: 'Ifako-Ijaiye', address: '3, Agbado Road, Iju Ishaga', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Newsprings Medical Laboratory', category: 'Laboratory', area: 'Ifako-Ijaiye', address: '31 Agbado Road, Iju Ishaga', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Mary And J Medical Laboratory', category: 'Laboratory', area: 'Ifako-Ijaiye', address: '50 Agbado Road Toyota Bus Stop Iju Ishaga', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Deji Clinic', category: 'Hospital', area: 'Ifako-Ijaiye', address: '56 Tokotaya Bus stop Iju Ishaga Lagos', last_visit: '', fv_status: 'Registered', fv_beds: '10' },
  { name: 'Longe Medical Centre', category: 'Hospital', area: 'Ifako-Ijaiye', address: '126, Olusegun Osoba Rd, Agbado', last_visit: '', fv_status: 'Registered', fv_beds: '29' },
  { name: 'Saint Paul Medical Centre', category: 'Hospital', area: 'Ifako-Ijaiye', address: '108, Agbado Road, Iju Ishaga', last_visit: '', fv_status: 'Registered', fv_beds: '5' },
  { name: 'Pro-Lifer Laboratory', category: 'Laboratory', area: 'Ifako-Ijaiye', address: '324 Iju Water Works, Elliot Bus Stop, Iju Ishaga', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Pacific Hospital', category: 'Hospital', area: 'Ifako-Ijaiye', address: '314 Iju Water Works Road, Iju Ishaga', last_visit: '', fv_status: 'Registered', fv_beds: '11' },
  { name: 'Ancilla Catholic Hospital', category: 'Hospital', area: 'Ifako-Ijaiye', address: '3 Mayowa Olojo Street, Iju', last_visit: '', fv_status: 'Registered', fv_beds: '20' },
  { name: 'Fragrance Of Praise Specialist Hospital', category: 'Specialist Hospital', area: 'Ifako-Ijaiye', address: '1b, Alkat Way, Off, Alhaji Mustapha Street, By Arojah Church, Iju - Ishaga', last_visit: '', fv_status: 'Registered', fv_beds: '7' },
  { name: 'Bayo Medical Centre', category: 'Hospital', area: 'Ifako-Ijaiye', address: '1, Akinyele Close, Off Oremeji Street, Obawole, Ifako Ijaiye', last_visit: '', fv_status: 'Registered', fv_beds: '9' },
  { name: 'Alabs Medical Laboratory', category: 'Laboratory', area: 'Ifako-Ijaiye', address: '1/3 Unity Close, Carwash Bus Stop, Obawole, Ifako Ijaye', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Alife Medical Diagnostics', category: 'Diagnostic Centre', area: 'Ifako-Ijaiye', address: 'Ashabi Taiwo, Obawole, Ifako Ijaiye', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Joelin Medical Laboratory Services', category: 'Laboratory', area: 'Ifako-Ijaiye', address: '40, Kajola Street, Obawole, Ifako Ijaiye', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Jbm-3 Medics Medical Laboratory', category: 'Laboratory', area: 'Ifako-Ijaiye', address: '1, Fred William Station Bustop, Ifako Ijaye', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Milagrosa Hospital', category: 'Hospital', area: 'Ifako-Ijaiye', address: '10 Ashabi Taiwo, Obawole Ifako Ijaiye', last_visit: '', fv_status: 'Registered', fv_beds: '4' },
  { name: 'Hanoville Specialist Hospital', category: 'Hospital', area: 'Ifako-Ijaiye', address: '14, Iyero Okojie Crescent, Off Oloyede Street, Behind Ndika Market Obawole, Ifako-Ijaiye', last_visit: '', fv_status: 'Registered', fv_beds: '9' },
  { name: 'Baoseg Diagnostic Services', category: 'Diagnostic Centre', area: 'Ifako-Ijaiye', address: '74 Olusesi bus stop, Iju.', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Sanders Hospital', category: 'Hospital', area: 'Ifako-Ijaiye', address: '1 Harmony Crescent, Obawole Ifako-Ijaiye', last_visit: '', fv_status: 'Registered', fv_beds: '10' },
  { name: 'Evanson Medical Clinic', category: 'Hospital', area: 'Ifako-Ijaiye', address: '2a Iyalode Close Off Ajayi Road, Oke Ira, Ogba', last_visit: '', fv_status: 'Registered', fv_beds: '8' },
  { name: 'Bracus Specialist Hospital', category: 'Specialist Hospital', area: 'Ifako-Ijaiye', address: '5 Onayiwola Street, Off Ajayi Road, Ogba', last_visit: '', fv_status: 'Registered', fv_beds: '12' },
  { name: 'St Thomas Hospital', category: 'Hospital', area: 'Ifako-Ijaiye', address: '17, Awoni-Murphy Street, Ifako-Ijaiye', last_visit: '', fv_status: 'Registered', fv_beds: '14' },
  { name: 'Our Friend Hospital', category: 'Hospital', area: 'Ifako-Ijaiye', address: '10, Adepitan Street, Off Haruna Street, Ifako Ijaiye', last_visit: '', fv_status: 'Registered', fv_beds: '5' },
  { name: 'Vital Medical Laboratory', category: 'Laboratory', area: 'Ifako-Ijaiye', address: '2b, Gospel Crusader Street, Haruna Ifako Ijaiye', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Healthpoint Diagnostic Center', category: 'Diagnostic Centre', area: 'Ifako-Ijaiye', address: '54, College Road, Orimolade Bus Stop Ifako Ijaiye', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Rachael and Nana Clinic', category: 'Clinic', area: 'Ifako-Ijaiye', address: '4/6, Tomoloju Street, Yaya Abatan Ogba', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'AB10 Specialist Hospital', category: 'Specialist Hospital', area: 'Ifako-Ijaiye', address: '3, Ola Street, Karaole Estate, Ifako Ijaiye', last_visit: '', fv_status: 'Registered', fv_beds: '33' },
  { name: 'Golden Mother Maternity Home', category: 'Maternity Home', area: 'Ifako-Ijaiye', address: '27, College Road, Ifako Agege', last_visit: '', fv_status: 'Registered', fv_beds: '8' },
  { name: 'Fertigold Fertility Clinic', category: 'Fertility Clinic', area: 'Ifako-Ijaiye', address: '9, College Road, Ifako Ijaiye', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Lochum Nursing Home', category: 'Nursing Home', area: 'Ifako-Ijaiye', address: '24 Odubanwo Street, Off Olaniyi Street, Abule-Egba, Lagos', last_visit: '', fv_status: 'Registered', fv_beds: '4' },
  { name: 'Rasar Clinic and Maternity Home', category: 'Maternity Home', area: 'Ifako-Ijaiye', address: '1 Adeoye Omoekun Street, Oremerin side junction, Agbado', last_visit: '', fv_status: 'Not registered', fv_beds: '4' },
  { name: 'Blooming Care Hospital', category: 'Hospital', area: 'Ifako-Ijaiye', address: '30, Baale Animashaun Rd. Alakuko Alimosho', last_visit: '', fv_status: 'Registered', fv_beds: '16' },
  { name: 'Jefis Specialist Hospital', category: 'Specialist Hospital', area: 'Ifako-Ijaiye', address: '9, Adegbola Street, Alakuko', last_visit: '', fv_status: 'Registered', fv_beds: '24' },
  { name: 'Golden Mother Medical Laboratory', category: 'Laboratory', area: 'Ifako-Ijaiye', address: '27, College Road, Ifako Agege', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Healthpoint Digital Laboratory', category: 'Laboratory', area: 'Ifako-Ijaiye', address: '1 Taiwo Close Off College Road Near General Hospital College Bus Stop Ifako-Ijaiye', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Pnd Eye Care Clinic', category: 'Eye Clinic', area: 'Ifako-Ijaiye', address: 'African church, 20 College Road, Ifako office plaza.', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Vital Care Diagnostics', category: 'Diagnostic Centre', area: 'Ifako-Ijaiye', address: '28, Agbado Road, Adetola B/Stop', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'JWC Medical Diagnostics', category: 'Diagnostic Centre', area: 'Ifako-Ijaiye', address: '156, Nurenu Yusuf Road, MAO Junction, Alagbado', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Santos Medical Centre', category: 'Hospital', area: 'Alimosho', address: '3 Oyemade Street, Off Ogundipe Street Santo Layout Dopemu', last_visit: '', fv_status: 'Registered', fv_beds: '7' },
  { name: 'Kelvin and Blessing medical laboratory', category: 'Laboratory', area: 'Alimosho', address: '', last_visit: '', fv_status: 'Unknown', fv_beds: '' },
  { name: 'Global Medic Laboratory', category: 'Diagnostic Centre', area: 'Alimosho', address: '144, Shasha Road, Jimoh Bus Stop Alimosho', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Achusim Medical Diagnosics', category: 'Diagnostic Centre', area: 'Alimosho', address: '18A keye Oyeku street, Shasha', last_visit: '', fv_status: 'Registration in progress', fv_beds: '' },
  { name: 'Chikadif Medical Laboratory', category: 'Laboratory', area: 'Alimosho', address: '2 Jaiyeoba street, OandO filling station, Orinsunbare Shasha', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Tender Touch Hospital', category: 'Hospital', area: 'Alimosho', address: '12 Ejigbo road, Beside MTN office Shasha', last_visit: '', fv_status: 'Registered', fv_beds: '11' },
  { name: 'High Tower Hospital', category: 'Hospital', area: 'Ifako-Ijaiye', address: '1, Alalade Close, Off 568b Lagos Abeokuta Express Way, Ajala B/Stop', last_visit: '', fv_status: 'Registered', fv_beds: '6' },
  { name: 'Mudorks Diagnostics Centre', category: 'Diagnostic Centre', area: 'Ifako-Ijaiye', address: '720b, Lagos Abeokuta Express Way, Mosalashi Bus Stop,', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Life care Diagnostics', category: 'Diagnostic Centre', area: 'Ifako-Ijaiye', address: '734/736 GAO Shopping Complex, Oniyaomebi Street, Off Abeokuta Express Way', last_visit: '', fv_status: 'Not registered', fv_beds: '' },
  { name: 'St. Catherine Diagnostics', category: 'Diagnostic Centre', area: 'Ifako-Ijaiye', address: '7, Baale Animashaun Road, Alakuko, Lagos', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Ultra Lens Wellness medical laboratory', category: 'Diagnostic Centre', area: 'Ifako-Ijaiye', address: '17, Baale Animashaun Road, Opera B/Stop, Alakuko', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Dalemo Diagnostics Centre', category: 'Diagnostic Centre', area: 'Ifako-Ijaiye', address: '126, Baale Animashaun Street, Alakuko, Ifako Ijaye', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Bolutife Nursing Home', category: 'Nursing Home', area: 'Ifako-Ijaiye', address: '33, Clem Road, Ijaye-Ojokoro', last_visit: '', fv_status: 'Registered', fv_beds: '6' },
  { name: 'Sonnec Diagnostics', category: 'Diagnostic Centre', area: 'Alimosho', address: '25, Meiran Road, Beside Rimax Gate, Meiran, Lagos', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Mobonike Hospital', category: 'Hospital', area: 'Alimosho', address: '61, Meran Road Kabowe B/Stop Alimosho', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Ajike Hospital', category: 'Hospital', area: 'Alimosho', address: '1, Ajike Close, Amje B/Stop, Alagbadao', last_visit: '', fv_status: 'Registered', fv_beds: '9' },
  { name: 'St. Michael Hospital', category: 'Hospital', area: 'Alimosho', address: 'KM 974, Lagos/Abeokuta Express Way, Alakuko', last_visit: '', fv_status: 'Registered', fv_beds: '7' },
  { name: 'Sonnec Medical Diagnostics', category: 'Diagnostic Centre', area: 'Alimosho', address: '108, AIT Road, Near Joke-Ayo, B/Stop, Alagbado, Lagos', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'A&A Medical Diagnostics', category: 'Diagnostic Centre', area: 'Alimosho', address: '115, Omoroga B/Stop, Meiran, Lagos', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Careforte Medical Diagnostics', category: 'Diagnostic Centre', area: 'Alimosho', address: '137, Meiran Road, Pepsi B/Stop.', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'MCC Diagnostics Center', category: 'Diagnostic Centre', area: 'Alimosho', address: '183 Meiran Road, Oremeje B/stop Agbado', last_visit: '', fv_status: 'Registration in progress', fv_beds: '' },
  { name: 'DGod\'s Gift Medicare Hospital', category: 'Hospital', area: 'Alimosho', address: '5Peace Close, Off Winfunke Olowe Street Behind President Paint', last_visit: '', fv_status: 'Registered', fv_beds: '25' },
  { name: 'Afriglobal Medicare', category: 'Diagnostic Centre', area: 'Alimosho', address: '13, Winfunke Street, Off Lagos-Abeokuta Expressway', last_visit: '', fv_status: 'Registration in progress', fv_beds: '' },
  { name: 'First U-turn Hospital', category: 'Hospital', area: 'Alimosho', address: '2,RISIKAT MAJEROSTR. U-TURN B/STOP. ABULE-EGBA', last_visit: '', fv_status: 'Registered', fv_beds: '8' },
  { name: 'Hamkad Hospital', category: 'Hospital', area: 'Alimosho', address: '39, Olawale Cole Street, Abule-Egba', last_visit: '', fv_status: 'Registered', fv_beds: '60' },
  { name: 'Jacob\'s Nursing Home', category: 'Nursing Home', area: 'Alimosho', address: '15, Kamoru Adeyemi Street, Idimu Titun', last_visit: '', fv_status: 'Registered', fv_beds: '8' },
  { name: 'Teethcare Dental Home', category: 'Dental Clinic', area: 'Alimosho', address: '6, Kamoru Adeyemi street, jumoke bus stop, Idinmu.', last_visit: '', fv_status: 'Registration in progress', fv_beds: '' },
  { name: 'Jumoke Hospital', category: 'Hospital', area: 'Alimosho', address: '98, Ifelodun Street, Orisunbare', last_visit: '', fv_status: 'Registered', fv_beds: '6' },
  { name: 'Basis Hospital', category: 'Hospital', area: 'Alimosho', address: '32B Ogunronbi Street, Idinmu', last_visit: '', fv_status: 'Registered', fv_beds: '13' },
  { name: 'Upward Hospital', category: 'Hospital', area: 'Alimosho', address: '61 Alhaji Waidi ewe-nla Street, Idinmu', last_visit: '', fv_status: 'Registered', fv_beds: '20' },
  { name: 'Mayo-Mide Convalescent Home', category: 'Nursing Home', area: 'Alimosho', address: '7, Tawakalitu Street, Shasha', last_visit: '', fv_status: 'Registered', fv_beds: '6' },
  { name: 'Mercy Stripes Specialist Hospital', category: 'Hospital', area: 'Alimosho', address: '30 Philips Taiwo Street,Coker Estate Shasha', last_visit: '', fv_status: 'Registered', fv_beds: '10' },
  { name: 'Ajifat Convalescent Home', category: 'Nursing Home', area: 'Alimosho', address: '33, Akinwunmi Kosemani Street, Paiko, Idimu Titun, Lagos', last_visit: '', fv_status: 'Registered', fv_beds: '6' },
  { name: 'Idinmu Prime Hospital', category: 'Hospital', area: 'Alimosho', address: '14, Imobi Street, Off Ejigbo Road, Idimu', last_visit: '', fv_status: 'Registered', fv_beds: '7' },
  { name: 'Firstful Field Hospital', category: 'Hospital', area: 'Alimosho', address: '2 Otunba Adenuga Street, Off Idimu Road, Silver Estate. Ejigbo', last_visit: '', fv_status: 'Registered', fv_beds: '6' },
  { name: 'Willows Diagnostics Centre', category: 'Diagnostic Centre', area: 'Alimosho', address: '131, Idimu-Ejigbo, Lagos', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Vineyard Hospital', category: 'Hospital', area: 'Alimosho', address: '4 Gbedim Ogundeyi Street Idimu', last_visit: '', fv_status: 'Registered', fv_beds: '21' },
  { name: 'FourSquare Church Hospital', category: 'Hospital', area: 'Alimosho', address: 'Four Square Avenue Idimu', last_visit: '', fv_status: 'Closed', fv_beds: '' },
  { name: 'Ave Maria Maternity Home', category: 'Maternity Home', area: 'Alimosho', address: '2 Ewenla waidi idimu bus stop.', last_visit: '', fv_status: 'Registered', fv_beds: '2' },
  { name: 'JYMtop Hospital', category: 'Hospital', area: 'Alimosho', address: '24, Arobaba Street, Idimu, Egbeda', last_visit: '', fv_status: 'Registered', fv_beds: '4' },
  { name: 'Damolake Memorial Nursing Home', category: 'Nursing Home', area: 'Alimosho', address: '', last_visit: '', fv_status: 'Not open', fv_beds: '' },
  { name: 'Vihos Medical Laboratory', category: 'Diagnostic Centre', area: 'Alimosho', address: '13 four square road, Orisumbare road about, Shasha', last_visit: '', fv_status: 'Registration in progress', fv_beds: '' },
  { name: 'IHE Doctors Hospital', category: 'Hospital', area: 'Alimosho', address: '7A, Egunjobi Way, Shasha, Dopemu Agege, Lagos', last_visit: '', fv_status: 'Registered', fv_beds: '6' },
  { name: 'Egbeda Medical Centre', category: 'Hospital', area: 'Alimosho', address: '22/24 Oguntade Road, Shasha Alimosho', last_visit: '', fv_status: 'Registered', fv_beds: '7' },
  { name: 'Mojol Hospital', category: 'Hospital', area: 'Alimosho', address: '20B, Church Street, Shasha Bameke Lagos', last_visit: '', fv_status: 'Registered', fv_beds: '12' },
  { name: 'Life Anchor Hospital', category: 'Hospital', area: 'Alimosho', address: '17A, Bamishile Street, Off Bayo Oyegbami Street, Bameke Shahsha', last_visit: '', fv_status: 'Registered', fv_beds: '9' },
  { name: 'Mary the Queen hospital', category: 'Hospital', area: 'Alimosho', address: '29, Babalola Street, Akowonjo', last_visit: '', fv_status: 'Registered', fv_beds: '16' },
  { name: 'West Care Specialist Hospital', category: 'Hospital', area: 'Alimosho', address: '32 Samuel Street,Vulcanizer Bus Stop Akowonjo Alimosho', last_visit: '', fv_status: 'Registered', fv_beds: '64' },
  { name: 'Florence Eye Clinic', category: 'Eye Clinic', area: 'Alimosho', address: '', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Funbell Medical Diagnostics', category: 'Diagnostic Centre', area: 'Alimosho', address: '88, Akowonjo Road, Egbeda, Lagos', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Rehoboth Eye Clinic', category: 'Eye Clinic', area: 'Alimosho', address: '', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Hybrid Dental Clinic', category: 'Dental Clinic', area: 'Alimosho', address: '109 Akowonjo Road Egbeda Alimosho', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'City of Salvation Hospital', category: 'Hospital', area: 'Alimosho', address: '109 Akowonjo Road,Egbeda Alimosho', last_visit: '', fv_status: 'Registered', fv_beds: '9' },
  { name: 'Crystal Specialist Hospital', category: 'Hospital', area: 'Alimosho', address: '148 Akowonjo Road,Akowonjo Dopemu', last_visit: '', fv_status: 'Registered', fv_beds: '53' },
  { name: 'Bee- Hess Hospital', category: 'Hospital', area: 'Alimosho', address: '155, Akowonjo Road Akowonjo, Dopemu Area', last_visit: '', fv_status: 'Registered', fv_beds: '44' },
  { name: 'VisionCare Eye Clinic', category: 'Eye Clinic', area: 'Alimosho', address: '133 Akowonjo road, kwara bus stop, Egbeda Lagos.', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'GGT Diagnostics Limited', category: 'Diagnostic Centre', area: 'Alimosho', address: '134, Akowonjo Road, Ben-Esther Bus Stop, Akowonjo, Egbeda, Lagos', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'GGT Dental and Eye Clinic', category: 'Dental and Eye clinic', area: 'Alimosho', address: '134, Akowonjo Road, Ben-Esther Bus Stop, Akowonjo, Egbeda, Lagos', last_visit: '', fv_status: 'Registration in progress', fv_beds: '' },
  { name: 'GGT Clinic', category: 'Clinic', area: 'Alimosho', address: '134, Akowonjo Road, Ben-Esther Bus Stop, Akowonjo, Egbeda, Lagos', last_visit: '', fv_status: 'Registration in progress', fv_beds: '' },
  { name: 'St. Ives Hospital', category: 'Hospital', area: 'Alimosho', address: '129, Akowonjo Road, Egbeda, Lagos', last_visit: '', fv_status: 'Registered', fv_beds: '20' },
  { name: 'Mega Vision Eye Clinic', category: 'Eye Clinic', area: 'Alimosho', address: '116 Akowonjo road, Lagos.', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Famacare Clinic', category: 'Clinic', area: 'Alimosho', address: '108 Akowonjo Road, By Vulcanizer Bus Stop, Egbeda, Lagos', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Nikad Hospital', category: 'Hospital', area: 'Alimosho', address: '1b Ojo Ogundara crescent, Vulcanizer bus stop, Egbeda Lagos.', last_visit: '', fv_status: 'Registration in progress', fv_beds: '4' },
  { name: 'Moria Hospital', category: 'Hospital', area: 'Alimosho', address: '10, Jimoh Akinremi Street, Akowonjo, Egbeda', last_visit: '', fv_status: 'Registered', fv_beds: '14' },
  { name: 'Pius and Gina Laboratory', category: 'Diagnostic Centre', area: 'Alimosho', address: '107A, Akowonjo Rd, Egbeda, Alimosho', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'De-Crystal Dental Clinic', category: 'Dental Clinic', area: 'Alimosho', address: 'Block 2, 13 GF Rauf Aregbesola Mall, Pako bust stop Ipaja', last_visit: '', fv_status: 'Registration in progress', fv_beds: '' },
  { name: 'Shifau Rahmon Hospital', category: 'Hospital', area: 'Alimosho', address: '10 BN Street Off Pako Bus Stop Ipaja', last_visit: '', fv_status: 'Registered', fv_beds: '4' },
  { name: 'Rabban Medical Center', category: 'Hospital', area: 'Alimosho', address: '21, Mosan Road, Shagari Estate Ipaja, Alimosho', last_visit: '', fv_status: 'Registered', fv_beds: '5' },
  { name: 'Neotrestle Dental Climate', category: 'Dental Clinic', area: 'Alimosho', address: 'C38, Shagari Estate, Along Ipaja Road, Federal Junction, Lagos', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'WATS Hospital', category: 'Hospital', area: 'Alimosho', address: '36, Olukunle Akinola Street Akinyele Ipaja', last_visit: '', fv_status: 'Registered', fv_beds: '9' },
  { name: 'Cordent Dental Clinic', category: 'Dental Clinic', area: 'Alimosho', address: '21 Opaja road, Akinyele bus stop, Baruwa Ipaja', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Afriglobal Medical Laboratory', category: 'Diagnostic Centre', area: 'Alimosho', address: '210 ipaja road, opposite St. Andrew Anglican Church Ipaja', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Chamy Eye Clinic', category: 'Eye Clinic', area: 'Alimosho', address: 'Idris Plaza 214 Ipaja road, Akinyele bus stop Ipaja Lagos', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Folarem Eye Specialist Hospital', category: 'Eye Clinic', area: 'Alimosho', address: '25 Iperu Akesan street, Alimosho Lagos', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'St. Alexander Hospital', category: 'Hospital', area: 'Alimosho', address: '5 Dada close, Alaguntan, bus stop Iyana ipaja', last_visit: '', fv_status: 'Registered', fv_beds: '4' },
  { name: 'Echoes of Grace Eye clinic', category: 'Eye Clinic', area: 'Alimosho', address: 'Alaguntan bus stop, 77 new ipaja road, iyana ipaja Lagos', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Avon Diagnostics Center', category: 'Diagnostic Centre', area: 'Alimosho', address: 'Plot 40A, 33 road, opposite Caroline plaza Gowon estate Ipaja', last_visit: '', fv_status: 'Unknown', fv_beds: '' },
  { name: 'Prime Dental Clinic', category: 'Dental Clinic', area: 'Alimosho', address: '104, New Ipaja Road, Alimosho', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Talent Specialist Hospital', category: 'Hospital', area: 'Alimosho', address: '4th Avenue, 440, Gowon Estate, Egbeda Lagos.', last_visit: '', fv_status: 'Registered', fv_beds: '13' },
  { name: 'Seropath Medical Laboratory', category: 'Diagnostic Centre', area: 'Alimosho', address: '41 Road, Gowon Estate, Egbeda, Lagos', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'St. Joseph Medical Center', category: 'Hospital', area: 'Alimosho', address: '412 Road, Gowon (FHA) Estate, Ipaja', last_visit: '', fv_status: 'Registered', fv_beds: '24' },
  { name: 'El-Rhema Hospital', category: 'Hospital', area: 'Alimosho', address: '3rd Avenue, Plot 129B D Close Gowon Estate, Egbeda', last_visit: '', fv_status: 'Registered', fv_beds: '19' },
  { name: 'On- George Medical Diagnostic Center', category: 'Diagnostic Centre', area: 'Alimosho', address: '6, Ponle Street, Ponle B/Stop, Egbeda', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Prince and Princess Hospital', category: 'Hospital', area: 'Alimosho', address: '1ST Avenue, 12TH Road, Gowon Estate, Egbeda', last_visit: '', fv_status: 'Registered', fv_beds: '12' },
  { name: 'Gowon Estate Hospital', category: 'Hospital', area: 'Alimosho', address: 'Plt 40B, 35 Road Behind Belviens Sch., Gowan Est', last_visit: '', fv_status: 'Registered', fv_beds: '18' },
  { name: 'The Ocularist Eye Clinic', category: 'Eye Clinic', area: 'Alimosho', address: '3rd Avenue Gowon Estate, Egbeda Lagos', last_visit: '', fv_status: 'Registration in progress', fv_beds: '' },
  { name: 'Afrique Medical Clinic', category: 'Hospital', area: 'Alimosho', address: '5th Ave, 31 road, Gowon Estate Egbeda', last_visit: '', fv_status: 'Registered', fv_beds: '9' },
  { name: 'Doro Eye Clinic', category: 'Eye Clinic', area: 'Alimosho', address: '5th Ave, 52rd junction, Gowon Estate Egbeda', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'AQ Specialist Hospital', category: 'Hospital', area: 'Alimosho', address: 'House 5, 11 Road , B Close, Gowin Estate, Ipaja Lagos', last_visit: '', fv_status: 'Registration in progress', fv_beds: '3' },
  { name: 'Carix Hospital and Maternity', category: 'Hospital', area: 'Alimosho', address: 'Plot 242, 21 road, Gowon Estate Egbeda', last_visit: '', fv_status: 'Registered', fv_beds: '7' },
  { name: 'De- Goshen Dental Clinic', category: 'Dental Clinic', area: 'Alimosho', address: '22 Road, Near Sewege Junction, Gowon Estate, Off Ipaja, Lagos', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Royal Salvation Hospital', category: 'Hospital', area: 'Alimosho', address: 'No 1 Adelele Off Okunolala Rd Gowon Estate Egbeda', last_visit: '', fv_status: 'Registered', fv_beds: '10' },
  { name: 'Fastident Dental Clinic', category: 'Dental Clinic', area: 'Alimosho', address: '11 Road ,Federal Junction ,Gowon Estate Ipaja', last_visit: '', fv_status: 'Registration in progress', fv_beds: '' },
  { name: 'Immalik Eye Care Clinic', category: 'Eye Clinic', area: 'Alimosho', address: 'Suite 21 All seasons Plaza Gowon Estate, Egbeda', last_visit: '', fv_status: 'Registered', fv_beds: '' },
  { name: 'Best Consult Hospital', category: 'Hospital', area: 'Alimosho', address: 'Plot 1 Jakande Housing Estate Adesan Ipaja', last_visit: '', fv_status: 'Registered', fv_beds: '8' },
  { name: 'X- Arts Diagnostics', category: 'Diagnostic Centre', area: 'Alimosho', address: 'Block 1 Site C,Abesan Estate Gate Ipaja', last_visit: '', fv_status: 'Registered', fv_beds: '' },
]
export async function seedSampleData(userId) {
  let error = null
  const facRows = LIVE_FACILITIES.map(x => ({ name: x.name, category: x.category, area: x.area, address: x.address, last_visit: x.last_visit }))
  let facs = []
  try { facs = await facilities.addMany(facRows, userId) } catch (e) { error = (e && e.message) || String(e) }
  // one completed first-visit record per facility (historical; second visits due Aug 2026)
  try {
    const byName = {}; facs.forEach(f => { byName[(f.name || '').toLowerCase()] = f })
    const visitRows = LIVE_FACILITIES.map(x => {
      const f = byName[x.name.toLowerCase()]; if (!f) return null
      const at = (x.last_visit ? x.last_visit : '2026-02-01') + 'T09:00:00.000Z'
      return {
        facility_id: f.id, facility_name: f.name, area: f.area, arrival_time: at, status: 'debriefed',
        team: [{ name: 'RHSC Field Monitoring Team', role: 'Team' }],
        monitoring: { profile: { beds: x.fv_beds || '' }, hefamaa: { registration: x.fv_status || '', beds_no: x.fv_beds || '', address: x.address, schedule: x.category }, updatedAt: at },
        score: null, overall_rating: null,
        debrief: { strengths: [], gaps: [], narrative: 'First visit completed' + (x.last_visit ? ' on ' + x.last_visit : '') + '. Registration status: ' + (x.fv_status || 'not recorded') + '. Second visit due August 2026.', proprietor_ack: false, remediation_deadline: '', reinspection: '', letter_issued: false, first_visit: true, updatedAt: at }
      }
    }).filter(Boolean)
    if (visitRows.length) await visits.addMany(visitRows, userId)
  } catch (e) { if (!error) error = (e && e.message) || String(e) }
  // seed a few customer-service notifications + call logs so the logs are populated
  try {
    const sample = facs.slice(0, 8)
    const outcomes = ['Reached', 'No answer', 'Call back', 'Reached', 'Escalated']
    const notes = ['Facility satisfied with the visit; will action the minor gaps noted.', '', 'Asked us to call back next week to confirm progress.', 'Confirmed corrective actions are underway.', 'Escalated a critical finding to HEFAMAA for review.']
    const callers = ['Ojuma Joy', 'Anele Goodnews']
    for (let i = 0; i < sample.length; i++) {
      const f = sample[i]
      await notifications.add({ type: 'visit_completed', facility_name: f.name, area: f.area, channel: 'customer_service', status: 'pending', message: 'First visit completed at ' + f.name + ' (' + f.area + '). Customer service to call the facility to hear how the visit went.' }, userId)
    }
    for (let i = 0; i < 5 && i < sample.length; i++) {
      const f = sample[i]
      await calls.add({ facility_name: f.name, area: f.area, outcome: outcomes[i % outcomes.length], notes: notes[i % notes.length], caller: callers[i % callers.length] }, userId)
    }
  } catch (e) { if (!error) error = (e && e.message) || String(e) }
  return { count: facs.length, error }
}

/* ---------- clear everything (before going live) ---------- */
export async function clearAllData() {
  if (MODE === 'supabase' && supabase) {
    try { await supabase.from('visits').delete().not('id', 'is', null) } catch (e) {}
    try { await supabase.from('assignments').delete().not('id', 'is', null) } catch (e) {}
    try { await supabase.from('facilities').delete().not('id', 'is', null) } catch (e) {}
    try { await supabase.from('notifications').delete().not('id', 'is', null) } catch (e) {}
    try { await supabase.from('calls').delete().not('id', 'is', null) } catch (e) {}
  } else {
    try { localStorage.removeItem(LS_FAC); localStorage.removeItem(LS_ASG); localStorage.removeItem(LS_VIS); localStorage.removeItem(LS_NOTIF); localStorage.removeItem(LS_CALL) } catch (e) {}
  }
}
