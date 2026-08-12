// Data layer: demo/offline storage, seed data, camel/snake mapping, and the
// `store` API that every portal calls. Extracted from App.jsx (refactor item 5)
// so the app has one typed data boundary instead of Supabase calls scattered
// through a 5,600-line file. Kept as JS-in-TS for now (loose types) to preserve
// exact runtime behaviour; tightening the types is a later, separate pass.
/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import { supabase, SUPABASE_READY } from './config.ts'
import { LABS, LAGOS_LGAS } from './constants.ts'

function labsView() {
  const db = DEMO.read(); const ov = db.labAccred || {}; const an = db.labAccNo || {}
  const base = LABS.map(l => {
    let out = (l.id in ov ? { ...l, accredited: ov[l.id] } : l)
    if (an[l.id]) out = { ...out, accNo: an[l.id] }
    const av = (db.labAvail || {})[l.id]; if (av) out = { ...out, availability: av }
    return out
  })
  const reg = Object.values(db.regLabs || {}).filter(l => l.status !== 'Declined')
  return [...base, ...reg]
}


const DEMO = {
  key: 'safeplate:v6',
  read() { try { return JSON.parse(localStorage.getItem(this.key)) || {} } catch { return {} } },
  write(data) { try { localStorage.setItem(this.key, JSON.stringify(data)) } catch { /* ignore */ } }
}

/* --------------------------------------------------------------------------
   Offline support for field officers.

   Lagos field connectivity is unreliable, so an officer must be able to finish
   an inspection with no signal. Two pieces: a CACHE of the records they are
   likely to need (their assigned cases and a slice of the certificate
   register), and a QUEUE of actions taken while offline, replayed on
   reconnect. The cache is a working set, not the whole database, so a fully
   offline officer can check handlers that were cached, not any arbitrary ID.
   Where two officers edit the same record offline, the later sync wins.
-------------------------------------------------------------------------- */
const OFFLINE = {
  qKey: 'safeplate:outbox',
  cKey: 'safeplate:cache',
  isOffline() { return typeof navigator !== 'undefined' && navigator.onLine === false },
  queue() { try { return JSON.parse(localStorage.getItem(this.qKey)) || [] } catch { return [] } },
  setQueue(q) { try { localStorage.setItem(this.qKey, JSON.stringify(q)) } catch { /* ignore */ } },
  enqueue(op) { const q = this.queue(); q.push({ ...op, queuedAt: new Date().toISOString(), opId: 'OP-' + Date.now() + '-' + Math.floor(Math.random() * 1000) }); this.setQueue(q); return q.length },
  cache() { try { return JSON.parse(localStorage.getItem(this.cKey)) || {} } catch { return {} } },
  put(key, value) { const c = this.cache(); c[key] = { value, at: Date.now() }; try { localStorage.setItem(this.cKey, JSON.stringify(c)) } catch { /* quota */ } },
  get(key) { const c = this.cache(); return c[key] ? c[key].value : null },
  async flush(runner) {
    const q = this.queue()
    if (!q.length) return { sent: 0, failed: 0 }
    const left = []; let sent = 0, failed = 0
    for (const op of q) {
      try { await runner(op); sent++ } catch (e) { failed++; left.push(op) }
    }
    this.setQueue(left)
    return { sent, failed }
  }
}

function seedDemo() {
  const data = DEMO.read()
  if (data.seedV3) return
  const now = Date.now(), day = 86400000
  const TESTS = ['Hepatitis A', 'Hepatitis E', 'Stool Microscopy & Culture (MC)']
  const PANEL = 'Hepatitis A, Hepatitis E, Stool MC'
  const FN = ['Adewale', 'Bola', 'Kemi', 'Ngozi', 'Chidinma', 'Emeka', 'Folake', 'Tunde', 'Yewande', 'Ifeoma', 'Segun', 'Amaka', 'Musa', 'Zainab', 'Uche', 'Damilola', 'Bisi', 'Kunle', 'Ronke', 'Obinna', 'Halima', 'Femi', 'Sola', 'Chinedu', 'Temitope', 'Aisha', 'Gbenga', 'Nneka', 'Ibrahim', 'Blessing', 'Fatima', 'Efe', 'Suleiman', 'Grace', 'Kayode']
  const LN = ['Okonkwo', 'Adeyemi', 'Oladele', 'Okafor', 'Eze', 'Balogun', 'Bello', 'Ogundipe', 'Ibrahim', 'Nwosu', 'Adebayo', 'Chukwu', 'Yusuf', 'Ojo', 'Umeh', 'Lawal', 'Akinola', 'Danladi', 'Obi', 'Sani', 'Ayodele', 'Mohammed', 'Ekwueme', 'Adeniyi', 'Uzoma']
  const LABS_A = ['Lancet Ikeja', 'Synlab Victoria Island', 'Clinix Surulere', 'Medbury Yaba']
  const EMP = ['Mama Cass Kitchen', 'Sweet Sensation', 'Grill House', 'The Place', 'Chicken Republic', 'Ofada Heaven', 'Buka Express', 'Yellow Chilli', 'Cactus Restaurant', 'Terra Kulture Cafe']
  const pick = (a, i) => a[((i % a.length) + a.length) % a.length]
  const handlers = {}, orders = {}, escrow = {}, releases = [], certificates = {}
  let n = 0
  function person(yr, i) {
    n++
    const name = pick(FN, i) + ' ' + pick(LN, i * 3 + 1)
    const id = 'SP-LG-' + yr + String(1000 + n).padStart(6, '0')
    const oid = 'ORD-' + yr + '-' + String(1000 + n).padStart(6, '0')
    const lab = pick(LABS_A, i)
    const phone = '0803' + String(1000000 + (n * 7919 % 8999999)).slice(0, 7)
    handlers[id] = { safeplateId: id, name, phone, lga: pick(LAGOS_LGAS, i), employer: pick(EMP, i), nin: '', createdAt: new Date(now - (2 + n % 200) * day).toISOString() }
    return { id, oid, name, lab, phone }
  }
  const results = refer => { const r = {}; TESTS.forEach(t => r[t] = 'pass'); if (refer) r[TESTS[2]] = 'refer'; return r }
  const lsh = k => 'LSH-2026-' + String(100 + k).padStart(6, '0')

  for (let i = 0; i < 8; i++) { const q = person('2026', i); const rf = i === 3 || i === 6; orders[q.oid] = { id: q.oid, safeplateId: q.id, handlerName: q.name, phone: q.phone, lab: q.lab, tests: TESTS, results: results(rf), status: 'Submitted', createdAt: new Date(now - (1 + i % 3) * day).toISOString() }; escrow[q.id] = { safeplateId: q.id, name: q.name, lab: q.lab, amount: 15000, status: 'HELD', type: 'FOOD', ts: new Date(now - (1 + i % 3) * day).toISOString() } }
  const flows = ['Scheduled', 'Sample Collected', 'Testing in Progress']
  for (let i = 0; i < 6; i++) { const q = person('2026', i + 20); orders[q.oid] = { id: q.oid, safeplateId: q.id, handlerName: q.name, phone: q.phone, lab: q.lab, tests: TESTS, status: pick(flows, i), createdAt: new Date(now - (1 + i) * day).toISOString() }; escrow[q.id] = { safeplateId: q.id, name: q.name, lab: q.lab, amount: 15000, status: 'HELD', type: 'FOOD', ts: new Date(now - (1 + i) * day).toISOString() } }
  for (let i = 0; i < 4; i++) { const q = person('2026', i + 40); orders[q.oid] = { id: q.oid, safeplateId: q.id, handlerName: q.name, phone: q.phone, lab: q.lab, tests: TESTS, status: 'Approved', createdAt: new Date(now - (3 + i) * day).toISOString() }; certificates[q.id] = { safeplateId: q.id, name: q.name, panel: PANEL, lab: q.lab, cert_no: lsh(n), issued: new Date(now - i * day).toISOString(), expiry: new Date(now + (182 - i) * day).toISOString(), status: 'VALID' }; escrow[q.id] = { safeplateId: q.id, name: q.name, lab: q.lab, amount: 15000, status: 'HELD', type: 'FOOD', ts: new Date(now - (3 + i) * day).toISOString() }; releases.push({ safeplateId: q.id, name: q.name, lab: q.lab, amount: 15000, status: 'Instructed', approvedBy: 'LSMoH Officer', ts: new Date(now - i * day).toISOString() }) }
  for (let i = 0; i < 12; i++) { const q = person('2026', i + 60); const iss = 20 + i * 5; orders[q.oid] = { id: q.oid, safeplateId: q.id, handlerName: q.name, phone: q.phone, lab: q.lab, tests: TESTS, status: 'Approved', createdAt: new Date(now - iss * day).toISOString() }; certificates[q.id] = { safeplateId: q.id, name: q.name, panel: PANEL, lab: q.lab, cert_no: lsh(n), issued: new Date(now - iss * day).toISOString(), expiry: new Date(now + (182 - iss) * day).toISOString(), status: 'VALID' }; escrow[q.id] = { safeplateId: q.id, name: q.name, lab: q.lab, amount: 15000, status: 'RELEASED', type: 'FOOD', ts: new Date(now - iss * day).toISOString(), releasedTs: new Date(now - (iss - 2) * day).toISOString(), releasedBy: 'Sterling Bank Officer' }; releases.push({ safeplateId: q.id, name: q.name, lab: q.lab, amount: 15000, status: 'Released', approvedBy: 'LSMoH Officer', ts: new Date(now - (iss - 1) * day).toISOString() }) }
  for (let i = 0; i < 3; i++) { const q = person('2026', i + 80); orders[q.oid] = { id: q.oid, safeplateId: q.id, handlerName: q.name, phone: q.phone, lab: q.lab, tests: TESTS, results: results(true), status: 'Flagged', createdAt: new Date(now - (2 + i) * day).toISOString() }; escrow[q.id] = { safeplateId: q.id, name: q.name, lab: q.lab, amount: 15000, status: 'HELD', type: 'FOOD', ts: new Date(now - (2 + i) * day).toISOString() } }
  for (let i = 0; i < 3; i++) { const q = person('2026', i + 90); orders[q.oid] = { id: q.oid, safeplateId: q.id, handlerName: q.name, phone: q.phone, lab: q.lab, tests: TESTS, results: results(true), status: 'Rejected', createdAt: new Date(now - (5 + i) * day).toISOString() }; escrow[q.id] = { safeplateId: q.id, name: q.name, lab: q.lab, amount: 15000, status: 'HELD', type: 'FOOD', ts: new Date(now - (5 + i) * day).toISOString() } }
  for (let i = 0; i < 5; i++) { const q = person('2025', i + 100); certificates[q.id] = { safeplateId: q.id, name: q.name, panel: PANEL, lab: q.lab, cert_no: 'LSH-2025-' + String(300 + n).padStart(6, '0'), issued: new Date(now - (200 + i * 5) * day).toISOString(), expiry: new Date(now - (18 + i * 5) * day).toISOString(), status: 'EXPIRED' } }
  for (let i = 0; i < 3; i++) { const q = person('2026', i + 110); certificates[q.id] = { safeplateId: q.id, name: q.name, panel: PANEL, lab: q.lab, cert_no: lsh(400 + n), issued: new Date(now - (30 + i * 5) * day).toISOString(), expiry: new Date(now + 150 * day).toISOString(), status: 'REVOKED' } }

  const water = {}
  const wf = [['Grill House, Lekki', 'Eti-Osa', 'Submitted, pending LASEPA', 'HELD'], ['Ocean Basket, VI', 'Eti-Osa', 'Certified', 'RELEASED'], ['Kada Plaza Eatery', 'Ikeja', 'Certified', 'RELEASED'], ['RForRabbit Cafe', 'Surulere', 'Flagged, retest required', 'HELD'], ['Blue Cabana', 'Eti-Osa', 'Submitted, pending LASEPA', 'HELD'], ['ICM Foodcourt', 'Ikeja', 'Certified', 'RELEASED'], ['Debonair Lounge', 'Yaba', 'Flagged, retest required', 'HELD'], ['Yellow Chilli, Ikeja', 'Ikeja', 'Submitted, pending LASEPA', 'HELD']]
  wf.forEach((w, i) => { const swid = 'SP-W-LG-2026' + String(3000 + i).padStart(6, '0'); const lab = pick(LABS_A, i); const series = w[3] === 'RELEASED' ? 'SP-W-CERT-2026-' + String(500 + i).padStart(6, '0') : undefined; water[swid] = { swid, facility: w[0], lga: w[1], source: pick(['Borehole', 'Public mains', 'Water vendor'], i), officer: pick(FN, i) + ' ' + pick(LN, i), contact: '08033' + String(30000 + i * 111).slice(0, 5), lab, amount: 65000, status: w[2], results: { ph: (6.8 + (i % 5) * 0.1).toFixed(1), turbidity: (1 + i % 4) + '.2 NTU', ecoli: (w[2] === 'Flagged, retest required' ? (2 + i) : 0) + ' CFU/100ml' }, ownerEmail: 'seed', cert_series: series, ts: new Date(now - (2 + i) * day).toISOString() }; escrow[swid] = { safeplateId: swid, name: w[0], lab, amount: 65000, status: w[3], type: 'WATER', ts: new Date(now - (2 + i) * day).toISOString(), releasedTs: w[3] === 'RELEASED' ? new Date(now - i * day).toISOString() : undefined, releasedBy: w[3] === 'RELEASED' ? 'Sterling Bank Officer' : undefined }; if (w[3] === 'RELEASED') releases.push({ safeplateId: swid, name: w[0], lab, amount: 65000, status: 'Released', approvedBy: 'LASEPA Officer', ts: new Date(now - i * day).toISOString() }); if (w[2] === 'Certified') certificates[swid] = { safeplateId: swid, name: w[0], panel: 'Potable water quality', lab, series, issued: new Date(now - i * day).toISOString(), expiry: new Date(now + 182 * day).toISOString(), status: 'VALID' } })

  const est = {}
  const ed = [['Mama Cass Kitchen, Ikeja', 'Ikeja', 'Compliant', null], ['Sweet Sensation, Yaba', 'Yaba', 'Overdue', 'Warning'], ['Grill House, Lekki', 'Eti-Osa', 'Non-compliant', 'Fine'], ['Buka Express, Surulere', 'Surulere', 'Compliant', null], ['Ofada Heaven, Ikorodu', 'Ikorodu', 'Overdue', 'Warning'], ['Cactus, VI', 'Eti-Osa', 'Compliant', null], ['The Place, Lekki', 'Eti-Osa', 'Non-compliant', 'Suspension'], ['Yellow Chilli, Ikeja', 'Ikeja', 'Compliant', null]]
  ed.forEach((e, i) => { const id = 'EST-' + String(1 + i).padStart(3, '0'); est[id] = { id, name: e[0], lga: e[1], compliance: e[2], sanction: e[3], appeal: e[3] === 'Suspension' ? 'Under appeal' : null } })

  const businesses = {}
  businesses['employer@demo.ng'] = { name: 'Grill House Group', lga: 'Eti-Osa', staff: [
    { id: 'S1', name: 'Adaeze Nwosu', phone: '08031110001', status: 'Certified' },
    { id: 'S2', name: 'Bode Adekunle', phone: '08031110002', status: 'Certified' },
    { id: 'S3', name: 'Chika Obi', phone: '08031110003', status: 'Pending results' },
    { id: 'S4', name: 'Dami Lawal', phone: '08031110004', status: 'Pending results' },
    { id: 'S5', name: 'Ejiro Efe', phone: '08031110005', status: 'Overdue' },
    { id: 'S6', name: 'Femi Sanni', phone: '08031110006', status: 'Not registered' },
    { id: 'S7', name: 'Grace Uche', phone: '08031110007', status: 'Not registered' }
  ] }

  const audit = []
  const actors = [['Dr Ada Bello, LSMoH', 'LSMoH'], ['Engr Musa, LASEPA', 'LASEPA'], ['Mrs Ojo, HEFAMAA', 'HEFAMAA'], ['Sterling Bank Officer', 'Sterling Bank'], ['Lancet Ikeja Tech', 'laboratory']]
  const acts = [['Approved, certificate issued, escrow release instructed', 0], ['Escrow released, full waterfall disbursed', 3], ['Results submitted (encrypted)', 4], ['Flagged for review, escrow held', 0], ['Certificate revoked', 0], ['Certificate verified via portal', 5], ['Signed in', 0], ['Water approved, certificate issued', 1], ['Accreditation status updated', 2], ['Sanction applied: Warning', 1]]
  const certIds = Object.keys(certificates)
  for (let i = 0; i < 64; i++) { const a = acts[i % acts.length]; const who = a[1] === 5 ? ['public', 'public'] : actors[a[1]]; const ts = new Date(now - Math.floor(Math.random() * 14) * day - Math.floor(Math.random() * 22) * 3600000).toISOString(); audit.push({ actor: who[0], role: who[1], action: a[0], subject: pick(certIds, i * 3 + 1), ts, ip: 'captured server-side' }) }
  audit.sort((x, y) => (y.ts || '').localeCompare(x.ts || ''))

  const notices = [
    { audience: 'all', title: 'SafePlate is live', body: 'Statewide food handler and water certification is now active.', ts: new Date(now - 1 * day).toISOString() },
    { audience: 'LSMoH', title: 'Results awaiting review', body: '8 laboratory results are pending Ministry approval.', ts: new Date(now - 2 * 3600000).toISOString() },
    { audience: 'sterling', title: 'Releases pending', body: '4 approved releases await execution.', ts: new Date(now - 5 * 3600000).toISOString() },
    { audience: 'LASEPA', title: 'Water results', body: '3 facilities are pending LASEPA review.', ts: new Date(now - 8 * 3600000).toISOString() }
  ]

  data.handlers = handlers; data.orders = orders; data.escrow = escrow; data.releases = releases
  data.certificates = certificates; data.water = water; data.establishments = est
  data.businesses = businesses; data.audit = audit; data.notices = notices
  const officers = {}
  const offd = [
    ['OFF-001', 'Grace Adeyemi', 'grace.officer@lasepa.ng', '08039000001', 'LASEPA-014', 'LASEPA', 'Eti-Osa', 'Active'],
    ['OFF-002', 'Musa Bello', 'musa.officer@lasepa.ng', '08039000002', 'LASEPA-021', 'LASEPA', 'Ikeja', 'Active'],
    ['OFF-003', 'Ngozi Okafor', 'ngozi.officer@lasepa.ng', '08039000003', 'LASEPA-033', 'LASEPA', 'Surulere', 'Pending'],
    ['OFF-004', 'Tunde Balogun', 'tunde.officer@lsmoh.ng', '08039000011', 'LSMoH-108', 'LSMoH', 'Lagos Mainland', 'Active'],
    ['OFF-005', 'Aisha Yusuf', 'aisha.officer@lsmoh.ng', '08039000012', 'LSMoH-115', 'LSMoH', 'Mushin', 'Active'],
    ['OFF-006', 'Femi Ojo', 'femi.officer@hefamaa.ng', '08039000021', 'HEF-052', 'HEFAMAA', 'Ikeja', 'Active']
  ]
  offd.forEach((o, i) => { officers[o[0]] = { id: o[0], name: o[1], email: o[2], phone: o[3], badge: o[4], agency: o[5], lga: o[6], status: o[7], createdAt: new Date(now - (5 + i) * day).toISOString() } })
  data.officers = officers
  data.inspections = data.inspections || []
  data.seedV3 = true
  DEMO.write(data)
}

function normaliseCert(cert) {
  const expiry = new Date(cert.expiry || cert.expiry_date)
  if (cert.status === 'REVOKED') return { ...cert, status: 'REVOKED' }
  return { ...cert, status: expiry.getTime() < Date.now() ? 'EXPIRED' : 'VALID' }
}

// Map between the app's camelCase fields and the database's snake_case columns.
const toSnake = o => o ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k.replace(/[A-Z]/g, m => '_' + m.toLowerCase()), v])) : o
const toCamel = o => o ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), v])) : o
const camelList = a => (a || []).map(toCamel)
// Export an array of row objects to a downloadable CSV file.
function exportCsv(rows, columns, filename) {
  const esc = v => { const t = v == null ? '' : String(v); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t }
  const header = columns.map(c => esc(c.label)).join(',')
  const body = (rows || []).map(r => columns.map(c => esc(typeof c.get === 'function' ? c.get(r) : r[c.key])).join(',')).join('\n')
  const blob = new Blob(['\ufeff' + header + '\n' + body], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href)
}

const store = {
  async signUp(email, password, meta) {
    if (SUPABASE_READY) {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: meta } })
      if (error) throw new Error(error.message)
      return { id: data.user?.id, email, ...meta }
    }
    const db = DEMO.read(); db.users = db.users || {}
    if (db.users[email]) throw new Error('An account with this email already exists. Sign in instead.')
    db.users[email] = { email, password, ...meta }; DEMO.write(db)
    return { email, ...meta }
  },
  async signIn(email, password, role, agency, name) {
    if (SUPABASE_READY) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message)
      let meta = data.user?.user_metadata || {}
      // The role/agency the person signs in as must be written into the access token,
      // otherwise the Edge Function and row-level security reject their actions as
      // "Forbidden". This also repairs accounts created without correct metadata.
      if (role && (meta.role !== role || (agency || null) !== (meta.agency || null))) {
        const { data: upd, error: uerr } = await supabase.auth.updateUser({ data: { role, agency: agency || null, name: name || meta.name || email.split('@')[0] } })
        if (uerr) throw new Error(uerr.message)
        meta = upd.user?.user_metadata || { ...meta, role, agency: agency || null }
        try { await supabase.auth.refreshSession() } catch (e) { /* updateUser already refreshed the token */ }
      }
      return { id: data.user?.id, email, ...meta }
    }
    const db = DEMO.read(); const u = db.users?.[email]
    if (!u || u.password !== password) throw new Error('Email or password is incorrect.')
    return { email, role: u.role, name: u.name, title: u.title, agency: u.agency }
  },
  async signOut() { if (SUPABASE_READY) await supabase.auth.signOut() },
  async saveHandler(record) {
    if (SUPABASE_READY) { const { error } = await supabase.from('food_handlers').upsert(toSnake(record), { onConflict: 'safeplate_id' }); if (error) throw new Error(error.message); return record }
    const db = DEMO.read(); db.handlers = db.handlers || {}; db.handlers[record.safeplateId] = record; DEMO.write(db); return record
  },
  async getHandlerPhoto(safeplateId) {
    if (SUPABASE_READY) { const { data } = await supabase.from('food_handlers').select('photo').eq('safeplate_id', safeplateId).limit(1); return data && data[0] ? data[0].photo : null }
    const db = DEMO.read(); const h = (db.handlers || {})[safeplateId]; return h ? h.photo : null
  },
  async getMyHandler(session) {
    if (SUPABASE_READY) { const { data } = await supabase.from('food_handlers').select('*').order('created_at', { ascending: false }).limit(1); return data && data[0] ? toCamel(data[0]) : null }
    const db = DEMO.read(); const list = Object.values(db.handlers || {}).filter(h => h.email && session.email && h.email.toLowerCase() === session.email.toLowerCase()); return list.length ? list[list.length - 1] : null
  },
  async getOrderFor(safeplateId) {
    if (SUPABASE_READY) { const { data } = await supabase.from('test_orders').select('*').eq('safeplate_id', safeplateId).order('created_at', { ascending: false }).limit(1); return data && data[0] ? toCamel(data[0]) : null }
    const db = DEMO.read(); const list = Object.values(db.orders || {}).filter(o => o.safeplateId === safeplateId); return list.length ? list[list.length - 1] : null
  },
  async createAppeal(a) {
    const rec = { ...a, status: 'Open', createdAt: new Date().toISOString() }
    if (SUPABASE_READY) { const { error } = await supabase.from('appeals').insert(toSnake(rec)); if (error) throw new Error(error.message); return rec }
    const db = DEMO.read(); db.appeals = db.appeals || []; db.appeals.push({ id: Date.now(), ...rec }); DEMO.write(db); return rec
  },
  async listAppeals(agency) {
    if (SUPABASE_READY) { const { data } = await supabase.from('appeals').select('*').order('created_at', { ascending: false }); const rows = camelList(data); return agency ? rows.filter(r => r.agency === agency) : rows }
    const db = DEMO.read(); const rows = (db.appeals || []).slice().reverse(); return agency ? rows.filter(r => r.agency === agency) : rows
  },
  async resolveAppeal(id, resolution, status) {
    if (SUPABASE_READY) { const { error } = await supabase.from('appeals').update({ status: status || 'Resolved', resolution }).eq('id', id); if (error) throw new Error(error.message); return }
    const db = DEMO.read(); db.appeals = (db.appeals || []).map(a => a.id === id ? { ...a, status: status || 'Resolved', resolution } : a); DEMO.write(db)
  },
  async createOrder(order) {
    if (SUPABASE_READY) { const { error } = await supabase.from('test_orders').insert(toSnake(order)); if (error) throw new Error(error.message); return order }
    const db = DEMO.read(); db.orders = db.orders || {}; db.orders[order.id] = order; DEMO.write(db); return order
  },
  async listOrders(labName) {
    if (SUPABASE_READY) { const { data } = await supabase.from('test_orders').select('*').eq('lab', labName).order('created_at', { ascending: false }); return camelList(data) }
    const db = DEMO.read(); return Object.values(db.orders || {}).filter(o => o.lab === labName).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  },
  async listAllOrders() {
    if (SUPABASE_READY) { const { data } = await supabase.from('test_orders').select('*').order('created_at', { ascending: false }); return camelList(data) }
    const db = DEMO.read(); return Object.values(db.orders || {}).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  },
  async updateOrder(id, patch) {
    if (SUPABASE_READY) { const { error } = await supabase.from('test_orders').update(toSnake(patch)).eq('id', id); if (error) throw new Error(error.message); return patch }
    const db = DEMO.read(); db.orders = db.orders || {}; db.orders[id] = { ...(db.orders[id] || {}), ...patch }; DEMO.write(db); return db.orders[id]
  },
  async phoneExists(phone) {
    if (SUPABASE_READY) { const { data } = await supabase.from('food_handlers').select('phone').eq('phone', phone).limit(1); return Boolean(data && data.length) }
    const db = DEMO.read(); return Object.values(db.handlers || {}).some(h => h.phone === phone)
  },
  async verifyCertificate(id) {
    const clean = (id || '').trim().toUpperCase()
    if (OFFLINE.isOffline()) {
      const cached = OFFLINE.get('certs') || {}
      return cached[clean] ? { ...normaliseCert(cached[clean]), fromCache: true } : null
    }
    if (SUPABASE_READY) { const { data } = await supabase.from('certificates').select('*').eq('safeplate_id', clean).limit(1); const c = data && data[0]; return c ? normaliseCert(toCamel(c)) : null }
    const db = DEMO.read(); const cert = db.certificates?.[clean]; return cert ? normaliseCert(cert) : null
  },
  async issueCertificate(cert) {
    if (SUPABASE_READY) { const { error } = await supabase.from('certificates').upsert(toSnake(cert), { onConflict: 'safeplate_id' }); if (error) throw new Error(error.message); return cert }
    const db = DEMO.read(); db.certificates = db.certificates || {}; db.certificates[cert.safeplateId] = cert; DEMO.write(db); return cert
  },
  async listAllCertificates() {
    if (SUPABASE_READY) { const { data } = await supabase.from('certificates').select('*'); return camelList(data) }
    const db = DEMO.read(); return Object.values(db.certificates || {})
  },
  async revokeCertificate(id) {
    const clean = (id || '').trim().toUpperCase()
    if (SUPABASE_READY) { const { error } = await supabase.from('certificates').update({ status: 'REVOKED' }).eq('safeplate_id', clean); if (error) throw new Error(error.message); return }
    const db = DEMO.read(); if (db.certificates?.[clean]) { db.certificates[clean].status = 'REVOKED'; DEMO.write(db) }
  },
  async createEscrow(rec) {
    if (SUPABASE_READY) { const { error } = await supabase.from('escrow').upsert(toSnake(rec), { onConflict: 'safeplate_id' }); if (error) throw new Error(error.message); return rec }
    const db = DEMO.read(); db.escrow = db.escrow || {}; db.escrow[rec.safeplateId] = rec; DEMO.write(db); return rec
  },
  async listEscrow() {
    if (SUPABASE_READY) { const { data } = await supabase.from('escrow').select('*').order('ts', { ascending: false }); return camelList(data) }
    const db = DEMO.read(); return Object.values(db.escrow || {}).sort((a, b) => (b.ts || '').localeCompare(a.ts || ''))
  },
  async createRelease(rec) {
    if (SUPABASE_READY) { const { error } = await supabase.from('escrow_releases').insert(toSnake(rec)); if (error) throw new Error(error.message); return rec }
    const db = DEMO.read(); db.releases = db.releases || []; db.releases.unshift(rec); DEMO.write(db); return rec
  },
  async emailForPhone(phone) {
    if (SUPABASE_READY) { return await store.fn('email-for-phone', { phone }) }
    const db = DEMO.read()
    const hit = Object.values(db.handlers || {}).find(h => String(h.phone || '').replace(/\s+/g, '') === String(phone || '').replace(/\s+/g, '') && h.email)
    return hit ? { ok: true, email: hit.email } : { ok: false, reason: 'No account with an email is registered to that phone number.' }
  },
  async verifyNin(nin) {
    if (SUPABASE_READY) { return await store.fn('verify-nin', { nin }) }
    // Demo mode: accept any 11-digit NIN and echo a placeholder name so the
    // flow can be exercised without a live NIMC connection.
    const clean = String(nin || '').replace(/\s+/g, '')
    if (!/^\d{11}$/.test(clean)) return { ok: false, reason: 'A NIN must be exactly 11 digits.' }
    return { ok: true, nin: clean, fullName: '', demo: true }
  },
  async recoverId(phone, nin) {
    const ph = String(phone || '').replace(/\s+/g, ''), nn = String(nin || '').replace(/\s+/g, '')
    if (SUPABASE_READY) { const out = await store.fn('recover-id', { phone: ph, nin: nn }); return out }
    const db = DEMO.read()
    const hit = Object.values(db.handlers || {}).find(h => String(h.phone || '').replace(/\s+/g, '') === ph && String(h.nin || '').replace(/\s+/g, '') === nn)
    if (!hit) throw new Error('No record matches that phone number and NIN.')
    return { ok: true, safeplateId: hit.safeplateId, name: hit.name }
  },
  async fileComplaint(c) {
    if (SUPABASE_READY) { return await store.fn('file-complaint', c) }
    const db = DEMO.read(); db.complaints = db.complaints || {}
    const ref = 'CMP-' + new Date().getFullYear() + '-' + String(Math.floor(100000 + Math.random() * 899999))
    db.complaints[ref] = { id: ref, establishment: c.establishment, lga: c.lga || '', detail: c.detail, photos: c.photos || [], status: 'Open', createdAt: new Date().toISOString() }
    const est = Object.values(db.establishments || {}).find(e => (e.name || '').toLowerCase() === (c.establishment || '').toLowerCase())
    if (est) { db.establishments[est.id] = { ...est, underReview: true } }
    DEMO.write(db)
    await store.notify('LASEPA', 'New public complaint', c.establishment + ' (' + ref + ')')
    return { ok: true, reference: ref }
  },
  async listComplaints() {
    if (SUPABASE_READY) { const { data } = await supabase.from('complaints').select('*').order('created_at', { ascending: false }); return camelList(data) }
    const db = DEMO.read(); return Object.values(db.complaints || {})
  },
  async triageComplaint(id, patch) {
    if (SUPABASE_READY) { const { error } = await supabase.from('complaints').update(toSnake(patch)).eq('id', id); if (error) throw new Error(error.message); return }
    const db = DEMO.read(); db.complaints = db.complaints || {}; db.complaints[id] = { ...(db.complaints[id] || {}), ...patch }; DEMO.write(db)
  },
  async warmOfflineCache(session) {
    try {
      const ests = await store.listEstablishments()
      OFFLINE.put('establishments', ests)
      const certs = await store.listAllCertificates()
      const map = {}
      // Cache a bounded slice: the officer's own area first, then most recent.
      const mine = ests.filter(e => e.assignedTo === session.email).map(e => e.lga)
      const sorted = certs.slice().sort((a, b) => (mine.includes(b.lga) ? 1 : 0) - (mine.includes(a.lga) ? 1 : 0))
      sorted.slice(0, 600).forEach(c => { const k = (c.safeplateId || c.safeplate_id || '').toUpperCase(); if (k) map[k] = c })
      OFFLINE.put('certs', map)
      OFFLINE.put('warmedAt', new Date().toISOString())
      return { establishments: ests.length, certificates: Object.keys(map).length }
    } catch (e) { return null }
  },
  async syncOutbox() {
    return await OFFLINE.flush(async op => {
      if (op.kind === 'inspection') {
        if (SUPABASE_READY) { const { error } = await supabase.from('inspections').insert(toSnake(op.rec)); if (error) throw new Error(error.message) }
        else { const db = DEMO.read(); db.inspections = db.inspections || []; db.inspections.push(op.rec); DEMO.write(db) }
        return
      }
      if (op.kind === 'establishment') {
        if (SUPABASE_READY) { const { error } = await supabase.from('establishments').update(toSnake(op.patch)).eq('id', op.id); if (error) throw new Error(error.message) }
        else { const db = DEMO.read(); db.establishments = db.establishments || {}; db.establishments[op.id] = { ...(db.establishments[op.id] || {}), ...op.patch }; DEMO.write(db) }
        return
      }
      throw new Error('Unknown queued action')
    })
  },
  async createLabAudit(rec) {
    const full = { id: 'QA-' + Date.now(), ts: new Date().toISOString(), ...rec }
    if (SUPABASE_READY) {
      const { error } = await supabase.from('lab_audits').insert(toSnake(full)); if (error) throw new Error(error.message)
      const { error: le } = await supabase.from('laboratories').update({ last_audit_score: full.score, last_audit_at: full.ts, last_audit_outcome: full.outcome }).eq('id', full.labId); if (le) throw new Error(le.message)
      return full
    }
    const db = DEMO.read(); db.labAudits = db.labAudits || []; db.labAudits.unshift(full)
    db.regLabs = db.regLabs || {}
    if (db.regLabs[full.labId]) db.regLabs[full.labId] = { ...db.regLabs[full.labId], lastAuditScore: full.score, lastAuditAt: full.ts, lastAuditOutcome: full.outcome }
    db.labAuditSummary = db.labAuditSummary || {}
    db.labAuditSummary[full.labId] = { lastAuditScore: full.score, lastAuditAt: full.ts, lastAuditOutcome: full.outcome }
    DEMO.write(db); return full
  },
  async listLabAudits(labId) {
    if (SUPABASE_READY) { const { data } = await supabase.from('lab_audits').select('*').eq('lab_id', labId).order('ts', { ascending: false }); return camelList(data) }
    const db = DEMO.read(); return (db.labAudits || []).filter(a => a.labId === labId)
  },
  async labAuditSummary(labId) {
    if (SUPABASE_READY) { const { data } = await supabase.from('lab_audits').select('*').eq('lab_id', labId).order('ts', { ascending: false }).limit(1); const a = data && data[0]; return a ? toCamel(a) : null }
    const db = DEMO.read(); return (db.labAudits || []).find(a => a.labId === labId) || null
  },
  async bulkApproveResults(orderIds) {
    return await store.fn('bulk-approve', { orderIds })
  },
  async listAwaitingResults(labName) {
    if (SUPABASE_READY) {
      const { data } = await supabase.from('test_orders').select('id, safeplate_id, handler_name, lab, status, appointment_date, appointment_slot').eq('lab', labName).eq('status', 'Scheduled').order('created_at', { ascending: true })
      return camelList(data)
    }
    const db = DEMO.read()
    return Object.values(db.orders || {}).filter(o => o.lab === labName && o.status === 'Scheduled')
  },
  async currentTokenRole() {
    if (!SUPABASE_READY) return 'laboratory'
    try {
      const { data } = await supabase.auth.getSession()
      const u = data && data.session && data.session.user
      return (u && u.user_metadata && u.user_metadata.role) || ''
    } catch (e) { return '' }
  },
  async bulkSubmitResults(rows) {
    return await store.fn('bulk-submit-result', { rows })
  },
  async listBankStaff() {
    if (SUPABASE_READY) { const { data } = await supabase.from('bank_staff').select('*').order('created_at', { ascending: false }); return camelList(data) }
    const db = DEMO.read(); return Object.values(db.bankStaff || {})
  },
  async saveBankStaff(rec) {
    const id = rec.id || ('BNK-' + Date.now())
    const full = { id, name: rec.name, email: (rec.email || '').toLowerCase(), phone: rec.phone || '', accessLevel: rec.accessLevel || 'Viewer', status: rec.status || 'Active', addedBy: rec.addedBy || '' }
    if (SUPABASE_READY) { const { error } = await supabase.from('bank_staff').upsert(toSnake(full), { onConflict: 'id' }); if (error) throw new Error(error.message); return full }
    const db = DEMO.read(); db.bankStaff = db.bankStaff || {}; db.bankStaff[id] = { ...(db.bankStaff[id] || {}), ...full }; DEMO.write(db); return full
  },
  async setBankStaffStatus(id, status) {
    if (SUPABASE_READY) { const { error } = await supabase.from('bank_staff').update({ status }).eq('id', id); if (error) throw new Error(error.message); return }
    const db = DEMO.read(); if (db.bankStaff && db.bankStaff[id]) { db.bankStaff[id].status = status; DEMO.write(db) }
  },
  async listBeneficiaries() {
    if (SUPABASE_READY) { const { data } = await supabase.from('beneficiaries').select('*'); return camelList(data) }
    const db = DEMO.read(); return Object.values(db.beneficiaries || {})
  },
  async saveBeneficiary(id, patch) {
    const rec = { id, ...patch, updatedAt: new Date().toISOString() }
    if (SUPABASE_READY) { const { error } = await supabase.from('beneficiaries').upsert(toSnake(rec), { onConflict: 'id' }); if (error) throw new Error(error.message); return rec }
    const db = DEMO.read(); db.beneficiaries = db.beneficiaries || {}; db.beneficiaries[id] = { ...(db.beneficiaries[id] || {}), ...rec }; DEMO.write(db); return rec
  },
  async listReleases() {
    if (SUPABASE_READY) { const { data } = await supabase.from('escrow_releases').select('*').order('ts', { ascending: false }); return camelList(data) }
    const db = DEMO.read(); return db.releases || []
  },
  async releaseEscrow(safeplateId, by) {
    if (SUPABASE_READY) {
      const { error: ee } = await supabase.from('escrow').update({ status: 'RELEASED', released_ts: new Date().toISOString(), released_by: by }).eq('safeplate_id', safeplateId)
      const { error: re2 } = await supabase.from('escrow_releases').update({ status: 'Released' }).eq('safeplate_id', safeplateId); if (re2) throw new Error(re2.message)
      return
    }
    const db = DEMO.read()
    if (db.escrow?.[safeplateId]) { db.escrow[safeplateId].status = 'RELEASED'; db.escrow[safeplateId].releasedTs = new Date().toISOString(); db.escrow[safeplateId].releasedBy = by }
    db.releases = (db.releases || []).map(r => r.safeplateId === safeplateId ? { ...r, status: 'Released' } : r)
    DEMO.write(db)
  },
  async appendAudit(entry) {
    const row = { ...entry, ts: new Date().toISOString(), ip: 'captured server-side' }
    if (SUPABASE_READY) { const { error } = await supabase.from('audit_log').insert(row); if (error) console.warn('Audit entry could not be written:', error.message); return row }
    const db = DEMO.read(); db.audit = db.audit || []; db.audit.unshift(row); DEMO.write(db); return row
  },

  // --- NDPA data-subject rights (items 19-20) ---------------------------------
  // Portability: assemble everything held about one handler into a single plain
  // object the person can download. We deliberately gather from every store that
  // holds their data so the export is honest and complete.
  async exportMyData(session) {
    const handler = await this.getMyHandler(session)
    if (!handler) return { exportedAt: new Date().toISOString(), note: 'No certification record was found for your account.', account: { email: session?.email || null } }
    const id = handler.safeplateId
    const [cert, order] = await Promise.all([
      this.verifyCertificate(id).catch(() => null),
      this.getOrderFor(id).catch(() => null),
    ])
    // Redact the raw test result payloads and NIN in the portable copy: the
    // person can see that results exist and their status, but we do not re-expose
    // decrypted health data or the full national ID in a downloadable file.
    const safeOrder = order ? { id: order.id, lab: order.lab, tests: order.tests, status: order.status, createdAt: order.createdAt } : null
    const safeHandler = { ...handler }
    if (safeHandler.nin) safeHandler.nin = String(safeHandler.nin).replace(/.(?=.{4})/g, '*')
    delete safeHandler.photo // referenced separately; large and not needed in the JSON
    return {
      exportedAt: new Date().toISOString(),
      dataController: 'Lagos State Ministry of Health (SafePlate)',
      subject: { safeplateId: id, name: handler.name, email: handler.email || session?.email || null },
      consent: {
        given: handler.consentGiven === true,
        at: handler.consentAt || null,
        version: handler.consentVersion || null,
      },
      personalData: safeHandler,
      certificate: cert || null,
      testOrder: safeOrder,
      note: 'This is a portable copy of the data SafePlate holds about you. Test results are shown by status only; decrypted health data and your full National ID are not included in this file for your protection.',
    }
  },

  // DPO side: list handlers with a pending erasure request, so the Data
  // Protection Officer can see and action them. Returns a light projection, never
  // the health payload.
  async listErasureRequests() {
    if (SUPABASE_READY) {
      const { data } = await supabase.from('food_handlers').select('safeplate_id,name,email,erasure_ref,erasure_at,erasure_requested').eq('erasure_requested', true).order('erasure_at', { ascending: true })
      return camelList(data)
    }
    const db = DEMO.read()
    return Object.values(db.handlers || {}).filter(h => h && h.erasureRequested).map(h => ({ safeplateId: h.safeplateId, name: h.name, email: h.email, erasureRef: h.erasureRef, erasureAt: h.erasureAt }))
  },

  // DPO resolves a request: either upholds it (clears the personal fields while
  // keeping the certification skeleton needed for the statutory record) or
  // declines it with a reason. Either way it is audited and the pending flag
  // clears. We never silently vanish a record; we minimise it.
  async resolveErasure(safeplateId, outcome, note, actor) {
    const upheld = outcome === 'upheld'
    await this.appendAudit({
      actor: actor || 'Data Protection Officer',
      role: 'dpo',
      action: upheld ? 'Erasure request upheld, personal data minimised' : 'Erasure request declined',
      subject: safeplateId,
      reason: (note || '').slice(0, 500),
    })
    if (SUPABASE_READY) {
      const patch = upheld
        ? { erasure_requested: false, name: 'Erased at data subject request', phone: null, address: null, nin: null, photo: null, email: null, dob: null, erasure_at: new Date().toISOString() }
        : { erasure_requested: false }
      const { error } = await supabase.from('food_handlers').update(patch).eq('safeplate_id', safeplateId)
      if (error) throw new Error(error.message)
      return { upheld }
    }
    const db = DEMO.read()
    const h = (db.handlers || {})[safeplateId]
    if (h) {
      if (upheld) db.handlers[safeplateId] = { ...h, erasureRequested: false, name: 'Erased at data subject request', phone: '', address: '', nin: '', photo: '', email: '', dob: '' }
      else db.handlers[safeplateId] = { ...h, erasureRequested: false }
      DEMO.write(db)
    }
    return { upheld }
  },

  // Erasure: certification and health records carry a statutory public-health
  // retention obligation, so this lodges an audited erasure request for the Data
  // Protection Officer to action rather than silently hard-deleting a record. The
  // person is told exactly that. Returns a reference they can keep.
  async requestErasure(session, reason) {
    const handler = await this.getMyHandler(session)
    const id = handler ? handler.safeplateId : null
    const reference = 'ERZ-' + new Date().getFullYear() + '-' + String(Math.floor(100000 + Math.random() * 899999))
    await this.appendAudit({
      actor: session?.email || 'data subject',
      role: 'data_subject',
      action: 'Erasure request lodged under NDPA',
      subject: id || (session?.email || 'unknown'),
      reference,
      reason: (reason || '').slice(0, 500),
    })
    // Flag the record so a regulator sees the pending request against it.
    if (id) {
      try {
        if (SUPABASE_READY) { await supabase.from('food_handlers').update({ erasure_requested: true, erasure_ref: reference, erasure_at: new Date().toISOString() }).eq('safeplate_id', id) }
        else { const db = DEMO.read(); if (db.handlers && db.handlers[id]) { db.handlers[id] = { ...db.handlers[id], erasureRequested: true, erasureRef: reference, erasureAt: new Date().toISOString() }; DEMO.write(db) } }
      } catch (e) { /* the audited request is the source of truth; flagging is best-effort */ }
    }
    return { reference, recordFound: Boolean(id) }
  },
  async listAudit() {
    if (SUPABASE_READY) { const { data } = await supabase.from('audit_log').select('*').order('ts', { ascending: false }).limit(200); return data || [] }
    const db = DEMO.read(); return db.audit || []
  },
  async listEstablishments() {
    if (OFFLINE.isOffline()) { return OFFLINE.get('establishments') || [] }
    if (SUPABASE_READY) { const { data } = await supabase.from('establishments').select('*'); return camelList(data) }
    const db = DEMO.read(); return Object.values(db.establishments || {})
  },
  async createEstablishment(rec) {
    const id = rec.id || ('EST-' + Date.now())
    const full = { id, name: rec.name, lga: rec.lga || '', compliance: rec.compliance || 'Not yet inspected', sanction: null, verified: rec.verified === true, registeredBy: rec.registeredBy || '', createdAt: new Date().toISOString() }
    if (SUPABASE_READY) { const { error } = await supabase.from('establishments').upsert(toSnake(full), { onConflict: 'id' }); if (error) throw new Error(error.message); return full }
    const db = DEMO.read(); db.establishments = db.establishments || {}; db.establishments[id] = full; DEMO.write(db); return full
  },
  async updateEstablishment(id, patch) {
    if (OFFLINE.isOffline()) { OFFLINE.enqueue({ kind: 'establishment', id, patch }); return }
    if (SUPABASE_READY) { const { error } = await supabase.from('establishments').update(toSnake(patch)).eq('id', id); if (error) throw new Error(error.message); return }
    const db = DEMO.read(); db.establishments = db.establishments || {}; db.establishments[id] = { ...(db.establishments[id] || {}), ...patch }; DEMO.write(db)
  },
  async setLabAccredited(id, val) {
    if (SUPABASE_READY) { const { error } = await supabase.from('laboratories').update({ accredited: val }).eq('id', id); if (error) throw new Error(error.message) }
    const db = DEMO.read(); db.labAccred = db.labAccred || {}; db.labAccred[id] = val
    if (db.regLabs && db.regLabs[id]) db.regLabs[id].accredited = val
    DEMO.write(db)
  },
  async registerLab(lab) {
    const id = lab.id || ('lab-' + Date.now())
    const rec = { id, name: lab.name, area: lab.lga || lab.area || '', accredited: false, contactPerson: lab.contactPerson || '', phone: lab.phone || '', address: lab.address || '', lga: lab.lga || '', bankName: lab.bankName || '', accountNumber: lab.accountNumber || '', accountName: lab.accountName || '', status: 'Pending' }
    if (SUPABASE_READY) { const { error } = await supabase.from('laboratories').upsert(toSnake(rec), { onConflict: 'id' }); if (error) throw new Error(error.message); return rec }
    const db = DEMO.read(); db.regLabs = db.regLabs || {}; db.regLabs[id] = { ...rec, turnaround: '48 hours', mobile: false, accNo: null }; DEMO.write(db); return rec
  },
  async listPendingLabs() {
    if (SUPABASE_READY) { const { data } = await supabase.from('laboratories').select('*').eq('status', 'Pending'); return camelList(data) }
    const db = DEMO.read(); return Object.values(db.regLabs || {}).filter(l => l.status === 'Pending')
  },
  async nextAccNo() {
    let used = []
    try { used = (await store.allLabs()).map(l => l.accNo || l.acc_no).filter(Boolean) } catch (e) { used = LABS.map(l => l.accNo) }
    let max = 0
    used.forEach(a => { const m = String(a).match(/HEF-LAB-(\d+)/i); if (m) max = Math.max(max, parseInt(m[1], 10)) })
    return 'HEF-LAB-' + String(max + 1).padStart(4, '0')
  },
  async saveLabAvailability(labId, availability) {
    if (SUPABASE_READY) { const { error } = await supabase.from('laboratories').update({ availability }).eq('id', labId); if (error) throw new Error(error.message); return availability }
    const db = DEMO.read(); db.labAvail = db.labAvail || {}; db.labAvail[labId] = availability
    if (db.regLabs && db.regLabs[labId]) db.regLabs[labId].availability = availability
    DEMO.write(db); return availability
  },
  async getLabAvailability(labId) {
    if (SUPABASE_READY) { const { data } = await supabase.from('laboratories').select('availability').eq('id', labId).maybeSingle(); return (data && data.availability) || null }
    const db = DEMO.read(); return (db.labAvail || {})[labId] || null
  },
  async issueAccNo(id) {
    const accNo = await store.nextAccNo()
    if (SUPABASE_READY) { const { error } = await supabase.from('laboratories').update({ acc_no: accNo }).eq('id', id); if (error) throw new Error(error.message); return accNo }
    const db = DEMO.read(); db.regLabs = db.regLabs || {}
    if (db.regLabs[id]) db.regLabs[id].accNo = accNo
    db.labAccNo = db.labAccNo || {}; db.labAccNo[id] = accNo
    DEMO.write(db); return accNo
  },
  async approveLab(id) {
    if (SUPABASE_READY) {
      const { data: cur } = await supabase.from('laboratories').select('acc_no').eq('id', id).maybeSingle()
      const accNo = (cur && cur.acc_no) || await store.nextAccNo()
      const { error } = await supabase.from('laboratories').update({ accredited: true, status: 'Accredited', acc_no: accNo }).eq('id', id)
      if (error) throw new Error(error.message)
      return accNo
    }
    const db = DEMO.read()
    db.regLabs = db.regLabs || {}
    const existing = db.regLabs[id] && db.regLabs[id].accNo
    const accNo = existing || await store.nextAccNo()
    if (db.regLabs[id]) { db.regLabs[id].accredited = true; db.regLabs[id].status = 'Accredited'; db.regLabs[id].accNo = accNo }
    db.labAccred = db.labAccred || {}; db.labAccred[id] = true; DEMO.write(db)
    return accNo
  },
  async declineLab(id) {
    if (SUPABASE_READY) { const { error } = await supabase.from('laboratories').update({ status: 'Declined', accredited: false }).eq('id', id); if (error) throw new Error(error.message); return }
    const db = DEMO.read(); if (db.regLabs && db.regLabs[id]) db.regLabs[id].status = 'Declined'; DEMO.write(db)
  },
  async accreditedLabList() {
    if (SUPABASE_READY) {
      const { data } = await supabase.from('laboratories').select('*').eq('accredited', true)
      const dbLabs = camelList(data); const names = new Set(dbLabs.map(l => l.name))
      return [...dbLabs.map(l => ({ ...l, accredited: true })), ...LABS.filter(l => l.accredited && !names.has(l.name))]
    }
    return labsView().filter(l => l.accredited)
  },
  async allLabs() {
    if (SUPABASE_READY) {
      const { data } = await supabase.from('laboratories').select('*')
      const dbLabs = camelList(data); const names = new Set(dbLabs.map(l => l.name))
      return [...dbLabs, ...LABS.filter(l => !names.has(l.name))]
    }
    return labsView()
  },
  async getBusiness(email) {
    if (SUPABASE_READY) { const { data } = await supabase.from('businesses').select('*').eq('owner_email', email).limit(1); const b = data && data[0]; return b ? toCamel(b) : null }
    const db = DEMO.read(); return (db.businesses || {})[email] || null
  },
  async saveBusiness(email, biz) {
    if (SUPABASE_READY) { const { error } = await supabase.from('businesses').upsert({ ...toSnake(biz), owner_email: email }); if (error) throw new Error(error.message); return biz }
    const db = DEMO.read(); db.businesses = db.businesses || {}; db.businesses[email] = biz; DEMO.write(db); return biz
  },
  async createWaterTest(rec) {
    if (SUPABASE_READY) { const { error } = await supabase.from('water_tests').upsert(toSnake(rec), { onConflict: 'swid' }); if (error) throw new Error(error.message); return rec }
    const db = DEMO.read(); db.water = db.water || {}; db.water[rec.swid] = rec; DEMO.write(db); return rec
  },
  async listWaterTests(email) {
    if (SUPABASE_READY) { const { data } = await supabase.from('water_tests').select('*').eq('owner_email', email).order('ts', { ascending: false }); return camelList(data) }
    const db = DEMO.read(); return Object.values(db.water || {}).filter(w => w.ownerEmail === email).sort((a, b) => (b.ts || '').localeCompare(a.ts || ''))
  },
  async listAllWaterTests() {
    if (SUPABASE_READY) { const { data } = await supabase.from('water_tests').select('*').order('ts', { ascending: false }); return camelList(data) }
    const db = DEMO.read(); return Object.values(db.water || {}).sort((a, b) => (b.ts || '').localeCompare(a.ts || ''))
  },
  async updateWaterTest(swid, patch) {
    if (SUPABASE_READY) { const { error } = await supabase.from('water_tests').update(toSnake(patch)).eq('swid', swid); if (error) throw new Error(error.message); return }
    const db = DEMO.read(); db.water = db.water || {}; db.water[swid] = { ...(db.water[swid] || {}), ...patch }; DEMO.write(db)
  },
  async listOfficers(agency) {
    let r
    if (SUPABASE_READY) { const { data } = await supabase.from('officers').select('*').order('created_at', { ascending: false }); r = camelList(data) }
    else { const db = DEMO.read(); r = Object.values(db.officers || {}) }
    return agency ? r.filter(o => o.agency === agency) : r
  },
  async getOfficerByEmail(email) {
    if (SUPABASE_READY) { const { data } = await supabase.from('officers').select('*').eq('email', email).limit(1); return data && data[0] ? toCamel(data[0]) : null }
    const db = DEMO.read(); return Object.values(db.officers || {}).find(o => (o.email || '').toLowerCase() === (email || '').toLowerCase()) || null
  },
  async addOfficer(o) {
    const rec = { id: o.id || ('OFF-' + Date.now()), status: o.status || 'Active', createdAt: new Date().toISOString(), ...o }
    if (SUPABASE_READY) { const { error } = await supabase.from('officers').upsert(toSnake(rec), { onConflict: 'email' }); if (error) throw new Error(error.message); return rec }
    const db = DEMO.read(); db.officers = db.officers || {}; db.officers[rec.id] = rec; DEMO.write(db); return rec
  },
  async updateOfficer(id, patch) {
    if (SUPABASE_READY) { const { error } = await supabase.from('officers').update(toSnake(patch)).eq('id', id); if (error) throw new Error(error.message); return }
    const db = DEMO.read(); db.officers = db.officers || {}; db.officers[id] = { ...(db.officers[id] || {}), ...patch }; DEMO.write(db)
  },
  async createTicket(t) {
    const rec = { ...t, status: 'Open', createdAt: new Date().toISOString() }
    if (SUPABASE_READY) { const { error } = await supabase.from('support_tickets').insert(toSnake(rec)); if (error) throw new Error(error.message); return rec }
    const db = DEMO.read(); db.tickets = db.tickets || []; db.tickets.push({ id: Date.now(), ...rec }); DEMO.write(db); return rec
  },
  async listTickets() {
    if (SUPABASE_READY) { const { data } = await supabase.from('support_tickets').select('*').order('created_at', { ascending: false }); return camelList(data) }
    const db = DEMO.read(); return (db.tickets || []).slice().reverse()
  },
  async createInspection(i) {
    const rec = { id: 'INS-' + Date.now() + Math.floor(Math.random() * 1000), ts: new Date().toISOString(), ...i }
    if (OFFLINE.isOffline()) { OFFLINE.enqueue({ kind: 'inspection', rec }); return { ...rec, pendingSync: true } }
    if (SUPABASE_READY) { const { error } = await supabase.from('inspections').insert(toSnake(rec)); if (error) throw new Error(error.message); return rec }
    const db = DEMO.read(); db.inspections = db.inspections || []; db.inspections.push(rec); DEMO.write(db); return rec
  },
  async listInspections(agency, officerEmail) {
    let rows
    if (SUPABASE_READY) { const { data } = await supabase.from('inspections').select('*').order('ts', { ascending: false }); rows = camelList(data) }
    else { const db = DEMO.read(); rows = (db.inspections || []).slice().reverse() }
    if (agency) rows = rows.filter(r => r.agency === agency)
    if (officerEmail) rows = rows.filter(r => (r.officerEmail || '') === officerEmail)
    return rows
  },
  async updateInspection(id, patch) {
    if (SUPABASE_READY) { const { error } = await supabase.from('inspections').update(toSnake(patch)).eq('id', id); if (error) throw new Error(error.message); return }
    const db = DEMO.read(); db.inspections = (db.inspections || []).map(r => r.id === id ? { ...r, ...patch } : r); DEMO.write(db)
  },
  async notify(audience, title, body) {
    const row = { audience, title, body, ts: new Date().toISOString() }
    if (SUPABASE_READY) { const { error } = await supabase.from('notifications').insert(row); if (error) console.warn('Notification could not be written:', error.message); return row }
    const db = DEMO.read(); db.notices = db.notices || []; db.notices.unshift(row); DEMO.write(db); return row
  },
  async listNotices(session) {
    const match = n => n.audience === 'all' || (session && (n.audience === session.role || n.audience === session.agency || n.audience === session.email))
    if (SUPABASE_READY) { const { data } = await supabase.from('notifications').select('*').order('ts', { ascending: false }).limit(50); return (data || []).filter(match) }
    const db = DEMO.read(); return (db.notices || []).filter(match).slice(0, 50)
  },
  async dispatch(to, channel, message) {
    // Fire-and-forget real SMS/email via the serverless Termii endpoint. Silent in preview.
    try { await fetch('/api/notify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ to, channel, message }) }) } catch { /* ignore */ }
  },
  async ping(table) {
    if (!SUPABASE_READY) return { ok: false, error: 'Supabase keys not set' }
    try { const { error } = await supabase.from(table).select('*', { count: 'exact', head: true }); if (error) return { ok: false, error: error.message }; return { ok: true } } catch (e) { return { ok: false, error: String(e) } }
  },
  async fn(name, body) {
    // Call a Supabase Edge Function with the caller's access token. Privileged
    // operations (approve, release, revoke, submit-result) run only here in live mode.
    if (!SUPABASE_READY) throw new Error('A connected backend is required for this action')
    const { data } = await supabase.auth.getSession()
    const token = data && data.session ? data.session.access_token : SUPABASE_ANON_KEY
    // All privileged actions go to one Edge Function ("safeplate"), routed by action.
    const res = await fetch(SUPABASE_URL + '/functions/v1/safeplate', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token, apikey: SUPABASE_ANON_KEY }, body: JSON.stringify({ action: name, ...(body || {}) }) })
    const out = await res.json().catch(() => ({}))
    if (!res.ok) {
      // If the server sent a specific reason (e.g. which role it saw), show that.
      if (out && out.error) throw new Error(out.error)
      if (res.status === 403) throw new Error('Your session was not recognised for this action. Sign out and sign in again with the correct role, and make sure the latest version is deployed.')
      if (res.status === 401) throw new Error('Your session has expired. Please sign in again.')
      throw new Error('Action failed')
    }
    return out
  }
}


export { DEMO, OFFLINE, seedDemo, normaliseCert, labsView, store }
