/*
  SafePlate - Lagos State Unified Food Handler Safety and Compliance Platform
  Single-file application (src/App.jsx). Stages 1 to 6.

  Navigation mirrors the CoopEco pattern: every page is a tab in the top banner,
  and each tab opens a full page, so there is no long scrolling.

  Stage 1  Landing and brand (Overview, The system, Impact) + public verification
  Stage 2  Deployable stack and role entry (Supabase auth, role-aware)
  Stage 3  Food Handler module, registration to payment into escrow (Paystack)
  Stage 4  Laboratory portal and results pipeline
  Stage 5  Regulator portals (LSMoH, LASEPA, HEFAMAA) with audit trail
  Stage 6  Sterling Bank escrow ledger, atomic waterfall release, reconciliation
*/

import React, { useEffect, useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { createClient } from '@supabase/supabase-js'
import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'

/* ------------------------------------------------------------------ */
/*  Configuration and backend abstraction                              */
/* ------------------------------------------------------------------ */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const SUPABASE_READY = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
const supabase = SUPABASE_READY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null

/* Paystack (live when VITE_PAYSTACK_PUBLIC_KEY is set, simulated otherwise) */
const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY
const PAYSTACK_READY = Boolean(PAYSTACK_PUBLIC_KEY)
function loadPaystack() {
  return new Promise((resolve, reject) => {
    if (window.PaystackPop) return resolve()
    const sc = document.createElement('script'); sc.src = 'https://js.paystack.co/v1/inline.js'
    sc.onload = () => resolve(); sc.onerror = () => reject(new Error('Could not load Paystack')); document.body.appendChild(sc)
  })
}
async function payWithPaystack({ email, amountNaira, reference }) {
  if (!PAYSTACK_READY) { await new Promise(r => setTimeout(r, 700)); return { reference: reference || ('DEMO-' + Date.now()), simulated: true } }
  await loadPaystack()
  return new Promise((resolve, reject) => {
    const handler = window.PaystackPop.setup({ key: PAYSTACK_PUBLIC_KEY, email: email || 'noreply@safeplate.lagosstate.gov.ng', amount: Math.round(amountNaira * 100), currency: 'NGN', ref: reference || ('SP-' + Date.now()), callback: resp => resolve({ reference: resp.reference }), onClose: () => reject(new Error('Payment window closed')) })
    handler.openIframe()
  })
}

/* Internationalisation. English and Yoruba, extend by adding keys. */
const STRINGS = {
  en: {
    signin: 'Sign in', signout: 'Sign out', back: 'Back',
    nav_overview: 'Overview', nav_system: 'The system', nav_impact: 'Impact', nav_fees: 'Fees', nav_verify: 'Verify',
    nav_testing: 'My testing', nav_queue: 'Laboratory queue', nav_team: 'My team', nav_water: 'Water testing',
    nav_review: 'Review', nav_certificates: 'Certificates', nav_analytics: 'Analytics', nav_audit: 'Audit trail',
    nav_enforcement: 'Enforcement', nav_accreditation: 'Accreditation', nav_ledger: 'Escrow ledger', nav_releases: 'Releases', nav_fund: 'Fund', nav_reconcile: 'Reconciliation',
    hero_eyebrow: 'Statewide, live compliance', hero_title: 'Every plate in Lagos, backed by a verified food handler.',
    hero_lede: 'SafePlate registers, tests, certifies and monitors every food handler in Lagos State, through accredited laboratories, with payments held in escrow and released only on approved results.',
    cta_register: 'Register as a food handler', cta_verify: 'Verify a certificate',
    chip_active: 'active certificates', chip_compliance: 'compliance', chip_secure: 'Escrow-secured payments', hero_model: 'A transparent, self-sustaining model, with no hidden charges.',
    sys_kicker: 'The system', sys_title: 'Four pillars, one accountable platform',
    imp_kicker: 'Why it matters', imp_title: 'The cost of unsafe food is measured in lives',
    fees_kicker: 'Transparent fees', fees_title: 'What you pay, and exactly where it goes',
    verify_kicker: 'Public verification', verify_title: 'Verify a food handler certificate',
    verify_sub: 'Enter a SAFEPLATE ID to confirm status, panel and expiry. No account needed.', verify_label: 'Certificate ID', verify_btn: 'Verify certificate', verify_notfound: 'No certificate matches that ID. Check the ID and try again.',
    fh_title: 'Your testing', fh_s1: 'Register and get your SAFEPLATE ID', fh_s2: 'Your mandatory test panel', fh_s3: 'Choose an accredited laboratory', fh_s4: 'Pay into escrow',
    lbl_fullname: 'Full name', lbl_phone: 'Phone number', lbl_nin: 'NIN (optional, verified when provided)', lbl_email: 'Email (optional)', lbl_employer: 'Employer (optional)',
    btn_create_id: 'Create my SAFEPLATE ID', btn_choose_lab: 'Choose a laboratory', fh_mandatory: 'Mandatory', fh_id_assigned: 'SAFEPLATE ID assigned:', fh_done: 'You are registered and paid. Your test is scheduled.'
  },
  yo: {
    signin: 'Wọlé', signout: 'Jáde', back: 'Padà',
    nav_overview: 'Ìsọníṣókí', nav_system: 'Ètò náà', nav_impact: 'Ipa', nav_fees: 'Owó', nav_verify: 'Ṣàyẹ̀wò',
    nav_testing: 'Àyẹ̀wò mi', nav_queue: 'Àkọ́sílẹ̀ ilé-ìwádìí', nav_team: 'Àwọn òṣìṣẹ́ mi', nav_water: 'Àyẹ̀wò omi',
    nav_review: 'Àtúnyẹ̀wò', nav_certificates: 'Ìwé-ẹ̀rí', nav_analytics: 'Ìṣirò', nav_audit: 'Àkọsílẹ̀ ìṣàkóso',
    nav_enforcement: 'Ìmúṣẹ', nav_accreditation: 'Ìfọwọ́sí', nav_ledger: 'Ìwé-owó ìṣúra', nav_releases: 'Ìtúsílẹ̀', nav_fund: 'Owó-ìṣúra', nav_reconcile: 'Ìbámu',
    hero_eyebrow: 'Ìbámu tí ń lọ lọ́wọ́ kákiri ìpínlẹ̀', hero_title: 'Gbogbo àwo oúnjẹ ní Èkó, pẹ̀lú olùtọ́jú oúnjẹ tí a ti ṣàyẹ̀wò.',
    hero_lede: 'SafePlate ń forúkọsílẹ̀, ń ṣàyẹ̀wò, ń fúnni ní ìwé-ẹ̀rí, ó sì ń bójútó gbogbo olùtọ́jú oúnjẹ ní Ìpínlẹ̀ Èkó, nípasẹ̀ àwọn ilé-ìwádìí tí a fọwọ́sí, pẹ̀lú owó tí a fi pamọ́ tí a ó tú sílẹ̀ lẹ́yìn ìfọwọ́sí àbájáde.',
    cta_register: 'Forúkọsílẹ̀ gẹ́gẹ́ bí olùtọ́jú oúnjẹ', cta_verify: 'Ṣàyẹ̀wò ìwé-ẹ̀rí',
    chip_active: 'ìwé-ẹ̀rí tí ń ṣiṣẹ́', chip_compliance: 'ìbámu', chip_secure: 'Ìsanwó tí a dáàbò bò', hero_model: 'Ètò tó ṣe kedere, tó ń gbọ́ ara rẹ̀, láìsí owó ìkọ̀kọ̀.',
    sys_kicker: 'Ètò náà', sys_title: 'Òpó mẹ́rin, pẹpẹ ìṣirò kan',
    imp_kicker: 'Ìdí tí ó fi ṣe pàtàkì', imp_title: 'Iye owó oúnjẹ tí kò ní ààbò ni a fi ẹ̀mí wọn wọ̀n',
    fees_kicker: 'Owó tó ṣe kedere', fees_title: 'Ohun tí o ń san, àti ibi tí ó ń lọ gan-an',
    verify_kicker: 'Ìdánilójú gbogbo ènìyàn', verify_title: 'Ṣàyẹ̀wò ìwé-ẹ̀rí olùtọ́jú oúnjẹ',
    verify_sub: 'Tẹ ID SAFEPLATE sí i láti mọ ipò, àyẹ̀wò àti ọjọ́ ìparí. Kò sí àkàǹtì tí a nílò.', verify_label: 'ID Ìwé-ẹ̀rí', verify_btn: 'Ṣàyẹ̀wò ìwé-ẹ̀rí', verify_notfound: 'Kò sí ìwé-ẹ̀rí tí ó bá ID yẹn mu. Ṣàyẹ̀wò ID kí o sì tún gbìyànjú.',
    fh_title: 'Àyẹ̀wò rẹ', fh_s1: 'Forúkọsílẹ̀ kí o sì gba ID SAFEPLATE rẹ', fh_s2: 'Àkójọ àyẹ̀wò dandan rẹ', fh_s3: 'Yan ilé-ìwádìí tí a fọwọ́sí', fh_s4: 'San sí ìṣúra ààbò',
    lbl_fullname: 'Orúkọ kíkún', lbl_phone: 'Nọ́mbà fóònù', lbl_nin: 'NIN (àṣàyàn)', lbl_email: 'Ímeèlì (àṣàyàn)', lbl_employer: 'Agbaniṣíṣẹ́ (àṣàyàn)',
    btn_create_id: 'Ṣẹ̀dá ID SAFEPLATE mi', btn_choose_lab: 'Yan ilé-ìwádìí', fh_mandatory: 'Dandan', fh_id_assigned: 'ID SAFEPLATE tí a fún ọ:', fh_done: 'A ti forúkọsílẹ̀ rẹ, a sì ti san. A ti ṣètò àyẹ̀wò rẹ.'
  }
}
const I18N = { lang: (typeof localStorage !== 'undefined' && localStorage.getItem('safeplate:lang')) || 'en' }
function t(key) { return (STRINGS[I18N.lang] && STRINGS[I18N.lang][key]) || STRINGS.en[key] || key }
const tr = t

const DEMO = {
  key: 'safeplate:v6',
  read() { try { return JSON.parse(localStorage.getItem(this.key)) || {} } catch { return {} } },
  write(data) { try { localStorage.setItem(this.key, JSON.stringify(data)) } catch { /* ignore */ } }
}

function seedDemo() {
  const data = DEMO.read()
  if (data.seeded) return
  const now = Date.now(), day = 86400000
  const TESTS = ['Hepatitis A', 'Hepatitis E', 'Stool Microscopy & Culture (MC)']
  data.users = data.users || {}
  data.handlers = data.handlers || {}
  data.orders = {
    'ORD-2026-004821': { id: 'ORD-2026-004821', safeplateId: 'SP-LG-2026004821', handlerName: 'Adewale Babatunde Okonkwo', phone: '08031234821', lab: 'Lancet Ikeja', tests: TESTS, status: 'Scheduled', createdAt: new Date(now - 1 * day).toISOString() },
    'ORD-2026-006721': { id: 'ORD-2026-006721', safeplateId: 'SP-LG-2026006721', handlerName: 'Bola Adeyemi', phone: '08037776721', lab: 'Lancet Ikeja', tests: TESTS, status: 'Sample Collected', createdAt: new Date(now - 2 * day).toISOString() },
    'ORD-2026-006834': { id: 'ORD-2026-006834', safeplateId: 'SP-LG-2026006834', handlerName: 'Kemi Oladele', phone: '08039996834', lab: 'Synlab Victoria Island', tests: TESTS, status: 'Testing in Progress', createdAt: new Date(now - 3 * day).toISOString() }
  }
  data.establishments = {
    'EST-001': { id: 'EST-001', name: 'Mama Cass Kitchen, Ikeja', lga: 'Ikeja', compliance: 'Compliant', sanction: null, appeal: null },
    'EST-002': { id: 'EST-002', name: 'Sweet Sensation, Yaba', lga: 'Yaba', compliance: 'Overdue', sanction: 'Warning', appeal: null },
    'EST-003': { id: 'EST-003', name: 'Grill House, Lekki', lga: 'Lekki', compliance: 'Non-compliant', sanction: 'Fine', appeal: null }
  }
  data.escrow = {
    'SP-LG-2026004821': { safeplateId: 'SP-LG-2026004821', name: 'Adewale Babatunde Okonkwo', lab: 'Lancet Ikeja', amount: 15000, status: 'HELD', ts: new Date(now - 1 * day).toISOString() },
    'SP-LG-2026006721': { safeplateId: 'SP-LG-2026006721', name: 'Bola Adeyemi', lab: 'Lancet Ikeja', amount: 15000, status: 'HELD', ts: new Date(now - 2 * day).toISOString() },
    'SP-LG-2025009003': { safeplateId: 'SP-LG-2025009003', name: 'Ngozi Okafor', lab: 'Synlab Victoria Island', amount: 15000, status: 'RELEASED', ts: new Date(now - 30 * day).toISOString(), releasedTs: new Date(now - 28 * day).toISOString(), releasedBy: 'Sterling Bank Officer' }
  }
  data.releases = [
    { safeplateId: 'SP-LG-2026004821', name: 'Adewale Babatunde Okonkwo', lab: 'Lancet Ikeja', amount: 15000, status: 'Instructed', approvedBy: 'LSMoH Officer', ts: new Date(now - 1 * day).toISOString() }
  ]
  data.escrow['SP-W-LG-2026003007'] = { safeplateId: 'SP-W-LG-2026003007', name: 'Grill House, Lekki', lab: 'Synlab Victoria Island', amount: 65000, status: 'HELD', type: 'WATER', ts: new Date(now - 2 * day).toISOString() }
  data.water = {
    'SP-W-LG-2026003007': { swid: 'SP-W-LG-2026003007', facility: 'Grill House, Lekki', lga: 'Lekki', source: 'Borehole', officer: 'Tunde Bello', contact: '08033330007', lab: 'Synlab Victoria Island', amount: 65000, status: 'Submitted, pending LASEPA', results: { ph: '7.1', turbidity: '2.4 NTU', ecoli: '0 CFU/100ml' }, ownerEmail: 'seed', ts: new Date(now - 2 * day).toISOString() }
  }
  data.certificates = {
    'SP-LG-2026004821': { safeplateId: 'SP-LG-2026004821', name: 'Adewale Babatunde Okonkwo', panel: 'Hepatitis A, Hepatitis E, Stool MC', lab: 'Lancet Ikeja', issued: new Date(now - 40 * day).toISOString(), expiry: new Date(now + 140 * day).toISOString(), status: 'VALID' },
    'SP-LG-2025008114': { safeplateId: 'SP-LG-2025008114', name: 'Chidinma Eze', panel: 'Hepatitis A, Hepatitis E, Stool MC', lab: 'Synlab Victoria Island', issued: new Date(now - 220 * day).toISOString(), expiry: new Date(now - 40 * day).toISOString(), status: 'EXPIRED' },
    'SP-LG-2026001990': { safeplateId: 'SP-LG-2026001990', name: 'Bola Adeyemi', panel: 'Hepatitis A, Hepatitis E, Stool MC', lab: 'Clinix Surulere', issued: new Date(now - 10 * day).toISOString(), expiry: new Date(now + 170 * day).toISOString(), status: 'REVOKED' }
  }
  data.audit = []
  data.notices = [
    { audience: 'all', title: 'SafePlate is live', body: 'Statewide food handler and water certification is now active.', ts: new Date(now - 1 * day).toISOString() },
    { audience: 'LSMoH', title: 'Results awaiting review', body: 'Laboratory results are pending Ministry approval.', ts: new Date(now - 2 * 3600000).toISOString() }
  ]
  data.seeded = true
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
  async signIn(email, password) {
    if (SUPABASE_READY) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message)
      const meta = data.user?.user_metadata || {}
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
    if (SUPABASE_READY) { const { data } = await supabase.from('certificates').select('*').eq('safeplate_id', clean).limit(1); const c = data && data[0]; return c ? normaliseCert(toCamel(c)) : null }
    const db = DEMO.read(); const cert = db.certificates?.[clean]; return cert ? normaliseCert(cert) : null
  },
  async issueCertificate(cert) {
    if (SUPABASE_READY) { const { error } = await supabase.from('certificates').upsert(toSnake(cert), { onConflict: 'safeplate_id' }); if (error) throw new Error(error.message); return cert }
    const db = DEMO.read(); db.certificates = db.certificates || {}; db.certificates[cert.safeplateId] = cert; DEMO.write(db); return cert
  },
  async revokeCertificate(id) {
    const clean = (id || '').trim().toUpperCase()
    if (SUPABASE_READY) { await supabase.from('certificates').update({ status: 'REVOKED' }).eq('safeplate_id', clean); return }
    const db = DEMO.read(); if (db.certificates?.[clean]) { db.certificates[clean].status = 'REVOKED'; DEMO.write(db) }
  },
  async createEscrow(rec) {
    if (SUPABASE_READY) { await supabase.from('escrow').upsert(toSnake(rec), { onConflict: 'safeplate_id' }); return rec }
    const db = DEMO.read(); db.escrow = db.escrow || {}; db.escrow[rec.safeplateId] = rec; DEMO.write(db); return rec
  },
  async listEscrow() {
    if (SUPABASE_READY) { const { data } = await supabase.from('escrow').select('*').order('ts', { ascending: false }); return camelList(data) }
    const db = DEMO.read(); return Object.values(db.escrow || {}).sort((a, b) => (b.ts || '').localeCompare(a.ts || ''))
  },
  async createRelease(rec) {
    if (SUPABASE_READY) { await supabase.from('escrow_releases').insert(toSnake(rec)); return rec }
    const db = DEMO.read(); db.releases = db.releases || []; db.releases.unshift(rec); DEMO.write(db); return rec
  },
  async listReleases() {
    if (SUPABASE_READY) { const { data } = await supabase.from('escrow_releases').select('*').order('ts', { ascending: false }); return camelList(data) }
    const db = DEMO.read(); return db.releases || []
  },
  async releaseEscrow(safeplateId, by) {
    if (SUPABASE_READY) {
      await supabase.from('escrow').update({ status: 'RELEASED', released_ts: new Date().toISOString(), released_by: by }).eq('safeplate_id', safeplateId)
      await supabase.from('escrow_releases').update({ status: 'Released' }).eq('safeplate_id', safeplateId)
      return
    }
    const db = DEMO.read()
    if (db.escrow?.[safeplateId]) { db.escrow[safeplateId].status = 'RELEASED'; db.escrow[safeplateId].releasedTs = new Date().toISOString(); db.escrow[safeplateId].releasedBy = by }
    db.releases = (db.releases || []).map(r => r.safeplateId === safeplateId ? { ...r, status: 'Released' } : r)
    DEMO.write(db)
  },
  async appendAudit(entry) {
    const row = { ...entry, ts: new Date().toISOString(), ip: 'captured server-side' }
    if (SUPABASE_READY) { await supabase.from('audit_log').insert(row); return row }
    const db = DEMO.read(); db.audit = db.audit || []; db.audit.unshift(row); DEMO.write(db); return row
  },
  async listAudit() {
    if (SUPABASE_READY) { const { data } = await supabase.from('audit_log').select('*').order('ts', { ascending: false }).limit(200); return data || [] }
    const db = DEMO.read(); return db.audit || []
  },
  async listEstablishments() {
    if (SUPABASE_READY) { const { data } = await supabase.from('establishments').select('*'); return camelList(data) }
    const db = DEMO.read(); return Object.values(db.establishments || {})
  },
  async updateEstablishment(id, patch) {
    if (SUPABASE_READY) { await supabase.from('establishments').update(toSnake(patch)).eq('id', id); return }
    const db = DEMO.read(); db.establishments = db.establishments || {}; db.establishments[id] = { ...(db.establishments[id] || {}), ...patch }; DEMO.write(db)
  },
  async setLabAccredited(id, val) {
    if (SUPABASE_READY) { await supabase.from('laboratories').update({ accredited: val }).eq('id', id) }
    const db = DEMO.read(); db.labAccred = db.labAccred || {}; db.labAccred[id] = val; DEMO.write(db)
  },
  async getBusiness(email) {
    if (SUPABASE_READY) { const { data } = await supabase.from('businesses').select('*').eq('owner_email', email).limit(1); const b = data && data[0]; return b ? toCamel(b) : null }
    const db = DEMO.read(); return (db.businesses || {})[email] || null
  },
  async saveBusiness(email, biz) {
    if (SUPABASE_READY) { await supabase.from('businesses').upsert({ ...toSnake(biz), owner_email: email }); return biz }
    const db = DEMO.read(); db.businesses = db.businesses || {}; db.businesses[email] = biz; DEMO.write(db); return biz
  },
  async createWaterTest(rec) {
    if (SUPABASE_READY) { await supabase.from('water_tests').upsert(toSnake(rec), { onConflict: 'swid' }); return rec }
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
    if (SUPABASE_READY) { await supabase.from('water_tests').update(toSnake(patch)).eq('swid', swid); return }
    const db = DEMO.read(); db.water = db.water || {}; db.water[swid] = { ...(db.water[swid] || {}), ...patch }; DEMO.write(db)
  },
  async notify(audience, title, body) {
    const row = { audience, title, body, ts: new Date().toISOString() }
    if (SUPABASE_READY) { await supabase.from('notifications').insert(row); return row }
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
    if (!res.ok) throw new Error(out.error || 'Action failed')
    return out
  }
}

// Client-side idle timeout: 15 min for Ministry/Sterling, 30 min otherwise.
function useIdleTimeout(session, onTimeout) {
  useEffect(() => {
    if (!session) return
    const mins = ['regulator', 'sterling'].includes(session.role) ? 15 : 30
    let timer
    const reset = () => { clearTimeout(timer); timer = setTimeout(onTimeout, mins * 60000) }
    const evts = ['mousedown', 'keydown', 'scroll', 'touchstart']
    evts.forEach(e => window.addEventListener(e, reset)); reset()
    return () => { clearTimeout(timer); evts.forEach(e => window.removeEventListener(e, reset)) }
    // eslint-disable-next-line
  }, [session])
}

/* ------------------------------------------------------------------ */
/*  Domain constants                                                   */
/* ------------------------------------------------------------------ */

const PALETTE = { green: '#006600', gold: '#FBAE40', navy: '#003366', white: '#FFFFFF' }

const PILLARS = [
  { n: '1', title: 'Mandatory testing', body: 'Standardised biannual testing for every food handler, through accredited ISO-certified laboratories.' },
  { n: '2', title: 'Digital platform', body: 'Register, schedule, pay, get results, get certified, and stay monitored, end to end.' },
  { n: '3', title: 'Coordinated enforcement', body: 'LSMoH, LASEPA and HEFAMAA aligned under one operational system with a live audit trail.' },
  { n: '4', title: 'Self-sustaining finance', body: 'A standardised fee and transparent waterfall keep the programme running without indefinite public funding.' }
]

const BURDEN = [
  { stat: '200,000', label: 'food-poisoning deaths a year in Nigeria', src: 'NAFDAC' },
  { stat: '600m', label: 'foodborne illness cases worldwide each year', src: 'WHO' },
  { stat: 'US$110bn', label: 'annual cost to low and middle-income economies', src: 'World Bank' }
]

const MANDATORY_TESTS = ['Hepatitis A', 'Hepatitis E', 'Stool Microscopy & Culture (MC)']

const LAGOS_LGAS = ['Agege', 'Ajeromi-Ifelodun', 'Alimosho', 'Amuwo-Odofin', 'Apapa', 'Badagry', 'Epe', 'Eti-Osa', 'Ibeju-Lekki', 'Ifako-Ijaiye', 'Ikeja', 'Ikorodu', 'Kosofe', 'Lagos Island', 'Lagos Mainland', 'Mushin', 'Ojo', 'Oshodi-Isolo', 'Shomolu', 'Surulere']

// Compress a photo to <= ~200KB and return a JPEG data URL.
function compressImage(file, maxKB = 200) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        let w = img.width, h = img.height, maxDim = 640
        if (w > h && w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim }
        else if (h > maxDim) { w = Math.round(w * maxDim / h); h = maxDim }
        const c = document.createElement('canvas'); c.width = w; c.height = h
        c.getContext('2d').drawImage(img, 0, 0, w, h)
        let q = 0.8, out = c.toDataURL('image/jpeg', q)
        while (out.length > maxKB * 1024 * 1.37 && q > 0.3) { q -= 0.1; out = c.toDataURL('image/jpeg', q) }
        resolve(out)
      }
      img.onerror = reject; img.src = e.target.result
    }
    reader.onerror = reject; reader.readAsDataURL(file)
  })
}

async function fetchDataUrl(url) {
  const r = await fetch(url); const b = await r.blob()
  return new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b) })
}

// Build and download a Certificate of Fitness PDF.
async function generateCertPDF(cert) {
  const id = cert.safeplateId || cert.safeplate_id
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight()
  doc.setDrawColor(0, 102, 0); doc.setLineWidth(2); doc.rect(28, 28, W - 56, H - 56)
  doc.setDrawColor(251, 174, 64); doc.setLineWidth(0.7); doc.rect(36, 36, W - 72, H - 72)
  try { const crest = await fetchDataUrl('/lagos-logo.png'); doc.addImage(crest, 'PNG', W / 2 - 42, 52, 84, 84) } catch (e) { /* ignore */ }
  doc.setFont('times', 'bold'); doc.setTextColor(0, 51, 102); doc.setFontSize(16)
  doc.text('Lagos State Ministry of Health', W / 2, 162, { align: 'center' })
  doc.setFontSize(22); doc.setTextColor(0, 102, 0)
  doc.text('Certificate of Fitness', W / 2, 192, { align: 'center' })
  doc.setFont('times', 'normal'); doc.setFontSize(11); doc.setTextColor(90, 107, 100)
  doc.text('SafePlate, Food Handler Safety and Compliance', W / 2, 212, { align: 'center' })
  let y = 262
  const row = (label, val) => { doc.setFont('times', 'bold'); doc.setTextColor(18, 36, 31); doc.setFontSize(12); doc.text(label, 70, y); doc.setFont('times', 'normal'); doc.text(String(val || '-'), 240, y); y += 27 }
  row('Name', cert.name)
  row('SAFEPLATE ID', id)
  row('Certificate No', cert.cert_no || cert.certNo || cert.series || '-')
  row('Test panel', cert.panel)
  row('Issued', cert.issued ? new Date(cert.issued).toLocaleDateString('en-GB') : '-')
  row('Expires', new Date(cert.expiry || cert.expiry_date).toLocaleDateString('en-GB'))
  y += 8; doc.setFont('times', 'bold'); doc.setFontSize(14); doc.setTextColor(0, 102, 0)
  doc.text('STATUS: FIT FOR FOOD HANDLING', 70, y)
  try { const qr = await QRCode.toDataURL(window.location.origin + '/#/verify/' + id, { margin: 1, width: 170 }); doc.addImage(qr, 'PNG', W - 196, 250, 126, 126) } catch (e) { /* ignore */ }
  doc.setFont('times', 'normal'); doc.setFontSize(10); doc.setTextColor(90, 107, 100)
  doc.text('Verify at ' + window.location.origin + '/#/verify/' + id, 70, H - 96)
  doc.text('Report a concern: 0800-SAFE-PLATE (LASEPA)', 70, H - 80)
  doc.text('Issued under the NAFDAC Food Hygiene Regulation 2019. Biannual renewal required.', 70, H - 64)
  doc.save('SafePlate-Certificate-' + id + '.pdf')
}

const LABS = [
  { id: 'lancet-ikeja', name: 'Lancet Ikeja', area: 'Ikeja', turnaround: '48 hours', accredited: true, mobile: true, accNo: 'HEF-LAB-0142' },
  { id: 'synlab-vi', name: 'Synlab Victoria Island', area: 'Victoria Island', turnaround: '24 hours', accredited: true, mobile: true, accNo: 'HEF-LAB-0088' },
  { id: 'clinix-surulere', name: 'Clinix Surulere', area: 'Surulere', turnaround: '72 hours', accredited: true, mobile: false, accNo: 'HEF-LAB-0210' },
  { id: 'medbury-yaba', name: 'Medbury Yaba', area: 'Yaba', turnaround: '48 hours', accredited: true, mobile: true, accNo: 'HEF-LAB-0175' },
  { id: 'zaine-lekki', name: 'Zaine Diagnostics Lekki', area: 'Lekki', turnaround: '36 hours', accredited: false, mobile: false, accNo: null }
]

function labsView() {
  const db = DEMO.read(); const ov = db.labAccred || {}
  return LABS.map(l => (l.id in ov ? { ...l, accredited: ov[l.id] } : l))
}

const FEE = 15000
const WATERFALL = [
  { who: 'Private Lab, execution', pct: 76.5, amount: 11475 },
  { who: 'LSMoH, oversight & regulation', pct: 10, amount: 1500 },
  { who: 'Technology partner', pct: 5, amount: 750 },
  { who: 'Financial Partner (Sterling Bank)', pct: 5, amount: 750 },
  { who: 'LASEPA, enforcement', pct: 3.5, amount: 525 }
]
const FUND_PER_TXN = 1500
const WATER_FEE = 65000
const WATER_WATERFALL = [
  { who: 'LASEPA, enforcement & execution', pct: 80, amount: 52000 },
  { who: 'LSMoH, regulation', pct: 10, amount: 6500 },
  { who: 'Technology partner', pct: 5, amount: 3250 },
  { who: 'Financial Partner (Sterling Bank)', pct: 5, amount: 3250 }
]
const WATER_FUND = 6500
const WATER_SOURCES = ['Borehole', 'Sachet water production', 'Well water', 'Piped supply']
function makeWaterId() { const y = new Date().getFullYear(); const seq = String(Math.floor(10000 + Math.random() * 89999)); return ('SP-W-LG-' + y + seq).slice(0, 17) }
function makeWaterCertSeries() { const y = new Date().getFullYear(); return 'SP-W-CERT-' + y + '-' + String(Math.floor(100000 + Math.random() * 899999)) }
function waterChecks(r) {
  const ph = parseFloat(r.ph), turb = parseFloat(r.turbidity), ec = parseFloat(r.ecoli)
  return [
    { k: 'pH', v: r.ph, ok: ph >= 6.5 && ph <= 8.5, bench: '6.5 to 8.5' },
    { k: 'Turbidity', v: r.turbidity, ok: turb < 5, bench: 'under 5 NTU' },
    { k: 'E. coli', v: r.ecoli, ok: ec === 0, bench: '0 CFU/100ml' }
  ]
}

const ROLES = [
  { id: 'food_handler', code: 'FH', label: 'Food Handler', tag: 'Register, pay, get certified' },
  { id: 'employer', code: 'EM', label: 'Employer / Establishment', tag: "Manage your team's compliance" },
  { id: 'laboratory', code: 'LB', label: 'Approved Laboratory', tag: 'View orders and upload results' },
  { id: 'regulator', code: 'MH', label: 'Regulator', tag: 'LSMoH, LASEPA or HEFAMAA oversight' },
  { id: 'sterling', code: 'SB', label: 'Sterling Bank', tag: 'Escrow management' }
]
const AGENCIES = ['LSMoH', 'LASEPA', 'HEFAMAA']
// LSMoH is the platform administrator and can step into any workspace.
const WORKSPACES = [
  { id: 'lsmoh', role: 'regulator', agency: 'LSMoH', label: 'LSMoH, Health oversight', short: 'LSMoH' },
  { id: 'lasepa', role: 'regulator', agency: 'LASEPA', label: 'LASEPA, Environment', short: 'LASEPA' },
  { id: 'hefamaa', role: 'regulator', agency: 'HEFAMAA', label: 'HEFAMAA, Accreditation', short: 'HEFAMAA' },
  { id: 'laboratory', role: 'laboratory', agency: null, label: 'Approved Laboratory', short: 'Laboratory' },
  { id: 'sterling', role: 'sterling', agency: null, label: 'Sterling Bank, Escrow', short: 'Sterling' },
  { id: 'employer', role: 'employer', agency: null, label: 'Employer / Establishment', short: 'Employer' },
  { id: 'food_handler', role: 'food_handler', agency: null, label: 'Food Handler', short: 'Food handler' }
]
const SANCTION_LADDER = ['Warning', 'Fine', 'Temporary closure', 'Loss of operating licence']
const METRICS = [
  { k: 'Statewide compliance', v: '89.4%' },
  { k: 'Active certificates', v: '14,892' },
  { k: 'Non-compliant handlers', v: '1,764' },
  { k: 'Fees collected', v: '\u20A6223M' }
]

const naira = n => '\u20A6' + Number(n).toLocaleString('en-NG')
const otp6 = v => /^[0-9]{6}$/.test(v)

function makeSafeplateId() {
  const year = new Date().getFullYear()
  const seq = String(Math.floor(1000 + Math.random() * 8999)) + String(Math.floor(10 + Math.random() * 89))
  return ('SP-LG-' + year + seq).slice(0, 16)
}

function statusKey(s) {
  if (s === 'Scheduled') return 'Scheduled'
  if (s === 'Sample Collected') return 'Sample'
  if (s === 'Testing in Progress') return 'Testing'
  if (s === 'Submitted') return 'Submitted'
  return 'Flag'
}
function slaExceeded(order) {
  const t = order.submittedAt || order.createdAt
  return t ? (Date.now() - new Date(t).getTime()) / 3600000 > 48 : false
}

function tabsForSession(session) {
  if (!session) return [
    { id: 'overview', label: t('nav_overview') },
    { id: 'system', label: t('nav_system') },
    { id: 'impact', label: t('nav_impact') },
    { id: 'verify', label: t('nav_verify') }
  ]
  switch (session.role) {
    case 'food_handler': return [{ id: 'testing', label: t('nav_testing') }, { id: 'verify', label: t('nav_verify') }]
    case 'laboratory': return [{ id: 'queue', label: t('nav_queue') }, { id: 'verify', label: t('nav_verify') }]
    case 'employer': return [{ id: 'team', label: t('nav_team') }, { id: 'water', label: t('nav_water') }, { id: 'verify', label: t('nav_verify') }]
    case 'sterling': return [
      { id: 'ledger', label: t('nav_ledger') }, { id: 'releases', label: t('nav_releases') },
      { id: 'fund', label: t('nav_fund') }, { id: 'reconcile', label: t('nav_reconcile') }, { id: 'verify', label: t('nav_verify') }
    ]
    case 'regulator':
      if (session.agency === 'LASEPA') return [{ id: 'enforcement', label: t('nav_enforcement') }, { id: 'water', label: t('nav_water') }, { id: 'audit', label: t('nav_audit') }, { id: 'verify', label: t('nav_verify') }]
      if (session.agency === 'HEFAMAA') return [{ id: 'accreditation', label: t('nav_accreditation') }, { id: 'audit', label: t('nav_audit') }, { id: 'verify', label: t('nav_verify') }]
      return [{ id: 'review', label: t('nav_review') }, { id: 'certificates', label: t('nav_certificates') }, { id: 'analytics', label: t('nav_analytics') }, { id: 'audit', label: t('nav_audit') }, { id: 'verify', label: t('nav_verify') }]
    default: return [{ id: 'verify', label: t('nav_verify') }]
  }
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

function Styles() {
  return (
    <style>{`
      :root{--green:${PALETTE.green};--gold:${PALETTE.gold};--navy:${PALETTE.navy};--ink:#12241f;--muted:#5b6b64;--line:#e3e7e4;--paper:#fbfcfb;--green-pale:#eef4ee;--gold-pale:#fdf3e0;--navy-pale:#eaf0f6}
      *{box-sizing:border-box}
      html,body,#root{margin:0;padding:0}
      body{background:var(--paper);color:var(--ink);font-family:'Inter',system-ui,-apple-system,sans-serif;line-height:1.55;-webkit-font-smoothing:antialiased}
      h1,h2,h3,h4,.serif{font-family:'Lora',Georgia,serif}
      button{font-family:inherit;cursor:pointer}
      .wrap{max-width:1100px;margin:0 auto;padding:0 22px}
      .govbar{background:var(--green);color:#fff;font-size:12.5px;letter-spacing:.02em}
      .govbar .wrap{display:flex;align-items:center;justify-content:space-between;min-height:36px;gap:12px;flex-wrap:wrap}
      .govbar .dot{width:7px;height:7px;border-radius:50%;background:var(--gold);display:inline-block;margin-right:7px}

      .hdr{background:#fff;border-bottom:1px solid var(--line);position:sticky;top:0;z-index:40}
      .hdr .bar{display:flex;align-items:center;gap:16px;min-height:64px;flex-wrap:wrap}
      .brand{display:flex;align-items:center;gap:11px;border:0;background:none;padding:0}
      .crest{width:40px;height:40px;object-fit:contain}
      .brand b{font-family:'Lora',serif;font-size:20px;letter-spacing:.01em}
      .brand b span{color:var(--green)}
      .brand small{display:block;color:var(--muted);font-size:11px;letter-spacing:.03em;text-transform:uppercase}
      .navtabs{display:flex;gap:2px;flex-wrap:wrap;flex:1}
      .bar.app .navtabs{flex:initial}
      .navtab{padding:9px 14px;border:0;background:none;font-weight:600;font-size:14px;color:var(--muted);border-radius:8px}
      .navtab.on{color:var(--green);background:var(--green-pale)}
      .bar.app .actions:before{content:'';width:1px;height:24px;background:var(--line);margin:0 4px}
      .navtab:hover{color:var(--ink)}
      .who{display:flex;align-items:center;gap:12px;margin-left:auto}
      .who .nm{font-size:13px;text-align:right;line-height:1.2}
      .who .nm b{display:block;font-family:'Lora',serif;font-size:14px}
      .who .nm small{color:var(--muted);font-size:11px}
      .langtog{display:flex;border:1px solid var(--line);border-radius:8px;overflow:hidden}
      .langbtn{border:0;background:#fff;padding:6px 9px;font-size:12px;font-weight:700;color:var(--muted)}
      .langbtn.on{background:var(--green);color:#fff}
      .bellwrap{position:relative}
      .bell{border:1px solid var(--line);background:#fff;border-radius:9px;width:38px;height:38px;display:grid;place-items:center;color:var(--ink)}
      .bell:hover{border-color:var(--green);color:var(--green)}
      .bellpanel{position:absolute;right:0;top:46px;width:300px;max-height:360px;overflow:auto;background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:0 12px 30px rgba(0,0,0,.12);z-index:60}
      .bellhead{padding:12px 14px;font-family:'Lora',serif;font-weight:700;border-bottom:1px solid var(--line);font-size:14px}
      .bellrow{padding:11px 14px;border-bottom:1px solid var(--line);font-size:13px}
      .bellrow b{font-size:13.5px}
      .bellts{font-size:11px;color:var(--muted);margin-top:3px}

      .btn{border:1px solid var(--line);background:#fff;color:var(--ink);padding:10px 16px;border-radius:9px;font-weight:600;font-size:14px;transition:.15s}
      .btn:hover{border-color:var(--green)}
      .btn.p{background:var(--green);border-color:var(--green);color:#fff}
      .btn.p:hover{background:#00560a}
      .btn.g{background:var(--gold);border-color:var(--gold);color:#3a2600}
      .btn.ghost{background:transparent;border-color:transparent}
      .btn.sm{padding:7px 12px;font-size:13px}
      .btn.danger{border-color:#e6bcbc;color:#b3261e}
      .btn.danger:hover{border-color:#b3261e}
      .btn:disabled{opacity:.5;cursor:not-allowed}
      .btn.block{width:100%;justify-content:center;display:flex}

      .page{min-height:64vh;padding:34px 0}
      .kicker{font-size:12px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--gold);filter:brightness(.85)}
      h2.sec{font-size:clamp(23px,3.4vw,32px);margin:8px 0 6px}
      .sub{color:var(--muted);max-width:62ch;margin:0 0 24px}
      .greeting{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:8px}

      .hero{display:grid;grid-template-columns:1.3fr .9fr;gap:36px;align-items:center}
      .eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--green);background:#fff;border:1px solid #cfe0cf;padding:6px 12px;border-radius:100px}
      .hero h1{font-size:clamp(30px,4.6vw,46px);line-height:1.08;margin:18px 0 14px}
      .hero p.lede{font-size:17px;color:var(--muted);margin:0 0 24px}
      .hero-cta{display:flex;gap:12px;flex-wrap:wrap}
      .hero-art{display:grid;place-items:center}
      .hero-art img{width:264px;max-width:70vw;filter:drop-shadow(0 8px 22px rgba(6,20,14,.12))}
      .ticker{margin-top:26px;display:flex;gap:10px;flex-wrap:wrap}
      .chip{background:#fff;border:1px solid var(--line);border-radius:100px;padding:8px 14px;font-size:13px;color:var(--muted);display:flex;align-items:center;gap:8px}
      .chip b{color:var(--ink);font-family:'Lora',serif}
      .pulse{width:8px;height:8px;border-radius:50%;background:var(--green);animation:pulse 2s infinite}
      @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(0,102,0,.45)}70%{box-shadow:0 0 0 9px rgba(0,102,0,0)}100%{box-shadow:0 0 0 0 rgba(0,102,0,0)}}

      .pillars{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
      .pillar{background:#fff;border:1px solid var(--line);border-radius:14px;padding:22px}
      .pillar .num{font-family:'Lora',serif;font-size:13px;font-weight:700;color:#fff;background:var(--green);width:30px;height:30px;border-radius:8px;display:grid;place-items:center;margin-bottom:14px}
      .pillar h3{font-size:18px;margin:0 0 8px}
      .pillar p{margin:0;color:var(--muted);font-size:14px}
      .burden{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
      .burden .cell{background:var(--navy);color:#fff;border-radius:14px;padding:26px}
      .burden .cell .big{font-family:'Lora',serif;font-size:40px;line-height:1;color:var(--gold)}
      .burden .cell .lbl{margin-top:10px;font-size:14px;color:#d7e0ea}
      .burden .cell .src{margin-top:10px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#9fb2c7}

      .card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:26px}
      .center-narrow{max-width:520px;margin:0 auto}
      .verify-panel{background:#fff;border:1px solid var(--line);border-radius:16px;padding:26px;max-width:560px}
      .field{display:block;margin-bottom:14px}
      .field label{display:block;font-size:13px;font-weight:600;margin-bottom:6px}
      .field input,.field select{width:100%;padding:12px 13px;border:1px solid var(--line);border-radius:10px;font-size:15px;font-family:inherit;background:#fff}
      .field input:focus,.field select:focus{outline:2px solid var(--green);border-color:var(--green)}
      .result{margin-top:18px;border-radius:12px;padding:18px;border:1px solid var(--line)}
      .result.VALID{background:var(--green-pale);border-color:#bcdcbc}
      .result.EXPIRED,.result.REVOKED{background:#fdeeee;border-color:#f0c9c9}
      .badge{display:inline-block;font-weight:700;font-size:12px;letter-spacing:.06em;padding:4px 10px;border-radius:6px}
      .badge.VALID{background:var(--green);color:#fff}
      .badge.EXPIRED,.badge.REVOKED{background:#b3261e;color:#fff}

      .role-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin:22px 0}
      .role-card{text-align:left;background:#fff;border:1.5px solid var(--line);border-radius:14px;padding:18px;transition:.15s}
      .role-card:hover{border-color:var(--green);transform:translateY(-2px)}
      .role-card .code{width:38px;height:38px;border-radius:9px;background:var(--green-pale);color:var(--green);font-family:'Lora',serif;font-weight:700;display:grid;place-items:center;margin-bottom:12px}
      .role-card h4{margin:0 0 4px;font-size:16px}
      .role-card p{margin:0;font-size:13px;color:var(--muted)}

      .steps{display:flex;gap:6px;margin-bottom:22px;flex-wrap:wrap}
      .steps .s{flex:1;min-width:80px;height:5px;border-radius:100px;background:var(--line)}
      .steps .s.on{background:var(--green)}
      .steps .s.done{background:var(--gold)}
      .wizard-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:4px}
      .wizard-head .st{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}

      .lab-row{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1.5px solid var(--line);border-radius:12px;padding:14px 16px;margin-bottom:10px;background:#fff;width:100%;text-align:left}
      .lab-row:hover{border-color:var(--green)}
      .lab-row.on{border-color:var(--green);box-shadow:0 0 0 3px var(--green-pale)}
      .lab-row.off{opacity:.55}
      .lab-row .meta{font-size:12.5px;color:var(--muted)}
      .pill{font-size:11px;padding:2px 8px;border-radius:100px;font-weight:600}
      .pill.ok{background:var(--green-pale);color:var(--green)}
      .pill.no{background:#fdeeee;color:#b3261e}

      .split-tbl{width:100%;border-collapse:collapse;margin-top:8px;font-size:13.5px}
      .split-tbl td{padding:9px 6px;border-bottom:1px solid var(--line)}
      .split-tbl td:last-child{text-align:right;font-family:'Lora',serif}
      .split-tbl tr.tot td{font-weight:700;border-top:2px solid var(--ink);border-bottom:none;font-family:'Lora',serif}

      .note{font-size:13px;color:var(--muted);background:var(--gold-pale);border:1px solid #f2dcae;border-radius:10px;padding:12px 14px}
      .err{font-size:13.5px;color:#b3261e;background:#fdeeee;border:1px solid #f0c9c9;border-radius:10px;padding:11px 13px;margin-bottom:14px}
      .ok-banner{background:var(--green-pale);border:1px solid #bcdcbc;border-radius:14px;padding:22px}
      .cert{background:#fff;border:2px solid var(--green);border-radius:16px;padding:24px;text-align:center;max-width:420px;margin:16px auto 0}
      .cert .qwrap{display:grid;place-items:center;margin:14px 0}
      .muted{color:var(--muted)}
      .row-between{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
      .dash-hd{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:20px}
      .placeholder{border:1.5px dashed var(--line);border-radius:14px;padding:34px;text-align:center;color:var(--muted)}

      .tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:22px}
      .tile{background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px}
      .tile .v{font-family:'Lora',serif;font-size:24px;color:var(--navy)}
      .tile .k{font-size:12px;color:var(--muted);margin-top:4px}
      .modal-bg{position:fixed;inset:0;background:rgba(6,20,14,.5);display:grid;place-items:center;z-index:80;padding:20px}
      .modal{background:#fff;border-radius:16px;padding:24px;max-width:420px;width:100%}
      .toast{position:fixed;left:50%;top:74px;transform:translateX(-50%);background:var(--green);color:#fff;padding:11px 18px;border-radius:100px;font-size:13.5px;z-index:90;box-shadow:0 6px 20px rgba(0,0,0,.15)}
      .audit-tbl{width:100%;border-collapse:collapse;font-size:13px}
      .audit-tbl th,.audit-tbl td{text-align:left;padding:8px 6px;border-bottom:1px solid var(--line);vertical-align:top}
      .audit-tbl th{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:600}
      .ladder{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}
      .rung{font-size:11px;padding:3px 9px;border-radius:100px;border:1px solid var(--line);color:var(--muted)}
      .rung.on{background:#fdeeee;border-color:#f0c9c9;color:#b3261e;font-weight:700}
      .ord{border:1px solid var(--line);border-radius:12px;padding:16px;margin-bottom:12px;background:#fff}
      .ord .top{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
      .status{font-size:11px;font-weight:700;letter-spacing:.04em;padding:3px 9px;border-radius:100px;text-transform:uppercase}
      .status.Scheduled{background:var(--navy-pale);color:var(--navy)}
      .status.Sample,.status.Testing{background:var(--gold-pale);color:#8a5a00}
      .status.Submitted{background:var(--green-pale);color:var(--green)}
      .status.Flag{background:#fdeeee;color:#b3261e}
      .status.HELD{background:var(--gold-pale);color:#8a5a00}
      .status.RELEASED{background:var(--green-pale);color:var(--green)}
      .res-grid{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;margin:6px 0}

      .footer{background:var(--navy);color:#cdd8e4;padding:34px 0;font-size:13px}
      .footer .wrap{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap}
      .footer b{color:#fff;font-family:'Lora',serif}

      @media(max-width:860px){.hero{grid-template-columns:1fr}.hero-art{display:none}.pillars{grid-template-columns:repeat(2,1fr)}.burden{grid-template-columns:1fr}.tiles{grid-template-columns:repeat(2,1fr)}.feesgrid{grid-template-columns:1fr !important}}
      .hdr{transition:box-shadow .25s ease}
      .hdr.sc{box-shadow:0 6px 22px rgba(6,20,14,.07)}
      .brand{transition:opacity .15s}.brand:hover{opacity:.85}
      .navtab{position:relative;transition:color .18s,background .18s}
      .navtab:after{content:'';position:absolute;left:12px;right:12px;bottom:1px;height:2px;background:var(--green);border-radius:2px;transform:scaleX(0);transition:transform .22s ease}
      .navtab.on:after{transform:scaleX(1)}
      .actions{display:flex;align-items:center;gap:10px;margin-left:auto}
      .bar.app .actions{margin-left:0}
      .iconbtn{border:1px solid var(--line);background:#fff;border-radius:10px;height:38px;min-width:38px;padding:0 10px;display:inline-flex;align-items:center;gap:6px;justify-content:center;color:var(--ink);font-weight:700;font-size:12px;transition:.15s;position:relative}
      .iconbtn:hover{border-color:var(--green);color:var(--green)}
      .iconbtn .dot{position:absolute;top:7px;right:8px;width:7px;height:7px;border-radius:50%;background:var(--gold);border:1.5px solid #fff}
      .iconbtn.lang svg{opacity:.7}
      .wswrap{position:relative}
      .wsbtn{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line);background:#fff;border-radius:10px;height:38px;padding:0 11px;font-weight:700;font-size:12.5px;color:var(--navy);transition:.15s}
      .wsbtn:hover{border-color:var(--navy)}
      .wsbtn .chev{opacity:.55}
      .wsmenu{position:absolute;left:0;top:46px;width:256px;background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:0 12px 30px rgba(0,0,0,.12);z-index:60;overflow:hidden;animation:pop .16s ease}
      .wshead{padding:11px 14px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);font-weight:700;border-bottom:1px solid var(--line)}
      .wsitem{display:flex;align-items:center;gap:9px;width:100%;text-align:left;border:0;background:none;padding:10px 14px;font-size:13.5px;font-weight:600;color:var(--ink)}
      .wsitem:hover{background:var(--green-pale)}
      .wsitem.on{background:var(--green-pale);color:var(--green)}
      .wsitem .wsdot{width:8px;height:8px;border-radius:50%;background:var(--navy);flex:0 0 auto}
      .wsitem.on .wsdot{background:var(--green)}
      .avwrap{position:relative}
      .avatar{width:38px;height:38px;border-radius:50%;border:0;background:var(--navy);color:#fff;font-family:'Lora',serif;font-weight:700;font-size:14px;cursor:pointer;transition:.15s}
      .avatar:hover{filter:brightness(1.15)}
      .avmenu{position:absolute;right:0;top:46px;width:236px;background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:0 12px 30px rgba(0,0,0,.12);z-index:60;overflow:hidden;animation:pop .16s ease}
      .avhead{padding:14px;border-bottom:1px solid var(--line)}
      .avhead b{font-family:'Lora',serif;font-size:15px;display:block}
      .avhead small{color:var(--muted);font-size:12px}
      .avitem{display:block;width:100%;text-align:left;border:0;background:none;padding:11px 14px;font-size:14px;font-weight:600;color:var(--ink)}
      .avitem:hover{background:var(--green-pale)}
      .avitem.danger{color:#b3261e;border-top:1px solid var(--line)}
      @keyframes pop{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
      .page{animation:pageIn .34s cubic-bezier(.22,.61,.36,1)}
      @keyframes pageIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
      .btn{transition:.16s}
      .btn.p:hover{transform:translateY(-1px);box-shadow:0 6px 16px rgba(0,102,0,.18)}
      .btn.g:hover{transform:translateY(-1px)}
      .pillar{transition:transform .18s,box-shadow .18s,border-color .18s}
      .pillar:hover{transform:translateY(-4px);box-shadow:0 14px 30px rgba(6,20,14,.07);border-color:#cfe0cf}
      .tile{transition:transform .18s,box-shadow .18s}
      .tile:hover{transform:translateY(-2px);box-shadow:0 10px 24px rgba(6,20,14,.05)}
      .lab-row{transition:transform .14s,border-color .15s,box-shadow .15s}
      .lab-row:hover{transform:translateY(-1px)}
      .hero{position:relative}
      .hero:before{content:'';position:absolute;inset:-50px -30px auto auto;width:340px;height:340px;background:radial-gradient(circle at 70% 30%,rgba(251,174,64,.16),transparent 62%);pointer-events:none;z-index:0}
      .hero:after{content:'';position:absolute;left:-60px;bottom:-40px;width:260px;height:260px;background:radial-gradient(circle,rgba(0,102,0,.06),transparent 60%);pointer-events:none;z-index:0}
      .hero>*{position:relative;z-index:1}
      .hero-fine{margin-top:16px;font-size:12.5px;color:var(--muted);letter-spacing:.01em;opacity:.9}
      .chip{transition:transform .15s}.chip:hover{transform:translateY(-1px)}
      .wordmark b{font-size:20px}
      .consent{position:fixed;left:0;right:0;bottom:0;z-index:95;padding:14px;animation:slideUp .35s ease}
      @keyframes slideUp{from{transform:translateY(100%)}to{transform:none}}
      .consent-in{max-width:1000px;margin:0 auto;background:var(--navy);color:#e7eef6;border-radius:14px;padding:15px 18px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;box-shadow:0 14px 44px rgba(0,0,0,.28)}
      .consent-txt{font-size:13px;max-width:64ch;line-height:1.5}.consent-txt b{color:#fff}
      .consent-btns{display:flex;gap:10px}
      .consent .btn{background:transparent;color:#fff;border-color:rgba(255,255,255,.3)}
      .consent .btn.p{background:var(--gold);color:#3a2600;border-color:var(--gold)}
      .lnk{background:none;border:0;color:var(--gold);font-weight:700;cursor:pointer;padding:0;text-decoration:underline;font:inherit}
      .privacy{max-width:640px;max-height:82vh;overflow:auto}
      .privacy h4{margin:15px 0 3px;font-size:14.5px;font-family:'Lora',serif}
      .privacy p{margin:0 0 4px;font-size:13.5px}
      .foot-lnk{background:none;border:0;color:#cfe0cf;text-decoration:underline;cursor:pointer;padding:0;font:inherit}
      @media(max-width:900px){.wordmark small{display:none}}
      @media(prefers-reduced-motion:reduce){.pulse{animation:none}.role-card:hover{transform:none}.page{animation:none}.pillar:hover,.tile:hover,.lab-row:hover,.btn.p:hover,.btn.g:hover,.chip:hover{transform:none}.consent{animation:none}.avmenu{animation:none}}
    `}</style>
  )
}

/* ------------------------------------------------------------------ */
/*  Shared chrome                                                      */
/* ------------------------------------------------------------------ */

function GovBar() {
  return (
    <div className="govbar"><div className="wrap">
      <span><span className="dot" />Lagos State Government, Ministry of Health</span>
      <span>Official platform, secured</span>
    </div></div>
  )
}

function Header({ tabs, active, onTab, onBrand, session, onSignIn, onSignOut, lang, onLang, onPrivacy, admin, workspace, onSwitch }) {
  const [bell, setBell] = useState(false)
  const [menu, setMenu] = useState(false)
  const [ws, setWs] = useState(false)
  const [notices, setNotices] = useState([])
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => { const on = () => setScrolled(window.scrollY > 4); on(); window.addEventListener('scroll', on); return () => window.removeEventListener('scroll', on) }, [])
  useEffect(() => { if (session) store.listNotices(session).then(setNotices); else setNotices([]) }, [session, lang])
  async function toggleBell() { if (!bell) setNotices(await store.listNotices(session)); setBell(v => !v); setMenu(false) }
  const initials = (session && session.name ? session.name : '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <header className={'hdr' + (scrolled ? ' sc' : '')}>
      <div className="wrap"><div className={'bar' + (session ? ' app' : '')}>
        <button className="brand" onClick={onBrand}>
          <img className="crest" src="/lagos-logo.png" alt="Lagos State Government" />
          <span className="wordmark"><b>Safe<span>Plate</span></b><small>Lagos food handler safety</small></span>
        </button>
        <nav className="navtabs">
          {tabs.map(tb => (<button key={tb.id} className={'navtab ' + (active === tb.id ? 'on' : '')} onClick={() => onTab(tb.id)}>{tb.label}</button>))}
        </nav>
        <div className="actions">
          {admin && (
            <div className="wswrap">
              <button className="wsbtn" onClick={() => { setWs(v => !v); setMenu(false); setBell(false) }} aria-label="Switch workspace">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 2 7l10 5 10-5-10-5Z" /><path d="m2 17 10 5 10-5M2 12l10 5 10-5" /></svg>
                <span>{(WORKSPACES.find(w => w.id === workspace) || WORKSPACES[0]).short}</span>
                <svg className="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
              </button>
              {ws && (
                <div className="wsmenu" onMouseLeave={() => setWs(false)}>
                  <div className="wshead">Switch workspace</div>
                  {WORKSPACES.map(w => (
                    <button key={w.id} className={'wsitem ' + (w.id === workspace ? 'on' : '')} onClick={() => { onSwitch(w.id); setWs(false) }}><span className="wsdot" />{w.label}</button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button className="iconbtn lang" onClick={() => onLang(lang === 'en' ? 'yo' : 'en')} aria-label="Switch language">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20" /></svg>
            <span>{lang.toUpperCase()}</span>
          </button>
          {session ? (
            <>
              <div className="bellwrap">
                <button className="iconbtn" onClick={toggleBell} aria-label="Notifications">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                  {notices.length > 0 && <i className="dot" />}
                </button>
                {bell && (
                  <div className="bellpanel" onMouseLeave={() => setBell(false)}>
                    <div className="bellhead">Notifications</div>
                    {notices.length === 0 && <div className="bellrow muted">No notifications yet.</div>}
                    {notices.map((n, i) => (<div className="bellrow" key={i}><b>{n.title}</b><div className="muted">{n.body}</div><div className="bellts">{new Date(n.ts).toLocaleString('en-GB')}</div></div>))}
                  </div>
                )}
              </div>
              <div className="avwrap">
                <button className="avatar" onClick={() => { setMenu(v => !v); setBell(false) }} aria-label="Account">{initials}</button>
                {menu && (
                  <div className="avmenu" onMouseLeave={() => setMenu(false)}>
                    <div className="avhead"><b>{session.name}</b><small>{session.title}</small></div>
                    <button className="avitem" onClick={() => { setMenu(false); onPrivacy() }}>Privacy notice</button>
                    <button className="avitem danger" onClick={onSignOut}>{t('signout')}</button>
                  </div>
                )}
              </div>
            </>
          ) : <button className="btn p sm" onClick={onSignIn}>{t('signin')}</button>}
        </div>
      </div></div>
    </header>
  )
}

function Footer({ onPrivacy }) {
  return (
    <footer className="footer"><div className="wrap">
      <div><b>SafePlate</b><br />Operated by the Lagos State Ministry of Health.<br />Oversight: LSMoH, LASEPA, HEFAMAA. Escrow: Sterling Bank.</div>
      <div style={{ textAlign: 'right' }}>One Health strategy for food and water safety.<br />NAFDAC Food Hygiene Regulation 2019, NDPA 2023 and GDPR aligned.<br /><button className="foot-lnk" onClick={onPrivacy}>Privacy notice</button> &middot; {SUPABASE_READY ? 'Connected backend' : 'Preview mode'}</div>
    </div></footer>
  )
}

/* Shared 2FA guard used by regulator and Sterling actions */
function useGuard() {
  const [pending, setPending] = useState(null)
  const [otp, setOtp] = useState('')
  const [toast, setToast] = useState('')
  function guard(label, run) { setOtp(''); setPending({ label, run }) }
  async function confirm() {
    if (!otp6(otp)) return
    const p = pending; setPending(null)
    await p.run()
    setToast(p.label + ' completed and written to the audit trail.')
    setTimeout(() => setToast(''), 3500)
  }
  const modal = (
    <>
      {toast && <div className="toast">{toast}</div>}
      {pending && (
        <div className="modal-bg" onClick={() => setPending(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="kicker" style={{ color: 'var(--green)' }}>Two-factor confirmation</div>
            <h3 className="serif" style={{ fontSize: 19, margin: '8px 0 6px' }}>{pending.label}</h3>
            <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>Enter the 6-digit code sent to your registered phone to authorise this action.</p>
            <div className="field"><input value={otp} onChange={e => setOtp(e.target.value)} placeholder="6-digit code" maxLength={6} /></div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn block" onClick={() => setPending(null)}>Cancel</button>
              <button className="btn p block" onClick={confirm} disabled={!otp6(otp)}>Authorise</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
  return { guard, modal }
}

/* ------------------------------------------------------------------ */
/*  Public pages (Stage 1)                                             */
/* ------------------------------------------------------------------ */

function Overview({ onStart, onVerify }) {
  const certs = useCountUp(14892)
  const comp = useCountUp(89.4)
  return (
    <div className="page"><div className="wrap">
      <div className="hero">
        <div>
          <span className="eyebrow"><span className="pulse" />{t('hero_eyebrow')}</span>
          <h1 className="serif">{t('hero_title')}</h1>
          <p className="lede">{t('hero_lede')}</p>
          <div className="hero-cta">
            <button className="btn p" onClick={onStart}>{t('cta_register')}</button>
            <button className="btn g" onClick={onVerify}>{t('cta_verify')}</button>
          </div>
          <div className="ticker">
            <span className="chip"><span className="pulse" /><b>{Math.round(certs).toLocaleString('en-NG')}</b> {t('chip_active')}</span>
            <span className="chip"><b>{comp.toFixed(1)}%</b> {t('chip_compliance')}</span>
            <span className="chip">{t('chip_secure')}</span>
          </div>
          <p className="hero-fine">{t('hero_model')}</p>
        </div>
        <div className="hero-art"><img src="/lagos-logo.png" alt="Lagos State Government coat of arms" /></div>
      </div>
    </div></div>
  )
}

function SystemPage() {
  return (
    <div className="page"><div className="wrap">
      <div className="kicker">{t('sys_kicker')}</div>
      <h2 className="sec serif">{t('sys_title')}</h2>
      <p className="sub">SafePlate moves Lagos from fragmented, reactive checks to a preventive, data-driven model that pays for itself.</p>
      <div className="pillars">{PILLARS.map(p => (
        <div className="pillar" key={p.n}><div className="num">{p.n}</div><h3 className="serif">{p.title}</h3><p>{p.body}</p></div>
      ))}</div>
    </div></div>
  )
}

function ImpactPage() {
  return (
    <div className="page"><div className="wrap">
      <div className="kicker">{t('imp_kicker')}</div>
      <h2 className="sec serif">{t('imp_title')}</h2>
      <p className="sub">Health, economy and governance all point the same way: prevention beats episodic crackdowns.</p>
      <div className="burden">{BURDEN.map(b => (
        <div className="cell" key={b.label}><div className="big">{b.stat}</div><div className="lbl">{b.label}</div><div className="src">Source: {b.src}</div></div>
      ))}</div>
    </div></div>
  )
}

function VerifyWidget({ initialId }) {
  const [id, setId] = useState(initialId || '')
  const [result, setResult] = useState(undefined)
  const [loading, setLoading] = useState(false)
  useEffect(() => { if (initialId) run(initialId) /* eslint-disable-next-line */ }, [initialId])
  async function run(value) {
    const q = (value ?? id).trim()
    if (!q) return
    setLoading(true); setResult(await store.verifyCertificate(q) || null); setLoading(false)
    try { store.appendAudit({ actor: 'public', role: 'public', action: 'Certificate verified via portal', subject: q }) } catch { /* ignore */ }
  }
  return (
    <div className="verify-panel">
      <div className="field"><label htmlFor="q">{t('verify_label')}</label>
        <input id="q" value={id} onChange={e => setId(e.target.value)} placeholder="SP-LG-YYYYNNNNN" onKeyDown={e => e.key === 'Enter' && run()} /></div>
      <button className="btn p block" onClick={() => run()} disabled={loading}>{loading ? 'Checking...' : t('verify_btn')}</button>
      {result === null && (
        <div className="result EXPIRED" style={{ marginTop: 18 }}><span className="badge EXPIRED">NOT FOUND</span>
          <p style={{ margin: '10px 0 0' }}>{t('verify_notfound')}</p></div>
      )}
      {result && (
        <div className={'result ' + result.status}><span className={'badge ' + result.status}>{result.status}</span>
          <p style={{ margin: '12px 0 4px', fontFamily: 'Lora, serif', fontSize: 18 }}>{result.name}</p>
          <div className="muted" style={{ fontSize: 13.5 }}>
            <div>{result.safeplateId || result.safeplate_id}</div>
            <div>Panel: {result.panel}</div>
            <div>Laboratory: {result.lab}</div>
            <div>Expires: {new Date(result.expiry || result.expiry_date).toLocaleDateString('en-GB')}</div>
          </div>
          {result.status === 'VALID' && <button className="btn g block" style={{ marginTop: 14 }} onClick={() => generateCertPDF(result)}>Download certificate (PDF)</button>}
        </div>
      )}
    </div>
  )
}

function VerifyPage({ initialId }) {
  return (
    <div className="page"><div className="wrap">
      <div className="kicker">{t('verify_kicker')}</div>
      <h2 className="sec serif">{t('verify_title')}</h2>
      <p className="sub">{t('verify_sub')} Try SP-LG-2026004821 (valid), SP-LG-2025008114 (expired), SP-LG-2026001990 (revoked).</p>
      <VerifyWidget initialId={initialId} />
    </div></div>
  )
}

/* ------------------------------------------------------------------ */
/*  Auth (Stage 2)                                                     */
/* ------------------------------------------------------------------ */

function roleTitle(roleId, agency) {
  switch (roleId) {
    case 'food_handler': return 'Food Handler'
    case 'employer': return 'Establishment Manager'
    case 'laboratory': return 'Laboratory Officer'
    case 'regulator': return (agency || 'Regulator') + ' Officer'
    case 'sterling': return 'Sterling Bank Officer'
    default: return 'User'
  }
}

function AuthFlow({ onDone, onBack }) {
  const [role, setRole] = useState(null)
  const [agency, setAgency] = useState('LSMoH')
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [otpStage, setOtpStage] = useState(false)
  const [otpVal, setOtpVal] = useState('')
  const [pendingUser, setPendingUser] = useState(null)
  const needs2fa = role && ['regulator', 'sterling'].includes(role.id)

  async function verifyOtp() {
    setErr(''); setBusy(true)
    try { await store.fn('verify-otp', { code: otpVal }); onDone(pendingUser) }
    catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  async function submit() {
    setErr(''); setBusy(true)
    try {
      const meta = { role: role.id, agency: role.id === 'regulator' ? agency : null, name: name || email.split('@')[0], title: roleTitle(role.id, agency) }
      const user = mode === 'signup' ? await store.signUp(email, password, meta) : await store.signIn(email, password)
      const finalUser = { ...user, role: user.role || role.id, agency: user.agency || meta.agency, title: user.title || meta.title, name: user.name || meta.name }
      if (SUPABASE_READY && ['regulator', 'sterling'].includes(finalUser.role)) {
        await store.fn('send-otp', {}); setPendingUser(finalUser); setOtpStage(true); setBusy(false); return
      }
      onDone(finalUser)
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  if (otpStage) {
    return (
      <div className="page"><div className="wrap center-narrow">
        <div className="card">
          <div className="kicker" style={{ color: 'var(--green)' }}>Two-factor authentication</div>
          <h3 className="serif" style={{ fontSize: 22, margin: '6px 0 4px' }}>Enter your verification code</h3>
          <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>We sent a 6-digit code by SMS to the phone registered to this {pendingUser && pendingUser.title} account.</p>
          {err && <div className="err">{err}</div>}
          <div className="field"><input value={otpVal} onChange={e => setOtpVal(e.target.value)} placeholder="6-digit code" maxLength={6} /></div>
          <button className="btn p block" onClick={verifyOtp} disabled={busy || !/^[0-9]{6}$/.test(otpVal)}>{busy ? 'Verifying...' : 'Verify and continue'}</button>
          <button className="btn ghost block" style={{ marginTop: 8 }} onClick={() => { setOtpStage(false); setOtpVal('') }}>Cancel</button>
        </div>
      </div></div>
    )
  }

  if (!role) {
    return (
      <div className="page"><div className="wrap center-narrow">
        <button className="btn ghost" onClick={onBack} style={{ paddingLeft: 0, marginBottom: 12 }}>&larr; Back</button>
        <div className="kicker">Sign in</div>
        <h2 className="sec serif">Which best describes you?</h2>
        <p className="sub">Each role has its own portal and sees only its own data.</p>
        <div className="role-grid">{ROLES.map(r => (
          <button key={r.id} className="role-card" onClick={() => setRole(r)}><div className="code">{r.code}</div><h4 className="serif">{r.label}</h4><p>{r.tag}</p></button>
        ))}</div>
      </div></div>
    )
  }
  return (
    <div className="page"><div className="wrap center-narrow">
      <button className="btn ghost" onClick={() => setRole(null)} style={{ paddingLeft: 0, marginBottom: 12 }}>&larr; Change role</button>
      <div className="card">
        <div className="row-between" style={{ marginBottom: 6 }}>
          <div className="code" style={{ width: 38, height: 38, borderRadius: 9, background: 'var(--green-pale)', color: 'var(--green)', fontFamily: 'Lora,serif', fontWeight: 700, display: 'grid', placeItems: 'center' }}>{role.code}</div>
          <span className="muted" style={{ fontSize: 13 }}>{mode === 'signup' ? 'Create account' : 'Sign in'}</span>
        </div>
        <h3 className="serif" style={{ margin: '4px 0 2px', fontSize: 22 }}>{role.label}</h3>
        <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>{role.tag}</p>
        {err && <div className="err">{err}</div>}
        {role.id === 'regulator' && (
          <div className="field"><label>Agency</label><select value={agency} onChange={e => setAgency(e.target.value)}>{AGENCIES.map(a => <option key={a}>{a}</option>)}</select></div>
        )}
        {mode === 'signup' && <div className="field"><label>Full name</label><input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" /></div>}
        <div className="field"><label>Email or phone</label><input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></div>
        <div className="field"><label>Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" /></div>
        {needs2fa && <div className="note" style={{ marginBottom: 14 }}>This portal requires 2FA. In the connected build an OTP is sent to your registered phone on every sign-in and approval.</div>}
        <button className="btn p block" onClick={submit} disabled={busy || !email || !password}>{busy ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Continue to portal'}</button>
        <p className="muted" style={{ textAlign: 'center', fontSize: 13, marginTop: 14, marginBottom: 0 }}>
          {mode === 'signup' ? 'Already registered? ' : 'New here? '}
          <button className="btn ghost" style={{ padding: 0, color: 'var(--green)', fontWeight: 600 }} onClick={() => { setErr(''); setMode(mode === 'signup' ? 'signin' : 'signup') }}>{mode === 'signup' ? 'Sign in' : 'Create an account'}</button>
        </p>
      </div>
    </div></div>
  )
}

/* ------------------------------------------------------------------ */
/*  Stage 3: Food handler onboarding                                   */
/* ------------------------------------------------------------------ */

const STEP_LABELS = ['Register', 'Tests', 'Laboratory', 'Payment', 'Done']

function FoodHandlerModule({ session }) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({ name: session.name || '', phone: '', dob: '', gender: '', address: '', lga: '', nin: '', email: session.email || '', employer: '', employerAddress: '', photo: '', safeplateId: '', lab: null, paid: false })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const nextDue = useMemo(() => { const d = new Date(); d.setMonth(d.getMonth() + 6); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) }, [])

  async function register() {
    setErr('')
    if (!form.name.trim() || !form.phone.trim()) { setErr('Name and phone number are required to register.'); return }
    if (!form.dob || !form.gender || !form.lga) { setErr('Date of birth, gender and LGA are required.'); return }
    if (!/^0?\d{10,11}$/.test(form.phone.replace(/\s+/g, ''))) { setErr('Enter a valid Nigerian phone number.'); return }
    setBusy(true)
    try {
      if (await store.phoneExists(form.phone)) { setErr('An account already exists for this phone number. Recover it from the sign-in screen.'); setBusy(false); return }
      setF('safeplateId', makeSafeplateId()); setStep(1)
    } finally { setBusy(false) }
  }
  function chooseLab(lab) {
    if (!lab.accredited) { setErr('That laboratory is not currently accredited. Choose an accredited laboratory.'); return }
    setErr(''); setF('lab', lab); setStep(3)
  }
  async function pay() {
    setErr(''); setBusy(true)
    try {
      const escrowPayload = { safeplateId: form.safeplateId, name: form.name, lab: form.lab.name, amount: FEE, status: 'HELD', type: 'FOOD', ts: new Date().toISOString() }
      const { reference } = await payWithPaystack({ email: form.email, amountNaira: FEE, reference: 'SP-' + form.safeplateId })
      if (PAYSTACK_READY) { const v = await fetch('/api/paystack-verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reference, safeplateId: form.safeplateId, escrow: escrowPayload }) }); if (!v.ok) throw new Error('Payment verification failed') }
      const now = Date.now(), day = 86400000
      const certificate = { safeplateId: form.safeplateId, name: form.name, panel: MANDATORY_TESTS.join(', '), lab: form.lab.name, issued: null, expiry: new Date(now + 182 * day).toISOString(), status: 'PENDING_RESULTS' }
      await store.saveHandler({ safeplateId: form.safeplateId, name: form.name, phone: form.phone, dob: form.dob, gender: form.gender, address: form.address, lga: form.lga, nin: form.nin, email: form.email, employer: form.employer, employerAddress: form.employerAddress, photo: form.photo, lab: form.lab.name, tests: MANDATORY_TESTS, fee: FEE, waterfall: WATERFALL, paid: true, certificate, createdAt: new Date().toISOString() })
      await store.createOrder({ id: 'ORD-' + form.safeplateId.replace('SP-LG-', ''), safeplateId: form.safeplateId, handlerName: form.name, phone: form.phone, lab: form.lab.name, tests: MANDATORY_TESTS, status: 'Scheduled', createdAt: new Date().toISOString() })
      if (!SUPABASE_READY) await store.createEscrow(escrowPayload)
      await store.notify('laboratory', 'New test order', form.name + ' booked ' + form.lab.name)
      await store.notify(session.email, 'Payment received', naira(FEE) + ' held in escrow for your test')
      await store.dispatch(form.phone, 'sms', 'SafePlate: your ' + naira(FEE) + ' test payment is confirmed. ID ' + form.safeplateId)
      setF('paid', true); setStep(4)
    } catch (e) { setErr('Payment could not be completed. Your test order is saved for 48 hours, try again.') } finally { setBusy(false) }
  }

  return (
    <div className="page"><div className="wrap">
      <div className="greeting"><h2 className="sec serif" style={{ margin: 0 }}>{t('fh_title')}</h2><span className="muted" style={{ fontSize: 13 }}>{session.title}</span></div>
      <div className="steps">{STEP_LABELS.map((l, i) => <div key={l} className={'s ' + (i === step ? 'on' : '') + (i < step ? ' done' : '')} title={l} />)}</div>
      {err && <div className="err">{err}</div>}

      {step === 0 && (
        <div className="card">
          <div className="wizard-head"><h3 className="serif" style={{ margin: 0, fontSize: 21 }}>{t('fh_s1')}</h3><span className="st">Step 1 of 4</span></div>
          <p className="muted" style={{ marginTop: 4 }}>Your details are verified and you receive a unique, traceable ID.</p>
          <div className="field"><label>{t('lbl_fullname')}</label><input value={form.name} onChange={e => setF('name', e.target.value)} placeholder="First and last name" /></div>
          <div className="field"><label>{t('lbl_phone')}</label><input value={form.phone} onChange={e => setF('phone', e.target.value)} placeholder="080..." /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field"><label>Date of birth</label><input type="date" value={form.dob} onChange={e => setF('dob', e.target.value)} /></div>
            <div className="field"><label>Gender</label><select value={form.gender} onChange={e => setF('gender', e.target.value)}><option value="">Select...</option><option>Female</option><option>Male</option><option>Prefer not to say</option></select></div>
          </div>
          <div className="field"><label>Home address</label><input value={form.address} onChange={e => setF('address', e.target.value)} placeholder="Street and area" /></div>
          <div className="field"><label>LGA</label><select value={form.lga} onChange={e => setF('lga', e.target.value)}><option value="">Select your LGA...</option>{LAGOS_LGAS.map(l => <option key={l}>{l}</option>)}</select></div>
          <div className="field"><label>{t('lbl_nin')}</label><input value={form.nin} onChange={e => setF('nin', e.target.value)} placeholder="11-digit NIN" /></div>
          <div className="field"><label>{t('lbl_email')}</label><input value={form.email} onChange={e => setF('email', e.target.value)} placeholder="you@example.com" /></div>
          <div className="field"><label>{t('lbl_employer')}</label><input value={form.employer} onChange={e => setF('employer', e.target.value)} placeholder="Restaurant, hotel or company" /></div>
          <div className="field"><label>Employer address (optional)</label><input value={form.employerAddress} onChange={e => setF('employerAddress', e.target.value)} placeholder="Where you work" /></div>
          <div className="field"><label>Passport photo (optional)</label><input type="file" accept="image/*" onChange={async e => { const f = e.target.files && e.target.files[0]; if (f) { try { setF('photo', await compressImage(f)) } catch { /* ignore */ } } }} />{form.photo && <img src={form.photo} alt="preview" style={{ marginTop: 8, width: 72, height: 72, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--line)' }} />}</div>
          <button className="btn p block" onClick={register} disabled={busy}>{busy ? 'Checking...' : t('btn_create_id')}</button>
        </div>
      )}
      {step === 1 && (
        <div className="card">
          <div className="wizard-head"><h3 className="serif" style={{ margin: 0, fontSize: 21 }}>{t('fh_s2')}</h3><span className="st">Step 2 of 4</span></div>
          <div className="note" style={{ marginTop: 6, marginBottom: 16 }}>{tr('fh_id_assigned')} <b>{form.safeplateId}</b>. Keep it, it identifies you across every test cycle.</div>
          {MANDATORY_TESTS.map(t => <div key={t} className="lab-row on" style={{ cursor: 'default' }}><span>{t}</span><span className="pill ok">{tr('fh_mandatory')}</span></div>)}
          <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>Next testing window will be set for <b>{nextDue}</b>. Reminders go out 14 and 2 days before.</p>
          <button className="btn p block" onClick={() => setStep(2)}>{t('btn_choose_lab')}</button>
        </div>
      )}
      {step === 2 && (
        <div className="card">
          <div className="wizard-head"><h3 className="serif" style={{ margin: 0, fontSize: 21 }}>{t('fh_s3')}</h3><span className="st">Step 3 of 4</span></div>
          <p className="muted" style={{ marginTop: 4 }}>Accreditation is checked in real time. Unaccredited labs cannot take your order.</p>
          {labsView().map(l => (
            <button key={l.id} className={'lab-row ' + (l.accredited ? '' : 'off')} onClick={() => chooseLab(l)}>
              <span><b style={{ fontFamily: 'Lora,serif' }}>{l.name}</b><div className="meta">{l.area} · results in {l.turnaround}{l.mobile ? ' · mobile collection' : ''}</div></span>
              <span className={'pill ' + (l.accredited ? 'ok' : 'no')}>{l.accredited ? 'Accredited' : 'Not accredited'}</span>
            </button>
          ))}
        </div>
      )}
      {step === 3 && (
        <div className="card">
          <div className="wizard-head"><h3 className="serif" style={{ margin: 0, fontSize: 21 }}>{t('fh_s4')}</h3><span className="st">Step 4 of 4</span></div>
          <p className="muted" style={{ marginTop: 4 }}>Your {naira(FEE)} is held in Sterling Bank escrow and released only after the Ministry approves your results. Payment is by Paystack.</p>
          <table className="split-tbl"><tbody>
            <tr><td colSpan={2} style={{ fontWeight: 700 }}>Laboratory: {form.lab?.name}</td></tr>
            {WATERFALL.map(w => <tr key={w.who}><td>{w.who} <span className="muted">({w.pct}%)</span></td><td>{naira(w.amount)}</td></tr>)}
            <tr className="tot"><td>Total fee</td><td>{naira(FEE)}</td></tr>
          </tbody></table>
          <button className="btn p block" style={{ marginTop: 18 }} onClick={pay} disabled={busy}>{busy ? 'Processing with Paystack...' : 'Pay ' + naira(FEE) + ' into escrow'}</button>
        </div>
      )}
      {step === 4 && (
        <div className="ok-banner">
          <div className="kicker" style={{ color: 'var(--green)' }}>Escrow funded</div>
          <h3 className="serif" style={{ fontSize: 22, margin: '8px 0' }}>{tr('fh_done')}</h3>
          <p className="muted" style={{ marginTop: 0 }}>The laboratory has been notified. After your sample is tested and the Ministry approves the result, your Certificate of Fitness is issued and becomes publicly verifiable by the QR below.</p>
          <div className="cert">
            <div className="kicker" style={{ color: 'var(--green)' }}>SafePlate certificate</div>
            <h4 className="serif" style={{ fontSize: 20, margin: '6px 0 2px' }}>{form.name}</h4>
            <div className="muted" style={{ fontSize: 13.5 }}>{form.safeplateId}</div>
            <div className="qwrap"><QRCodeSVG value={window.location.origin + '/#/verify/' + form.safeplateId} size={128} fgColor={PALETTE.navy} level="M" /></div>
            <div className="muted" style={{ fontSize: 12.5 }}>Status once approved: valid for 6 months</div>
          </div>
        </div>
      )}
    </div></div>
  )
}

/* ------------------------------------------------------------------ */
/*  Stage 4: Laboratory portal                                         */
/* ------------------------------------------------------------------ */

function LaboratoryModule({ session }) {
  const accreditedLabs = labsView().filter(l => l.accredited)
  const [labName, setLabName] = useState(accreditedLabs[0].name)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const lab = accreditedLabs.find(l => l.name === labName)
  async function refresh() { setLoading(true); setOrders(await store.listOrders(labName)); setLoading(false) }
  useEffect(() => { refresh() /* eslint-disable-next-line */ }, [labName])
  async function advance(o, status) { await store.updateOrder(o.id, { status }); refresh() }

  return (
    <div className="page"><div className="wrap">
      <div className="greeting"><h2 className="sec serif" style={{ margin: 0 }}>Laboratory queue</h2><span className="muted" style={{ fontSize: 13 }}>{session.name}</span></div>
      <div className="row-between" style={{ marginBottom: 16 }}>
        <span className="muted" style={{ fontSize: 13 }}>Viewing queue for:</span>
        <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select value={labName} onChange={e => setLabName(e.target.value)} style={{ padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 9, fontFamily: 'inherit', fontSize: 14 }}>{accreditedLabs.map(l => <option key={l.id}>{l.name}</option>)}</select>
          <span className="muted" style={{ fontSize: 12.5 }}>Accreditation {lab.accNo}</span>
        </span>
      </div>
      <div className="note" style={{ marginBottom: 18 }}>You see only this laboratory's orders. Results are encrypted at rest (AES-256) in the connected build, and payment is released only after Ministry approval, not on upload.</div>
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
        <div><b style={{ fontFamily: 'Lora,serif', fontSize: 16 }}>{order.handlerName}</b><div className="muted" style={{ fontSize: 12.5 }}>{order.safeplateId} · {order.id}</div></div>
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

/* ------------------------------------------------------------------ */
/*  Stage 5: Regulator portals                                         */
/* ------------------------------------------------------------------ */

function RegulatorModule({ session, tab }) {
  const agency = session.agency || 'LSMoH'
  const { guard, modal } = useGuard()
  async function audit(action, subject) { await store.appendAudit({ actor: session.name, role: agency, action, subject }) }
  return (
    <div className="page"><div className="wrap">
      <div className="greeting"><h2 className="sec serif" style={{ margin: 0 }}>{agency} portal</h2><span className="muted" style={{ fontSize: 13 }}>{session.name}</span></div>
      <div className="tiles">{METRICS.map(m => <div className="tile" key={m.k}><div className="v">{m.v}</div><div className="k">{m.k}</div></div>)}</div>
      {tab === 'review' && <LSMoHReview session={session} guard={guard} audit={audit} />}
      {tab === 'certificates' && <CertAdmin guard={guard} audit={audit} />}
      {tab === 'enforcement' && <Enforcement guard={guard} audit={audit} />}
      {tab === 'accreditation' && <Accreditation guard={guard} audit={audit} />}
      {tab === 'water' && <WaterReview session={session} guard={guard} audit={audit} />}
      {tab === 'analytics' && <Analytics />}
      {tab === 'audit' && <AuditPanel />}
      {modal}
    </div></div>
  )
}

function LSMoHReview({ session, guard, audit }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  async function refresh() { setLoading(true); const all = await store.listAllOrders(); setOrders(all.filter(o => o.status === 'Submitted')); setLoading(false) }
  useEffect(() => { refresh() }, [])
  async function approve(o) {
    if (SUPABASE_READY) { await store.fn('approve-result', { orderId: o.id, decision: 'approve' }); refresh(); return }
    const anyRefer = o.results && o.tests.some(t => o.results[t] === 'refer')
    if (anyRefer) { await store.updateOrder(o.id, { status: 'Rejected' }); await audit('Result rejected, referral pathway triggered, escrow held', o.safeplateId) }
    else {
      const now = Date.now(), day = 86400000
      await store.issueCertificate({ safeplateId: o.safeplateId, name: o.handlerName, panel: o.tests.join(', '), lab: o.lab, issued: new Date(now).toISOString(), expiry: new Date(now + 182 * day).toISOString(), status: 'VALID' })
      await store.createRelease({ safeplateId: o.safeplateId, name: o.handlerName, lab: o.lab, amount: FEE, status: 'Instructed', approvedBy: session.name, ts: new Date().toISOString() })
      await store.updateOrder(o.id, { status: 'Approved' })
      await audit('Approved, certificate issued, escrow release instructed to Sterling Bank', o.safeplateId)
      await store.notify('sterling', 'Escrow release instructed', o.safeplateId)
      await store.notify('all', 'Certificate issued', o.handlerName + ' is now certified')
      await store.dispatch(o.phone, 'sms', 'SafePlate: your Certificate of Fitness is issued. Verify at ' + o.safeplateId)
    }
    refresh()
  }
  async function flag(o) { if (SUPABASE_READY) { await store.fn('approve-result', { orderId: o.id, decision: 'flag' }); refresh(); return } await store.updateOrder(o.id, { status: 'Flagged' }); await audit('Flagged for further review, escrow held', o.safeplateId); refresh() }
  const shown = orders.filter(o => { const q = search.trim().toLowerCase(); return !q || (o.safeplateId || '').toLowerCase().includes(q) || (o.handlerName || '').toLowerCase().includes(q) })

  return (
    <div>
      <div className="field" style={{ maxWidth: 360 }}><label>Search this queue by SAFEPLATE ID or name</label><input value={search} onChange={e => setSearch(e.target.value)} placeholder="SP-LG-... or name" /></div>
      {loading && <p className="muted">Loading results awaiting review...</p>}
      {!loading && shown.length === 0 && <div className="placeholder">No results are awaiting Ministry review. Submitted laboratory results appear here.</div>}
      {!loading && shown.map(o => (
        <div className="ord" key={o.id}>
          <div className="top"><div><b style={{ fontFamily: 'Lora,serif', fontSize: 16 }}>{o.handlerName}</b><div className="muted" style={{ fontSize: 12.5 }}>{o.safeplateId} · {o.lab}</div></div>
            <span className={'status ' + (slaExceeded(o) ? 'Flag' : 'Submitted')}>{slaExceeded(o) ? 'SLA exceeded, escalated' : 'Within 48h SLA'}</span></div>
          <table className="split-tbl" style={{ marginTop: 8 }}><tbody>{o.tests.map(t => (
            <tr key={t}><td>{t}</td><td style={{ textAlign: 'right', fontWeight: 600, color: o.results && o.results[t] === 'refer' ? '#b3261e' : 'var(--green)' }}>{o.results && o.results[t] === 'refer' ? 'Refer' : 'Pass'}</td></tr>
          ))}</tbody></table>
          <div className="row-between" style={{ marginTop: 12 }}>
            <button className="btn p sm" onClick={() => guard('Approve results for ' + o.safeplateId, () => approve(o))}>Approve</button>
            <button className="btn sm danger" onClick={() => guard('Flag ' + o.safeplateId + ' for review', () => flag(o))}>Flag for review</button>
          </div>
        </div>
      ))}
    </div>
  )
}

function CertAdmin({ guard, audit }) {
  const [id, setId] = useState('')
  const [cert, setCert] = useState(undefined)
  const [busy, setBusy] = useState(false)
  async function find() { setBusy(true); setCert(await store.verifyCertificate(id) || null); setBusy(false) }
  async function revoke(c) { const cid = c.safeplateId || c.safeplate_id; if (SUPABASE_READY) { await store.fn('revoke-certificate', { safeplateId: cid }); setCert(await store.verifyCertificate(cid)); return } await store.revokeCertificate(cid); await audit('Certificate revoked', cid); setCert(await store.verifyCertificate(cid)) }
  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>Search any record by SAFEPLATE ID, then revoke a certificate if compliance requires it.</p>
      <div className="field" style={{ maxWidth: 360 }}><label>SAFEPLATE ID</label><input value={id} onChange={e => setId(e.target.value)} placeholder="SP-LG-YYYYNNNNN" onKeyDown={e => e.key === 'Enter' && find()} /></div>
      <button className="btn p sm" onClick={find} disabled={busy}>{busy ? 'Searching...' : 'Find record'}</button>
      {cert === null && <div className="err" style={{ marginTop: 14 }}>No certificate found for that ID.</div>}
      {cert && (
        <div className="ord" style={{ marginTop: 16 }}>
          <div className="top"><div><b style={{ fontFamily: 'Lora,serif', fontSize: 16 }}>{cert.name}</b><div className="muted" style={{ fontSize: 12.5 }}>{cert.safeplateId || cert.safeplate_id} · {cert.lab}</div></div><span className={'badge ' + cert.status}>{cert.status}</span></div>
          <div className="muted" style={{ fontSize: 13.5, marginTop: 8 }}>Panel: {cert.panel} · Expires {new Date(cert.expiry || cert.expiry_date).toLocaleDateString('en-GB')}</div>
          {cert.status === 'VALID' && (
            <div className="row-between" style={{ marginTop: 12 }}>
              <button className="btn sm" onClick={() => generateCertPDF(cert)}>Download certificate (PDF)</button>
              <button className="btn sm danger" onClick={() => guard('Revoke certificate ' + (cert.safeplateId || cert.safeplate_id), () => revoke(cert))}>Revoke certificate</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Enforcement({ guard, audit }) {
  const [ests, setEsts] = useState([])
  async function refresh() { setEsts(await store.listEstablishments()) }
  useEffect(() => { refresh() }, [])
  async function escalate(e) { const idx = e.sanction ? SANCTION_LADDER.indexOf(e.sanction) : -1; const next = SANCTION_LADDER[Math.min(idx + 1, SANCTION_LADDER.length - 1)]; await store.updateEstablishment(e.id, { sanction: next, appeal: null }); await audit('Sanction escalated to ' + next, e.name); refresh() }
  async function appeal(e) { await store.updateEstablishment(e.id, { appeal: 'Under review' }); await audit('Appeal lodged and under review', e.name); refresh() }
  return (
    <div>
      <div className="note" style={{ marginBottom: 16 }}>Enforcement is an escalating ladder with an appeals pathway. The aim is compliance as the outcome, not fines as the output.</div>
      {ests.map(e => (
        <div className="ord" key={e.id}>
          <div className="top"><div><b style={{ fontFamily: 'Lora,serif', fontSize: 16 }}>{e.name}</b><div className="muted" style={{ fontSize: 12.5 }}>{e.lga} · {e.compliance}</div></div>{e.appeal && <span className="status Sample">Appeal {e.appeal}</span>}</div>
          <div className="ladder">{SANCTION_LADDER.map(r => <span key={r} className={'rung ' + (e.sanction === r ? 'on' : '')}>{r}</span>)}</div>
          <div className="row-between"><button className="btn sm danger" onClick={() => guard('Escalate sanction for ' + e.name, () => escalate(e))}>Escalate sanction</button><button className="btn sm" onClick={() => guard('Lodge appeal for ' + e.name, () => appeal(e))}>Lodge appeal</button></div>
        </div>
      ))}
    </div>
  )
}

function Accreditation({ guard, audit }) {
  const [labs, setLabs] = useState(labsView())
  async function toggle(l) { await store.setLabAccredited(l.id, !l.accredited); await audit((l.accredited ? 'Accreditation suspended for ' : 'Accreditation granted for ') + l.name, l.name); setLabs(labsView()) }
  async function qa(l) { await audit('QA audit recorded', l.name) }
  return (
    <div>
      <div className="note" style={{ marginBottom: 16 }}>HEFAMAA accredits laboratories and records QA audits. Suspending accreditation removes a lab from the food handler booking list immediately.</div>
      {labs.map(l => (
        <div className="ord" key={l.id}>
          <div className="top"><div><b style={{ fontFamily: 'Lora,serif', fontSize: 16 }}>{l.name}</b><div className="muted" style={{ fontSize: 12.5 }}>{l.area} · {l.accNo || 'no accreditation number'}</div></div><span className={'pill ' + (l.accredited ? 'ok' : 'no')}>{l.accredited ? 'Accredited' : 'Not accredited'}</span></div>
          <div className="row-between" style={{ marginTop: 12 }}>
            <button className="btn sm" onClick={() => guard('Record QA audit for ' + l.name, () => qa(l))}>Record QA audit</button>
            <button className={'btn sm ' + (l.accredited ? 'danger' : 'p')} onClick={() => guard((l.accredited ? 'Suspend accreditation for ' : 'Grant accreditation to ') + l.name, () => toggle(l))}>{l.accredited ? 'Suspend accreditation' : 'Grant accreditation'}</button>
          </div>
        </div>
      ))}
    </div>
  )
}

function AuditPanel() {
  const [rows, setRows] = useState([])
  useEffect(() => { store.listAudit().then(setRows) }, [])
  function exportTxt() {
    const header = 'timestamp\trole\tactor\taction\tsubject\tip'
    const body = rows.map(r => [r.ts, r.role, r.actor, r.action, r.subject || '', r.ip].join('\t'))
    const blob = new Blob([[header].concat(body).join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'safeplate-audit-trail.txt'; a.click(); URL.revokeObjectURL(url)
  }
  return (
    <div>
      <div className="row-between" style={{ marginBottom: 12 }}><div className="note" style={{ margin: 0 }}>Append-only. Entries cannot be edited or deleted. Actor, role, IP and timestamp are captured on every action.</div><button className="btn sm" onClick={exportTxt} disabled={!rows.length}>Export tamper-evident report</button></div>
      {rows.length === 0 && <div className="placeholder">No audit entries yet. Approvals, releases, enforcement and accreditation actions are logged here.</div>}
      {rows.length > 0 && (
        <div style={{ overflowX: 'auto' }}><table className="audit-tbl">
          <thead><tr><th>When</th><th>Actor</th><th>Role</th><th>Action</th><th>Subject</th></tr></thead>
          <tbody>{rows.map((r, i) => (<tr key={i}><td className="muted">{new Date(r.ts).toLocaleString('en-GB')}</td><td>{r.actor}</td><td>{r.role}</td><td>{r.action}</td><td className="muted">{r.subject || ''}</td></tr>))}</tbody>
        </table></div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Stage 6: Sterling Bank escrow ledger                               */
/* ------------------------------------------------------------------ */

function SterlingModule({ session, tab }) {
  const { guard, modal } = useGuard()
  const [escrow, setEscrow] = useState([])
  const [releases, setReleases] = useState([])
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
    if (SUPABASE_READY) { await store.fn('release-escrow', { safeplateId: e.safeplateId }); refresh(); return }
    await store.releaseEscrow(e.safeplateId, session.name)
    await store.appendAudit({ actor: session.name, role: 'Sterling Bank', action: 'Escrow released, full waterfall disbursed', subject: e.safeplateId })
    await store.notify('laboratory', 'Payment released', e.safeplateId + ', ' + naira(e.amount))
    refresh()
  }

  return (
    <div className="page"><div className="wrap">
      <div className="greeting"><h2 className="sec serif" style={{ margin: 0 }}>Sterling Bank escrow</h2><span className="muted" style={{ fontSize: 13 }}>{session.name}</span></div>
      <div className="tiles">{tiles.map(t => <div className="tile" key={t.k}><div className="v">{t.v}</div><div className="k">{t.k}</div></div>)}</div>
      <div className="note" style={{ marginBottom: 18 }}>Sterling Bank never sees test results or medical data. Releases happen only after Ministry approval, and disburse the full waterfall atomically, all legs or none.</div>

      {tab === 'ledger' && (
        <div style={{ overflowX: 'auto' }}><table className="audit-tbl">
          <thead><tr><th>SAFEPLATE ID</th><th>Name</th><th>Laboratory</th><th>Type</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>{escrow.map(e => (<tr key={e.safeplateId}><td>{e.safeplateId}</td><td>{e.name}</td><td>{e.lab}</td><td>{e.type === 'WATER' ? 'Water' : 'Food handler'}</td><td>{naira(e.amount)}</td><td><span className={'status ' + e.status}>{e.status}</span></td></tr>))}</tbody>
        </table></div>
      )}

      {tab === 'releases' && (
        <div>
          {pending.length === 0 && <div className="placeholder">No approved releases are pending. When the Ministry approves a result, the instruction appears here to execute.</div>}
          {pending.map(e => (
            <div className="ord" key={e.safeplateId}>
              <div className="top"><div><b style={{ fontFamily: 'Lora,serif', fontSize: 16 }}>{e.name}</b><div className="muted" style={{ fontSize: 12.5 }}>{e.safeplateId} · {e.lab}</div></div><span className="status HELD">Approved, pending release</span></div>
              <table className="split-tbl"><tbody>{WATERFALL.map(w => <tr key={w.who}><td>{w.who} <span className="muted">({w.pct}%)</span></td><td>{naira(w.amount)}</td></tr>)}<tr className="tot"><td>Total to disburse</td><td>{naira(FEE)}</td></tr></tbody></table>
              <button className="btn p sm" style={{ marginTop: 12 }} onClick={() => guard('Release escrow for ' + e.safeplateId, () => release(e))}>Release full waterfall</button>
            </div>
          ))}
          {released.length > 0 && (<><h3 className="serif" style={{ fontSize: 17, marginTop: 24 }}>Recently released</h3>{released.map(e => (<div className="ord" key={e.safeplateId}><div className="top"><div><b style={{ fontFamily: 'Lora,serif', fontSize: 15 }}>{e.name}</b><div className="muted" style={{ fontSize: 12.5 }}>{e.safeplateId} · {naira(e.amount)}</div></div><span className="status RELEASED">Released</span></div></div>))}</>)}
        </div>
      )}

      {tab === 'fund' && (
        <div>
          <div className="note" style={{ marginBottom: 16 }}>The 10% oversight line (formerly the COVID-19 Dedicated Fund, now the State Regulatory Fund) is remitted as {naira(FUND_PER_TXN)} on every released transaction.</div>
          <div className="ord"><div className="row-between"><b style={{ fontFamily: 'Lora,serif', fontSize: 18 }}>Total remitted to date</b><span style={{ fontFamily: 'Lora,serif', fontSize: 22, color: 'var(--navy)' }}>{naira(fundRemitted)}</span></div><div className="muted" style={{ fontSize: 13, marginTop: 6 }}>Across {released.length} released transaction{released.length === 1 ? '' : 's'}. Food handler remits {naira(FUND_PER_TXN)}, water remits {naira(WATER_FUND)}.</div></div>
        </div>
      )}

      {tab === 'reconcile' && <Reconcile escrow={escrow} />}
      {modal}
    </div></div>
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

/* ------------------------------------------------------------------ */
/*  Stage 8: Employer portal and potable water module                  */
/* ------------------------------------------------------------------ */

function EmployerModule({ session, tab }) {
  if (tab === 'water') return <EmployerWater session={session} />
  return <EmployerTeam session={session} />
}

const STAFF_STATUSES = { 'Certified': 'ok', 'Pending results': 'no', 'Overdue': 'no', 'Not registered': 'no' }

function EmployerTeam({ session }) {
  const [biz, setBiz] = useState(undefined)
  const [name, setName] = useState('')
  const [lga, setLga] = useState('')
  const [sName, setSName] = useState('')
  const [sPhone, setSPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function load() { setBiz(await store.getBusiness(session.email) || null) }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [])

  async function create() {
    if (!name.trim()) return
    const b = { name: name.trim(), lga: lga.trim(), staff: [] }
    await store.saveBusiness(session.email, b); setBiz(b)
  }
  async function addStaff() {
    if (!sName.trim() || !sPhone.trim()) return
    const b = { ...biz, staff: [...biz.staff, { id: 'S' + Date.now(), name: sName.trim(), phone: sPhone.trim(), status: 'Not registered' }] }
    await store.saveBusiness(session.email, b); setBiz(b); setSName(''); setSPhone('')
  }
  async function bulkPay() {
    setBusy(true); setMsg('')
    const pending = biz.staff.filter(x => x.status === 'Not registered')
    for (const x of pending) {
      const id = makeSafeplateId()
      await store.createOrder({ id: 'ORD-' + id.replace('SP-LG-', ''), safeplateId: id, handlerName: x.name, phone: x.phone, lab: 'Lancet Ikeja', tests: MANDATORY_TESTS, status: 'Scheduled', createdAt: new Date().toISOString() })
      await store.createEscrow({ safeplateId: id, name: x.name, lab: 'Lancet Ikeja', amount: FEE, status: 'HELD', type: 'FOOD', ts: new Date().toISOString() })
      x.safeplateId = id; x.status = 'Pending results'
    }
    const b = { ...biz }; await store.saveBusiness(session.email, b); setBiz(b)
    setMsg('Registered and paid for ' + pending.length + ' staff, ' + naira(pending.length * FEE) + ' into escrow.')
    setBusy(false)
  }

  if (biz === undefined) return <div className="page"><div className="wrap"><p className="muted">Loading...</p></div></div>

  if (biz === null) {
    return (
      <div className="page"><div className="wrap center-narrow">
        <div className="kicker">Employer</div>
        <h2 className="sec serif">Register your establishment</h2>
        <p className="sub">Set up your business once, then add and manage your team's compliance.</p>
        <div className="card">
          <div className="field"><label>Business name</label><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Grill House" /></div>
          <div className="field"><label>LGA</label><input value={lga} onChange={e => setLga(e.target.value)} placeholder="e.g. Lekki" /></div>
          <button className="btn p block" onClick={create} disabled={!name.trim()}>Create establishment</button>
        </div>
      </div></div>
    )
  }

  const counts = biz.staff.reduce((a, s) => { a[s.status] = (a[s.status] || 0) + 1; return a }, {})
  const pendingCount = biz.staff.filter(s => s.status === 'Not registered').length

  return (
    <div className="page"><div className="wrap">
      <div className="greeting"><h2 className="sec serif" style={{ margin: 0 }}>{biz.name}</h2><span className="muted" style={{ fontSize: 13 }}>{biz.lga} · {session.name}</span></div>
      <div className="tiles">
        <div className="tile"><div className="v">{biz.staff.length}</div><div className="k">Team size</div></div>
        <div className="tile"><div className="v">{counts['Certified'] || 0}</div><div className="k">Certified</div></div>
        <div className="tile"><div className="v">{counts['Pending results'] || 0}</div><div className="k">Pending</div></div>
        <div className="tile"><div className="v">{(counts['Overdue'] || 0) + (counts['Not registered'] || 0)}</div><div className="k">Action needed</div></div>
      </div>
      <div className="note" style={{ marginBottom: 18 }}>You see each member's compliance status only, never their medical results. A compliance digest is emailed weekly.</div>

      {msg && <div className="note" style={{ background: 'var(--green-pale)', borderColor: '#bcdcbc', marginBottom: 16 }}>{msg}</div>}

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 className="serif" style={{ margin: '0 0 12px', fontSize: 18 }}>Add a team member</h3>
        <div className="row-between" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 1, marginBottom: 0, minWidth: 160 }}><label>Name</label><input value={sName} onChange={e => setSName(e.target.value)} placeholder="Full name" /></div>
          <div className="field" style={{ flex: 1, marginBottom: 0, minWidth: 140 }}><label>Phone</label><input value={sPhone} onChange={e => setSPhone(e.target.value)} placeholder="080..." /></div>
          <button className="btn sm" onClick={addStaff}>Add</button>
        </div>
      </div>

      {pendingCount > 0 && (
        <div className="row-between" style={{ marginBottom: 14 }}>
          <span className="muted" style={{ fontSize: 13.5 }}>{pendingCount} member{pendingCount === 1 ? '' : 's'} not yet registered.</span>
          <button className="btn p sm" onClick={bulkPay} disabled={busy}>{busy ? 'Processing...' : 'Register & bulk-pay ' + naira(pendingCount * FEE)}</button>
        </div>
      )}

      {biz.staff.length === 0 && <div className="placeholder">No team members yet. Add your first above.</div>}
      {biz.staff.map(x => (
        <div className="ord" key={x.id}>
          <div className="top">
            <div><b style={{ fontFamily: 'Lora,serif', fontSize: 15 }}>{x.name}</b><div className="muted" style={{ fontSize: 12.5 }}>{x.phone}{x.safeplateId ? ' · ' + x.safeplateId : ''}</div></div>
            <span className={'pill ' + (STAFF_STATUSES[x.status] || 'no')}>{x.status}</span>
          </div>
        </div>
      ))}
    </div></div>
  )
}

function EmployerWater({ session }) {
  const [tests, setTests] = useState([])
  const [step, setStep] = useState('list') // list | form | lab | done
  const [f, setF] = useState({ facility: '', lga: '', source: WATER_SOURCES[0], officer: '', contact: '', lab: null, swid: '' })
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setF(o => ({ ...o, [k]: v }))
  const accreditedLabs = labsView().filter(l => l.accredited)

  async function load() { setTests(await store.listWaterTests(session.email)) }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [])

  function toLab() { if (!f.facility.trim() || !f.officer.trim()) return; setStep('lab') }
  async function pay(lab) {
    setBusy(true)
    const swid = makeWaterId()
    const escrowPayload = { safeplateId: swid, name: f.facility.trim(), lab: lab.name, amount: WATER_FEE, status: 'HELD', type: 'WATER', ts: new Date().toISOString() }
    let reference
    try { const rr = await payWithPaystack({ email: session.email, amountNaira: WATER_FEE, reference: 'SPW-' + swid }); reference = rr.reference } catch (e) { setBusy(false); return }
    if (PAYSTACK_READY) { const v = await fetch('/api/paystack-verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reference, safeplateId: swid, escrow: escrowPayload }) }); if (!v.ok) { setBusy(false); return } }
    await store.createWaterTest({ swid, facility: f.facility.trim(), lga: f.lga.trim(), source: f.source, officer: f.officer.trim(), contact: f.contact.trim(), lab: lab.name, amount: WATER_FEE, status: 'Submitted, pending LASEPA', results: { ph: '7.2', turbidity: '1.8 NTU', ecoli: '0 CFU/100ml' }, ownerEmail: session.email, ts: new Date().toISOString() })
    if (!SUPABASE_READY) await store.createEscrow(escrowPayload)
    await store.notify('LASEPA', 'Water result submitted', f.facility.trim() + ' pending LASEPA review')
    await store.dispatch(f.contact, 'sms', 'SafePlate: your ' + naira(WATER_FEE) + ' water test payment is confirmed for ' + f.facility.trim())
    set('swid', swid); setBusy(false); setStep('done'); load()
  }

  if (step === 'form') {
    return (
      <div className="page"><div className="wrap center-narrow">
        <button className="btn ghost" onClick={() => setStep('list')} style={{ paddingLeft: 0, marginBottom: 12 }}>&larr; Back</button>
        <div className="kicker">Water testing</div>
        <h2 className="sec serif">Register a facility for water testing</h2>
        <div className="card">
          <div className="field"><label>Facility name</label><input value={f.facility} onChange={e => set('facility', e.target.value)} placeholder="e.g. Grill House, Lekki" /></div>
          <div className="field"><label>LGA</label><input value={f.lga} onChange={e => set('lga', e.target.value)} placeholder="e.g. Lekki" /></div>
          <div className="field"><label>Water source</label><select value={f.source} onChange={e => set('source', e.target.value)}>{WATER_SOURCES.map(x => <option key={x}>{x}</option>)}</select></div>
          <div className="field"><label>Responsible officer</label><input value={f.officer} onChange={e => set('officer', e.target.value)} placeholder="Officer name" /></div>
          <div className="field"><label>Officer contact</label><input value={f.contact} onChange={e => set('contact', e.target.value)} placeholder="080..." /></div>
          <button className="btn p block" onClick={toLab} disabled={!f.facility.trim() || !f.officer.trim()}>Choose a laboratory</button>
        </div>
      </div></div>
    )
  }
  if (step === 'lab') {
    return (
      <div className="page"><div className="wrap center-narrow">
        <button className="btn ghost" onClick={() => setStep('form')} style={{ paddingLeft: 0, marginBottom: 12 }}>&larr; Back</button>
        <div className="kicker">Water testing</div>
        <h2 className="sec serif">Choose a LASEPA-accredited laboratory</h2>
        <p className="sub">{naira(WATER_FEE)} is paid into Sterling Bank escrow and released only after LASEPA approves the water result.</p>
        {accreditedLabs.map(l => (
          <button key={l.id} className="lab-row" onClick={() => pay(l)} disabled={busy}>
            <span><b style={{ fontFamily: 'Lora,serif' }}>{l.name}</b><div className="meta">{l.area} · results in {l.turnaround}</div></span>
            <span className="pill ok">{busy ? 'Processing...' : 'Pay ' + naira(WATER_FEE)}</span>
          </button>
        ))}
      </div></div>
    )
  }
  if (step === 'done') {
    return (
      <div className="page"><div className="wrap">
        <div className="ok-banner">
          <div className="kicker" style={{ color: 'var(--green)' }}>Escrow funded</div>
          <h3 className="serif" style={{ fontSize: 22, margin: '8px 0' }}>Facility registered and paid.</h3>
          <p className="muted" style={{ marginTop: 0 }}>SAFEPLATE-W ID <b>{f.swid}</b>. Results have been submitted for LASEPA review. Once approved, a Facility Water Quality Certificate is issued and becomes publicly verifiable.</p>
          <button className="btn p" onClick={() => setStep('list')}>Back to my facilities</button>
        </div>
      </div></div>
    )
  }

  return (
    <div className="page"><div className="wrap">
      <div className="greeting"><h2 className="sec serif" style={{ margin: 0 }}>Water testing</h2><button className="btn p sm" onClick={() => { setF({ facility: '', lga: '', source: WATER_SOURCES[0], officer: '', contact: '', lab: null, swid: '' }); setStep('form') }}>Register a facility</button></div>
      <div className="note" style={{ marginBottom: 18 }}>Potable water testing runs as a separate {naira(WATER_FEE)} workstream, approved by LASEPA, with an 80/10/5/5 waterfall.</div>
      {tests.length === 0 && <div className="placeholder">No facilities registered yet. Register one to begin.</div>}
      {tests.map(w => (
        <div className="ord" key={w.swid}>
          <div className="top">
            <div><b style={{ fontFamily: 'Lora,serif', fontSize: 16 }}>{w.facility}</b><div className="muted" style={{ fontSize: 12.5 }}>{w.swid} · {w.source} · {w.lab}</div></div>
            <span className={'status ' + (w.status === 'Certified' ? 'RELEASED' : w.status.indexOf('Flagged') === 0 ? 'Flag' : 'HELD')}>{w.status}</span>
          </div>
          {w.status === 'Certified' && w.certSeries && (
            <div className="row-between" style={{ marginTop: 10 }}>
              <span className="muted" style={{ fontSize: 12.5 }}>Certificate {w.certSeries}. Verify at #/verify/{w.swid}</span>
              <div style={{ background: '#fff', padding: 6, borderRadius: 8, border: '1px solid var(--line)' }}><QRCodeSVG value={window.location.origin + '/#/verify/' + w.swid} size={64} fgColor={PALETTE.navy} level="M" /></div>
            </div>
          )}
        </div>
      ))}
    </div></div>
  )
}

function WaterReview({ session, guard, audit }) {
  const [tests, setTests] = useState([])
  const [loading, setLoading] = useState(true)
  async function refresh() { setLoading(true); setTests(await store.listAllWaterTests()); setLoading(false) }
  useEffect(() => { refresh() }, [])

  async function approve(w) {
    if (SUPABASE_READY) { await store.fn('approve-water', { swid: w.swid, decision: 'approve' }); refresh(); return }
    const now = Date.now(), day = 86400000
    const series = makeWaterCertSeries()
    await store.issueCertificate({ safeplateId: w.swid, name: w.facility, panel: 'Potable water quality', lab: w.lab, issued: new Date(now).toISOString(), expiry: new Date(now + 182 * day).toISOString(), status: 'VALID', series })
    await store.releaseEscrow(w.swid, 'LASEPA')
    await store.updateWaterTest(w.swid, { status: 'Certified', certSeries: series })
    await audit('Water result approved, certificate issued, 80/10/5/5 disbursed', w.swid)
    await store.notify(w.ownerEmail, 'Water certificate issued', w.facility + ' is now certified')
    await store.notify('all', 'Facility water certified', w.facility)
    await store.dispatch(w.contact, 'sms', 'SafePlate: ' + w.facility + ' water certificate issued, ref ' + series)
    refresh()
  }
  async function flag(w) { if (SUPABASE_READY) { await store.fn('approve-water', { swid: w.swid, decision: 'flag' }); refresh(); return } await store.updateWaterTest(w.swid, { status: 'Flagged, retest required' }); await audit('Water result flagged, retest required', w.swid); refresh() }

  const pending = tests.filter(w => w.status === 'Submitted, pending LASEPA')
  const done = tests.filter(w => w.status !== 'Submitted, pending LASEPA')

  return (
    <div>
      <div className="note" style={{ marginBottom: 16 }}>LASEPA is the approving authority for water. Readings are checked against WHO and NAFDAC benchmarks. Approval disburses the {naira(WATER_FEE)} fee 80/10/5/5.</div>
      {loading && <p className="muted">Loading water results...</p>}
      {!loading && pending.length === 0 && <div className="placeholder">No water results awaiting LASEPA approval.</div>}
      {pending.map(w => (
        <div className="ord" key={w.swid}>
          <div className="top"><div><b style={{ fontFamily: 'Lora,serif', fontSize: 16 }}>{w.facility}</b><div className="muted" style={{ fontSize: 12.5 }}>{w.swid} · {w.source} · {w.lab}</div></div><span className="status HELD">Pending LASEPA</span></div>
          <table className="split-tbl"><tbody>{waterChecks(w.results).map(c => (
            <tr key={c.k}><td>{c.k} <span className="muted">({c.bench})</span></td><td style={{ textAlign: 'right', fontWeight: 600, color: c.ok ? 'var(--green)' : '#b3261e' }}>{c.v} {c.ok ? 'pass' : 'fail'}</td></tr>
          ))}</tbody></table>
          <div className="row-between" style={{ marginTop: 12 }}>
            <button className="btn p sm" onClick={() => guard('Approve water result for ' + w.swid, () => approve(w))}>Approve and certify</button>
            <button className="btn sm danger" onClick={() => guard('Flag water result for ' + w.swid, () => flag(w))}>Flag, require retest</button>
          </div>
        </div>
      ))}
      {done.length > 0 && (
        <>
          <h3 className="serif" style={{ fontSize: 17, marginTop: 24 }}>Reviewed facilities</h3>
          {done.map(w => (
            <div className="ord" key={w.swid}><div className="top"><div><b style={{ fontFamily: 'Lora,serif', fontSize: 15 }}>{w.facility}</b><div className="muted" style={{ fontSize: 12.5 }}>{w.swid}{w.certSeries ? ' · ' + w.certSeries : ''}</div></div><span className={'status ' + (w.status === 'Certified' ? 'RELEASED' : 'Flag')}>{w.status}</span></div></div>
          ))}
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Stage 9: Fees transparency and analytics                           */
/* ------------------------------------------------------------------ */

function FeesPage() {
  return (
    <div className="page"><div className="wrap">
      <div className="kicker">{t('fees_kicker')}</div>
      <h2 className="sec serif">{t('fees_title')}</h2>
      <p className="sub">Every fee is fixed, held in escrow, and released only on approved results. The full split is published.</p>
      <div className="feesgrid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <div className="card">
          <h3 className="serif" style={{ marginTop: 0 }}>Food handler test</h3>
          <div style={{ fontFamily: 'Lora,serif', fontSize: 30, color: 'var(--navy)' }}>{naira(FEE)}</div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>per handler, every 6 months</div>
          <table className="split-tbl"><tbody>{WATERFALL.map(w => <tr key={w.who}><td>{w.who} <span className="muted">({w.pct}%)</span></td><td>{naira(w.amount)}</td></tr>)}<tr className="tot"><td>Total</td><td>{naira(FEE)}</td></tr></tbody></table>
        </div>
        <div className="card">
          <h3 className="serif" style={{ marginTop: 0 }}>Potable water test</h3>
          <div style={{ fontFamily: 'Lora,serif', fontSize: 30, color: 'var(--navy)' }}>{naira(WATER_FEE)}</div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>per facility, per LASEPA cadence</div>
          <table className="split-tbl"><tbody>{WATER_WATERFALL.map(w => <tr key={w.who}><td>{w.who} <span className="muted">({w.pct}%)</span></td><td>{naira(w.amount)}</td></tr>)}<tr className="tot"><td>Total</td><td>{naira(WATER_FEE)}</td></tr></tbody></table>
        </div>
      </div>
    </div></div>
  )
}

const ECONOMICS = {
  years: ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'],
  ramp: ['25%', '50%', '75%', '100%', '100%'],
  food: [909375000, 1818750000, 2728125000, 3637500000, 3637500000],
  water: [154781250, 309562500, 464343750, 619125000, 619125000],
  total: [1064156250, 2128312500, 3192468750, 4256625000, 4256625000],
  cumulative: 14898187500
}

function Analytics() {
  const [live, setLive] = useState({ n: 0, amt: 0 })
  useEffect(() => { store.listEscrow().then(esc => { const rel = esc.filter(e => e.status === 'RELEASED'); setLive({ n: rel.length, amt: rel.reduce((a, e) => a + (e.amount || 0), 0) }) }) }, [])
  return (
    <div>
      <div className="tiles" style={{ marginBottom: 18 }}>
        <div className="tile"><div className="v">{live.n}</div><div className="k">Escrow releases (live)</div></div>
        <div className="tile"><div className="v">{naira(live.amt)}</div><div className="k">Disbursed (live)</div></div>
        <div className="tile"><div className="v">{naira(ECONOMICS.cumulative)}</div><div className="k">5-year projected revenue</div></div>
        <div className="tile"><div className="v">6,500</div><div className="k">Eateries at full ramp</div></div>
      </div>
      <h3 className="serif" style={{ fontSize: 18 }}>Five-year project economics</h3>
      <div style={{ overflowX: 'auto' }}>
        <table className="audit-tbl">
          <thead><tr><th>Line</th>{ECONOMICS.years.map(y => <th key={y} style={{ textAlign: 'right' }}>{y}</th>)}</tr></thead>
          <tbody>
            <tr><td>Facility ramp</td>{ECONOMICS.ramp.map((r, i) => <td key={i} style={{ textAlign: 'right' }}>{r}</td>)}</tr>
            <tr><td>Food handler fees</td>{ECONOMICS.food.map((v, i) => <td key={i} style={{ textAlign: 'right' }}>{naira(v)}</td>)}</tr>
            <tr><td>Water fees</td>{ECONOMICS.water.map((v, i) => <td key={i} style={{ textAlign: 'right' }}>{naira(v)}</td>)}</tr>
            <tr><td style={{ fontWeight: 700 }}>Total fees</td>{ECONOMICS.total.map((v, i) => <td key={i} style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'Lora,serif' }}>{naira(v)}</td>)}</tr>
          </tbody>
        </table>
      </div>
      <div className="note" style={{ marginTop: 14 }}>Cumulative 5-year programme revenue: <b>{naira(ECONOMICS.cumulative)}</b>, at facility ramp 25/50/75/100/100% across years, food handler and water fees combined.</div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Motion + GDPR                                                       */
/* ------------------------------------------------------------------ */

function useCountUp(target, ms = 1100) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(target); return }
    let raf; const start = performance.now()
    const step = now => { const p = Math.min(1, (now - start) / ms); setV(target * (1 - Math.pow(1 - p, 3))); if (p < 1) raf = requestAnimationFrame(step) }
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return v
}

function ConsentBanner({ onPrivacy }) {
  const [show, setShow] = useState(false)
  useEffect(() => { try { setShow(!localStorage.getItem('safeplate:consent')) } catch { /* ignore */ } }, [])
  function choose(v) { try { localStorage.setItem('safeplate:consent', v) } catch { /* ignore */ } setShow(false) }
  if (!show) return null
  return (
    <div className="consent">
      <div className="consent-in">
        <div className="consent-txt"><b>Your privacy.</b> We use essential cookies and process personal and health data to deliver certification, under the Nigeria Data Protection Act 2023 and GDPR principles. <button className="lnk" onClick={onPrivacy}>Read the privacy notice</button>.</div>
        <div className="consent-btns">
          <button className="btn sm" onClick={() => choose('necessary')}>Necessary only</button>
          <button className="btn p sm" onClick={() => choose('all')}>Accept all</button>
        </div>
      </div>
    </div>
  )
}

function PrivacyModal({ open, onClose }) {
  if (!open) return null
  function erase() { try { Object.keys(localStorage).filter(k => k.indexOf('safeplate:') === 0).forEach(k => localStorage.removeItem(k)) } catch { /* ignore */ } onClose(); if (typeof window !== 'undefined') window.location.reload() }
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal privacy" onClick={e => e.stopPropagation()}>
        <div className="row-between" style={{ marginBottom: 6 }}>
          <h3 className="serif" style={{ margin: 0, fontSize: 22 }}>Privacy notice</h3>
          <button className="iconbtn" onClick={onClose} aria-label="Close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>How SafePlate handles your personal data, aligned with the Nigeria Data Protection Act 2023 and GDPR principles.</p>
        <h4>Data controller</h4><p>Lagos State Ministry of Health, operator of SafePlate, with LASEPA and HEFAMAA as oversight bodies.</p>
        <h4>What we process</h4><p>Identity and contact details, your SAFEPLATE ID, laboratory test results and certification status, and payment records. Test results are health data, a special category requiring extra protection.</p>
        <h4>Lawful basis</h4><p>Performance of a public health task and a legal obligation under the NAFDAC Food Hygiene Regulation 2019, together with your explicit consent for processing health data.</p>
        <h4>Retention</h4><p>Records are kept for the statutory public-health retention period, then deleted or anonymised.</p>
        <h4>Your rights</h4><p>You may request access, rectification, erasure, restriction and portability, and object to processing. Certification decisions always remain subject to human review, never automated alone.</p>
        <h4>Security and transfers</h4><p>Role-based access, encryption in transit and at rest, an append-only audit trail, and breach procedures. Data is hosted within approved jurisdictions.</p>
        <h4>Contact</h4><p>Data Protection Officer, Lagos State Ministry of Health: dpo@safeplate.lagosstate.gov.ng.</p>
        <div style={{ marginTop: 16 }}><button className="btn sm danger" onClick={erase}>Erase my data on this device</button></div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Go-live diagnostics (open at #/status)                             */
/* ------------------------------------------------------------------ */

const STATUS_TABLES = ['food_handlers', 'test_orders', 'certificates', 'escrow', 'escrow_releases', 'audit_log', 'establishments', 'laboratories', 'businesses', 'water_tests', 'notifications']

function StatusPage({ onHome }) {
  const [db, setDb] = useState(null)
  const [api, setApi] = useState(null)
  useEffect(() => {
    (async () => {
      const d = {}
      for (const tbl of STATUS_TABLES) d[tbl] = await store.ping(tbl)
      setDb(d)
      const a = {}
      for (const path of ['/api/paystack-verify', '/api/notify', '/api/anthropic']) {
        try { const r = await fetch(path, { method: 'GET' }); a[path] = r.status !== 404 } catch { a[path] = false }
      }
      setApi(a)
    })()
  }, [])
  const Row = ({ label, ok, detail }) => (
    <div className="ord" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
      <span><b style={{ fontFamily: 'Lora,serif' }}>{label}</b>{detail && <div className="muted" style={{ fontSize: 12 }}>{detail}</div>}</span>
      <span className={'pill ' + (ok ? 'ok' : 'no')}>{ok ? 'OK' : 'Check'}</span>
    </div>
  )
  return (
    <div className="page"><div className="wrap">
      <button className="btn ghost" onClick={onHome} style={{ paddingLeft: 0, marginBottom: 12 }}>&larr; Back</button>
      <div className="kicker">Go-live diagnostics</div>
      <h2 className="sec serif">Connection check</h2>
      <p className="sub">Open this at your-app-url/#/status after deploying to confirm every key, table and function is wired. Nothing here is sensitive.</p>

      <h3 className="serif" style={{ fontSize: 17 }}>Environment</h3>
      <Row label="Supabase URL and anon key" ok={SUPABASE_READY} detail={SUPABASE_READY ? 'Set' : 'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY not set'} />
      <Row label="Paystack public key" ok={PAYSTACK_READY} detail={PAYSTACK_READY ? 'Set, live checkout enabled' : 'VITE_PAYSTACK_PUBLIC_KEY not set, payments simulated'} />

      <h3 className="serif" style={{ fontSize: 17, marginTop: 20 }}>Database tables</h3>
      {!db && <p className="muted">Checking...</p>}
      {db && STATUS_TABLES.map(tbl => <Row key={tbl} label={tbl} ok={db[tbl] && db[tbl].ok} detail={db[tbl] && db[tbl].ok ? 'Reachable' : (db[tbl] && db[tbl].error) || ''} />)}

      <h3 className="serif" style={{ fontSize: 17, marginTop: 20 }}>Serverless functions</h3>
      {!api && <p className="muted">Checking...</p>}
      {api && ['/api/paystack-verify', '/api/notify', '/api/anthropic'].map(path => <Row key={path} label={path} ok={api[path]} detail={api[path] ? 'Deployed' : 'Not found, deploy to Vercel'} />)}

      <div className="note" style={{ marginTop: 18 }}>All OK means you are live. Any Check row tells you exactly what is missing: run schema.sql for missing tables, set the matching environment variable for a missing key, or redeploy for a missing function.</div>
    </div></div>
  )
}

/* ------------------------------------------------------------------ */
/*  Root                                                               */
/* ------------------------------------------------------------------ */

function parseHash() {
  const h = window.location.hash.replace(/^#\/?/, '')
  const [route, param] = h.split('/')
  return { route, param }
}

export default function App() {
  const [session, setSession] = useState(null)
  const [tab, setTab] = useState('overview')
  const [mode, setMode] = useState('app') // app | auth
  const [verifyId, setVerifyId] = useState('')
  const [lang, setLang] = useState(I18N.lang)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [special, setSpecial] = useState(null)
  const [workspace, setWorkspace] = useState('lsmoh')
  function changeLang(L) { I18N.lang = L; try { localStorage.setItem('safeplate:lang', L) } catch { /* ignore */ } setLang(L) }

  useEffect(() => { seedDemo() }, [])
  useIdleTimeout(session, () => { signOut() })
  useEffect(() => {
    function onHash() { const { route, param } = parseHash(); if (route === 'status') { setSpecial('status') } else if (route === 'verify') { setSpecial(null); setVerifyId(param || ''); setMode('app'); setTab('verify') } else { setSpecial(null) } }
    onHash(); window.addEventListener('hashchange', onHash); return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const isAdmin = Boolean(session && session.role === 'regulator' && session.agency === 'LSMoH')
  const eff = isAdmin ? (() => { const w = WORKSPACES.find(x => x.id === workspace) || WORKSPACES[0]; return { ...session, role: w.role, agency: w.agency, title: w.id === 'lsmoh' ? session.title : roleTitle(w.role, w.agency) + ' (LSMoH admin view)' } })() : session
  const tabs = tabsForSession(eff)
  useEffect(() => { if (!tabs.some(t => t.id === tab)) setTab(tabs[0].id) /* eslint-disable-next-line */ }, [session, workspace])
  function switchWorkspace(id) { const w = WORKSPACES.find(x => x.id === id) || WORKSPACES[0]; setWorkspace(id); setMode('app'); setSpecial(null); setTab(tabsForSession({ ...session, role: w.role, agency: w.agency })[0].id) }

  function onTab(id) { setMode('app'); if (id === 'verify') setVerifyId(''); setTab(id) }
  function onBrand() { setMode('app'); setTab(tabs[0].id); if (!session) { window.location.hash = '' } }
  function onAuthed(user) { setSession(user); setMode('app'); setTab(tabsForSession(user)[0].id); try { store.appendAudit({ actor: user.email || user.name, role: user.agency || user.role, action: 'Signed in', subject: user.role }) } catch { /* ignore */ } }
  async function signOut() { await store.signOut(); setSession(null); setMode('app'); setTab('overview'); setWorkspace('lsmoh') }

  function page() {
    if (special === 'status') return <StatusPage onHome={() => { window.location.hash = ''; setSpecial(null) }} />
    if (mode === 'auth' && !session) return <AuthFlow onDone={onAuthed} onBack={() => { setMode('app'); setTab(tabs[0].id) }} />
    if (tab === 'verify') return <VerifyPage initialId={verifyId} />
    if (!session) {
      if (tab === 'system') return <SystemPage />
      if (tab === 'impact') return <ImpactPage />
      return <Overview onStart={() => setMode('auth')} onVerify={() => setTab('verify')} />
    }
    if (eff.role === 'food_handler') return <FoodHandlerModule session={eff} />
    if (eff.role === 'laboratory') return <LaboratoryModule session={eff} />
    if (eff.role === 'regulator') return <RegulatorModule session={eff} tab={tab} />
    if (eff.role === 'sterling') return <SterlingModule session={eff} tab={tab} />
    if (eff.role === 'employer') return <EmployerModule session={eff} tab={tab} />
    return null
  }

  return (
    <>
      <Styles />
      <GovBar />
      <Header tabs={tabs} active={mode === 'auth' ? '' : tab} onTab={onTab} onBrand={onBrand} session={session} onSignIn={() => setMode('auth')} onSignOut={signOut} lang={lang} onLang={changeLang} onPrivacy={() => setPrivacyOpen(true)} admin={isAdmin} workspace={workspace} onSwitch={switchWorkspace} />
      {page()}
      <Footer onPrivacy={() => setPrivacyOpen(true)} />
      <ConsentBanner onPrivacy={() => setPrivacyOpen(true)} />
      <PrivacyModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
    </>
  )
}
