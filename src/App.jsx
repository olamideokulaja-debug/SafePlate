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
function accentFor(x) {
  if (!x) return '#006600'
  if (x.role === 'regulator' || x.role === 'officer') return x.agency === 'LASEPA' ? '#0891b2' : x.agency === 'HEFAMAA' ? '#7c3aed' : '#15803d'
  return ({ food_handler: '#006600', laboratory: '#b45309', sterling: '#1d4ed8', employer: '#be185d' })[x.role] || '#006600'
}

let _toastFns = []
function toast(msg, kind) { _toastFns.forEach(f => f(msg, kind)) }
function Toasts() {
  const [items, setItems] = useState([])
  useEffect(() => {
    const add = (msg, kind) => { const id = Math.random(); setItems(x => [...x, { id, msg, kind }]); setTimeout(() => setItems(x => x.filter(i => i.id !== id)), 4200) }
    _toastFns.push(add); return () => { _toastFns = _toastFns.filter(f => f !== add) }
  }, [])
  if (!items.length) return null
  return <div className="toasts">{items.map(i => <div key={i.id} className={'toast ' + (i.kind || '')}>{i.msg}</div>)}</div>
}
function Seal({ size = 104 }) {
  return (
    <svg className="seal" width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r="56" fill="#fff" stroke="var(--green)" strokeWidth="2.5" />
      <circle cx="60" cy="60" r="49" fill="none" stroke="var(--gold)" strokeWidth="2" strokeDasharray="3 5" />
      <circle cx="60" cy="60" r="37" fill="var(--green)" />
      <path d="M45 60 l10 10 l21 -23" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <text x="60" y="105" textAnchor="middle" fontSize="8" fontWeight="700" fill="var(--green)" letterSpacing="1.5">LAGOS STATE</text>
    </svg>
  )
}
function CrossSeal({ size = 104 }) {
  return (
    <svg className="seal" width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r="54" fill="#fff" stroke="#b3261e" strokeWidth="3" />
      <path d="M44 44 l32 32 M76 44 l-32 32" stroke="#b3261e" strokeWidth="6.5" strokeLinecap="round" />
    </svg>
  )
}
function loadPaystack() {
  return new Promise((resolve, reject) => {
    if (window.PaystackPop) return resolve()
    const sc = document.createElement('script'); sc.src = 'https://js.paystack.co/v2/inline.js'
    sc.onload = () => resolve(); sc.onerror = () => reject(new Error('Could not load Paystack')); document.body.appendChild(sc)
  })
}
async function payWithPaystack({ email, amountNaira, reference }) {
  if (!PAYSTACK_READY) { await new Promise(r => setTimeout(r, 700)); return { reference: reference || ('DEMO-' + Date.now()), simulated: true } }
  await loadPaystack()
  return new Promise((resolve, reject) => {
    try {
      const popup = new window.PaystackPop()
      popup.newTransaction({
        key: PAYSTACK_PUBLIC_KEY,
        email: email || 'noreply@safeplate.lagosstate.gov.ng',
        amount: Math.round(amountNaira * 100),
        currency: 'NGN',
        reference: reference || ('SP-' + Date.now()),
        onSuccess: tx => resolve({ reference: tx.reference }),
        onCancel: () => reject(new Error('Payment window closed')),
        onError: e => reject(new Error('Payment could not start: ' + ((e && e.message) || 'check the Paystack key and that this domain is added in your Paystack dashboard')))
      })
    } catch (e) { reject(new Error('Payment could not start. Confirm the Paystack public key is set and this domain is allowed in Paystack.')) }
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
  },
  ig: {
    signin: 'Banye',
    signout: 'Puo',
    back: 'Laghachi',
    nav_overview: 'Nchikota',
    nav_system: 'Usoro ahu',
    nav_impact: 'Mmetuta',
    nav_fees: 'Ugwo',
    nav_verify: 'Nyochaa',
    nav_testing: 'Nnwale m',
    nav_queue: 'Kwu ulo nyocha',
    nav_team: 'Ndi otu m',
    nav_water: 'Nnwale mmiri',
    nav_review: 'Nyocha',
    nav_certificates: 'Asambodo',
    nav_analytics: 'Nyocha data',
    nav_audit: 'Ndeko omume',
    nav_enforcement: 'Mmanye iwu',
    nav_accreditation: 'Nkwenye',
    nav_ledger: 'Akwukwo ego escrow',
    nav_releases: 'Nhapu ego',
    nav_fund: 'Ego',
    nav_reconcile: 'Nkweko akaunti',
    hero_eyebrow: 'Na steeti niile, nrube isi ndu',
    hero_title: 'Efere obula na Lagos, nwere onye na-ejikwa nri e nyochara.',
    hero_lede: 'SafePlate na-edebanye aha, na-anwale, na-enye asambodo ma na-elekota onye obula na-ejikwa nri na Steeti Lagos, site na ulo nyocha akwadoro, ebe a na-edobe ugwo na escrow ma hapu ya naani mgbe a kwadoro nsonaazu.',
    cta_register: 'Debanye aha dika onye na-ejikwa nri',
    cta_verify: 'Nyochaa asambodo',
    chip_active: 'asambodo na-aru oru',
    chip_compliance: 'nrube isi',
    chip_secure: 'Ikwu ugwo escrow chekwara',
    hero_model: 'Usoro doro anya, nke na-akwado onwe ya, enweghi ugwo zoro ezo.',
    sys_kicker: 'Usoro ahu',
    sys_title: 'Ogidi ano, otu ikpo okwu na-aza ajuju',
    imp_kicker: 'Ihe kpatara o ji di mkpa',
    imp_title: 'A na-atu onu ahia nri na-adighi mma na ndu',
    fees_kicker: 'Ugwo doro anya',
    fees_title: 'Ihe i na-akwu, na ebe o na-aga',
    verify_kicker: 'Nyocha oha',
    verify_title: 'Nyochaa asambodo onye na-ejikwa nri',
    verify_sub: 'Tinye SAFEPLATE ID iji kwado onodu, nnwale na oge o ga-agwu. I choghi akaunti.',
    verify_label: 'ID asambodo',
    verify_btn: 'Nyochaa asambodo',
    verify_notfound: 'O dighi asambodo dabara na ID ahu. Lelee ID ahu ma nwaa ozo.',
    fh_title: 'Nnwale gi',
    fh_s1: 'Debanye aha ma nweta SAFEPLATE ID gi',
    fh_s2: 'Nnwale i ga-eme',
    fh_s3: 'Horo ulo nyocha akwadoro',
    fh_s4: 'Kwuo ego na escrow',
    lbl_fullname: 'Aha gi zuru ezu',
    lbl_phone: 'Nomba ekwenti',
    lbl_nin: 'NIN (nhoro, anyi ga-enyocha ya ma i tinye ya)',
    lbl_email: 'Email (nhoro)',
    lbl_employer: 'Onye i na-aruru oru (nhoro)',
    btn_create_id: 'Mepuata SAFEPLATE ID m',
    btn_choose_lab: 'Horo ulo nyocha',
    fh_mandatory: 'Iwu kwadoro',
    fh_id_assigned: 'E nyere SAFEPLATE ID:',
    fh_done: 'I debanyela aha ma kwuo ugwo. A haziela nnwale gi.'
  },
  pcm: {
    signin: 'Sign in',
    signout: 'Comot',
    back: 'Go back',
    nav_overview: 'Overview',
    nav_system: 'How e dey work',
    nav_impact: 'Why e matter',
    nav_fees: 'Money matter',
    nav_verify: 'Check am',
    nav_testing: 'My test',
    nav_queue: 'Lab queue',
    nav_team: 'My people',
    nav_water: 'Water test',
    nav_review: 'Review',
    nav_certificates: 'Certificate',
    nav_analytics: 'Report',
    nav_audit: 'Audit trail',
    nav_enforcement: 'Enforcement',
    nav_accreditation: 'Accreditation',
    nav_ledger: 'Escrow ledger',
    nav_releases: 'Release',
    nav_fund: 'Fund',
    nav_reconcile: 'Reconciliation',
    hero_eyebrow: 'Everywhere for Lagos, live compliance',
    hero_title: 'Every plate for Lagos, na food handler wey dem don check dey behind am.',
    hero_lede: 'SafePlate dey register, test, certify and monitor every food handler for Lagos State, through labs wey dem approve, with payment wey dey inside escrow wey dem go only release after dem approve result.',
    cta_register: 'Register as food handler',
    cta_verify: 'Check certificate',
    chip_active: 'certificate wey dey active',
    chip_compliance: 'compliance',
    chip_secure: 'Payment wey escrow dey guard',
    hero_model: 'Model wey clear, wey fit carry himself, no hidden charge.',
    sys_kicker: 'How e dey work',
    sys_title: 'Four pillar, one platform wey dey answer question',
    imp_kicker: 'Why e matter',
    imp_title: 'Food wey no safe dey cost life',
    fees_kicker: 'Fee wey clear',
    fees_title: 'Wetin you dey pay, and where the money dey go',
    verify_kicker: 'Public check',
    verify_title: 'Check food handler certificate',
    verify_sub: 'Put SAFEPLATE ID make you confirm status, panel and when e go expire. You no need account.',
    verify_label: 'Certificate ID',
    verify_btn: 'Check certificate',
    verify_notfound: 'No certificate match that ID. Check the ID well well and try again.',
    fh_title: 'Your test',
    fh_s1: 'Register make you get your SAFEPLATE ID',
    fh_s2: 'Test wey you must do',
    fh_s3: 'Choose lab wey dem approve',
    fh_s4: 'Pay into escrow',
    lbl_fullname: 'Your full name',
    lbl_phone: 'Phone number',
    lbl_nin: 'NIN (optional, we go verify am if you put am)',
    lbl_email: 'Email (optional)',
    lbl_employer: 'Where you dey work (optional)',
    btn_create_id: 'Create my SAFEPLATE ID',
    btn_choose_lab: 'Choose lab',
    fh_mandatory: 'Compulsory',
    fh_id_assigned: 'Dem don give you SAFEPLATE ID:',
    fh_done: 'You don register and you don pay. Dem don fix your test.'
  }
}
const LANGS = [{ id: 'en', label: 'English' }, { id: 'yo', label: 'Yoruba' }, { id: 'ig', label: 'Igbo' }, { id: 'pcm', label: 'Nigerian Pidgin' }]
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
    if (SUPABASE_READY) { await supabase.from('appeals').update({ status: status || 'Resolved', resolution }).eq('id', id); return }
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
    const db = DEMO.read(); db.labAccred = db.labAccred || {}; db.labAccred[id] = val
    if (db.regLabs && db.regLabs[id]) db.regLabs[id].accredited = val
    DEMO.write(db)
  },
  async registerLab(lab) {
    const id = lab.id || ('lab-' + Date.now())
    const rec = { id, name: lab.name, area: lab.lga || lab.area || '', accredited: false, contactPerson: lab.contactPerson || '', phone: lab.phone || '', address: lab.address || '', lga: lab.lga || '', status: 'Pending' }
    if (SUPABASE_READY) { const { error } = await supabase.from('laboratories').upsert(toSnake(rec), { onConflict: 'id' }); if (error) throw new Error(error.message); return rec }
    const db = DEMO.read(); db.regLabs = db.regLabs || {}; db.regLabs[id] = { ...rec, turnaround: '48 hours', mobile: false, accNo: null }; DEMO.write(db); return rec
  },
  async listPendingLabs() {
    if (SUPABASE_READY) { const { data } = await supabase.from('laboratories').select('*').eq('status', 'Pending'); return camelList(data) }
    const db = DEMO.read(); return Object.values(db.regLabs || {}).filter(l => l.status === 'Pending')
  },
  async approveLab(id) {
    if (SUPABASE_READY) { await supabase.from('laboratories').update({ accredited: true, status: 'Accredited' }).eq('id', id); return }
    const db = DEMO.read(); if (db.regLabs && db.regLabs[id]) { db.regLabs[id].accredited = true; db.regLabs[id].status = 'Accredited' } db.labAccred = db.labAccred || {}; db.labAccred[id] = true; DEMO.write(db)
  },
  async declineLab(id) {
    if (SUPABASE_READY) { await supabase.from('laboratories').update({ status: 'Declined', accredited: false }).eq('id', id); return }
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
    if (SUPABASE_READY) { await supabase.from('officers').upsert(toSnake(rec), { onConflict: 'email' }); return rec }
    const db = DEMO.read(); db.officers = db.officers || {}; db.officers[rec.id] = rec; DEMO.write(db); return rec
  },
  async updateOfficer(id, patch) {
    if (SUPABASE_READY) { await supabase.from('officers').update(toSnake(patch)).eq('id', id); return }
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
    if (SUPABASE_READY) { await supabase.from('inspections').insert(toSnake(rec)); return rec }
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
    if (SUPABASE_READY) { await supabase.from('inspections').update(toSnake(patch)).eq('id', id); return }
    const db = DEMO.read(); db.inspections = (db.inspections || []).map(r => r.id === id ? { ...r, ...patch } : r); DEMO.write(db)
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
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' })
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight()
  doc.setDrawColor(0, 102, 0); doc.setLineWidth(2); doc.rect(28, 28, W - 56, H - 56)
  doc.setDrawColor(251, 174, 64); doc.setLineWidth(0.7); doc.rect(36, 36, W - 72, H - 72)
  try { const crest = await fetchDataUrl('/lagos-logo.png'); doc.addImage(crest, 'PNG', W / 2 - 42, 52, 84, 84) } catch (e) { /* ignore */ }
  try {
    const sx = 96, sy = H - 132
    doc.setDrawColor(0, 102, 0); doc.setLineWidth(2); doc.circle(sx, sy, 34)
    doc.setDrawColor(251, 174, 64); doc.setLineWidth(1.4); doc.circle(sx, sy, 29)
    doc.setFillColor(0, 102, 0); doc.circle(sx, sy, 21, 'F')
    doc.setDrawColor(255, 255, 255); doc.setLineWidth(3.4)
    doc.line(sx - 9, sy + 1, sx - 3, sy + 8); doc.line(sx - 3, sy + 8, sx + 10, sy - 8)
    doc.setFont('times', 'bold'); doc.setFontSize(6); doc.setTextColor(0, 102, 0); doc.text('LAGOS STATE  •  VERIFIED', sx, sy + 44, { align: 'center' })
  } catch (e) { /* ignore */ }
  if (cert.photo) { try { doc.addImage(cert.photo, 'JPEG', W - 166, 58, 96, 112); doc.setDrawColor(0, 102, 0); doc.setLineWidth(1); doc.rect(W - 166, 58, 96, 112); doc.setFont('times', 'normal'); doc.setFontSize(8); doc.setTextColor(90, 107, 100); doc.text('HOLDER', W - 118, 184, { align: 'center' }) } catch (e) { /* ignore */ } }
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
  const base = LABS.map(l => (l.id in ov ? { ...l, accredited: ov[l.id] } : l))
  const reg = Object.values(db.regLabs || {}).filter(l => l.status !== 'Declined')
  return [...base, ...reg]
}

const FEE = 15000
// Chart palette (defined early: referenced by AUDIT_CATS and the chart components).
const CHART = ['#006600', '#FBAE40', '#003366', '#0891b2', '#b3261e', '#7c3aed', '#0f766e']
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
  { id: 'sterling', code: 'SB', label: 'Sterling Bank', tag: 'Escrow management' },
  { id: 'officer', code: 'OF', label: 'Field Officer', tag: 'Inspect, sanction, verify and sample in the field' }
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
  { id: 'officer_lasepa', role: 'officer', agency: 'LASEPA', label: 'Field Officer, LASEPA', short: 'Officer (LASEPA)' },
  { id: 'officer_lsmoh', role: 'officer', agency: 'LSMoH', label: 'Field Officer, LSMoH', short: 'Officer (LSMoH)' },
  { id: 'food_handler', role: 'food_handler', agency: null, label: 'Food Handler', short: 'Food handler' }
]
const SANCTION_LADDER = ['Warning', 'Fine', 'Temporary closure', 'Loss of operating licence']
const SANCTION_SEVERE = ['Fine', 'Temporary closure', 'Loss of operating licence']
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
    case 'officer': {
      const ot = [{ id: 'field', label: 'Field check' }, { id: 'inspect', label: 'Inspections' }]
      if (session.agency === 'LASEPA') ot.push({ id: 'water', label: 'Water sampling' })
      ot.push({ id: 'activity', label: 'My activity' })
      return ot
    }
    case 'food_handler': return [{ id: 'testing', label: t('nav_testing') }, { id: 'verify', label: t('nav_verify') }]
    case 'laboratory': return [{ id: 'queue', label: t('nav_queue') }, { id: 'verify', label: t('nav_verify') }]
    case 'employer': return [{ id: 'team', label: t('nav_team') }, { id: 'water', label: t('nav_water') }, { id: 'verify', label: t('nav_verify') }]
    case 'sterling': return [
      { id: 'ledger', label: t('nav_ledger') }, { id: 'releases', label: t('nav_releases') },
      { id: 'fund', label: t('nav_fund') }, { id: 'reconcile', label: t('nav_reconcile') }, { id: 'verify', label: t('nav_verify') }
    ]
    case 'regulator':
      if (session.agency === 'LASEPA') return [{ id: 'enforcement', label: t('nav_enforcement') }, { id: 'water', label: t('nav_water') }, { id: 'officers', label: 'Officers' }, { id: 'audit', label: t('nav_audit') }, { id: 'verify', label: t('nav_verify') }]
      if (session.agency === 'HEFAMAA') return [{ id: 'accreditation', label: t('nav_accreditation') }, { id: 'officers', label: 'Officers' }, { id: 'audit', label: t('nav_audit') }, { id: 'verify', label: t('nav_verify') }]
      return [{ id: 'review', label: t('nav_review') }, { id: 'certificates', label: t('nav_certificates') }, { id: 'officers', label: 'Officers' }, { id: 'audit', label: t('nav_audit') }, { id: 'verify', label: t('nav_verify') }]
    default: return [{ id: 'verify', label: t('nav_verify') }]
  }
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

function Styles() {
  return (
    <style>{`
      :root{--green:${PALETTE.green};--gold:${PALETTE.gold};--navy:${PALETTE.navy};--ink:#0e1f18;--muted:#5b6b64;--line:#e3e7e4;--paper:#f7faf8;--green-pale:#e9f3ec;--gold-pale:#fdf3e0;--navy-pale:#eaf0f6;--green-deep:#044d2b;--green-glow:#12a150;--gold-deep:#e8912a;--mono:'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,monospace;--r-sm:8px;--r:11px;--r-lg:16px;--r-xl:22px;--sh-sm:0 1px 2px rgba(16,38,28,.05),0 1px 3px rgba(16,38,28,.04);--sh-md:0 4px 12px rgba(16,38,28,.07),0 2px 4px rgba(16,38,28,.05);--sh-lg:0 18px 40px rgba(16,38,28,.12),0 6px 14px rgba(16,38,28,.08);--sh-glow:0 8px 30px rgba(0,102,0,.18);--ease:cubic-bezier(.22,.61,.36,1);--accent:${PALETTE.green}}
      *{box-sizing:border-box}
      html,body,#root{margin:0;padding:0}
      body{background:var(--paper);color:var(--ink);font-family:'Inter',system-ui,-apple-system,sans-serif;line-height:1.55;-webkit-font-smoothing:antialiased}
      h1,h2,h3,h4,.serif{font-family:'Lora',Georgia,serif}
      button{font-family:inherit;cursor:pointer}
      .wrap{max-width:1100px;margin:0 auto;padding:0 22px}
      .hdr .wrap{max-width:none;padding:0 26px}
      .sidebrand .wordmark b{white-space:nowrap}
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
      .chartgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-bottom:18px}
      .chartcard{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px}
      .charttitle{font-weight:700;color:var(--ink);font-size:14.5px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:baseline;gap:8px}
      .charthint{font-weight:500;color:var(--muted);font-size:12px}
      .chartrow{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
      .donut{flex:0 0 auto}
      .donutc{font-family:Lora,serif;font-size:17px;font-weight:700;fill:var(--ink)}
      .donuts{font-size:9px;fill:var(--muted);text-transform:uppercase;letter-spacing:.05em}
      .legend{display:flex;flex-direction:column;gap:7px;flex:1;min-width:130px}
      .legrow{display:flex;align-items:center;gap:8px;font-size:13px}
      .legrow i{width:10px;height:10px;border-radius:3px;flex:0 0 auto}
      .legrow span{flex:1;color:var(--muted)}
      .legrow b{font-variant-numeric:tabular-nums;color:var(--ink)}
      .bars{display:flex;flex-direction:column;gap:11px}
      .barrow{display:grid;grid-template-columns:120px 1fr auto;align-items:center;gap:10px}
      .barlabel{font-size:12.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .bartrack{height:10px;background:var(--green-pale);border-radius:6px;overflow:hidden}
      .barfill{display:block;height:100%;border-radius:6px;transition:width .5s ease}
      .barval{font-size:12.5px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--ink)}
      .linechart{width:100%;height:auto}
      .axl{font-size:10px;fill:var(--muted)}
      .journey{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin-bottom:18px}
      .jtitle{font-weight:700;color:var(--ink);font-size:14.5px;margin-bottom:16px}
      .jtrack{display:flex;align-items:flex-start;overflow-x:auto;padding-bottom:4px}
      .jstep{display:flex;flex-direction:column;align-items:center;gap:8px;flex:1;min-width:74px;position:relative;text-align:center}
      .jstep:not(:last-child):after{content:'';position:absolute;top:17px;left:50%;width:100%;height:2px;background:var(--line);z-index:0}
      .jstep.done:not(:last-child):after{background:var(--green)}
      .jicon{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#fff;border:2px solid var(--line);color:var(--muted);z-index:1}
      .jicon svg{width:17px;height:17px}
      .jstep.done .jicon{background:var(--green);border-color:var(--green);color:#fff}
      .jstep.now .jicon{border-color:var(--green);color:var(--green);box-shadow:0 0 0 4px var(--green-pale)}
      .jlabel{font-size:11.5px;color:var(--muted);font-weight:600;line-height:1.25}
      .jstep.now .jlabel{color:var(--green)}
      .jstep.done .jlabel{color:var(--ink)}
      .jnote{font-size:12.5px;margin-top:14px;line-height:1.5}
      .btn.xs{padding:5px 11px;font-size:12px;border-radius:8px}
      .audsearch{margin-bottom:16px}
      .audsearch input{width:100%;padding:11px 14px;border:1px solid var(--line);border-radius:10px;font-family:inherit;font-size:14px;background:#fff}
      .audsearch input:focus{outline:none;border-color:var(--green)}
      .field textarea{width:100%;padding:11px 13px;border:1px solid var(--line);border-radius:10px;font-family:inherit;font-size:14px;background:#fff;resize:vertical}
      .field textarea:focus{outline:none;border-color:var(--green)}
      .viewtog{display:inline-flex;border:1px solid var(--line);border-radius:9px;overflow:hidden}
      .viewtog button{border:0;background:#fff;padding:7px 15px;font-size:13px;font-weight:600;color:var(--muted);cursor:pointer}
      .viewtog button.on{background:var(--green-pale);color:var(--green)}
      .audchips{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
      .audchip{border:1px solid var(--line);background:#fff;border-radius:100px;padding:6px 12px;font-size:12.5px;font-weight:600;color:var(--muted);cursor:pointer;display:inline-flex;align-items:center;gap:7px}
      .audchip.on{border-color:var(--green);background:var(--green-pale);color:var(--green)}
      .audchip i{width:8px;height:8px;border-radius:50%;flex:0 0 auto}
      .timeline{position:relative;margin-top:4px}
      .tlrow{display:flex;gap:14px;padding-bottom:18px;position:relative}
      .tlrow:not(:last-child):before{content:'';position:absolute;left:17px;top:36px;bottom:0;width:2px;background:var(--line)}
      .tldot{width:36px;height:36px;border-radius:50%;border:2px solid;background:#fff;display:flex;align-items:center;justify-content:center;flex:0 0 auto;z-index:1}
      .tldot svg{width:16px;height:16px}
      .tlbody{flex:1;min-width:0;padding-top:3px}
      .tltop{display:flex;justify-content:space-between;gap:10px;align-items:baseline}
      .tltop b{font-size:14px;color:var(--ink);font-weight:600}
      .tltime{font-size:12px;color:var(--muted);white-space:nowrap;flex:0 0 auto}
      .tlmeta{font-size:12.5px;margin-top:3px}
      .applayout{display:flex;align-items:flex-start}
      .sidebar{width:240px;flex:0 0 240px;background:#fff;border-right:1px solid var(--line);position:sticky;top:0;height:100vh;overflow-y:auto;padding:16px 14px;display:flex;flex-direction:column}
      .sidebrand{display:flex;align-items:center;gap:11px;border:0;background:none;padding:8px 8px 16px;margin-bottom:8px;border-bottom:1px solid var(--line);cursor:pointer}
      .sidenav{display:flex;flex-direction:column;gap:3px;margin-top:6px}
      .sidelink{display:flex;align-items:center;gap:12px;padding:11px 12px;border:0;background:none;border-radius:10px;font-weight:600;font-size:14.5px;color:var(--muted);text-align:left;cursor:pointer;transition:background .15s,color .15s}
      .sidelink svg{width:18px;height:18px;flex:0 0 18px;opacity:.75}
      .sidelink:hover{background:var(--green-pale);color:var(--ink)}
      .sidelink.on{background:var(--green-pale);color:var(--accent, var(--green));box-shadow:inset 3px 0 0 var(--accent, var(--green))}
      .sidelink.on svg{opacity:1;color:var(--accent, var(--green))}
      .appmain{flex:1;min-width:0;display:flex;flex-direction:column;min-height:calc(100vh - 36px)}
      .appmain > .page{flex:1 0 auto}
      .apptop{display:flex;align-items:center;justify-content:flex-end;gap:10px;background:#fff;border-bottom:1px solid var(--line);border-top:3px solid var(--accent, var(--green));padding:0 22px;min-height:56px;position:sticky;top:0;z-index:30}
      .hamburger{display:none;margin-right:auto;border:1px solid var(--line);background:#fff;border-radius:9px;width:38px;height:38px;align-items:center;justify-content:center;color:var(--ink);cursor:pointer}
      .sidebackdrop{display:none}
      @media (max-width:860px){
        .sidebar{position:fixed;left:0;top:0;bottom:0;height:auto;z-index:70;transform:translateX(-100%);transition:transform .22s ease;box-shadow:0 10px 40px rgba(0,0,0,.18)}
        .sidebar.open{transform:translateX(0)}
        .hamburger{display:inline-flex}
        .sidebackdrop{display:block;position:fixed;inset:0;background:rgba(0,0,0,.38);z-index:65}
      }
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
      /* ===== Bold refresh ===== */
      body{background:radial-gradient(130% 90% at 50% -20%, #eaf5ee 0%, var(--paper) 46%) fixed}
      ::selection{background:var(--green);color:#fff}
      a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid var(--green-glow);outline-offset:2px}
      .serif{letter-spacing:-.012em}
      .hero h1{font-size:clamp(34px,5.2vw,60px);line-height:1.02;font-weight:700;letter-spacing:-.026em}
      .sec{letter-spacing:-.02em}
      .mono{font-family:var(--mono);letter-spacing:-.02em}
      .btn{border-radius:var(--r);transition:transform .18s var(--ease),box-shadow .18s var(--ease),background .18s,border-color .18s}
      .btn:hover{transform:translateY(-1.5px)}
      .btn:active{transform:translateY(0) scale(.985)}
      .btn.p{background:linear-gradient(180deg,#0a7a41,var(--green));border-color:var(--green-deep);color:#fff;box-shadow:var(--sh-sm)}
      .btn.p:hover{box-shadow:var(--sh-glow)}
      .btn.g{background:linear-gradient(180deg,#fdbb56,var(--gold));border-color:var(--gold-deep);color:#3a2600}
      .btn.g:hover{box-shadow:0 8px 24px rgba(251,174,64,.35)}
      .btn.sm{border-radius:var(--r-sm)}
      .card{border-radius:var(--r-lg);box-shadow:var(--sh-sm);transition:box-shadow .25s var(--ease),transform .25s var(--ease)}
      .pillar,.role-card{border-radius:var(--r-lg);transition:transform .25s var(--ease),box-shadow .25s var(--ease),border-color .2s}
      .pillar:hover,.role-card:hover{transform:translateY(-4px);box-shadow:var(--sh-lg);border-color:#cfe3d5}
      .tiles{gap:14px}
      .tile{border-radius:var(--r-lg);border:1px solid var(--line);background:#fff;position:relative;overflow:hidden;box-shadow:var(--sh-sm);transition:transform .22s var(--ease),box-shadow .22s var(--ease);animation:fadeUp .5s var(--ease) both}
      .tile:before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--accent,var(--green))}
      .tile:hover{transform:translateY(-3px);box-shadow:var(--sh-md)}
      .tile:nth-child(2){animation-delay:.05s}.tile:nth-child(3){animation-delay:.1s}.tile:nth-child(4){animation-delay:.15s}
      .tile .v{font-family:'Lora',serif;font-size:27px;letter-spacing:-.02em;color:var(--ink)}
      .tile .k{color:var(--muted);font-size:12.5px}
      .badge{display:inline-flex;align-items:center;gap:6px;padding:4px 11px 4px 9px;border-radius:100px;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;border:1px solid transparent}
      .badge:before{content:'';width:6px;height:6px;border-radius:50%;background:currentColor}
      .badge.VALID{background:#e7f4ec;color:#0a6b39;border-color:#c7e6d3}
      .badge.EXPIRED{background:#fdf1dd;color:#9a6200;border-color:#f3dcae}
      .badge.REVOKED{background:#fdeaea;color:#b3261e;border-color:#f3c9c9}
      .status{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:100px;font-size:11px;font-weight:700}
      .status.HELD{background:#fdf1dd;color:#9a6200}
      .status.RELEASED{background:#e7f4ec;color:#0a6b39}
      .audit-tbl{border-collapse:separate;border-spacing:0;border-radius:var(--r-lg);overflow:hidden;box-shadow:var(--sh-sm);background:#fff}
      .audit-tbl thead th{background:#eef4f0;font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);padding:11px 14px;border-bottom:1px solid var(--line)}
      .audit-tbl tbody td{padding:11px 14px;border-bottom:1px solid #eef1ee;font-size:13.5px}
      .audit-tbl tbody tr:nth-child(even){background:#fafcfb}
      .audit-tbl tbody tr:hover{background:var(--green-pale)}
      .audit-tbl tbody tr:last-child td{border-bottom:0}
      .field input,.field select,.field textarea{border-radius:var(--r);transition:border-color .18s,box-shadow .18s}
      .field input:focus,.field select:focus,.field textarea:focus{outline:none;border-color:var(--green);box-shadow:0 0 0 3px rgba(0,102,0,.13)}
      .sidelink{transition:background .16s,color .16s,transform .16s var(--ease)}
      .sidelink:hover{transform:translateX(2px)}
      .chartgrid .chartcard{animation:fadeUp .5s var(--ease) both}
      @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
      @keyframes fadeIn{from{opacity:0}to{opacity:1}}
      @keyframes shimmer{0%{background-position:-460px 0}100%{background-position:460px 0}}
      @keyframes sealStamp{0%{opacity:0;transform:scale(1.5) rotate(-14deg)}60%{opacity:1;transform:scale(.94) rotate(3deg)}100%{transform:scale(1) rotate(0)}}
      @keyframes toastIn{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}
      @keyframes floaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
      .reveal{opacity:0;transform:translateY(22px)}
      .reveal.in{animation:fadeUp .7s var(--ease) forwards}
      .rise{animation:fadeUp .55s var(--ease) both}
      .skel{background:linear-gradient(90deg,#eef2ef 25%,#f6f9f7 37%,#eef2ef 63%);background-size:920px 100%;animation:shimmer 1.4s infinite linear;border-radius:8px;min-height:14px}
      .toasts{position:fixed;right:18px;bottom:18px;display:flex;flex-direction:column;gap:10px;z-index:200;max-width:340px}
      .toast{background:#0e2a1c;color:#eaf5ee;padding:12px 15px;border-radius:12px;box-shadow:var(--sh-lg);font-size:13.5px;animation:toastIn .35s var(--ease);border-left:4px solid var(--green-glow)}
      .toast.warn{border-left-color:var(--gold)}.toast.err{border-left-color:#ef5350}.toast b{color:#fff}
      .seal{animation:sealStamp .75s var(--ease)}
      .trust{border-radius:var(--r-xl);padding:26px;display:flex;gap:22px;align-items:center;box-shadow:var(--sh-md);border:1px solid var(--line);flex-wrap:wrap}
      .trust.ok{background:linear-gradient(180deg,#effaf2,#fff);border-color:#c7e6d3}
      .trust.no{background:linear-gradient(180deg,#fdf0f0,#fff);border-color:#f3c9c9}
      .trust .who2 b{font-family:'Lora',serif;font-size:24px;letter-spacing:-.02em;display:block}
      .floaty{animation:floaty 6s ease-in-out infinite}
      .placeholder{border:1.5px dashed #d3ddd6;border-radius:var(--r-lg);background:#fbfdfc;color:var(--muted);text-align:center;padding:30px 20px;font-size:14px}
      .skelrow{display:flex;flex-direction:column;gap:10px;padding:8px 0}
      @media(max-width:640px){
        .wrap{padding:0 16px}
        .hdr .wrap{padding:0 16px}
        .sec{font-size:26px}
        .card{padding:16px}
        .tiles{grid-template-columns:repeat(2,1fr);gap:10px}
        .tile{padding:14px}
        .tile .v{font-size:22px}
        .chartgrid{grid-template-columns:1fr}
        .audit-tbl{min-width:560px}
        .barrow{grid-template-columns:92px 1fr auto}
        .row-between{flex-wrap:wrap;gap:10px}
        .trust{padding:18px;gap:16px}
        .trust img{width:88px !important;height:104px !important}
        .apptop{padding:0 14px;gap:8px}
        .apptop .wsbtn span{display:none}
        .split-tbl td{font-size:13px}
      }
      @media(max-width:420px){
        .tiles{grid-template-columns:1fr}
        .hero h1{font-size:31px}
        .sec{font-size:22px}
        .apptop .actions{gap:6px}
        .btn{padding:9px 13px}
      }
      @media(prefers-reduced-motion:reduce){.reveal,.reveal.in,.rise,.seal,.toast,.floaty,.skel,.tile,.chartgrid .chartcard{animation:none!important;opacity:1!important;transform:none!important}.btn:hover,.tile:hover,.pillar:hover,.role-card:hover,.sidelink:hover{transform:none}}
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

function LangPicker({ lang, onLang }) {
  const [open, setOpen] = useState(false)
  const cur = LANGS.find(l => l.id === lang) || LANGS[0]
  return (
    <div className="wswrap">
      <button className="iconbtn lang" onClick={() => setOpen(v => !v)} aria-label="Switch language" aria-expanded={open}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20" /></svg>
        <span>{cur.id.toUpperCase()}</span>
      </button>
      {open && (
        <div className="wsmenu" onMouseLeave={() => setOpen(false)}>
          <div className="wshead">Language</div>
          {LANGS.map(l => <button key={l.id} className={'wsitem ' + (l.id === lang ? 'on' : '')} onClick={() => { onLang(l.id); setOpen(false) }}><span className="wsdot" />{l.label}</button>)}
        </div>
      )}
    </div>
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
          <LangPicker lang={lang} onLang={onLang} />
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

function NavIcon({ id }) {
  const paths = {
    testing: <><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>,
    verify: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></>,
    queue: <><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></>,
    team: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    water: <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />,
    ledger: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>,
    releases: <><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></>,
    fund: <><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4z" /></>,
    reconcile: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>,
    enforcement: <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
    audit: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></>,
    accreditation: <><circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" /></>,
    review: <><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></>,
    certificates: <><circle cx="12" cy="8" r="6" /><path d="M15.48 12.89 17 22l-5-3-5 3 1.52-9.11" /></>,
    analytics: <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{paths[id] || <circle cx="12" cy="12" r="9" />}</svg>
}

function Sidebar({ tabs, active, onTab, onBrand, open, onClose }) {
  return (
    <>
      <aside className={'sidebar' + (open ? ' open' : '')}>
        <button className="sidebrand" onClick={() => { onBrand(); onClose() }}>
          <img className="crest" src="/lagos-logo.png" alt="Lagos State Government" />
          <span className="wordmark sideword"><b>Safe<span>Plate</span></b></span>
        </button>
        <nav className="sidenav">
          {tabs.map(tb => (
            <button key={tb.id} className={'sidelink' + (active === tb.id ? ' on' : '')} onClick={() => { onTab(tb.id); onClose() }}>
              <NavIcon id={tb.id} /><span>{tb.label}</span>
            </button>
          ))}
        </nav>
      </aside>
      {open && <div className="sidebackdrop" onClick={onClose} />}
    </>
  )
}

function AppTopBar({ session, onSignOut, lang, onLang, onPrivacy, admin, workspace, onSwitch, onMenu }) {
  const [bell, setBell] = useState(false)
  const [menu, setMenu] = useState(false)
  const [ws, setWs] = useState(false)
  const [notices, setNotices] = useState([])
  useEffect(() => { if (session) store.listNotices(session).then(setNotices) }, [session, lang])
  async function toggleBell() { if (!bell) setNotices(await store.listNotices(session)); setBell(v => !v); setMenu(false) }
  const initials = (session && session.name ? session.name : '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <header className="apptop">
      <button className="hamburger" onClick={onMenu} aria-label="Menu">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
      </button>
      <div className="actions">
        <button className="iconbtn" onClick={openHelp} aria-label="Help and support" title="Help and support">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
        </button>
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
        <LangPicker lang={lang} onLang={onLang} />
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
      </div>
    </header>
  )
}

const SUPPORT = { phone: '0800-SAFE-PLATE', email: 'support@safeplate.lagosstate.gov.ng', hours: 'Monday to Friday, 8am to 5pm' }
let _helpFns = []
function openHelp() { _helpFns.forEach(f => f()) }

function HelpCentre() {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ category: 'Technical problem', subject: '', body: '', reporter: '' })
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  useEffect(() => { const fn = () => { setOpen(true); setDone(false) }; _helpFns.push(fn); return () => { _helpFns = _helpFns.filter(x => x !== fn) } }, [])
  async function submit() {
    if (!f.subject.trim() || !f.body.trim()) return
    setBusy(true)
    try { await store.createTicket({ reporter: f.reporter.trim() || 'anonymous', role: 'public', category: f.category, subject: f.subject.trim(), body: f.body.trim() }); setDone(true); toast('Your report has been sent to the SafePlate support team.') }
    catch (e) { toast('Could not send your report. Please call ' + SUPPORT.phone + '.', 'err') }
    setBusy(false)
  }
  if (!open) return null
  return (
    <div className="modal-bg" onClick={() => setOpen(false)}>
      <div className="modal privacy" role="dialog" aria-modal="true" aria-label="Help and support" onClick={e => e.stopPropagation()}>
        <div className="row-between" style={{ alignItems: 'flex-start' }}>
          <div>
            <div className="kicker" style={{ color: 'var(--green)' }}>Help and support</div>
            <h3 className="serif" style={{ fontSize: 22, margin: '2px 0 0' }}>We are here to help</h3>
          </div>
          <button className="btn ghost sm" onClick={() => setOpen(false)}>Close</button>
        </div>
        <div className="card" style={{ marginTop: 14 }}>
          <div style={{ fontSize: 14, lineHeight: 1.9 }}>
            <div><b>Call:</b> <a href={'tel:' + SUPPORT.phone.replace(/[^0-9A-Za-z]/g, '')} style={{ color: 'var(--green)' }}>{SUPPORT.phone}</a> <span className="muted">({SUPPORT.hours})</span></div>
            <div><b>Email:</b> <a href={'mailto:' + SUPPORT.email} style={{ color: 'var(--green)' }}>{SUPPORT.email}</a></div>
          </div>
        </div>
        {done ? (
          <div className="note" style={{ marginTop: 14 }}>Thank you. Your report has been logged and the support team will follow up. For anything urgent, call {SUPPORT.phone}.</div>
        ) : (
          <div style={{ marginTop: 14 }}>
            <h4 className="serif" style={{ fontSize: 16, margin: '0 0 8px' }}>Report a problem</h4>
            <div className="field"><label>What is this about?</label><select value={f.category} onChange={e => setF({ ...f, category: e.target.value })}><option>Technical problem</option><option>Payment problem</option><option>Certificate or result query</option><option>Report misconduct</option><option>Something else</option></select></div>
            <div className="field"><label>Your email or phone (so we can reply)</label><input value={f.reporter} onChange={e => setF({ ...f, reporter: e.target.value })} placeholder="you@example.com or 080..." /></div>
            <div className="field"><label>Subject</label><input value={f.subject} onChange={e => setF({ ...f, subject: e.target.value })} placeholder="Short summary" /></div>
            <div className="field"><label>Details</label><textarea rows={3} value={f.body} onChange={e => setF({ ...f, body: e.target.value })} placeholder="Tell us what happened, and any SAFEPLATE ID involved" /></div>
            <button className="btn p sm" onClick={submit} disabled={busy || !f.subject.trim() || !f.body.trim()}>{busy ? 'Sending...' : 'Send report'}</button>
          </div>
        )}
      </div>
    </div>
  )
}

function SupportTickets() {
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

function Footer({ onPrivacy }) {
  return (
    <footer className="footer"><div className="wrap">
      <div><b>SafePlate</b><br />Operated by the Lagos State Ministry of Health.<br />Oversight: LSMoH, LASEPA, HEFAMAA. Escrow: Sterling Bank.</div>
      <div style={{ textAlign: 'right' }}>One Health strategy for food and water safety.<br />NAFDAC Food Hygiene Regulation 2019, NDPA 2023 and GDPR aligned.<br /><button className="foot-lnk" onClick={openHelp}>Help and support</button> · <button className="foot-lnk" onClick={onPrivacy}>Privacy notice</button> &middot; {SUPABASE_READY ? 'Connected backend' : 'Preview mode'}</div>
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
        <div className="hero-art"><img className="floaty" src="/lagos-logo.png" alt="Lagos State Government coat of arms" /></div>
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
      <div className="pillars">{PILLARS.map((p, i) => (
        <div className="pillar reveal" key={p.n} style={{ animationDelay: (i * 0.08) + 's' }}><div className="num">{p.n}</div><h3 className="serif">{p.title}</h3><p>{p.body}</p></div>
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
      <div className="burden">{BURDEN.map((b, i) => (
        <div className="cell reveal" key={b.label} style={{ animationDelay: (i * 0.08) + 's' }}><div className="big">{b.stat}</div><div className="lbl">{b.label}</div><div className="src">Source: {b.src}</div></div>
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
        <div className={'trust ' + (result.status === 'VALID' ? 'ok' : 'no')} style={{ marginTop: 8 }}>
          <div className="seal-wrap">{result.status === 'VALID' ? <Seal size={110} /> : <CrossSeal size={110} />}</div>
          <div className="who2" style={{ flex: 1, minWidth: 210 }}>
            <span className={'badge ' + result.status}>{result.status === 'VALID' ? 'Valid certificate' : result.status === 'EXPIRED' ? 'Expired' : 'Revoked'}</span>
            <b style={{ marginTop: 10 }}>{result.name}</b>
            <div className="mono" style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>{result.safeplateId || result.safeplate_id}</div>
            <div className="muted" style={{ fontSize: 13.5, lineHeight: 1.75 }}>Panel: {result.panel}<br />Laboratory: {result.lab}<br />Expires {new Date(result.expiry || result.expiry_date).toLocaleDateString('en-GB')}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>Checked {new Date().toLocaleString('en-GB')}</div>
            {result.status === 'VALID' && <button className="btn g" style={{ marginTop: 14 }} onClick={() => generateCertPDF(result)}>Download certificate (PDF)</button>}
          </div>
          {result.photo && <img src={result.photo} alt="Certificate holder" style={{ width: 108, height: 128, objectFit: 'cover', borderRadius: 12, border: '3px solid ' + (result.status === 'VALID' ? 'var(--green)' : '#e3c9c9'), boxShadow: 'var(--sh-md)' }} />}
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
      <p className="sub">{t('verify_sub')} Try SP-LG-2026001015 (valid), SP-LG-2025001037 (expired), SP-LG-2026001042 (revoked).</p>
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
    case 'officer': return (agency || 'Field') + ' Field Officer'
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
  const [labForm, setLabForm] = useState({ labName: '', contactPerson: '', phone: '', address: '', lga: '' })
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
      if (mode === 'signup' && role.id === 'laboratory' && !labForm.labName.trim()) { setErr('Please enter your laboratory name.'); setBusy(false); return }
      const meta = { role: role.id, agency: ['regulator', 'officer'].includes(role.id) ? agency : null, name: name || email.split('@')[0], title: roleTitle(role.id, agency) }
      const user = mode === 'signup' ? await store.signUp(email, password, meta) : await store.signIn(email, password, role.id, meta.agency, meta.name)
      let finalUser = { ...user, email: user.email || email, role: user.role || role.id, agency: user.agency || meta.agency, title: user.title || meta.title, name: user.name || meta.name }
      if (finalUser.role === 'officer') {
        let off = await store.getOfficerByEmail(finalUser.email)
        if (!off) { off = await store.addOfficer({ name: finalUser.name, email: finalUser.email, agency: finalUser.agency, status: 'Pending' }) }
        finalUser = { ...finalUser, status: off.status, badge: off.badge, lga: off.lga, target: off.target, agency: off.agency || finalUser.agency }
      }
      if (finalUser.role === 'laboratory' && mode === 'signup' && labForm.labName.trim()) {
        try { await store.registerLab({ name: labForm.labName.trim(), contactPerson: labForm.contactPerson.trim(), phone: labForm.phone.trim(), address: labForm.address.trim(), lga: labForm.lga }) } catch (e) { /* lab can still sign in; HEFAMAA can add later */ }
      }
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
        {['regulator', 'officer'].includes(role.id) && (
          <div className="field"><label>Agency</label><select value={agency} onChange={e => setAgency(e.target.value)}>{AGENCIES.map(a => <option key={a}>{a}</option>)}</select></div>
        )}
        {mode === 'signup' && role.id === 'laboratory' && (
          <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px', marginBottom: 12, background: '#fafcfb' }}>
            <div className="kicker" style={{ color: 'var(--green)', marginBottom: 8 }}>Laboratory registration</div>
            <div className="field"><label>Laboratory name</label><input value={labForm.labName} onChange={e => setLabForm({ ...labForm, labName: e.target.value })} placeholder="e.g. Lancet Ikeja" /></div>
            <div className="field"><label>Contact person</label><input value={labForm.contactPerson} onChange={e => setLabForm({ ...labForm, contactPerson: e.target.value })} placeholder="Full name of lab manager" /></div>
            <div className="field"><label>Phone</label><input value={labForm.phone} onChange={e => setLabForm({ ...labForm, phone: e.target.value })} placeholder="080..." /></div>
            <div className="field"><label>Address</label><input value={labForm.address} onChange={e => setLabForm({ ...labForm, address: e.target.value })} placeholder="Street and area" /></div>
            <div className="field"><label>LGA</label><select value={labForm.lga} onChange={e => setLabForm({ ...labForm, lga: e.target.value })}><option value="">Select LGA</option>{LAGOS_LGAS.map(l => <option key={l}>{l}</option>)}</select></div>
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>Your laboratory is submitted to HEFAMAA for accreditation. You can sign in immediately; you can receive samples once approved.</p>
          </div>
        )}
        {mode === 'signup' && <div className="field"><label>{role.id === 'laboratory' ? 'Your full name' : 'Full name'}</label><input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" /></div>}
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

function AppealButton({ kind, subject, agency, by, label }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  async function submit() { if (!reason.trim()) return; setBusy(true); try { await store.createAppeal({ kind, subject, agency, appellant: by || 'unknown', reason: reason.trim() }); setDone(true); toast('Appeal lodged with ' + agency + '. You will be contacted with the outcome.') } catch (e) { toast('Could not lodge the appeal, please try again.', 'err') } setBusy(false) }
  if (done) return <div className="note" style={{ marginTop: 12 }}>Your appeal has been lodged with {agency}. You will be contacted with the outcome.</div>
  return (
    <div style={{ marginTop: 12 }}>
      {!open && <button className="btn sm" onClick={() => setOpen(true)}>{label || 'Lodge an appeal'}</button>}
      {open && (
        <div className="card">
          <div className="kicker" style={{ color: 'var(--green)' }}>Lodge an appeal to {agency}</div>
          <div className="field"><label>Reason for appeal</label><textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Explain why you believe this decision should be reviewed" /></div>
          <div className="row-between"><button className="btn ghost sm" onClick={() => setOpen(false)}>Cancel</button><button className="btn p sm" onClick={submit} disabled={busy || !reason.trim()}>{busy ? 'Submitting...' : 'Submit appeal'}</button></div>
        </div>
      )}
    </div>
  )
}

function AppealsList({ agency }) {
  const [rows, setRows] = useState(null)
  useEffect(() => { load() /* eslint-disable-next-line */ }, [])
  async function load() { setRows(await store.listAppeals(agency)) }
  async function resolve(a, status) { await store.resolveAppeal(a.id, status === 'Upheld' ? 'Appeal upheld, decision reversed' : 'Appeal declined, decision stands', status); load() }
  if (!rows) return null
  return (
    <div style={{ marginTop: 26 }}>
      <h3 className="serif" style={{ fontSize: 18, marginBottom: 4 }}>Appeals</h3>
      <p className="muted" style={{ marginTop: 0, fontSize: 13, marginBottom: 12 }}>Appeals lodged for {agency} review, from food handlers, employers and laboratories.</p>
      {rows.length === 0 && <div className="placeholder">No appeals lodged.</div>}
      {rows.map((a, i) => (
        <div className="ord" key={a.id || i} style={{ marginBottom: 10 }}>
          <div className="top"><div><b>{a.subject}</b> <span className="muted" style={{ fontSize: 12 }}>· {a.kind} · {a.appellant}</span></div><span className="badge" style={a.status === 'Open' ? { background: '#fdf3e0', color: '#8a5a00' } : { background: 'var(--green-pale)', color: 'var(--green)' }}>{a.status}</span></div>
          <div className="muted" style={{ fontSize: 13.5, marginTop: 6 }}>{a.reason}</div>
          {a.status === 'Open' && <div className="row-between" style={{ marginTop: 10 }}><button className="btn sm" onClick={() => resolve(a, 'Declined')}>Decline</button><button className="btn p sm" onClick={() => resolve(a, 'Upheld')}>Uphold appeal</button></div>}
          {a.resolution && <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>Outcome: {a.resolution}</div>}
        </div>
      ))}
    </div>
  )
}

function journeyStep(order, cert) {
  if (cert && cert.status === 'VALID') return 6
  const st = (order && order.status) || ''
  if (/Rejected|Flagged/.test(st)) return 5
  if (st === 'Submitted') return 5
  if (/Approved/.test(st)) return 6
  if (/Scheduled|Sample|Testing/.test(st)) return 4
  return 3
}

function FoodDashboard({ data, session, onNew }) {
  const { h, cert, order } = data
  const step = journeyStep(order, cert)
  const valid = cert && cert.status === 'VALID'
  const st = (order && order.status) || ''
  const issue = /Rejected|Flagged/.test(st)
  const days = cert && cert.expiry ? Math.ceil((new Date(cert.expiry).getTime() - Date.now()) / 86400000) : null
  return (
    <div className="page"><div className="wrap">
      <div className="greeting"><h2 className="sec serif" style={{ margin: 0 }}>Hello, {(h.name || '').split(' ')[0]}</h2><span className="muted" style={{ fontSize: 13 }}>{session.title}</span></div>
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="row-between">
          <div><div className="kicker" style={{ color: 'var(--green)' }}>Your SAFEPLATE ID</div><div className="mono" style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink)' }}>{h.safeplateId}</div></div>
          {valid ? <span className="badge VALID">CERTIFIED</span> : <span className="badge" style={{ background: issue ? '#fdeeee' : '#fdf3e0', color: issue ? '#b3261e' : '#8a5a00' }}>{issue ? st : 'IN PROGRESS'}</span>}
        </div>
      </div>
      <FoodJourney step={step} />
      {valid && (
        <div className="card">
          <div className="row-between" style={{ alignItems: 'flex-start' }}>
            <div>
              <div className="kicker" style={{ color: 'var(--green)' }}>Certificate of Fitness</div>
              <h3 className="serif" style={{ fontSize: 20, margin: '4px 0' }}>{h.name}</h3>
              <div className="muted" style={{ fontSize: 13 }}>{cert.cert_no || cert.certNo || ''}</div>
              <div style={{ marginTop: 10, fontSize: 14 }}>Expires {new Date(cert.expiry).toLocaleDateString('en-GB')}</div>
              <div style={{ fontWeight: 700, color: days <= 30 ? '#b3261e' : 'var(--green)', marginTop: 2 }}>{days > 0 ? days + ' days remaining' : 'Expired, renew now'}</div>
              <button className="btn g" style={{ marginTop: 14 }} onClick={() => generateCertPDF(cert)}>Download certificate (PDF)</button>
            </div>
            {(cert.photo || h.photo) && <img src={cert.photo || h.photo} alt="" style={{ width: 96, height: 112, objectFit: 'cover', borderRadius: 10, border: '2px solid var(--green)' }} />}
          </div>
        </div>
      )}
      {issue && <AppealButton kind="result" subject={h.safeplateId} agency="LSMoH" by={session.email} label="Lodge an appeal on this result" />}
      {!valid && !issue && <div className="note" style={{ marginTop: 4 }}>Your test is progressing. Once the Ministry approves your result, your Certificate of Fitness appears here.</div>}
      <button className="btn ghost sm" style={{ marginTop: 16 }} onClick={onNew}>Start a new registration</button>
    </div></div>
  )
}

function FoodHandlerModule({ session }) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({ name: session.name || '', phone: '', dob: '', gender: '', address: '', lga: '', nin: '', email: session.email || '', employer: '', employerAddress: '', photo: '', safeplateId: '', lab: null, paid: false })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const nextDue = useMemo(() => { const d = new Date(); d.setMonth(d.getMonth() + 6); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) }, [])
  const [checking, setChecking] = useState(true)
  const [mine, setMine] = useState(null)
  const [showWizard, setShowWizard] = useState(false)
  const [labs, setLabs] = useState(() => labsView())
  useEffect(() => { store.allLabs().then(setLabs).catch(() => {}) }, [])
  useEffect(() => { (async () => { try { const hh = await store.getMyHandler(session); if (hh) { const cert = await store.verifyCertificate(hh.safeplateId); const order = await store.getOrderFor(hh.safeplateId); setMine({ h: hh, cert, order }) } } catch (e) { /* ignore */ } setChecking(false) })() /* eslint-disable-next-line */ }, [])

  async function register() {
    setErr('')
    if (!form.name.trim() || !form.phone.trim()) { setErr('Name and phone number are required to register.'); return }
    if (!form.dob || !form.gender || !form.lga) { setErr('Date of birth, gender and LGA are required.'); return }
    if (!/^0\d{10}$/.test((form.phone || '').replace(/\s+/g, ''))) { setErr('Enter a valid 11-digit phone number, e.g. 08031234567.'); return }
    if (form.nin && !/^\d{11}$/.test((form.nin || '').replace(/\s+/g, ''))) { setErr('NIN must be exactly 11 digits.'); return }
    if (!form.photo) { setErr('A passport photo is required. It is printed on your certificate to prevent anyone else using it.'); return }
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
      setF('paid', true); setStep(4); toast('Payment received, held in escrow.')
    } catch (e) { setErr('Payment could not be completed. Your test order is saved for 48 hours, try again.') } finally { setBusy(false) }
  }

  if (checking) return <div className="page"><div className="wrap"><div className="skelrow"><div className="skel" style={{height:80}} /><div className="skel" style={{height:120}} /><div className="skel" style={{height:180}} /></div></div></div>
  if (mine && !showWizard) return <FoodDashboard data={mine} session={session} onNew={() => { setShowWizard(true); setStep(0) }} />

  return (
    <div className="page"><div className="wrap">
      <div className="greeting"><h2 className="sec serif" style={{ margin: 0 }}>{t('fh_title')}</h2><span className="muted" style={{ fontSize: 13 }}>{session.title}</span></div>
      <FoodJourney step={step} />
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
          <div className="field"><label>Passport photo <span style={{ color: 'var(--green)' }}>(required)</span></label><input type="file" accept="image/*" onChange={async e => { const f = e.target.files && e.target.files[0]; if (f) { try { setF('photo', await compressImage(f)) } catch { /* ignore */ } } }} /><div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Your photo is printed on your certificate so it cannot be used by anyone else.</div>{form.photo && <img src={form.photo} alt="preview" style={{ marginTop: 8, width: 84, height: 96, objectFit: 'cover', borderRadius: 10, border: '2px solid var(--green)' }} />}</div>
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
          {labs.map(l => (
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
            <tr><td>Laboratory</td><td>{form.lab?.name}</td></tr>
            <tr><td>Test panel</td><td>Hepatitis A, Hepatitis E, Stool MC</td></tr>
            <tr className="tot"><td>Amount held in escrow</td><td>{naira(FEE)}</td></tr>
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
  const [accreditedLabs, setAccreditedLabs] = useState(() => labsView().filter(l => l.accredited))
  useEffect(() => { store.accreditedLabList().then(list => { if (list && list.length) setAccreditedLabs(list) }).catch(() => {}) }, [])
  const [labName, setLabName] = useState(() => { const a = labsView().filter(l => l.accredited); return a[0] ? a[0].name : '' })
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const lab = accreditedLabs.find(l => l.name === labName)
  async function refresh() { setLoading(true); setOrders(await store.listOrders(labName)); setLoading(false) }
  useEffect(() => { refresh() /* eslint-disable-next-line */ }, [labName])
  async function advance(o, status) {
    if (SUPABASE_READY) { try { await store.fn('advance-order', { orderId: o.id, status }); toast('Sample updated: ' + status + '.'); refresh(); return } catch (e) { toast('Could not update the sample: ' + (e.message || 'try again'), 'err'); return } }
    await store.updateOrder(o.id, { status }); toast('Sample updated: ' + status + '.'); refresh()
  }

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
      <Insights session={session} />
      <AppealButton kind="laboratory" subject={labName} agency="LSMoH" by={session.email} label="Raise a dispute or appeal with the Ministry" />
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

const MINI = { padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 9, fontFamily: 'inherit', fontSize: 14, flex: '1 1 130px', minWidth: 110, background: '#fff' }

function OfficersAdmin({ agency }) {
  const [officers, setOfficers] = useState(null)
  const [nf, setNf] = useState({ name: '', email: '', phone: '', badge: '', lga: '', target: '20' })
  const [pf, setPf] = useState({})
  const [q, setQ] = useState('')
  useEffect(() => { load() /* eslint-disable-next-line */ }, [])
  async function load() { setOfficers(await store.listOfficers(agency)) }
  async function add() {
    if (!nf.name.trim() || !nf.email.trim()) return
    if (nf.badge && officers.some(o => (o.badge || '') === nf.badge.trim())) { toast('That badge number is already in use.', 'err'); return }
    await store.addOfficer({ ...nf, badge: nf.badge.trim(), target: Number(nf.target) || 20, agency, status: 'Active' })
    setNf({ name: '', email: '', phone: '', badge: '', lga: '', target: '20' }); toast('Officer added to the roster.'); load()
  }
  async function approve(o) {
    const patch = pf[o.id] || {}
    let badge = (patch.badge || o.badge || '').trim()
    if (!badge) {
      // Generate the next free badge for this agency rather than a random one,
      // which could collide with a badge already issued.
      const used = new Set(officers.map(x => (x.badge || '').trim()).filter(Boolean))
      let n = 101
      while (used.has(agency + '-' + n)) n++
      badge = agency + '-' + n
    }
    if (officers.some(x => x.id !== o.id && (x.badge || '') === badge)) { toast('That badge number is already in use. Enter a different one.', 'err'); return }
    await store.updateOfficer(o.id, { status: 'Active', badge, lga: patch.lga || o.lga || '' })
    toast('Officer approved and activated.'); load()
  }
  async function setStatus(o, status) { await store.updateOfficer(o.id, { status }); toast('Officer ' + status.toLowerCase() + '.'); load() }
  if (!officers) return <div className="skelrow"><div className="skel" style={{ height: 74 }} /><div className="skel" style={{ height: 140 }} /></div>
  const pending = officers.filter(o => o.status === 'Pending')
  const active = officers.filter(o => o.status !== 'Pending')
  return (
    <div>
      <div className="note" style={{ marginBottom: 16 }}>Field officers who inspect, sanction, verify and sample on behalf of {agency}. Add them here, or approve officers who have self-registered.</div>
      <div className="tiles" style={{ marginBottom: 16 }}>
        <div className="tile"><div className="v">{officers.length}</div><div className="k">Officers</div></div>
        <div className="tile"><div className="v">{officers.filter(o => o.status === 'Active').length}</div><div className="k">Active</div></div>
        <div className="tile"><div className="v">{pending.length}</div><div className="k">Pending approval</div></div>
        <div className="tile"><div className="v">{officers.filter(o => o.status === 'Suspended').length}</div><div className="k">Suspended</div></div>
      </div>
      {pending.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 className="serif" style={{ fontSize: 17, marginBottom: 8 }}>Pending approvals</h3>
          {pending.map(o => (
            <div className="ord" key={o.id}>
              <div className="top"><div><b>{o.name}</b> <span className="muted" style={{ fontSize: 12 }}>· {o.email}</span></div><span className="badge" style={{ background: '#fdf1dd', color: '#9a6200' }}>Pending</span></div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <input placeholder="Badge no." value={(pf[o.id] || {}).badge || ''} onChange={e => setPf({ ...pf, [o.id]: { ...(pf[o.id] || {}), badge: e.target.value } })} style={MINI} />
                <select value={(pf[o.id] || {}).lga || ''} onChange={e => setPf({ ...pf, [o.id]: { ...(pf[o.id] || {}), lga: e.target.value } })} style={MINI}><option value="">Assign LGA</option>{LAGOS_LGAS.map(l => <option key={l}>{l}</option>)}</select>
                <button className="btn p sm" onClick={() => approve(o)}>Approve</button>
                <button className="btn sm danger" onClick={() => setStatus(o, 'Declined')}>Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <h3 className="serif" style={{ fontSize: 17, marginBottom: 8 }}>Add an officer</h3>
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input placeholder="Full name" value={nf.name} onChange={e => setNf({ ...nf, name: e.target.value })} style={MINI} />
          <input placeholder="Email" value={nf.email} onChange={e => setNf({ ...nf, email: e.target.value })} style={MINI} />
          <input placeholder="Phone" value={nf.phone} onChange={e => setNf({ ...nf, phone: e.target.value })} style={MINI} />
          <input placeholder="Badge no." value={nf.badge} onChange={e => setNf({ ...nf, badge: e.target.value })} style={MINI} />
          <select value={nf.lga} onChange={e => setNf({ ...nf, lga: e.target.value })} style={MINI}><option value="">LGA</option>{LAGOS_LGAS.map(l => <option key={l}>{l}</option>)}</select>
          <input placeholder="Monthly target" type="number" min="1" value={nf.target} onChange={e => setNf({ ...nf, target: e.target.value })} style={MINI} />
          <button className="btn p sm" onClick={add}>Add officer</button>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 10, marginBottom: 0 }}>The officer signs in with this email and is active immediately. Officers who self-register appear above for your approval.</p>
      </div>
      <h3 className="serif" style={{ fontSize: 17, marginBottom: 8 }}>Roster</h3>
      <SearchBar value={q} onChange={setQ} placeholder="Search officers by name, badge, area or email..." />
      <div style={{ overflowX: 'auto' }}>
        <table className="audit-tbl">
          <thead><tr><th>Name</th><th>Badge</th><th>Area</th><th>Target</th><th>Contact</th><th>Status</th><th></th></tr></thead>
          <tbody>{active.filter(o => smatch(q, o.name, o.badge, o.lga, o.email)).length === 0 ? <tr><td colSpan={7} className="muted" style={{ padding: 16 }}>{active.length ? 'No officers match your search.' : 'No active officers yet.'}</td></tr> : active.filter(o => smatch(q, o.name, o.badge, o.lga, o.email)).map(o => (
            <tr key={o.id}>
              <td>{o.name}</td>
              <td className="mono">{o.badge || '\u2014'}</td>
              <td>{o.lga || '\u2014'}</td>
              <td><input type="number" min="1" defaultValue={o.target || 20} aria-label={'Monthly target for ' + o.name} onBlur={e => { const v = Number(e.target.value) || 20; if (v !== (o.target || 20)) { store.updateOfficer(o.id, { target: v }).then(() => { toast('Target updated for ' + o.name + '.'); load() }) } }} style={{ width: 62, padding: '5px 7px', border: '1px solid var(--line)', borderRadius: 7, fontFamily: 'inherit', fontSize: 13 }} /></td>
              <td className="muted">{o.email}</td>
              <td><span className="badge" style={o.status === 'Active' ? { background: '#e7f4ec', color: '#0a6b39' } : { background: '#fdeaea', color: '#b3261e' }}>{o.status}</span></td>
              <td>{o.status === 'Active' ? <button className="btn xs danger" onClick={() => setStatus(o, 'Suspended')}>Suspend</button> : o.status === 'Suspended' ? <button className="btn xs" onClick={() => setStatus(o, 'Active')}>Reactivate</button> : null}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  )
}

function SanctionApprovals({ agency }) {
  const [rows, setRows] = useState(null)
  useEffect(() => { load() /* eslint-disable-next-line */ }, [])
  async function load() { const all = await store.listInspections(agency); setRows(all.filter(r => r.kind === 'sanction' && r.sanctionStatus === 'Recommended')) }
  async function decide(r, ok) {
    await store.updateInspection(r.id, { sanctionStatus: ok ? 'Approved' : 'Declined' })
    if (ok && r.targetId) { try { await store.updateEstablishment(r.targetId, { sanction: r.sanction, appeal: null }) } catch (e) { /* ignore */ } }
    toast(ok ? (r.sanction + ' approved and applied.') : 'Recommendation declined.', ok ? '' : 'warn'); load()
  }
  if (!rows || !rows.length) return null
  return (
    <div style={{ marginTop: 24 }}>
      <h3 className="serif" style={{ fontSize: 18, marginBottom: 4 }}>Sanction approvals</h3>
      <p className="muted" style={{ marginTop: 0, fontSize: 13, marginBottom: 12 }}>Severe sanctions recommended by field officers, awaiting supervisor sign-off.</p>
      {rows.map((r, i) => (
        <div className="ord" key={r.id || i}>
          <div className="top"><div><b>{r.subject}</b> <span className="muted" style={{ fontSize: 12 }}>· {r.sanction} · recommended by {r.officer}</span></div><span className="badge" style={{ background: '#fdf1dd', color: '#9a6200' }}>Recommended</span></div>
          {r.note && <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{r.note}</div>}
          {Array.isArray(r.photos) && r.photos.length > 0 && <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>{r.photos.map((src, k) => <img key={k} src={src} alt="Inspection evidence" style={{ width: 68, height: 68, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line)' }} />)}</div>}
          <div className="row-between" style={{ marginTop: 10 }}><button className="btn sm" onClick={() => decide(r, false)}>Decline</button><button className="btn sm danger" onClick={() => decide(r, true)}>Approve and apply</button></div>
        </div>
      ))}
    </div>
  )
}

function OfficerProgress({ session }) {
  const [rows, setRows] = useState(null)
  useEffect(() => { store.listInspections(session.agency, session.email).then(setRows).catch(() => setRows([])) /* eslint-disable-next-line */ }, [])
  if (!rows) return null
  const target = Number(session.target) || 20
  const now = new Date()
  const thisMonth = rows.filter(r => { const d = new Date(r.ts); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() })
  const done = thisMonth.filter(r => r.kind === 'inspection').length
  const pct = Math.min(100, Math.round((done / target) * 100))
  const met = done >= target
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="row-between" style={{ alignItems: 'baseline' }}>
        <div>
          <div className="kicker" style={{ color: 'var(--accent, var(--green))' }}>Your target this month</div>
          <div style={{ fontFamily: 'Lora,serif', fontSize: 20 }}>{done} of {target} inspections</div>
        </div>
        <span className="badge" style={met ? { background: '#e7f4ec', color: '#0a6b39' } : { background: '#fdf1dd', color: '#9a6200' }}>{met ? 'Target met' : (target - done) + ' to go'}</span>
      </div>
      <div className="bartrack" style={{ marginTop: 12, height: 12 }}><span className="barfill" style={{ width: pct + '%', background: met ? 'var(--green)' : 'var(--gold)' }} /></div>
      <div className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>{thisMonth.filter(r => r.kind === 'verify').length} certificate checks and {thisMonth.filter(r => r.kind === 'water').length} water samples also logged this month.</div>
    </div>
  )
}

function OfficerModule({ session, tab }) {
  const status = session.status || 'Active'
  if (status !== 'Active') return (
    <div className="page"><div className="wrap">
      <div className="card" style={{ textAlign: 'center', maxWidth: 520, margin: '0 auto' }}>
        <div className="kicker" style={{ color: 'var(--gold-deep)' }}>Awaiting approval</div>
        <h3 className="serif" style={{ fontSize: 22 }}>Your officer account is pending</h3>
        <p className="muted">Your {session.agency} administrator needs to approve your account and assign your badge and area before you can begin field work. You will be notified once approved.</p>
      </div>
    </div></div>
  )
  return (
    <div className="page"><div className="wrap">
      <div className="greeting"><h2 className="sec serif" style={{ margin: 0 }}>{session.agency} field officer</h2><span className="muted" style={{ fontSize: 13 }}>{session.name}{session.badge ? ' · ' + session.badge : ''}{session.lga ? ' · ' + session.lga : ''}</span></div>
      {(tab === 'field' || tab === 'activity') && <OfficerProgress session={session} />}
      {tab === 'field' && <OfficerField session={session} />}
      {tab === 'inspect' && <OfficerInspect session={session} />}
      {tab === 'water' && <OfficerWater session={session} />}
      {tab === 'activity' && <OfficerActivity session={session} />}
    </div></div>
  )
}

function OfficerField({ session }) {
  const [id, setId] = useState('')
  const [res, setRes] = useState(undefined)
  const [busy, setBusy] = useState(false)
  async function check() {
    if (!id.trim()) return; setBusy(true)
    const r = await store.verifyCertificate(id.trim())
    setRes(r || null)
    try { await store.createInspection({ officer: session.name, officerEmail: session.email, agency: session.agency, kind: 'verify', subject: id.trim().toUpperCase(), outcome: r ? r.status : 'Not found' }) } catch (e) { /* ignore */ }
    setBusy(false); toast('Field check logged.')
  }
  return (
    <div>
      <div className="note" style={{ marginBottom: 16 }}>Verify a food handler certificate on the spot. Every check is logged to the audit trail under your badge.</div>
      <div className="field" style={{ maxWidth: 380 }}><label>SAFEPLATE ID</label><input value={id} onChange={e => setId(e.target.value)} placeholder="SP-LG-YYYYNNNNN" onKeyDown={e => e.key === 'Enter' && check()} /></div>
      <button className="btn p sm" onClick={check} disabled={busy}>{busy ? 'Checking...' : 'Check certificate'}</button>
      {res === null && <div className="err" style={{ marginTop: 14 }}>No certificate found for that ID. The handler may be unregistered.</div>}
      {res && (
        <div className={'trust ' + (res.status === 'VALID' ? 'ok' : 'no')} style={{ marginTop: 16 }}>
          <div className="seal-wrap">{res.status === 'VALID' ? <Seal size={92} /> : <CrossSeal size={92} />}</div>
          <div className="who2" style={{ flex: 1, minWidth: 180 }}>
            <span className={'badge ' + res.status}>{res.status}</span>
            <b style={{ marginTop: 8 }}>{res.name}</b>
            <div className="mono" style={{ fontSize: 13, color: 'var(--muted)' }}>{res.safeplateId || res.safeplate_id}</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>Expires {new Date(res.expiry || res.expiry_date).toLocaleDateString('en-GB')}</div>
          </div>
          {res.photo && <img src={res.photo} alt="" style={{ width: 90, height: 106, objectFit: 'cover', borderRadius: 10, border: '2px solid var(--line)' }} />}
        </div>
      )}
    </div>
  )
}

function OfficerInspect({ session }) {
  const [targets, setTargets] = useState([])
  const [open, setOpen] = useState(null)
  const [outcome, setOutcome] = useState('Compliant')
  const [sanction, setSanction] = useState('')
  const [note, setNote] = useState('')
  const [photos, setPhotos] = useState([])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  async function addPhotos(files) {
    const list = Array.from(files || []).slice(0, 4 - photos.length)
    for (const f of list) {
      try { const d = await compressImage(f, 220); setPhotos(p => (p.length >= 4 ? p : [...p, d])) }
      catch (e) { toast('Could not read that photograph.', 'err') }
    }
  }
  const lab = session.agency === 'HEFAMAA'
  useEffect(() => { load() /* eslint-disable-next-line */ }, [])
  async function load() { setTargets(lab ? labsView() : await store.listEstablishments()) }
  async function submit(tgt) {
    const name = tgt.name
    setBusy(true)
    const pics = photos.filter(Boolean)
    try {
      await store.createInspection({ officer: session.name, officerEmail: session.email, agency: session.agency, kind: 'inspection', subject: name, outcome, note, photos: pics })
      if (sanction) {
        if (SANCTION_SEVERE.includes(sanction)) {
          await store.createInspection({ officer: session.name, officerEmail: session.email, agency: session.agency, kind: 'sanction', subject: name, sanction, sanctionStatus: 'Recommended', note, targetId: tgt.id, photos: pics })
          toast(sanction + ' recommended, sent to your supervisor for approval.', 'warn')
        } else {
          if (!lab) await store.updateEstablishment(tgt.id, { sanction, appeal: null })
          await store.createInspection({ officer: session.name, officerEmail: session.email, agency: session.agency, kind: 'sanction', subject: name, sanction, sanctionStatus: 'Applied', targetId: tgt.id, photos: pics })
          toast(sanction + ' applied.', 'warn')
        }
      } else { toast('Inspection recorded for ' + name + '.') }
      setOpen(null); setOutcome('Compliant'); setSanction(''); setNote(''); setPhotos([]); load()
    } catch (e) { toast('Could not save the inspection: ' + (e.message || 'try again'), 'err') }
    setBusy(false)
  }
  return (
    <div>
      <div className="note" style={{ marginBottom: 16 }}>Record an inspection of {lab ? 'a laboratory' : 'an establishment'}. A warning applies immediately; a fine, closure or licence action is sent to your supervisor for approval.</div>
      <SearchBar value={q} onChange={setQ} placeholder={lab ? 'Search laboratories...' : 'Search establishments by name or LGA...'} />
      {targets.filter(x => smatch(q, x.name, x.lga || x.area, x.compliance)).length === 0 && <div className="placeholder">No {lab ? 'laboratories' : 'establishments'} match your search.</div>}
      {targets.filter(x => smatch(q, x.name, x.lga || x.area, x.compliance)).map(tgt => (
        <div className="ord" key={tgt.id}>
          <div className="top"><div><b style={{ fontFamily: 'Lora,serif', fontSize: 16 }}>{tgt.name}</b><div className="muted" style={{ fontSize: 12.5 }}>{(tgt.lga || tgt.area || '')}{tgt.compliance ? ' · ' + tgt.compliance : ''}{tgt.sanction ? ' · ' + tgt.sanction : ''}</div></div>{open !== tgt.id && <button className="btn sm" onClick={() => setOpen(tgt.id)}>Inspect</button>}</div>
          {open === tgt.id && (
            <div style={{ marginTop: 12 }}>
              <div className="field"><label>Outcome</label><select value={outcome} onChange={e => setOutcome(e.target.value)}><option>Compliant</option><option>Minor issues</option><option>Major issues</option></select></div>
              <div className="field"><label>Sanction (optional)</label><select value={sanction} onChange={e => setSanction(e.target.value)}><option value="">None</option>{SANCTION_LADDER.map(x => <option key={x} value={x}>{x}{SANCTION_SEVERE.includes(x) ? ' (needs approval)' : ''}</option>)}</select></div>
              <div className="field"><label>Note</label><textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="What did you observe?" /></div>
              <div className="field">
                <label>Inspection photographs (up to 4)</label>
                <input type="file" accept="image/*" capture="environment" multiple onChange={e => { addPhotos(e.target.files); e.target.value = '' }} />
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Attach evidence from the site. Photographs are stored on the inspection record and visible to your supervisor.</div>
                {photos.filter(Boolean).length > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    {photos.filter(Boolean).map((src, i) => (
                      <div key={i} style={{ position: 'relative' }}>
                        <img src={src} alt={'Inspection photo ' + (i + 1)} style={{ width: 74, height: 74, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)', display: 'block' }} />
                        <button onClick={() => setPhotos(p => p.filter((_, j) => j !== i))} aria-label="Remove photo" style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', border: '1px solid var(--line)', background: '#fff', cursor: 'pointer', lineHeight: 1, fontSize: 12 }}>x</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="row-between"><button className="btn ghost sm" onClick={() => { setOpen(null); setPhotos([]) }}>Cancel</button><button className="btn p sm" onClick={() => submit(tgt)} disabled={busy}>{busy ? 'Saving...' : 'Submit inspection'}</button></div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function OfficerWater({ session }) {
  const [f, setF] = useState({ facility: '', lga: '', source: 'Borehole', contact: '' })
  const [done, setDone] = useState('')
  async function submit() {
    if (!f.facility.trim()) return
    const swid = 'SP-W-LG-' + new Date().getFullYear() + String(Math.floor(Math.random() * 900000) + 100000)
    await store.createWaterTest({ swid, facility: f.facility, lga: f.lga, source: f.source, officer: session.name, contact: f.contact, lab: 'Pending assignment', amount: 65000, status: 'Submitted, pending LASEPA', ownerEmail: 'field', ts: new Date().toISOString() })
    await store.createInspection({ officer: session.name, officerEmail: session.email, agency: 'LASEPA', kind: 'water', subject: f.facility, outcome: 'Sample collected' })
    setDone(swid); setF({ facility: '', lga: '', source: 'Borehole', contact: '' }); toast('Water sample submitted for testing.')
  }
  return (
    <div>
      <div className="note" style={{ marginBottom: 16 }}>Log a water sample collected in the field. It enters the LASEPA water queue for laboratory testing.</div>
      {done && <div className="ord" style={{ marginBottom: 14 }}><b>Sample submitted</b><div className="mono" style={{ fontSize: 13, color: 'var(--muted)' }}>{done}</div></div>}
      <div className="card">
        <div className="field"><label>Facility name</label><input value={f.facility} onChange={e => setF({ ...f, facility: e.target.value })} placeholder="e.g. Grill House, Lekki" /></div>
        <div className="field"><label>LGA</label><select value={f.lga} onChange={e => setF({ ...f, lga: e.target.value })}><option value="">Select LGA</option>{LAGOS_LGAS.map(l => <option key={l}>{l}</option>)}</select></div>
        <div className="field"><label>Water source</label><select value={f.source} onChange={e => setF({ ...f, source: e.target.value })}><option>Borehole</option><option>Public mains</option><option>Water vendor</option></select></div>
        <div className="field"><label>Facility contact</label><input value={f.contact} onChange={e => setF({ ...f, contact: e.target.value })} placeholder="080..." /></div>
        <button className="btn p sm" onClick={submit} disabled={!f.facility.trim()}>Submit sample for testing</button>
      </div>
    </div>
  )
}

function OfficerActivity({ session }) {
  const [rows, setRows] = useState(null)
  useEffect(() => { store.listInspections(session.agency, session.email).then(setRows) /* eslint-disable-next-line */ }, [])
  if (!rows) return <div className="skelrow"><div className="skel" style={{ height: 60 }} /><div className="skel" style={{ height: 60 }} /></div>
  if (!rows.length) return <div className="placeholder">No field activity logged yet. Your checks, inspections and samples will appear here.</div>
  return (
    <div>
      <div className="note" style={{ marginBottom: 16 }}>Your logged field checks, inspections and samples.</div>
      {rows.map((r, i) => (
        <div className="ord" key={r.id || i}>
          <div className="top"><div><b>{r.subject}</b> <span className="muted" style={{ fontSize: 12 }}>· {r.kind}{r.outcome ? ' · ' + r.outcome : ''}{r.sanction ? ' · ' + r.sanction : ''}</span></div><span className="muted" style={{ fontSize: 12 }}>{r.ts ? new Date(r.ts).toLocaleString('en-GB') : ''}</span></div>
          {r.note && <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{r.note}</div>}
          {Array.isArray(r.photos) && r.photos.length > 0 && <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>{r.photos.map((src, k) => <img key={k} src={src} alt="" style={{ width: 58, height: 58, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line)' }} />)}</div>}
          {r.sanctionStatus && <span className="badge" style={{ marginTop: 8, background: (r.sanctionStatus === 'Applied' || r.sanctionStatus === 'Approved') ? '#e7f4ec' : '#fdf1dd', color: (r.sanctionStatus === 'Applied' || r.sanctionStatus === 'Approved') ? '#0a6b39' : '#9a6200' }}>{r.sanctionStatus}</span>}
        </div>
      ))}
    </div>
  )
}

function RegulatorModule({ session, tab }) {
  const agency = session.agency || 'LSMoH'
  const { guard, modal } = useGuard()
  async function audit(action, subject) { await store.appendAudit({ actor: session.name, role: agency, action, subject }) }
  return (
    <div className="page"><div className="wrap">
      <div className="greeting"><h2 className="sec serif" style={{ margin: 0 }}>{agency} portal</h2><span className="muted" style={{ fontSize: 13 }}>{session.name}</span></div>
      <div className="tiles">{METRICS.map(m => <div className="tile" key={m.k}><div className="v">{m.v}</div><div className="k">{m.k}</div></div>)}</div>
      {(agency === 'LASEPA' || agency === 'HEFAMAA') && <Insights session={session} />}
      {tab === 'review' && <><div style={{ marginBottom: 26 }}><h3 className="serif" style={{ fontSize: 18, marginBottom: 4 }}>Analytics</h3><p className="muted" style={{ marginTop: 0, fontSize: 13, marginBottom: 14 }}>Live operational metrics across the programme.</p><Analytics /></div><LSMoHReview session={session} guard={guard} audit={audit} /><AppealsList agency="LSMoH" /><SupportTickets /></>}
      {tab === 'certificates' && <CertAdmin guard={guard} audit={audit} />}
      {tab === 'enforcement' && <><Enforcement guard={guard} audit={audit} /><AppealsList agency="LASEPA" /></>}
      {tab === 'accreditation' && <Accreditation guard={guard} audit={audit} />}
      {tab === 'water' && <WaterReview session={session} guard={guard} audit={audit} />}
      {tab === 'officers' && <><OfficersAdmin agency={session.agency} /><SanctionApprovals agency={session.agency} /></>}
      {tab === 'audit' && <AuditPanel />}
      {modal}
    </div></div>
  )
}

function LSMoHReview({ session, guard, audit }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  async function refresh() {
    setLoading(true)
    const all = await store.listAllOrders()
    let queue = all.filter(o => o.status === 'Submitted')
    // Live results are encrypted at rest, so fetch the decrypted panel for review.
    // Without this the reviewer would see no result at all for each test.
    if (SUPABASE_READY) {
      queue = await Promise.all(queue.map(async o => {
        if (o.results) return o
        try { const r = await store.fn('decrypt-result', { orderId: o.id }); return { ...o, results: (r && r.results) || null } } catch (e) { return { ...o, results: null } }
      }))
    }
    setOrders(queue); setLoading(false)
  }
  useEffect(() => { refresh() }, [])
  async function approve(o) {
    if (SUPABASE_READY) { await store.fn('approve-result', { orderId: o.id, decision: 'approve' }); toast('Result approved, certificate issued.'); refresh(); return }
    const anyRefer = o.results && o.tests.some(t => o.results[t] === 'refer')
    if (anyRefer) { await store.updateOrder(o.id, { status: 'Rejected' }); await audit('Result rejected, referral pathway triggered, escrow held', o.safeplateId); toast('Result rejected, referral pathway triggered.', 'warn') }
    else {
      const now = Date.now(), day = 86400000
      const holderPhoto = await store.getHandlerPhoto(o.safeplateId)
      await store.issueCertificate({ safeplateId: o.safeplateId, name: o.handlerName, panel: o.tests.join(', '), lab: o.lab, issued: new Date(now).toISOString(), expiry: new Date(now + 182 * day).toISOString(), status: 'VALID', photo: holderPhoto })
      await store.createRelease({ safeplateId: o.safeplateId, name: o.handlerName, lab: o.lab, amount: FEE, status: 'Instructed', approvedBy: session.name, ts: new Date().toISOString() })
      await store.updateOrder(o.id, { status: 'Approved' })
      await audit('Approved, certificate issued, escrow release instructed to Sterling Bank', o.safeplateId)
      await store.notify('sterling', 'Escrow release instructed', o.safeplateId)
      await store.notify('all', 'Certificate issued', o.handlerName + ' is now certified')
      await store.dispatch(o.phone, 'sms', 'SafePlate: your Certificate of Fitness is issued. Verify at ' + o.safeplateId)
      toast('Result approved, certificate issued.')
    }
    refresh()
  }
  async function flag(o) { if (SUPABASE_READY) { await store.fn('approve-result', { orderId: o.id, decision: 'flag' }); toast('Result flagged for review.', 'warn'); refresh(); return } await store.updateOrder(o.id, { status: 'Flagged' }); await audit('Flagged for further review, escrow held', o.safeplateId); toast('Result flagged for review.', 'warn'); refresh() }
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
          {!o.results && <div className="err" style={{ marginTop: 10 }}>The laboratory result panel could not be read for this order. Do not approve it. Contact the laboratory and report this through Help and support.</div>}
          <table className="split-tbl" style={{ marginTop: 8 }}><tbody>{o.tests.map(t => (
            <tr key={t}><td>{t}</td><td style={{ textAlign: 'right', fontWeight: 600, color: !o.results ? 'var(--muted)' : o.results[t] === 'refer' ? '#b3261e' : 'var(--green)' }}>{!o.results ? 'Not available' : o.results[t] === 'refer' ? 'Refer' : 'Pass'}</td></tr>
          ))}</tbody></table>
          <div className="row-between" style={{ marginTop: 12 }}>
            <button className="btn p sm" onClick={() => guard('Approve results for ' + o.safeplateId, () => approve(o))} disabled={!o.results} title={!o.results ? 'The result panel could not be read, so it cannot be approved' : ''}>Approve</button>
            <button className="btn sm danger" onClick={() => guard('Flag ' + o.safeplateId + ' for review', () => flag(o))}>Flag for review</button>
          </div>
        </div>
      ))}
    </div>
  )
}

function CertAdmin({ guard, audit }) {
  const [rows, setRows] = useState(null)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { load() /* eslint-disable-next-line */ }, [])
  async function load() { const all = await store.listAllCertificates(); all.sort((a, b) => String(b.issued || '').localeCompare(String(a.issued || ''))); setRows(all) }
  async function revoke(c) { const cid = c.safeplateId || c.safeplate_id; setBusy(true); if (SUPABASE_READY) { await store.fn('revoke-certificate', { safeplateId: cid }) } else { await store.revokeCertificate(cid); await audit('Certificate revoked', cid) } await load(); toast('Certificate revoked.', 'warn'); setBusy(false) }
  if (!rows) return <div className="skelrow"><div className="skel" style={{height:74}} /><div className="skel" style={{height:44}} /><div className="skel" style={{height:220}} /></div>
  const ql = q.trim().toLowerCase()
  const key = c => ((c.safeplateId || c.safeplate_id || '') + ' ' + (c.name || '') + ' ' + (c.cert_no || c.certNo || c.series || '') + ' ' + (c.status || '') + ' ' + (c.lab || '')).toLowerCase()
  const shown = rows.filter(c => !ql || key(c).includes(ql))
  const counts = rows.reduce((a, c) => { a[c.status] = (a[c.status] || 0) + 1; return a }, {})
  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>Every Certificate of Fitness issued statewide. Search, download a copy, or revoke where compliance requires it.</p>
      <div className="tiles" style={{ marginBottom: 14 }}>
        <div className="tile"><div className="v">{rows.length}</div><div className="k">Certificates issued</div></div>
        <div className="tile"><div className="v">{counts['VALID'] || 0}</div><div className="k">Valid</div></div>
        <div className="tile"><div className="v">{counts['EXPIRED'] || 0}</div><div className="k">Expired</div></div>
        <div className="tile"><div className="v">{counts['REVOKED'] || 0}</div><div className="k">Revoked</div></div>
      </div>
      <div className="audsearch" style={{ maxWidth: 460 }}><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by SAFEPLATE ID, name, certificate number or status..." /></div>
      <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>Showing {Math.min(shown.length, 200)} of {shown.length}{shown.length !== rows.length ? ' matching (' + rows.length + ' total)' : ' certificates'}.</div>
      {shown.length === 0 && <div className="placeholder">No certificates match your search.</div>}
      {shown.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="audit-tbl">
            <thead><tr><th>Photo</th><th>SAFEPLATE ID</th><th>Name</th><th>Cert No</th><th>Laboratory</th><th>Issued</th><th>Expiry</th><th>Status</th><th></th></tr></thead>
            <tbody>{shown.slice(0, 200).map((c, i) => { const cid = c.safeplateId || c.safeplate_id; const cno = c.cert_no || c.certNo || c.series || '\u2014'; return (
              <tr key={cid + i}>
                <td>{c.photo ? <img src={c.photo} alt="" style={{ width: 34, height: 40, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line)', display: 'block' }} /> : <span style={{ width: 34, height: 40, borderRadius: 6, background: 'var(--green-pale)', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{(c.name || '?').split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase()}</span>}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{cid}</td>
                <td>{c.name}</td>
                <td className="muted" style={{ whiteSpace: 'nowrap' }}>{cno}</td>
                <td>{c.lab}</td>
                <td className="muted" style={{ whiteSpace: 'nowrap' }}>{c.issued ? new Date(c.issued).toLocaleDateString('en-GB') : '\u2014'}</td>
                <td className="muted" style={{ whiteSpace: 'nowrap' }}>{new Date(c.expiry || c.expiry_date).toLocaleDateString('en-GB')}</td>
                <td><span className={'badge ' + c.status}>{c.status}</span></td>
                <td><div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button className="btn xs" onClick={() => generateCertPDF(c)}>PDF</button>
                  {c.status === 'VALID' && <button className="btn xs danger" onClick={() => guard('Revoke certificate ' + cid, () => revoke(c))} disabled={busy}>Revoke</button>}
                </div></td>
              </tr>
            ) })}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SearchBar({ value, onChange, placeholder, hint }) {
  return (
    <div className="audsearch" style={{ maxWidth: 460 }}>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || 'Search...'} aria-label={placeholder || 'Search'} />
      {hint && <div className="muted" style={{ fontSize: 12, marginTop: 5 }}>{hint}</div>}
    </div>
  )
}
const smatch = (q, ...fields) => { const ql = (q || '').trim().toLowerCase(); return !ql || fields.filter(Boolean).join(' ').toLowerCase().includes(ql) }

function Enforcement({ guard, audit }) {
  const [ests, setEsts] = useState([])
  const [q, setQ] = useState('')
  async function refresh() { setEsts(await store.listEstablishments()) }
  useEffect(() => { refresh() }, [])
  async function escalate(e) { const idx = e.sanction ? SANCTION_LADDER.indexOf(e.sanction) : -1; const next = SANCTION_LADDER[Math.min(idx + 1, SANCTION_LADDER.length - 1)]; await store.updateEstablishment(e.id, { sanction: next, appeal: null }); await audit('Sanction escalated to ' + next, e.name); refresh() }
  async function appeal(e) { await store.updateEstablishment(e.id, { appeal: 'Under review' }); await audit('Appeal lodged and under review', e.name); refresh() }
  return (
    <div>
      <div className="note" style={{ marginBottom: 16 }}>Enforcement is an escalating ladder with an appeals pathway. The aim is compliance as the outcome, not fines as the output.</div>
      <SearchBar value={q} onChange={setQ} placeholder="Search facilities by name, LGA, compliance or sanction..." />
      {ests.filter(e => smatch(q, e.name, e.lga, e.compliance, e.sanction)).length === 0 && <div className="placeholder">No facilities match your search.</div>}
      {ests.filter(e => smatch(q, e.name, e.lga, e.compliance, e.sanction)).map(e => (
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
  const [pending, setPending] = useState([])
  const [q, setQ] = useState('')
  async function refreshLabs() {
    try { setLabs(await store.allLabs()) } catch (e) { setLabs(labsView()) }
    try { setPending(await store.listPendingLabs()) } catch (e) { setPending([]) }
  }
  useEffect(() => { refreshLabs() /* eslint-disable-next-line */ }, [])
  async function toggle(l) { await store.setLabAccredited(l.id, !l.accredited); await audit((l.accredited ? 'Accreditation suspended for ' : 'Accreditation granted for ') + l.name, l.name); refreshLabs() }
  async function approveReg(l) { await store.approveLab(l.id); await audit('Laboratory accreditation approved for ' + l.name, l.name); toast(l.name + ' accredited. It can now receive samples.'); refreshLabs() }
  async function declineReg(l) { await store.declineLab(l.id); await audit('Laboratory registration declined for ' + l.name, l.name); toast(l.name + ' registration declined.', 'warn'); refreshLabs() }
  async function qa(l) { await audit('QA audit recorded', l.name) }
  return (
    <div>
      <div className="note" style={{ marginBottom: 16 }}>HEFAMAA accredits laboratories and records QA audits. Suspending accreditation removes a lab from the food handler booking list immediately.</div>
      {pending.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <h3 className="serif" style={{ fontSize: 17, marginBottom: 4 }}>Pending laboratory registrations</h3>
          <p className="muted" style={{ marginTop: 0, fontSize: 13, marginBottom: 12 }}>New laboratories awaiting accreditation. Approving one makes it available to food handlers.</p>
          {pending.map(l => (
            <div className="ord" key={l.id}>
              <div className="top"><div><b style={{ fontFamily: 'Lora,serif', fontSize: 16 }}>{l.name}</b><div className="muted" style={{ fontSize: 12.5 }}>{[l.lga || l.area, l.contactPerson, l.phone].filter(Boolean).join(' · ')}</div>{l.address && <div className="muted" style={{ fontSize: 12 }}>{l.address}</div>}</div><span className="badge" style={{ background: '#fdf1dd', color: '#9a6200' }}>Pending</span></div>
              <div className="row-between" style={{ marginTop: 12 }}>
                <button className="btn sm danger" onClick={() => guard('Decline registration for ' + l.name, () => declineReg(l))}>Decline</button>
                <button className="btn p sm" onClick={() => guard('Accredit ' + l.name, () => approveReg(l))}>Approve accreditation</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <h3 className="serif" style={{ fontSize: 17, marginBottom: 8 }}>Accredited &amp; listed laboratories</h3>
      <SearchBar value={q} onChange={setQ} placeholder="Search laboratories by name, area or accreditation number..." />
      {labs.filter(l => smatch(q, l.name, l.area, l.accNo)).length === 0 && <div className="placeholder">No laboratories match your search.</div>}
      {labs.filter(l => smatch(q, l.name, l.area, l.accNo)).map(l => (
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

const AUDIT_CATS = {
  'Approval': { color: CHART[0], icon: 'review', re: /approv|issued|certified/ },
  'Flag / reject': { color: CHART[4], icon: 'enforcement', re: /flag|reject|refer|quarant|non-compl/ },
  'Escrow': { color: CHART[3], icon: 'fund', re: /releas|disburse|escrow|fund/ },
  'Revocation': { color: '#b3261e', icon: 'certificates', re: /revok/ },
  'Regulatory': { color: CHART[2], icon: 'accreditation', re: /accredit|enforce|sanction|water/ },
  'Access': { color: CHART[5], icon: 'verify', re: /sign|verif|decrypt|view|scan|login|attempt/ }
}
function auditCat(a) {
  const str = (a || '').toLowerCase()
  for (const name in AUDIT_CATS) if (AUDIT_CATS[name].re.test(str)) return { cat: name, color: AUDIT_CATS[name].color, icon: AUDIT_CATS[name].icon }
  return { cat: 'Other', color: CHART[6], icon: 'audit' }
}
const auditCatColor = name => (AUDIT_CATS[name] && AUDIT_CATS[name].color) || CHART[6]
function timeAgo(ts) { const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000); if (m < 1) return 'just now'; if (m < 60) return m + 'm ago'; const h = Math.floor(m / 60); if (h < 24) return h + 'h ago'; return Math.floor(h / 24) + 'd ago' }

function AuditPanel() {
  const [rows, setRows] = useState([])
  const [view, setView] = useState('tracker')
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  useEffect(() => { store.listAudit().then(setRows) }, [])
  function exportTxt() {
    const header = 'timestamp\trole\tactor\taction\tsubject\tip'
    const body = rows.map(r => [r.ts, r.role, r.actor, r.action, r.subject || '', r.ip].join('\t'))
    const blob = new Blob([[header].concat(body).join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'safeplate-audit-trail.txt'; a.click(); URL.revokeObjectURL(url)
  }
  const cats = {}; rows.forEach(r => { const c = auditCat(r.action).cat; cats[c] = (cats[c] || 0) + 1 })
  const catList = Object.keys(cats)
  const actors = new Set(rows.map(r => r.actor)).size
  const today = rows.filter(r => new Date(r.ts).toDateString() === new Date().toDateString()).length
  const DAYS = 14
  const byDay = new Array(DAYS).fill(0)
  const midnight = new Date(); midnight.setHours(0, 0, 0, 0)
  rows.forEach(r => { const d = new Date(r.ts); d.setHours(0, 0, 0, 0); const idx = DAYS - 1 - Math.round((midnight - d) / 86400000); if (idx >= 0 && idx < DAYS) byDay[idx]++ })
  const dayLabels = byDay.map((_, i) => i === 0 ? '14d' : i === 7 ? '7d' : i === DAYS - 1 ? 'today' : '')
  const ql = q.trim().toLowerCase()
  const shown = rows.filter(r => (filter === 'all' || auditCat(r.action).cat === filter) && (!ql || (r.action + ' ' + r.actor + ' ' + (r.subject || '') + ' ' + r.role).toLowerCase().includes(ql)))
  return (
    <div>
      <div className="row-between" style={{ marginBottom: 14 }}>
        <div className="viewtog"><button className={view === 'tracker' ? 'on' : ''} onClick={() => setView('tracker')}>Tracker</button><button className={view === 'table' ? 'on' : ''} onClick={() => setView('table')}>Table</button></div>
        <button className="btn sm" onClick={exportTxt} disabled={!rows.length}>Export tamper-evident report</button>
      </div>
      <div className="note" style={{ marginBottom: 16 }}>Append-only. Entries cannot be edited or deleted. Actor, role, IP and timestamp are captured on every action.</div>
      {rows.length === 0 && <div className="placeholder">No audit entries yet. Approvals, releases, enforcement and accreditation actions are logged here.</div>}
      {rows.length > 0 && (
        <>
          <div className="tiles" style={{ marginBottom: 16 }}>
            <div className="tile"><div className="v">{rows.length}</div><div className="k">Total events</div></div>
            <div className="tile"><div className="v">{today}</div><div className="k">Logged today</div></div>
            <div className="tile"><div className="v">{actors}</div><div className="k">Distinct actors</div></div>
            <div className="tile"><div className="v">{catList.length}</div><div className="k">Action types</div></div>
          </div>
          <div className="audsearch"><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by actor, action or SAFEPLATE ID..." /></div>
          <div className="chartgrid">
            <ChartCard title="Actions by type" hint="whole trail"><Bars data={catList.map(k => ({ label: k, value: cats[k], color: auditCatColor(k) }))} /></ChartCard>
            <ChartCard title="Activity over time" hint="events per day, 14 days"><Line series={byDay} labels={dayLabels} /></ChartCard>
          </div>
          {view === 'tracker' && (
            <>
              <div className="audchips">
                <button className={'audchip' + (filter === 'all' ? ' on' : '')} onClick={() => setFilter('all')}>All ({rows.length})</button>
                {catList.map(k => <button key={k} className={'audchip' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}><i style={{ background: auditCatColor(k) }} />{k} ({cats[k]})</button>)}
              </div>
              {shown.length === 0 && <div className="placeholder">No events match your search or filter.</div>}
              <div className="timeline">
                {shown.map((r, i) => { const c = auditCat(r.action); return (
                  <div className="tlrow" key={i}>
                    <div className="tldot" style={{ borderColor: c.color, color: c.color }}><NavIcon id={c.icon} /></div>
                    <div className="tlbody"><div className="tltop"><b>{r.action}</b><span className="tltime">{timeAgo(r.ts)}</span></div><div className="tlmeta muted">{r.actor} · {r.role}{r.subject ? ' · ' + r.subject : ''}</div></div>
                  </div>
                ) })}
              </div>
            </>
          )}
          {view === 'table' && (
            <div style={{ overflowX: 'auto' }}><table className="audit-tbl">
              <thead><tr><th>When</th><th>Actor</th><th>Role</th><th>Action</th><th>Subject</th></tr></thead>
              <tbody>{shown.map((r, i) => (<tr key={i}><td className="muted">{new Date(r.ts).toLocaleString('en-GB')}</td><td>{r.actor}</td><td>{r.role}</td><td>{r.action}</td><td className="muted">{r.subject || ''}</td></tr>))}</tbody>
            </table></div>
          )}
        </>
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
  const [q, setQ] = useState('')
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
    if (SUPABASE_READY) { await store.fn('release-escrow', { safeplateId: e.safeplateId }); toast('Escrow released, full waterfall disbursed.'); refresh(); return }
    await store.releaseEscrow(e.safeplateId, session.name)
    await store.appendAudit({ actor: session.name, role: 'Sterling Bank', action: 'Escrow released, full waterfall disbursed', subject: e.safeplateId })
    await store.notify('laboratory', 'Payment released', e.safeplateId + ', ' + naira(e.amount))
    toast('Escrow released, full waterfall disbursed.')
    refresh()
  }

  return (
    <div className="page"><div className="wrap">
      <div className="greeting"><h2 className="sec serif" style={{ margin: 0 }}>Sterling Bank escrow</h2><span className="muted" style={{ fontSize: 13 }}>{session.name}</span></div>
      <div className="tiles">{tiles.map(t => <div className="tile" key={t.k}><div className="v">{t.v}</div><div className="k">{t.k}</div></div>)}</div>
      <div className="note" style={{ marginBottom: 18 }}>Sterling Bank never sees test results or medical data. Releases happen only after Ministry approval, and disburse the full waterfall atomically, all legs or none.</div>
      <Insights session={session} />
      <h3 className="serif" style={{ fontSize: 18, margin: '18px 0 4px' }}>{tab === 'ledger' ? 'Escrow ledger' : tab === 'releases' ? 'Release instructions' : tab === 'fund' ? 'State regulatory fund' : 'Reconciliation'}</h3>
      <p className="muted" style={{ marginTop: 0, fontSize: 13, marginBottom: 14 }}>{tab === 'ledger' ? 'Every escrow transaction, food handler and water facility, held or released.' : tab === 'releases' ? 'Ministry-approved instructions awaiting disbursement, and recent releases.' : tab === 'fund' ? 'Oversight fund remitted to the State on each released transaction.' : 'End-of-day totals reconciling held, released and remitted balances.'}</p>
      {tab === 'ledger' && (<>
        <SearchBar value={q} onChange={setQ} placeholder="Search by ID, name, laboratory, type or status..." />
        <div style={{ overflowX: 'auto' }}><table className="audit-tbl">
          <thead><tr><th>SAFEPLATE ID</th><th>Name</th><th>Laboratory</th><th>Type</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>{escrow.filter(e => smatch(q, e.safeplateId, e.name, e.lab, e.type === 'WATER' ? 'water' : 'food handler', e.status)).map(e => (<tr key={e.safeplateId}><td className="mono">{e.safeplateId}</td><td>{e.name}</td><td>{e.lab}</td><td>{e.type === 'WATER' ? 'Water' : 'Food handler'}</td><td>{naira(e.amount)}</td><td><span className={'status ' + e.status}>{e.status}</span></td></tr>))}</tbody>
        </table></div>
      </>)}

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

  async function load() {
    const b = await store.getBusiness(session.email) || null
    // Reflect Ministry approvals on the employer view: refresh each enrolled
    // member's status from their live certificate / order rather than the value
    // frozen at enrolment.
    if (b && Array.isArray(b.staff) && b.staff.some(x => x.safeplateId)) {
      let changed = false
      await Promise.all(b.staff.map(async x => {
        if (!x.safeplateId) return
        try {
          const cert = await store.verifyCertificate(x.safeplateId)
          if (cert && cert.status === 'VALID') { if (x.status !== 'Certified') { x.status = 'Certified'; changed = true } return }
          if (cert && cert.status === 'EXPIRED') { if (x.status !== 'Expired') { x.status = 'Expired'; changed = true } return }
          const order = await store.getOrderFor(x.safeplateId)
          if (order) {
            let st = x.status
            if (order.status === 'Submitted') st = 'Awaiting Ministry review'
            else if (order.status === 'Approved') st = 'Certified'
            else if (order.status === 'Rejected') st = 'Referred, retest needed'
            else if (order.status === 'Flagged') st = 'Under review'
            else if (/Collected|Testing|Scheduled/.test(order.status || '')) st = 'In testing'
            if (st !== x.status) { x.status = st; changed = true }
          }
        } catch (e) { /* ignore per-member errors */ }
      }))
      if (changed) { try { await store.saveBusiness(session.email, b) } catch (e) { /* ignore */ } }
    }
    setBiz(b)
  }
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
    if (!pending.length) { setMsg('No unregistered staff to enrol.'); setBusy(false); return }
    try {
      if (SUPABASE_READY) {
        if (PAYSTACK_READY) { await payWithPaystack(session.email, pending.length * FEE, 'EMP-' + Date.now()) }
        const res = await store.fn('bulk-enroll', { staff: pending.map(x => ({ name: x.name, phone: x.phone })), lab: 'Lancet Ikeja', employer: session.email })
        const created = (res && res.created) || []
        created.forEach(c => { const m = biz.staff.find(x => x.status === 'Not registered' && x.name === c.name && x.phone === c.phone); if (m) { m.safeplateId = c.safeplateId; m.status = 'Pending results' } })
      } else {
        for (const x of pending) {
          const id = makeSafeplateId()
          await store.createOrder({ id: 'ORD-' + id.replace('SP-LG-', ''), safeplateId: id, handlerName: x.name, phone: x.phone, lab: 'Lancet Ikeja', tests: MANDATORY_TESTS, status: 'Scheduled', createdAt: new Date().toISOString() })
          await store.createEscrow({ safeplateId: id, name: x.name, lab: 'Lancet Ikeja', amount: FEE, status: 'HELD', type: 'FOOD', ts: new Date().toISOString() })
          x.safeplateId = id; x.status = 'Pending results'
        }
      }
      const b = { ...biz }; await store.saveBusiness(session.email, b); setBiz(b)
      setMsg('Enrolled and paid for ' + pending.length + ' staff, ' + naira(pending.length * FEE) + ' into escrow.')
      toast('Enrolled ' + pending.length + ' staff into testing.')
    } catch (e) {
      setMsg('Could not complete enrolment: ' + (e.message || 'please try again.'))
      toast('Enrolment could not complete.', 'err')
    }
    setBusy(false)
  }
  async function bulkAddCsv(file) {
    setMsg('')
    let text = ''
    try { text = await file.text() } catch (e) { setMsg('Could not read that file.'); return }
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    const rows = []
    for (const line of lines) {
      const parts = line.split(',').map(x => x.trim())
      if (!parts[0] || !parts[1]) continue
      if (/^(full ?)?name$/i.test(parts[0])) continue
      rows.push({ id: 'S' + Date.now() + Math.floor(Math.random() * 100000), name: parts[0], phone: parts[1], email: parts[2] || '', status: 'Not registered' })
    }
    if (!rows.length) { setMsg('No valid rows found. Use columns: name, phone, email (optional).'); return }
    const b = { ...biz, staff: [...biz.staff, ...rows] }
    await store.saveBusiness(session.email, b); setBiz(b)
    setMsg('Added ' + rows.length + ' staff from file. Use Register and bulk-pay below to enrol them.')
  }
  function downloadTemplate() {
    const csv = 'name,phone,email\nAdaeze Nwosu,08031110001,ada@example.com\nBode Adekunle,08031110002,\n'
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'safeplate-staff-template.csv'; a.click()
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
      <Insights session={session} />

      {msg && <div className="note" style={{ background: 'var(--green-pale)', borderColor: '#bcdcbc', marginBottom: 16 }}>{msg}</div>}

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 className="serif" style={{ margin: '0 0 12px', fontSize: 18 }}>Add a team member</h3>
        <div className="row-between" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 1, marginBottom: 0, minWidth: 160 }}><label>Name</label><input value={sName} onChange={e => setSName(e.target.value)} placeholder="Full name" /></div>
          <div className="field" style={{ flex: 1, marginBottom: 0, minWidth: 140 }}><label>Phone</label><input value={sPhone} onChange={e => setSPhone(e.target.value)} placeholder="080..." /></div>
          <button className="btn sm" onClick={addStaff}>Add</button>
        </div>
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
          <label className="muted" style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Or bulk-upload your whole team from a CSV (columns: name, phone, email optional)</label>
          <div className="row-between" style={{ alignItems: 'center' }}>
            <input type="file" accept=".csv,text/csv" onChange={e => { const f = e.target.files && e.target.files[0]; if (f) bulkAddCsv(f); e.target.value = '' }} />
            <button className="btn ghost sm" onClick={downloadTemplate}>Download template</button>
          </div>
        </div>
      </div>
      <AppealButton kind="establishment" subject={biz.name} agency="LASEPA" by={session.email} label="Appeal a sanction or compliance decision" />

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
    if (SUPABASE_READY) { await store.fn('approve-water', { swid: w.swid, decision: 'approve' }); toast('Water result approved, certificate issued.'); refresh(); return }
    const now = Date.now(), day = 86400000
    const series = makeWaterCertSeries()
    await store.issueCertificate({ safeplateId: w.swid, name: w.facility, panel: 'Potable water quality', lab: w.lab, issued: new Date(now).toISOString(), expiry: new Date(now + 182 * day).toISOString(), status: 'VALID', series })
    await store.releaseEscrow(w.swid, 'LASEPA')
    await store.updateWaterTest(w.swid, { status: 'Certified', certSeries: series })
    await audit('Water result approved, certificate issued, 80/10/5/5 disbursed', w.swid)
    await store.notify(w.ownerEmail, 'Water certificate issued', w.facility + ' is now certified')
    await store.notify('all', 'Facility water certified', w.facility)
    await store.dispatch(w.contact, 'sms', 'SafePlate: ' + w.facility + ' water certificate issued, ref ' + series)
    toast('Water result approved, certificate issued.')
    refresh()
  }
  async function flag(w) { if (SUPABASE_READY) { await store.fn('approve-water', { swid: w.swid, decision: 'flag' }); toast('Water result flagged, retest required.', 'warn'); refresh(); return } await store.updateWaterTest(w.swid, { status: 'Flagged, retest required' }); await audit('Water result flagged, retest required', w.swid); toast('Water result flagged, retest required.', 'warn'); refresh() }

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


function Donut({ data, size = 128, thick = 20, center, sub }) {
  const total = data.reduce((a, d) => a + d.value, 0) || 1
  const r = (size - thick) / 2, circ = 2 * Math.PI * r
  let off = 0
  return (
    <div className="chartrow">
      <svg width={size} height={size} viewBox={'0 0 ' + size + ' ' + size} className="donut">
        <g transform={'rotate(-90 ' + size / 2 + ' ' + size / 2 + ')'}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={thick} />
          {data.map((d, i) => { const len = (d.value / total) * circ; const seg = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.color} strokeWidth={thick} strokeDasharray={len + ' ' + (circ - len)} strokeDashoffset={-off} />; off += len; return seg })}
        </g>
        {center != null && <text x="50%" y="47%" textAnchor="middle" dominantBaseline="central" className="donutc">{center}</text>}
        {sub && <text x="50%" y="63%" textAnchor="middle" className="donuts">{sub}</text>}
      </svg>
      <div className="legend">{data.map((d, i) => <div key={i} className="legrow"><i style={{ background: d.color }} /><span>{d.label}</span><b>{d.display != null ? d.display : d.value}</b></div>)}</div>
    </div>
  )
}

function Bars({ data, unit }) {
  const max = Math.max(1, ...data.map(d => d.value))
  return (
    <div className="bars">
      {data.map((d, i) => (
        <div key={i} className="barrow">
          <span className="barlabel">{d.label}</span>
          <span className="bartrack"><span className="barfill" style={{ width: (d.value / max * 100) + '%', background: d.color || 'var(--green)' }} /></span>
          <b className="barval">{unit === 'naira' ? naira(d.value) : d.value}</b>
        </div>
      ))}
    </div>
  )
}

function Line({ series, labels }) {
  const w = 480, h = 170, pad = 34
  const max = Math.max(1, ...series)
  const xs = i => pad + i * (w - pad * 2) / (series.length - 1 || 1)
  const ys = v => h - pad - (v / max) * (h - pad * 2)
  const pts = series.map((v, i) => [xs(i), ys(v)])
  const path = pts.map((pt, i) => (i ? 'L' : 'M') + pt[0].toFixed(1) + ' ' + pt[1].toFixed(1)).join(' ')
  const areaPath = path + ' L ' + pts[pts.length - 1][0].toFixed(1) + ' ' + (h - pad) + ' L ' + pts[0][0].toFixed(1) + ' ' + (h - pad) + ' Z'
  return (
    <svg viewBox={'0 0 ' + w + ' ' + h} className="linechart" preserveAspectRatio="xMidYMid meet">
      <path d={areaPath} fill="var(--green-pale)" />
      <path d={path} fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinejoin="round" />
      {pts.map((pt, i) => <circle key={i} cx={pt[0]} cy={pt[1]} r="3.2" fill="#fff" stroke="var(--green)" strokeWidth="2" />)}
      {labels && labels.map((l, i) => <text key={i} x={xs(i)} y={h - 12} textAnchor="middle" className="axl">{l}</text>)}
    </svg>
  )
}

function ChartCard({ title, hint, children }) {
  return <div className="chartcard"><div className="charttitle"><span>{title}</span>{hint && <span className="charthint">{hint}</span>}</div>{children}</div>
}

const statusColor = s => /Approved|Certified|Released/.test(s) ? CHART[0] : /Flag|Reject|Overdue|Quarant/.test(s) ? CHART[4] : /Submitted|Pending|Testing/.test(s) ? CHART[1] : CHART[2]

function Insights({ session }) {
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

function FoodJourney({ step }) {
  const stages = [
    { label: 'Register', icon: 'testing' },
    { label: 'Test panel', icon: 'queue' },
    { label: 'Choose lab', icon: 'accreditation' },
    { label: 'Pay', icon: 'fund' },
    { label: 'Sample & testing', icon: 'review' },
    { label: 'Ministry review', icon: 'audit' },
    { label: 'Certified', icon: 'verify' }
  ]
  const current = Math.min(step, stages.length - 1)
  return (
    <div className="journey">
      <div className="jtitle">Your certification journey</div>
      <div className="jtrack">
        {stages.map((st, i) => {
          const state = i < current ? 'done' : i === current ? 'now' : 'todo'
          return (
            <div key={i} className={'jstep ' + state}>
              <div className="jicon">{i < current ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg> : <NavIcon id={st.icon} />}</div>
              <span className="jlabel">{st.label}</span>
            </div>
          )
        })}
      </div>
      <div className="jnote muted">{current <= 3 ? 'Complete the steps above to submit your sample. After that, the laboratory tests it and the Ministry reviews the result before your certificate is issued.' : 'Payment received. Give your sample at your chosen laboratory, they test it, then the Ministry reviews and issues your Certificate of Fitness.'}</div>
    </div>
  )
}

function Analytics() {
  const [d, setD] = useState(null)
  useEffect(() => {
    Promise.all([store.listAllOrders(), store.listEscrow(), store.listAllWaterTests(), store.listAllCertificates()]).then(([orders, esc, water, certs]) => {
      const by = {}; orders.forEach(o => by[o.status || 'Scheduled'] = (by[o.status || 'Scheduled'] || 0) + 1)
      const cby = {}; certs.forEach(c => cby[c.status || 'VALID'] = (cby[c.status || 'VALID'] || 0) + 1)
      const sum = a => a.reduce((x, e) => x + (e.amount || 0), 0)
      const rel = esc.filter(e => e.status === 'RELEASED'), held = esc.filter(e => e.status === 'HELD')
      setD({ by, cby, heldAmt: sum(held), relAmt: sum(rel), relN: rel.length, food: esc.filter(e => e.type !== 'WATER').length, water: esc.filter(e => e.type === 'WATER').length, valid: cby['VALID'] || 0, orders: orders.length, waterN: water.length })
    })
  }, [])
  if (!d) return <div className="skelrow"><div className="skel" style={{height:74}} /><div className="skel" style={{height:230}} /></div>
  const certColor = k => k === 'VALID' ? CHART[0] : k === 'EXPIRED' ? CHART[1] : CHART[4]
  return (
    <div>
      <div className="tiles" style={{ marginBottom: 16 }}>
        <div className="tile"><div className="v">{d.valid}</div><div className="k">Valid certificates</div></div>
        <div className="tile"><div className="v">{d.orders}</div><div className="k">Total test orders</div></div>
        <div className="tile"><div className="v">{d.relN}</div><div className="k">Escrow releases</div></div>
        <div className="tile"><div className="v">{naira(d.relAmt)}</div><div className="k">Disbursed to date</div></div>
      </div>
      <div className="chartgrid">
        <ChartCard title="Certificates by status" hint="live"><Donut center={d.valid} sub="valid" data={Object.keys(d.cby).length ? Object.keys(d.cby).map(k => ({ label: k, value: d.cby[k], color: certColor(k) })) : [{ label: 'None yet', value: 1, color: 'var(--line)' }]} /></ChartCard>
        <ChartCard title="Testing pipeline" hint="orders by status"><Bars data={Object.keys(d.by).length ? Object.keys(d.by).map(k => ({ label: k, value: d.by[k], color: statusColor(k) })) : [{ label: 'No orders', value: 0 }]} /></ChartCard>
        <ChartCard title="Escrow held vs released" hint="by value"><Donut center={naira(d.heldAmt + d.relAmt)} sub="in system" data={[{ label: 'Held', value: d.heldAmt || 0.0001, display: naira(d.heldAmt), color: CHART[1] }, { label: 'Released', value: d.relAmt || 0.0001, display: naira(d.relAmt), color: CHART[0] }]} /></ChartCard>
        <ChartCard title="Where a ₦15,000 fee goes" hint="five-way waterfall"><Donut center="₦15k" sub="per test" data={WATERFALL.map((w, i) => ({ label: w.who.split(',')[0], value: w.amount, display: naira(w.amount), color: CHART[i % CHART.length] }))} /></ChartCard>
        <ChartCard title="Volume by type" hint="food vs water"><Bars data={[{ label: 'Food handler', value: d.food, color: CHART[0] }, { label: 'Water facility', value: d.water, color: CHART[3] }]} /></ChartCard>
      </div>
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
  const [navOpen, setNavOpen] = useState(false)
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
    if (eff.role === 'officer') return <OfficerModule session={eff} tab={tab} />
    if (eff.role === 'sterling') return <SterlingModule session={eff} tab={tab} />
    if (eff.role === 'employer') return <EmployerModule session={eff} tab={tab} />
    return null
  }

  useEffect(() => { try { window.scrollTo({ top: 0 }) } catch (e) { window.scrollTo(0, 0) } }, [tab, mode, workspace, session])

  useEffect(() => {
    const els = Array.from(document.querySelectorAll('.reveal:not(.in)'))
    if (!els.length) return
    if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return }
    const io = new IntersectionObserver(ents => ents.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target) } }), { threshold: 0.1, rootMargin: '0px 0px -8% 0px' })
    els.forEach(e => io.observe(e)); return () => io.disconnect()
  }, [mode, tab, session])

  return (
    <>
      <Styles />
      <Toasts />
      <HelpCentre />
      <GovBar />
      {session ? (
        <div className="applayout" style={{ ['--accent']: accentFor(eff) }}>
          <Sidebar tabs={tabs} active={mode === 'auth' ? '' : tab} onTab={onTab} onBrand={onBrand} open={navOpen} onClose={() => setNavOpen(false)} />
          <div className="appmain">
            <AppTopBar session={session} onSignOut={signOut} lang={lang} onLang={changeLang} onPrivacy={() => setPrivacyOpen(true)} admin={isAdmin} workspace={workspace} onSwitch={switchWorkspace} onMenu={() => setNavOpen(v => !v)} />
            {page()}
            <Footer onPrivacy={() => setPrivacyOpen(true)} />
          </div>
        </div>
      ) : (
        <>
          <Header tabs={tabs} active={mode === 'auth' ? '' : tab} onTab={onTab} onBrand={onBrand} session={session} onSignIn={() => setMode('auth')} onSignOut={signOut} lang={lang} onLang={changeLang} onPrivacy={() => setPrivacyOpen(true)} admin={isAdmin} workspace={workspace} onSwitch={switchWorkspace} />
          {page()}
          <Footer onPrivacy={() => setPrivacyOpen(true)} />
        </>
      )}
      <ConsentBanner onPrivacy={() => setPrivacyOpen(true)} />
      <PrivacyModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
    </>
  )
}
