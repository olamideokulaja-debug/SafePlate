import React, { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase, MODE } from './supabaseClient.js'
import { facilities as FAC, assignments as ASG, visits as VIS, notifications as NOTIF, calls as CALLS, access as ACC, facilitiesFromCSV, orderRoute, clusterDays, clusterDaysByDate, googleMapsDirUrl, geocode, uploadEvidence, sendNotify, askAI, seedSampleData, clearAllData } from './data.js'

const BUILD = 'field-2026-07-18-ai'

/*
  REALMS FIELD — Stages 1 to 3 (single-file App.jsx + supabaseClient.js + data.js)
  Stage 1: tabbed public site. Stage 2: auth, role picker, dashboard.
  Stage 3 (Map): facilities with area clustering, CSV import, Leaflet map,
  nearest-neighbour route ordering, hand-off to Google Maps, Team Leader assignment.
  Runs in demo mode (browser storage) until Supabase keys are set.
*/

const SITE_TABS = [
  { id: 'home', label: 'Home' }, { id: 'services', label: 'Services' },
  { id: 'monitoring', label: 'Facility Monitoring & Accreditation' }, { id: 'about', label: 'About' },
  { id: 'leadership', label: 'Leadership & Staff' }, { id: 'contact', label: 'Contact' }
]

const STAGES = [
  { n: '01', t: 'Map', d: 'We obtain the assigned facility list, cluster locations by area and plan the most efficient route, cutting travel time and cost while covering more ground each day.' },
  { n: '02', t: 'Engage', d: 'On arrival our team leader introduces the monitoring team, presents official identification and the monitoring letter, and establishes a cordial, respectful atmosphere.' },
  { n: '03', t: 'Monitor', d: 'We assess each facility against the approved HEFAMAA checklist, verifying conditions on the ground and documenting findings with evidence, immediately.' },
  { n: '04', t: 'Debrief', d: 'We give the proprietor a balanced summary: strengths acknowledged, gaps explained, corrective actions set with a clear timeline, and next steps confirmed.' }
]

const PILLARS = [
  { t: 'Facility monitoring', d: 'Routine, structured field monitoring of public and private health facilities against HEFAMAA standards, covering infrastructure, staffing, equipment, records, licensing and service alignment, with evidence captured and every finding graded.' },
  { t: 'Accreditation support', d: 'Practical guidance that helps facilities meet and maintain the standards required for HEFAMAA licensing, translating regulatory requirements into a clear path to compliance.' },
  { t: 'Quality assurance', d: 'Ongoing assessment that keeps standards high after the first visit, tracking corrective actions, scheduling re-inspections and measuring improvement over time.' },
  { t: 'Training & consulting', d: 'Educational engagement for facility teams and advisory support for regulators and operators, building the knowledge that prevents non-compliance before it happens.' }
]

const COVERAGE = [ { label: 'Facilities monitored' }, { label: 'Areas & LGAs covered' }, { label: 'Monitoring visits completed' }, { label: 'Corrective actions to closure' } ]

const PRINCIPLES = [
  { t: 'Professional in approach', d: 'Structured planning, official identification and a courteous, consistent process on every engagement.' },
  { t: 'Educational in engagement', d: 'We explain findings, their implications and the route to compliance, so partners and facilities improve.' },
  { t: 'Firm in enforcement', d: 'Evidence-based assessment and clear corrective guidance that protect the people these facilities serve.' }
]

// Genesys = GeneSys Health Information Systems Limited (RHSC's EMR platform)
const GENESYS_URL = 'https://www.genesys-health.com/'

const SERVICES = [
  { t: 'Strategy & advisory', d: 'Growth, market-entry and operational strategy for health providers, investors and government, grounded in evidence and delivered to implementation.', img: '/photos/g-boardroom.jpg' },
  { t: 'Quality & accreditation', d: 'Readiness assessments and hands-on support that help facilities meet and hold the standards required for licensing and accreditation.', img: '/photos/g-corridor.jpg?v=4' },
  { t: 'Facility Monitoring & Accreditation', d: 'As a licensed HEFAMAA monitoring operator, we carry out routine, evidence-based monitoring of health facilities across Lagos State.', img: '/photos/team.jpg', to: 'monitoring' },
  { t: 'Training & capacity building', d: 'Practical training and mentoring for facility teams, regulators and operators, building the knowledge that prevents non-compliance.', img: '/photos/meeting.jpg' },
  { t: 'Health financing', d: 'Advisory on health financing, insurance design and sustainable funding models for providers, programmes and the public sector.', img: '/photos/g-handshake.jpg?v=4' },
  { t: 'Digital health & technology', d: 'Digital transformation for healthcare, powered by Genesys, our own Electronic Medical Records (EMR) platform, from patient records to real-time monitoring.', img: '/photos/g-health.jpg', href: GENESYS_URL }
]

const IMPACT_STATS = [ { v: '25+', l: 'Years of experience' }, { v: '1000+', l: 'Facilities monitored' }, { v: '20+', l: 'Projects delivered' } ]
const PARTNERS = ['Vatebra Limited', 'Lagos State Ministry of Health', 'HEFAMAA']
const CONTACT = {
  email: 'info@realmsconsulting.com', phone: '+234 704 799 9337', whatsapp: '+234 704 799 9337',
  address: '21 Fatai Arobieke Street, off Admiralty Way, Lekki Phase 1, Lagos',
  hours: 'Monday to Friday, 9am to 5pm'
}
function isPlaceholder(v) { return !v || /^\[/.test(v) }
const INTEGRITY_NOTICE = 'RHSC monitoring is carried out at no cost to the facility. Our officers must never request or accept money, gifts or favours, and no payment is ever required to pass an inspection or to obtain a report. If anyone asks you for anything, report it to ' + CONTACT.phone + ' or ' + CONTACT.email + '. Reports are treated in confidence.'
function getSettings() {
  const d = { cs_email: CONTACT.email, cs_phone: CONTACT.phone, cs_whatsapp: CONTACT.whatsapp }
  try { const s = JSON.parse(localStorage.getItem('realms_settings') || '{}'); return { ...d, ...s, cs_email: s.cs_email || d.cs_email, cs_phone: s.cs_phone || d.cs_phone, cs_whatsapp: s.cs_whatsapp || d.cs_whatsapp } } catch (e) { return d }
}
function saveSettings(s) { try { localStorage.setItem('realms_settings', JSON.stringify(s)) } catch (e) {} }
const ICONS = {
  mail: 'M3 5h18v14H3zM3 6l9 7 9-7',
  phone: 'M4 4h5l2 5-3 2a12 12 0 006 6l2-3 5 2v5a2 2 0 01-2 2A16 16 0 014 6a2 2 0 012-2',
  chat: 'M4 4h16v11H8l-4 4z',
  pin: 'M12 22s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12zM12 10a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  clock: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 7v5l3 2',
  lock: 'M6 11h12v10H6zM9 11V7a3 3 0 016 0v4'
}
function Ico({ name, size = 18 }) { return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[name]} /></svg>) }

/* ---------- reusable AI action button ---------- */
function AIButton({ label, busyLabel, build, onText, className }) {
  const [busy, setBusy] = useState(false)
  async function go() {
    setBusy(true)
    try {
      const b = await build()
      const r = await askAI(b)
      if (!r.ok) { toast(r.reason === 'ai_not_configured' ? 'AI is not set up yet. Add ANTHROPIC_API_KEY in Vercel to enable it.' : 'The assistant could not respond. Please try again.', 'warn'); return }
      onText(r.text || '')
    } catch (e) { toast('The assistant could not respond.', 'warn') } finally { setBusy(false) }
  }
  return <button type="button" className={(className || 'btn ghost') + ' ai-btn'} onClick={go} disabled={busy}><span className="ai-spark" aria-hidden="true">✦</span>{busy ? (busyLabel || 'Thinking\u2026') : label}</button>
}

/* ---------- global toasts + confirm ---------- */
const uiListeners = new Set()
function toast(message, kind = 'ok') { uiListeners.forEach(l => l({ t: 'toast', message, kind })) }
function confirmAction(message, opts = {}) {
  if (!uiListeners.size) { try { return Promise.resolve(window.confirm(((opts.title ? opts.title + '\n\n' : '') + message))) } catch (e) { return Promise.resolve(false) } }
  return new Promise(res => { let done = false; const resolve = v => { if (!done) { done = true; res(v) } }; uiListeners.forEach(l => l({ t: 'confirm', message, opts, resolve })) })
}
function Overlays() {
  const [toasts, setToasts] = useState([])
  const [confirm, setConfirm] = useState(null)
  useEffect(() => {
    const l = (e) => {
      if (e.t === 'toast') { const id = Math.random().toString(36).slice(2); setToasts(ts => ts.concat([{ id, message: e.message, kind: e.kind }])); setTimeout(() => setToasts(ts => ts.filter(x => x.id !== id)), 3400) }
      else if (e.t === 'confirm') setConfirm(e)
    }
    uiListeners.add(l); return () => { uiListeners.delete(l) }
  }, [])
  return (<>
    <div className="toaster" aria-live="polite">{toasts.map(t => (<div key={t.id} className={'toast ' + t.kind}>{t.message}</div>))}</div>
    {confirm && (<div className="modal-scrim" onClick={() => { confirm.resolve(false); setConfirm(null) }}>
      <div className="modal anim" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3>{confirm.opts.title || 'Please confirm'}</h3>
        <p>{confirm.message}</p>
        <div className="modal-actions">
          <button className="btn ghost" onClick={() => { confirm.resolve(false); setConfirm(null) }}>{confirm.opts.cancel || 'Cancel'}</button>
          <button className={'btn ' + (confirm.opts.danger ? 'danger' : 'primary')} onClick={() => { confirm.resolve(true); setConfirm(null) }}>{confirm.opts.ok || 'Confirm'}</button>
        </div>
      </div>
    </div>)}
  </>)
}
const LEADERS = [
  { name: 'Dr. Olamide Okulaja', role: 'Founder & Executive Chairman', photo: '/photos/olamide.jpg', bio: 'A healthcare systems leader whose expertise in systems reform, policy and strategic leadership guides RHSC. His career spans healthcare financing, policy and advocacy, with senior roles at PharmAccess Foundation, the International Finance Corporation (World Bank Group) and the Lagos State Ministry of Health, where he led major universal health coverage and diagnostics initiatives.' },
  { name: 'Ms. Jennifer Kaja', role: 'Managing Director', photo: '/photos/jennifer.jpg', bio: 'A distinguished Nigerian lawyer with first-class honours from the University of Wales and a decade of practice across corporate, commercial and real estate law. As Chief Legal Officer of Periwinkle Empire she oversaw landmark transactions, governance and compliance.' }
]
const STAFF = [
  {
    name: 'Ojuma Joy', role: 'Team Lead (interim), Registered Nurse', unit: 'Field Monitoring Team',
    purpose: 'Leads and supervises daily monitoring across assigned Lagos State local government areas, combining accurate field documentation with professional nursing oversight and regulatory guidance.',
    duties: ['Plans routes, assigns daily rounds and briefs the team', 'Supervises checklist-based inspections and photographic evidence', 'Documents staffing, duty rosters, equipment, wards, beds and services', 'Facility debriefing and practical corrective guidance', 'Assesses nursing quality, uniforms, practising licences and staffing', 'Reviews and signs off reports before HEFAMAA submission', 'Upholds professional ethics, integrity and accountability in the field']
  },
  {
    name: 'Anele Goodnews', role: 'Medical Laboratory Scientist, Monitoring Agent', unit: 'Field Monitoring Team',
    purpose: 'Evaluates laboratory services, personnel, infrastructure, documentation and biosafety practices during routine monitoring, ensuring findings are objective and aligned with HEFAMAA requirements.',
    duties: ['Assesses medical laboratory services against licensed scope', 'Verifies laboratory personnel qualifications and licences', 'Inspects equipment, infrastructure and infection control', 'Reviews test registers, QC records and reagent inventories', 'Evaluates biosafety, PPE and specimen handling', 'Documents findings on the HEFAMAA checklist', 'Debriefs facilities and compiles reports in Word and Excel']
  },
  {
    name: 'Registered Nurse, Monitoring Officer', role: 'Role profile', unit: 'Iyana-Ipaja & Ifako-Ijaiye Monitoring Areas', roleOnly: true,
    purpose: 'Supports HEFAMAA-aligned facility monitoring across Iyana-Ipaja and Ifako-Ijaiye, promoting safe, compliant and high-quality healthcare delivery.',
    duties: ['Monitoring planning, scheduling and efficient daily routes', 'Facility mapping and routine inspections to HEFAMAA requirements', 'Daily monitoring reports and team updates', 'Compliance assessment: closure notices and reports of findings', 'Stakeholder engagement, commendation and corrective recommendations', 'Clinical quality, infection prevention, medication safety and records', 'Promotes the Genesys Electronic Medical Records system', 'Monthly OKRs and performance management']
  }
]
const INSIGHTS = [
  { tag: 'Article', title: '[Thought-leadership article title]', blurb: '[One-line summary of the piece.]', date: '2026' },
  { tag: 'News', title: '[Company update or milestone]', blurb: '[One-line summary.]', date: '2026' },
  { tag: 'Report', title: '[Whitepaper or report title]', blurb: '[One-line summary.]', date: '2026' }
]
const TESTIMONIALS = [
  { quote: '[Add a short client testimonial here.]', who: '[Client name, organisation]' },
  { quote: '[Add a second client testimonial here.]', who: '[Client name, organisation]' }
]
const CASE_STUDIES = [
  { title: '[Case study title]', d: '[What we did and the measurable outcome, in two lines.]' },
  { title: '[Case study title]', d: '[What we did and the outcome.]' }
]
const CERTS = ['[Certification]', '[Partner]', '[Membership]', '[Award]']

// Multi-language for the public site. Yoruba, Hausa and Igbo are first-draft
// and should be reviewed by native speakers before the final launch.
const LANGS = [{ code: 'en', label: 'English' }, { code: 'yo', label: 'Yorùbá' }, { code: 'pcm', label: 'Pidgin' }, { code: 'ha', label: 'Hausa' }, { code: 'ig', label: 'Igbo' }]
const TR = {
  nav_home: { en: 'Home', yo: 'Ilé', pcm: 'Home', ha: 'Gida', ig: 'Ụlọ' },
  nav_services: { en: 'Services', yo: 'Iṣẹ́', pcm: 'Services', ha: 'Ayyuka', ig: 'Ọrụ' },
  nav_monitoring: { en: 'Facility Monitoring & Accreditation', yo: 'Ìbójútó Ilé-ìwòsàn', pcm: 'Facility Monitoring', ha: 'Sa Ido da Amincewa', ig: 'Nlekọta Ụlọ Ọgwụ' },
  nav_about: { en: 'About', yo: 'Nípa Wa', pcm: 'About', ha: 'Game da Mu', ig: 'Banyere Anyị' },
  nav_leadership: { en: 'Leadership & Staff', yo: 'Àwọn Aṣáájú', pcm: 'Our Team', ha: 'Shugabanni', ig: 'Ndị Isi' },
  nav_insights: { en: 'Insights', yo: 'Ìjìnlẹ̀', pcm: 'Insights', ha: 'Bayanai', ig: 'Nghọta' },
  nav_contact: { en: 'Contact', yo: 'Kàn Sí Wa', pcm: 'Contact', ha: 'Tuntuɓe Mu', ig: 'Kpọtụrụ Anyị' },
  hero_title: { en: 'Raising the standard of healthcare', yo: 'Gbígbé ìlera ga sí ìpele tí ó yẹ', pcm: 'We dey raise di standard of healthcare', ha: 'Ɗaga matsayin kiwon lafiya', ig: 'Ibulite ọkọlọtọ nlekọta ahụike' },
  hero_lede: { en: 'A full-service healthcare consulting firm, from strategy, quality and financing to training, digital health and regulatory monitoring.', yo: 'Ilé-iṣẹ́ ìmọ̀ràn ìlera pípé, láti ìlànà, ìdánilójú àti ìnáwó, dé ìdánilẹ́kọ̀ọ́, ìlera oní-nọ́mbà àti ìbójútó.', pcm: 'Na full healthcare consulting company, from strategy, quality and money matter, to training, digital health and monitoring.', ha: 'Cikakken kamfanin ba da shawara kan kiwon lafiya, daga dabaru, inganci da kuɗaɗe, zuwa horo, lafiyar dijital da sa ido.', ig: 'Ụlọ ọrụ ndụmọdụ ahụike zuru ezu, site na atụmatụ, ịdị mma na ego, ruo ọzụzụ, ahụike dijitalụ na nlekọta.' },
  cta_consult: { en: 'Book a consultation', yo: 'Ṣe ìpàdé ìmọ̀ràn', pcm: 'Book consultation', ha: 'Yi rijistar shawara', ig: 'Debe oge ndụmọdụ' },
  cta_services: { en: 'Explore our services', yo: 'Wo àwọn iṣẹ́ wa', pcm: 'See our services', ha: 'Duba ayyukanmu', ig: 'Chọpụta ọrụ anyị' },
  cta_proposal: { en: 'Request a proposal', yo: 'Béèrè fún àbá', pcm: 'Request proposal', ha: 'Nemi shawara', ig: 'Rịọ atụmatụ' },
  cta_signin: { en: 'Staff sign-in', yo: 'Wọlé oṣiṣẹ́', pcm: 'Staff sign-in', ha: 'Shiga ma’aikata', ig: 'Ọrụ banye' },
  tagline: { en: 'Professional. Educational. Enforcement-driven.', yo: 'Ọjọ̀gbọ́n. Ẹ̀kọ́. Ìmúṣẹ.', pcm: 'Professional. Educational. Enforcement.', ha: 'Ƙwararru. Ilimi. Aiwatarwa.', ig: 'Ọkachamara. Mmụta. Mmezu.' }
}
function makeT(lang) { return (key) => (TR[key] && (TR[key][lang] || TR[key].en)) || key }

const ROLES = [
  { id: 'team_leader', label: 'Team Leader', blurb: 'Assign facilities, plan routes and review your team\u2019s visits.', icon: IconLeader,
    tools: [ ['Assign & route facilities', 'Stage 3', 'assign'], ['Review team visits', 'Stage 6', 'reports'] ] },
  { id: 'field_monitor', label: 'Field Monitor', blurb: 'Run visits end to end: map, engage, monitor and debrief.', icon: IconMonitor,
    tools: [ ['Map & route', 'Stage 3', 'map'], ['Engage check-in', 'Stage 4', 'engage'], ['Monitor checklist', 'Stage 5', 'monitor'], ['Debrief & sign-off', 'Stage 6', 'debrief'] ] },
  { id: 'rhsc_hq', label: 'RHSC HQ', blurb: 'Oversight, facility data, exports and analytics.', icon: IconHQ,
    tools: [ ['Facility list ingestion', 'Stage 3', 'facilities'], ['Reports & exports', 'Stage 7', 'reports'] ] },
  { id: 'hefamaa_reviewer', label: 'HEFAMAA Reviewer', blurb: 'Read and validate monitoring outcomes across the State.', icon: IconShield,
    tools: [ ['Review facilities', 'Stage 3', 'facilities'], ['Review reports', 'Stage 6', 'reports'] ] },
  { id: 'facility_proprietor', label: 'Facility Proprietor', blurb: 'View your facility\u2019s outcomes and required actions.', icon: IconStore,
    tools: [ ['My facility outcomes', 'Live', 'myfacility'], ['My corrective actions', 'Live', 'myfacility'], ['Re-inspection status', 'Live', 'myfacility'] ] }
]

const ROLE_TABS = {
  team_leader: ['dashboard', 'facilities', 'map', 'engage', 'monitor', 'debrief', 'secondassessment', 'assign', 'approvals', 'reports'],
  field_monitor: ['dashboard', 'facilities', 'map', 'engage', 'monitor', 'debrief', 'secondassessment'],
  rhsc_hq: ['dashboard', 'facilities', 'map', 'secondassessment', 'reports', 'approvals', 'integrity', 'followups', 'access', 'assistant', 'settings'],
  hefamaa_reviewer: ['dashboard', 'facilities', 'reports'],
  facility_proprietor: ['dashboard', 'myfacility']
}
const TAB_LABEL = { dashboard: 'Dashboard', facilities: 'Facilities', map: 'Map & Route', engage: 'Engage', monitor: 'Monitor', debrief: 'Debrief', secondassessment: 'Second Assessment', assign: 'Assign', reports: 'Reports', analytics: 'Analytics', myfacility: 'My Facility', followups: 'Follow-ups', settings: 'Settings', assistant: 'AI Assistant', approvals: 'Approvals', integrity: 'Integrity', access: 'Access requests' }
const CAN_EDIT = ['team_leader', 'field_monitor', 'rhsc_hq']
const AREA_COLORS = ['#6D4B8E', '#3E86C9', '#C7549C', '#5FA35A', '#D08A2E', '#7E63A0', '#4AA3A3', '#B0562E', '#6C6FD0', '#C0603C']

const IDENTITY = {
}
function identityFor(email, name) {
  const found = IDENTITY[(email || '').toLowerCase()]
  const chosen = name || (found && found.name)
  if (chosen) return { photo: '', title: '', ...(found || {}), name: chosen, first: chosen.split(' ')[0] }
  const base = (email || 'staff').split('@')[0].replace(/[._-]+/g, ' ')
  const n = base.split(' ').map(w => w ? w[0].toUpperCase() + w.slice(1) : w).join(' ') || 'Staff'
  return { name: n, first: n.split(' ')[0], title: '', photo: '' }
}
const DEAD_STATES = ['untraceable', 'closed', 'not_at_address']
const STATE_LABEL = { untraceable: 'Untraceable', closed: 'Closed', not_at_address: 'Not at address', locked: 'Met locked', relocated: 'Relocated', renovation: 'Under renovation', closure_notice: 'Closure notice', active: '' }
function isLive(f) { return !f.state || DEAD_STATES.indexOf(f.state) < 0 }
const OWNER_EMAIL = 'exco@realmsconsulting.com'
function isOwner(u) { return !!u && String(u.email || '').trim().toLowerCase() === OWNER_EMAIL }
const TEAM_LABEL = 'Field team'
const MONITORS = [TEAM_LABEL, 'Ojuma Joy', 'Anele Goodnews']
const VIEW_USERS = [
  { name: 'Ojuma Joy', role: 'team_leader' },
  { name: 'Anele Goodnews', role: 'field_monitor' },
  { name: 'HEFAMAA Reviewer', role: 'hefamaa_reviewer' },
  { name: 'Facility Proprietor', role: 'facility_proprietor' }
]
function roleById(id) { return ROLES.find(r => r.id === id) || null }
function hasCoords(f) { return typeof f.lat === 'number' && typeof f.lng === 'number' && !isNaN(f.lat) && !isNaN(f.lng) }

/* ---------- icons ---------- */
function IconLeader() { return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/><path d="M12 1.6l1 2 2.2.2-1.7 1.5.5 2.1L12 6.4 9.9 7.5l.5-2.1L8.8 3.8 11 3.6z"/></svg>) }
function IconMonitor() { return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M9 3.5V6h6V3.5"/><path d="M8.5 11l2 2 4-4.5"/><path d="M8.5 16h7"/></svg>) }
function IconHQ() { return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9.5 21v-4h5v4"/><path d="M9 11h1.5M13.5 11H15M9 14h1.5M13.5 14H15"/></svg>) }
function IconShield() { return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 2.5l7 2.6v5.4c0 4.7-3 8.2-7 9.5-4-1.3-7-4.8-7-9.5V5.1z"/><path d="M8.8 12l2.1 2.1 4.3-4.6"/></svg>) }
function IconStore() { return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 9.5V20h16V9.5"/><path d="M3 4.5h18l1 5H2z"/><path d="M9.5 20v-5h5v5"/></svg>) }

/* ---------- shared ---------- */
function SectionHead({ eyebrow, title }) { return (<div className="section-head anim"><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>) }
function NumField({ label, value, min, max, onChange, hint }) {
  const [txt, setTxt] = useState(String(value))
  useEffect(() => { setTxt(String(value)) }, [value])
  function commit(raw) {
    const n = parseInt(String(raw).replace(/[^0-9]/g, ''), 10)
    const v = isFinite(n) ? Math.max(min, Math.min(max, n)) : value
    setTxt(String(v)); if (v !== value) onChange(v)
  }
  function step(d) { const v = Math.max(min, Math.min(max, Number(value) + d)); setTxt(String(v)); if (v !== value) onChange(v) }
  return (<label className="field sm numfield">
    <span>{label}</span>
    <div className="num-row">
      <button type="button" className="num-btn" onClick={() => step(-1)} disabled={value <= min} aria-label={'Fewer: ' + label}>&#8722;</button>
      <input className="num-in" inputMode="numeric" pattern="[0-9]*" value={txt}
        onChange={e => setTxt(e.target.value)}
        onBlur={e => commit(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
        aria-label={label} />
      <button type="button" className="num-btn" onClick={() => step(1)} disabled={value >= max} aria-label={'More: ' + label}>+</button>
    </div>
    {hint && <em className="num-hint">{hint}</em>}
  </label>)
}
function SearchBox({ value, onChange, placeholder }) { return <input className="searchbox" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || 'Search\u2026'} aria-label="Search" /> }
function matchQ(v, q) { if (!q) return true; const s = q.toLowerCase(); return ((v.facility_name || v.name || '') + ' ' + (v.area || '') + ' ' + (v.category || '') + ' ' + (v.address || '')).toLowerCase().includes(s) }

/* ---------- public pages ---------- */
function HomePage({ onSignIn, go, t }) {
  return (
    <div className="page">
      <section className="hero">
        <div className="hero-copy anim">
          <p className="eyebrow">REALMS Healthcare Services Consulting Limited</p>
          <h1>{t('hero_title')}</h1>
          <p className="lede">{t('hero_lede')}</p>
          <div className="cta-row">
            <button className="btn primary" onClick={() => go('contact')}>{t('cta_consult')}</button>
            <button className="btn ghost" onClick={() => go('services')}>{t('cta_services')}</button>
          </div>
          <p className="tagline">{t('tagline')}</p>
        </div>
        <div className="hero-art anim" style={{ animationDelay: '120ms' }}>
          <div className="art-panel"><img src="/rhsc-logo.png" alt="REALMS Healthcare Services Consulting Limited" /></div>
        </div>
      </section>

      <section className="home-strip anim">
        {IMPACT_STATS.map(c => (<div className="mini-stat" key={c.l}><span className="mini-value">{c.v}</span><span className="mini-label">{c.l}</span></div>))}
      </section>

      <section className="clients-band anim">
        <p className="eyebrow center">Trusted by</p>
        <div className="clients-row">{PARTNERS.map(c => <span className="client-chip" key={c}>{c}</span>)}</div>
        <p className="band-note">RHSC is a licensed HEFAMAA monitoring operator, appointed to carry out routine health facility monitoring and accreditation support across Lagos State.</p>
      </section>

      <section className="impact anim">
        <div className="impact-copy">
          <p className="eyebrow light">Why RHSC</p>
          <h2>A partner from strategy to the ground</h2>
          <p>Few firms combine boardroom advisory with field delivery. RHSC does both, advising on strategy, quality and financing, and operating regulatory monitoring at scale as a licensed HEFAMAA operator.</p>
          <div className="cta-row"><button className="btn light" onClick={() => go('contact')}>{t('cta_proposal')}</button><button className="btn ghost onlight" onClick={() => go('monitoring')}>Our HEFAMAA work</button></div>
        </div>
        <div className="impact-art"><img src="/photos/g-network.jpg" alt="Connected healthcare across the State" /></div>
      </section>
    </div>
  )
}

function ServicesPage({ go }) {
  return (<div className="page"><SectionHead eyebrow="What we do" title="Our services" />
    <p className="page-lede anim">End-to-end healthcare consulting: we advise, build and operate across the health system.</p>
    <div className="pillars">{SERVICES.map((p, i) => {
      const clickable = p.to || p.href
      return (<article className={'pillar photo anim' + (clickable ? ' clickable' : '')} key={p.t} style={{ animationDelay: (i * 60) + 'ms' }}
        onClick={() => p.to ? go(p.to) : p.href ? window.open(p.href, '_blank') : null}>
        <div className="pillar-img"><img src={p.img} alt="" /></div>
        <span className="pillar-rule" aria-hidden="true" /><h3>{p.t}</h3><p>{p.d}</p>
        {p.to && <span className="svc-more">See the programme &rarr;</span>}
        {p.href && <span className="svc-more">Visit Genesys &#8599;</span>}
      </article>)
    })}</div>
    <div className="cta-band anim"><h2>Have a brief in mind?</h2><button className="btn primary" onClick={() => go('contact')}>Book a consultation</button></div>
  </div>)
}

function MonitoringPage({ onSignIn, go }) {
  return (<div className="page"><SectionHead eyebrow="Licensed HEFAMAA monitoring operator" title="Facility Monitoring & Accreditation" />
    <div className="mon-lead anim">
      <div className="mon-lead-copy">
        <p>As a licensed operator for the Health Facility Monitoring and Accreditation Agency (HEFAMAA), RHSC carries out routine, evidence-based monitoring of public and private health facilities across Lagos State, holding every provider to the standards that protect the people they serve.</p>
        <p>Our field teams plan efficient routes, engage facilities with courtesy and official identification, assess against the approved HEFAMAA checklist, and debrief proprietors with clear corrective actions and timelines. Findings flow to a live oversight dashboard for the Agency and RHSC leadership.</p>
        <div className="cta-row"><button className="btn primary" onClick={onSignIn}>Staff sign-in</button><button className="btn ghost" onClick={() => go('contact')}>Partner with us</button></div>
      </div>
      <div className="mon-lead-art"><img src="/photos/team.jpg" alt="RHSC monitoring team" /></div>
    </div>
    <div className="wave-wrap"><svg className="wave" viewBox="0 0 1000 90" preserveAspectRatio="none" aria-hidden="true"><path d="M0 55 C110 22, 200 78, 320 52 S540 20, 660 52 S870 82, 1000 46" fill="none" stroke="#A98FC4" strokeWidth="2.5" /></svg>
      <ol className="stages">{STAGES.map((s, i) => (<li className="stage anim" key={s.n} style={{ animationDelay: (i * 80) + 'ms' }}><span className="stage-n">{s.n}</span><span className="dot" aria-hidden="true" /><h3>{s.t}</h3><p>{s.d}</p></li>))}</ol>
    </div>
    <div className="pillars">{PILLARS.map((p, i) => (<article className="pillar anim" key={p.t} style={{ animationDelay: (i * 70) + 'ms' }}><span className="pillar-rule" aria-hidden="true" /><h3>{p.t}</h3><p>{p.d}</p></article>))}</div>
  </div>)
}

function AboutPage() {
  return (<div className="page"><SectionHead eyebrow="Who we are" title="A full-service healthcare consulting firm" />
    <div className="about-lead anim"><img src="/photos/g-building.jpg" alt="Healthcare" /></div>
    <div className="mandate-grid">
      <p className="anim">REALMS Healthcare Services Consulting Limited (RHSC) is a healthcare consulting firm working across strategy, quality and accreditation, training, health financing, digital health and regulatory monitoring. We serve government and regulators, private providers, investors and development partners.</p>
      <p className="anim" style={{ animationDelay: '90ms' }}>We combine boardroom advisory with on-the-ground delivery. That range, from shaping strategy to operating monitoring at scale as a licensed HEFAMAA operator, lets us turn recommendations into measurable results and raise the standard of care.</p>
    </div>
    <div className="principles">{PRINCIPLES.map((p, i) => (<div className="principle anim" key={p.t} style={{ animationDelay: (i * 70) + 'ms' }}><h3>{p.t}</h3><p>{p.d}</p></div>))}</div>
  </div>)
}

function LeaderCard({ l }) {
  const [imgOk, setImgOk] = useState(true)
  const initials = (l.name.replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('') || 'R').toUpperCase()
  return (<article className="staff lead">
    <div className="staff-top">
      <div className="staff-photo">{imgOk ? <img src={l.photo} alt={l.name} onError={() => setImgOk(false)} /> : <span>{initials}</span>}</div>
      <div className="staff-id"><h3>{l.name}</h3><p className="staff-role">{l.role}</p></div>
    </div>
    <p className="staff-purpose">{l.bio}</p>
  </article>)
}
function StaffCard({ s }) {
  const [open, setOpen] = useState(false)
  const initials = (s.name.replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('') || 'R').toUpperCase()
  return (<article className="staff">
    <div className="staff-top">
      <div className="staff-photo" aria-hidden="true"><span>{initials}</span></div>
      <div className="staff-id"><h3>{s.name}</h3><p className="staff-role">{s.role}</p><p className="staff-unit">{s.unit}</p></div>
    </div>
    <p className="staff-purpose">{s.purpose}</p>
    <button className="linkbtn" onClick={() => setOpen(o => !o)}>{open ? 'Hide role profile' : 'View role profile'}</button>
    {open && <ul className="staff-duties">{s.duties.map((d, i) => <li key={i}>{d}</li>)}</ul>}
  </article>)
}
function LeadershipPage({ go }) {
  return (<div className="page"><SectionHead eyebrow="Our people" title="Leadership & staff" />
    <p className="page-lede">The leadership and field team behind RHSC, a licensed HEFAMAA monitoring operator across Lagos State.</p>
    <div className="staff-grid lead-grid anim">{LEADERS.map((l, i) => <LeaderCard key={i} l={l} />)}</div>
    <SectionHead eyebrow="Our team" title="Monitoring officers & specialists" />
    <div className="staff-grid anim">{STAFF.map((s, i) => <StaffCard key={i} s={s} />)}</div>
    <div className="cta-band anim"><h2>Join our team</h2><p>We are always interested in talented people who care about better healthcare.</p><button className="btn primary" onClick={() => go('contact')}>See careers</button></div>
  </div>)
}

function InsightsPage() {
  return (<div className="page"><SectionHead eyebrow="Insights" title="Thinking, news & reports" />
    <p className="page-lede anim">Perspectives from our team, company updates, and research on healthcare in Nigeria and beyond.</p>
    <div className="insights">{INSIGHTS.map((p, i) => (
      <article className="insight anim" key={i} style={{ animationDelay: (i * 70) + 'ms' }}>
        <span className="insight-tag">{p.tag}</span><span className="insight-date">{p.date}</span>
        <h3>{p.title}</h3><p>{p.blurb}</p><span className="svc-more">Read &rarr;</span>
      </article>
    ))}</div>
    <p className="hintline center">More insights coming soon.</p>
  </div>)
}

function ContactPage() {
  const [f, setF] = useState({ name: '', org: '', email: '', phone: '', interest: 'Book a consultation', message: '' })
  const [sent, setSent] = useState(false)
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  const valid = f.name.trim() && f.email.trim() && f.message.trim()
  const to = isPlaceholder(CONTACT.email) ? '' : CONTACT.email
  function submit() {
    if (!valid) { toast('Add your name, email and a short message.', 'warn'); return }
    const subject = 'RHSC enquiry: ' + f.interest
    const body = ['Name: ' + f.name, f.org ? 'Organisation: ' + f.org : '', 'Email: ' + f.email, f.phone ? 'Phone: ' + f.phone : '', 'Interest: ' + f.interest, '', f.message].filter(Boolean).join('\n')
    window.location.href = mailtoLink(subject, body, to)
    setSent(true)
  }
  const waHref = CONTACT.whatsapp ? waLink(CONTACT.whatsapp, 'Hello RHSC, I would like to enquire about your services.') : ''
  return (<div className="page contact-page">
    <div className="contact-hero anim">
      <p className="eyebrow">Get in touch</p>
      <h1>Let&rsquo;s raise the standard, together.</h1>
      <p className="contact-lede">Tell us what you are working on. Whether it is strategy, quality, monitoring or digital health, we will point you to the right team.</p>
    </div>
    <div className="contact-split">
      <aside className="contact-panel anim">
        <div className="panel-glow" aria-hidden="true" />
        <h2>Reach RHSC</h2>
        <ul className="reach">
          <li><span className="reach-ic"><Ico name="mail" /></span><div><span className="reach-k">Email</span><em>{CONTACT.email}</em></div></li>
          <li><span className="reach-ic"><Ico name="phone" /></span><div><span className="reach-k">Phone</span><em>{CONTACT.phone}</em></div></li>
          <li><span className="reach-ic"><Ico name="chat" /></span><div><span className="reach-k">WhatsApp</span><em>{CONTACT.whatsapp || '[Imade Forte WhatsApp]'}</em></div></li>
          <li><span className="reach-ic"><Ico name="pin" /></span><div><span className="reach-k">Office</span><em>{CONTACT.address}</em></div></li>
          <li><span className="reach-ic"><Ico name="clock" /></span><div><span className="reach-k">Hours</span><em>{CONTACT.hours}</em></div></li>
        </ul>
        <div className="panel-cta">
          {waHref ? <a className="btn light" href={waHref} target="_blank" rel="noreferrer">Message on WhatsApp</a> : <button className="btn light" onClick={() => toast('Add your WhatsApp number in the contact settings.', 'warn')}>Message on WhatsApp</button>}
          {!isPlaceholder(CONTACT.phone) && <a className="btn ghost onlight" href={'tel:' + CONTACT.phone.replace(/[^0-9+]/g, '')}>Call us</a>}
        </div>
      </aside>

      {sent ? (
        <div className="enquiry sent anim">
          <div className="sent-badge" aria-hidden="true"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg></div>
          <h2>Your enquiry is ready to send</h2>
          <p>We have opened your email app with the details filled in. Send it and our team will respond, usually within a working day.</p>
          <button className="btn primary" onClick={() => { setSent(false); setF({ name: '', org: '', email: '', phone: '', interest: 'Book a consultation', message: '' }) }}>Start a new enquiry</button>
        </div>
      ) : (
        <div className="enquiry anim">
          <h2>Send an enquiry</h2>
          <div className="fgrid two">
            <label className="field sm"><span>Name</span><input value={f.name} onChange={e => set('name', e.target.value)} placeholder="Your name" /></label>
            <label className="field sm"><span>Organisation</span><input value={f.org} onChange={e => set('org', e.target.value)} placeholder="Optional" /></label>
            <label className="field sm"><span>Email</span><input type="email" value={f.email} onChange={e => set('email', e.target.value)} placeholder="you@example.com" /></label>
            <label className="field sm"><span>Phone</span><input value={f.phone} onChange={e => set('phone', e.target.value)} placeholder="Optional" /></label>
          </div>
          <label className="field sm"><span>How can we help?</span>
            <select value={f.interest} onChange={e => set('interest', e.target.value)}>{['Book a consultation', 'Request a proposal', 'Facility monitoring & accreditation', 'Quality & accreditation', 'Training', 'Health financing', 'Digital health (Genesys)', 'Other'].map(o => <option key={o}>{o}</option>)}</select>
          </label>
          <label className="field sm"><span>Message</span><textarea rows="4" value={f.message} onChange={e => set('message', e.target.value)} placeholder="A sentence or two about what you need." /></label>
          <div className="cta-row">
            <button className="btn primary" onClick={submit}>Send enquiry</button>
            <AIButton className="btn ghost" label="Help me write this" build={() => ({ system: 'You help a website visitor draft a short, polite enquiry to RHSC, a Lagos healthcare consulting and HEFAMAA facility-monitoring firm. Write 2 to 4 sentences in the first person, ready to send. Output only the message.', prompt: 'Name: ' + (f.name || '(unspecified)') + '. Organisation: ' + (f.org || 'n/a') + '. Interest: ' + f.interest + '. Rough note: ' + (f.message || '(none)') + '.', max_tokens: 260 })} onText={txt => set('message', txt)} />
          </div>
          <p className="hintline">Prefer to write directly? Use the details on the left.</p>
        </div>
      )}
    </div>
  </div>)
}

/* ---------- auth ---------- */
function AuthPanel({ onDone, onCancel }) {
  const [mode, setMode] = useState('signin'); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [name, setName] = useState('')
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('')
  async function submit() {
    setMsg(''); setBusy(true)
    try {
      if (MODE === 'supabase') {
        if (mode === 'signup') { const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name.trim() } } }); if (error) throw error; setMsg('Account created. If confirmation is required, check your email, then sign in.'); setMode('signin') }
        else { const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) throw error; if (name.trim()) { try { await supabase.auth.updateUser({ data: { full_name: name.trim() } }) } catch (e) {} } }
      } else { if (!email) throw new Error('Enter an email to continue.'); const u = { email, name: name.trim() }; localStorage.setItem('realms_demo_user', JSON.stringify(u)); onDone(u) }
    } catch (e) { setMsg(e.message || 'Something went wrong. Please try again.') } finally { setBusy(false) }
  }
  const showName = mode === 'signup' || MODE === 'demo'
  return (<div className="auth-shell"><div className="auth-card anim">
    <img className="auth-mark" src="/rhsc-mark.png" alt="RHSC" />
    <h2>{mode === 'signup' ? 'Create your Realms Field account' : 'Sign in to Realms Field'}</h2>
    <p className="auth-sub">For RHSC staff and authorised HEFAMAA reviewers.</p>
    {showName && <label className="field"><span>Your name</span><input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Olamide Okulaja" /></label>}
    <label className="field"><span>Email</span><input type="email" value={email} autoComplete="email" onChange={e => setEmail(e.target.value)} placeholder="you@realms.ng" /></label>
    <label className="field"><span>Password</span><input type="password" value={password} autoComplete="current-password" onChange={e => setPassword(e.target.value)} placeholder={MODE === 'demo' ? 'Not required in demo' : 'Your password'} /></label>
    {msg && <p className="auth-msg">{msg}</p>}
    <button className="btn primary wide" onClick={submit} disabled={busy}>{busy ? 'Please wait\u2026' : (mode === 'signup' ? 'Create account' : 'Sign in')}</button>
    <button className="linkbtn" onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}>{mode === 'signup' ? 'Already have an account? Sign in' : 'Need an account? Create one'}</button>
    <button className="linkbtn subtle" onClick={onCancel}>Back to site</button>
    {MODE === 'demo' && <p className="demo-note">Running in DEMO mode. Supabase keys were NOT detected when this version was built. Real accounts and your live data need the two keys present at build time, then a fresh deploy.</p>}
    <p className="hintline" style={{ marginTop: 10, fontSize: 11, opacity: 0.65 }}>build {BUILD} &middot; {MODE === 'supabase' ? 'connected to database' : 'demo mode (not connected)'}</p>
  </div></div>)
}

/* ---------- role picker ---------- */
function RolePicker({ identity, onPick, onSignOut }) {
  return (<div className="page role-page">
    <div className="section-head anim"><p className="eyebrow">Welcome, {identity.first}</p><h2>Which best describes you?</h2></div>
    <div className="role-grid">{ROLES.map((r, i) => { const Icon = r.icon; return (
      <button className="role-card anim" key={r.id} style={{ animationDelay: (i * 60) + 'ms' }} onClick={() => onPick(r.id)}>
        <span className="role-icon"><Icon /></span><span className="role-label">{r.label}</span><span className="role-blurb">{r.blurb}</span>
      </button>) })}</div>
    <button className="linkbtn subtle center" onClick={onSignOut}>Sign out</button>
  </div>)
}

/* ---------- dashboard ---------- */
function Dashboard({ identity, role, onOpen, facilities, onSeed, onClear, dbError }) {
  const r = roleById(role); const Icon = r ? r.icon : IconMonitor
  const areas = Array.from(new Set((facilities || []).map(f => f.area || 'Unassigned')))
  const quick = [{ v: (facilities || []).length, l: 'Facilities' }, { v: areas.length, l: 'Areas' }, { v: (r ? r.tools.filter(t => t[2]).length : 0), l: 'Live tools' }]
  const hasData = (facilities || []).length > 0
  const showAnalytics = ['rhsc_hq', 'team_leader', 'hefamaa_reviewer'].includes(role)
  return (<div className="page dash">
    <div className="dash-banner anim">
      <img src="/photos/team.jpg" alt="RHSC field team" />
      <div className="dash-banner-in">
        <span className="dash-icon"><Icon /></span>
        <div><p className="eyebrow light">{r ? r.label : 'Realms Field'}</p><h2>Welcome, {identity.first}</h2><p className="dash-sub">Professional. Educational. Enforcement-driven.</p></div>
      </div>
    </div>
    {dbError ? (<div className="db-error anim">
      <strong>The facilities could not load.</strong>
      <span className="db-msg">{dbError}</span>
      <span>If you just updated the app, make sure the new version finished deploying, then tap Try again. Running build: {BUILD}.</span>
      <button className="btn small primary" onClick={onSeed}>Try again</button>
    </div>) : (!hasData && onSeed && (<div className="seed-card anim"><div><strong>No facilities yet.</strong><span>Load the live facility register (Alimosho &amp; Ifako-Ijaiye) to begin.</span></div><button className="btn small primary" onClick={onSeed}>Load live facilities</button></div>))}

    {showAnalytics
      ? (<div className="dash-analytics anim"><AnalyticsBody facilities={facilities} onOpen={onOpen} role={role} /></div>)
      : (<div className="dash-quick anim">{quick.map(q => (<div className="dq" key={q.l}><span className="dq-v">{q.v}</span><span className="dq-l">{q.l}</span></div>))}</div>)}
    <p className="dash-intro anim">Your tools are on the left. The ones marked ready are live now; the rest unlock as the build grows.</p>
    <div className="tool-grid">{(r ? r.tools : []).map(([name, stage, tab], i) => {
      const live = !!tab
      return (<button className={'tool-card' + (live ? ' live' : '')} key={name} style={{ animationDelay: (i * 60) + 'ms' }} disabled={!live} onClick={() => live && onOpen(tab)}>
        <span className="tool-name">{name}</span><span className={'tool-stage' + (live ? ' ready' : '')}>{live ? 'Open' : stage}</span>
      </button>)
    })}</div>
  </div>)
}

/* ---------- facilities ---------- */
function localityOf(f) {
  const a = String(f.address || '').trim()
  if (!a) return f.area || ''
  let parts = a.split(',').map(x => x.trim()).filter(Boolean)
  parts = parts.filter(p => !/^lagos( state)?$/i.test(p) && !/^nigeria$/i.test(p))
  if (!parts.length) return f.area || ''
  let loc = parts[parts.length - 1].replace(/^\d+[a-z]?[\s,]+/i, '').trim()
  if (loc.length < 3 && parts.length > 1) loc = parts[parts.length - 2]
  // Free-text address with no commas: the neighbourhood is almost always the last words.
  let w = loc.split(/\s+/).filter(x => x && !/^(lagos|nigeria|state)$/i.test(x))
  if (w.length > 3) w = w.slice(-2)
  loc = w.join(' ').replace(/[^A-Za-z\s-]/g, '').replace(/-/g, ' ').replace(/\s+/g, ' ').trim()
  if (!loc) return f.area || ''
  return loc.replace(/\b\w/g, c => c.toUpperCase())
}
async function geocodeCall(body) {
  const r = await fetch('/api/geocode', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  return await r.json().catch(() => ({ ok: false, reason: 'bad_response' }))
}
function FacilitiesPage({ list, canEdit, userId, reload }) {
  const [adding, setAdding] = useState(false); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('')
  const [form, setForm] = useState({ name: '', category: '', area: '', address: '', lat: '', lng: '', reg_status: '' })
  const [q, setQ] = useState('')
  const [fstate, setFstate] = useState('all')
  const [visits, setVisits] = useState([])
  const [drawer, setDrawer] = useState(null)
  const [aiClean, setAiClean] = useState(false)
  const [geoRun, setGeoRun] = useState(null)
  const [geoMsg, setGeoMsg] = useState('')
  useEffect(() => { VIS.list().then(setVisits).catch(() => {}) }, [])
  const origin = (typeof window !== 'undefined' && window.location) ? window.location.origin : ''
  function facVisits(f) { return visits.filter(v => (v.facility_id && v.facility_id === f.id) || v.facility_name === f.name) }
  const fileRef = useRef(null)

  const groups = {}
  const stateCount = { live: list.filter(isLive).length, dead: list.filter(f => !isLive(f)).length,
    field: list.filter(f => f.source === 'field').length, unreg: list.filter(f => f.reg_status && f.reg_status !== 'Registered').length }
  const flist = list.filter(f => matchQ(f, q) && (
    fstate === 'all' ? true : fstate === 'live' ? isLive(f) : fstate === 'dead' ? !isLive(f)
    : fstate === 'field' ? f.source === 'field' : fstate === 'unreg' ? (f.reg_status && f.reg_status !== 'Registered') : true))
  flist.forEach(f => { const a = f.area || 'Unassigned'; (groups[a] = groups[a] || []).push(f) })
  const areas = Object.keys(groups).sort()
  const missing = list.filter(f => !hasCoords(f)).length

  async function saveForm() {
    if (!form.name.trim()) { setMsg('A facility name is required.'); return }
    setBusy(true); setMsg('')
    try {
      const lat = parseFloat(form.lat), lng = parseFloat(form.lng)
      // Anything added by hand was found by the team, so tag it like the rest.
      await FAC.addMany([{ name: form.name.trim(), category: form.category.trim(), area: form.area.trim() || 'Unassigned', address: form.address.trim(), last_visit: '', lat: isNaN(lat) ? null : lat, lng: isNaN(lng) ? null : lng, state: 'active', source: 'field', reg_status: form.reg_status || 'Unknown' }], userId)
      toast('Facility added.')
      setForm({ name: '', category: '', area: '', address: '', lat: '', lng: '', reg_status: '' }); setAdding(false); await reload()
    } catch (e) { setMsg(e.message || 'Could not save the facility.') } finally { setBusy(false) }
  }
  async function importRows(text, sourceLabel) {
    let csv = text
    if (aiClean) {
      const r = await askAI({ system: 'You clean a facilities CSV for a Lagos health-facility monitoring app. Return ONLY CSV with this header row: name,category,area,address,lat,lng,last_visit. Standardise area/LGA names, fix casing, remove empty or duplicate rows, keep lat/lng if present. No commentary, no code fences.', prompt: text.slice(0, 6000), max_tokens: 2000 })
      if (r.ok && r.text && /name/i.test(r.text)) csv = r.text.replace(/```[a-z]*/gi, '').replace(/```/g, '').trim()
      else if (!r.ok && r.reason === 'ai_not_configured') toast('AI clean is not set up; imported as-is.', 'warn')
    }
    const items = facilitiesFromCSV(csv)
    if (!items.length) { setMsg('No rows found. Include a header row with a name column.'); return }
    await FAC.addMany(items, userId); await reload(); setMsg(items.length + ' facilities imported' + (sourceLabel ? ' from ' + sourceLabel : '') + (aiClean ? ', cleaned with AI' : '') + '.')
  }
  async function onFile(e) {
    const file = e.target.files && e.target.files[0]; if (!file) return
    setBusy(true); setMsg('')
    try {
      const name = (file.name || '').toLowerCase()
      if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        const XLSX = await import('xlsx')
        const buf = await file.arrayBuffer()
        const wb = XLSX.read(buf, { type: 'array' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const csv = XLSX.utils.sheet_to_csv(sheet)
        await importRows(csv, 'Excel')
      } else {
        const text = await file.text(); await importRows(text, '')
      }
    } catch (e) { setMsg(e.message || 'Could not import the file.') } finally { setBusy(false); if (fileRef.current) fileRef.current.value = '' }
  }
  function downloadTemplate() {
    const header = 'name,category,area,address,lat,lng,last_visit'
    const example = 'Example Health Centre,Primary health centre,Ikeja,12 Example Road,,,'
    download('realms-facilities-template.csv', header + '\n' + example + '\n', 'text/csv')
  }
  async function importSheet() {
    const url = window.prompt('Paste your Google Sheet link (the sheet must be shared as "Anyone with the link can view").')
    if (!url) return
    setBusy(true); setMsg('')
    try {
      const m = url.match(/\/d\/([a-zA-Z0-9-_]+)/); if (!m) throw new Error('That does not look like a Google Sheet link.')
      const gid = (url.match(/[#&?]gid=(\d+)/) || [])[1] || '0'
      const csvUrl = 'https://docs.google.com/spreadsheets/d/' + m[1] + '/export?format=csv&gid=' + gid
      const res = await fetch(csvUrl); if (!res.ok) throw new Error('Could not read the sheet. Make sure link-sharing is on for anyone with the link.')
      const text = await res.text(); const items = facilitiesFromCSV(text)
      if (!items.length) throw new Error('No rows found. Include a header row with a name column.')
      await FAC.addMany(items, userId); await reload(); setMsg(items.length + ' facilities imported from Google Sheet.')
    } catch (e) { setMsg(e.message || 'Google Sheet import failed.') } finally { setBusy(false) }
  }
  async function locate(f) {
    setBusy(true); setMsg('')
    try { const g = await geocode(f.address || f.name + ' ' + (f.area || '')); if (g) { await FAC.update(f.id, { ...g, geo_confirmed: true }); await reload() } else setMsg('No match found. Add coordinates manually.') }
    catch (e) { setMsg('Location lookup failed. Add coordinates manually.') } finally { setBusy(false) }
  }
  async function mapAll() {
    const todo = list.filter(f => !hasCoords(f))
    if (!todo.length) { toast('Every facility already has a pin.'); return }
    let probe = null
    try { probe = await geocodeCall({ probe: true }) } catch (e) {}
    if (!probe || !probe.ok) { toast('The lookup service could not be reached.', 'err'); return }
    if (!probe.hasGoogle && !probe.hasAI) { toast('No lookup service is configured. Add GOOGLE_MAPS_KEY in Vercel.', 'warn'); return }

    const how = probe.hasGoogle
      ? 'Google will find the exact address for ' + todo.length + ' facilities' + (probe.hasAI ? ', and anything it cannot find will be estimated to its neighbourhood by AI' : '') + '.'
      : 'AI will estimate each facility to its neighbourhood centre. Add GOOGLE_MAPS_KEY in Vercel for exact pins.'
    if (!(await confirmAction(how + ' It takes a few minutes. Pins stay marked "check" until your team confirms them.', { title: 'Map the facilities', ok: 'Start' }))) return

    let exact = 0, estimated = 0
    const misses = []
    setGeoRun({ done: 0, total: todo.length, found: 0 })

    // Pass 1: exact addresses through Google.
    if (probe.hasGoogle) {
      for (let i = 0; i < todo.length; i += 25) {
        const batch = todo.slice(i, i + 25)
        const queries = batch.map(f => [f.name, f.address, f.area, 'Lagos, Nigeria'].filter(Boolean).join(', '))
        let r = null
        try { r = await geocodeCall({ list: queries, engine: 'google' }) } catch (e) { r = null }
        if (!r || !r.ok) { setGeoRun(null); toast('Google lookup failed' + (r && r.reason ? ': ' + r.reason : '') + '.', 'err'); return }
        for (let b = 0; b < batch.length; b++) {
          const hit = (r.results || [])[b]
          if (!hit) { misses.push(batch[b]); continue }
          const solid = hit.precision === 'ROOFTOP'
          try { await FAC.update(batch[b].id, { lat: hit.lat, lng: hit.lng, geo_confirmed: solid ? true : false }); exact++ } catch (e) {}
        }
        setGeoRun({ done: Math.min(i + 25, todo.length), total: todo.length, found: exact })
      }
    } else {
      misses.push(...todo)
    }

    // Pass 2: whatever is left, estimated to its neighbourhood by AI.
    if (misses.length && probe.hasAI) {
      const groupsBy = {}
      misses.forEach(f => { const k = localityOf(f) + '|' + (f.area || ''); (groupsBy[k] = groupsBy[k] || []).push(f) })
      const keys = Object.keys(groupsBy)
      setGeoRun({ done: 0, total: keys.length, found: exact, phase: 'Estimating neighbourhoods' })
      for (let i = 0; i < keys.length; i += 25) {
        const batch = keys.slice(i, i + 25)
        const queries = batch.map(k => { const [loc, area] = k.split('|'); return [loc, area, 'Lagos, Nigeria'].filter(Boolean).join(', ') })
        let r = null
        try { r = await geocodeCall({ list: queries, engine: 'ai' }) } catch (e) { r = null }
        if (!r || !r.ok) break
        for (let b = 0; b < batch.length; b++) {
          const hit = (r.results || [])[b]
          if (!hit) continue
          for (const f of groupsBy[batch[b]]) {
            try { await FAC.update(f.id, { lat: hit.lat, lng: hit.lng, geo_confirmed: false }); estimated++ } catch (e) {}
          }
        }
        setGeoRun({ done: Math.min(i + 25, keys.length), total: keys.length, found: exact + estimated, phase: 'Estimating neighbourhoods' })
      }
    }

    await reload(); setGeoRun(null)
    const left = todo.length - exact - estimated
    setGeoMsg([
      exact ? exact + ' pinned to their exact address by Google.' : '',
      estimated ? estimated + ' estimated to their neighbourhood by AI, which is fine for grouping routes but not for finding the door.' : '',
      left ? left + ' could not be placed at all.' : '',
      'Pins marked "check" need a quick look from the team.'
    ].filter(Boolean).join(' '))
    toast((exact + estimated) + ' of ' + todo.length + ' facilities mapped.')
  }
  async function confirmPin(f) { try { await FAC.update(f.id, { geo_confirmed: true }); await reload() } catch (e) { toast('Could not save.', 'err') } }
  async function del(f) { if (!(await confirmAction('Remove ' + f.name + ' from the facility list?', { title: 'Remove facility', ok: 'Remove', danger: true }))) return; await FAC.remove(f.id); await reload(); toast('Facility removed.') }

  return (<div className="page">
    <div className="ptitle"><div><p className="eyebrow">Facilities</p><h2>{list.length} in {areas.length} area{areas.length === 1 ? '' : 's'}</h2></div>
      {canEdit && <div className="ptools">
        <button className="btn small ghost" onClick={() => fileRef.current && fileRef.current.click()}>Bulk upload</button>
        <button className="btn small ghost" onClick={importSheet}>Google Sheet</button>
        <button className="btn small ghost" onClick={downloadTemplate}>Template</button>
        <button className="btn small ghost" onClick={() => window.alert('HEFAMAA sync connects to the Agency\u2019s data feed. Share the API endpoint and we will enable it.')}>HEFAMAA sync</button>
        <button className="btn small primary" onClick={() => setAdding(a => !a)}>{adding ? 'Close' : 'Add facility'}</button>
        <button className="btn small ghost" onClick={mapAll} disabled={!!geoRun}>{geoRun ? ('Mapping ' + geoRun.done + '/' + geoRun.total) : 'Map the facilities'}</button>
        <label className="ai-check"><input type="checkbox" checked={aiClean} onChange={e => setAiClean(e.target.checked)} /> <span className="ai-spark">✦</span> Clean with AI</label>
        <input ref={fileRef} type="file" accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={onFile} style={{ display: 'none' }} />
      </div>}
    </div>
    {canEdit && <p className="hintline">Bulk upload a CSV or Excel file. Columns: name, category, area (or lga), address, lat, lng, last_visit. Only name is required. Use Template for the exact format.</p>}
    {msg && <p className="auth-msg block">{msg}</p>}
    {missing > 0 && <p className="warnline">{missing} facilit{missing === 1 ? 'y is' : 'ies are'} missing coordinates and will not appear on the map. Add lat/lng or use Locate.</p>}

    {adding && canEdit && (<div className="addform">
      <div className="fgrid">
        <label className="field sm"><span>Name</span><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
        <label className="field sm"><span>Category</span><input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g. Primary clinic" /></label>
        <label className="field sm"><span>Area / LGA</span><input value={form.area} onChange={e => setForm({ ...form, area: e.target.value })} placeholder="e.g. Ikeja" /></label>
        <label className="field sm"><span>Address</span><input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></label>
        <label className="field sm"><span>Latitude</span><input value={form.lat} onChange={e => setForm({ ...form, lat: e.target.value })} placeholder="optional" /></label>
        <label className="field sm"><span>Longitude</span><input value={form.lng} onChange={e => setForm({ ...form, lng: e.target.value })} placeholder="optional" /></label>
      </div>
      <button className="btn small primary" onClick={saveForm} disabled={busy}>{busy ? 'Saving\u2026' : 'Save facility'}</button>
    </div>)}

    {geoMsg && <p className="warnline">{geoMsg} <button className="linkbtn subtle" onClick={() => setGeoMsg('')}>Dismiss</button></p>}
    {geoRun && <div className="mon-meter"><div className="meter-row"><span className="meter-lab">{geoRun.phase || 'Mapping'}</span><div className="meter-track"><div className="meter-fill" style={{ width: Math.round(geoRun.done / geoRun.total * 100) + '%' }} /></div><span className="meter-val">{geoRun.done}/{geoRun.total}</span></div></div>}
    {list.length > 0 && <div className="list-tools list-tools-row"><SearchBox value={q} onChange={setQ} placeholder="Search facilities, area, category…" /><select className="sel" value={fstate} onChange={e => setFstate(e.target.value)}><option value="all">All ({list.length})</option><option value="live">For the round ({stateCount.live})</option><option value="dead">Closed or untraceable ({stateCount.dead})</option><option value="field">Found in the field ({stateCount.field})</option><option value="unreg">Not fully registered ({stateCount.unreg})</option></select></div>}
    {list.length === 0 ? <p className="empty">No facilities yet. {canEdit ? 'Add one or import a CSV to begin.' : 'Nothing to show.'}</p> :
      areas.length === 0 ? <p className="empty">No facilities match your search.</p> :
      areas.map((a, ai) => (<div className="cluster" key={a}>
        <div className="cluster-head"><span className="area-dot" style={{ background: AREA_COLORS[ai % AREA_COLORS.length] }} /><h3>{a}</h3><span className="cluster-count">{groups[a].length}</span></div>
        <div className="frows">{groups[a].map(f => (<div className="frow" key={f.id}>
          <div className="fmain"><span className="fname">{f.name}</span><span className="fmeta">{[f.category, f.address, f.phone].filter(Boolean).join(' \u00b7 ') || 'No details'}</span>{(f.reg_status || f.state) && <span className="fchips">{f.reg_status && <span className={'reg-chip ' + (f.reg_status === 'Registered' ? 'ok' : f.reg_status === 'Registration in progress' ? 'prog' : 'no')}>{f.reg_status}</span>}{f.state && STATE_LABEL[f.state] && <span className={'state-chip' + (DEAD_STATES.indexOf(f.state) >= 0 ? ' dead' : '')}>{STATE_LABEL[f.state]}</span>}{f.source === 'field' && <span className="state-chip find">Found in field</span>}</span>}{f.remark && <span className="fremark">{f.remark}</span>}</div>
          <div className="factions">
            <button className="mini" onClick={() => setDrawer(f)}>History</button>
            {f.phone && <a className="mini" href={'tel:' + String(f.phone).replace(/[^0-9+]/g, '')}>Call</a>}
            {hasCoords(f) ? (f.geo_confirmed === false ? (canEdit ? <button className="mini warn" onClick={() => confirmPin(f)}>Confirm pin</button> : <span className="pin no">pin unchecked</span>) : <span className="pin ok" title="Mapped">&#9679;</span>) : (canEdit ? <button className="mini" onClick={() => locate(f)} disabled={busy}>Locate</button> : <span className="pin no">no coords</span>)}
            {canEdit && <button className="mini danger" onClick={() => del(f)}>Remove</button>}
          </div>
        </div>))}</div>
      </div>))}
    {drawer && (<div className="drawer-scrim" onClick={() => setDrawer(null)}>
      <div className="drawer anim-right" onClick={e => e.stopPropagation()}>
        <div className="drawer-head"><div><h3>{drawer.name}</h3><p className="fmeta">{[drawer.category, drawer.area, drawer.address].filter(Boolean).join(' \u00b7 ') || 'No details'}</p></div><button className="mini" onClick={() => setDrawer(null)}>Close</button></div>
        <h4 className="drawer-sub">Visit history</h4>
        {facVisits(drawer).length === 0 ? <p className="empty sm">No visits recorded for this facility yet.</p> :
          <ul className="drawer-visits">{facVisits(drawer).map(v => (
            <li key={v.id}>
              <div className="dv-main"><span className="fname">{(v.arrival_time || v.created_at || '').slice(0, 10)}</span><span className="fmeta">{ragText(v.overall_rating)}{v.score != null ? ' \u00b7 ' + v.score + '%' : ''} \u00b7 {v.status}</span></div>
              {(v.status === 'monitored' || v.status === 'debriefed') && <button className="mini" onClick={() => printDoc('Monitoring Report', buildReport(v, v.debrief || deriveDebrief(v), origin))}>Report</button>}
            </li>
          ))}</ul>}
      </div>
    </div>)}
  </div>)
}
function pinIcon(color, num) {
  const label = num ? '<span style="position:absolute;inset:0;display:grid;place-items:center;transform:rotate(45deg);color:#fff;font:700 11px Lora,serif">' + num + '</span>' : ''
  return L.divIcon({ className: 'rf-pin', html: '<div style="position:relative;width:24px;height:24px"><div style="width:24px;height:24px;background:' + color + ';border:2px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 5px rgba(0,0,0,.35)"></div>' + label + '</div>', iconSize: [24, 24], iconAnchor: [12, 22], popupAnchor: [0, -20] })
}
function MapRoutePage({ list, role, userId }) {
  const mapRef = useRef(null); const mapObj = useRef(null); const layerRef = useRef(null)
  const areas = Array.from(new Set(list.map(f => f.area || 'Unassigned'))).sort()
  const colorMap = {}; areas.forEach((a, i) => { colorMap[a] = AREA_COLORS[i % AREA_COLORS.length] })
  const [area, setArea] = useState('all')
  const [tab, setTab] = useState('plan')
  const [visits, setVisits] = useState([])
  const [q, setQ] = useState('')
  const [perDay, setPerDay] = useState(14)
  const [days, setDays] = useState(5)
  const [scope, setScope] = useState('due')
  const [order, setOrder] = useState('date') // 'date' = oldest first (2nd round), 'geo' = by geography
  const [mode, setMode] = useState('auto') // 'auto' = system plan, 'manual' = pick facilities
  const [picks, setPicks] = useState({})
  const [pq, setPq] = useState('')
  const [plan, setPlan] = useState(null)
  const [planErr, setPlanErr] = useState('')
  const [openDay, setOpenDay] = useState(0)
  const [assignForm, setAssignForm] = useState({})
  const [assignBusy, setAssignBusy] = useState('')
  const canAssign = role === 'team_leader' || role === 'rhsc_hq'
  const isHQ = role === 'rhsc_hq'
  useEffect(() => { VIS.list().then(setVisits).catch(() => {}) }, [])

  const areaCount = {}; list.forEach(f => { const a = f.area || 'Unassigned'; areaCount[a] = (areaCount[a] || 0) + 1 })
  function pickArea(a) { setArea(a); setPlan(null); setPlanErr(''); setOpenDay(-1) }
  const filtered = (area === 'all' ? list : list.filter(f => (f.area || 'Unassigned') === area))
  const plotted = filtered.filter(hasCoords)

  const visByFac = {}
  visits.forEach(v => { const key = v.facility_id || v.facility_name; if (!key) return; const prev = visByFac[key]; if (!prev || (v.arrival_time || v.created_at || '') > (prev.arrival_time || prev.created_at || '')) visByFac[key] = v })
  function facVisit(f) { return visByFac[f.id] || visByFac[f.name] }
  function facStatus(f) { const v = facVisit(f); return v ? (v.status === 'debriefed' ? 'Debriefed' : v.status === 'monitored' ? 'Assessed' : 'Engaged') : 'Not visited' }
  const visitedCount = filtered.filter(facVisit).length
  const assessedCount = filtered.filter(f => { const v = facVisit(f); return v && (v.status === 'monitored' || v.status === 'debriefed') }).length
  const overdueCount = visits.filter(v => (area === 'all' || (v.area || 'Unassigned') === area) && v.debrief && v.debrief.remediation_deadline && daysUntil(v.debrief.remediation_deadline) != null && daysUntil(v.debrief.remediation_deadline) < 7).length
  const tableRows = filtered.filter(f => matchQ(f, q))

  const firstDone = {}, laterDone = {}, firstRec = {}
  visits.forEach(v => {
    const key = v.facility_id || v.facility_name
    if (!key) return
    if (v.debrief && v.debrief.first_visit) { firstDone[key] = true; if (!firstRec[key]) firstRec[key] = v }
    else laterDone[key] = true
  })
  function firstVisitOf(f) { return firstRec[f.id] || firstRec[f.name] || null }
  function baselineDate(f) {
    const v = firstVisitOf(f); if (!v) return ''
    return (v.visit_date || (v.assessment && v.assessment.date) || (v.arrival_time || '').slice(0, 10) || '')
  }
  function isDue(f) { return isLive(f) && (firstDone[f.id] || firstDone[f.name]) && !(laterDone[f.id] || laterDone[f.name]) }
  const dueCountAll = filtered.filter(isDue).length
  let scopePool = filtered.filter(f => (scope === 'due' ? isDue(f) : true))
  // Second round: revisit oldest-first, so the team continues where they began
  // rather than starting from the last facilities they saw. Sort the whole pool
  // by first-assessment date BEFORE the days*perDay slice, so the earliest
  // facilities make this run.
  if (order === 'date') {
    scopePool = scopePool.slice().sort((a, b) => {
      const da = baselineDate(a) || '9999-99-99', db = baselineDate(b) || '9999-99-99'
      return da < db ? -1 : da > db ? 1 : 0
    })
  }
  const planPool = scopePool.filter(hasCoords).slice(0, Math.max(1, days) * Math.max(1, perDay))
  const unmapped = scopePool.length - scopePool.filter(hasCoords).length

  function dayMapsUrl(items) {
    const stops = (items || []).map(f => { if (!f) return null; if (hasCoords(f) && f.geo_confirmed !== false) return f.lat + ',' + f.lng; return encodeURIComponent(f.name + (f.address ? ', ' + f.address : '') + ', Lagos') }).filter(Boolean)
    return stops.length ? 'https://www.google.com/maps/dir/' + stops.join('/') : ''
  }
  function navUrl(f) {
    if (!f) return ''
    const dest = (hasCoords(f) && f.geo_confirmed !== false) ? (f.lat + ',' + f.lng) : encodeURIComponent(f.name + (f.address ? ', ' + f.address : '') + ', Lagos')
    return 'https://www.google.com/maps/dir/?api=1&destination=' + dest + '&travelmode=driving'
  }
  function dayLabel(items) {
    const c = {}; items.forEach(f => { const l = localityOf(f); if (l) c[l] = (c[l] || 0) + 1 })
    const best = Object.keys(c).sort((a, b) => c[b] - c[a])[0]
    return best || (items[0] && items[0].area) || ''
  }
  function dayDateRange(items) {
    const ds = items.map(baselineDate).filter(Boolean).sort()
    if (!ds.length) return ''
    return ds[0] === ds[ds.length - 1] ? ds[0] : ds[0] + ' \u2192 ' + ds[ds.length - 1]
  }
  function buildManual() {
    setPlanErr('')
    const chosen = list.filter(f => picks[f.id])
    if (!chosen.length) { setPlanErr('Tick the facilities you plan to visit.'); return }
    const withPins = chosen.filter(hasCoords)
    const ordered = (withPins.length ? orderRoute(withPins) : []).concat(chosen.filter(f => !hasCoords(f)))
    setPlan([{ day: 1, area: 'Selected route', items: ordered }]); setOpenDay(0)
    toast(ordered.length + ' stop' + (ordered.length === 1 ? '' : 's') + ' routed, nearest-first.')
  }
  function planRoutes() {
    setPlanErr(''); setPlan(null); setOpenDay(0)
    if (!planPool.length) { setPlanErr(scope === 'due' ? 'Nothing is due for a visit here.' : 'No mapped facilities in this view.'); return }
    // Oldest-first keeps chronological day order (continue where the first round began);
    // by-geography groups purely on closeness. Either way each day is nearest-neighbour inside.
    const groups = order === 'date'
      ? clusterDaysByDate(planPool, perDay, baselineDate).slice(0, Math.max(1, days))
      : clusterDays(planPool, days, perDay)
    if (!groups.length) { setPlanErr('Could not group these facilities. Check they have map pins.'); return }
    const out = groups.map((items, i) => ({ day: i + 1, area: order === 'date' ? (dayDateRange(items) || dayLabel(items)) : dayLabel(items), items }))
    setPlan(out)
    toast(out.length + ' day' + (out.length === 1 ? '' : 's') + ' planned, ' + out.reduce((n, d) => n + d.items.length, 0) + ' stops.')
  }
  async function assignDay(key, d) {
    const f = assignForm[key] || {}
    if (!f.monitor) { toast('Choose who leads this day.', 'warn'); return }
    if (!f.date) { toast('Choose the visit date.', 'warn'); return }
    const ids = (d.items || []).map(x => x.id).filter(Boolean)
    if (!ids.length) { toast('No facilities to assign.', 'warn'); return }
    setAssignBusy(key)
    try {
      await ASG.add({ visit_date: f.date, area: d.area || (area === 'all' ? 'Mixed' : area), facility_ids: ids, monitor: f.monitor, note: 'Route plan, ' + ids.length + ' stops' }, userId)
      toast(ids.length + ' facilities set for ' + f.date + (f.monitor === TEAM_LABEL ? '.' : ', led by ' + f.monitor + '.'))
    } catch (e) { toast('Could not save the assignment.', 'err') } finally { setAssignBusy('') }
  }

  useEffect(() => {
    if (!mapRef.current || mapObj.current) return
    const m = L.map(mapRef.current, { scrollWheelZoom: true }).setView([6.5244, 3.3792], 10)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '\u00a9 OpenStreetMap contributors' }).addTo(m)
    layerRef.current = L.layerGroup().addTo(m); mapObj.current = m
    setTimeout(() => m.invalidateSize(), 200)
    return () => { m.remove(); mapObj.current = null }
  }, [])

  // The map follows what you are looking at: the whole area, or the day you opened.
  const focus = (plan && plan[openDay]) ? plan[openDay].items : plotted
  const focusRouted = !!(plan && plan[openDay])
  useEffect(() => {
    const m = mapObj.current, lg = layerRef.current; if (!m || !lg) return
    lg.clearLayers()
    focus.forEach((f, i) => {
      const mk = L.marker([f.lat, f.lng], { icon: pinIcon(focusRouted ? '#6D4B8E' : (colorMap[f.area || 'Unassigned'] || '#6D4B8E'), focusRouted ? i + 1 : null) })
      mk.bindPopup('<strong>' + (f.name || '') + '</strong><br>' + [f.category, f.area, f.phone].filter(Boolean).join(' \u00b7 '))
      mk.addTo(lg)
    })
    if (focusRouted && focus.length > 1) L.polyline(focus.map(f => [f.lat, f.lng]), { color: '#6D4B8E', weight: 3, opacity: .85, dashArray: '6 6' }).addTo(lg)
    if (focus.length) { try { m.fitBounds(focus.map(f => [f.lat, f.lng]), { padding: [40, 40], maxZoom: focusRouted ? 15 : 13 }) } catch (e) {} }
    setTimeout(() => m.invalidateSize(), 120)
  }, [area, list.length, plan, openDay])

  return (<div className="page mr-page">
    <div className="ptitle">
      <div><p className="eyebrow">Map &amp; route</p><h2>{plotted.length} mapped{area === 'all' ? '' : ' in ' + area}</h2></div>
      <div className="ptools">
        <div className="seg area-seg">
          <button type="button" className={'segb' + (area === 'all' ? ' on' : '')} onClick={() => pickArea('all')}>{areas.length === 2 ? 'Both' : 'All areas'}<span className="seg-n">{list.length}</span></button>
          {areas.map(a => (<button type="button" key={a} className={'segb' + (area === a ? ' on' : '')} onClick={() => pickArea(a)}>{a}<span className="seg-n">{areaCount[a] || 0}</span></button>))}
        </div>
      </div>
    </div>

    <div className="mr-grid">
      <div className="mr-mapcol">
        <div className="map-frame"><div ref={mapRef} className="leaflet-holder" /></div>
        <div className="mr-legend">
          {focusRouted
            ? <><span className="lg-dot" style={{ background: '#6D4B8E' }} /><span>Day {plan[openDay].day} route, {focus.length} stops in order</span><button className="linkbtn subtle" onClick={() => setOpenDay(-1)}>Show all</button></>
            : areas.map(a => <span className="lg-item" key={a}><span className="lg-dot" style={{ background: colorMap[a] }} />{a}</span>)}
        </div>
        {plotted.length === 0 && <p className="warnline">Nothing mapped here yet. Use "Map the facilities" on the Facilities tab.</p>}
      </div>

      <aside className="mr-side">
        <div className="seg mr-tabs">
          <button type="button" className={'segb' + (tab === 'plan' ? ' on' : '')} onClick={() => setTab('plan')}>Plan days</button>
          {isHQ && <button type="button" className={'segb' + (tab === 'cover' ? ' on' : '')} onClick={() => setTab('cover')}>Coverage</button>}
        </div>

        {tab === 'plan' && (<>
          <div className="mr-card">
            <div className="seg mr-mode">
              <button type="button" className={'segb' + (mode === 'auto' ? ' on' : '')} onClick={() => { setMode('auto'); setPlan(null); setPlanErr('') }}>Auto plan</button>
              <button type="button" className={'segb' + (mode === 'manual' ? ' on' : '')} onClick={() => { setMode('manual'); setPlan(null); setPlanErr('') }}>Pick manually</button>
            </div>
            {mode === 'auto' ? (<>
            <div className="mr-controls">
              <label className="field sm"><span>Facilities</span>
                <select value={scope} onChange={e => { setScope(e.target.value); setPlan(null) }}>
                  <option value="due">Due for a visit ({dueCountAll})</option>
                  <option value="all">Everything in view ({filtered.length})</option>
                </select>
              </label>
              <label className="field sm"><span>Order</span>
                <select value={order} onChange={e => { setOrder(e.target.value); setPlan(null) }}>
                  <option value="date">Oldest first (continue the round)</option>
                  <option value="geo">By geography (closest together)</option>
                </select>
              </label>
              <div className="mr-two">
                <NumField label="Days" value={days} min={1} max={10} onChange={v => { setDays(v); setPlan(null) }} />
                <NumField label="Per day" value={perDay} min={4} max={30} onChange={v => { setPerDay(v); setPlan(null) }} />
              </div>
            </div>
            <button className="btn primary wide" onClick={planRoutes} disabled={!planPool.length}>Plan {Math.min(days, Math.ceil(planPool.length / Math.max(1, perDay)))} day{planPool.length && Math.min(days, Math.ceil(planPool.length / Math.max(1, perDay))) === 1 ? '' : 's'}</button>
            <p className="hintline">{planPool.length} of {scopePool.length} will be planned{scopePool.length > planPool.length ? ', the rest next run' : ''}.{unmapped ? ' ' + unmapped + ' have no pin yet.' : ''}</p>
            </>) : (<>
            <p className="hintline">Tick the facilities you plan to visit. Stops are ordered nearest-first, and you can add any facility you pass in the field.</p>
            <input className="searchbox" value={pq} onChange={e => setPq(e.target.value)} placeholder="Search facilities…" />
            <div className="pick-list">{filtered.filter(f => matchQ(f, pq)).slice(0, 150).map(f => (
              <label key={f.id} className={'pick-item' + (picks[f.id] ? ' on' : '')}>
                <input type="checkbox" checked={!!picks[f.id]} onChange={() => setPicks(p => ({ ...p, [f.id]: !p[f.id] }))} />
                <span className="pi-main"><span className="pi-name">{f.name}</span><span className="pi-meta">{[f.area, f.address].filter(Boolean).join(' \u00b7 ') || 'No details'}{!hasCoords(f) ? ' \u00b7 no pin' : ''}</span></span>
              </label>))}
            </div>
            {filtered.filter(f => matchQ(f, pq)).length > 150 && <p className="hintline">Showing 150 — search to narrow the list.</p>}
            <div className="pick-actions">
              <span className="pick-n">{Object.values(picks).filter(Boolean).length} selected</span>
              {Object.values(picks).filter(Boolean).length > 0 && <button className="mini ghost" onClick={() => setPicks({})}>Clear</button>}
              <button className="btn primary" onClick={buildManual} disabled={!Object.values(picks).filter(Boolean).length}>Build route</button>
            </div>
            </>)}
          </div>

          {planErr && <p className="warnline">{planErr}</p>}

          {plan && <div className="mr-days">{plan.map((d, i) => {
            const url = dayMapsUrl(d.items); const dayKey = 'd' + i; const open = openDay === i
            return (<div className={'mr-day' + (open ? ' open' : '')} key={i}>
              <button className="mr-day-head" onClick={() => setOpenDay(open ? -1 : i)}>
                <span className="mr-day-n">{d.day}</span>
                <span className="mr-day-t"><strong>{d.area || 'Day ' + d.day}</strong><em>{d.items.length} stops</em></span>
                <span className="mr-day-c">{open ? '\u2212' : '+'}</span>
              </button>
              {open && (<div className="mr-day-body">
                <ol className="plan-list">{d.items.map((f, j) => { const bd = baselineDate(f); return (<li key={j}><span className="pf-name">{f.name}</span>{f.address && <em>{f.address}</em>}{bd && <em className="pf-tel">First assessed {bd}</em>}<a className="pf-nav" href={navUrl(f)} target="_blank" rel="noreferrer">{'\u260e'} Navigate</a></li>) })}</ol>
                <div className="mr-day-actions">
                  {url && <a className="btn small ghost" href={url} target="_blank" rel="noreferrer">Start route in Google Maps (turn-by-turn)</a>}
                </div>
                {canAssign && <div className="plan-assign">
                  <select className="sel" value={(assignForm[dayKey] || {}).monitor || ''} onChange={e => setAssignForm(s => ({ ...s, [dayKey]: { ...(s[dayKey] || {}), monitor: e.target.value } }))}>
                    <option value="">Day led by&#8230;</option>{MONITORS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <input type="date" className="sel" value={(assignForm[dayKey] || {}).date || ''} onChange={e => setAssignForm(s => ({ ...s, [dayKey]: { ...(s[dayKey] || {}), date: e.target.value } }))} />
                  <button className="btn small primary" onClick={() => assignDay(dayKey, d)} disabled={assignBusy === dayKey}>{assignBusy === dayKey ? 'Saving\u2026' : 'Assign'}</button>
                </div>}
              </div>)}
            </div>)
          })}</div>}

          {mode === 'auto' && !plan && !planErr && <p className="empty sm">Set the numbers above and plan the days. {order === 'date' ? 'Days run oldest-first \u2014 the team continues the round from the facilities they first assessed, not the last ones \u2014 and stops within a day are still ordered by how close they are.' : 'Each day is grouped by how close the facilities are to each other.'}</p>}
        </>)}

        {tab === 'cover' && isHQ && (<>
          <div className="mr-stats">
            <div className="mr-stat"><span className="v">{filtered.filter(isLive).length}</span><span className="l">In the round</span></div>
            <div className="mr-stat"><span className="v">{plotted.length}</span><span className="l">Mapped</span></div>
            <div className="mr-stat"><span className="v">{visitedCount}</span><span className="l">Visited</span></div>
            <div className="mr-stat"><span className="v">{assessedCount}</span><span className="l">Assessed</span></div>
            <div className="mr-stat"><span className="v">{dueCountAll}</span><span className="l">Due</span></div>
            <div className="mr-stat"><span className="v">{overdueCount}</span><span className="l">Re-inspect</span></div>
          </div>
          <SearchBox value={q} onChange={setQ} placeholder="Search facilities&#8230;" />
          <div className="hq-table" style={{ marginTop: 10 }}>
            <div className="hq-tr hq-th"><span>Facility</span><span>Area</span><span>Last visit</span><span>Status</span></div>
            {tableRows.length === 0 ? <div className="hq-tr"><span className="hq-name">Nothing matches.</span></div> :
              tableRows.slice(0, 200).map(f => { const v = facVisit(f); return (
                <div className="hq-tr" key={f.id}><span className="hq-name">{f.name}</span><span>{f.area || '\u2014'}</span><span>{v ? (v.arrival_time || v.created_at || '').slice(0, 10) : '\u2014'}</span><span className={'hq-status s-' + facStatus(f).toLowerCase().replace(/[^a-z]/g, '')}>{facStatus(f)}</span></div>
              ) })}
          </div>
          {tableRows.length > 200 && <p className="hintline">Showing the first 200. Use search to narrow it.</p>}
        </>)}
      </aside>
    </div>
  </div>)
}

/* ---------- second assessment (round 2; baseline = first assessment) ---------- */
const SA_FIELDS = [
  ['reg_status', 'Registration status', 's'],
  ['renewal_status', 'Renewal status', 's'],
  ['services', 'Services rendered', 'l'],
  ['staff_strength', 'Total staff strength', 'l'],
  ['staff_on_duty', 'Staff met on duty', 'l'],
  ['basic_equipment', 'Basic equipment available', 'l'],
  ['wards', '# of Wards', 's'], ['beds', '# of Beds', 's'], ['toilets', '# of Toilets', 's'],
  ['environment', 'Environment', 'l'],
  ['waste_mgmt', 'Waste management', 'l'],
  ['clinical_area', 'Theatre / clinical areas', 'l'],
  ['others', 'Others', 'l']
]
function saNum(v) { if (v == null || v === '') return null; const m = String(v).match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null }
function REC_LABEL(s) { return s === 'resolved' ? 'Resolved' : s === 'in_progress' ? 'In progress' : 'Not done' }
// A compact version of the RHSC checklist for the return visit: the same 36 items and
// the same green/amber/red scoring as Monitor, rating plus an optional note, without the
// photo/voice evidence capture (that belongs to the first, formal inspection). Pre-filled
// from the first visit so the team confirms or changes each item.
function SaChecklist({ value, onChange, confirmed, onConfirm }) {
  const data = value || {}
  const conf = confirmed || {}
  const setItem = (key, patch) => onChange({ ...data, [key]: { ...(data[key] || {}), ...patch } })
  const allConfirmed = CHECKLIST.every(c => conf[c.id])
  return (<div className="sa-check">
    <div className="sa-confirm-all">
      <button type="button" className="mini" onClick={() => { const next = {}; CHECKLIST.forEach(c => { next[c.id] = !allConfirmed }); onConfirm(next) }}>{allConfirmed ? 'Reopen all sections' : 'Confirm all unchanged'}</button>
      <span className="sa-confirm-n">{CHECKLIST.filter(c => conf[c.id]).length} of {CHECKLIST.length} sections confirmed</span>
    </div>
    {CHECKLIST.map(cat => {
    const cs = categoryScore(data, cat)
    const isConf = !!conf[cat.id]
    return (<details className={'mcat sa-mcat' + (isConf ? ' confirmed' : '')} key={cat.id} open={!isConf}>
      <summary className="mcat-head"><h3>{cat.label}{isConf && <span className="sa-conf-tag">Unchanged &#10003;</span>}</h3><div className="mcat-r"><Chip rag={cs.rag} pct={cs.pct} /></div></summary>
      <div className="sa-sec-tools">
        <button type="button" className={'mini' + (isConf ? ' ok' : '')} onClick={() => onConfirm({ ...conf, [cat.id]: !isConf })}>{isConf ? 'Confirmed unchanged \u2014 reopen' : 'Confirm this section unchanged'}</button>
      </div>
      <div className="mitems">{cat.items.map((label, i) => {
        const key = cat.id + '_' + i; const it = data[key] || { rating: null, note: '' }
        return (<div className="mitem" key={key}>
          <div className="mitem-top"><span className="mlabel">{label}</span><Rag value={it.rating} onChange={r => { setItem(key, { rating: r }); if (conf[cat.id]) onConfirm({ ...conf, [cat.id]: false }) }} /></div>
          <div className="mnote-row"><textarea className="mnote" rows="1" placeholder="Note (optional)" value={it.note || ''} onChange={e => setItem(key, { note: e.target.value })} /></div>
        </div>)
      })}</div>
    </details>)
  })}</div>)
}
function SecondAssessmentPage({ facilities, identity, userId, role }) {
  const origin = (typeof window !== 'undefined' && window.location) ? window.location.origin : ''
  const [visits, setVisits] = useState([])
  const [sub, setSub] = useState('due')
  const [openId, setOpenId] = useState(null)
  const [engId, setEngId] = useState(null)
  const [checking, setChecking] = useState('')
  const [form, setForm] = useState({})
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState('')
  useEffect(() => { VIS.list().then(setVisits).catch(() => {}) }, [])
  // Keep an on-device draft so leaving the page, or a refresh, never loses field work.
  useEffect(() => {
    if (!openId) return
    draftSet('realms_second_' + openId, form)
  }, [openId, form])

  const firstRec = {}, secondRec = {}
  visits.forEach(v => {
    const key = v.facility_id || v.facility_name; if (!key) return
    if (v.round === 2 || v.status === 'second' || (v.debrief && v.debrief.second_visit)) secondRec[key] = v
    else if (v.debrief && v.debrief.first_visit) { if (!firstRec[key]) firstRec[key] = v }
  })
  const firstOf = f => firstRec[f.id] || firstRec[f.name] || null
  const secondOf = f => secondRec[f.id] || secondRec[f.name] || null
  const baseAssess = f => { const v = firstOf(f); return (v && (v.assessment || (v.monitoring && v.monitoring.first_assessment))) || null }
  function basePct(b) { if (!b) return null; if (b.pct_score != null && b.pct_score !== '') return { v: saNum(b.pct_score), est: false }; if (b.pct_estimate != null && b.pct_estimate !== '') return { v: saNum(b.pct_estimate), est: true }; return null }
  const baseDate = f => { const v = firstOf(f); return v ? (v.visit_date || (v.assessment && v.assessment.date) || (v.arrival_time || '').slice(0, 10) || '') : '' }

  const withFirst = facilities.filter(f => isLive(f) && firstOf(f))
  const byDate = (a, b) => { const x = baseDate(a) || '9999-99-99', y = baseDate(b) || '9999-99-99'; return x < y ? -1 : x > y ? 1 : 0 }
  const dueAll = withFirst.filter(f => !secondOf(f)).sort(byDate)
  const doneAll = withFirst.filter(f => secondOf(f)).sort(byDate)
  const due = dueAll.filter(f => matchQ(f, q))
  const done = doneAll.filter(f => matchQ(f, q))

  function engagementFor(f) {
    const today = new Date().toISOString().slice(0, 10)
    return visits.find(v => (v.facility_id === f.id || v.facility_name === f.name) && v.status === 'engaged'
      && ((v.arrival_time || v.created_at || '').slice(0, 10) === today)) || null
  }
  function openForm(f, eng) {
    const b = baseAssess(f) || {}
    setOpenId(f.id); setEngId(eng ? eng.id : null)
    const pre = {}; SA_FIELDS.forEach(([k]) => { pre[k] = b[k] || '' })
    // Carry the first visit's full HEFAMAA form forward as the starting point, so the
    // team confirms and updates each item rather than re-entering all 198 from scratch.
    const first = firstOf(f)
    const baseHef = (first && first.monitoring && first.monitoring.hefamaa) || {}
    // The RHSC checklist items live on the first visit's monitoring.items; carry the
    // ratings and notes forward, but drop the first visit's photos/voice (fresh evidence
    // belongs to the formal first inspection, not the return visit).
    const baseItems = (first && first.monitoring && first.monitoring.items) || {}
    const carriedChecklist = {}
    let carriedCount = 0
    Object.keys(baseItems).forEach(k => { const it = baseItems[k] || {}; if (it.rating) carriedCount++; carriedChecklist[k] = { rating: it.rating || null, note: it.note || '' } })
    // The 684 imported baselines hold a first-visit percentage but no per-item checklist.
    // Rather than leave the whole checklist blank, seed a plausible starting rating from
    // that score (green facility -> items start green, etc.), clearly flagged as estimated
    // from the first-visit score, so the team confirms or corrects rather than starting cold.
    let checkSeeded = false
    if (carriedCount === 0) {
      const bp = basePct(b)
      if (bp && bp.v != null) {
        // Seed a rating mix whose score lands near the first-visit percentage, rather than
        // painting every item one colour (which would overstate a green facility as 100%).
        // Each item is worth 2 points; total target points = pct% of (36*2).
        const items = []
        CHECKLIST.forEach(cat => cat.items.forEach((_, i) => items.push(cat.id + '_' + i)))
        const target = Math.round(bp.v / 100 * items.length * 2) // points to distribute, 0..72
        let left = target
        items.forEach((key, idx) => {
          const remaining = items.length - idx
          const per = left / remaining // ideal points for this item
          const rating = per >= 1.5 ? 'green' : per >= 0.5 ? 'amber' : 'red'
          const pts = rating === 'green' ? 2 : rating === 'amber' ? 1 : 0
          left -= pts
          carriedChecklist[key] = { rating, note: '' }
        })
        checkSeeded = true
      }
    }
    const baseHefCount = Object.keys(baseHef).filter(k => { const v = baseHef[k]; return Array.isArray(v) ? v.length : (v != null && v !== '') }).length
    const fresh = { ...pre, total_score: '', pct_score: '', notes: '', newRecs: '',
      hef: { ...baseHef }, check: carriedChecklist,
      checkHasBaseline: carriedCount > 0, checkSeeded, hefHasBaseline: baseHefCount > 0,
      recStatus: (b.recommendations || []).map(() => 'in_progress') }
    let restored = null
    try { const raw = localStorage.getItem('realms_second_' + f.id); if (raw) { const p = JSON.parse(raw); if (p && typeof p === 'object') restored = p } } catch (e) {}
    setForm(restored ? { ...fresh, ...restored } : fresh)
    if (restored) toast('Unsaved work restored on this device.')
  }
  // A second assessment must be backed by a check-in, so every return visit carries
  // the same GPS proof of attendance as a first visit. If the team has already
  // checked in today we go straight through; otherwise we capture it here in one tap.
  async function startVisit(f) {
    const existing = engagementFor(f)
    if (existing) { openForm(f, existing); return }
    if (!navigator.geolocation) { toast('Location is not available on this device. GPS is required to check in.', 'err'); return }
    setChecking(f.id)
    navigator.geolocation.getCurrentPosition(async p => {
      const coords = { lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) }
      try {
        const row = {
          facility_id: f.id, facility_name: f.name, area: f.area || 'Unassigned',
          address: f.address || '', category: f.category || '',
          status: 'engaged', arrival_time: new Date().toISOString(),
          lat: coords.lat, lng: coords.lng,
          team: [{ name: (identity && identity.name) || 'RHSC Field Monitoring Team', role: 'Team' }],
          person_in_charge: {}
        }
        await VIS.add(row, userId)
        const vs = await VIS.list(); setVisits(vs)
        const eng = vs.find(v => (v.facility_id === f.id || v.facility_name === f.name) && v.status === 'engaged'
          && (v.arrival_time || v.created_at || '').slice(0, 10) === new Date().toISOString().slice(0, 10)) || null
        toast('Checked in at ' + f.name + '.')
        openForm(f, eng)
      } catch (e) { toast('Could not save the check-in.', 'err') } finally { setChecking('') }
    }, () => { setChecking(''); toast('Location permission denied. GPS is required at check-in, please enable location and try again.', 'err') },
      { enableHighAccuracy: true, timeout: 10000 })
  }
  function improvementFor(f) {
    const b = baseAssess(f) || {}
    const bs = saNum(b.total_score), bp = (basePct(b) || {}).v
    // The checklist now drives the score, the same way it does on a first visit; if no
    // checklist items were rated, fall back to whatever was typed in the score fields.
    const cScore = computeScore(form.check || {})
    const ns = cScore.rated ? cScore.pct : saNum(form.total_score)
    const np = cScore.rated ? cScore.pct : saNum(form.pct_score)
    const recTotal = (b.recommendations || []).length
    const resolved = (form.recStatus || []).filter(s => s === 'resolved').length
    const dScore = (bs != null && ns != null) ? +(ns - bs).toFixed(1) : null
    const dPct = (bp != null && np != null) ? +(np - bp).toFixed(1) : null
    let verdict = 'No change'
    if (dPct != null) verdict = dPct > 2 ? 'Improved' : dPct < -2 ? 'Declined' : 'No change'
    else if (recTotal) verdict = resolved > recTotal / 2 ? 'Improved' : resolved === 0 ? 'No change' : 'In progress'
    return { dScore, dPct, resolved, recTotal, verdict, baseScore: bs, basePct: bp, newScore: ns, newPct: np }
  }
  async function save(f) {
    const b = baseAssess(f) || {}; const first = firstOf(f); const imp = improvementFor(f)
    const today = new Date().toISOString().slice(0, 10)
    const assessment = { date: today, source: 'second_assessment', inspected_by: (identity && identity.name) || '' }
    SA_FIELDS.forEach(([k]) => { assessment[k] = form[k] || '' })
    // The checklist drives the score. Manual entry is kept as a fallback if no items rated.
    const cScore = computeScore(form.check || {})
    assessment.total_score = cScore.rated ? cScore.rated * 2 : saNum(form.total_score) // scored points available basis kept for reference
    assessment.pct_score = cScore.rated ? cScore.pct : saNum(form.pct_score)
    assessment.checklist_pct = cScore.rated ? cScore.pct : null
    assessment.recommendation_status = (b.recommendations || []).map((r, i) => ({ text: r, status: (form.recStatus || [])[i] || 'not_done' }))
    assessment.new_recommendations = (form.newRecs || '').split('\n').map(s => s.trim()).filter(Boolean)
    assessment.notes = form.notes || ''
    const eng = engId ? visits.find(v => v.id === engId) : null
    const row = {
      facility_id: f.id, facility_name: f.name, area: f.area, status: 'second', round: 2,
      baseline_visit_id: (first && first.id) || null, visit_date: today,
      arrival_time: (eng && eng.arrival_time) || new Date().toISOString(),
      score: assessment.pct_score != null ? assessment.pct_score : null, overall_rating: ragFromPct(assessment.pct_score),
      team: (eng && eng.team) || [{ name: (identity && identity.name) || 'RHSC Field Monitoring Team', role: 'Team' }],
      monitoring: { second_assessment: assessment, hefamaa: form.hef || {}, items: form.check || {} }, assessment, improvement: imp,
      debrief: { first_visit: false, second_visit: true, narrative: 'Second assessment on ' + today + '. ' + imp.verdict + (imp.recTotal ? ' \u2014 ' + imp.resolved + ' of ' + imp.recTotal + ' first-visit recommendations resolved.' : '.') }
    }
    setBusy(true)
    // Completing the check-in record keeps one row per visit and carries its GPS through.
    try {
      if (eng) await VIS.update(eng.id, row)
      else await VIS.add(row, userId)
      const visitId = eng ? eng.id : null
      // A return visit must raise the same follow-up call and integrity notice as a first
      // visit. The call to the facility is how a demand for money finds its way back to us.
      try {
        await NOTIF.add({ type: 'visit_completed', visit_id: visitId, facility_name: f.name, area: f.area, channel: 'customer_service', status: 'pending', message: 'Second assessment completed at ' + f.name + ' (' + (f.area || '') + '). Customer service to call the facility to hear how the visit went.' }, userId)
      } catch (e2) {}
      try {
        const cs = getSettings()
        const csMsg = 'RHSC: second assessment completed at ' + f.name + '. Please call the facility to follow up.'
        const encPhone = (eng && eng.person_in_charge && eng.person_in_charge.phone) || ''
        const facNum = f.phone || encPhone
        if (f && !f.phone && encPhone) { try { await FAC.update(f.id, { phone: encPhone }) } catch (e3) {} }
        if (facNum) {
          const fm = 'RHSC/HEFAMAA: your facility was monitored today. This visit is free of charge and our officers must never request money, gifts or favours. If anything was asked of you, report it in confidence to ' + CONTACT.phone + '.'
          try { sendNotify({ channel: 'sms', to: facNum, message: fm }) } catch (e3) {}
          try { sendNotify({ channel: 'whatsapp', to: facNum, message: fm }) } catch (e3) {}
          try { await NOTIF.add({ type: 'integrity_notice', visit_id: visitId, facility_name: f.name, area: f.area, channel: 'sms', status: 'sent', message: fm }, userId) } catch (e3) {}
        }
        if (cs.cs_email) { try { sendNotify({ channel: 'email', to: cs.cs_email, subject: 'Second assessment completed: ' + f.name, message: csMsg }) } catch (e3) {} }
        if (cs.cs_phone) { try { sendNotify({ channel: 'sms', to: cs.cs_phone, message: csMsg }) } catch (e3) {} }
        if (cs.cs_whatsapp) { try { sendNotify({ channel: 'whatsapp', to: cs.cs_whatsapp, message: csMsg }) } catch (e3) {} }
      } catch (e2) {}
      try { localStorage.removeItem('realms_second_' + f.id) } catch (e2) {}
      toast('Second assessment saved for ' + f.name + '.'); setOpenId(null); setEngId(null); setForm({}); const vs = await VIS.list(); setVisits(vs); setSub('done')
    }
    catch (e) { toast('Could not save the second assessment.', 'err') } finally { setBusy(false) }
  }

  function VerdictChip({ v }) { const c = v === 'Improved' ? 'g' : v === 'Declined' ? 'r' : 'a'; return <span className={'sa-verdict ' + c}>{v}</span> }

  return (<div className="page">
    <div className="ptitle">
      <div><p className="eyebrow">Second assessment</p><h2>{dueAll.length} due &middot; {doneAll.length} completed</h2></div>
    </div>
    <p className="lead sm">The second visit continues the first. Each facility is shown with its first-assessment baseline so you can record what changed and whether it improved. Oldest baselines are listed first.</p>

    <div className="seg" style={{ margin: '4px 0 14px' }}>
      <button type="button" className={'segb' + (sub === 'due' ? ' on' : '')} onClick={() => setSub('due')}>Due for a second visit<span className="seg-n">{dueAll.length}</span></button>
      <button type="button" className={'segb' + (sub === 'done' ? ' on' : '')} onClick={() => setSub('done')}>Completed<span className="seg-n">{doneAll.length}</span></button>
    </div>
    <SearchBox value={q} onChange={setQ} placeholder="Search facilities&#8230;" />

    {sub === 'due' && <div className="sa-list">
      {due.length === 0 && <p className="empty sm">{dueAll.length ? 'Nothing matches your search.' : 'No facilities are due for a second assessment yet. Load the first-assessment baselines, then facilities appear here oldest-first.'}</p>}
      {due.map(f => { const b = baseAssess(f); const open = openId === f.id; const bd = baseDate(f)
        return (<div className={'sa-item' + (open ? ' open' : '')} key={f.id}>
          <button className="sa-head" onClick={() => open ? (setOpenId(null), setEngId(null), setForm({})) : startVisit(f)} disabled={checking === f.id}>
            <span className="sa-name"><strong>{f.name}</strong><em>{[f.area, f.address].filter(Boolean).join(' \u00b7 ')}</em></span>
            <span className="sa-meta">{bd ? 'First assessed ' + bd : 'No baseline date'}{(() => { const bp = basePct(b); if (b && b.visited_unscored) return ' \u00b7 not scored (visited)'; return b && b.total_score != null ? ' \u00b7 score ' + b.total_score + (bp ? ' (' + bp.v + '%' + (bp.est ? ' est.' : '') + ')' : '') : '' })()}</span>
            <span className="sa-tog">{open ? '\u2212' : checking === f.id ? 'Checking in…' : engagementFor(f) ? 'Start' : 'Check in to start'}</span>
          </button>
          {open && (() => { const imp = improvementFor(f); const base = b || {}
            return (<div className="sa-body">
              {!b && <p className="warnline">No first-assessment baseline is on file for this facility (it was among the first ~50 without reports). You can still record the visit; improvement will be based on this visit only.</p>}
              <div className="sa-cmp">
                <div className="sa-col sa-basecol">
                  <h4 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>First assessment{bd ? ' \u00b7 ' + bd : ''}<button className="mini" onClick={() => { const fv = firstOf(f); if (fv) printDoc('Monitoring Report', buildMonitoringReport(fv, origin)) }}>Print report</button></h4>
                  {SA_FIELDS.map(([k, lab]) => (<div className="sa-row" key={k}><span className="sa-lab">{lab}</span><span className="sa-val">{base[k] || '\u2014'}</span></div>))}
                  <div className="sa-row"><span className="sa-lab">Score</span><span className="sa-val">{base.visited_unscored ? 'Visited \u2014 not scored' : (base.total_score != null ? base.total_score : '\u2014') + (() => { const bp = basePct(base); return bp ? ' (' + bp.v + '%' + (bp.est ? ' est.' : '') + ')' : '' })()}</span></div>
                  {(base.pct_estimated || base.visited_unscored) && <div className="sa-row"><span className="sa-lab"></span><span className="sa-val" style={{ fontSize: '11.5px', color: '#8A7AA6' }}>{base.score_basis || base.pct_basis || ''}</span></div>}
                </div>
                <div className="sa-col sa-nowcol">
                  <h4>This visit</h4>
                  {(() => { const e = engId ? visits.find(v => v.id === engId) : null; return e && e.lat != null
                    ? <p className="sa-checkin">Checked in {fmtTime(e.arrival_time)} &middot; location captured</p> : null })()}
                  {SA_FIELDS.map(([k, lab, sz]) => (<label className="field sm" key={k}><span>{lab}</span>
                    {sz === 'l'
                      ? <textarea className="sa-ta" rows={4} value={form[k] || ''} onChange={e => setForm(s => ({ ...s, [k]: e.target.value }))} />
                      : <input value={form[k] || ''} onChange={e => setForm(s => ({ ...s, [k]: e.target.value }))} inputMode={k === 'wards' || k === 'beds' || k === 'toilets' ? 'numeric' : undefined} />}
                  </label>))}
                  {(() => { const cs = computeScore(form.check || {}); return cs.rated
                    ? <div className="sa-score-live"><span className="sa-score-l">Checklist score</span><span className="sa-score-v"><Chip rag={cs.rag} pct={cs.pct} /></span><span className="sa-score-n">{cs.rated} of {CHECKLIST.reduce((n, c) => n + c.items.length, 0)} items rated</span></div>
                    : <div className="mr-two">
                        <label className="field sm"><span>Total score</span><input inputMode="numeric" value={form.total_score || ''} onChange={e => setForm(s => ({ ...s, total_score: e.target.value }))} /></label>
                        <label className="field sm"><span>% score</span><input inputMode="numeric" value={form.pct_score || ''} onChange={e => setForm(s => ({ ...s, pct_score: e.target.value }))} /></label>
                      </div> })()}
                </div>
              </div>

              {(base.recommendations || []).length > 0 && <div className="sa-recs">
                <h4>Progress on first-visit recommendations</h4>
                {(base.recommendations || []).map((r, i) => (<div className="sa-rec" key={i}>
                  <span className="sa-rec-t">{r}</span>
                  <span className="sa-rec-pills">{['resolved', 'in_progress', 'not_done'].map(st => (
                    <button type="button" key={st} className={'sa-pill ' + (st === 'resolved' ? 'g' : st === 'in_progress' ? 'a' : 'r') + ((form.recStatus || [])[i] === st ? ' on' : '')}
                      onClick={() => setForm(s => { const arr = (s.recStatus || []).slice(); arr[i] = st; return { ...s, recStatus: arr } })}>{REC_LABEL(st)}</button>))}</span>
                </div>))}
              </div>}

              <label className="field sm"><span>New recommendations (one per line)</span><textarea className="sa-ta" rows={4} value={form.newRecs || ''} onChange={e => setForm(s => ({ ...s, newRecs: e.target.value }))} /></label>
              <label className="field sm"><span>Notes</span><textarea className="sa-ta" rows={4} value={form.notes || ''} onChange={e => setForm(s => ({ ...s, notes: e.target.value }))} /></label>

              <div className="sa-check-wrap">
                <details className="hef-wrap" open>
                  <summary className="hef-title"><span>RHSC compliance checklist{form.checkSeeded ? <span className="sa-conf-tag" style={{ background: '#FBF3E2', borderColor: '#E9D6A8', color: '#7A5B12' }}>estimated start</span> : null}</span><span className="hef-total">{(() => { const cs = computeScore(form.check || {}); return cs.rated + '/' + CHECKLIST.reduce((n, c) => n + c.items.length, 0) })()}</span></summary>
                  <p className="hintline">{form.checkHasBaseline ? 'Carried over from the first visit \u2014 confirm sections that are unchanged, and only change what differs. The score is calculated from your ratings.' : form.checkSeeded ? 'No per-item checklist was recorded on the first visit, so these ratings are estimated from that visit\u2019s overall score. Confirm what matches and correct what doesn\u2019t \u2014 the score follows your ratings.' : 'This facility has no earlier checklist on record, so rate each item fresh. The score is calculated from your ratings.'}</p>
                  <SaChecklist value={form.check || {}} onChange={cv => setForm(s => ({ ...s, check: cv }))} confirmed={form.checkConfirm || {}} onConfirm={(form.checkHasBaseline || form.checkSeeded) ? (cf => setForm(s => ({ ...s, checkConfirm: cf }))) : undefined} />
                </details>
              </div>

              <div className="sa-hef">
                <details className="hef-wrap" open>
                  <summary className="hef-title"><span>HEFAMAA facility inspection form</span><span className="hef-total">{HEFAMAA_FORM.reduce((n, s) => n + hefAnswered(s, form.hef || {}), 0)}/{HEFAMAA_FORM.reduce((n, s) => n + s.fields.length, 0)}</span></summary>
                  <p className="hintline">{form.hefHasBaseline ? 'Carried over from the first visit \u2014 confirm sections that are unchanged, and only change what differs. This is the full inspection HEFAMAA requires each visit.' : 'No earlier form on record for this facility, so complete each section. This is the full inspection HEFAMAA requires each visit.'}</p>
                  <HefammaForm value={form.hef || {}} onChange={hv => setForm(s => ({ ...s, hef: hv }))} confirmed={form.hefConfirm || {}} onConfirm={form.hefHasBaseline ? (cf => setForm(s => ({ ...s, hefConfirm: cf }))) : undefined} />
                </details>
              </div>

              <div className="sa-improve">
                <span className="sa-improve-l">Change since first assessment</span>
                <div className="sa-improve-r">
                  <VerdictChip v={imp.verdict} />
                  {imp.dScore != null && <span className={'sa-delta ' + (imp.dScore > 0 ? 'g' : imp.dScore < 0 ? 'r' : '')}>score {imp.dScore > 0 ? '+' : ''}{imp.dScore}</span>}
                  {imp.dPct != null && <span className={'sa-delta ' + (imp.dPct > 0 ? 'g' : imp.dPct < 0 ? 'r' : '')}>{imp.dPct > 0 ? '+' : ''}{imp.dPct}%</span>}
                  {imp.recTotal > 0 && <span className="sa-delta">{imp.resolved}/{imp.recTotal} resolved</span>}
                </div>
              </div>
              <button className="btn primary wide" onClick={() => save(f)} disabled={busy}>{busy ? 'Saving\u2026' : 'Save second assessment'}</button>
            </div>)
          })()}
        </div>)
      })}
    </div>}

    {sub === 'done' && <div className="sa-list">
      {done.length === 0 && <p className="empty sm">No second assessments recorded yet.</p>}
      {done.map(f => { const v = secondOf(f); const imp = (v && v.improvement) || {}; const b = baseAssess(f) || {}
        return (<div className="sa-item done" key={f.id}>
          <div className="sa-head static">
            <span className="sa-name"><strong>{f.name}</strong><em>{[f.area, (v && v.visit_date) ? 'revisited ' + v.visit_date : ''].filter(Boolean).join(' \u00b7 ')}</em></span>
            <span className="sa-meta">
              {imp.verdict && <VerdictChip v={imp.verdict} />}
              {imp.dScore != null && <span className={'sa-delta ' + (imp.dScore > 0 ? 'g' : imp.dScore < 0 ? 'r' : '')}>score {imp.dScore > 0 ? '+' : ''}{imp.dScore}</span>}
              {imp.dPct != null && <span className={'sa-delta ' + (imp.dPct > 0 ? 'g' : imp.dPct < 0 ? 'r' : '')}>{imp.dPct > 0 ? '+' : ''}{imp.dPct}%</span>}
              {imp.recTotal > 0 && <span className="sa-delta">{imp.resolved}/{imp.recTotal} resolved</span>}
            </span>
          </div>
          {v && <div className="sa-done-actions">
            <button className="mini primary" onClick={() => { try { printDoc('Inspection Report', buildInspectionReport(v, v.debrief || deriveDebrief(v), origin)) } catch (e) { toast('Could not open the report.', 'err') } }}>HEFAMAA inspection report</button>
            <button className="mini" onClick={() => { try { printDoc('Second Assessment Report', buildSecondReport(v, origin, visits)) } catch (e) { toast('Could not open the report.', 'err') } }}>Comparison</button>
          </div>}
        </div>)
      })}
    </div>}
  </div>)
}

/* ---------- engage (Stage 4) ---------- */
function IdCard({ name, role }) {
  return (<div className="idcard">
    <img className="idmark" src="/rhsc-mark.png" alt="RHSC" />
    <div className="idbody">
      <span className="idname">{name || 'Team member'}</span>
      <span className="idrole">{role || 'Field Monitor'}</span>
      <span className="idorg">RHSC &middot; HEFAMAA &middot; Lagos State</span>
    </div>
  </div>)
}

function EngagePage({ list, identity, role, userId }) {
  const roleLabel = (roleById(role) || {}).label || 'Field Monitor'
  const [step, setStep] = useState(0)
  const [facility, setFacility] = useState(null)
  const [arrival, setArrival] = useState(null)
  const [coords, setCoords] = useState(null)
  const [geoMsg, setGeoMsg] = useState('')
  const [team, setTeam] = useState([{ name: identity.name, role: roleLabel }])
  const [nm, setNm] = useState(''); const [nr, setNr] = useState('')
  const [pic, setPic] = useState({ name: '', role: '', phone: '' })
  const [greeted, setGreeted] = useState(false)
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(''); const [done, setDone] = useState(false)
  const [ref] = useState(() => 'RF-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + String(Math.floor(Math.random() * 9000) + 1000))
  const [q, setQ] = useState('')

  const [asgs, setAsgs] = useState([]); const [todayVisits, setTodayVisits] = useState([])
  const todayISO = new Date().toISOString().slice(0, 10)
  const todayStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
  useEffect(() => { ASG.list().then(setAsgs).catch(() => {}); VIS.list().then(setTodayVisits).catch(() => {}) }, [])
  const myIds = {}
  // RHSC works as a single team, so today's round is everyone's round.
  asgs.filter(a => a.visit_date === todayISO).forEach(a => { (a.facility_ids || []).forEach(id => { myIds[id] = true }) })
  const myDay = list.filter(f => myIds[f.id])
  const visitedToday = {}
  todayVisits.forEach(v => { if ((v.arrival_time || '').slice(0, 10) === todayISO && v.facility_id) visitedToday[v.facility_id] = true })

  const groups = {}; list.forEach(f => { const a = f.area || 'Unassigned'; (groups[a] = groups[a] || []).push(f) })
  const areaKeys = Object.keys(groups).sort()
  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const lead = team[0]; const others = team.slice(1)
  const introMembers = others.length ? others.map(m => m.name).join(', ') : ''
  const intro = 'Good morning, sir/ma. We are from REALMS Healthcare Services Consulting Limited, working with HEFAMAA, Lagos State. I am ' + (lead ? lead.name : 'the team lead') + (others.length ? (', and these are ' + introMembers) : '') + '. We are here to conduct routine monitoring of this health facility as mandated by law.'

  function chooseFacility(f) { setFacility(f); setStep(1) }
  function checkIn() {
    if (!coords) { setGeoMsg('GPS location is required at check-in. Tap Capture location and allow access.'); return }
    setArrival(new Date()); setStep(2)
  }
  function capture() {
    if (!navigator.geolocation) { setGeoMsg('Location is not available on this device. GPS is required to check in.'); return }
    setGeoMsg('Locating\u2026')
    navigator.geolocation.getCurrentPosition(
      p => { setCoords({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) }); setGeoMsg('') },
      () => setGeoMsg('Location permission denied. GPS is required at check-in, please enable location and try again.'),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }
  useEffect(() => { if (step === 1 && !coords) capture() }, [step])
  function addMember() { if (!nm.trim()) return; setTeam(t => t.concat([{ name: nm.trim(), role: nr.trim() || 'Field Monitor' }])); setNm(''); setNr('') }
  function removeMember(i) { setTeam(t => t.filter((_, x) => x !== i)) }

  async function save() {
    if (!greeted) { setMsg('Confirm the greeting to continue.'); return }
    if (!coords) { setStep(1); setMsg('GPS is mandatory at check-in. Capture the location to continue.'); setGeoMsg('GPS location is required at check-in. Tap Capture location and allow access.'); return }
    setBusy(true); setMsg('')
    try {
      await VIS.add({
        facility_id: facility.id, facility_name: facility.name, area: facility.area || 'Unassigned',
        address: facility.address || '', category: facility.category || '',
        status: 'engaged', arrival_time: (arrival || new Date()).toISOString(),
        lat: coords.lat, lng: coords.lng,
        team, person_in_charge: pic, greeting_confirmed: true
      }, userId)
      setDone(true); toast('Check-in saved.')
    } catch (e) { setMsg(e.message || 'Could not save the check-in.') } finally { setBusy(false) }
  }
  function reset() { setStep(0); setFacility(null); setArrival(null); setCoords(null); setGeoMsg(''); setTeam([{ name: identity.name, role: roleLabel }]); setPic({ name: '', role: '', phone: '' }); setGreeted(false); setDone(false); setMsg('') }

  if (done) {
    return (<div className="page"><div className="engage-done anim">
      <span className="done-badge">Engaged</span>
      <h2>Check-in complete</h2>
      <p>{facility.name} &middot; {dateStr}</p>
      <p className="muted">The assessment checklist unlocks in Stage 5. This visit is saved and ready.</p>
      <button className="btn primary" onClick={reset}>New check-in</button>
    </div></div>)
  }

  const steps = ['Facility', 'Check-in', 'Present', 'Greeting']
  return (<div className="page engage">
    <div className="ptitle"><div><p className="eyebrow">Engage</p><h2>Arrival check-in</h2></div></div>
    <ol className="stepper">{steps.map((s, i) => (<li key={s} className={'stp' + (i === step ? ' on' : '') + (i < step ? ' done' : '')}><span>{i + 1}</span>{s}</li>))}</ol>
    {msg && <p className="auth-msg block">{msg}</p>}

    {step === 0 && (<div className="engage-pick">
      <SearchBox value={q} onChange={setQ} placeholder="Search all facilities…" />
      {q.trim() ? (() => {
        const hits = list.filter(f => matchQ(f, q))
        return hits.length === 0 ? <p className="empty">No facilities match "{q}".</p> :
          (<div className="cluster"><div className="cluster-head"><h3>Results</h3><span className="cluster-count">{hits.length}</span></div>
            <div className="frows">{hits.slice(0, 60).map(f => (<button className="frow pickable" key={f.id} onClick={() => chooseFacility(f)}>
              <div className="fmain"><span className="fname">{f.name}</span><span className="fmeta">{[f.category, f.area, f.address].filter(Boolean).join(' \u00b7 ') || 'No details'}{visitedToday[f.id] ? ' \u00b7 checked in' : ''}</span></div>
              <span className="mini">Select</span></button>))}</div>
            {hits.length > 60 && <p className="hintline">Showing 60 of {hits.length} \u2014 keep typing to narrow.</p>}
          </div>)
      })() : (<>
      {myDay.length > 0 && (<div className="myday">
        <div className="myday-head"><h3>Today's round, {todayStr}</h3><span className="plan-count">{myDay.length} assigned</span></div>
        <div className="frows">{myDay.map(f => (<button className="frow pickable" key={'my' + f.id} onClick={() => chooseFacility(f)}>
          <div className="fmain"><span className="fname">{f.name}</span><span className="fmeta">{[f.category, f.address].filter(Boolean).join(' \u00b7 ') || 'No details'}{visitedToday[f.id] ? ' \u00b7 checked in' : ''}</span></div>
          <span className={'mini' + (visitedToday[f.id] ? ' ok' : '')}>{visitedToday[f.id] ? 'Done' : 'Start'}</span>
        </button>))}</div>
      </div>)}
      {list.length === 0 ? <p className="empty">No facilities yet. Add them on the Facilities tab first.</p> :
        areaKeys.map(a => (<div className="cluster" key={a}>
          <div className="cluster-head"><h3>{a}</h3><span className="cluster-count">{groups[a].length}</span></div>
          <div className="frows">{groups[a].map(f => (<button className="frow pickable" key={f.id} onClick={() => chooseFacility(f)}>
            <div className="fmain"><span className="fname">{f.name}</span><span className="fmeta">{[f.category, f.address].filter(Boolean).join(' \u00b7 ') || 'No details'}</span></div>
            <span className="mini">Select</span>
          </button>))}</div>
        </div>))}
      </>)}
    </div>)}

    {step === 1 && facility && (<div className="engage-card">
      <p className="eyebrow">Confirm arrival</p>
      <h3 className="fbig">{facility.name}</h3>
      <p className="fsub">{[facility.category, facility.area, facility.address].filter(Boolean).join(' \u00b7 ')}</p>
      <div className="ci-row"><span>Arrival time</span><em>{new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Africa/Lagos' })}</em></div>
      <div className="ci-row"><span>Location</span><em>{coords ? (coords.lat + ', ' + coords.lng) : 'Required \u2014 not captured'}</em></div>
      {geoMsg && <p className="hintline">{geoMsg}</p>}
      {!coords && <p className="hintline req">GPS is mandatory at check-in.</p>}
      <div className="btnrow"><button className="btn small ghost" onClick={capture}>{coords ? 'Re-capture location' : 'Capture location'}</button>
        <button className="btn small ghost" onClick={() => setStep(0)}>Back</button>
        <button className="btn small primary" onClick={checkIn} disabled={!coords}>Confirm and continue</button></div>
    </div>)}

    {step === 2 && facility && (<div className="engage-present">
      <div className="letter">
        <div className="letter-head"><img src="/rhsc-mark.png" alt="RHSC" /><div><strong>REALMS HEALTHCARE SERVICES CONSULTING LIMITED</strong><span>In collaboration with HEFAMAA, Lagos State</span></div></div>
        <div className="letter-meta"><span>Ref: {ref}</span><span>{dateStr}</span></div>
        <p className="letter-to">The Proprietor / Person in Charge<br />{facility.name}<br />{[facility.area, 'Lagos State'].filter(Boolean).join(', ')}</p>
        <p className="letter-sub"><strong>RE: ROUTINE HEALTH FACILITY MONITORING</strong></p>
        <p>This is to introduce the REALMS Healthcare Services Consulting Limited monitoring team, authorised to conduct routine monitoring of this facility in collaboration with the Health Facility Monitoring and Accreditation Agency (HEFAMAA), Lagos State, as mandated by law.</p>
        <p>Your cooperation in supporting a safe, standard and quality assessment is appreciated.</p>
        <p className="letter-sign">{lead ? lead.name : ''}<br /><span>{lead ? lead.role : ''}, for RHSC</span></p>
      </div>
      <div className="present-side">
        <p className="pick-label">Team identification</p>
        <div className="idcards">{team.map((m, i) => (<div key={i} className="idwrap"><IdCard name={m.name} role={i === 0 ? (m.role + ' (Lead)') : m.role} />{i > 0 && <button className="mini danger" onClick={() => removeMember(i)}>Remove</button>}</div>))}</div>
        <div className="addmember"><input placeholder="Name" value={nm} onChange={e => setNm(e.target.value)} /><input placeholder="Role" value={nr} onChange={e => setNr(e.target.value)} /><button className="mini" onClick={addMember}>Add</button></div>
        <p className="pick-label">Introduction script</p>
        <blockquote className="script">{intro}</blockquote>
        <div className="btnrow"><button className="btn small ghost" onClick={() => setStep(1)}>Back</button><button className="btn small primary" onClick={() => setStep(3)}>Continue</button></div>
      </div>
    </div>)}

    {step === 3 && facility && (<div className="engage-card">
      <p className="eyebrow">Person in charge</p>
      <div className="fgrid">
        <label className="field sm"><span>Name</span><input value={pic.name} onChange={e => setPic({ ...pic, name: e.target.value })} /></label>
        <label className="field sm"><span>Role / title</span><input value={pic.role} onChange={e => setPic({ ...pic, role: e.target.value })} placeholder="e.g. Matron" /></label>
        <label className="field sm"><span>Phone</span><input value={pic.phone} onChange={e => setPic({ ...pic, phone: e.target.value })} /></label>
      </div>
      <label className="greet"><input type="checkbox" checked={greeted} onChange={e => setGreeted(e.target.checked)} /><span>I have introduced the team and completed a cordial greeting with the person in charge.</span></label>
      <div className="btnrow"><button className="btn small ghost" onClick={() => setStep(2)}>Back</button><button className="btn small primary" onClick={save} disabled={busy || !greeted}>{busy ? 'Saving\u2026' : 'Complete check-in'}</button></div>
    </div>)}
  </div>)
}

/* ---------- monitor (Stage 5) ---------- */
const CHECKLIST = [
  { id: 'infrastructure', label: 'Infrastructure & environment', items: ['Cleanliness and hygiene', 'Ventilation and lighting', 'Water supply', 'Power supply', 'Waste disposal and sanitation', 'Toilets and patient facilities'] },
  { id: 'infection', label: 'Infection prevention', items: ['Hand hygiene stations', 'Sterilisation and disinfection', 'PPE availability and use', 'Waste segregation'] },
  { id: 'personnel', label: 'Personnel', items: ['Qualified staff on duty', 'Valid professional / practising licences', 'Staff in appropriate uniform', 'Duty rosters displayed', 'Staffing adequate for patient load'] },
  { id: 'equipment', label: 'Equipment', items: ['Essential equipment available', 'Equipment functional and maintained', 'Emergency and basic life-support equipment', 'Medication storage and cold chain'] },
  { id: 'records', label: 'Records', items: ['Patient registers', 'Admission and discharge books', 'Laboratory registers', 'Quality-control and equipment logs', 'Reagent inventory (laboratory)'] },
  { id: 'compliance', label: 'Compliance', items: ['Valid HEFAMAA registration', 'Valid HEFAMAA licence', 'HEFAMAA logo and signage displayed', 'Required permits displayed', 'Qualified personnel on duty', 'Price list displayed'] },
  { id: 'laboratory', label: 'Laboratory & biosafety', items: ['Laboratory services within licensed scope', 'Specimen handling and biosafety', 'Reagent and cold-chain controls'] },
  { id: 'services', label: 'Services', items: ['Services match the licensed category', 'Service scope matches capacity', 'Emergency readiness and referral'] }
]

// Full HEFAMAA Facility Inspection Tool (Primary Health Care) digitised.
// Field: [id, label, type, options?]. Types: yn, ai (adequate), fn (functional),
// av (available), num, txt, ta (notes), sel, chk (multi).
const HEFAMAA_FORM = [
  { id: 'ident', title: 'Facility identification', fields: [
    ['ward', 'Ward', 'txt'], ['lga', 'Local Government Area', 'sel', ['Alimosho', 'Ifako-Ijaiye']], ['status', 'Status of establishment', 'sel', ['New', 'Existing']],
    ['reg_no', 'HEFAMAA Reg. Number', 'txt'], ['contact', 'Contact (name, email, phone)', 'txt'], ['hours', 'Days & hours of operation', 'txt', ['24 hours', '8am - 5pm', '8am - 4pm', 'Mon-Fri 8am-5pm', 'Mon-Sat 8am-6pm']],
    ['interviewed', 'Person(s) interviewed (name, designation)', 'txt'], ['officers', 'HEFAMAA officer(s) & designation', 'txt'], ['departure', 'Departure time', 'time'],
    ['estab_type', 'Type of establishment', 'chk', ['Public Comprehensive HC', 'Public PHC', 'Private Clinic/HC', 'Convalescent/Nursing Home', 'Maternity Home', 'Private Hospital', 'Other']],
    ['estab_type_other', 'Other type (specify)', 'txt'], ['branches', 'Any branches?', 'yn'], ['branches_detail', 'Branches: number & locations', 'ta'] ] },
  { id: 'services', title: 'A. Services provided', fields: [
    ['svc_primary', 'Primary healthcare services', 'chk', ['Child Welfare & Immunization', 'Skilled birth delivery', 'General Medical Practice', 'Family Planning', 'HIV Prevention (HCT & PMTCT)', 'TB/DOTS']],
    ['svc_primary_other', 'Other services (specify)', 'txt'], ['svc_support', 'Clinical support services', 'chk', ['Laboratory', 'Ultrasound', 'Pharmaceutical', 'Other']] ] },
  { id: 'gov', title: 'B. Ownership, governance & registration', fields: [
    ['own_type', 'Type of ownership', 'sel', ['Public', 'Private', 'Public Private Partnership', 'Other']], ['own_arrangement', 'If private, ownership arrangement', 'sel', ['Sole proprietorship', 'Group practice', 'Limited Liability Company']],
    ['organogram', 'Organogram present?', 'yn'], ['cac', 'CAC registration status', 'sel', ['Registered', 'Registration in progress', 'Not registered']],
    ['hefamaa_reg', 'HEFAMAA registration status', 'sel', ['Ever Registered', 'Registration in progress', 'Not registered']], ['hefamaa_renewal', 'HEFAMAA renewal status', 'sel', ['Up to date', 'Not up to date']],
    ['hefamaa_last_renewal', 'Last year of renewal', 'txt', ['2026', '2025', '2024', '2023', '2022', 'Never renewed']], ['gov_comment', 'Comment', 'ta'] ] },
  { id: 'building', title: 'C. Building & designated areas', fields: [
    ['build_type', 'Type of building', 'sel', ['Purpose built', 'Stand alone', 'Shared accommodation', 'Other']],
    ['waiting_size', 'Waiting/Reception adequate in size', 'yn'], ['waiting_equip', 'Waiting/Reception well-equipped', 'yn'],
    ['consult_rooms', 'Number of consulting rooms', 'num'], ['consult_size', 'Consulting room adequate in size', 'yn'], ['consult_equip', 'Consulting room well-equipped', 'yn'],
    ['treat_size', 'Treatment room adequate in size', 'yn'], ['treat_equip', 'Treatment room well-equipped', 'yn'],
    ['wards_size', 'Wards adequate in size', 'yn'], ['wards_equip', 'Wards well-equipped', 'yn'],
    ['labour_size', 'Labour room adequate in size', 'yn'], ['labour_equip', 'Labour room well-equipped', 'yn'],
    ['ventilation', 'Ventilation', 'ai'], ['lighting', 'Lighting', 'ai'], ['painting', 'Painting', 'ai'], ['build_comment', 'Comment', 'ta'] ] },
  { id: 'inpatient', title: 'D. Observation / inpatient care', fields: [
    ['inpatient', 'Provides inpatient care', 'yn'], ['beds_no', 'Number of beds (if inpatient)', 'num'], ['obs_beds', 'Number of observation beds (if no)', 'num'],
    ['beds_functional', 'Beds functional', 'num'], ['beds_nonfunctional', 'Beds non-functional', 'num'], ['bed_space', 'One-metre space between beds', 'yn'],
    ['mattresses', 'Mattresses & pillows', 'fn'], ['mackintosh', 'Covered with mackintosh', 'yn'], ['inpatient_comment', 'Comment', 'ta'] ] },
  { id: 'maternity', title: 'E. Maternity', fields: [
    ['delivery_bed', 'Delivery bed with stirrups', 'fn'], ['delivery_bed_no', 'Delivery beds (number)', 'num'], ['angle_lamp', 'Angle poise lamp', 'fn'],
    ['resuscitaire', 'Resuscitaire (mucus extractor, ambu bag, table, lamp)', 'fn'], ['suction_manual', 'Suction machine — manual', 'fn'], ['suction_auto', 'Suction machine — automatic', 'fn'],
    ['suturing', 'Suturing materials', 'av'], ['oxygen_cylinder', 'Oxygen cylinder with accessories', 'av'], ['oxygen_concentrator', 'Oxygen concentrator', 'av'],
    ['pinard', 'Pinard fetoscope', 'yn'], ['sonicaid', 'Sonicaid', 'yn'], ['mag_sulphate', 'Magnesium sulphate', 'yn'], ['misoprostol', 'Misoprostol', 'yn'], ['antishock', 'Anti-shock garment', 'yn'],
    ['delivery_packs', 'Delivery packs (min 3)', 'yn'], ['baby_cots', 'Baby cots', 'fn'], ['baby_cots_no', 'Baby cots (number functional)', 'num'], ['infant_id', 'Infant ID bracelets', 'yn'], ['maternity_comment', 'Comment', 'ta'] ] },
  { id: 'emergency', title: 'F. Emergency & referral', fields: [
    ['bls_trained', 'Personnel trained on BLS', 'yn'], ['mnch_trained', 'Personnel trained on MNCH emergencies', 'yn'], ['emerg_equip', 'Emergency equipment available & functional', 'yn'],
    ['emerg_tray', 'Emergency tray contents', 'ai'], ['referral_system', 'Referral system in place', 'yn'], ['ambulance', 'Ambulance services accessible', 'yn'], ['emergency_comment', 'Comment', 'ta'] ] },
  { id: 'sterilization', title: 'G. Sterilization / infection control', fields: [
    ['steril_area', 'Designated sterilization area', 'av'], ['autoclave', 'Functional autoclave', 'yn'], ['steril_drum', 'Sterilization drum', 'yn'], ['indicator_tape', 'Use of indicator tape', 'yn'],
    ['steril_other', 'Other methods (specify)', 'txt'], ['ppe', 'Personal protective equipment', 'ai'], ['steril_comment', 'Comment', 'ta'] ] },
  { id: 'handwash', title: 'H. Hand washing facilities', fields: [
    ['hw_treatment', 'Treatment room', 'ai'], ['hw_consulting', 'Consulting room', 'ai'], ['hw_wards', 'Wards', 'ai'], ['hw_records', 'Health records', 'ai'], ['hw_labour', 'Labour room', 'ai'], ['hw_lab', 'Laboratory', 'ai'], ['hw_comment', 'Comment', 'ta'] ] },
  { id: 'records', title: 'I. Health records', fields: [
    ['rec_type', 'Records type', 'sel', ['Paper-based', 'Digital', 'Both']], ['rec_secured', 'Secured location', 'yn'], ['rec_shelving', 'Shelving', 'yn'], ['rec_filing', 'Filing', 'yn'],
    ['nhmis', 'NHMIS registers available', 'yn'], ['hmis_monthly', 'HMIS data submitted monthly', 'yn'], ['records_comment', 'Comment', 'ta'] ] },
  { id: 'lab', title: 'J. Diagnostic services — laboratory', fields: [
    ['lab_type', 'Type of laboratory', 'sel', ['Commercial (standalone)', 'Hospital Lab', 'Side Lab', 'None']], ['lab_tests', 'Laboratory investigations (list)', 'ta', ['Malaria parasite', 'Full blood count', 'Widal', 'Urinalysis', 'HIV screening', 'Hepatitis B', 'Blood sugar', 'PCV', 'Pregnancy test', 'Genotype', 'Blood group', 'Liver function', 'Kidney function', 'Lipid profile']],
    ['lab_personnel', 'Personnel in charge', 'chk', ['Pathologist', 'Med. Lab. Scientist', 'Med. Lab. Tech.', 'Other']], ['lab_equip', 'Lab equipment adequacy', 'ai'], ['lab_equip_list', 'Lab equipment sighted & functionality', 'ta', ['Microscope', 'Centrifuge', 'Haematology analyser', 'Chemistry analyser', 'Refrigerator', 'Autoclave', 'Water bath', 'Incubator', 'Rotator']],
    ['lab_power', 'Power supply', 'ai'], ['lab_waste', 'Waste management', 'ai'], ['lab_illum', 'Illumination', 'ai'], ['lab_water', 'Water supply', 'ai'], ['lab_ppe', 'PPE', 'ai'], ['lab_comment', 'Comment', 'ta'],
    ['ultrasound', 'Provides ultrasound services', 'yn'], ['ultrasound_by', 'Ultrasound provided by', 'chk', ['Radiologist', 'Sonographer', 'Sonologist', 'Other']] ] },
  { id: 'medication', title: 'K. Medication management', fields: [
    ['pharmacy', 'Functional pharmacy or dispensary', 'yn'], ['pharmacy_type', 'Pharmacy or dispensary (specify)', 'txt'], ['pharm_personnel', 'Personnel in charge', 'chk', ['Pharmacist', 'Pharm. Technician']],
    ['counselling_area', 'Counselling area', 'yn'], ['compounding_area', 'Compounding area', 'yn'], ['dispensing_size', 'Dispensing room adequate (min 30 sq m)', 'yn'], ['pharm_arranged', 'Well arranged, adequate ventilation', 'yn'],
    ['pharm_illum', 'Illumination', 'ai'], ['formulary', 'Drug formulary (EMDEX, BNF)', 'yn'], ['room_temp_charts', 'Room temperature charts', 'yn'], ['fridge', 'Functional fridge', 'yn'], ['fridge_charts', 'Fridge temperature charts (incl vaccines)', 'yn'],
    ['dda', 'Lockable DDA cupboard & register', 'yn'], ['expired_disposal', 'Disposal of expired drugs', 'ai'], ['pharm_ppe', 'Appropriate use of PPE', 'yn'], ['pharm_fire', 'Fire-fighting equipment', 'yn'], ['medication_comment', 'Comment', 'ta'] ] },
  { id: 'catering', title: 'L. Catering services', fields: [
    ['catering', 'Catering services provided', 'yn'], ['catering_type', 'Catering type', 'sel', ['In-house', 'Outsourced', 'N/A']], ['kitchen_clean', 'Kitchen clean', 'yn'], ['kitchen_vent', 'Kitchen well-ventilated', 'yn'],
    ['kitchen_equip', 'Kitchen well-equipped', 'yn'], ['kitchen_fire', 'Fire blanket & extinguisher', 'yn'], ['kitchen_alarm', 'Fire alarm functional', 'yn'], ['food_handlers', 'Food handlers test evidence', 'yn'], ['catering_comment', 'Comment', 'ta'] ] },
  { id: 'environment', title: 'M. Environment & amenities', fields: [
    ['gen_ventilation', 'General ventilation', 'ai'], ['gen_illum', 'Illumination', 'ai'], ['electricity', 'Main source of electricity', 'sel', ['PHCN', 'Other']], ['alt_power', 'Alternate power supply', 'yn'],
    ['alt_power_type', 'Alternate power type', 'chk', ['Generator', 'Inverter', 'Solar', 'Other']], ['water_supply', 'Portable water supply', 'yn'], ['water_source', 'Source(s) of water', 'chk', ['Pipe borne', 'Borehole', 'Well', 'Vendor', 'Other']],
    ['toilets_available', 'Toilets available (cistern)', 'num'], ['toilets_functional', 'Toilets functional', 'num'], ['toilets_staff', 'Toilets for staff', 'ai'], ['toilets_opd', 'Toilets for OPD', 'ai'], ['toilets_inpatient', 'Toilets for inpatients', 'ai'],
    ['wash_basin', 'Wash hand basin with running water', 'yn'], ['cleaning_agents', 'Cleaning agents & disinfectant', 'yn'], ['antibac_wash', 'Anti-bacterial hand wash', 'yn'], ['toilet_roll', 'Toilet roll', 'yn'], ['pedal_bin', 'Pedal bin lined with nylon', 'yn'],
    ['serviette', 'Serviette / single-use hand towel', 'yn'], ['shower', 'Shower with running water', 'yn'], ['drainage', 'External drainage (gutter)', 'yn'], ['drainage_covered', 'Drainage covered', 'yn'], ['env_comment', 'Comment', 'ta'] ] },
  { id: 'waste', title: 'Waste management', fields: [
    ['lawma_psp', 'Registered with LAWMA PSP', 'yn'], ['lawma_medical', 'Registered with LAWMA Medical', 'yn'], ['sharps_container', 'Correct bin & sharps container', 'yn'], ['waste_segregation', 'Proper waste segregation', 'yn'],
    ['coloured_bags', 'Coloured bags available', 'chk', ['Black', 'Yellow', 'Red', 'Brown', 'Safety sharp box']], ['collection_point', 'Final collection point', 'ai'], ['domestic_waste', 'Domestic waste management', 'ai'], ['medical_waste', 'Medical waste management', 'ai'], ['waste_comment', 'Comment', 'ta'] ] },
  { id: 'fire', title: 'N. Fire safety', fields: [
    ['fire_cert', 'Fire service certification', 'av'], ['fire_equip', 'Fire-fighting equipment', 'yn'], ['fire_service_history', 'Service history', 'yn'], ['fire_exits', 'Two labelled exits', 'yn'], ['muster_point', 'Muster / assembly point', 'av'], ['fire_comment', 'Comment', 'ta'] ] },
  { id: 'staffing', title: 'O. Staffing', fields: [
    ['qip', 'Quality improvement programme', 'yn'], ['update_training', 'Regular update training', 'yn'], ['duty_roster', 'Duty roster available', 'yn'], ['adequate_staff', 'Adequate number of qualified personnel', 'yn'], ['staff_shortfall', 'If no, personnel type lacking', 'txt', ['Doctor', 'Nurse', 'Med Lab Scientist', 'Pharmacist', 'Health records officer']],
    ['doctors_ft', 'Doctors (full time)', 'num'], ['doctors_pt', 'Doctors (part time)', 'num'], ['nurses_ft', 'Nurses (full time)', 'num'], ['nurses_pt', 'Nurses (part time)', 'num'], ['others_ft', 'Other staff (full time)', 'num'], ['others_pt', 'Other staff (part time)', 'num'],
    ['staff_complement', 'Staff complement (name, reg no, designation, specialty)', 'ta'], ['staffing_comment', 'Comment', 'ta'] ] },
  { id: 'submission', title: 'Inspection report (for HEFAMAA submission)', fields: [
    ['address', 'Facility address', 'txt'], ['schedule', 'Facility schedule (category)', 'txt', ['Hospital', 'Clinic', 'Maternity Home', 'Nursing Home', 'Convalescent Home', 'Dental Clinic', 'Eye Clinic', 'Laboratory', 'Diagnostic Centre', 'Specialist Hospital']], ['opening', 'Opening schedule', 'txt', ['24 hours', '8am - 5pm', '8am - 4pm', 'Mon-Fri 8am-5pm', 'Mon-Sat 8am-6pm']],
    ['services_rendered', 'Services rendered', 'ta', ['General medical practice', 'Antenatal care', 'Skilled birth delivery', 'Immunisation', 'Family planning', 'Laboratory', 'Ultrasound', 'Pharmacy', 'Dental', 'Eye care', 'HIV counselling and testing', 'TB DOTS', 'Minor surgery', 'Inpatient care']], ['total_staff', 'Total staff strength & breakdown', 'ta'], ['staff_on_duty', 'Staff met on duty', 'ta', ['Doctor', 'Nurse', 'Matron', 'Med Lab Scientist', 'Pharmacist', 'Pharmacy technician', 'Health assistant', 'Receptionist', 'Cleaner', 'Security']], ['basic_equipment', 'Basic equipment available', 'ta', ['BP apparatus', 'Stethoscope', 'Thermometer', 'Weighing scale', 'Glucometer', 'Nebuliser', 'Oxygen cylinder', 'Suction machine', 'Delivery bed', 'Resuscitaire', 'Autoclave', 'Wheelchair', 'Examination couch', 'Ambu bag']],
    ['wards_no', '# of Wards', 'txt'], ['treatment_room', 'Treatment room', 'txt', ['Available and adequate', 'Available but inadequate', 'Not available']], ['environment', 'Environment', 'txt', ['Clean and well maintained', 'Fairly clean', 'Poor, needs attention']], ['waste_mgmt', 'Waste management', 'txt', ['Adequate, registered with LAWMA PSP', 'Colour-coded bins in use', 'Inadequate segregation', 'No medical waste contract']], ['observation', 'Observation (gaps)', 'ta'], ['other_notes', 'Others', 'ta'] ] }
]
const HEF_TYPES = { yn: ['Yes', 'No'], ai: ['Adequate', 'Inadequate'], fn: ['Functional', 'Non-functional'], av: ['Available', 'Not available'] }
function ragWeight(r) { return r === 'green' ? 2 : r === 'amber' ? 1 : 0 }
function ragFromPct(pct) { return pct == null ? null : pct >= 80 ? 'green' : pct >= 50 ? 'amber' : 'red' }
// Timestamps are stored in UTC (toISOString). These format them in Lagos time (West
// Africa Time, UTC+1) so the app never shows an hour behind the wall clock.
const LAGOS_TZ = 'Africa/Lagos'
function fmtTime(ts) {
  if (!ts) return ''
  try { const d = new Date(ts); if (isNaN(d)) return ''; return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: LAGOS_TZ }) } catch (e) { return (ts || '').slice(11, 16) }
}
function fmtDate(ts) {
  if (!ts) return ''
  try { const d = new Date(ts); if (isNaN(d)) return (ts || '').slice(0, 10); return d.toLocaleDateString('en-CA', { timeZone: LAGOS_TZ }) } catch (e) { return (ts || '').slice(0, 10) }
}
// A friendly "how long ago" for the stale-data banner.
function relTime(ts) {
  try {
    const then = new Date(ts).getTime(); if (isNaN(then)) return ''
    const mins = Math.round((Date.now() - then) / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return mins + (mins === 1 ? ' minute ago' : ' minutes ago')
    const hrs = Math.round(mins / 60)
    if (hrs < 24) return hrs + (hrs === 1 ? ' hour ago' : ' hours ago')
    const days = Math.round(hrs / 24)
    if (days < 7) return days + (days === 1 ? ' day ago' : ' days ago')
    return 'on ' + fmtDate(ts)
  } catch (e) { return '' }
}
function computeScore(data) {
  let sum = 0, max = 0, rated = 0
  CHECKLIST.forEach(cat => cat.items.forEach((_, i) => { const it = data[cat.id + '_' + i]; if (it && it.rating) { rated++; max += 2; sum += ragWeight(it.rating) } }))
  const pct = max ? Math.round(sum / max * 100) : null
  return { pct, rag: ragFromPct(pct), rated }
}
function categoryScore(data, cat) {
  let sum = 0, max = 0, rated = 0
  cat.items.forEach((_, i) => { const it = data[cat.id + '_' + i]; if (it && it.rating) { rated++; max += 2; sum += ragWeight(it.rating) } })
  const pct = max ? Math.round(sum / max * 100) : null
  return { pct, rag: ragFromPct(pct), rated, total: cat.items.length }
}
function downscaleImage(file, maxW = 1100, quality = 0.6) {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width); const w = Math.round(img.width * scale), h = Math.round(img.height * scale)
      const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('image error')) }
    img.src = url
  })
}

function Rag({ value, onChange }) {
  return (<div className="rag">{[['green', 'G'], ['amber', 'A'], ['red', 'R']].map(([v, l]) => (
    <button key={v} type="button" aria-label={v} title={v[0].toUpperCase() + v.slice(1)} aria-pressed={value === v} className={'ragb ' + v + (value === v ? ' on' : '')} onClick={() => onChange(value === v ? null : v)}>{l}</button>
  ))}</div>)
}
function Chip({ rag, pct }) {
  const label = rag ? (rag === 'green' ? 'Green' : rag === 'amber' ? 'Amber' : 'Red') : 'Not rated'
  return (<span className={'chip ' + (rag || 'none')}>{label}{pct != null ? ' \u00b7 ' + pct + '%' : ''}</span>)
}
function VoiceButton({ onClip }) {
  const [rec, setRec] = useState(false); const mrRef = useRef(null); const chunks = useRef([])
  async function toggle() {
    if (rec) { if (mrRef.current) mrRef.current.stop(); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream); mrRef.current = mr; chunks.current = []
      mr.ondataavailable = e => { if (e.data && e.data.size) chunks.current.push(e.data) }
      mr.onstop = () => { const blob = new Blob(chunks.current, { type: 'audio/webm' }); const fr = new FileReader(); fr.onload = () => onClip(fr.result); fr.readAsDataURL(blob); stream.getTracks().forEach(t => t.stop()); setRec(false) }
      mr.start(); setRec(true)
    } catch (e) { window.alert('Microphone not available on this device.') }
  }
  return <button type="button" className={'ev-btn' + (rec ? ' recording' : '')} onClick={toggle}>{rec ? 'Stop' : 'Voice'}</button>
}

function Seg({ options, value, onChange }) {
  return (<div className="seg">{options.map(o => (<button type="button" key={o} className={'segb' + (value === o ? ' on' : '')} onClick={() => onChange(value === o ? '' : o)}>{o}</button>))}</div>)
}
function fragToggle(cur, frag) {
  const parts = String(cur || '').split(/;\s*/).map(x => x.trim()).filter(Boolean)
  const i = parts.findIndex(x => x.toLowerCase() === frag.toLowerCase())
  if (i >= 0) parts.splice(i, 1); else parts.push(frag)
  return parts.join('; ')
}
function fragHas(cur, frag) {
  return String(cur || '').split(/;\s*/).some(x => x.trim().toLowerCase() === frag.toLowerCase())
}
function HefField({ f, value, onChange }) {
  const id = f[0], label = f[1], type = f[2], opts = f[3]
  const picks = (type === 'txt' || type === 'ta') && Array.isArray(opts) && opts.length ? opts : null
  let control
  if (HEF_TYPES[type]) control = <Seg options={HEF_TYPES[type]} value={value || ''} onChange={onChange} />
  else if (type === 'num') control = <input type="number" inputMode="numeric" pattern="[0-9]*" className="hef-input" value={value || ''} onChange={e => onChange(e.target.value)} />
  else if (type === 'time') control = <input type="time" className="hef-input" value={value || ''} onChange={e => onChange(e.target.value)} />
  else if (type === 'txt') control = (<>
    {picks && <div className="picks">{picks.map(o => (
      <button type="button" key={o} className={'pick' + (String(value || '').trim().toLowerCase() === o.toLowerCase() ? ' on' : '')}
        onClick={() => onChange(String(value || '').trim().toLowerCase() === o.toLowerCase() ? '' : o)}>{o}</button>))}</div>}
    <input className="hef-input" value={value || ''} onChange={e => onChange(e.target.value)}
      placeholder={picks ? 'Tap an answer, or type your own' : ''} />
  </>)
  else if (type === 'ta') control = (<>
    {picks && <div className="picks">{picks.map(o => (
      <button type="button" key={o} className={'pick' + (fragHas(value, o) ? ' on' : '')}
        onClick={() => onChange(fragToggle(value, o))}>{o}</button>))}</div>}
    <textarea className="hef-input" rows="2" value={value || ''} onChange={e => onChange(e.target.value)}
      placeholder={picks ? 'Tap what applies, and add anything else here' : ''} />
  </>)
  else if (type === 'sel') control = <select className="hef-input" value={value || ''} onChange={e => onChange(e.target.value)}><option value="">—</option>{opts.map(o => <option key={o} value={o}>{o}</option>)}</select>
  else if (type === 'chk') { const arr = Array.isArray(value) ? value : []; control = <div className="chks">{opts.map(o => { const on = arr.includes(o); return <label key={o} className={'chkpill' + (on ? ' on' : '')}><input type="checkbox" checked={on} onChange={() => onChange(on ? arr.filter(x => x !== o) : arr.concat([o]))} />{o}</label> })}</div> }
  return (<div className="hef-field"><span className="hef-label">{label}</span>{control}</div>)
}
function hefAnswered(sec, hef) { return sec.fields.filter(f => { const v = hef[f[0]]; return Array.isArray(v) ? v.length : (v != null && v !== '') }).length }
function HefammaForm({ value, onChange, confirmed, onConfirm }) {
  const hef = value || {}
  const conf = confirmed || null
  const set = (id, val) => onChange({ ...hef, [id]: val })
  const allConfirmed = conf && HEFAMAA_FORM.every(s => conf[s.id])
  return (<div className="hef-form">
    {onConfirm && <div className="sa-confirm-all">
      <button type="button" className="mini" onClick={() => { const next = {}; HEFAMAA_FORM.forEach(s => { next[s.id] = !allConfirmed }); onConfirm(next) }}>{allConfirmed ? 'Reopen all sections' : 'Confirm all unchanged'}</button>
      <span className="sa-confirm-n">{conf ? HEFAMAA_FORM.filter(s => conf[s.id]).length : 0} of {HEFAMAA_FORM.length} sections confirmed</span>
    </div>}
    {HEFAMAA_FORM.map(sec => {
    const isConf = conf && !!conf[sec.id]
    return (<details className={'hef-sec' + (isConf ? ' confirmed' : '')} key={sec.id} open={onConfirm ? !isConf : undefined}>
      <summary><span>{sec.title}{isConf && <span className="sa-conf-tag">Unchanged &#10003;</span>}</span><span className="hef-count">{hefAnswered(sec, hef)}/{sec.fields.length}</span></summary>
      {onConfirm && <div className="sa-sec-tools"><button type="button" className={'mini' + (isConf ? ' ok' : '')} onClick={() => onConfirm({ ...conf, [sec.id]: !isConf })}>{isConf ? 'Confirmed unchanged \u2014 reopen' : 'Confirm this section unchanged'}</button></div>}
      <div className="hef-fields">{sec.fields.map(f => <HefField key={f[0]} f={f} value={hef[f[0]]} onChange={val => { set(f[0], val); if (conf && conf[sec.id]) onConfirm({ ...conf, [sec.id]: false }) }} />)}</div>
    </details>)
  })}</div>)
}

function DictateButton({ onText }) {
  const [rec, setRec] = useState(false); const ref = useRef(null)
  function toggle() {
    const SR = (typeof window !== 'undefined') && (window.SpeechRecognition || window.webkitSpeechRecognition)
    if (!SR) { toast('Voice typing is not supported on this browser. Try Chrome.', 'warn'); return }
    if (rec && ref.current) { ref.current.stop(); return }
    const r = new SR(); r.lang = 'en-NG'; r.interimResults = false; r.continuous = false
    r.onresult = e => { const txt = Array.from(e.results).map(x => x[0].transcript).join(' '); onText(txt) }
    r.onend = () => setRec(false); r.onerror = () => setRec(false)
    ref.current = r; setRec(true); r.start()
  }
  return <button type="button" className={'mini dictate' + (rec ? ' rec' : '')} onClick={toggle} title="Dictate a note">{rec ? '\u25cf Listening' : '\u25cf Dictate'}</button>
}
/* Drafts must survive a refresh even when the device storage is nearly full.
   Photos taken offline are held as base64 and can blow past the browser quota,
   which would silently kill the whole draft. So: try the full draft first, and
   if the quota rejects it, retry without the heavy media. Ratings, notes and
   every typed field, the expensive things to re-enter, are always kept. */
function slimEvidence(items) {
  const out = {}
  Object.keys(items || {}).forEach(k => {
    const it = items[k] || {}
    out[k] = { ...it, evidence: (it.evidence || []).map(e => (e && typeof e.data === 'string' && e.data.indexOf('data:') === 0 && e.data.length > 20000) ? { ...e, data: '', deferred: true } : e) }
  })
  return out
}
function draftSet(key, obj, slimObj) {
  if (!key) return false
  try { localStorage.setItem(key, JSON.stringify(obj)); return true } catch (e) {}
  if (slimObj) { try { localStorage.setItem(key, JSON.stringify(slimObj)); return true } catch (e) {} }
  return false
}
function MonitorPage({ userId, onOpen }) {
  const [visits, setVisits] = useState([])
  const [active, setActive] = useState(null)
  const [data, setData] = useState({})
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [saveState, setSaveState] = useState('')
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('')
  const [geo, setGeo] = useState(null)
  const [profile, setProfile] = useState({})
  const [hef, setHef] = useState({})
  const [q, setQ] = useState('')
  const [lightbox, setLightbox] = useState(null)
  const [hefCheck, setHefCheck] = useState('')

  useEffect(() => { VIS.list().then(setVisits).catch(() => {}) }, [])
  useEffect(() => { const on = () => setOnline(true), off = () => setOnline(false); window.addEventListener('online', on); window.addEventListener('offline', off); return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) } }, [])
  useEffect(() => { if (navigator.geolocation) navigator.geolocation.getCurrentPosition(p => setGeo({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) }), () => {}) }, [])

  const draftKey = active ? 'realms_monitor_' + active.id : ''
  useEffect(() => { if (!active) return; const at = new Date().toISOString(); draftSet(draftKey, { items: data, profile, hef, at }, { items: slimEvidence(data), profile, hef, at }) }, [data, profile, hef, active])

  function open(v) {
    setMsg('')
    let d = (v.monitoring && v.monitoring.items) || {}
    let pf = (v.monitoring && v.monitoring.profile) || {}
    let hf = (v.monitoring && v.monitoring.hefamaa) || {}
    let restored = false
    try {
      const raw = localStorage.getItem('realms_monitor_' + v.id)
      if (raw) {
        const p = JSON.parse(raw)
        if (p && p.items) { d = p.items; restored = true }
        if (p && p.profile && Object.keys(p.profile).length) { pf = p.profile; restored = true }
        if (p && p.hef && Object.keys(p.hef).length) { hf = p.hef; restored = true }
      }
    } catch (e) {}
    setActive(v); setData(d); setProfile(pf); setHef(hf); setSaveState(restored ? 'draft' : '')
    if (restored) toast('Unsaved work restored on this device.')
  }
  function setProfileField(k, val) { setProfile(p => ({ ...p, [k]: val })); setSaveState('draft') }
  function setItem(key, patch) { setData(d => ({ ...d, [key]: { ...(d[key] || { rating: null, note: '', evidence: [] }), ...patch } })); setSaveState('draft') }
  function addEvidence(key, type, url) { setData(d => { const it = d[key] || { rating: null, note: '', evidence: [] }; const ev = (it.evidence || []).concat([{ type, data: url, at: new Date().toISOString(), lat: geo ? geo.lat : null, lng: geo ? geo.lng : null }]); return { ...d, [key]: { ...it, evidence: ev } } }); setSaveState('draft') }
  function removeEvidence(key, idx) { setData(d => { const it = d[key]; if (!it) return d; return { ...d, [key]: { ...it, evidence: it.evidence.filter((_, i) => i !== idx) } } }); setSaveState('draft') }
  async function onPickImage(key, type, file) { if (!file) return; try { const dataUrl = await downscaleImage(file); const stored = await uploadEvidence(active.id, type, dataUrl); addEvidence(key, type, stored) } catch (e) { setMsg('Could not process the image.') } }

  const score = computeScore(data)
  const totalItems = CHECKLIST.reduce((n, c) => n + c.items.length, 0)

  function requirements() {
    const noPhoto = []
    CHECKLIST.forEach(cat => {
      cat.items.forEach((label, i) => {
        const it = data[cat.id + '_' + i]; if (!it) return
        if (it.rating === 'red' && !(it.evidence || []).some(e => e.type === 'photo')) noPhoto.push(cat.label + ': ' + label)
      })
    })
    return { noPhoto, noVoice: [] }
  }

  async function save() {
    if (!active) return
    const req = requirements()
    if (req.noPhoto.length || req.noVoice.length) {
      const parts = []
      if (req.noPhoto.length) parts.push('add a photo on red items (' + req.noPhoto.join('; ') + ')')
      if (req.noVoice.length) parts.push('add a voice note for ' + req.noVoice.join(', '))
      setMsg('Before saving, please ' + parts.join(', and ') + '.')
      return
    }
    setBusy(true); setMsg('')
    const payload = { items: data, profile, hefamaa: hef, score: score.pct, overallRating: score.rag, updatedAt: new Date().toISOString() }
    try {
      await VIS.update(active.id, { monitoring: payload, score: score.pct, overall_rating: score.rag, status: 'monitored' })
      try { localStorage.removeItem(draftKey) } catch (e) {}
      setSaveState('saved'); setMsg('Assessment saved.'); toast('Assessment saved.')
      setVisits(vs => vs.map(v => v.id === active.id ? { ...v, monitoring: payload, score: score.pct, overall_rating: score.rag, status: 'monitored' } : v))
    } catch (e) { setSaveState('pending'); setMsg('Saved locally. It will sync when you are back online; use Sync now to retry.') }
    finally { setBusy(false) }
  }

  if (!active) {
    const monVisits = visits.filter(v => v.status !== 'incomplete' && matchQ(v, q))
    // A facility that already has a first assessment must not be assessed again here.
    // The correct route for it is Engage, then Second Assessment.
    const baseKeys = {}
    visits.forEach(v => {
      const key = v.facility_id || v.facility_name; if (!key) return
      if ((v.debrief && v.debrief.first_visit) || (v.assessment && v.assessment.ruid) || (v.monitoring && v.monitoring.first_assessment)) baseKeys[key] = true
    })
    const isBaselineRow = v => !!((v.debrief && v.debrief.first_visit) || (v.assessment && v.assessment.ruid) || (v.monitoring && v.monitoring.first_assessment))
    const needsSecond = v => !isBaselineRow(v) && v.status !== 'monitored' && v.status !== 'debriefed' && !!baseKeys[v.facility_id || v.facility_name]
    return (<div className="page">
      <div className="ptitle"><div><p className="eyebrow">Monitor</p><h2>Assessments</h2></div>
        <span className={'net ' + (online ? 'on' : 'off')}>{online ? 'Online' : 'Offline'}</span></div>
      {visits.length > 0 && <div className="list-tools"><SearchBox value={q} onChange={setQ} placeholder="Search facilities…" /></div>}
      {monVisits.length === 0 ? <p className="empty">{visits.length === 0 ? 'No visits yet. Complete an Engage check-in first.' : 'No visits match your search.'}</p> :
        <div className="mon-list">{monVisits.map(v => { const second = needsSecond(v)
          return (
          <button className={'mon-row' + (second ? ' locked' : '')} key={v.id} onClick={() => second ? (onOpen && onOpen('secondassessment')) : open(v)}>
            <div><span className="fname">{v.facility_name}</span><span className="fmeta">{v.area} &middot; {(v.arrival_time || v.created_at || '').slice(0, 10)}{second ? ' \u00b7 first visit already on record' : ''}</span></div>
            <div className="mon-right">{v.score != null ? <Chip rag={v.overall_rating} pct={v.score} /> : <span className={'chip ' + (second ? 'amber' : (v.status || 'engaged'))}>{second ? 'Second visit' : v.status === 'monitored' ? 'Assessed' : 'Ready'}</span>}
              {second
                ? <><span className="mini off">Assess</span><span className="mini go">Second assessment &#8594;</span></>
                : <span className="mini">{v.status === 'monitored' ? 'Review' : 'Assess'}</span>}
            </div>
          </button>) })}</div>}
    </div>)
  }

  return (<div className="page monitor">
    <div className="mon-head">
      <div className="mon-head-l">
        <button className="linkbtn subtle" onClick={() => setActive(null)}>&larr; All assessments</button>
        <h2>{active.facility_name}</h2>
        <p className="fsub">{active.area} &middot; arrival {fmtTime(active.arrival_time) || 'logged'}</p>
      </div>
      <div className="mon-head-r">
        <span className={'net ' + (online ? 'on' : 'off')}>{online ? 'Online' : 'Offline'}</span>
        <Chip rag={score.rag} pct={score.pct} />
        <span className="rated">{score.rated}/{totalItems} rated</span>
      </div>
    </div>
    {(() => { const hefTotal = HEFAMAA_FORM.reduce((n, s) => n + s.fields.length, 0); const hefDone = HEFAMAA_FORM.reduce((n, s) => n + hefAnswered(s, hef), 0); const ragPct = Math.round((score.rated / totalItems) * 100); const hefPct = Math.round((hefDone / hefTotal) * 100); return (
      <div className="mon-meter">
        <div className="meter-row"><span className="meter-lab">Ratings</span><div className="meter-track"><div className="meter-fill" style={{ width: ragPct + '%' }} /></div><span className="meter-val">{score.rated}/{totalItems}</span></div>
        <div className="meter-row"><span className="meter-lab">HEFAMAA form</span><div className="meter-track"><div className="meter-fill alt" style={{ width: hefPct + '%' }} /></div><span className="meter-val">{hefDone}/{hefTotal}</span></div>
      </div>) })()}
    {msg && <p className="auth-msg block">{msg}</p>}
    <p className="mon-rules">Evidence rules: a photo on every red item, and GPS is mandatory at check-in. Voice notes are optional, use them to add context in your own words.</p>

    <details className="hef-wrap" open>
      <summary className="hef-title"><span>HEFAMAA facility inspection form</span><span className="hef-total">{HEFAMAA_FORM.reduce((n, s) => n + hefAnswered(s, hef), 0)}/{HEFAMAA_FORM.reduce((n, s) => n + s.fields.length, 0)}</span></summary>
      <p className="hintline">The full Lagos HEFAMAA inspection tool. Complete each section as you would on the paper form; every section is saved with the visit.</p>
      <div className="ai-row"><AIButton label="AI consistency check" build={() => ({ system: 'You review a HEFAMAA facility inspection form for internal contradictions, missing critical items, and implausible entries. List up to 6 short, specific issues as bullets. If none, say the form looks consistent. Use only the data.', prompt: JSON.stringify(hef), max_tokens: 500 })} onText={txt => setHefCheck(txt)} /></div>
      {hefCheck && <div className="ai-panel"><h4><span className="ai-spark">✦</span> Consistency check</h4><p className="ai-text">{hefCheck}</p><button className="linkbtn subtle" onClick={() => setHefCheck('')}>Dismiss</button></div>}
      <HefammaForm value={hef} onChange={setHef} />
    </details>

    <div className="rag-summary-head"><h3>Compliance rating summary</h3><p className="hintline">A quick RAG rating that drives the score, debrief and reports.</p></div>

    {CHECKLIST.map(cat => {
      const cs = categoryScore(data, cat)
      const catVoice = cat.items.some((_, i) => { const it = data[cat.id + '_' + i]; return it && (it.evidence || []).some(e => e.type === 'voice') })
      return (<div className="mcat" key={cat.id}>
        <div className="mcat-head"><h3>{cat.label}</h3><div className="mcat-r">{catVoice && <span className="ok">Voice &#10003;</span>}<Chip rag={cs.rag} pct={cs.pct} /></div></div>
        <div className="mitems">{cat.items.map((label, i) => {
          const key = cat.id + '_' + i; const it = data[key] || { rating: null, note: '', evidence: [] }
          const needPhoto = it.rating === 'red' && !(it.evidence || []).some(e => e.type === 'photo')
          return (<div className={'mitem' + (needPhoto ? ' flag' : '')} key={key}>
            <div className="mitem-top"><span className="mlabel">{label}</span><Rag value={it.rating} onChange={r => setItem(key, { rating: r })} /></div>
            <div className="mnote-row"><textarea className="mnote" rows="1" placeholder="Note (optional)" value={it.note || ''} onChange={e => setItem(key, { note: e.target.value })} /><DictateButton onText={txt => setItem(key, { note: ((it.note || '') + (it.note ? ' ' : '') + txt) })} /></div>
            <div className="evrow">
              <label className={'ev-btn' + (needPhoto ? ' urgent' : '')}>Photo<input type="file" accept="image/*" capture="environment" onChange={e => { onPickImage(key, 'photo', e.target.files[0]); e.target.value = '' }} /></label>
              <label className="ev-btn">Scan<input type="file" accept="image/*" onChange={e => { onPickImage(key, 'scan', e.target.files[0]); e.target.value = '' }} /></label>
              <VoiceButton onClip={async url => { const stored = await uploadEvidence(active.id, 'voice', url); addEvidence(key, 'voice', stored) }} />
              {geo && <span className="geotag">geotag on</span>}
              {needPhoto && <span className="need">Photo required</span>}
            </div>
            {it.evidence && it.evidence.length > 0 && (<div className="evstrip">{it.evidence.map((ev, ei) => (
              <div className="evthumb" key={ei}>
                {ev.type === 'voice' ? <audio controls src={ev.data} /> : <img src={ev.data} alt={ev.type} onClick={() => setLightbox(ev.data)} style={{ cursor: 'zoom-in' }} />}
                {ev.type !== 'voice' && <AIButton className="mini ev-ai" label="AI check" busyLabel="Checking" build={() => ({ system: 'You are a HEFAMAA monitoring officer reviewing an evidence photo from a health facility. In 1 to 2 sentences note visible compliance issues (hygiene, PPE, waste, equipment, signage, cold chain) or say it looks acceptable. Be specific and cautious; do not overstate.', prompt: 'Category: ' + cat.label + '; item: ' + label + '. Note compliance-relevant observations.', image: ev.data, max_tokens: 200 })} onText={txt => setItem(key, { note: ((it.note || '') + (it.note ? '\n' : '') + 'AI: ' + txt) })} />}
                <button className="evx" onClick={() => removeEvidence(key, ei)}>&times;</button>
              </div>
            ))}</div>)}
          </div>)
        })}</div>
      </div>)
    })}

    <div className="mon-actions">
      <button className="btn primary" onClick={save} disabled={busy}>{busy ? 'Saving\u2026' : 'Save assessment'}</button>
      {saveState === 'pending' && <button className="btn ghost" onClick={save}>Sync now</button>}
      <span className="save-note">{saveState === 'saved' ? 'Saved' : saveState === 'pending' ? 'Pending sync' : 'Draft saved on this device'}</span>
    </div>
    <p className="hintline">The debrief, e-signature and report generation follow in Stage 6.</p>
    {lightbox && <div className="lightbox" onClick={() => setLightbox(null)}><img src={lightbox} alt="Evidence" /><button className="lightbox-x" onClick={() => setLightbox(null)} aria-label="Close">&times;</button></div>}
  </div>)
}

/* ---------- debrief (Stage 6) ---------- */
const REINSPECT = ['1 week', '2 weeks', '1 month', '3 months']
function itemMeta(key) { const idx = key.lastIndexOf('_'); const catId = key.slice(0, idx); const i = +key.slice(idx + 1); const cat = CHECKLIST.find(c => c.id === catId); return { category: cat ? cat.label : catId, label: cat ? cat.items[i] : key } }
function ragText(r) { return r === 'green' ? 'Green' : r === 'amber' ? 'Amber' : r === 'red' ? 'Red' : 'Not rated' }

function deriveDebrief(v) {
  const data = (v.monitoring && v.monitoring.items) || {}
  const strengths = [], gaps = []
  Object.keys(data).forEach(k => { const it = data[k]; if (!it || !it.rating) return; const m = itemMeta(k)
    if (it.rating === 'green') strengths.push(m.category + ': ' + m.label)
    else gaps.push({ key: k, category: m.category, label: m.label, rating: it.rating, action: it.note || '', timeline: '2 weeks' })
  })
  return { strengths, gaps }
}

const DOC_CSS = "@import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&display=swap');*{font-family:'Lora',Georgia,serif;color:#241536;box-sizing:border-box}body{max-width:760px;margin:36px auto;padding:0 24px;line-height:1.6}h1{color:#574277;font-size:23px;margin:14px 0 6px}h2{color:#574277;font-size:15px;margin:22px 0 8px}p{margin:0 0 10px}table{width:100%;border-collapse:collapse;margin:8px 0 14px}th,td{border:1px solid #E4DCEE;padding:8px 10px;text-align:left;font-size:12.5px;vertical-align:top}th{background:#F6F3FA;color:#574277}ul,ol{margin:6px 0 14px;padding-left:20px}li{font-size:13px;margin-bottom:4px}.head{display:flex;align-items:center;gap:12px;border-bottom:2px solid #EDE7F4;padding-bottom:12px;margin-bottom:8px}.chip{display:inline-block;padding:2px 10px;border-radius:12px;font-size:12px;border:1px solid #ccc}.g{background:#E6F4EA;color:#2E7D46;border-color:#BFE3CB}.a{background:#FBF3E6;color:#9A5B12;border-color:#F0D9B5}.r{background:#FBE9E6;color:#B4442E;border-color:#F0C9BF}.muted{color:#7A6A93;font-size:12px}.sig{height:80px;margin:6px 0}.right{text-align:right}@media print{body{margin:0}}"
function chipCls(r) { return r === 'green' ? 'g' : r === 'amber' ? 'a' : r === 'red' ? 'r' : '' }
function printDoc(title, inner) {
  const w = window.open('', '_blank'); if (!w) { window.alert('Please allow pop-ups to open the document, then try again.'); return }
  w.document.write('<html><head><title>' + title + '</title><meta charset="utf-8"><style>' + DOC_CSS + '</style></head><body>' + inner + '</body></html>')
  w.document.close(); w.focus(); setTimeout(() => { try { w.print() } catch (e) {} }, 400)
}
function safePrint(title, build) {
  let html
  try { html = build() } catch (e) { try { toast('Could not build the document: ' + ((e && e.message) || e), 'warn') } catch (_) { window.alert('Could not build the document.') } return }
  printDoc(title, html)
}
function docHead(origin) {
  return '<div class="head"><img src="' + origin + '/rhsc-mark.png" style="height:44px"><div><strong>REALMS HEALTHCARE SERVICES CONSULTING LIMITED</strong><br><span class="muted">Licensed HEFAMAA monitoring operator, Lagos State</span></div></div>'
}
function inspHead(origin) {
  return '<div class="head" style="justify-content:space-between"><div style="display:flex;align-items:center;gap:12px"><img src="' + origin + '/rhsc-mark.png" style="height:54px"><div><strong style="font-size:14px">HEALTH FACILITY MONITORING AND ACCREDITATION AGENCY (HEFAMAA)</strong><br><span style="color:#574277">Inspection Report (Realms Consulting)</span></div></div><img src="' + origin + '/hefamaa-logo.png" style="height:54px" onerror="this.style.display=\'none\'"></div>'
}
function firstVal() { for (let i = 0; i < arguments.length; i++) { const v = arguments[i]; if (v != null && String(v).trim() !== '') return String(v) } return '' }
function buildInspectionReport(v, d, origin) {
  const hef = (v.monitoring && v.monitoring.hefamaa) || {}
  const date = firstVal(hef.assess_date, (v.arrival_time || v.created_at || '').slice(0, 10))
  const svcList = [].concat(Array.isArray(hef.svc_primary) ? hef.svc_primary : [], Array.isArray(hef.svc_support) ? hef.svc_support : []).join(', ')
  const staffAuto = [hef.doctors_ft && (hef.doctors_ft + ' doctor(s)'), hef.nurses_ft && (hef.nurses_ft + ' nurse(s)'), hef.others_ft && (hef.others_ft + ' other staff')].filter(Boolean).join(', ')
  const renewal = firstVal(hef.hefamaa_renewal ? (hef.hefamaa_renewal + (hef.hefamaa_last_renewal ? ' (' + hef.hefamaa_last_renewal + ')' : '')) : '')
  const gapsText = (d && d.gaps && d.gaps.length) ? d.gaps.map(g => (g.category ? g.category + ': ' : '') + g.label).join('; ') : ''
  const observation = firstVal(hef.observation, d && d.narrative, gapsText)
  const rows = [
    ['General', ''],
    ['Date', date], ['Facility Name', v.facility_name || ''], ['Facility Address', firstVal(hef.address, v.address)],
    ['LGA', v.area || ''], ['Facility Schedule', firstVal(hef.schedule, v.category)], ['Opening Schedule', firstVal(hef.opening, hef.hours)], ['Registration Status', firstVal(hef.registration, hef.hefamaa_reg)],
    ['Findings', ''],
    ['Renewal Status', renewal], ['Services Rendered', firstVal(hef.services_rendered, svcList)], ['Total Staff Strength and Breakdown', firstVal(hef.total_staff, staffAuto)], ['Staff met on duty', firstVal(hef.staff_on_duty)],
    ['Basic Equipment Available', firstVal(hef.basic_equipment)], ['# of Wards', firstVal(hef.wards_no)], ['# of Beds', firstVal(hef.beds_no)], ['# of Toilets', firstVal(hef.toilets_available)],
    ['Observation (Gaps)', observation], ['Environment', firstVal(hef.environment, hef.gen_ventilation)], ['Waste Management', firstVal(hef.waste_mgmt, hef.medical_waste)], ['Treatment Room', firstVal(hef.treatment_room)], ['Others', firstVal(hef.other_notes)]
  ]
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')
  const body = rows.map(r => r[1] === '' && (r[0] === 'General' || r[0] === 'Findings') ? '<tr><th colspan="2" style="font-size:13px">' + r[0] + '</th></tr>' : '<tr><td style="width:34%;font-weight:600;color:#574277">' + r[0] + '</td><td>' + esc(r[1]) + '</td></tr>').join('')
  const stamp = (v.approval && v.approval.status === 'approved') ? '<p class="muted" style="border:1px solid #BFE3CB;background:#E6F4EA;color:#2E7D46;border-radius:6px;padding:6px 10px;display:inline-block">Approved for submission by ' + esc(v.approval.by || 'Team Lead') + ' on ' + String(v.approval.at || '').slice(0, 10) + '</p>' : ''
  return inspHead(origin) + '<table style="margin-top:10px">' + body + '</table>' + stamp + (d && d.signature ? '<p class="muted">Proprietor sign-off:</p><img class="sig" src="' + d.signature + '">' : '') + '<p class="muted" style="border:1px solid #E4DCEE;border-radius:6px;padding:8px 10px"><strong>Integrity notice.</strong> ' + INTEGRITY_NOTICE + '</p><p class="muted">Prepared by REALMS Healthcare Services Consulting Limited for HEFAMAA, Lagos State.</p>'
}
function hasFirstAssessment(v) {
  const a = v && v.assessment
  return !!((a && (a.ruid || a.services != null || a.total_score != null || a.recommendations || a.environment != null || a.visited_unscored)) || (v && v.monitoring && v.monitoring.first_assessment))
}
function firstAssessmentData(v) {
  const a = v && v.assessment
  if (a && (a.ruid || a.services != null || a.total_score != null || a.recommendations || a.environment != null || a.visited_unscored)) return a
  return (v && v.monitoring && v.monitoring.first_assessment) || (v && v.assessment) || {}
}
function buildMonitoringReport(v, origin) {
  const a = firstAssessmentData(v)
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')
  const date = firstVal(a.date, v.visit_date, (v.arrival_time || v.created_at || '').slice(0, 10))
  const pctText = a.visited_unscored ? 'Visited \u2014 not scored'
    : (a.pct_score != null && a.pct_score !== '') ? a.pct_score + '%'
    : (a.pct_estimate != null && a.pct_estimate !== '') ? a.pct_estimate + '% (estimated from the raw score)'
    : ''
  const gen = [
    ['Date', date], ['Facility Name', firstVal(a.name, v.facility_name)], ['Facility Address', firstVal(a.address, v.address)],
    ['LGA', firstVal(a.lga, v.area)], ['Facility Schedule', firstVal(a.schedule, v.category)], ['Opening Schedule', a.opening], ['Registration Status', a.reg_status]
  ]
  const find = [
    ['Renewal Status', a.renewal_status], ['Services Rendered', a.services], ['Total Staff Strength and Breakdown', a.staff_strength], ['Staff met on duty', a.staff_on_duty],
    ['Basic Equipment Available', a.basic_equipment], ['# of Wards', a.wards], ['# of Beds', a.beds], ['# of Toilets', a.toilets],
    ['Environment', a.environment], ['Waste Management', a.waste_mgmt], ['Theatre / Clinical Areas', a.clinical_area], ['Others', a.others]
  ]
  const scoreRows = [['Total Score', a.total_score != null && a.total_score !== '' ? String(a.total_score) : ''], ['Percentage', pctText]]
  const row = r => '<tr><td style="width:34%;font-weight:600;color:#574277">' + r[0] + '</td><td>' + esc(r[1]) + '</td></tr>'
  const sec = t => '<tr><th colspan="2" style="font-size:13px">' + t + '</th></tr>'
  const recs = Array.isArray(a.recommendations) && a.recommendations.length
    ? '<h2>Recommendation(s)</h2><ol>' + a.recommendations.map(r => '<li>' + esc(r) + '</li>').join('') + '</ol>' : ''
  const inspBy = firstVal(a.inspected_by) ? '<p class="muted"><strong>Inspected by:</strong> ' + esc(a.inspected_by) + '</p>' : ''
  const estNote = (a.pct_estimated || a.visited_unscored) && a.score_basis ? '<p class="muted">' + esc(a.score_basis) + '</p>' : ''
  return inspHead(origin) + '<h1 style="font-size:18px;margin-top:10px">First Assessment \u2014 Monitoring Report</h1>'
    + '<table style="margin-top:6px">' + sec('General') + gen.map(row).join('') + sec('Findings') + find.map(row).join('') + sec('Scores') + scoreRows.map(row).join('') + '</table>'
    + recs + estNote + inspBy
    + '<p class="muted" style="border:1px solid #E4DCEE;border-radius:6px;padding:8px 10px"><strong>Integrity notice.</strong> ' + INTEGRITY_NOTICE + '</p>'
    + '<p class="muted">Prepared by REALMS Healthcare Services Consulting Limited for HEFAMAA, Lagos State.</p>'
}
function isSecondVisit(v) { return !!(v && (v.status === 'second' || v.round === 2 || (v.debrief && v.debrief.second_visit) || (v.assessment && v.assessment.source === 'second_assessment'))) }
function buildSecondReport(v, origin, allVisits) {
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')
  const a = (v.assessment && v.assessment.source === 'second_assessment') ? v.assessment : (v.monitoring && v.monitoring.second_assessment) || v.assessment || {}
  const imp = v.improvement || {}
  const date = firstVal(a.date, v.visit_date, fmtDate(v.arrival_time))
  // pull the baseline through the stored link, else the facility's first visit
  let base = null
  if (Array.isArray(allVisits)) {
    base = (v.baseline_visit_id && allVisits.find(x => x.id === v.baseline_visit_id))
      || allVisits.find(x => x.id !== v.id && (x.facility_id === v.facility_id || x.facility_name === v.facility_name) && (x.round === 1 || (x.debrief && x.debrief.first_visit) || (x.assessment && x.assessment.ruid)))
  }
  const b = base ? ((base.assessment) || {}) : {}
  const bp = base ? (basePct(b) || {}).v : (imp.basePct != null ? imp.basePct : null)
  const np = a.pct_score != null && a.pct_score !== '' ? a.pct_score : (imp.newPct != null ? imp.newPct : null)
  const verdictColour = imp.verdict === 'Improved' ? '#2E7D46' : imp.verdict === 'Declined' ? '#B4442E' : '#9A5B12'
  const row = r => '<tr><td style="width:34%;font-weight:600;color:#574277">' + r[0] + '</td><td>' + esc(r[1]) + '</td></tr>'
  const sec = t => '<tr><th colspan="2" style="font-size:13px">' + t + '</th></tr>'
  const gen = [
    ['Date of second assessment', date], ['Facility Name', v.facility_name], ['Facility Address', firstVal(a.address, v.address)],
    ['LGA', v.area], ['Facility Schedule', firstVal(a.schedule, v.category)], ['Registration Status', a.reg_status]
  ]
  const find = [
    ['Renewal Status', a.renewal_status], ['Services Rendered', a.services], ['Total Staff Strength and Breakdown', a.staff_strength], ['Staff met on duty', a.staff_on_duty],
    ['Basic Equipment Available', a.basic_equipment], ['# of Wards', a.wards], ['# of Beds', a.beds], ['# of Toilets', a.toilets],
    ['Environment', a.environment], ['Waste Management', a.waste_mgmt], ['Theatre / Clinical Areas', a.clinical_area], ['Others', a.others]
  ].filter(r => r[1] != null && r[1] !== '')
  // progress against the first-visit recommendations
  const recStatus = Array.isArray(a.recommendation_status) ? a.recommendation_status : []
  const statusLabel = s => s === 'resolved' ? 'Resolved' : s === 'in_progress' ? 'In progress' : 'Not done'
  const recTable = recStatus.length
    ? '<h2>Progress on first-visit recommendations</h2><table>' + recStatus.map(r => '<tr><td>' + esc(r.text) + '</td><td style="width:26%;font-weight:600">' + statusLabel(r.status) + '</td></tr>').join('') + '</table>'
    : ''
  const newRecs = Array.isArray(a.new_recommendations) && a.new_recommendations.length
    ? '<h2>New recommendation(s)</h2><ol>' + a.new_recommendations.map(r => '<li>' + esc(r) + '</li>').join('') + '</ol>' : ''
  const cmp = '<h2>Comparison with the first assessment</h2><table>'
    + '<tr><th>Measure</th><th>First visit</th><th>This visit</th><th>Change</th></tr>'
    + '<tr><td style="font-weight:600;color:#574277">Percentage score</td><td>' + (bp != null ? bp + '%' : '\u2014') + '</td><td>' + (np != null ? np + '%' : '\u2014') + '</td><td>' + (imp.dPct != null ? (imp.dPct > 0 ? '+' : '') + imp.dPct + ' pts' : '\u2014') + '</td></tr>'
    + '<tr><td style="font-weight:600;color:#574277">Recommendations resolved</td><td colspan="2">' + (imp.resolved != null ? imp.resolved : 0) + ' of ' + (imp.recTotal != null ? imp.recTotal : recStatus.length) + '</td><td style="font-weight:700;color:' + verdictColour + '">' + esc(imp.verdict || '') + '</td></tr>'
    + '</table>'
  const notes = a.notes ? '<h2>Notes</h2><p>' + esc(a.notes) + '</p>' : ''
  const inspBy = a.inspected_by ? '<p class="muted"><strong>Inspected by:</strong> ' + esc(a.inspected_by) + '</p>' : ''
  const scoreRows = [['Total Score', a.total_score != null && a.total_score !== '' ? String(a.total_score) : ''], ['Percentage', np != null ? np + '%' : '']]
  return inspHead(origin) + '<h1 style="font-size:18px;margin-top:10px">Second Assessment \u2014 Monitoring Report</h1>'
    + '<table style="margin-top:6px">' + sec('General') + gen.map(row).join('') + sec('Findings') + find.map(row).join('') + sec('Scores') + scoreRows.map(row).join('') + '</table>'
    + cmp + recTable + newRecs + notes + inspBy
    + '<p class="muted" style="border:1px solid #E4DCEE;border-radius:6px;padding:8px 10px"><strong>Integrity notice.</strong> ' + INTEGRITY_NOTICE + '</p>'
    + '<p class="muted">Prepared by REALMS Healthcare Services Consulting Limited for HEFAMAA, Lagos State.</p>'
}
function buildMonitoringBatch(visits, origin) {
  const parts = visits.map((v, i) => '<div style="' + (i ? 'page-break-before:always;' : '') + '">' + buildMonitoringReport(v, origin) + '</div>')
  const idx = '<h1>First-assessment monitoring reports</h1><p>REALMS Healthcare Services Consulting Limited. ' + visits.length + ' report' + (visits.length === 1 ? '' : 's') + '.</p><table><tr><th>#</th><th>Facility</th><th>LGA</th><th>Date</th></tr>' + visits.map((v, i) => { const a = firstAssessmentData(v); return '<tr><td>' + (i + 1) + '</td><td>' + (v.facility_name || '') + '</td><td>' + (v.area || '') + '</td><td>' + firstVal(a.date, v.visit_date, fmtDate(v.arrival_time)) + '</td></tr>' }).join('') + '</table>'
  return docHead(origin) + idx + '<div style="page-break-before:always">' + parts.join('') + '</div>'
}
function buildWeeklyBatch(visits, origin, from, to) {
  // HEFAMAA requires the full inspection form on every visit, first or second. A second
  // visit now carries that form too, so it submits the same inspection report. The
  // first-vs-second comparison is a separate document for RHSC's own tracking.
  const docFor = v => buildInspectionReport(v, v.debrief || deriveDebrief(v), origin)
  const parts = visits.map((v, i) => '<div style="' + (i ? 'page-break-before:always;' : '') + '">' + docFor(v) + '</div>')
  const idx = '<h1>HEFAMAA submission: ' + from + ' to ' + to + '</h1><p>REALMS Healthcare Services Consulting Limited. ' + visits.length + ' approved inspection report' + (visits.length === 1 ? '' : 's') + '.</p><table><tr><th>#</th><th>Facility</th><th>LGA</th><th>Visit</th><th>Date</th></tr>' + visits.map((v, i) => '<tr><td>' + (i + 1) + '</td><td>' + v.facility_name + '</td><td>' + (v.area || '') + '</td><td>' + (isSecondVisit(v) ? 'Second' : 'First') + '</td><td>' + (v.visit_date || fmtDate(v.arrival_time)) + '</td></tr>').join('') + '</table>'
  return docHead(origin) + idx + '<div style="page-break-before:always">' + parts.join('') + '</div>'
}
function buildReport(v, d, origin) {
  const data = (v.monitoring && v.monitoring.items) || {}
  const date = (v.arrival_time || v.created_at || '').slice(0, 10)
  const cats = CHECKLIST.map(c => { const cs = categoryScore(data, c); return '<tr><td>' + c.label + '</td><td><span class="chip ' + chipCls(cs.rag) + '">' + ragText(cs.rag) + (cs.pct != null ? ' ' + cs.pct + '%' : '') + '</span></td></tr>' }).join('')
  const strengths = d.strengths.length ? '<ul>' + d.strengths.map(s => '<li>' + s + '</li>').join('') + '</ul>' : '<p class="muted">None recorded.</p>'
  const gaps = d.gaps.length ? '<table><tr><th>Finding</th><th>Rating</th><th>Required action</th><th>Timeline</th></tr>' + d.gaps.map(g => '<tr><td>' + g.category + ': ' + g.label + '</td><td>' + ragText(g.rating) + '</td><td>' + (g.action || '\u2014') + '</td><td>' + (g.timeline || '\u2014') + '</td></tr>').join('') + '</table>' : '<p class="muted">No gaps recorded.</p>'
  const sig = d.signature ? '<img class="sig" src="' + d.signature + '">' : '<p class="muted">Not signed.</p>'
  const pr = (v.monitoring && v.monitoring.profile) || {}
  const profileBits = [pr.wards && (pr.wards + ' wards'), pr.beds && (pr.beds + ' beds'), pr.toilets && (pr.toilets + ' toilets'), pr.staff && (pr.staff + ' staff on duty'), pr.scope].filter(Boolean).join(' &middot; ')
  const profileHtml = profileBits ? '<h2>Facility profile</h2><p>' + profileBits + '</p>' : ''
  const digital = d.genesys_interest ? '<h2>Digital health</h2><p>Facility expressed interest in the Genesys EMR.' + (d.genesys_note ? ' ' + d.genesys_note : '') + '</p>' : ''
  const esc = d.escalated ? '<p class="muted"><strong>Note:</strong> critical finding escalated to HEFAMAA / RHSC HQ.</p>' : ''
  const hef = (v.monitoring && v.monitoring.hefamaa) || {}
  const hefHtml = HEFAMAA_FORM.map(sec => {
    const rows = sec.fields.filter(f => { const val = hef[f[0]]; return Array.isArray(val) ? val.length : (val != null && val !== '') })
      .map(f => '<tr><td>' + f[1] + '</td><td>' + (Array.isArray(hef[f[0]]) ? hef[f[0]].join(', ') : String(hef[f[0]])) + '</td></tr>').join('')
    return rows ? '<h3>' + sec.title + '</h3><table>' + rows + '</table>' : ''
  }).join('')
  const hefSection = hefHtml ? '<h2>HEFAMAA inspection form</h2>' + hefHtml : ''
  const narr = d.narrative ? '<h2>Summary &amp; recommendations</h2><p>' + String(d.narrative).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>') + '</p>' : ''
  return docHead(origin) + '<h1>Health Facility Monitoring Report</h1>' +
    '<p><strong>Facility:</strong> ' + v.facility_name + ' &middot; <strong>Area:</strong> ' + (v.area || '') + '<br><strong>Visit date:</strong> ' + date + ' &middot; <strong>Overall:</strong> <span class="chip ' + chipCls(v.overall_rating) + '">' + ragText(v.overall_rating) + (v.score != null ? ' ' + v.score + '%' : '') + '</span></p>' +
    profileHtml +
    narr +
    '<h2>Assessment by category</h2><table><tr><th>Category</th><th>Rating</th></tr>' + cats + '</table>' +
    '<h2>Strengths</h2>' + strengths +
    '<h2>Gaps and required corrective actions</h2>' + gaps +
    '<h2>Next steps</h2><p>Remediation deadline: ' + (d.remediation_deadline || 'to be set') + '. Re-inspection: ' + (d.reinspection || 'to be scheduled') + '. Compliance letter issued: ' + (d.letter_issued ? 'Yes' : 'No') + '.' + (d.closure_recommended ? ' Closure recommended.' : '') + '</p>' + esc +
    digital +
    '<h2>Debrief and sign-off</h2><p>Person in charge: ' + (d.proprietor_name || '\u2014') + '. Acknowledged: ' + (d.proprietor_ack ? 'Yes' : 'No') + '.</p>' + sig + (d.signed_at ? '<p class="muted">Signed ' + d.signed_at.slice(0, 16).replace('T', ' ') + '</p>' : '') +
    hefSection +
    '<p class="muted"><strong>Integrity notice.</strong> ' + INTEGRITY_NOTICE + '</p><p class="muted">Prepared by REALMS Healthcare Services Consulting Limited in support of the HEFAMAA regulatory mandate. This report is not legal advice.</p>'
}
function buildClosure(v, d, origin) {
  const date = (v.arrival_time || v.created_at || '').slice(0, 10)
  const ref = 'RHSC/CN/' + (v.area || 'LAG').slice(0, 3).toUpperCase() + '/' + date.replace(/-/g, '')
  const grounds = d.gaps && d.gaps.length ? '<ol>' + d.gaps.filter(g => g.rating === 'red').slice(0, 8).map(g => '<li>' + g.category + ' &mdash; ' + g.label + '.</li>').join('') + '</ol>' : '<p>Grounds as recorded during the monitoring visit.</p>'
  return docHead(origin) + '<p class="right">Ref: ' + ref + '<br>' + date + '</p>' +
    '<p>The Proprietor / Person in Charge<br>' + v.facility_name + '<br>' + (v.area || '') + ', Lagos State</p>' +
    '<p><strong>Dear Sir/Ma,</strong></p>' +
    '<p><strong>RE: NOTICE OF CLOSURE &mdash; ' + (v.facility_name || '').toUpperCase() + '</strong></p>' +
    '<p>Following a routine monitoring visit conducted at your facility on ' + date + ' by REALMS Healthcare Services Consulting Limited, as a licensed monitoring operator for the Health Facility Monitoring and Accreditation Agency (HEFAMAA), Lagos State, your facility has been found to be in serious breach of the standards required to operate.</p>' +
    '<p><strong>Grounds for this notice.</strong></p>' + grounds +
    '<p>You are hereby directed to cease operations pending regulatory review and the correction of the above. This matter has been referred to HEFAMAA for enforcement. You may make representations to the Agency.</p>' +
    '<p>Yours Sincerely,<br>For: REALMS Healthcare Services Consulting Limited</p>' +
    '<p class="muted">Issued in support of the HEFAMAA regulatory mandate. Final enforcement decisions rest with HEFAMAA.</p>'
}
const SIGN_JOY = '<svg viewBox="0 0 428.4 134.9" xmlns="http://www.w3.org/2000/svg" style="height:62px;max-width:270px"><path d="M 41.7 126.9 Q 32.2 126.9 24.5 123.7 Q 16.9 120.5 12.5 114.4 Q 8.0 108.3 8.0 99.7 Q 8.0 91.7 11.1 86.6 Q 14.2 81.4 17.9 78.8 Q 20.0 77.3 21.8 76.7 Q 23.6 76.0 24.2 76.0 Q 24.8 76.0 24.8 76.5 Q 24.8 77.0 24.3 77.3 Q 19.1 80.4 16.3 86.1 Q 13.6 91.8 13.6 98.6 Q 13.6 106.4 17.2 112.2 Q 20.8 117.9 27.2 121.0 Q 33.6 124.1 42.0 124.1 Q 56.2 124.1 69.1 112.9 Q 82.0 101.7 94.0 81.7 Q 98.5 74.0 102.5 65.8 Q 106.5 57.6 110.1 49.6 Q 113.7 41.8 117.0 35.5 Q 120.2 29.3 122.6 25.0 Q 125.1 20.7 126.2 19.0 Q 100.9 22.4 87.0 29.8 Q 73.2 37.2 73.2 48.8 Q 73.2 54.8 76.3 57.8 Q 79.4 60.7 83.4 60.7 Q 87.3 60.7 91.2 58.2 Q 95.2 55.7 97.8 51.2 Q 100.5 46.8 100.5 40.9 Q 100.5 38.0 98.7 36.2 Q 98.7 35.2 99.7 35.2 Q 100.9 35.2 101.8 37.0 Q 102.8 38.8 102.8 41.5 Q 102.8 48.2 99.6 53.1 Q 96.5 57.9 91.6 60.5 Q 86.8 63.1 81.7 63.1 Q 77.8 63.1 74.3 61.4 Q 70.8 59.7 68.5 56.2 Q 66.3 52.7 66.3 47.5 Q 66.3 40.7 70.8 35.7 Q 75.4 30.6 83.7 27.0 Q 91.9 23.4 103.2 20.8 Q 114.4 18.2 127.9 16.3 Q 130.7 12.4 133.0 10.2 Q 135.4 8.0 138.2 8.0 Q 139.8 8.0 140.8 8.8 Q 141.7 9.6 141.7 11.2 Q 141.7 13.5 139.8 15.0 Q 137.9 16.4 135.0 17.3 Q 132.1 18.1 129.2 18.6 Q 125.5 25.0 122.8 31.8 Q 120.0 38.5 117.6 45.6 Q 115.3 52.6 112.6 60.0 Q 110.0 67.3 106.4 75.0 Q 98.9 90.9 89.1 102.5 Q 79.3 114.2 67.4 120.5 Q 55.5 126.9 41.7 126.9 Z M 131.0 16.1 Q 135.1 15.4 136.5 14.4 Q 137.9 13.3 137.9 12.4 Q 137.9 11.2 136.7 11.2 Q 135.6 11.2 134.0 12.9 Q 132.5 14.5 131.0 16.1 Z M 123.1 88.7 Q 119.0 88.7 117.0 85.8 Q 115.1 82.8 115.1 78.6 Q 115.1 74.7 116.6 70.5 Q 118.2 65.9 121.0 62.1 Q 123.9 58.3 127.3 56.0 Q 130.8 53.6 134.2 53.6 Q 138.3 53.6 140.2 56.4 Q 142.2 59.2 142.2 63.5 Q 142.2 66.5 141.2 69.8 Q 140.2 73.1 138.5 76.3 Q 139.8 77.6 142.2 77.6 Q 145.0 77.6 147.0 75.8 Q 149.0 74.0 150.9 69.4 Q 152.1 69.4 152.1 70.3 Q 150.2 74.9 147.7 77.1 Q 145.3 79.2 141.5 79.1 Q 139.2 79.1 137.7 77.8 Q 134.9 82.4 131.0 85.6 Q 127.2 88.7 123.1 88.7 Z M 124.5 86.5 Q 126.8 86.5 129.1 84.6 Q 131.4 82.6 133.3 80.1 Q 135.2 77.6 136.0 75.8 Q 134.4 72.9 134.2 71.5 Q 133.9 70.0 133.9 69.3 Q 133.9 67.4 134.9 66.4 Q 135.9 65.4 136.9 65.4 Q 138.3 65.4 139.3 66.6 Q 139.5 65.5 139.6 64.6 Q 139.7 63.6 139.7 62.7 Q 139.7 60.1 138.7 58.5 Q 137.8 56.8 135.8 56.8 Q 133.7 56.8 131.4 58.6 Q 129.1 60.4 127.0 63.4 Q 125.0 66.4 123.5 70.1 Q 122.2 73.2 121.5 76.0 Q 120.8 78.7 120.8 81.0 Q 120.8 83.5 121.7 85.0 Q 122.6 86.5 124.5 86.5 Z M 137.1 120.6 Q 131.9 120.6 129.7 118.5 Q 127.5 116.5 127.5 113.7 Q 127.5 109.4 130.7 105.8 Q 133.8 102.1 138.4 99.9 Q 143.6 97.5 150.2 96.0 Q 156.9 94.5 163.0 92.7 Q 164.9 89.4 166.5 85.2 Q 168.1 80.9 169.4 76.9 Q 170.7 72.8 171.5 70.2 Q 170.3 72.4 168.4 75.6 Q 166.6 78.7 164.3 81.7 Q 162.0 84.7 159.3 86.7 Q 156.7 88.7 153.8 88.7 Q 152.7 88.7 151.1 88.2 Q 149.6 87.7 148.4 86.4 Q 147.3 85.0 147.3 82.3 Q 147.3 79.7 148.9 76.6 Q 150.5 73.4 152.1 70.3 Q 151.6 70.3 151.2 70.2 Q 150.9 70.1 150.9 69.4 Q 151.2 68.8 152.1 66.8 Q 153.0 64.8 154.1 62.4 Q 155.3 60.0 156.2 58.2 Q 157.3 55.9 158.6 55.0 Q 160.0 54.1 161.3 54.1 L 167.5 54.1 Q 166.8 54.7 165.7 55.5 Q 164.7 56.2 163.8 57.7 Q 161.1 62.3 159.1 66.5 Q 157.1 70.8 154.8 75.6 Q 153.7 77.9 153.2 79.8 Q 152.7 81.7 152.7 83.1 Q 152.7 86.4 154.9 86.4 Q 157.3 86.4 160.7 82.5 Q 163.5 79.2 166.3 74.7 Q 169.2 70.1 171.8 65.3 Q 174.5 60.4 176.5 56.3 Q 177.6 54.1 180.4 54.1 L 185.9 54.1 Q 183.0 56.1 181.5 59.3 Q 179.9 62.5 178.0 67.5 Q 175.9 73.0 174.0 78.9 Q 172.1 84.8 169.8 91.0 Q 174.7 89.3 178.0 86.6 Q 181.3 83.9 183.8 79.7 Q 186.4 75.4 189.0 69.4 Q 190.2 69.4 190.2 70.3 Q 188.0 74.9 186.2 78.4 Q 184.4 81.9 182.2 84.6 Q 180.0 87.2 176.7 89.5 Q 173.4 91.7 168.2 93.8 Q 165.8 98.1 162.7 102.8 Q 159.7 107.4 155.8 111.5 Q 152.0 115.5 147.3 118.0 Q 142.7 120.6 137.1 120.6 Z M 134.7 118.6 Q 138.0 118.6 141.5 116.6 Q 145.0 114.6 148.3 111.5 Q 151.6 108.5 154.3 105.3 Q 157.1 102.2 158.8 99.8 Q 159.3 99.1 159.9 98.0 Q 160.5 96.9 161.1 95.9 Q 156.2 97.2 150.3 98.8 Q 144.5 100.3 140.2 102.2 Q 135.4 104.2 132.7 107.9 Q 129.9 111.6 129.9 114.5 Q 129.9 116.3 131.1 117.5 Q 132.2 118.6 134.7 118.6 Z M 231.8 94.8 Q 221.6 94.8 215.9 88.5 Q 210.1 82.2 210.1 70.6 Q 210.1 63.3 213.1 55.5 Q 208.9 52.6 207.0 49.0 Q 205.2 45.3 205.2 40.1 Q 205.2 33.2 208.3 27.8 Q 211.5 22.4 216.8 18.6 Q 222.1 14.7 228.7 12.7 Q 235.3 10.7 242.1 10.7 Q 248.8 10.7 255.1 12.8 Q 261.4 14.8 266.3 19.0 Q 271.3 23.3 274.0 29.8 Q 276.8 36.3 276.4 45.3 Q 281.1 42.4 284.5 39.0 Q 288.0 35.5 289.6 32.6 Q 290.1 31.7 290.6 31.7 Q 291.1 31.7 291.2 32.5 Q 291.4 33.3 290.7 34.4 Q 288.2 38.3 284.5 42.1 Q 280.9 45.9 276.0 48.9 Q 275.9 51.1 275.3 53.9 Q 274.8 56.6 273.8 59.6 Q 271.9 65.7 267.7 71.9 Q 263.6 78.1 257.9 83.3 Q 252.2 88.5 245.5 91.6 Q 238.8 94.8 231.8 94.8 Z M 235.1 57.7 Q 243.5 57.7 252.8 55.2 Q 262.2 52.8 270.4 48.5 Q 270.6 47.2 270.6 46.0 Q 270.6 44.7 270.6 43.5 Q 270.6 33.3 267.0 26.5 Q 263.5 19.7 257.2 16.3 Q 250.9 12.9 242.5 12.9 Q 236.0 12.9 230.2 14.9 Q 224.5 16.9 220.0 20.5 Q 215.6 24.1 213.1 29.0 Q 210.6 33.9 210.6 39.8 Q 210.6 42.5 211.4 45.7 Q 212.1 48.8 214.9 51.3 Q 216.3 48.3 218.7 44.5 Q 221.1 40.8 224.2 37.0 Q 227.4 33.1 231.0 29.9 Q 234.7 26.7 238.7 24.8 Q 242.6 22.8 246.6 22.8 Q 248.3 22.8 250.0 23.2 Q 251.8 23.6 253.4 24.6 Q 254.2 25.1 254.2 25.5 Q 254.2 25.8 253.7 26.0 Q 253.3 26.2 252.6 26.0 Q 251.3 25.6 249.7 25.6 Q 246.1 25.6 242.4 27.8 Q 238.7 29.9 235.2 33.4 Q 231.7 36.8 228.7 40.8 Q 225.7 44.7 223.4 48.5 Q 221.2 52.2 220.0 54.8 Q 226.1 57.7 235.1 57.7 Z M 232.6 92.4 Q 238.2 92.4 243.5 89.6 Q 248.9 86.8 253.7 82.0 Q 258.4 77.2 262.1 71.3 Q 265.8 65.4 268.0 59.2 Q 268.6 57.5 269.1 55.7 Q 269.6 53.8 269.7 52.1 Q 261.6 56.4 252.4 58.7 Q 243.2 61.0 234.8 61.0 Q 225.5 61.0 218.6 58.3 Q 215.5 66.2 215.5 73.8 Q 215.5 83.1 220.3 87.8 Q 225.2 92.4 232.6 92.4 Z M 243.0 120.6 Q 237.8 120.6 235.7 118.5 Q 233.5 116.5 233.5 113.7 Q 233.5 111.0 235.0 108.3 Q 236.4 105.4 238.9 103.3 Q 241.4 101.3 244.4 99.9 Q 249.5 97.5 256.2 96.0 Q 262.8 94.5 268.9 92.7 Q 269.7 91.3 270.6 89.8 Q 271.4 88.3 272.1 86.9 Q 274.1 82.9 275.8 79.0 Q 277.5 75.0 280.0 70.4 Q 279.1 70.4 279.1 69.4 L 283.5 59.3 Q 283.6 59.1 283.7 58.8 Q 283.8 58.4 283.8 58.0 Q 283.8 56.9 283.3 56.2 Q 282.8 55.4 282.6 55.1 L 288.1 54.9 L 288.6 54.9 Q 290.8 54.9 290.8 56.3 Q 290.8 57.0 290.2 58.5 L 282.2 77.3 Q 280.8 80.6 279.2 83.9 Q 277.6 87.2 275.9 90.6 Q 282.9 87.9 287.0 84.0 Q 291.2 80.0 293.4 76.1 Q 295.7 72.1 296.9 69.4 Q 298.1 69.4 298.1 70.3 Q 297.1 72.5 295.5 75.6 Q 293.9 78.6 291.3 82.0 Q 288.7 85.3 284.6 88.4 Q 280.5 91.5 274.3 93.8 Q 271.9 98.1 268.8 102.8 Q 265.7 107.4 261.8 111.5 Q 257.9 115.5 253.3 118.0 Q 248.6 120.6 243.0 120.6 Z M 240.6 118.6 Q 243.9 118.6 247.4 116.6 Q 251.0 114.6 254.3 111.5 Q 257.6 108.5 260.4 105.3 Q 263.1 102.1 264.8 99.7 Q 265.4 98.9 265.9 97.9 Q 266.4 96.9 266.9 95.9 Q 262.1 97.2 256.3 98.8 Q 250.5 100.3 246.1 102.2 Q 241.3 104.2 238.6 107.8 Q 235.9 111.5 235.9 114.4 Q 235.9 116.3 237.1 117.5 Q 238.2 118.6 240.6 118.6 Z M 291.0 49.0 Q 289.7 49.0 288.8 48.0 Q 287.8 47.0 287.8 45.6 Q 287.8 43.9 289.2 42.6 Q 290.6 41.2 292.3 41.2 Q 293.7 41.2 294.7 42.1 Q 295.7 43.0 295.7 44.4 Q 295.7 46.2 294.3 47.6 Q 292.9 49.0 291.0 49.0 Z M 299.8 88.7 Q 298.7 88.7 297.1 88.2 Q 295.6 87.7 294.4 86.4 Q 293.3 85.0 293.3 82.3 Q 293.3 79.7 295.0 76.3 Q 296.7 72.9 298.0 70.3 Q 296.9 70.3 296.9 69.4 Q 297.0 69.1 297.8 67.5 Q 298.6 65.9 299.7 63.7 Q 300.8 61.5 301.8 59.5 Q 302.9 57.4 303.5 56.3 Q 304.7 54.1 307.3 54.1 L 313.5 54.1 Q 311.8 55.4 310.4 57.0 Q 309.1 58.5 307.1 62.6 Q 307.1 62.6 306.4 64.0 Q 305.7 65.4 304.6 67.6 Q 303.6 69.7 302.5 71.9 Q 301.5 74.1 300.8 75.6 Q 299.5 78.4 299.1 80.1 Q 298.7 81.7 298.7 83.1 Q 298.7 86.4 300.9 86.4 Q 303.3 86.4 306.7 82.5 Q 309.5 79.2 312.2 74.6 Q 314.9 70.0 317.3 65.1 Q 319.8 60.2 321.7 56.3 Q 322.8 54.1 325.6 54.1 L 331.1 54.1 Q 328.9 55.9 326.7 59.5 Q 324.4 63.1 321.7 68.7 Q 321.0 70.2 319.9 72.5 Q 318.8 74.8 317.9 77.4 Q 317.1 80.0 317.1 82.6 Q 317.1 86.1 319.6 86.1 Q 323.0 86.1 326.2 81.4 Q 329.4 76.7 332.5 69.4 Q 333.3 69.4 333.4 69.5 Q 333.6 69.6 333.7 70.3 Q 332.6 73.0 331.0 76.2 Q 329.5 79.3 327.5 82.2 Q 325.6 85.1 323.2 86.9 Q 320.9 88.7 318.1 88.7 Q 315.6 88.7 314.0 86.9 Q 312.4 85.0 312.4 81.6 Q 312.4 78.9 313.4 75.8 Q 311.7 78.8 309.5 81.8 Q 307.3 84.8 304.8 86.8 Q 302.3 88.7 299.8 88.7 Z M 322.8 89.2 Q 326.5 82.1 329.8 75.0 Q 333.1 67.8 336.5 61.4 Q 338.5 57.8 339.8 56.4 Q 341.2 54.9 343.5 54.9 Q 344.3 54.9 345.2 55.2 Q 346.1 55.4 347.0 55.4 Q 347.6 55.4 347.9 55.3 Q 346.5 56.1 344.3 59.3 Q 342.1 62.4 339.8 66.5 Q 337.5 70.6 335.7 74.2 Q 337.6 71.9 339.6 69.6 Q 341.7 67.3 344.2 65.2 Q 346.4 63.3 348.8 61.0 Q 351.3 58.8 353.7 57.2 Q 356.1 55.6 357.9 55.6 Q 358.6 55.6 358.8 55.7 Q 360.7 56.5 360.7 58.3 Q 360.7 58.9 360.2 60.1 Q 358.9 63.5 356.8 67.1 Q 354.8 70.6 353.0 74.2 Q 354.5 72.4 356.8 69.8 Q 359.0 67.2 361.3 65.2 Q 363.5 63.2 366.9 61.0 Q 370.3 58.8 373.6 57.2 Q 376.9 55.6 378.9 55.6 Q 379.6 55.6 379.9 55.7 Q 379.9 55.7 378.8 57.7 Q 377.7 59.6 376.0 62.8 Q 374.4 65.9 372.7 69.5 Q 371.0 73.0 369.6 76.2 Q 368.3 79.5 367.9 81.7 Q 367.6 83.0 367.6 84.1 Q 367.6 85.7 368.2 86.2 Q 368.8 86.7 369.5 86.7 Q 371.5 86.7 373.4 85.0 Q 375.4 83.3 377.3 80.7 Q 379.2 78.0 380.7 75.0 Q 382.3 72.0 383.4 69.4 Q 384.6 69.4 384.6 70.3 Q 383.5 73.0 381.8 76.2 Q 380.2 79.5 378.1 82.4 Q 376.0 85.3 373.5 87.2 Q 371.0 89.1 368.1 89.1 Q 366.0 89.1 364.1 87.7 Q 362.3 86.3 362.3 82.5 Q 362.3 78.4 364.2 74.3 Q 366.2 70.2 368.3 66.8 Q 369.3 65.1 369.3 64.1 Q 369.3 62.9 368.1 62.9 Q 367.1 62.9 365.3 63.9 Q 363.6 64.9 361.0 67.4 Q 359.4 68.9 357.2 71.6 Q 355.1 74.2 352.9 77.3 Q 350.7 80.4 349.1 83.4 Q 347.5 86.4 347.0 88.7 Q 345.5 88.7 344.6 87.5 Q 343.7 86.2 343.7 84.5 Q 343.7 84.2 343.7 83.9 Q 343.7 83.6 343.8 83.2 Q 344.3 80.1 345.4 78.0 Q 346.5 75.8 347.9 72.9 Q 348.6 71.6 349.5 69.9 Q 350.4 68.1 351.1 66.5 Q 351.8 64.8 351.8 63.7 Q 351.8 62.7 351.0 62.7 Q 350.1 62.7 348.6 63.6 Q 347.2 64.5 345.9 65.7 Q 344.6 66.8 343.9 67.4 Q 341.4 69.8 337.8 74.3 Q 334.3 78.8 330.1 87.1 Q 329.5 88.2 328.7 88.5 Q 327.9 88.7 326.2 88.7 Q 325.1 88.7 324.3 88.8 Q 323.6 88.8 322.8 89.2 Z M 405.1 89.0 Q 402.8 89.0 401.0 87.7 Q 399.3 86.4 399.3 82.4 Q 399.3 80.7 399.5 79.2 Q 399.8 77.7 400.2 76.0 Q 399.3 77.5 397.7 79.7 Q 396.1 81.9 394.1 84.0 Q 392.2 86.1 390.1 87.5 Q 388.1 88.9 386.3 88.9 Q 383.7 88.9 382.1 86.6 Q 380.5 84.2 380.5 80.4 Q 380.5 76.3 382.4 71.6 Q 384.3 66.9 387.6 62.6 Q 390.9 58.3 395.2 55.6 Q 399.5 52.9 404.2 52.9 Q 406.5 52.9 408.6 53.7 Q 410.7 54.4 412.3 56.1 Q 413.0 56.8 413.0 57.7 Q 413.0 58.3 412.5 58.7 Q 412.0 59.1 411.2 58.9 Q 410.1 55.4 406.5 55.4 Q 404.8 55.4 402.6 56.5 Q 399.9 57.9 396.8 61.0 Q 393.8 64.0 391.1 67.9 Q 388.5 71.7 386.8 75.6 Q 385.1 79.5 385.1 82.7 Q 385.1 86.0 387.6 86.0 Q 389.8 86.0 392.1 83.9 Q 394.5 81.8 396.6 78.7 Q 398.8 75.5 400.6 72.4 Q 402.4 69.3 403.4 67.4 Q 404.9 64.7 406.2 62.9 Q 407.5 61.1 409.9 61.1 Q 411.0 61.1 412.1 61.4 Q 413.2 61.7 414.4 61.5 Q 411.4 64.5 409.2 68.6 Q 406.9 72.7 405.7 76.7 Q 404.5 80.6 404.5 83.3 Q 404.5 86.3 406.5 86.3 Q 408.1 86.3 409.9 84.5 Q 411.8 82.7 413.5 80.0 Q 415.3 77.2 416.8 74.4 Q 418.3 71.5 419.2 69.4 Q 419.7 69.4 420.0 69.5 Q 420.4 69.6 420.4 70.3 Q 420.3 70.7 420.0 71.2 Q 419.8 71.6 419.3 72.7 Q 418.5 74.3 417.1 77.0 Q 415.7 79.7 413.8 82.5 Q 411.9 85.2 409.7 87.1 Q 407.5 89.0 405.1 89.0 Z" fill="#16305B"/></svg>'
function buildLetter(v, d, origin) {
  const date = (v.arrival_time || v.created_at || '').slice(0, 10)
  const ref = 'RHSC/' + (v.area || 'LAG').slice(0, 3).toUpperCase() + '/' + date.replace(/-/g, '')
  const strengthsP = d.strengths.length ? 'Your facility demonstrated good practice in areas including ' + d.strengths.slice(0, 4).map(s => s.split(': ').pop().toLowerCase()).join(', ') + '.' : 'Areas of strength were noted during the visit.'
  const gapsL = d.gaps.length ? '<ol>' + d.gaps.map(g => '<li>' + g.category + ' &mdash; ' + g.label + '. Required action: ' + (g.action || 'address the non-compliance') + '. Timeline: ' + (g.timeline || 'as advised') + '.</li>').join('') + '</ol>' : '<p>No significant non-compliance was recorded.</p>'
  return docHead(origin) + '<p class="right">Ref: ' + ref + '<br>' + date + '</p>' +
    '<p>The Proprietor / Person in Charge<br>' + v.facility_name + '<br>' + (v.area || '') + ', Lagos State</p>' +
    '<p><strong>Dear Sir/Ma,</strong></p>' +
    '<p><strong>RE: OUTCOME OF ROUTINE HEALTH FACILITY MONITORING AT ' + (v.facility_name || '').toUpperCase() + '</strong></p>' +
    '<p>Following the routine monitoring visit conducted at your facility on ' + date + ' by REALMS Healthcare Services Consulting Limited, in collaboration with the Health Facility Monitoring and Accreditation Agency (HEFAMAA), Lagos State, please find below a summary of our assessment and the actions required.</p>' +
    '<p>The overall outcome of the visit is <strong>' + ragText(v.overall_rating) + '</strong>, with a compliance score of <strong>' + (v.score != null ? v.score + '%' : 'not scored') + '</strong>.</p>' +
    '<p><strong>Areas of strength.</strong> ' + strengthsP + '</p>' +
    '<p><strong>Areas requiring correction.</strong></p>' + gapsL +
    '<p>You are required to complete the corrective actions above by <strong>' + (d.remediation_deadline || 'the date advised') + '</strong>. A re-inspection is scheduled within ' + (d.reinspection || 'the coming weeks') + ' to confirm the required corrections. Continued non-compliance may result in escalation to HEFAMAA for regulatory action.</p>' +
    '<p style="margin-bottom:2px">Yours Sincerely,</p>' +
    '<div style="margin:2px 0">' + SIGN_JOY + '</div>' +
    '<p style="margin-top:0"><strong>Joy Ojuma</strong><br>Team Lead<br>For: REALMS Healthcare Services Consulting Limited</p>' +
    '<p class="muted">Issued in support of the HEFAMAA regulatory mandate. This letter is not legal advice.</p>'
}

function buildHefamaaDoc(v, origin) {
  const date = (v.arrival_time || v.created_at || '').slice(0, 10)
  const hef = (v.monitoring && v.monitoring.hefamaa) || {}
  const body = HEFAMAA_FORM.map(sec => {
    const rows = sec.fields.filter(f => { const val = hef[f[0]]; return Array.isArray(val) ? val.length : (val != null && val !== '') }).map(f => '<tr><td>' + f[1] + '</td><td>' + (Array.isArray(hef[f[0]]) ? hef[f[0]].join(', ') : String(hef[f[0]])) + '</td></tr>').join('')
    return '<h3>' + sec.title + '</h3>' + (rows ? '<table>' + rows + '</table>' : '<p class="muted">Not completed.</p>')
  }).join('')
  return docHead(origin) + '<h1>HEFAMAA Facility Inspection Form</h1><p><strong>Facility:</strong> ' + v.facility_name + ' &middot; <strong>Area:</strong> ' + (v.area || '') + ' &middot; <strong>Date:</strong> ' + date + '</p>' + body + '<p class="muted">Digitised Lagos HEFAMAA Facility Inspection Tool (Primary Health Care). Prepared by REALMS Healthcare Services Consulting Limited.</p>'
}
function SignaturePad({ value, onChange }) {
  const ref = useRef(null); const drawing = useRef(false); const last = useRef(null)
  useEffect(() => { const c = ref.current; if (!c) return; const ctx = c.getContext('2d'); ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.strokeStyle = '#241536' }, [])
  function pos(e) { const c = ref.current; const r = c.getBoundingClientRect(); const t = e.touches ? e.touches[0] : e; return { x: (t.clientX - r.left) * (c.width / r.width), y: (t.clientY - r.top) * (c.height / r.height) } }
  function start(e) { e.preventDefault(); drawing.current = true; last.current = pos(e) }
  function move(e) { if (!drawing.current) return; e.preventDefault(); const p = pos(e); const ctx = ref.current.getContext('2d'); ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last.current = p }
  function end() { if (!drawing.current) return; drawing.current = false; onChange(ref.current.toDataURL('image/png')) }
  function clear() { const c = ref.current; c.getContext('2d').clearRect(0, 0, c.width, c.height); onChange('') }
  return (<div className="sigwrap"><canvas ref={ref} width="600" height="170" className="sigpad" onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end} onTouchStart={start} onTouchMove={move} onTouchEnd={end} /><button type="button" className="mini" onClick={clear}>Clear signature</button></div>)
}

function DebriefPage({ userId, facilities }) {
  const [visits, setVisits] = useState([])
  const [active, setActive] = useState(null)
  const [strengths, setStrengths] = useState([])
  const [gaps, setGaps] = useState([])
  const [deadline, setDeadline] = useState('')
  const [reinspection, setReinspection] = useState('2 weeks')
  const [letterIssued, setLetterIssued] = useState(true)
  const [propName, setPropName] = useState('')
  const [ack, setAck] = useState(false)
  const [signature, setSignature] = useState('')
  const [genesys, setGenesys] = useState(false)
  const [genesysNote, setGenesysNote] = useState('')
  const [closure, setClosure] = useState(false)
  const [escalate, setEscalate] = useState(false)
  const [narrative, setNarrative] = useState('')
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(''); const [saveState, setSaveState] = useState('')
  const [q, setQ] = useState('')

  useEffect(() => { VIS.list().then(setVisits).catch(() => {}) }, [])
  useEffect(() => { const on = () => setOnline(true), off = () => setOnline(false); window.addEventListener('online', on); window.addEventListener('offline', off); return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) } }, [])
  // Keep an on-device draft so leaving the page, or a refresh, never loses field work.
  useEffect(() => {
    if (!active) return
    const d = { strengths, gaps, deadline, reinspection, letterIssued, propName, ack, signature, genesys, genesysNote, closure, escalate, narrative, at: new Date().toISOString() }
    draftSet('realms_debrief_' + active.id, d, { ...d, signature: '' })
  }, [active, strengths, gaps, deadline, reinspection, letterIssued, propName, ack, signature, genesys, genesysNote, closure, escalate, narrative])

  function open(v) {
    setActive(v); setMsg(''); setSaveState('')
    const existing = v.debrief
    if (existing) {
      setStrengths(existing.strengths || []); setGaps(existing.gaps || []); setDeadline(existing.remediation_deadline || '')
      setReinspection(existing.reinspection || '2 weeks'); setLetterIssued(existing.letter_issued !== false)
      setPropName(existing.proprietor_name || (v.person_in_charge && v.person_in_charge.name) || ''); setAck(!!existing.proprietor_ack); setSignature(existing.signature || '')
      setGenesys(!!existing.genesys_interest); setGenesysNote(existing.genesys_note || ''); setClosure(!!existing.closure_recommended); setEscalate(!!existing.escalated); setNarrative(existing.narrative || '')
    } else {
      const d = deriveDebrief(v); setStrengths(d.strengths); setGaps(d.gaps); setDeadline(''); setReinspection(getSettings().default_reinspection || '2 weeks'); setLetterIssued(true)
      setPropName((v.person_in_charge && v.person_in_charge.name) || ''); setAck(false); setSignature('')
      setGenesys(false); setGenesysNote(''); setClosure(false); setEscalate(false); setNarrative('')
    }
    // An unsaved draft on this device wins: it is the most recent work.
    try {
      const raw = localStorage.getItem('realms_debrief_' + v.id)
      if (raw) {
        const p = JSON.parse(raw)
        if (p && typeof p === 'object') {
          if (Array.isArray(p.strengths)) setStrengths(p.strengths)
          if (Array.isArray(p.gaps)) setGaps(p.gaps)
          if (p.deadline != null) setDeadline(p.deadline)
          if (p.reinspection) setReinspection(p.reinspection)
          if (p.letterIssued != null) setLetterIssued(p.letterIssued)
          if (p.propName != null) setPropName(p.propName)
          if (p.ack != null) setAck(p.ack)
          if (p.signature != null) setSignature(p.signature)
          if (p.genesys != null) setGenesys(p.genesys)
          if (p.genesysNote != null) setGenesysNote(p.genesysNote)
          if (p.closure != null) setClosure(p.closure)
          if (p.escalate != null) setEscalate(p.escalate)
          if (p.narrative != null) setNarrative(p.narrative)
          setSaveState('draft'); toast('Unsaved work restored on this device.')
        }
      }
    } catch (e) {}
  }
  function setGap(i, patch) { setGaps(gs => gs.map((g, x) => x === i ? { ...g, ...patch } : g)); setSaveState('draft') }

  function payload() { return { strengths, gaps, remediation_deadline: deadline, reinspection, letter_issued: letterIssued, proprietor_name: propName.trim(), proprietor_ack: ack, signature, signed_at: signature ? new Date().toISOString() : '', genesys_interest: genesys, genesys_note: genesysNote.trim(), closure_recommended: closure, escalated: escalate, narrative: narrative.trim(), updatedAt: new Date().toISOString() } }
  function findingsText() {
    const g = gaps.map(x => '- ' + (x.category ? x.category + ': ' : '') + (x.label || '')).join('\n')
    const s = strengths.map(x => '- ' + (x.label || x)).join('\n')
    return 'Facility: ' + (active ? active.facility_name : '') + ' (' + (active ? active.area : '') + '). Overall: ' + ragText(active && active.overall_rating) + (active && active.score != null ? ' ' + active.score + '%' : '') + '.\nStrengths:\n' + (s || '- none noted') + '\nGaps:\n' + (g || '- none noted')
  }

  async function save() {
    if (!active) return
    if (!ack) { setMsg('Confirm the proprietor acknowledgement to complete the debrief.'); return }
    setBusy(true); setMsg('')
    const d = payload(); const firstClose = active.status !== 'debriefed'
    try {
      await VIS.update(active.id, { debrief: d, status: 'debriefed' })
      try { localStorage.removeItem('realms_debrief_' + active.id) } catch (e) {}
      setSaveState('saved'); setMsg('Debrief saved.'); toast('Debrief saved.')
      setVisits(vs => vs.map(v => v.id === active.id ? { ...v, debrief: d, status: 'debriefed' } : v))
      if (firstClose) {
        try {
          await NOTIF.add({ type: 'visit_completed', visit_id: active.id, facility_name: active.facility_name, area: active.area, channel: 'customer_service', status: 'pending', message: 'Visit completed at ' + active.facility_name + ' (' + (active.area || '') + '). Customer service to call the facility to hear how the visit went.' }, userId)
        } catch (e) {}
        const cs = getSettings(); const csMsg = 'RHSC: monitoring completed at ' + active.facility_name + '. Please call the facility to follow up.'
        // The facility hears from us directly, so a demand for money has somewhere to go.
        const fac = (facilities || []).find(f => f.id === active.facility_id || f.name === active.facility_name)
        const encPhone = (active.person_in_charge && active.person_in_charge.phone) || ''
        const facNum = (fac && fac.phone) || encPhone
        // a number captured at the visit sticks to the facility, so follow-ups can dial it later
        if (fac && !fac.phone && encPhone) { try { await FAC.update(fac.id, { phone: encPhone }) } catch (e) {} }
        if (facNum) {
          const fm = 'RHSC/HEFAMAA: your facility was monitored today. This visit is free of charge and our officers must never request money, gifts or favours. If anything was asked of you, report it in confidence to ' + CONTACT.phone + '.'
          try { sendNotify({ channel: 'sms', to: facNum, message: fm }) } catch (e) {}
          try { sendNotify({ channel: 'whatsapp', to: facNum, message: fm }) } catch (e) {}
          try { await NOTIF.add({ type: 'integrity_notice', visit_id: active.id, facility_name: active.facility_name, area: active.area, channel: 'sms', status: 'sent', message: fm }, userId) } catch (e) {}
        }
        if (cs.cs_email) { try { sendNotify({ channel: 'email', to: cs.cs_email, subject: 'Visit completed: ' + active.facility_name, message: csMsg }) } catch (e) {} }
        if (cs.cs_phone) { try { sendNotify({ channel: 'sms', to: cs.cs_phone, message: csMsg }) } catch (e) {} }
        if (cs.cs_whatsapp) { try { sendNotify({ channel: 'whatsapp', to: cs.cs_whatsapp, message: csMsg }) } catch (e) {} }
      }
    } catch (e) { setSaveState('pending'); setMsg('Saved locally. It will sync when you are back online; use Sync now to retry.') }
    finally { setBusy(false) }
  }
  const origin = (typeof window !== 'undefined' && window.location) ? window.location.origin : ''

  if (!active) {
    const ready = visits.filter(v => (v.status === 'monitored' || (v.status === 'debriefed' && !(v.debrief && v.debrief.first_visit))) && matchQ(v, q))
    const anyReady = visits.some(v => v.status === 'monitored' || (v.status === 'debriefed' && !(v.debrief && v.debrief.first_visit)))
    return (<div className="page">
      <div className="ptitle"><div><p className="eyebrow">Debrief</p><h2>Close out visits</h2></div><span className={'net ' + (online ? 'on' : 'off')}>{online ? 'Online' : 'Offline'}</span></div>
      {anyReady && <div className="list-tools"><SearchBox value={q} onChange={setQ} placeholder="Search facilities…" /></div>}
      {ready.length === 0 ? <p className="empty">{anyReady ? 'No visits match your search.' : 'No assessed visits yet. Complete a Monitor assessment first.'}</p> :
        <div className="mon-list">{ready.map(v => (
          <button className="mon-row" key={v.id} onClick={() => open(v)}>
            <div><span className="fname">{v.facility_name}</span><span className="fmeta">{v.area} &middot; {(v.arrival_time || v.created_at || '').slice(0, 10)}</span></div>
            <div className="mon-right"><Chip rag={v.overall_rating} pct={v.score} /><span className={'chip ' + (v.status === 'debriefed' ? 'green' : 'monitored')}>{v.status === 'debriefed' ? 'Debriefed' : 'To debrief'}</span></div>
          </button>
        ))}</div>}
    </div>)
  }

  return (<div className="page debrief">
    <div className="mon-head">
      <div className="mon-head-l"><button className="linkbtn subtle" onClick={() => setActive(null)}>&larr; All visits</button><h2>{active.facility_name}</h2><p className="fsub">{active.area} &middot; {(active.arrival_time || '').slice(0, 10)}</p></div>
      <div className="mon-head-r"><span className={'net ' + (online ? 'on' : 'off')}>{online ? 'Online' : 'Offline'}</span><Chip rag={active.overall_rating} pct={active.score} /></div>
    </div>
    {msg && <p className="auth-msg block">{msg}</p>}

    <div className="dsec"><h3>Strengths</h3>
      {strengths.length ? <ul className="dstr">{strengths.map((s, i) => <li key={i}>{s}</li>)}</ul> : <p className="empty sm">No green-rated items.</p>}
    </div>

    <div className="dsec"><h3>Gaps and corrective actions</h3>
      {gaps.length === 0 ? <p className="empty sm">No amber or red items. Nothing to correct.</p> : gaps.map((g, i) => (
        <div className="gap" key={g.key}>
          <div className="gap-top"><span className="gap-label">{g.category}: {g.label}</span><span className={'chip ' + chipCls(g.rating)}>{ragText(g.rating)}</span></div>
          <div className="fgrid two">
            <label className="field sm"><span>Required action</span><input value={g.action} onChange={e => setGap(i, { action: e.target.value })} /></label>
            <label className="field sm"><span>Timeline</span><input value={g.timeline} onChange={e => setGap(i, { timeline: e.target.value })} placeholder="e.g. 2 weeks" /></label>
          </div>
        </div>
      ))}
    </div>

    <div className="dsec"><h3>Next steps</h3>
      <div className="fgrid">
        <label className="field sm"><span>Remediation deadline</span><input type="date" value={deadline} onChange={e => { setDeadline(e.target.value); setSaveState('draft') }} /></label>
        <label className="field sm"><span>Re-inspection within</span><select value={reinspection} onChange={e => { setReinspection(e.target.value); setSaveState('draft') }}>{REINSPECT.map(r => <option key={r} value={r}>{r}</option>)}</select></label>
        <label className="field sm chkfield"><span>Compliance letter</span><label className="inl"><input type="checkbox" checked={letterIssued} onChange={e => { setLetterIssued(e.target.checked); setSaveState('draft') }} /> Issue letter</label></label>
      </div>
    </div>

    <div className="dsec"><h3>AI recommendations</h3>
      <div className="ai-row">
        <AIButton label="Draft report narrative" build={() => ({ system: 'You are a HEFAMAA facility-monitoring officer at RHSC writing the narrative summary of a monitoring visit. Write 2 short paragraphs in professional British English: what was observed and the required improvements. Factual, non-alarmist, no invented details.', prompt: findingsText(), max_tokens: 500 })} onText={txt => { setNarrative(txt); setSaveState('draft') }} />
        <AIButton label="Suggest corrective actions" build={() => ({ system: 'You are a HEFAMAA monitoring officer. From the gaps, list specific, practical corrective actions with realistic timelines as short bullet points. Only actions grounded in the gaps provided.', prompt: findingsText(), max_tokens: 500 })} onText={txt => { setNarrative(n => (n ? n + '\n\nCorrective actions:\n' : 'Corrective actions:\n') + txt); setSaveState('draft') }} />
      </div>
      <label className="field sm"><span>Narrative &amp; recommendations (editable, included in the report)</span><textarea rows="5" value={narrative} onChange={e => { setNarrative(e.target.value); setSaveState('draft') }} placeholder="Draft with AI, or write your own. Always review before issuing." /></label>
    </div>

    <div className="dsec"><h3>Regulatory action</h3>
      <div className="fgrid">
        <label className="field sm chkfield"><span>Closure notice</span><label className="inl"><input type="checkbox" checked={closure} onChange={e => { setClosure(e.target.checked); setSaveState('draft') }} /> Recommend closure</label></label>
        <label className="field sm chkfield"><span>Escalation</span><label className="inl"><input type="checkbox" checked={escalate} onChange={e => { setEscalate(e.target.checked); setSaveState('draft') }} /> Escalate critical finding</label></label>
      </div>
      <p className="hintline">Closure applies where a facility operates without registration, with an expired licence, without HEFAMAA signage, or without qualified personnel on duty.</p>
    </div>

    <div className="dsec"><h3>Digital health</h3>
      <label className="field sm chkfield"><span>Genesys EMR</span><label className="inl"><input type="checkbox" checked={genesys} onChange={e => { setGenesys(e.target.checked); setSaveState('draft') }} /> Facility interested in the Genesys EMR</label></label>
      {genesys && <label className="field sm"><span>Notes</span><input value={genesysNote} onChange={e => { setGenesysNote(e.target.value); setSaveState('draft') }} placeholder="Contact, timing, systems in use" /></label>}
    </div>

    <div className="dsec"><h3>Proprietor sign-off</h3>
      <div className="fgrid two">
        <label className="field sm"><span>Person in charge</span><input value={propName} onChange={e => { setPropName(e.target.value); setSaveState('draft') }} /></label>
        <label className="field sm chkfield"><span>Acknowledgement</span><label className="inl"><input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} /> Findings acknowledged</label></label>
      </div>
      <p className="pick-label">Signature</p>
      <SignaturePad value={signature} onChange={s => { setSignature(s); setSaveState('draft') }} />
    </div>

    <div className="mon-actions">
      <button className="btn primary" onClick={save} disabled={busy}>{busy ? 'Saving\u2026' : 'Save debrief'}</button>
      {saveState === 'pending' && <button className="btn ghost" onClick={save}>Sync now</button>}
      <button className="btn ghost" onClick={() => printDoc('Monitoring Report', buildReport(active, payload(), origin))}>Monitoring report</button>
      <button className="btn primary" onClick={() => printDoc('HEFAMAA Inspection Report', buildInspectionReport(active, payload(), origin))}>Inspection report</button>
      <button className="btn ghost" onClick={() => printDoc('HEFAMAA Form', buildHefamaaDoc(active, origin))}>HEFAMAA form</button>
      {letterIssued && <button className="btn ghost" onClick={() => printDoc('Compliance Letter', buildLetter(active, payload(), origin))}>Corrective letter</button>}
      {closure && <button className="btn ghost" onClick={() => printDoc('Closure Notice', buildClosure(active, payload(), origin))}>Closure notice</button>}
      <span className="save-note">{saveState === 'saved' ? 'Saved' : saveState === 'pending' ? 'Pending sync' : ''}</span>
    </div>
    <p className="hintline">Reports open in a new tab; use your browser's Print or Save as PDF. Human review before issue is expected.</p>
  </div>)
}

/* ---------- proprietor view ---------- */
function ProprietorPage({ facilityId, facilities }) {
  const [visits, setVisits] = useState([])
  const [q, setQ] = useState('')
  useEffect(() => { VIS.list().then(setVisits).catch(() => {}) }, [])
  const origin = (typeof window !== 'undefined' && window.location) ? window.location.origin : ''
  const mineFac = (facilities || []).find(f => f.id === facilityId)
  const all = visits.filter(v => (v.status === 'monitored' || v.status === 'debriefed') && (!facilityId || v.facility_id === facilityId || (mineFac && v.facility_name === mineFac.name)))
  const mine = all.filter(v => matchQ(v, q))
  return (<div className="page">
    <div className="ptitle"><div><p className="eyebrow">My facility</p><h2>{mineFac ? mineFac.name : 'Monitoring outcomes'}</h2></div></div>
    <p className="page-lede">Your latest monitoring outcomes, the corrective actions required, and re-inspection timelines.</p>
    {all.length > 0 && <div className="list-tools"><SearchBox value={q} onChange={setQ} placeholder="Search facilities…" /></div>}
    {mine.length === 0 ? <p className="empty">{all.length === 0 ? 'No monitoring visits recorded yet.' : 'No visits match your search.'}</p> :
      <div className="prop-list">{mine.map(v => {
        const d = v.debrief || deriveDebrief(v); const gaps = d.gaps || []
        return (<div className="prop-card" key={v.id}>
          <div className="prop-head"><div><span className="fname">{v.facility_name}</span><span className="fmeta">{v.area} &middot; {(v.arrival_time || v.created_at || '').slice(0, 10)}</span></div><Chip rag={v.overall_rating} pct={v.score} /></div>
          <div className="prop-sec"><h4>Corrective actions</h4>
            {gaps.length === 0 ? <p className="muted sm">No corrective actions outstanding. Well done.</p> :
              <ul className="corr">{gaps.map((g, i) => (<li key={i}><span className="corr-item">{(g.category ? g.category + ': ' : '') + (typeof g.label === 'string' ? g.label : '')}</span>{g.action ? <em> {g.action}</em> : null}{g.timeline ? <span className="corr-tl">{g.timeline}</span> : null}</li>))}</ul>}
          </div>
          {(d.remediation_deadline || d.reinspection) && <div className="prop-sec"><h4>Re-inspection</h4><p className="muted sm">{d.remediation_deadline ? 'Corrective actions due by ' + d.remediation_deadline + '. ' : ''}{d.reinspection ? 'A re-inspection is scheduled within ' + d.reinspection + '.' : ''}</p></div>}
          <div className="prop-actions"><button className="mini" onClick={() => printDoc('Monitoring Report', buildReport(v, d, origin))}>View full report</button></div>
        </div>)
      })}</div>}
    <p className="hintline">{facilityId ? 'This view is limited to your facility.' : 'No facility is linked to your account yet. Contact RHSC.'}</p>
  </div>)
}

/* ---------- customer service follow-ups ---------- */
function fuDaysSince(d) { if (!d) return null; const t = new Date((d.length > 10 ? d.slice(0, 10) : d) + 'T00:00:00').getTime(); if (isNaN(t)) return null; return Math.max(0, Math.floor((Date.now() - t) / 86400000)) }
function FollowUpsPage({ userId, identity, facilities, onChange }) {
  const [visits, setVisits] = useState([])
  const [notes, setNotes] = useState([])
  const [callLog, setCallLog] = useState([])
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('awaiting')
  const [openId, setOpenId] = useState(null)
  const [form, setForm] = useState({ outcome: 'Reached', notes: '', caller: '', integrity: 'Not asked' })
  const [busy, setBusy] = useState(false)
  const [briefs, setBriefs] = useState({})
  const [showLog, setShowLog] = useState(false)
  const [logTab, setLogTab] = useState('calls')
  const [copied, setCopied] = useState('')
  async function refresh() {
    try { setVisits(await VIS.list()) } catch (e) {}
    try { setNotes(await NOTIF.list()) } catch (e) {}
    try { setCallLog(await CALLS.list()) } catch (e) {}
  }
  useEffect(() => { refresh() }, [])

  const phoneMap = {}
  ;(facilities || []).forEach(f => { if (!f) return; if (f.id) phoneMap['id:' + f.id] = f.phone || ''; if (f.name) phoneMap['n:' + f.name.toLowerCase()] = f.phone || '' })
  const facPhone = v => phoneMap['id:' + v.facility_id] || phoneMap['n:' + (v.facility_name || '').toLowerCase()] || (v.person_in_charge && v.person_in_charge.phone) || ''
  const telHref = n => 'tel:' + String(n).replace(/[^0-9+]/g, '')
  function callsFor(id) { return callLog.filter(c => c.visit_id === id) }
  const completedAt = v => ((v.debrief && v.debrief.updatedAt) || v.visit_date || v.arrival_time || v.created_at || '').slice(0, 10)
  function integrityFlagged(id) { return callsFor(id).some(c => c.integrity === 'Payment or gift was requested') }
  function statusOf(v) {
    const last = callsFor(v.id)[0]
    if (integrityFlagged(v.id)) return 'escalated'
    if (!last) return 'awaiting'
    if (last.outcome === 'Escalated') return 'escalated'
    return 'called'
  }

  // A completed visit needs a follow-up call whether it was a first assessment
  // (Debrief, status 'debriefed') or a return visit (Second Assessment, status 'second').
  const all = visits.filter(v => (v.status === 'debriefed' || v.status === 'second') && !(v.debrief && v.debrief.first_visit))
  const counts = { awaiting: 0, called: 0, escalated: 0, integrity: 0 }
  all.forEach(v => { counts[statusOf(v)]++; if (integrityFlagged(v.id)) counts.integrity++ })
  const prio = { escalated: 0, awaiting: 1, called: 2 }
  const shown = all
    .filter(v => filter === 'all' || statusOf(v) === filter)
    .filter(v => matchQ(v, q))
    .sort((a, b) => { const d = prio[statusOf(a)] - prio[statusOf(b)]; return d !== 0 ? d : (completedAt(a) || '').localeCompare(completedAt(b) || '') })

  function openForm(v) { setOpenId(v.id); setForm({ outcome: 'Reached', notes: '', caller: (identity && identity.name) || '', integrity: 'Not asked' }) }
  function copyNum(n) { try { navigator.clipboard.writeText(n); setCopied(n); setTimeout(() => setCopied(''), 1400) } catch (e) {} }
  async function saveCall(v) {
    setBusy(true)
    try {
      await CALLS.add({ visit_id: v.id, facility_name: v.facility_name, area: v.area, outcome: form.outcome, notes: form.notes.trim(), caller: form.caller.trim(), integrity: form.integrity }, userId)
      if (form.integrity === 'Payment or gift was requested') {
        const m = 'INTEGRITY ALERT: ' + v.facility_name + ' (' + (v.area || '') + ') reports that a payment or gift was requested during monitoring. Logged by ' + (form.caller || 'customer service') + '.'
        try { await NOTIF.add({ type: 'integrity_alert', visit_id: v.id, facility_name: v.facility_name, area: v.area, channel: 'email', status: 'sent', message: m }, userId) } catch (e) {}
        try { sendNotify({ channel: 'email', to: OWNER_EMAIL, subject: 'Integrity alert: ' + v.facility_name, message: m }) } catch (e) {}
        toast('Integrity alert raised with the executive office.', 'warn')
      } else { toast('Call logged.') }
      setOpenId(null); await refresh(); if (onChange) onChange()
    } catch (e) {} finally { setBusy(false) }
  }
  function aiBrief(v) {
    return { system: 'You brief RHSC customer service before they call a facility about a completed monitoring visit. In 3 to 4 sentences summarise the outcome, the key gaps, and what to ask on the call. Use only the data.', prompt: JSON.stringify({ facility: v.facility_name, area: v.area, history: visits.filter(x => x.facility_name === v.facility_name).map(x => ({ date: (x.visit_date || x.arrival_time || x.created_at || '').slice(0, 10), rating: x.overall_rating, score: x.score, status: x.status, gaps: ((x.debrief && x.debrief.gaps) || []).map(g => g.label) })) }), max_tokens: 350 }
  }

  const kpis = [
    { key: 'awaiting', v: counts.awaiting, l: 'Awaiting call', tone: 'amber' },
    { key: 'called', v: counts.called, l: 'Called', tone: 'green' },
    { key: 'escalated', v: counts.escalated, l: 'Escalated', tone: 'red' },
    { key: 'all', v: all.length, l: 'All follow-ups', tone: 'plain' },
  ]

  return (<div className="page">
    <div className="ptitle"><div><p className="eyebrow">Customer service</p><h2>Visit follow-ups</h2></div></div>
    <p className="page-lede">When a monitoring visit is completed, customer service calls the facility to hear how it went — and to give any demand for money somewhere to go. Work the queue below, oldest first.</p>

    {counts.integrity > 0 && <div className="fu-flag"><span className="fu-flag-ic">!</span><div><strong>{counts.integrity} integrity {counts.integrity === 1 ? 'flag' : 'flags'} raised.</strong> A facility reported that money, a gift or a favour was requested during monitoring. These sit at the top of the queue and are escalated to the executive office.</div></div>}

    <div className="fu-kpis">{kpis.map(k => (
      <button key={k.key} className={'fu-kpi ' + k.tone + (filter === k.key ? ' on' : '')} onClick={() => setFilter(k.key)}>
        <span className="fu-kpi-v">{k.v}</span><span className="fu-kpi-l">{k.l}</span>
      </button>))}
    </div>

    <div className="fu-toolbar">
      <div className="fu-segs">{[['awaiting', 'Awaiting'], ['called', 'Called'], ['escalated', 'Escalated'], ['all', 'All']].map(([k, l]) => (
        <button key={k} className={'fu-seg' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}>{l}{k !== 'all' && counts[k] ? <span className="fu-seg-n">{counts[k]}</span> : null}</button>))}
      </div>
      <SearchBox value={q} onChange={setQ} placeholder="Search facilities…" />
    </div>

    {shown.length === 0 ? <p className="empty">{all.length ? 'Nothing in this view — try another filter.' : 'No completed monitoring visits to follow up yet. When a visit is debriefed, it appears here automatically.'}</p> :
      <div className="fu-queue">{shown.map(v => {
        const cs = callsFor(v.id); const last = cs[0]; const st = statusOf(v)
        const phone = facPhone(v); const wait = st === 'awaiting' ? fuDaysSince(completedAt(v)) : null
        const chip = st === 'escalated' ? <span className="chip red">Escalated</span> : st === 'called' ? <span className="chip green">Called &middot; {last.outcome}</span> : <span className="chip amber">Awaiting call</span>
        return (<div className={'fu-card2 ' + st} key={v.id}>
          <div className="fu-c-top">
            <div className="fu-c-id">
              <span className="fname">{v.facility_name}</span>
              <span className="fmeta">{v.area || '\u2014'} &middot; completed {completedAt(v) || '\u2014'}{wait != null ? <span className="fu-wait">{wait === 0 ? 'today' : 'waiting ' + wait + 'd'}</span> : null}</span>
            </div>
            {chip}
          </div>
          <div className="fu-c-actions">
            {phone ? <a className="mini call" href={telHref(phone)}>{'\u260e'} Call</a> : <span className="mini disabled">No number on file</span>}
            {phone && <button className="mini ghost" onClick={() => copyNum(phone)}>{copied === phone ? 'Copied \u2713' : phone}</button>}
            <AIButton className="mini" label="AI briefing" build={() => aiBrief(v)} onText={txt => setBriefs(b => ({ ...b, [v.id]: txt }))} />
            <button className={'mini' + (openId === v.id ? ' on' : '')} onClick={() => openId === v.id ? setOpenId(null) : openForm(v)}>{openId === v.id ? 'Close' : cs.length ? 'Log another call' : 'Log call'}</button>
          </div>
          {briefs[v.id] && <div className="ai-panel"><h4><span className="ai-spark">{'\u2726'}</span> Call briefing</h4><p className="ai-text">{briefs[v.id]}</p></div>}
          {openId === v.id && <div className="fu-form">
            <div className="fgrid two">
              <label className="field sm"><span>Outcome</span><select value={form.outcome} onChange={e => setForm({ ...form, outcome: e.target.value })}>{['Reached', 'No answer', 'Call back', 'Escalated'].map(o => <option key={o}>{o}</option>)}</select></label>
              <label className="field sm"><span>Caller</span><input value={form.caller} onChange={e => setForm({ ...form, caller: e.target.value })} /></label>
            </div>
            <label className="field sm"><span>Was any payment, gift or favour requested by our officer?</span>
              <select value={form.integrity} onChange={e => setForm({ ...form, integrity: e.target.value })}>{['Not asked', 'No, nothing was requested', 'Payment or gift was requested', 'Facility preferred not to say'].map(o => <option key={o}>{o}</option>)}</select>
            </label>
            <label className="field sm"><span>Notes</span><textarea rows="2" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="What did the facility say about the visit?" /></label>
            <button className="btn small primary" onClick={() => saveCall(v)} disabled={busy}>{busy ? 'Saving\u2026' : 'Save call'}</button>
          </div>}
          {cs.length > 0 && <ul className="fu-timeline">{cs.map((c, i) => (<li key={i} className={c.integrity === 'Payment or gift was requested' ? 'flag' : ''}><span className="fu-dot" /><div className="fu-t-body"><span className="fu-t-head"><strong>{c.outcome}</strong><span className="fu-t-when">{(c.created_at || '').slice(0, 16).replace('T', ' ')}{c.caller ? ' \u00b7 ' + c.caller : ''}</span></span>{c.notes ? <span className="fu-t-note">{c.notes}</span> : null}</div></li>))}</ul>}
        </div>)
      })}</div>}

    <button className="fu-logtoggle" onClick={() => setShowLog(s => !s)}>{showLog ? '\u2013 Hide activity log' : '+ Show activity log'}</button>
    {showLog && <div className="fu-logwrap">
      <div className="fu-segs sm">{[['calls', 'Call log'], ['notes', 'Notifications']].map(([k, l]) => (<button key={k} className={'fu-seg' + (logTab === k ? ' on' : '')} onClick={() => setLogTab(k)}>{l}</button>))}</div>
      {logTab === 'calls' ? (callLog.length === 0 ? <p className="empty sm">No calls logged yet.</p> :
        <ul className="log-list">{callLog.slice(0, 50).map((c, i) => (<li key={i}><span className="log-when">{(c.created_at || '').slice(0, 16).replace('T', ' ')}</span><span className="log-msg">{c.facility_name} &middot; {c.outcome}{c.caller ? ' \u00b7 ' + c.caller : ''}{c.notes ? ' \u2014 ' + c.notes : ''}</span></li>))}</ul>)
        : (notes.length === 0 ? <p className="empty sm">No notifications yet.</p> :
        <ul className="log-list">{notes.slice(0, 50).map((n, i) => (<li key={i}><span className="log-when">{(n.created_at || '').slice(0, 16).replace('T', ' ')}</span><span className="log-msg">{n.message || (n.type + ' ' + (n.facility_name || ''))}</span></li>))}</ul>)}
    </div>}
  </div>)
}

/* ---------- re-inspection reminders ---------- */
function reminderStage(days) { return days == null ? null : days < 0 ? 'overdue' : days === 0 ? 'due' : days <= 7 ? 't7' : null }
async function runReminders(visits, facilities, userId, opts) {
  const st = getSettings()
  const sent = []
  let logged = []
  try { logged = await NOTIF.list() } catch (e) {}
  const already = {}
  logged.forEach(n => { if (n.type === 'reminder' && n.visit_id) already[n.visit_id + ':' + (n.stage || '')] = true })
  for (const v of visits) {
    const d = v.debrief && v.debrief.remediation_deadline
    if (!d) continue
    const stage = reminderStage(daysUntil(d))
    if (!stage) continue
    const key = v.id + ':' + stage
    if (already[key]) continue
    const label = stage === 'overdue' ? 'is OVERDUE' : stage === 'due' ? 'is due today' : 'is due within 7 days'
    const msg = 'RHSC reminder: corrective actions at ' + v.facility_name + ' (' + (v.area || '') + ') ' + label + '. Deadline ' + d + '.'
    try { await NOTIF.add({ type: 'reminder', stage, visit_id: v.id, facility_name: v.facility_name, area: v.area, channel: 'in-app', status: 'sent', message: msg }, userId) } catch (e) { continue }
    if (st.lead_email) { try { sendNotify({ channel: 'email', to: st.lead_email, subject: 'Re-inspection ' + stage, message: msg }) } catch (e) {} }
    if (st.cs_email) { try { sendNotify({ channel: 'email', to: st.cs_email, subject: 'Re-inspection ' + stage, message: msg }) } catch (e) {} }
    if (st.lead_phone) { try { sendNotify({ channel: 'sms', to: st.lead_phone, message: msg }) } catch (e) {} }
    if (st.cs_whatsapp) { try { sendNotify({ channel: 'whatsapp', to: st.cs_whatsapp, message: msg }) } catch (e) {} }
    if (st.notify_facility) {
      const f = (facilities || []).find(x => x.id === v.facility_id || x.name === v.facility_name)
      if (f && f.phone) {
        const fm = 'RHSC/HEFAMAA: the corrective actions agreed at ' + v.facility_name + ' ' + label + ' (deadline ' + d + '). Please contact RHSC on ' + (st.cs_phone || CONTACT.email) + '.'
        try { sendNotify({ channel: 'sms', to: f.phone, message: fm }) } catch (e) {}
        if (st.cs_whatsapp) { try { sendNotify({ channel: 'whatsapp', to: f.phone, message: fm }) } catch (e) {} }
      }
    }
    sent.push({ facility: v.facility_name, stage })
  }
  return sent
}

/* ---------- integrity oversight (HQ) ----------
   RHSC monitors as ONE team, so comparing officers against each other proves
   nothing: everybody is on every visit. And a team that watches itself did not
   stop the last case, because juniors do not report the person leading them.
   So this looks at the VISITS instead, for the marks a hurried or bought visit
   leaves behind, and leans on the two checks that sit outside the team: what the
   facility says, and a random re-inspection. */
function monitorOf(v) { return (v.team && v.team[0] && v.team[0].name) || 'Unknown' }
function minutesOnSite(v) {
  const a = v.arrival_time ? new Date(v.arrival_time).getTime() : 0
  const d = (v.debrief && v.debrief.updatedAt) ? new Date(v.debrief.updatedAt).getTime() : ((v.monitoring && v.monitoring.updatedAt) ? new Date(v.monitoring.updatedAt).getTime() : 0)
  if (!a || !d || d <= a) return null
  const m = Math.round((d - a) / 60000)
  return m > 0 && m < 600 ? m : null
}
function evidenceCount(v) {
  const items = (v.monitoring && v.monitoring.items) || {}
  let n = 0
  Object.keys(items).forEach(k => { n += ((items[k] && items[k].evidence) || []).length })
  return n
}
function metresBetween(a, b) {
  const R = 6371000, t = Math.PI / 180
  const dLat = (b.lat - a.lat) * t, dLng = (b.lng - a.lng) * t
  const la1 = a.lat * t, la2 = b.lat * t
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(h)))
}
function IntegrityPage({ facilities }) {
  const [visits, setVisits] = useState([])
  const [calls, setCalls] = useState([])
  const [loading, setLoading] = useState(true)
  const [sample, setSample] = useState(null)
  useEffect(() => {
    VIS.list().then(v => { setVisits(v); setLoading(false) }).catch(() => setLoading(false))
    CALLS.list().then(setCalls).catch(() => {})
  }, [])
  const scored = visits.filter(v => !(v.debrief && v.debrief.first_visit) && (v.status === 'monitored' || v.status === 'debriefed'))
  const facById = {}; (facilities || []).forEach(f => { facById[f.id] = f; facById[f.name] = f })

  function checkVisit(v) {
    const f = facById[v.facility_id] || facById[v.facility_name]
    const flags = []
    const mins = minutesOnSite(v)
    const ev = evidenceCount(v)
    if (mins != null && mins < 20) flags.push('In and out in ' + mins + ' min')
    if (!ev) flags.push('No photo evidence')
    if (typeof v.lat !== 'number' || typeof v.lng !== 'number') flags.push('No GPS at check-in')
    else if (f && hasCoords(f) && f.geo_confirmed !== false) {
      const d = metresBetween({ lat: v.lat, lng: v.lng }, { lat: f.lat, lng: f.lng })
      if (d > 800) flags.push('Checked in ' + (d > 1500 ? (d / 1000).toFixed(1) + ' km' : d + ' m') + ' from the facility')
    }
    const gaps = (v.debrief && v.debrief.gaps) || []
    if (v.overall_rating === 'green' && !gaps.length && !ev) flags.push('Passed with nothing recorded')
    return { v, mins, ev, flags }
  }
  const checked = scored.map(checkVisit)
  const flagged = checked.filter(c => c.flags.length).sort((a, b) => b.flags.length - a.flags.length)
  const passRate = scored.length ? Math.round(scored.filter(v => v.overall_rating === 'green').length / scored.length * 100) : null
  const allMins = checked.map(c => c.mins).filter(m => m != null).sort((a, b) => a - b)
  const medMins = allMins.length ? allMins[Math.floor(allMins.length / 2)] : null
  const noEv = scored.length ? Math.round(checked.filter(c => !c.ev).length / scored.length * 100) : 0

  // Who was on the visits that raised a flag. With one team this only sharpens
  // as the roster changes, but it is the record you would want later.
  const present = {}
  flagged.forEach(c => (c.v.team || []).forEach(m => { if (m && m.name) present[m.name] = (present[m.name] || 0) + 1 }))
  const presentRows = Object.keys(present).map(n => ({ name: n, n: present[n] })).sort((a, b) => b.n - a.n)

  const reported = calls.filter(c => c.integrity === 'Payment or gift was requested')
  const askedCount = calls.filter(c => c.integrity && c.integrity !== 'Not asked').length
  const approved = scored.filter(v => v.approval && v.approval.status === 'approved')

  function drawSample() {
    const pool = approved.length ? approved : scored
    if (!pool.length) { toast('No completed visits to sample yet.', 'warn'); return }
    const n = Math.max(1, Math.round(pool.length * 0.05))
    const picked = pool.slice().sort(() => Math.random() - 0.5).slice(0, n)
    setSample(picked)
    toast(n + ' visit' + (n === 1 ? '' : 's') + ' drawn for re-inspection.')
  }

  return (<div className="page">
    <div className="ptitle"><div><p className="eyebrow">Integrity</p><h2>Field conduct</h2></div>
      <div className="ptools"><button className="btn small primary" onClick={drawSample}>Draw re-inspection sample</button></div>
    </div>
    <p className="page-lede">The team monitors together, so the checks that matter come from outside it: what the facility tells us, and visits picked at random to be checked again.</p>

    {reported.length > 0 && (<div className="int-alert">
      <h3>{reported.length} facilit{reported.length === 1 ? 'y has' : 'ies have'} reported a request for payment</h3>
      <ul className="log-list">{reported.map((c, i) => (<li key={i}><span className="log-when">{(c.created_at || '').slice(0, 10)}</span><span className="log-msg"><strong>{c.facility_name}</strong>{c.area ? ' \u00b7 ' + c.area : ''}{c.notes ? ' \u2014 ' + c.notes : ''}</span></li>))}</ul>
    </div>)}

    <div className="mr-stats" style={{ gridTemplateColumns: 'repeat(6,1fr)', marginBottom: 16 }}>
      <div className="mr-stat"><span className="v">{scored.length}</span><span className="l">Monitored</span></div>
      <div className="mr-stat"><span className="v">{passRate == null ? '\u2013' : passRate + '%'}</span><span className="l">Pass rate</span></div>
      <div className="mr-stat"><span className="v">{medMins == null ? '\u2013' : medMins}</span><span className="l">Median min</span></div>
      <div className="mr-stat"><span className="v">{noEv}%</span><span className="l">No photos</span></div>
      <div className="mr-stat"><span className="v">{askedCount}</span><span className="l">Asked</span></div>
      <div className="mr-stat"><span className="v">{reported.length}</span><span className="l">Reported</span></div>
    </div>

    {sample && (<div className="settings-card" style={{ marginBottom: 16 }}>
      <h3>Re-inspect these {sample.length}</h3>
      <p className="hintline">Drawn at random. Send someone who was not on the original visit, ideally from outside the team, and compare what they find.</p>
      <div className="frows">{sample.map(v => (<div className="frow" key={v.id}>
        <div className="fmain"><span className="fname">{v.facility_name}</span><span className="fmeta">{v.area} &middot; visited {(v.arrival_time || '').slice(0, 10)} &middot; rated {ragText(v.overall_rating)}</span></div>
      </div>))}</div>
      <button className="linkbtn subtle" onClick={() => setSample(null)}>Clear</button>
    </div>)}

    <SectionHead eyebrow="Worth a second look" title={flagged.length + ' visit' + (flagged.length === 1 ? '' : 's') + ' raised something'} />
    {loading ? <div className="skeleton skel-row" /> :
      flagged.length === 0 ? <p className="empty">Nothing flagged. This fills up as the August round runs.</p> :
        <div className="rep-rows">{flagged.slice(0, 60).map(c => (
          <div className="rep-row" key={c.v.id}>
            <div className="rep-main"><span className="fname">{c.v.facility_name}</span><span className="fmeta">{c.v.area} &middot; {(c.v.arrival_time || '').slice(0, 10)} &middot; {(c.v.team || []).map(m => m.name).join(', ') || 'team not recorded'}</span></div>
            <div className="rep-mid">{c.v.score != null && <Chip rag={c.v.overall_rating} pct={c.v.score} />}</div>
            <div className="int-flags">{c.flags.map((x, i) => <em key={i}>{x}</em>)}</div>
          </div>))}</div>}
    {flagged.length > 60 && <p className="hintline">Showing the first 60 of {flagged.length}.</p>}

    {presentRows.length > 0 && (<>
      <SectionHead eyebrow="Record" title="Who was present on flagged visits" />
      <div className="hq-table">
        <div className="hq-tr hq-th" style={{ gridTemplateColumns: '2fr 1fr' }}><span>Name</span><span>Flagged visits</span></div>
        {presentRows.map(r => (<div className="hq-tr" key={r.name} style={{ gridTemplateColumns: '2fr 1fr' }}><span className="hq-name">{r.name}</span><span>{r.n}</span></div>))}
      </div>
      <p className="hintline">Everyone attends every visit, so this is a record rather than a comparison. It becomes meaningful as the roster changes.</p>
    </>)}
  </div>)
}

/* ---------- settings (HQ) ---------- */
function SettingsPage({ user, identity, facilities }) {
  const [s, setS] = useState(getSettings())
  const [remBusy, setRemBusy] = useState(false); const [remMsg, setRemMsg] = useState('')
  const [intScan, setIntScan] = useState(null); const [intBusy, setIntBusy] = useState(false); const [intMsg, setIntMsg] = useState('')
  const set = (k, v) => setS(p => ({ ...p, [k]: v }))
  function save() { saveSettings(s); toast('Settings saved.') }
  // Second assessments completed before the notice was wired in never reached the
  // facility. Find those, so the anti-bribery notice can be sent after the fact.
  async function scanIntegrity() {
    setIntBusy(true); setIntMsg(''); setIntScan(null)
    try {
      const [vs, ns] = await Promise.all([VIS.list(), NOTIF.list()])
      const notified = new Set(ns.filter(n => n.type === 'integrity_notice').map(n => n.visit_id).filter(Boolean))
      const notifiedFac = new Set(ns.filter(n => n.type === 'integrity_notice').map(n => (n.facility_name || '').toLowerCase()).filter(Boolean))
      const done = vs.filter(v => (v.status === 'second' || (v.debrief && v.debrief.second_visit)) && !notified.has(v.id))
      const seen = {}; const targets = []
      done.forEach(v => {
        const key = (v.facility_name || '').toLowerCase(); if (!key || seen[key]) return
        if (notifiedFac.has(key)) return
        seen[key] = true
        const fac = (facilities || []).find(f => f.id === v.facility_id || f.name === v.facility_name)
        const phone = (fac && fac.phone) || (v.person_in_charge && v.person_in_charge.phone) || ''
        targets.push({ visit_id: v.id, name: v.facility_name, area: v.area, phone })
      })
      const withPhone = targets.filter(t => t.phone)
      setIntScan({ total: targets.length, withPhone: withPhone.length, list: withPhone })
      setIntMsg(targets.length === 0
        ? 'Every completed second visit has already had the notice. Nothing to send.'
        : withPhone.length + ' of ' + targets.length + ' can be reached. ' + (targets.length - withPhone.length) + ' have no number on file.')
    } catch (e) { setIntMsg('Could not check the notification log.') } finally { setIntBusy(false) }
  }
  async function sendIntegrity() {
    if (!intScan || !intScan.list.length) return
    setIntBusy(true); let sent = 0
    const fm = 'RHSC/HEFAMAA: your facility was monitored recently. Monitoring is free of charge and our officers must never request money, gifts or favours. If anything was asked of you, report it in confidence to ' + CONTACT.phone + '.'
    for (const t of intScan.list) {
      try { sendNotify({ channel: 'sms', to: t.phone, message: fm }) } catch (e) {}
      try { sendNotify({ channel: 'whatsapp', to: t.phone, message: fm }) } catch (e) {}
      try { await NOTIF.add({ type: 'integrity_notice', visit_id: t.visit_id, facility_name: t.name, area: t.area, channel: 'sms', status: 'sent', message: fm }, user && user.id); sent++ } catch (e) {}
    }
    setIntBusy(false); setIntScan(null)
    setIntMsg(sent + ' notice' + (sent === 1 ? '' : 's') + ' sent and logged. Re-checking will now show nothing outstanding.')
    toast(sent + ' integrity notices sent.')
  }
  async function sendNow() {
    saveSettings(s); setRemBusy(true); setRemMsg('')
    try {
      const vs = await VIS.list()
      const out = await runReminders(vs, facilities, user && user.id)
      setRemMsg(out.length ? out.length + ' reminder' + (out.length === 1 ? '' : 's') + ' sent and logged.' : 'Nothing due. No reminders needed.')
      toast(out.length ? out.length + ' reminders sent.' : 'Nothing due right now.')
    } catch (e) { setRemMsg('Could not send reminders.') } finally { setRemBusy(false) }
  }
  return (<div className="page">
    <div className="ptitle"><div><p className="eyebrow">Settings</p><h2>Customer service & defaults</h2></div></div>
    <div className="settings-card">
      <h3>Customer service contact</h3>
      <p className="hintline">When a visit is completed, customer service is alerted here so they can call the facility. Automated send uses the connected SMS, WhatsApp or email provider.</p>
      <div className="fgrid two">
        <label className="field sm"><span>Email</span><input value={s.cs_email || ''} onChange={e => set('cs_email', e.target.value)} placeholder="care@example.com" /></label>
        <label className="field sm"><span>Phone (SMS)</span><input value={s.cs_phone || ''} onChange={e => set('cs_phone', e.target.value)} placeholder="0803..." /></label>
        <label className="field sm"><span>WhatsApp</span><input value={s.cs_whatsapp || ''} onChange={e => set('cs_whatsapp', e.target.value)} placeholder="234..." /></label>
        <label className="field sm"><span>Default re-inspection window</span><select value={s.default_reinspection || '2 weeks'} onChange={e => set('default_reinspection', e.target.value)}>{REINSPECT.map(r => <option key={r} value={r}>{r}</option>)}</select></label>
      </div>
      <button className="btn primary" onClick={save}>Save settings</button>
    </div>

    <div className="settings-card" style={{ marginTop: 16 }}>
      <h3>Re-inspection reminders</h3>
      <p className="hintline">Sent 7 days before a deadline, on the day, and once overdue. Each reminder goes out only once and is kept in the notification log.</p>
      <div className="fgrid two">
        <label className="field sm"><span>Team Lead email</span><input value={s.lead_email || ''} onChange={e => set('lead_email', e.target.value)} placeholder="solomon@realmsconsulting.com" /></label>
        <label className="field sm"><span>Team Lead phone (SMS)</span><input value={s.lead_phone || ''} onChange={e => set('lead_phone', e.target.value)} placeholder="0803..." /></label>
      </div>
      <label className="ai-check"><input type="checkbox" checked={!!s.notify_facility} onChange={e => set('notify_facility', e.target.checked)} /> Also remind the facility on its registered number</label>
      <div className="cta-row" style={{ marginTop: 12 }}>
        <button className="btn primary" onClick={save}>Save settings</button>
        <button className="btn ghost" onClick={sendNow} disabled={remBusy}>{remBusy ? 'Sending\u2026' : 'Send due reminders now'}</button>
      </div>
      {remMsg && <p className="hintline">{remMsg}</p>}
    </div>

    <div className="settings-card" style={{ marginTop: 16 }}>
      <h3>Integrity notice, catch-up send</h3>
      <p className="hintline">Every completed visit should leave the facility with the notice that monitoring is free and that no officer may request money, a gift or a favour. Second visits completed before this was wired in did not receive it. Check below, then send. Each facility is contacted once and the send is logged, so running this again will find nothing.</p>
      <div className="cta-row">
        <button className="btn ghost" onClick={scanIntegrity} disabled={intBusy}>{intBusy && !intScan ? 'Checking\u2026' : 'Check what is outstanding'}</button>
        {intScan && intScan.withPhone > 0 && <button className="btn primary" onClick={sendIntegrity} disabled={intBusy}>{intBusy ? 'Sending\u2026' : 'Send to ' + intScan.withPhone + ' ' + (intScan.withPhone === 1 ? 'facility' : 'facilities')}</button>}
      </div>
      {intMsg && <p className="hintline">{intMsg}</p>}
      {intScan && intScan.list.length > 0 && <ul className="log-list" style={{ marginTop: 10 }}>{intScan.list.slice(0, 25).map((t, i) => (
        <li key={i}><span className="log-when">{t.phone}</span><span className="log-msg">{t.name}{t.area ? ' \u00b7 ' + t.area : ''}</span></li>
      ))}{intScan.list.length > 25 && <li><span className="log-msg">and {intScan.list.length - 25} more</span></li>}</ul>}
    </div>
    <div className="settings-card" style={{ marginTop: 16 }}>
      <h3>AI translations</h3>
      <p className="hintline">Generate first-draft Yorùbá, Hausa and Igbo for the website strings, to give a native speaker to review before use. Downloads a JSON file.</p>
      <AIButton label="Generate translations" build={() => { const en = {}; Object.keys(TR).forEach(k => { en[k] = TR[k].en }); return { system: 'You are a professional Nigerian translator. Translate the given English UI strings into Yoruba (yo), Hausa (ha) and Igbo (ig). Return ONLY JSON of the form {"yo":{key:translation},"ha":{...},"ig":{...}} using the same keys. Natural, concise, suitable for a professional healthcare firm.', prompt: JSON.stringify(en), max_tokens: 2000 } }} onText={txt => { try { download('realms-translations.json', txt.replace(/```json|```/g, '').trim(), 'application/json'); toast('Translations generated and downloaded for review.') } catch (e) { toast('Could not save the file.', 'warn') } }} />
    </div>
  </div>)
}

/* ---------- HQ access gate ---------- */
function PendingAccess({ kind, user, facilities, identity, onSignOut, onBack }) {
  const isProp = kind === 'facility_proprietor'
  const [sent, setSent] = useState(false)
  const [fid, setFid] = useState(''); const [q, setQ] = useState(''); const [busy, setBusy] = useState(false)
  const matches = q.trim().length < 2 ? [] : (facilities || []).filter(f => matchQ(f, q)).slice(0, 8)
  useEffect(() => { let live = true; if (!isProp) return; (async () => { try { const r = await ACC.mine(user && user.id, 'facility_proprietor'); if (live && r) setSent(true) } catch (e) {} })(); return () => { live = false } }, [isProp])
  async function requestProp() {
    if (!fid) { toast('Find and choose your facility first.', 'warn'); return }
    setBusy(true)
    try {
      const f = (facilities || []).find(x => x.id === fid)
      await ACC.request({ user_id: user.id, email: user.email, name: user.name || '', role: 'facility_proprietor', facility_id: fid, facility_name: f ? f.name : '' })
      setSent(true)
      try { sendNotify({ channel: 'email', to: getSettings().cs_email || CONTACT.email, subject: 'Facility access request', message: (user.name || user.email) + ' has requested proprietor access to ' + (f ? f.name : 'a facility') + ' on Realms Field.' }) } catch (e) {}
    } catch (e) { toast('Could not send that request.', 'err') } finally { setBusy(false) }
  }
  if (isProp && !sent) {
    return (<div className="page role-page">
      <div className="pending-card anim" style={{ textAlign: 'left' }}>
        <h2 style={{ textAlign: 'center' }}>Which facility is yours?</h2>
        <p style={{ textAlign: 'center' }}>Find your facility and request access. RHSC will confirm you before your reports are shown.</p>
        <SearchBox value={q} onChange={v => { setQ(v); setFid('') }} placeholder="Type your facility name" />
        {matches.length > 0 && <div className="frows" style={{ marginTop: 10 }}>{matches.map(f => (
          <button className={'frow pickable' + (fid === f.id ? ' picked' : '')} key={f.id} onClick={() => setFid(f.id)}>
            <div className="fmain"><span className="fname">{f.name}</span><span className="fmeta">{[f.category, f.area].filter(Boolean).join(' \u00b7 ')}</span></div>
            <span className="mini">{fid === f.id ? 'Chosen' : 'Choose'}</span>
          </button>))}</div>}
        {q.trim().length >= 2 && matches.length === 0 && <p className="empty sm">No match. Check the spelling, or contact RHSC.</p>}
        <div className="cta-row center" style={{ marginTop: 16 }}>
          <button className="btn ghost" onClick={onBack}>Back</button>
          <button className="btn primary" onClick={requestProp} disabled={busy || !fid}>{busy ? 'Sending\u2026' : 'Request access'}</button>
        </div>
      </div>
    </div>)
  }
  return (<div className="page role-page">
    <div className="pending-card anim">
      <span className="pending-ic"><Ico name="lock" size={26} /></span>
      <h2>{isProp ? 'Your facility access is awaiting confirmation' : 'Your HQ access is awaiting approval'}</h2>
      <p>{isProp
        ? 'RHSC will confirm that you represent this facility. Once approved you will see your own monitoring reports and corrective actions.'
        : 'RHSC HQ sees every facility, report and setting, so it is granted by the executive office. Your request has gone to ' + OWNER_EMAIL + '.'}</p>
      <p className="hintline">You will be let straight in once it is approved. Sign in again after you hear back.</p>
      <div className="cta-row center">
        <button className="btn ghost" onClick={onBack}>Choose a different role</button>
        <button className="btn primary" onClick={onSignOut}>Sign out</button>
      </div>
    </div>
  </div>)
}
function AccessRequestsPage({ identity, user, onChange }) {
  return (<div className="page">
    <div className="ptitle"><div><p className="eyebrow">Administration</p><h2>Access requests</h2></div></div>
    <p className="page-lede">People asking to join the RHSC workspace or claim a facility. Approve or decline each below — the count in the menu clears as you work through them.</p>
    <AccessPanel identity={identity} user={user} onChange={onChange} bare />
  </div>)
}
function AccessPanel({ identity, user, onChange, bare }) {
  const [rows, setRows] = useState([]); const [busy, setBusy] = useState('')
  async function refresh() { try { const r = await ACC.list(); setRows(r); if (onChange) onChange() } catch (e) {} }
  useEffect(() => { refresh() }, [])
  async function decide(r, status) {
    setBusy(r.id)
    try { await ACC.decide(r.id, status, (identity && identity.name) || 'Executive office'); await refresh(); toast(status === 'approved' ? 'HQ access granted.' : 'Request declined.') }
    catch (e) { toast('Could not save that decision.', 'err') } finally { setBusy('') }
  }
  const pending = rows.filter(r => r.status === 'pending')
  function canDecide(r) { return r.role === 'rhsc_hq' ? isOwner(user) : true }
  return (<div className="settings-card" style={{ marginTop: 16 }}>
    <h3>Access requests</h3>
    <p className="hintline">Only the executive office can admit an RHSC HQ user. Facility proprietors can be confirmed by HQ.</p>
    {rows.length === 0 ? <p className="empty sm">No requests yet.</p> :
      <div className="frows">{rows.map(r => (
        <div className="frow" key={r.id}>
          <div className="fmain"><span className="fname">{r.name || r.email}</span><span className="fmeta">{r.email} &middot; {r.role === 'rhsc_hq' ? 'RHSC HQ' : 'Proprietor' + (r.facility_name ? ', ' + r.facility_name : '')} &middot; {(r.created_at || '').slice(0, 10)}</span></div>
          <div className="factions">
            <span className={'appr-chip ' + (r.status === 'approved' ? 'approved' : r.status === 'denied' ? 'returned' : 'pending')}>{r.status === 'approved' ? 'Approved' : r.status === 'denied' ? 'Declined' : 'Pending'}</span>
            {canDecide(r) && r.status !== 'approved' && <button className="mini ok" onClick={() => decide(r, 'approved')} disabled={busy === r.id}>Approve</button>}
            {canDecide(r) && r.status !== 'denied' && <button className="mini danger" onClick={() => decide(r, 'denied')} disabled={busy === r.id}>Decline</button>}
            {!canDecide(r) && <span className="hintline">Executive office only</span>}
          </div>
        </div>))}</div>}
    {pending.length > 0 && <p className="hintline">{pending.length} awaiting your decision.</p>}
  </div>)
}

/* ---------- approvals (Team Lead sign-off before HEFAMAA) ---------- */
function needsApproval(v) { return (v.status === 'debriefed') || (v.status === 'second') || !!(v.debrief && (v.debrief.first_visit || v.debrief.second_visit)) || !!(v.assessment && v.assessment.ruid) || isSecondVisit(v) }
function approvalState(v) { return (v.approval && v.approval.status) || 'pending' }
function ApprovalsPage({ userId, identity, role }) {
  const [visits, setVisits] = useState([])
  const [q, setQ] = useState(''); const [filter, setFilter] = useState('pending')
  const [busy, setBusy] = useState('')
  const [noteFor, setNoteFor] = useState(null); const [note, setNote] = useState('')
  const origin = (typeof window !== 'undefined' && window.location) ? window.location.origin : ''
  const canApprove = role === 'team_leader' || role === 'rhsc_hq'
  async function refresh() { try { setVisits(await VIS.list()) } catch (e) {} }
  useEffect(() => { refresh() }, [])
  const pool = visits.filter(needsApproval)
  const rows = pool.filter(v => (filter === 'all' || approvalState(v) === filter) && matchQ(v, q))
  const counts = { pending: pool.filter(v => approvalState(v) === 'pending').length, approved: pool.filter(v => approvalState(v) === 'approved').length, returned: pool.filter(v => approvalState(v) === 'returned').length }
  async function decide(v, status) {
    setBusy(v.id)
    const approval = { status, by: (identity && identity.name) || 'Team Lead', at: new Date().toISOString(), note: status === 'returned' ? note.trim() : '' }
    try {
      await VIS.update(v.id, { approval })
      setVisits(vs => vs.map(x => x.id === v.id ? { ...x, approval } : x))
      setNoteFor(null); setNote('')
      toast(status === 'approved' ? 'Report approved for submission.' : 'Returned to the monitor.')
    } catch (e) { toast('Could not save that decision.', 'err') } finally { setBusy('') }
  }
  async function decideAll() {
    const targets = rows.filter(v => approvalState(v) !== 'approved')
    if (!targets.length) { toast('Nothing here to approve.'); return }
    setBusy('all'); let ok = 0
    for (const v of targets) {
      const approval = { status: 'approved', by: (identity && identity.name) || 'Team Lead', at: new Date().toISOString(), note: '' }
      try { await VIS.update(v.id, { approval }); setVisits(vs => vs.map(x => x.id === v.id ? { ...x, approval } : x)); ok++ } catch (e) {}
    }
    setBusy(''); toast('Approved ' + ok + ' report' + (ok === 1 ? '' : 's') + ' for submission.')
  }
  return (<div className="page">
    <div className="ptitle"><div><p className="eyebrow">Approvals</p><h2>{counts.pending} awaiting sign-off</h2></div>
      <div className="ptools">
        <SearchBox value={q} onChange={setQ} placeholder="Search…" />
        <select className="sel" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="pending">Pending ({counts.pending})</option>
          <option value="approved">Approved ({counts.approved})</option>
          <option value="returned">Returned ({counts.returned})</option>
          <option value="all">All</option>
        </select>
        {canApprove && <button className="btn small primary" onClick={decideAll} disabled={busy === 'all'}>{busy === 'all' ? 'Approving…' : 'Approve all shown'}</button>}
      </div>
    </div>
    <p className="page-lede">Every report is signed off by the Team Lead before it goes to HEFAMAA. Only approved reports appear in the weekly submission.</p>
    {rows.length === 0 ? <p className="empty">Nothing here.</p> :
      <div className="rep-rows">{rows.map(v => { const st = approvalState(v); return (
        <div className="rep-row" key={v.id}>
          <div className="rep-main"><span className="fname">{v.facility_name}</span><span className="fmeta">{v.area} &middot; {(v.visit_date || v.arrival_time || v.created_at || '').slice(0, 10)}{v.team && v.team[0] ? ' \u00b7 ' + v.team[0].name : ''}</span></div>
          <div className="rep-mid">
            {v.score != null ? <Chip rag={v.overall_rating} pct={v.score} /> : isSecondVisit(v) ? <span className="appr-chip">Second assessment</span> : hasFirstAssessment(v) && <span className="appr-chip">First assessment</span>}
            <span className={'appr-chip ' + st}>{st === 'approved' ? 'Approved' : st === 'returned' ? 'Returned' : 'Pending'}</span>
            {v.approval && v.approval.by && st !== 'pending' && <span className="fmeta">{v.approval.by}, {(v.approval.at || '').slice(0, 10)}</span>}
          </div>
          <div className="rep-actions">
            <button className="mini" onClick={() => safePrint(hasFirstAssessment(v) && !isSecondVisit(v) ? 'Monitoring Report' : 'Inspection Report', () => hasFirstAssessment(v) && !isSecondVisit(v) ? buildMonitoringReport(v, origin) : buildInspectionReport(v, v.debrief || deriveDebrief(v), origin))}>Review</button>
            {isSecondVisit(v) && <button className="mini" onClick={() => safePrint('Second Assessment Report', () => buildSecondReport(v, origin, visits))}>Comparison</button>}
            {canApprove && st !== 'approved' && <button className="mini ok" onClick={() => decide(v, 'approved')} disabled={busy === v.id}>Approve</button>}
            {canApprove && st !== 'returned' && <button className="mini danger" onClick={() => { setNoteFor(noteFor === v.id ? null : v.id); setNote('') }}>Return</button>}
          </div>
          {noteFor === v.id && <div className="fu-form">
            <label className="field sm"><span>What needs fixing?</span><input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. photo missing on waste segregation" /></label>
            <button className="btn small danger" onClick={() => decide(v, 'returned')} disabled={busy === v.id}>Return to monitor</button>
          </div>}
          {st === 'returned' && v.approval && v.approval.note && <p className="hintline">Returned: {v.approval.note}</p>}
        </div>) })}</div>}
  </div>)
}

/* ---------- reports (Stage 7) & analytics (Stage 8) ---------- */
function download(name, content, type) {
  const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function csvCell(v) { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
function exportVisitsCSV(rows) {
  const header = ['Facility', 'Area', 'Date', 'Status', 'Score', 'Rating', 'Remediation deadline', 'Re-inspection']
  const lines = [header].concat(rows.map(v => [v.facility_name, v.area, (v.arrival_time || v.created_at || '').slice(0, 10), v.status, v.score == null ? '' : v.score, v.overall_rating || '', (v.debrief && v.debrief.remediation_deadline) || '', (v.debrief && v.debrief.reinspection) || '']))
  download('realms-visits.csv', lines.map(l => l.map(csvCell).join(',')).join('\n'), 'text/csv')
}
function xmlCell(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
function exportVisitsXLS(rows) {
  const head = ['Facility', 'Area', 'Date', 'Status', 'Score', 'Rating', 'Remediation deadline', 'Re-inspection']
  const body = rows.map(v => '<tr>' + [v.facility_name, v.area, (v.arrival_time || v.created_at || '').slice(0, 10), v.status, v.score == null ? '' : v.score, v.overall_rating || '', (v.debrief && v.debrief.remediation_deadline) || '', (v.debrief && v.debrief.reinspection) || ''].map(c => '<td>' + xmlCell(c) + '</td>').join('') + '</tr>').join('')
  const html = '<html><head><meta charset="utf-8"></head><body><table border="1"><tr>' + head.map(h => '<th>' + h + '</th>').join('') + '</tr>' + body + '</table></body></html>'
  download('realms-visits.xls', html, 'application/vnd.ms-excel')
}
function exportVisitsPDF(rows, origin) {
  const body = rows.map(v => '<tr><td>' + xmlCell(v.facility_name) + '</td><td>' + xmlCell(v.area) + '</td><td>' + (v.arrival_time || v.created_at || '').slice(0, 10) + '</td><td>' + ragText(v.overall_rating) + '</td><td>' + (v.score == null ? '' : v.score + '%') + '</td></tr>').join('')
  const inner = docHead(origin) + '<h1>Monitoring summary</h1><p class="muted">' + rows.length + ' visit' + (rows.length === 1 ? '' : 's') + '</p><table><tr><th>Facility</th><th>Area</th><th>Date</th><th>Outcome</th><th>Score</th></tr>' + body + '</table>'
  printDoc('Monitoring Summary', inner)
}
function buildDailyPDF(rows, origin) {
  const today = new Date().toISOString().slice(0, 10)
  const todays = rows.filter(v => (v.arrival_time || v.created_at || '').slice(0, 10) === today)
  const byArea = {}; todays.forEach(v => { const a = v.area || 'Unassigned'; byArea[a] = (byArea[a] || 0) + 1 })
  const areaLine = Object.keys(byArea).map(a => a + ' (' + byArea[a] + ')').join(', ') || 'none'
  const body = todays.map(v => '<tr><td>' + xmlCell(v.facility_name) + '</td><td>' + xmlCell(v.area) + '</td><td>' + ragText(v.overall_rating) + '</td><td>' + (v.score == null ? '' : v.score + '%') + '</td></tr>').join('')
  const inner = docHead(origin) + '<h1>Daily monitoring report</h1><p class="muted">' + today + ' &middot; ' + todays.length + ' facility' + (todays.length === 1 ? '' : 'ies') + ' monitored</p><p><strong>By area:</strong> ' + areaLine + '</p><table><tr><th>Facility</th><th>Area</th><th>Outcome</th><th>Score</th></tr>' + body + '</table>'
  printDoc('Daily Report', inner)
}
function waLink(phone, body) { const p = String(phone || '').replace(/[^0-9]/g, ''); return 'https://wa.me/' + p + '?text=' + encodeURIComponent(body) }
function mailtoLink(subject, body, to) { return 'mailto:' + encodeURIComponent(to || '') + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body) }
function smsLink(phone, body) { return 'sms:' + (phone || '') + '?&body=' + encodeURIComponent(body) }
function daysUntil(d) { if (!d) return null; const ms = new Date(d + 'T00:00:00').getTime() - Date.now(); return Math.ceil(ms / 86400000) }

function NotifyPanel({ v, summary }) {
  const [email, setEmail] = useState('')
  const [st, setSt] = useState({})
  const phone = (v.person_in_charge && v.person_in_charge.phone) || ''
  const smsMsg = 'RHSC: monitoring completed at ' + v.facility_name + '. A summary and any required actions will follow.'
  async function send(channel) {
    setSt(s => ({ ...s, [channel]: 'sending' }))
    const payload = channel === 'sms' ? { channel: 'sms', to: phone, message: smsMsg }
      : channel === 'whatsapp' ? { channel: 'whatsapp', to: phone, message: smsMsg }
        : { channel: 'email', to: email, subject: 'RHSC monitoring outcome: ' + v.facility_name, message: summary(v) }
    const r = await sendNotify(payload)
    setSt(s => ({ ...s, [channel]: r.ok ? 'sent' : (r.reason || 'failed') }))
  }
  function lbl(x) { return x === 'sending' ? 'Sending\u2026' : x === 'sent' ? 'Sent' : x ? ('Not sent: ' + x) : '' }
  return (<div className="notify">
    <div className="notify-row">
      <button className="mini" onClick={() => send('sms')} disabled={!phone}>Send SMS</button>
      <a className="mini ghosted" href={smsLink(phone, smsMsg)}>open SMS app</a>
      <span className="nstat">{lbl(st.sms)}</span>
    </div>
    <div className="notify-row">
      <button className="mini" onClick={() => send('whatsapp')} disabled={!phone}>Send WhatsApp</button>
      <a className="mini ghosted" href={waLink(phone, smsMsg)} target="_blank" rel="noreferrer">open WhatsApp</a>
      <span className="nstat">{lbl(st.whatsapp)}</span>
    </div>
    <div className="notify-row">
      <input className="ninput" type="email" placeholder="email address" value={email} onChange={e => setEmail(e.target.value)} />
      <button className="mini" onClick={() => send('email')} disabled={!email}>Send email</button>
      <a className="mini ghosted" href={mailtoLink('RHSC monitoring outcome: ' + v.facility_name, summary(v), email)}>open mail app</a>
      <span className="nstat">{lbl(st.email)}</span>
    </div>
    <span className="hintline">Automated send uses the connected provider; if none is configured, use the open-app links. See the guide.</span>
  </div>)
}

function ReportsPage({ facilities, userId, scope, role }) {
  const [visits, setVisits] = useState([])
  const [area, setArea] = useState('all'); const [status, setStatus] = useState('all')
  const [notifyId, setNotifyId] = useState(null)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [aiSummary, setAiSummary] = useState('')
  const today = new Date(); const weekAgo = new Date(Date.now() - 6 * 86400000)
  const [from, setFrom] = useState(weekAgo.toISOString().slice(0, 10))
  const [to, setTo] = useState(today.toISOString().slice(0, 10))
  useEffect(() => { VIS.list().then(v => { setVisits(v); setLoading(false) }).catch(() => setLoading(false)) }, [])
  const origin = (typeof window !== 'undefined' && window.location) ? window.location.origin : ''
  const readOnly = role === 'rhsc_hq' || role === 'hefamaa_reviewer'
  const scopedVisits = scope && scope !== 'all' ? visits.filter(v => (v.area || 'Unassigned') === scope) : visits
  const areas = Array.from(new Set(scopedVisits.map(v => v.area || 'Unassigned'))).sort()
  const rows = scopedVisits.filter(v => (area === 'all' || (v.area || 'Unassigned') === area) && (status === 'all' || v.status === status) && matchQ(v, q))
  const due = scopedVisits.filter(v => v.debrief && v.debrief.remediation_deadline).map(v => ({ v, date: v.debrief.remediation_deadline, days: daysUntil(v.debrief.remediation_deadline) })).sort((a, b) => (a.date < b.date ? -1 : 1))
  function inRange(v) { const d = (v.visit_date || (v.assessment && v.assessment.date) || v.arrival_time || v.created_at || '').slice(0, 10); return d && d >= from && d <= to }
  const rangePool = scopedVisits.filter(v => needsApproval(v) && inRange(v))
  const batch = rangePool.filter(v => approvalState(v) === 'approved')
  const pendingCount = rangePool.length - batch.length

  function doc(v, kind) { const d = v.debrief || deriveDebrief(v); if (kind === 'report') printDoc('Monitoring Report', buildReport(v, d, origin)); else printDoc('Compliance Letter', buildLetter(v, d, origin)) }
  function summary(v) { return v.facility_name + ' (' + v.area + '): outcome ' + ragText(v.overall_rating) + (v.score != null ? ' ' + v.score + '%' : '') + ', visit ' + (v.arrival_time || v.created_at || '').slice(0, 10) + '.' }

  return (<div className="page">
    <div className="ptitle"><div><p className="eyebrow">Reports{readOnly ? ' \u00b7 view only' : ''}</p><h2>{rows.length} visit{rows.length === 1 ? '' : 's'}</h2></div>
      <div className="ptools">
        <SearchBox value={q} onChange={setQ} placeholder="Search…" />
        <select className="sel" value={area} onChange={e => setArea(e.target.value)}><option value="all">All areas</option>{areas.map(a => <option key={a} value={a}>{a}</option>)}</select>
        <select className="sel" value={status} onChange={e => setStatus(e.target.value)}><option value="all">All statuses</option><option value="engaged">Engaged</option><option value="monitored">Monitored</option><option value="debriefed">Debriefed</option></select>
        <button className="btn small ghost" onClick={() => exportVisitsCSV(rows)}>CSV</button>
        <button className="btn small ghost" onClick={() => exportVisitsXLS(rows)}>Excel</button>
        <button className="btn small ghost" onClick={() => exportVisitsPDF(rows, origin)}>PDF</button>
        <button className="btn small primary" onClick={() => buildDailyPDF(rows, origin)}>Daily report</button>
        <button className="btn small ghost" onClick={() => { const fr = rows.filter(hasFirstAssessment); if (!fr.length) { toast('No first-assessment reports in this view.', 'warn'); return } printDoc('First-assessment monitoring reports', buildMonitoringBatch(fr, origin)) }}>1st-assessment pack</button>
        <AIButton className="btn small ghost" label="AI summary" build={() => { const agg = rows.map(v => ({ facility: v.facility_name, area: v.area, rating: v.overall_rating, score: v.score, status: v.status })); return { system: 'You are the RHSC monitoring analyst. Write a brief executive summary (4 to 6 sentences) of these monitoring results for HEFAMAA leadership: coverage, overall compliance picture, notable areas or facilities needing attention. Use only the data given.', prompt: JSON.stringify(agg), max_tokens: 500 } }} onText={txt => setAiSummary(txt)} />
      </div>
    </div>
    {aiSummary && <div className="ai-panel"><h4><span className="ai-spark">✦</span> AI executive summary</h4><p className="ai-text">{aiSummary}</p><button className="linkbtn subtle" onClick={() => setAiSummary('')}>Dismiss</button></div>}

    <div className="submit-panel">
      <div className="submit-head"><h3>Weekly HEFAMAA submission</h3><span className="hintline">Approved inspection reports only, as one PDF to email to the agency.</span></div>
      <div className="submit-row">
        <label className="field sm inline"><span>From</span><input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label className="field sm inline"><span>To</span><input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
        <span className="chip green">{batch.length} approved</span>
        <button className="btn small primary" onClick={() => { if (!batch.length) { toast('No approved reports in that range.', 'warn'); return } printDoc('HEFAMAA submission ' + from + ' to ' + to, buildWeeklyBatch(batch, origin, from, to)) }}>Build submission PDF</button>
        <a className="btn small ghost" href={mailtoLink('HEFAMAA submission: ' + from + ' to ' + to + ' (Realms Consulting)', 'Dear HEFAMAA,\n\nPlease find attached the inspection reports for ' + from + ' to ' + to + ', covering ' + batch.length + ' facilities monitored by REALMS Healthcare Services Consulting Limited.\n\nKind regards,\nREALMS Healthcare Services Consulting Limited', '')}>Email to HEFAMAA</a>
      </div>
      {pendingCount > 0 && <p className="warnline">{pendingCount} report{pendingCount === 1 ? '' : 's'} in this range still await Team Lead approval and are not included.</p>}
    </div>

    {due.length > 0 && (<div className="dsec"><h3>Re-inspections due</h3>
      <div className="frows">{due.map(({ v, date, days }) => (
        <div className="frow" key={v.id}><div className="fmain"><span className="fname">{v.facility_name}</span><span className="fmeta">{v.area} &middot; due {date}</span></div>
          <span className={'chip ' + (days != null && days < 0 ? 'red' : days != null && days <= 7 ? 'amber' : 'none')}>{days == null ? '' : days < 0 ? Math.abs(days) + ' days overdue' : 'in ' + days + ' days'}</span></div>
      ))}</div>
    </div>)}

    {loading ? <div>{[0, 1, 2, 3].map(i => <div key={i} className="skeleton skel-row" />)}</div> :
      rows.length === 0 ? <p className="empty">No visits match these filters.</p> :
      <div className="rep-rows">{rows.map(v => (
        <div className="rep-row" key={v.id}>
          <div className="rep-main"><span className="fname">{v.facility_name}</span><span className="fmeta">{v.area} &middot; {(v.arrival_time || v.created_at || '').slice(0, 10)}</span></div>
          <div className="rep-mid">{v.score != null ? <Chip rag={v.overall_rating} pct={v.score} /> : <span className={'chip ' + (v.status || 'engaged')}>{v.status === 'monitored' ? 'Assessed' : v.status === 'debriefed' ? 'Debriefed' : 'Engaged'}</span>}{v.debrief && v.debrief.closure_recommended && <span className="risk-badge high">Closure</span>}{v.debrief && v.debrief.escalated && <span className="risk-badge high">Escalated</span>}{v.debrief && v.debrief.genesys_interest && <span className="risk-badge low">Genesys</span>}{needsApproval(v) && <span className={'appr-chip ' + approvalState(v)}>{approvalState(v) === 'approved' ? 'Approved' : approvalState(v) === 'returned' ? 'Returned' : 'Pending'}</span>}</div>
          <div className="rep-actions">
            {isSecondVisit(v) ? <>
              <button className="mini primary" onClick={() => safePrint('Inspection Report', () => buildInspectionReport(v, v.debrief || deriveDebrief(v), origin))}>Inspection (HEFAMAA)</button>
              <button className="mini" onClick={() => safePrint('Second Assessment Report', () => buildSecondReport(v, origin, visits))}>Comparison</button>
            </> : hasFirstAssessment(v) ? <>
              <button className="mini primary" onClick={() => safePrint('Monitoring Report', () => buildMonitoringReport(v, origin))}>Monitoring report</button>
              <button className="mini" onClick={() => safePrint('Inspection Report', () => buildInspectionReport(v, v.debrief || deriveDebrief(v), origin))}>Inspection</button>
            </> : <>
              <button className="mini" onClick={() => safePrint('Monitoring Report', () => buildReport(v, v.debrief || deriveDebrief(v), origin))}>Report</button>
              <button className="mini" onClick={() => safePrint('Compliance Letter', () => buildLetter(v, v.debrief || deriveDebrief(v), origin))}>Letter</button>
              <button className="mini" onClick={() => safePrint('Inspection Report', () => buildInspectionReport(v, v.debrief || deriveDebrief(v), origin))}>Inspection</button>
              <button className="mini" onClick={() => safePrint('HEFAMAA Form', () => buildHefamaaDoc(v, origin))}>HEFAMAA</button>
            </>}
            {!readOnly && <button className="mini" onClick={() => setNotifyId(notifyId === v.id ? null : v.id)}>Notify</button>}
          </div>
          {!readOnly && notifyId === v.id && <NotifyPanel v={v} summary={summary} />}
        </div>
      ))}</div>}
  </div>)
}

function HeatMap({ points }) {
  const ref = useRef(null); const obj = useRef(null); const layer = useRef(null)
  useEffect(() => {
    if (!ref.current || obj.current) return
    const m = L.map(ref.current, { scrollWheelZoom: false }).setView([6.5244, 3.3792], 10)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '\u00a9 OpenStreetMap contributors' }).addTo(m)
    layer.current = L.layerGroup().addTo(m); obj.current = m; setTimeout(() => m.invalidateSize(), 200)
    return () => { m.remove(); obj.current = null }
  }, [])
  useEffect(() => {
    const m = obj.current, lg = layer.current; if (!m || !lg) return
    m.invalidateSize(); lg.clearLayers(); const col = { green: '#2E7D46', amber: '#C77D0A', red: '#B4442E', unscored: '#B9AEC9', none: '#9C86B8' }
    points.forEach(p => { L.circleMarker([p.lat, p.lng], { radius: 9, color: '#fff', weight: 2, fillColor: col[p.rag || 'none'], fillOpacity: .9 }).bindPopup('<strong>' + p.name + '</strong><br>' + (p.rag === 'unscored' ? 'Visited, not scored' : p.rag ? ragText(p.rag) : 'Not assessed')).addTo(lg) })
    if (points.length) { try { m.fitBounds(points.map(p => [p.lat, p.lng]), { padding: [40, 40], maxZoom: 13 }) } catch (e) {} }
  }, [points])
  return <div className="map-frame"><div ref={ref} className="leaflet-holder" /></div>
}

function StatCard({ value, label }) {
  const isNum = typeof value === 'number'
  const num = isNum ? value : (typeof value === 'string' && /^\d+%?$/.test(value) ? parseInt(value, 10) : null)
  const suffix = typeof value === 'string' && value.endsWith('%') ? '%' : ''
  const n = useCountUp(num == null ? 0 : num)
  return (<div className="an-card"><span className="an-v">{num == null ? value : (n + suffix)}</span><span className="an-l">{label}</span></div>)
}
function Donut({ data }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const R = 54, C = 2 * Math.PI * R; let off = 0
  return (<div className="donut">
    <svg viewBox="0 0 140 140" className="donut-svg">
      <circle cx="70" cy="70" r={R} fill="none" stroke="#EDE7F4" strokeWidth="18" />
      {data.map((d, i) => { const dash = d.value / total * C; const el = (<circle key={i} cx="70" cy="70" r={R} fill="none" stroke={d.color} strokeWidth="18" strokeDasharray={dash + ' ' + (C - dash)} strokeDashoffset={-off} transform="rotate(-90 70 70)" />); off += dash; return el })}
      <text x="70" y="67" textAnchor="middle" className="donut-num">{total}</text>
      <text x="70" y="85" textAnchor="middle" className="donut-lab">assessed</text>
    </svg>
    <div className="donut-legend">{data.map((d, i) => (<div key={i} className="dl"><span className="dot" style={{ background: d.color }} />{d.label}<em>{d.value}</em></div>))}</div>
  </div>)
}
function Ring({ pct, label }) {
  const R = 48, C = 2 * Math.PI * R; const dash = (pct == null ? 0 : pct) / 100 * C; const disp = pct == null ? '-' : pct + '%'
  return (<div className="ring">
    <svg viewBox="0 0 120 120" className="ring-svg">
      <circle cx="60" cy="60" r={R} fill="none" stroke="#EDE7F4" strokeWidth="12" />
      <circle cx="60" cy="60" r={R} fill="none" stroke="#6D4B8E" strokeWidth="12" strokeLinecap="round" strokeDasharray={dash + ' ' + (C - dash)} transform="rotate(-90 60 60)" />
      <text x="60" y="58" textAnchor="middle" className="ring-num">{disp}</text>
      <text x="60" y="77" textAnchor="middle" className="ring-lab">green</text>
    </svg>
    <span className="ring-cap">{label}</span>
  </div>)
}
function monthLabel(m) { try { return new Date(m + '-01T00:00:00').toLocaleString('en', { month: 'short' }) } catch (e) { return m } }
function riskLevel(s) { return s >= 4 ? 'High' : s >= 2 ? 'Medium' : 'Low' }
function LineChart({ points }) {
  const W = 560, H = 180, pad = 30
  if (!points.length) return <p className="empty sm">Not enough data yet.</p>
  const max = Math.max(100, ...points.map(p => p.value)); const min = 0; const n = points.length
  const x = i => n === 1 ? W / 2 : pad + i * (W - 2 * pad) / (n - 1)
  const y = v => H - pad - (v - min) / (max - min) * (H - 2 * pad)
  const d = points.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.value).toFixed(1)).join(' ')
  const area = d + ' L' + x(n - 1).toFixed(1) + ' ' + (H - pad) + ' L' + x(0).toFixed(1) + ' ' + (H - pad) + ' Z'
  return (<svg viewBox={'0 0 ' + W + ' ' + H} className="line-chart">
    <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="#EDE7F4" />
    <path d={area} fill="#6D4B8E" opacity="0.08" />
    <path d={d} fill="none" stroke="#6D4B8E" strokeWidth="2.5" strokeLinejoin="round" />
    {points.map((p, i) => (<g key={i}><circle cx={x(i)} cy={y(p.value)} r="4" fill="#6D4B8E" /><text x={x(i)} y={H - pad + 16} textAnchor="middle" className="lc-x">{p.label}</text><text x={x(i)} y={y(p.value) - 10} textAnchor="middle" className="lc-v">{p.value}</text></g>))}
  </svg>)
}
function CountVal({ n }) { const v = useCountUp(typeof n === 'number' ? n : 0); return <>{typeof n === 'number' ? v : (n == null ? '\u2013' : n)}</> }
function DonutInteractive({ data, active, onPick }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1; const R = 54, C = 2 * Math.PI * R; let off = 0
  return (<div className="donut">
    <svg viewBox="0 0 140 140" className="donut-svg">
      <circle cx="70" cy="70" r={R} fill="none" stroke="#EDE7F4" strokeWidth="18" />
      {data.map((d, i) => { const dash = d.value / total * C; const dim = active !== 'all' && active !== d.key; const el = (<circle key={i} cx="70" cy="70" r={R} fill="none" stroke={d.color} strokeWidth={active === d.key ? 22 : 18} strokeDasharray={dash + ' ' + (C - dash)} strokeDashoffset={-off} transform="rotate(-90 70 70)" opacity={dim ? 0.28 : 1} style={{ cursor: 'pointer', transition: '.2s' }} onClick={() => onPick(d.key)} />); off += dash; return el })}
      <text x="70" y="67" textAnchor="middle" className="donut-num">{total}</text>
      <text x="70" y="85" textAnchor="middle" className="donut-lab">assessed</text>
    </svg>
    <div className="donut-legend">{data.map((d, i) => (<button key={i} className={'dl' + (active === d.key ? ' on' : '')} onClick={() => onPick(d.key)}><span className="dot" style={{ background: d.color }} />{d.label}<em>{d.value}</em></button>))}</div>
  </div>)
}
function AnalyticsBody({ facilities, onOpen, role }) {
  const [visits, setVisits] = useState([])
  const [calls, setCalls] = useState([])
  const [access, setAccess] = useState([])
  const [ragF, setRagF] = useState('all')
  const [areaF, setAreaF] = useState('all')
  const [range, setRange] = useState('all')
  const [q, setQ] = useState('')
  // The figures below are computed from visits. Until that query returns we must not
  // show 0, because 0 would look like real data. Track the load so the dashboard can
  // say "loading" or "couldn't connect" instead of quietly reporting nothing. On a
  // failed read we fall back to the last data we successfully loaded, marked stale.
  const [visLoad, setVisLoad] = useState('loading') // loading | ok | stale | error
  const [staleAt, setStaleAt] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  useEffect(() => {
    let live = true
    setVisLoad('loading')
    VIS.listCached().then(res => {
      if (!live) return
      setVisits(res.rows)
      if (res.stale) { setVisLoad('stale'); setStaleAt(res.cachedAt) }
      else setVisLoad('ok')
    }).catch(() => { if (live) setVisLoad('error') })
    return () => { live = false }
  }, [reloadKey])
  useEffect(() => { CALLS.list().then(setCalls).catch(() => {}) }, [reloadKey])
  useEffect(() => { ACC.list().then(setAccess).catch(() => {}) }, [reloadKey])
  const go = tab => { if (onOpen && tab) onOpen(tab) }
  const tabsFor = ROLE_TABS[role] || []
  const vis = visits
  const vdate = v => (v.visit_date || (v.assessment && v.assessment.date) || v.arrival_time || v.created_at || '')
  const areasList = Array.from(new Set(facilities.map(f => f.area || 'Unassigned'))).sort()

  // Only a completed assessment can be a facility's current record. A bare check-in
  // means the team has arrived, not that the outcome has changed, so it must not
  // displace the last real result and blank the facility out of the RAG figures.
  const isOutcome = v => v.score != null || v.status === 'monitored' || v.status === 'debriefed' || v.status === 'second' || !!(v.assessment && Object.keys(v.assessment).length)
  const outcomes = vis.filter(isOutcome)
  const latestByFac = {}; outcomes.forEach(v => { const id = v.facility_id || ('n:' + (v.facility_name || '')); if (!id) return; if (!latestByFac[id] || vdate(v) > vdate(latestByFac[id])) latestByFac[id] = v })
  const current = Object.values(latestByFac)
  const rated = current.filter(v => v.score != null)
  const unscored = current.filter(v => v.score == null && ((v.assessment && v.assessment.visited_unscored) || v.overall_rating === 'unscored'))
  const avg = rated.length ? Math.round(rated.reduce((a, v) => a + v.score, 0) / rated.length) : null
  const compliant = rated.filter(v => v.overall_rating === 'green').length
  const complianceRate = rated.length ? Math.round(compliant / rated.length * 100) : null
  const coverage = facilities.length ? Math.round((rated.length + unscored.length) / facilities.length * 100) : null
  const rag = { green: 0, amber: 0, red: 0 }; rated.forEach(v => { if (rag[v.overall_rating] != null) rag[v.overall_rating]++ })

  const called = new Set(calls.map(c => c.visit_id))
  const awaitingCalls = vis.filter(v => v.status === 'debriefed' && !(v.debrief && v.debrief.first_visit) && !called.has(v.id)).length
  const seconds = vis.filter(v => v.round === 2 || v.status === 'second' || (v.debrief && v.debrief.second_visit))
  const secondFac = new Set(seconds.map(v => v.facility_id))
  const firstBase = {}; vis.forEach(v => { if ((v.debrief && v.debrief.first_visit) || (v.assessment && v.assessment.ruid)) { const id = v.facility_id; if (id && !firstBase[id]) firstBase[id] = v } })
  const secondDue = Object.keys(firstBase).filter(id => !secondFac.has(id)).length
  const accessPending = access.filter(r => r.status === 'pending').length
  const needsAttention = rated.filter(v => v.overall_rating === 'red' || v.overall_rating === 'amber').length

  const ragOf = v => v.score != null ? v.overall_rating : (((v.assessment && v.assessment.visited_unscored) || v.overall_rating === 'unscored') ? 'unscored' : null)
  const explore = current
    .map(v => ({ v, f: facilities.find(f => f.id === v.facility_id) || { name: v.facility_name, area: v.area } }))
    .filter(({ v }) => ragF === 'all' || ragOf(v) === ragF)
    .filter(({ f, v }) => areaF === 'all' || (f.area || v.area || 'Unassigned') === areaF)
    .filter(({ v }) => matchQ(v, q))
    .sort((a, b) => (a.v.score == null ? 999 : a.v.score) - (b.v.score == null ? 999 : b.v.score))

  const latest = {}; outcomes.forEach(v => { const id = v.facility_id; if (!id) return; if (!latest[id] || vdate(v) > vdate(latest[id])) latest[id] = v })
  const points = facilities.filter(hasCoords)
    .filter(f => areaF === 'all' || (f.area || 'Unassigned') === areaF)
    .map(f => ({ lat: f.lat, lng: f.lng, name: f.name, rag: latest[f.id] ? (latest[f.id].score != null ? latest[f.id].overall_rating : 'unscored') : null }))
    .filter(p => ragF === 'all' || (p.rag || 'none') === ragF)

  const byMonth = {}; rated.forEach(v => { const m = vdate(v).slice(0, 7); if (!m) return; (byMonth[m] = byMonth[m] || []).push(v.score) })
  let months = Object.keys(byMonth).sort(); if (range !== 'all') months = months.slice(-parseInt(range, 10))
  const trend = months.map(m => ({ label: monthLabel(m), value: Math.round(byMonth[m].reduce((a, b) => a + b, 0) / byMonth[m].length) }))

  const reins = { total: seconds.length, improved: 0, declined: 0, same: 0, resolved: 0, recTotal: 0 }
  seconds.forEach(v => { const im = v.improvement || {}; if (im.verdict === 'Improved') reins.improved++; else if (im.verdict === 'Declined') reins.declined++; else reins.same++; reins.resolved += im.resolved || 0; reins.recTotal += im.recTotal || 0 })

  const perf = {}; vis.forEach(v => { (v.team || []).forEach(t => { const k = t.name; if (!k) return; const m = perf[k] = perf[k] || { name: k, role: t.role, visits: 0, sum: 0, scored: 0 }; m.visits++; if (v.score != null) { m.sum += v.score; m.scored++ } }) })
  const monitors = Object.values(perf).map(m => ({ ...m, avg: m.scored ? Math.round(m.sum / m.scored) : null })).sort((a, b) => b.visits - a.visits).slice(0, 6)

  const now = Date.now()
  const risk = facilities.map(f => { const lv = latest[f.id]; let s = 0; if (lv) { if (lv.overall_rating === 'red') s += 3; else if (lv.overall_rating === 'amber') s += 2; else if (!lv.overall_rating) s += 1 } else s += 1; const dl = lv && lv.debrief && lv.debrief.remediation_deadline; if (dl && new Date(dl + 'T00:00:00').getTime() < now) s += 2; return { f, s, rag: lv ? lv.overall_rating : null } }).sort((a, b) => b.s - a.s)
  const topRisk = risk.filter(r => r.s >= 2).slice(0, 6)

  const byArea = {}; vis.forEach(v => { const a = v.area || 'Unassigned'; byArea[a] = (byArea[a] || 0) + 1 })
  const areaRows = Object.keys(byArea).sort().map(a => ({ a, n: byArea[a] })); const maxArea = Math.max(1, ...areaRows.map(r => r.n))

  const summary = rated.length
    ? coverage + '% of the estate assessed \u00b7 ' + complianceRate + '% green' + (needsAttention ? ' \u00b7 ' + needsAttention + ' need attention' : '') + (awaitingCalls ? ' \u00b7 ' + awaitingCalls + ' awaiting a follow-up call' : '')
    : 'No assessments recorded yet. Load or capture visits to see the picture here.'

  // Facilities comes from a prop that loaded fine, so it always shows a number.
  // Everything else is derived from visits: if that has not loaded at all, show a
  // dash, never a 0 that reads as a real figure. Stale data IS real data (just from
  // the last load), so the numbers show, with a banner saying they may be out of date.
  const vv = visLoad === 'ok' || visLoad === 'stale'
  const kpis = [
    { l: 'Facilities', v: facilities.length, tab: 'facilities', tone: 'p', show: true },
    { l: 'Assessed', v: vv ? rated.length + unscored.length : null, tab: 'facilities', tone: 'p', show: true },
    { l: 'Need attention', v: vv ? needsAttention : null, tab: 'reports', tone: 'r', show: tabsFor.includes('reports') },
    { l: 'Awaiting calls', v: vv ? awaitingCalls : null, tab: 'followups', tone: 'a', show: tabsFor.includes('followups') },
    { l: 'Second visits due', v: vv ? secondDue : null, tab: 'secondassessment', tone: 'p', show: tabsFor.includes('secondassessment') },
    { l: 'Access requests', v: vv ? accessPending : null, tab: 'access', tone: 'r', show: tabsFor.includes('access') }
  ].filter(k => k.show)

  const ragChips = [['all', 'All', rated.length + unscored.length], ['green', 'Green', rag.green], ['amber', 'Amber', rag.amber], ['red', 'Red', rag.red], ['unscored', 'Not scored', unscored.length]]
  const donutData = [{ label: 'Green', value: rag.green, color: '#2E7D46', key: 'green' }, { label: 'Amber', value: rag.amber, color: '#C77D0A', key: 'amber' }, { label: 'Red', value: rag.red, color: '#B4442E', key: 'red' }, { label: 'Not scored', value: unscored.length, color: '#B9AEC9', key: 'unscored' }]
  const legend = [['green', 'Green', rag.green], ['amber', 'Amber', rag.amber], ['red', 'Red', rag.red], ['unscored', 'Not scored', unscored.length]]

  return (<>
    {visLoad === 'error' && <div className="db-banner err">
      <div><strong>Can&#8217;t reach the database.</strong> The figures below may be incomplete. This is usually a weak connection, not your data — nothing has been lost.</div>
      <button className="mini" onClick={() => setReloadKey(k => k + 1)}>Retry</button>
    </div>}
    {visLoad === 'stale' && <div className="db-banner stale">
      <div><strong>Showing the last data that loaded{staleAt ? ', from ' + relTime(staleAt) : ''}.</strong> The connection is weak, so this may be out of date. It will refresh on its own when the connection improves.</div>
      <button className="mini" onClick={() => setReloadKey(k => k + 1)}>Refresh</button>
    </div>}
    {visLoad === 'loading' && <div className="db-banner load">
      <span className="db-spin" /> Loading the latest visit data…
    </div>}
    <div className="dash-hero">
      <div className="dash-hero-ring"><Ring pct={complianceRate} label={avg == null ? 'No scores yet' : 'Avg score ' + avg + '%'} /></div>
      <div className="dash-hero-body">
        <p className="dash-hero-sum">{summary}</p>
        <div className="dash-hero-cov">
          <div className="cov-bar"><div className="cov-fill" style={{ width: (coverage || 0) + '%' }} /></div>
          <span className="cov-cap">{rated.length + unscored.length} of {facilities.length} facilities visited</span>
        </div>
        <div className="dash-hero-legend">{legend.map(([k, l, n]) => (<span key={k} className={'hero-leg ' + k}><span className="hr-dot" />{l}<em>{n}</em></span>))}</div>
      </div>
    </div>

    <div className="dash-kpis">{kpis.map(k => (
      <button key={k.l} className={'dash-kpi tone-' + k.tone} onClick={() => go(k.tab)}>
        <span className="dk-v"><CountVal n={k.v} /></span><span className="dk-l">{k.l}</span><span className="dk-go">Open {'\u2192'}</span>
      </button>))}
    </div>

    <div className="an-panel">
      <div className="dash-exp-head"><h3>Compliance by facility</h3><SearchBox value={q} onChange={setQ} placeholder="Search facilities…" /></div>
      <div className="dash-exp">
        <div className="dash-exp-donut">
          {(rated.length + unscored.length) === 0 ? <p className="empty sm">No assessments yet.</p> : <DonutInteractive data={donutData} active={ragF} onPick={k => setRagF(f => f === k ? 'all' : k)} />}
        </div>
        <div className="dash-exp-list">
          <div className="dash-exp-filters">
            <div className="fu-segs sm wrap">{ragChips.map(([k, l, n]) => <button key={k} className={'fu-seg' + (ragF === k ? ' on' : '')} onClick={() => setRagF(k)}>{l}{n ? <span className="fu-seg-n">{n}</span> : null}</button>)}</div>
            <select className="dash-area-sel" value={areaF} onChange={e => setAreaF(e.target.value)}><option value="all">All areas</option>{areasList.map(a => <option key={a} value={a}>{a}</option>)}</select>
          </div>
          {explore.length === 0 ? <p className="empty sm">No facilities match these filters.</p> :
            <ul className="dash-flist">{explore.slice(0, 60).map(({ v, f }, i) => (
              <li key={i} onClick={() => go('facilities')}>
                <span className="df-name">{f.name || v.facility_name}<em>{f.area || v.area || 'Unassigned'}</em></span>
                {v.score != null ? <Chip rag={v.overall_rating} pct={v.score} /> : <span className="chip amber">Not scored</span>}
              </li>))}</ul>}
          {explore.length > 60 && <p className="hintline">Showing 60 of {explore.length}. Refine with search or filters.</p>}
        </div>
      </div>
    </div>

    <div className="an-panel">
      <div className="dash-exp-head"><h3>Compliance trend</h3>
        <div className="fu-segs sm">{[['6', '6m'], ['12', '12m'], ['all', 'All']].map(([k, l]) => <button key={k} className={'fu-seg' + (range === k ? ' on' : '')} onClick={() => setRange(k)}>{l}</button>)}</div>
      </div>
      {trend.length === 0 ? <p className="empty sm">No scored visits in this range.</p> : <LineChart points={trend} />}
    </div>

    <div className="an-panel">
      <h3>Re-inspection outcomes</h3>
      <p className="hintline">Movement between the first visit and a follow-up assessment. The headline figures above already reflect each facility's most recent visit; this panel shows the change.</p>
      {reins.total === 0
        ? <p className="empty sm">No re-inspections recorded yet. As second assessments are completed, the improved / no-change / declined split will appear here.</p>
        : <>
          <div className="reins-row">
            <div className="reins-stat"><span className="reins-v g">{reins.improved}</span><span className="reins-l">Improved</span></div>
            <div className="reins-stat"><span className="reins-v a">{reins.same}</span><span className="reins-l">No change</span></div>
            <div className="reins-stat"><span className="reins-v r">{reins.declined}</span><span className="reins-l">Declined</span></div>
            <div className="reins-stat"><span className="reins-v">{reins.total}</span><span className="reins-l">Re-inspected</span></div>
          </div>
          {reins.recTotal > 0 && <p className="hintline">{reins.resolved} of {reins.recTotal} first-visit recommendations resolved across re-inspected facilities.</p>}
        </>}
    </div>

    <div className="an-two">
      <div className="an-panel"><h3>Team performance</h3>
        {monitors.length === 0 ? <p className="empty sm">No visits yet.</p> : <div className="perf">{monitors.map(m => {
          const rg = m.avg == null ? null : m.avg >= 80 ? 'green' : m.avg >= 50 ? 'amber' : 'red'
          return (<div className="perf-row" key={m.name}><span className="perf-name">{m.name}<em>{m.role}</em></span><span className="perf-stat">{m.visits} visit{m.visits === 1 ? '' : 's'}</span><Chip rag={rg} pct={m.avg == null ? null : m.avg} /></div>)
        })}</div>}
      </div>
      <div className="an-panel"><h3>Facilities needing attention</h3>
        {topRisk.length === 0 ? <p className="empty sm">Nothing flagged.</p> : <div className="risk">{topRisk.map(r => (
          <div className="risk-row" key={r.f.id} onClick={() => go('facilities')} style={{ cursor: 'pointer' }}><span className="risk-name">{r.f.name}<em>{r.f.area || 'Unassigned'}</em></span><span className={'risk-badge ' + riskLevel(r.s).toLowerCase()}>{riskLevel(r.s)} risk</span></div>
        ))}</div>}
      </div>
    </div>

    <div className="an-panel"><h3>Visits by area</h3>
      <p className="hintline">Tap a bar to filter the facility list above.</p>
      {areaRows.length === 0 ? <p className="empty sm">No visits yet.</p> : <div className="bars">{areaRows.map(r => (
        <div className={'bar-row click' + (areaF === r.a ? ' on' : '')} key={r.a} onClick={() => setAreaF(a => a === r.a ? 'all' : r.a)}><span className="bar-lab">{r.a}</span><div className="bar-track"><div className="bar-fill" style={{ width: (r.n / maxArea * 100) + '%' }} /></div><span className="bar-n">{r.n}</span></div>
      ))}</div>}
    </div>

    <div className="an-panel"><h3>Geographic outcomes</h3>
      <p className="hintline">Each facility is coloured by its most recent visit outcome{ragF !== 'all' || areaF !== 'all' ? ' (filtered)' : ''}. Grey means not yet assessed.</p>
      {points.length === 0 ? <p className="empty sm">No mapped facilities match.</p> : <HeatMap points={points} />}
    </div>
  </>)
}

/* ---------- bars ---------- */
function useCountUp(target, ms = 900) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (typeof target !== 'number' || isNaN(target)) { setN(target); return }
    let raf, start
    const step = (t) => { if (!start) start = t; const p = Math.min(1, (t - start) / ms); setN(Math.round(target * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(step) }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return n
}
function TabIcon({ id }) {
  const p = {
    dashboard: 'M4 13h6V4H4v9zm0 7h6v-5H4v5zm10 0h6V11h-6v9zm0-16v5h6V4h-6z',
    facilities: 'M5 21h14M7 21V7l5-4 5 4v14M10 21v-4h4v4',
    map: 'M9 4 3 6v15l6-2 6 2 6-2V4l-6 2-6-2zM9 4v15M15 6v15',
    engage: 'M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM5 20c0-3.5 3-6 7-6s7 2.5 7 6',
    monitor: 'M5 3h14v14H5zM8 9l2 2 4-5M8 13h6M9 21h6',
    debrief: 'M6 3h12v18l-6-3-6 3zM9 8h6M9 12h4',
    secondassessment: 'M4 8a8 8 0 0113-6M20 4v4h-4M20 16a8 8 0 01-13 6M4 20v-4h4M9 12l2 2 4-4',
    assign: 'M8 6h11M8 12h11M8 18h11M4 6h.01M4 12h.01M4 18h.01',
    reports: 'M7 3h7l5 5v13H7zM14 3v5h5M9 13h6M9 17h6',
    analytics: 'M4 20V11M10 20V4M16 20v-7M22 20H2',
    myfacility: 'M5 21h14M7 21V7l5-4 5 4v14M10 13h4M10 17h4',
    followups: 'M4 4h5l2 5-3 2a12 12 0 006 6l2-3 5 2v5a2 2 0 01-2 2A16 16 0 014 6a2 2 0 012-2',
    settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19 12a7 7 0 00-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 00-1.7-1l-.3-2.6H9.5l-.3 2.6a7 7 0 00-1.7 1l-2.4-1-2 3.4L3.1 11a7 7 0 000 2l-2 1.6 2 3.4 2.4-1a7 7 0 001.7 1l.3 2.6h4.9l.3-2.6a7 7 0 001.7-1l2.4 1 2-3.4-2-1.6a7 7 0 00.1-1z',
    assistant: 'M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2zM19 15l1 2.5L22 19l-2 1-1 2.5-1-2.5L16 19l2-1z',
    approvals: 'M9 12l2 2 4-4M12 3l7 4v5c0 4.5-3 8.3-7 9-4-.7-7-4.5-7-9V7z',
    integrity: 'M12 3l7 4v5c0 4.5-3 8.3-7 9-4-.7-7-4.5-7-9V7zM12 8v4M12 15h.01',
    access: 'M10 11a4 4 0 100-8 4 4 0 000 8zM3 21v-1a7 7 0 019.5-6.5M15 18l2 2 4-4'
  }[id] || 'M4 4h16v16H4z'
  return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={p} /></svg>)
}
function SiteBar({ tab, setTab, onSignIn, lang, setLang, t }) {
  return (<header className="bar">
    <button className="wordmark" onClick={() => setTab('home')} aria-label="REALMS home"><img className="mark" src="/rhsc-mark.png" alt="RHSC" /><span className="wm-text"><strong>REALMS</strong><em>Healthcare Services Consulting</em></span></button>
    <nav className="tabs" aria-label="Primary">{SITE_TABS.map(tb => (<button key={tb.id} className={'tab' + (tab === tb.id ? ' active' : '')} onClick={() => setTab(tb.id)}>{t('nav_' + tb.id)}</button>))}</nav>
    <div className="bar-right">
      <select className="langsel" value={lang} onChange={e => setLang(e.target.value)} aria-label="Language">{LANGS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}</select>
      <button className="signin" onClick={onSignIn}>{t('cta_signin')}</button>
    </div>
  </header>)
}
function TopBarApp({ identity, realRole, viewAsName, onViewAs, onEditName, onSignOut, onToggleNav }) {
  const isHQ = realRole === 'rhsc_hq'
  return (<header className="topbar">
    <div className="tb-left">
      <button className="navtoggle" onClick={onToggleNav} aria-label="Menu"><svg viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16" /></svg></button>
      <img className="mark" src="/rhsc-mark.png" alt="RHSC" />
      <span className="tb-name">REALMS FIELD</span>
      {isHQ && (<div className="ws"><label>View as</label>
        <select value={viewAsName} onChange={e => onViewAs(e.target.value)}>
          <option value="">My view (HQ)</option>
          {VIEW_USERS.map(u => <option key={u.name} value={u.name}>{u.name + ' \u00b7 ' + ((roleById(u.role) || {}).label || '')}</option>)}
        </select>
      </div>)}
    </div>
    <div className="tb-right"><button className="who" onClick={onEditName} title="Edit your name">{identity.first}</button><button className="signin" onClick={onSignOut}>Sign out</button></div>
  </header>)
}
function Sidebar({ role, appTab, setAppTab, collapsed, setCollapsed, open, setOpen, badges }) {
  const r = roleById(role); const tabs = ROLE_TABS[role] || ['dashboard']
  return (<>
    <div className={'scrim' + (open ? ' show' : '')} onClick={() => setOpen(false)} />
    <aside className={'sidebar' + (collapsed ? ' collapsed' : '') + (open ? ' open' : '')}>
      <div className="sb-head"><span className="sb-role">{r ? r.label : 'Workspace'}</span></div>
      <nav className="sb-nav">{tabs.map(t => { const n = badges && badges[t]; return (
        <button key={t} className={'sb-item' + (appTab === t ? ' active' : '')} onClick={() => { setAppTab(t); setOpen(false) }} title={TAB_LABEL[t] + (n ? ' (' + n + ' waiting)' : '')}>
          <span className="sb-ico"><TabIcon id={t} />{n ? <span className="sb-badge">{n > 99 ? '99+' : n}</span> : null}</span><span className="sb-lab">{TAB_LABEL[t]}</span>{n ? <span className="sb-badge-lab">{n > 99 ? '99+' : n}</span> : null}
        </button>
      ) })}</nav>
      <button className="sb-collapse" onClick={() => setCollapsed(c => !c)} title="Collapse menu">
        <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="2"><path d={collapsed ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} /></svg><span className="sb-lab">Collapse</span>
      </button>
    </aside>
  </>)
}

/* ---------- root ---------- */
export default function App() {
  const [tab, setTab] = useState('home')
  const [view, setView] = useState('site')
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [hqPending, setHqPending] = useState(false)
  const [pendKind, setPendKind] = useState('rhsc_hq')
  const [myFacility, setMyFacility] = useState(null)
  const [appTab, setAppTab] = useState(() => { try { return localStorage.getItem('realms_tab') || 'dashboard' } catch (e) { return 'dashboard' } })
  useEffect(() => { try { localStorage.setItem('realms_tab', appTab) } catch (e) {} }, [appTab])
  const [badges, setBadges] = useState({})
  const [facs, setFacs] = useState([])
  async function refreshBadges() {
    try { const rows = await ACC.list(); setBadges(b => ({ ...b, access: rows.filter(r => r.status === 'pending').length })) } catch (e) {}
    try {
      const [vs, cl] = await Promise.all([VIS.list(), CALLS.list()])
      const called = new Set(cl.map(c => c.visit_id))
      const awaiting = vs.filter(v => (v.status === 'debriefed' || v.status === 'second') && !(v.debrief && v.debrief.first_visit) && !called.has(v.id)).length
      setBadges(b => ({ ...b, followups: awaiting }))
    } catch (e) {}
  }
  useEffect(() => {
    if (!user || !role) { setBadges({}); return }
    const t = ROLE_TABS[role] || []
    if (!t.includes('access') && !t.includes('followups')) return
    let live = true; const run = () => { if (live) refreshBadges() }
    run(); const iv = setInterval(run, 60000)
    return () => { live = false; clearInterval(iv) }
  }, [user, role, appTab])
  const [navCollapsed, setNavCollapsed] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [viewAs, setViewAs] = useState(null)
  const [dbError, setDbError] = useState('')
  const [lang, setLang] = useState(() => { try { return localStorage.getItem('realms_lang') || 'en' } catch (e) { return 'en' } })
  function changeLang(l) { setLang(l); try { localStorage.setItem('realms_lang', l) } catch (e) {} }
  const seedTriedRef = useRef(false)

  useEffect(() => {
    let forceOut = false
    try { if (!localStorage.getItem('realms_reauth_v3')) { localStorage.setItem('realms_reauth_v3', '1'); localStorage.removeItem('realms_demo_user'); localStorage.removeItem('realms_demo_role'); forceOut = true } } catch (e) {}
    if (MODE === 'supabase') {
      let subscription
      try {
        if (forceOut) { try { supabase.auth.signOut() } catch (e) {} }
        const res = supabase.auth.onAuthStateChange((_e, s) => {
          if (s && s.user) { setUser({ email: s.user.email, id: s.user.id, name: (s.user.user_metadata && s.user.user_metadata.full_name) || '' }); loadRole(s.user.id, { email: s.user.email }); setView('app') }
          else { setUser(null); setRole(null); setViewAs(null); setView(prev => (prev === 'app' ? 'site' : prev)) }
        })
        subscription = res.data.subscription
      } catch (e) { /* site still renders */ }
      return () => { if (subscription) subscription.unsubscribe() }
    } else {
      if (forceOut) return
      try {
        const raw = localStorage.getItem('realms_demo_user'); const dr = localStorage.getItem('realms_demo_role')
        if (raw) { setUser(JSON.parse(raw)); if (dr) setRole(dr); setView('app') }
      } catch (e) { /* ignore */ }
    }
  }, [])

  // load facilities whenever we enter the app with a role
  useEffect(() => { if (view === 'app' && user && role) reloadFacs() }, [view, role])
  // reminders: run once a day, quietly, when an oversight role opens the app
  useEffect(() => {
    if (!(view === 'app' && user && (role === 'rhsc_hq' || role === 'team_leader'))) return
    const today = new Date().toISOString().slice(0, 10)
    let last = ''
    try { last = localStorage.getItem('realms_reminders_run') || '' } catch (e) {}
    if (last === today) return
    let live = true
    const t = setTimeout(async () => {
      try {
        const vs = await VIS.list()
        const out = await runReminders(vs, facs, user.id)
        if (!live) return
        try { localStorage.setItem('realms_reminders_run', today) } catch (e) {}
        if (out.length) toast(out.length + ' re-inspection reminder' + (out.length === 1 ? '' : 's') + ' sent.')
      } catch (e) {}
    }, 4000)
    return () => { live = false; clearTimeout(t) }
  }, [view, role, facs.length])

  async function reloadFacs() {
    setDbError('')
    let list = []
    try { list = await FAC.list() } catch (e) { setDbError((e && e.message) || 'Could not read the database.'); setFacs([]); return }
    let noSeed = false; try { noSeed = !!localStorage.getItem('realms_no_seed') } catch (e) {}
    if (MODE === 'demo' && list.length === 0 && !seedTriedRef.current && !noSeed) {
      seedTriedRef.current = true
      const res = await seedSampleData(user && user.id)
      try { list = await FAC.list() } catch (e) {}
      if (list.length === 0 && res && res.error) setDbError(res.error)
    }
    setFacs(list)
  }
  async function loadSample() {
    setDbError(''); seedTriedRef.current = true
    const res = await seedSampleData(user && user.id)
    try {
      const list = await FAC.list(); setFacs(list)
      if (list.length === 0 && res && res.error) setDbError(res.error)
      else if (res && res.error) { setDbError('Facilities loaded, but the visit records failed: ' + res.error); toast('Facilities loaded, but visit records failed. See the message on the dashboard.', 'err') }
      else if (list.length) toast(list.length + ' live facilities loaded.')
    }
    catch (e) { setDbError((e && e.message) || 'Could not read the database.') }
  }
  async function clearAll() {
    if (!(await confirmAction('This removes ALL facilities, visits and assignments. It cannot be undone.', { title: 'Clear all data', ok: 'Clear everything', danger: true }))) return
    try { await clearAllData() } catch (e) {}
    try { localStorage.setItem('realms_no_seed', '1') } catch (e) {}
    seedTriedRef.current = true; setFacs([]); setDbError(''); toast('All data cleared.')
  }
  function editName() {
    const n = window.prompt('Your name (only your first name is used to greet you)', (user && user.name) || '')
    if (n == null) return; const nm = n.trim(); if (!nm) return
    setUser(u => ({ ...(u || {}), name: nm }))
    if (MODE === 'supabase') { try { supabase.auth.updateUser({ data: { full_name: nm } }) } catch (e) {} }
    else { try { const raw = JSON.parse(localStorage.getItem('realms_demo_user') || '{}'); localStorage.setItem('realms_demo_user', JSON.stringify({ ...raw, name: nm })) } catch (e) {} }
  }
  function doViewAs(name) {
    if (!name) { setViewAs(null); setAppTab('dashboard'); return }
    const u = VIEW_USERS.find(x => x.name === name); if (u) { setViewAs(u); setAppTab('dashboard') }
  }

  async function loadRole(uid, u) {
    if (MODE !== 'supabase') return
    try {
      const { data } = await supabase.from('kv').select('v').eq('user_id', uid).eq('k', 'role').maybeSingle()
      const r = data && data.v ? (typeof data.v === 'string' ? data.v : data.v.role) : null
      if (!r) return
      if (r === 'rhsc_hq' && !isOwner(u)) {
        let req = null
        try { req = await ACC.mine(uid, 'rhsc_hq') } catch (e) {}
        if (!req) {
          // Role was saved before the gate existed. Raise the request now, so it reaches the executive office.
          try { req = await ACC.request({ user_id: uid, email: (u && u.email) || '', name: (u && u.name) || '', role: 'rhsc_hq' }) } catch (e) {}
          try { sendNotify({ channel: 'email', to: OWNER_EMAIL, subject: 'HQ access request', message: ((u && (u.name || u.email)) || 'A user') + ' has requested RHSC HQ access on Realms Field.' }) } catch (e) {}
        }
        if (!req || req.status !== 'approved') { setPendKind('rhsc_hq'); setHqPending(true); setRole(null); return }
      }
      if (r === 'facility_proprietor') {
        let req = null
        try { req = await ACC.mine(uid, 'facility_proprietor') } catch (e) {}
        if (!req || req.status !== 'approved') { setPendKind('facility_proprietor'); setHqPending(true); setRole(null); return }
        setMyFacility(req.facility_id || null)
      }
      setHqPending(false); setRole(r)
    } catch (e) { /* role picker will show */ }
  }
  async function pickRole(id) {
    if (MODE === 'supabase' && user) { try { await supabase.from('kv').upsert({ user_id: user.id, k: 'role', v: id, updated_at: new Date().toISOString() }) } catch (e) {} }
    else localStorage.setItem('realms_demo_role', id)
    if (id === 'rhsc_hq' && user && !isOwner(user)) {
      try { await ACC.request({ user_id: user.id, email: user.email, name: user.name || '', role: 'rhsc_hq' }) } catch (e) {}
      setPendKind('rhsc_hq'); setHqPending(true); setRole(null)
      try { sendNotify({ channel: 'email', to: OWNER_EMAIL, subject: 'HQ access request', message: (user.name || user.email) + ' has requested RHSC HQ access on Realms Field.' }) } catch (e) {}
      return
    }
    if (id === 'facility_proprietor' && user) { setPendKind('facility_proprietor'); setHqPending(true); setRole(null); return }
    setHqPending(false); setRole(id); setAppTab('dashboard')
  }
  function afterAuth(u) { setUser(u); setView('app') }
  async function signOut() {
    if (MODE === 'supabase') { try { await supabase.auth.signOut() } catch (e) {} }
    else { localStorage.removeItem('realms_demo_user'); localStorage.removeItem('realms_demo_role') }
    setUser(null); setRole(null); setHqPending(false); setViewAs(null); setView('site'); setTab('home'); setAppTab('dashboard')
  }

  const identity = user ? identityFor(user.email, user.name) : { name: 'Staff', first: 'Staff', title: '' }
  const t = makeT(lang)
  const effRole = viewAs ? viewAs.role : role
  const effId = viewAs ? { name: viewAs.name, first: viewAs.name.split(' ')[0], title: '', photo: '' } : identity
  const canEdit = CAN_EDIT.includes(effRole)
  // A remembered tab must still be one this role can open.
  useEffect(() => {
    if (!effRole) return
    const allowed = ROLE_TABS[effRole] || ['dashboard']
    if (!allowed.includes(appTab)) setAppTab('dashboard')
  }, [effRole, appTab])

  let body
  if (view === 'auth') body = <AuthPanel onDone={afterAuth} onCancel={() => setView('site')} />
  else if (view === 'app' && user) {
    if (hqPending) body = <PendingAccess kind={pendKind} user={user} facilities={facs} identity={identity} onSignOut={signOut} onBack={() => setHqPending(false)} />
    else if (!role) body = <RolePicker identity={identity} onPick={pickRole} onSignOut={signOut} />
    else if (appTab === 'facilities') body = <FacilitiesPage list={facs} canEdit={canEdit} userId={user.id} reload={reloadFacs} />
    else if (appTab === 'map') body = <MapRoutePage list={facs} role={effRole} userId={user.id} />
    else if (appTab === 'engage') body = <EngagePage list={facs} identity={effId} role={effRole} userId={user.id} />
    else if (appTab === 'monitor') body = <MonitorPage userId={user.id} onOpen={setAppTab} />
    else if (appTab === 'debrief') body = <DebriefPage userId={user.id} facilities={facs} />
    else if (appTab === 'secondassessment') body = <SecondAssessmentPage facilities={facs} identity={effId} userId={user.id} role={effRole} />
    else if (appTab === 'reports') body = <ReportsPage facilities={facs} userId={user.id} role={effRole} />
    else if (appTab === 'myfacility') body = <ProprietorPage facilityId={myFacility} facilities={facs} />
    else if (appTab === 'followups') body = <FollowUpsPage userId={user.id} identity={identity} facilities={facs} onChange={refreshBadges} />
    else if (appTab === 'settings') body = <SettingsPage user={user} identity={identity} facilities={facs} />
    else if (appTab === 'assistant') body = <AssistantPage facilities={facs} />
    else if (appTab === 'approvals') body = <ApprovalsPage userId={user.id} identity={effId} role={effRole} />
    else if (appTab === 'integrity') body = <IntegrityPage facilities={facs} />
    else if (appTab === 'access') body = <AccessRequestsPage identity={effId} user={user} onChange={refreshBadges} />
    else if (appTab === 'assign') body = <AssignPage list={facs} userId={user.id} />
    else body = <Dashboard identity={effId} role={effRole} onOpen={setAppTab} facilities={facs} onSeed={loadSample} onClear={clearAll} dbError={dbError} />
  } else {
    body = tab === 'home' ? <HomePage onSignIn={() => setView('auth')} go={setTab} t={t} />
      : tab === 'services' ? <ServicesPage go={setTab} />
      : tab === 'monitoring' ? <MonitoringPage onSignIn={() => setView('auth')} go={setTab} />
      : tab === 'about' ? <AboutPage />
      : tab === 'leadership' ? <LeadershipPage go={setTab} />
      : <ContactPage />
  }

  const showAppShell = view === 'app' && user && role
  const showAuthBare = view === 'auth'

  if (showAppShell) {
    return (<div className="realms app-mode">
      <style>{css}</style>
      <Overlays />
      <TopBarApp identity={effId} realRole={role} viewAsName={viewAs ? viewAs.name : ''} onViewAs={doViewAs} onEditName={editName} onSignOut={signOut} onToggleNav={() => setNavOpen(o => !o)} />
      {viewAs && (<div className="viewas-bar">Viewing as {viewAs.name} &middot; {(roleById(viewAs.role) || {}).label}<button onClick={() => doViewAs('')}>Return to my view</button></div>)}
      <div className="shell">
        <Sidebar role={effRole} appTab={appTab} setAppTab={setAppTab} collapsed={navCollapsed} setCollapsed={setNavCollapsed} open={navOpen} setOpen={setNavOpen} badges={badges} />
        <main className="app-main">{body}</main>
      </div>
    </div>)
  }

  return (<div className="realms">
    <style>{css}</style>
    <Overlays />
    {!showAuthBare && <SiteBar tab={tab} setTab={(t2) => { setView('site'); setTab(t2) }} onSignIn={() => setView('auth')} lang={lang} setLang={changeLang} t={t} />}
    <main id="top" className={showAuthBare ? 'main-auth' : ''}>{body}</main>
    {!showAuthBare && (<footer className="foot"><div className="foot-inner">
      <div className="foot-brand"><img className="foot-mark" src="/rhsc-mark.png" alt="RHSC" /><span>REALMS Healthcare Services Consulting Limited</span></div>
      <p className="foot-tag">{t('tagline')}</p>
    </div></footer>)}
    {!showAuthBare && <SiteAssistant />}
  </div>)
}

function SiteAssistant() {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState([{ role: 'assistant', text: 'Hello! I can help with questions about RHSC — our services, HEFAMAA monitoring, or booking a consultation. How can I help?' }])
  const [input, setInput] = useState(''); const [busy, setBusy] = useState(false)
  const boxRef = useRef(null)
  useEffect(() => { if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight }, [msgs, open])
  const SYS = 'You are the website assistant for REALMS Healthcare Services Consulting Limited (RHSC), a Lagos healthcare consulting firm and licensed HEFAMAA facility-monitoring operator. Services: strategy and advisory; quality and accreditation; facility monitoring and accreditation (HEFAMAA); training and capacity building; health financing; and digital health via the Genesys EMR. Office: 21 Fatai Arobieke Street, off Admiralty Way, Lekki Phase 1, Lagos. Answer briefly and warmly, help visitors understand the services and encourage booking a consultation on the Contact page. If asked something outside RHSC, gently redirect. Never invent specific prices, names or regulatory rulings.'
  async function send() {
    const q = input.trim(); if (!q || busy) return
    const next = msgs.concat([{ role: 'user', text: q }]); setMsgs(next); setInput(''); setBusy(true)
    const convo = next.map(m => (m.role === 'user' ? 'Visitor: ' : 'Assistant: ') + m.text).join('\n')
    const r = await askAI({ system: SYS, prompt: convo + '\nAssistant:', max_tokens: 500 })
    setBusy(false)
    setMsgs(m => m.concat([{ role: 'assistant', text: r.ok ? r.text : (r.reason === 'ai_not_configured' ? 'The assistant is not enabled yet. Please use the Contact page and our team will respond.' : 'Sorry, I could not respond just now. Please try the Contact page.') }]))
  }
  return (<>
    <button className="assistant-fab" onClick={() => setOpen(o => !o)} aria-label="Ask RHSC">{open ? '\u00d7' : 'Ask RHSC'}</button>
    {open && (<div className="assistant-panel">
      <div className="assistant-head"><span>Ask RHSC</span><button className="linkbtn subtle" onClick={() => setOpen(false)}>Close</button></div>
      <div className="assistant-msgs" ref={boxRef}>{msgs.map((m, i) => <div key={i} className={'amsg ' + m.role}>{m.text}</div>)}{busy && <div className="amsg assistant typing">&hellip;</div>}</div>
      <div className="assistant-input"><input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send() }} placeholder="Type your question" /><button className="btn primary" onClick={send} disabled={busy}>Send</button></div>
    </div>)}
  </>)
}
function AssistantPage({ facilities }) {
  const [visits, setVisits] = useState([])
  const [msgs, setMsgs] = useState([{ role: 'assistant', text: 'Ask about your monitoring data: coverage, outcomes, overdue re-inspections, facilities needing attention, trends by area, and more.' }])
  const [input, setInput] = useState(''); const [busy, setBusy] = useState(false)
  const boxRef = useRef(null)
  useEffect(() => { VIS.list().then(setVisits).catch(() => {}) }, [])
  useEffect(() => { if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight }, [msgs])
  function dataSummary() {
    const byArea = {}, byStatus = {}, byRag = {}
    visits.forEach(v => { const a = v.area || 'Unassigned'; byArea[a] = (byArea[a] || 0) + 1; byStatus[v.status || 'engaged'] = (byStatus[v.status || 'engaged'] || 0) + 1; if (v.overall_rating) byRag[v.overall_rating] = (byRag[v.overall_rating] || 0) + 1 })
    const due = visits.filter(v => v.debrief && v.debrief.remediation_deadline).map(v => ({ facility: v.facility_name, area: v.area, due: v.debrief.remediation_deadline }))
    const recent = visits.slice(0, 40).map(v => ({ facility: v.facility_name, area: v.area, date: (v.arrival_time || v.created_at || '').slice(0, 10), status: v.status, rating: v.overall_rating, score: v.score }))
    return JSON.stringify({ facilities: facilities.length, areas: Array.from(new Set(facilities.map(f => f.area || 'Unassigned'))), visits: visits.length, byArea, byStatus, byRag, due, recent })
  }
  async function send() {
    const q = input.trim(); if (!q || busy) return
    const next = msgs.concat([{ role: 'user', text: q }]); setMsgs(next); setInput(''); setBusy(true)
    const sys = 'You are the RHSC operations analyst. Answer questions using ONLY the JSON monitoring data provided. Be concise, use concrete numbers, and if the data does not contain the answer say so plainly. RAG ratings: green = compliant, amber = partial, red = serious gaps.'
    const convo = next.map(m => (m.role === 'user' ? 'Q: ' : 'A: ') + m.text).join('\n')
    const r = await askAI({ system: sys, prompt: 'DATA:\n' + dataSummary() + '\n\n' + convo + '\nA:', max_tokens: 700 })
    setBusy(false)
    setMsgs(m => m.concat([{ role: 'assistant', text: r.ok ? r.text : (r.reason === 'ai_not_configured' ? 'AI is not set up yet. Add ANTHROPIC_API_KEY in Vercel to enable it.' : 'Could not respond. Please try again.') }]))
  }
  return (<div className="page">
    <div className="ptitle"><div><p className="eyebrow">AI</p><h2>Data assistant</h2></div></div>
    <div className="chat-wrap">
      <div className="chat-msgs" ref={boxRef}>{msgs.map((m, i) => <div key={i} className={'cmsg ' + m.role}>{m.text}</div>)}{busy && <div className="cmsg assistant">&hellip;</div>}</div>
      <div className="chat-input"><input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send() }} placeholder="e.g. Which areas have the most red facilities?" /><button className="btn primary" onClick={send} disabled={busy}>Ask</button></div>
    </div>
    <p className="hintline">Answers are generated from your monitoring data. Verify before acting.</p>
  </div>)
}

const css = `
.realms { --ink:#3A2B54; --p:#6D4B8E; --p-deep:#574277; --p-mid:#7E63A0; --v:#A98FC4; --lav1:#F6F3FA; --lav2:#EDE7F4; --line:#E4DCEE; --white:#ffffff; --e1:0 1px 2px rgba(58,21,96,.05); --e2:0 4px 14px rgba(58,21,96,.07); --e3:0 14px 40px rgba(58,21,96,.11); --r-sm:10px; --r-md:14px; --r-lg:18px; --tap:44px; color:var(--ink); min-height:100vh; display:flex; flex-direction:column; }
.realms h1,.realms h2,.realms h3 { font-weight:600; letter-spacing:.01em; margin:0; }
.realms p { margin:0; }
.realms a { color:inherit; text-decoration:none; }
.realms img { display:block; max-width:100%; }
.realms button { font-family:inherit; cursor:pointer; }
.realms .eyebrow { font-size:12px; letter-spacing:.2em; text-transform:uppercase; color:var(--v); font-weight:600; margin:0 0 14px; }
.realms .accent { color:var(--p); }
.realms :focus-visible { outline:2.5px solid var(--p); outline-offset:3px; border-radius:6px; }
@keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:none; } }
.realms .anim { animation: fadeUp .6s ease both; }
@media (prefers-reduced-motion: reduce){ .realms .anim { animation:none; } }

.realms .bar { position:sticky; top:0; z-index:1000; display:grid; grid-template-columns:1fr minmax(0,auto) 1fr; align-items:center; gap:16px; padding:12px clamp(18px,4vw,56px); background:rgba(255,255,255,.94); backdrop-filter:blur(8px); border-bottom:1px solid var(--line); }
.realms .wordmark { display:flex; align-items:center; gap:12px; background:none; border:0; padding:0; justify-self:start; }
.realms .bar-right { justify-self:end; display:flex; align-items:center; gap:10px; }
.realms .bar .mark { height:42px; width:auto; }
.realms .wm-text { display:flex; flex-direction:column; line-height:1.05; text-align:left; }
.realms .wm-text strong { font-size:18px; letter-spacing:.14em; color:var(--p-deep); }
.realms .wm-text em { font-style:normal; font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:#8A7AA6; }
.realms .nav { display:flex; align-items:center; gap:12px; }
.realms .tabs { display:flex; align-items:center; gap:4px; background:var(--lav1); border:1px solid var(--line); border-radius:30px; padding:4px; }
.realms .tab { border:0; background:none; color:#5A4C74; font-size:14.5px; padding:8px 15px; border-radius:22px; transition:.16s; white-space:nowrap; }
.realms .tab:hover { color:var(--p); }
.realms .tab.active { background:#fff; color:var(--p-deep); box-shadow:0 2px 8px rgba(122,52,168,.14); font-weight:600; }
.realms .signin { padding:9px 18px; border:1.5px solid var(--p); background:none; border-radius:24px; color:var(--p); font-weight:500; font-size:14.5px; transition:.16s; }
.realms .signin:hover { background:var(--p); color:#fff; }
.realms .app-bar .who { font-size:14.5px; color:#5A4C74; }

.realms main { flex:1; }
.realms .page { max-width:1800px; margin:0 auto; padding:clamp(28px,4vw,54px) clamp(18px,4vw,56px) clamp(40px,5vw,70px); min-height:56vh; }
.realms .section-head { text-align:center; max-width:720px; margin:0 auto clamp(26px,3.4vw,44px); }
.realms .section-head h2 { font-size:clamp(28px,3.3vw,40px); color:var(--p-deep); }
.realms .btn { display:inline-block; font-size:16px; padding:14px 26px; border-radius:30px; font-weight:500; transition:.16s; border:0; }
.realms .btn.small { font-size:14px; padding:10px 18px; }
.realms .btn.primary { background:var(--p); color:#fff; }
.realms .btn.primary:hover { background:var(--p-deep); }
.realms .btn.primary:disabled { opacity:.55; cursor:default; }
.realms .btn.ghost { border:1.5px solid var(--line); color:var(--p); background:#fff; }
.realms .btn.ghost:hover { border-color:var(--v); background:var(--lav1); }
.realms .btn.wide { width:100%; }

.realms .hero { display:grid; grid-template-columns:1.12fr .88fr; gap:44px; align-items:center; }
.realms .hero h1 { font-size:clamp(36px,5vw,62px); line-height:1.05; color:var(--p-deep); margin-bottom:20px; }
.realms .lede { font-size:clamp(16px,1.4vw,19px); line-height:1.6; color:#54466E; max-width:38ch; }
.realms .cta-row { display:flex; flex-wrap:wrap; gap:14px; margin:28px 0 20px; }
.realms .tagline { font-style:italic; color:#8A7AA6; font-size:15px; }
.realms .hero-art { display:flex; justify-content:center; }
.realms .art-panel { width:min(400px,86vw); border-radius:26px; padding:clamp(24px,3.5vw,42px); background:radial-gradient(circle at 50% 30%, var(--lav1), var(--lav2)); box-shadow:0 26px 64px rgba(122,52,168,.16); border:1px solid #EBDCF8; }
.realms .home-strip { display:flex; justify-content:center; flex-wrap:wrap; gap:clamp(28px,7vw,88px); margin-top:clamp(30px,4vw,52px); text-align:center; }
.realms .mini-stat { text-align:center; padding:20px 12px; background:var(--lav1); border:1px solid var(--line); border-radius:14px; }
.realms .mini-value { display:block; font-size:34px; font-weight:700; color:var(--p); line-height:1; margin-bottom:8px; }
.realms .mini-label { font-size:12.5px; color:#5A4C74; }

.realms .wave-wrap { position:relative; max-width:1100px; margin:0 auto; }
.realms .wave { position:absolute; top:34px; left:0; width:100%; height:90px; pointer-events:none; opacity:.6; }
.realms .stages { list-style:none; margin:0; padding:0; display:grid; grid-template-columns:repeat(4,1fr); gap:26px; }
.realms .stage { text-align:center; padding:0 6px; }
.realms .stage-n { font-size:14px; letter-spacing:.18em; color:var(--v); font-weight:700; }
.realms .stage .dot { display:block; width:15px; height:15px; margin:18px auto 20px; border-radius:50%; background:#fff; border:3px solid var(--p); box-shadow:0 0 0 6px var(--lav1); }
.realms .stage h3 { font-size:21px; color:var(--p-deep); margin-bottom:10px; }
.realms .stage p { font-size:14.5px; line-height:1.58; color:#5A4C74; }

.realms .pillars { display:grid; grid-template-columns:1fr 1fr; gap:22px; }
.realms .pillar { background:#fff; border:1px solid var(--line); border-radius:16px; padding:28px 28px 32px; transition:.2s; }
.realms .pillar:hover { box-shadow:0 18px 44px rgba(122,52,168,.12); border-color:var(--v); transform:translateY(-3px); }
.realms .pillar-rule { display:block; width:44px; height:4px; border-radius:3px; background:linear-gradient(90deg,var(--p),var(--v)); margin-bottom:18px; }
.realms .pillar h3 { font-size:21px; color:var(--p-deep); margin-bottom:11px; }
.realms .pillar p { font-size:15px; line-height:1.6; color:#4A3B66; }

.realms .mandate-grid { display:grid; grid-template-columns:1fr 1fr; gap:32px; font-size:clamp(16px,1.3vw,18px); line-height:1.68; color:#4A3B66; margin-bottom:clamp(30px,4vw,48px); }
.realms .principles { display:grid; grid-template-columns:repeat(3,1fr); gap:26px; }
.realms .principle { border-top:3px solid var(--p); padding-top:18px; }
.realms .principle h3 { font-size:18px; color:var(--p-deep); margin-bottom:9px; }
.realms .principle p { font-size:14.5px; line-height:1.58; color:#4A3B66; }

.realms .enquiry-card { max-width:900px; margin:0 auto; background:linear-gradient(135deg,var(--p),var(--p-mid)); color:#fff; border-radius:22px; padding:clamp(30px,4vw,48px); display:grid; grid-template-columns:1.1fr 1fr; gap:30px; align-items:center; }
.realms .enquiry-card h2 { font-size:clamp(24px,3vw,32px); margin-bottom:10px; }
.realms .enquiry-copy p { color:#F1E5FB; font-size:16px; line-height:1.55; }
.realms .contacts { list-style:none; margin:0; padding:0; display:grid; gap:12px; }
.realms .contacts li { display:flex; flex-direction:column; }
.realms .contacts span { font-size:11px; letter-spacing:.16em; text-transform:uppercase; color:#E1CCF6; }
.realms .contacts em { font-style:normal; font-size:16px; }

.realms .main-auth { display:flex; align-items:center; justify-content:center; padding:clamp(24px,5vw,60px) 18px; }
.realms .auth-shell { width:100%; display:flex; justify-content:center; }
.realms .auth-card { width:min(430px,94vw); background:#fff; border:1px solid var(--line); border-radius:20px; padding:clamp(28px,4vw,40px); box-shadow:0 24px 60px rgba(122,52,168,.14); text-align:center; }
.realms .auth-mark { height:56px; width:auto; margin:0 auto 16px; }
.realms .auth-card h2 { font-size:22px; color:var(--p-deep); margin-bottom:6px; }
.realms .auth-sub { color:#7A6A93; font-size:14.5px; margin-bottom:22px; }
.realms .field { display:block; text-align:left; margin-bottom:14px; }
.realms .field.sm { margin-bottom:0; }
.realms .field span { display:block; font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:#7A6A93; margin-bottom:6px; }
.realms .field input, .realms .field select { width:100%; font-family:inherit; font-size:15px; padding:11px 13px; border:1.5px solid var(--line); border-radius:12px; color:var(--ink); background:#fff; }
.realms .field input:focus, .realms .field select:focus { outline:none; border-color:var(--p); }
.realms .auth-msg { background:var(--lav1); color:var(--p-deep); border:1px solid var(--line); border-radius:10px; padding:10px 12px; font-size:14px; margin-bottom:14px; }
.realms .auth-msg.block { max-width:none; margin:0 0 16px; }
.realms .linkbtn { display:block; width:100%; background:none; border:0; color:var(--p); font-size:14.5px; padding:12px 0 2px; }
.realms .linkbtn:hover { text-decoration:underline; }
.realms .linkbtn.subtle { color:#8A7AA6; font-size:13.5px; }
.realms .linkbtn.center { max-width:200px; margin:20px auto 0; }
.realms .demo-note { margin-top:16px; font-size:12.5px; color:#8A7AA6; font-style:italic; }

.realms .role-page { min-height:64vh; }
.realms .role-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:18px; max-width:900px; margin:0 auto; }
.realms .role-card { text-align:left; background:#fff; border:1.5px solid var(--line); border-radius:18px; padding:24px 22px; display:flex; flex-direction:column; gap:10px; transition:.18s; }
.realms .role-card:hover { border-color:var(--p); box-shadow:0 18px 44px rgba(122,52,168,.14); transform:translateY(-3px); }
.realms .role-icon { width:46px; height:46px; border-radius:12px; background:var(--lav1); color:var(--p); display:grid; place-items:center; }
.realms .role-icon svg { width:26px; height:26px; }
.realms .role-label { font-size:19px; font-weight:600; color:var(--p-deep); }
.realms .role-blurb { font-size:14px; line-height:1.5; color:#5A4C74; }

.realms .dash-head { border-bottom:1px solid var(--line); padding-bottom:22px; margin-bottom:22px; }
.realms .dash-hello { display:flex; align-items:center; gap:18px; }
.realms .dash-icon { width:58px; height:58px; border-radius:14px; background:linear-gradient(135deg,var(--p),var(--p-mid)); color:#fff; display:grid; place-items:center; }
.realms .dash-icon svg { width:30px; height:30px; }
.realms .dash-head h2 { font-size:clamp(24px,3vw,32px); color:var(--p-deep); }
.realms .dash-title { color:#7A6A93; font-size:14.5px; margin-top:2px; }
.realms .dash-intro { color:#5A4C74; font-size:16px; margin-bottom:24px; }
.realms .tool-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }
.realms .tool-card { text-align:left; display:flex; align-items:center; justify-content:space-between; gap:12px; background:#fff; border:1px solid var(--line); border-radius:14px; padding:20px; transition:.16s; }
.realms .tool-card.live:hover { border-color:var(--p); box-shadow:0 12px 30px rgba(122,52,168,.12); transform:translateY(-2px); }
.realms .tool-card:disabled { opacity:.75; cursor:default; }
.realms .tool-name { font-size:16px; color:var(--p-deep); font-weight:500; }
.realms .tool-stage { font-size:11.5px; letter-spacing:.06em; text-transform:uppercase; color:var(--v); background:var(--lav1); border:1px solid var(--line); border-radius:20px; padding:4px 10px; white-space:nowrap; }
.realms .tool-stage.ready { color:#fff; background:var(--p); border-color:var(--p); }

.realms .ptitle { position:sticky; top:0; z-index:20; display:flex; align-items:flex-end; justify-content:space-between; gap:16px; flex-wrap:wrap; margin:-8px 0 18px; padding:14px 0 12px; background:linear-gradient(180deg,var(--lav1) 70%,rgba(246,243,250,0)); backdrop-filter:blur(6px); }
.realms .ptitle h2 { font-size:26px; letter-spacing:-.015em; }
.realms .ptitle h2 { font-size:clamp(22px,2.6vw,30px); color:var(--p-deep); }
.realms .ptools { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
.realms .sel { font-family:inherit; font-size:14px; padding:10px 14px; border:1.5px solid var(--line); border-radius:22px; background:#fff; color:var(--ink); }
.realms .hintline { font-size:13px; color:#8A7AA6; margin-bottom:12px; }
.realms .warnline { font-size:13.5px; color:#9A5B12; background:#FBF3E6; border:1px solid #F0D9B5; border-radius:10px; padding:10px 12px; margin-bottom:14px; }
.realms .empty { color:#8A7AA6; font-style:italic; padding:24px 0; text-align:center; }
.realms .empty.sm { padding:12px 0; text-align:left; }

.realms .addform { background:var(--lav1); border:1px solid var(--line); border-radius:16px; padding:20px; margin-bottom:20px; }
.realms .fgrid { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:16px; }
.realms .fgrid.two { grid-template-columns:1fr 1fr; }

.realms .cluster { margin-bottom:20px; }
.realms .cluster-head { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
.realms .area-dot { width:12px; height:12px; border-radius:50%; }
.realms .cluster-head h3 { font-size:17px; color:var(--p-deep); }
.realms .cluster-count { font-size:12px; color:#8A7AA6; background:var(--lav1); border:1px solid var(--line); border-radius:20px; padding:2px 10px; }
.realms .frows { display:grid; gap:8px; }
.realms .frow { display:flex; align-items:center; justify-content:space-between; gap:12px; background:#fff; border:1px solid var(--line); border-radius:12px; padding:14px 16px; }
.realms .fmain { display:flex; flex-direction:column; }
.realms .fname { font-size:15.5px; color:var(--p-deep); font-weight:500; }
.realms .fmeta { font-size:13px; color:#7A6A93; }
.realms .factions { display:flex; align-items:center; gap:8px; }
.realms .pin.ok { color:#5FA35A; }
.realms .pin.no { font-size:12px; color:#B08; opacity:.6; }
.realms .mini { font-family:inherit; font-size:12.5px; padding:6px 12px; border-radius:18px; border:1px solid var(--line); background:#fff; color:var(--p); }
.realms .mini:hover { border-color:var(--p); }
.realms .mini.danger { color:#B4442E; }

.realms .map-page .map-frame { border:1px solid var(--line); border-radius:16px; overflow:hidden; }
.realms .leaflet-holder { height:min(60vh,540px); width:100%; }
.realms .route-list { list-style:none; margin:18px 0 0; padding:0; display:grid; gap:8px; }
.realms .route-list li { display:flex; align-items:center; gap:12px; background:#fff; border:1px solid var(--line); border-radius:12px; padding:12px 14px; }
.realms .route-list .rn { width:26px; height:26px; border-radius:50%; background:var(--p); color:#fff; display:grid; place-items:center; font-size:13px; font-weight:700; }
.realms .planner { margin-top:26px; }
.realms .planner-controls { display:flex; flex-wrap:wrap; align-items:center; gap:12px; margin-bottom:14px; }
.realms .field.inline { flex-direction:row; align-items:center; gap:8px; }
.realms .field.inline input { width:70px; }
.realms input[type=date] { width:180px !important; min-width:180px !important; flex:0 0 auto; box-sizing:border-box; }
@media (pointer:coarse){ .realms input[type=date] { width:200px !important; min-width:200px !important; font-size:16px; } }
.realms .plan-days { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:14px; }
.realms .plan-day { background:#fff; border:1px solid var(--line); border-left:3px solid var(--p); border-radius:12px; padding:14px 16px; }
.realms .plan-day-head { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:8px; }
.realms .plan-day-head h4 { color:var(--p-deep); font-size:15px; margin:0; flex:1; }
.realms .plan-count { font-size:11.5px; color:#8A7AA6; background:var(--lav2); border-radius:10px; padding:2px 9px; }
.realms .plan-list { margin:0; padding-left:20px; }
.realms .plan-list li { font-size:13px; color:#4A3B66; margin-bottom:5px; }
.realms .plan-list .pf-name { font-weight:500; color:#3A2B54; }
.realms .plan-list em { display:block; font-style:normal; color:#8A7AA6; font-size:12px; }

/* ===== Map & Route, redesigned ===== */
.realms .mr-page { max-width:1800px; }
.realms .mr-grid { display:grid; grid-template-columns:minmax(0,1.55fr) minmax(340px,1fr); gap:18px; align-items:start; }
.realms .mr-mapcol { position:sticky; top:84px; }
.realms .mr-mapcol .map-frame { border-radius:var(--r-lg); overflow:hidden; border:1px solid var(--line); box-shadow:var(--e2); }
.realms .mr-mapcol .leaflet-holder { height:min(66vh,620px); }
.realms .mr-legend { display:flex; align-items:center; flex-wrap:wrap; gap:14px; padding:10px 4px 0; font-size:12.5px; color:#5A4C74; }
.realms .lg-item { display:inline-flex; align-items:center; gap:7px; }
.realms .lg-dot { width:9px; height:9px; border-radius:50%; display:inline-block; }
.realms .mr-side { display:flex; flex-direction:column; gap:12px; min-width:0; }
.realms .mr-tabs { width:100%; }
.realms .mr-tabs .segb { flex:1; }
.realms .area-seg { flex-wrap:wrap; }
.realms .area-seg .segb { display:inline-flex; align-items:center; gap:7px; }
.realms .seg-n { font-size:11px; font-weight:600; background:var(--lav2); color:var(--p-deep); border-radius:9px; padding:1px 7px; font-variant-numeric:tabular-nums; }
.realms .area-seg .segb.on .seg-n { background:rgba(255,255,255,.24); color:#fff; }
@media (max-width:620px){ .realms .area-seg { width:100%; } .realms .area-seg .segb { flex:1; justify-content:center; } }
.realms .mr-card { background:#fff; border:1px solid var(--line); border-radius:var(--r-lg); padding:16px; box-shadow:var(--e1); }
.realms .mr-controls { display:grid; gap:10px; margin-bottom:12px; }
.realms .mr-two { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.realms .mr-days { display:grid; gap:8px; }
.realms .mr-day { background:#fff; border:1px solid var(--line); border-radius:var(--r-md); overflow:hidden; transition:border-color .15s ease, box-shadow .15s ease; }
.realms .mr-day.open { border-color:var(--p); box-shadow:var(--e2); }
.realms .mr-day-head { width:100%; display:flex; align-items:center; gap:12px; padding:12px 14px; background:none; border:0; cursor:pointer; text-align:left; min-height:var(--tap); }
.realms .mr-day-n { flex:0 0 auto; width:28px; height:28px; border-radius:50%; background:var(--lav2); color:var(--p-deep); display:grid; place-items:center; font-size:13px; font-weight:700; }
.realms .mr-day.open .mr-day-n { background:var(--p); color:#fff; }
.realms .mr-day-t { flex:1; min-width:0; display:flex; flex-direction:column; }
.realms .mr-day-t strong { font-size:14px; color:#3A2B54; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.realms .mr-day-t em { font-style:normal; font-size:12px; color:#8A7AA6; }
.realms .mr-day-c { color:var(--v); font-size:18px; line-height:1; }
.realms .mr-day-body { padding:0 14px 14px; border-top:1px solid var(--lav2); }
.realms .mr-day-body .plan-list { margin-top:12px; max-height:320px; overflow-y:auto; }
.realms .mr-day-actions { display:flex; gap:8px; margin:12px 0 0; }
.realms .pf-tel { color:var(--p-mid) !important; }
/* second assessment */
.realms .sa-list { margin-top:12px; display:flex; flex-direction:column; gap:10px; }
.realms .sa-item { border:1px solid var(--line); border-radius:var(--r-lg); background:#fff; overflow:hidden; box-shadow:var(--e1); }
.realms .sa-item.open { border-color:var(--p); }
.realms .sa-head { width:100%; display:flex; align-items:center; gap:12px; padding:13px 16px; background:none; border:0; cursor:pointer; text-align:left; }
.realms .sa-head.static { cursor:default; }
.realms .sa-name { flex:1 1 auto; display:flex; flex-direction:column; min-width:0; }
.realms .sa-name strong { font-size:15px; color:#3A2B54; }
.realms .sa-name em { font-style:normal; font-size:12.5px; color:#8A7AA6; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.realms .sa-meta { display:flex; align-items:center; gap:8px; font-size:12.5px; color:#6B5B87; flex:0 0 auto; }
.realms .sa-tog { flex:0 0 auto; font-size:13px; font-weight:600; color:var(--p); padding:4px 12px; border:1.5px solid var(--lav2); border-radius:999px; }
.realms .sa-body { padding:4px 16px 16px; border-top:1px solid var(--lav2); }
.realms .sa-cmp { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin:12px 0; }
.realms .sa-col h4 { margin:0 0 10px; font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:var(--p-deep); }
.realms .sa-basecol { background:var(--lav1,#F7F3FC); border-radius:12px; padding:12px 14px; }
.realms .sa-row { display:flex; gap:8px; padding:5px 0; border-bottom:1px dashed var(--lav2); font-size:13px; }
.realms .sa-row:last-child { border-bottom:0; }
.realms .sa-lab { flex:0 0 42%; color:#7A6A93; }
.realms .sa-val { flex:1 1 auto; color:#3A2B54; }
.realms .sa-recs { margin:6px 0 4px; }
.realms .sa-recs h4 { margin:0 0 8px; font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:var(--p-deep); }
.realms .sa-rec { display:flex; align-items:flex-start; gap:10px; padding:8px 0; border-bottom:1px dashed var(--lav2); }
.realms .sa-rec-t { flex:1 1 auto; font-size:13px; color:#4A3B66; }
.realms .sa-rec-pills { flex:0 0 auto; display:flex; gap:4px; }
.realms .sa-pill { font-size:11.5px; padding:5px 10px; border-radius:999px; border:1.5px solid var(--line); background:#fff; color:#8A7AA6; cursor:pointer; touch-action:manipulation; min-height:34px; }
.realms .sa-pill.on.g { background:#E7F5EC; border-color:#3E9B5F; color:#256B3E; }
.realms .sa-pill.on.a { background:#FBF1DE; border-color:#C98A1E; color:#8A5D0E; }
.realms .sa-pill.on.r { background:#FBE9E7; border-color:#C0503C; color:#8A2E1E; }
.realms .sa-improve { display:flex; align-items:center; justify-content:space-between; gap:12px; margin:12px 0; padding:12px 14px; background:var(--lav1,#F7F3FC); border-radius:12px; }
.realms .sa-improve-l { font-size:12px; letter-spacing:.06em; text-transform:uppercase; color:#7A6A93; }
.realms .sa-improve-r { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.realms .sa-verdict { font-size:12.5px; font-weight:700; padding:4px 12px; border-radius:999px; }
.realms .sa-verdict.g { background:#E7F5EC; color:#256B3E; }
.realms .sa-verdict.a { background:#FBF1DE; color:#8A5D0E; }
.realms .sa-verdict.r { background:#FBE9E7; color:#8A2E1E; }
.realms .sa-delta { font-size:12px; font-variant-numeric:tabular-nums; padding:3px 9px; border-radius:999px; background:#fff; border:1px solid var(--line); color:#5A4B76; }
.realms .sa-delta.g { color:#256B3E; border-color:#B7E0C4; }
.realms .sa-delta.r { color:#8A2E1E; border-color:#EBC3BB; }
@media (max-width:820px){ .realms .sa-cmp { grid-template-columns:1fr; } .realms .sa-head { flex-wrap:wrap; } .realms .sa-meta { width:100%; } }
.realms .mr-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
.realms .mr-stat { background:#fff; border:1px solid var(--line); border-radius:var(--r-sm); padding:12px 8px; text-align:center; }
.realms .mr-stat .v { display:block; font-family:Lora,serif; font-size:20px; font-weight:700; color:var(--p-deep); font-variant-numeric:tabular-nums; }
.realms .mr-stat .l { display:block; font-size:10.5px; color:#8A7AA6; text-transform:uppercase; letter-spacing:.05em; margin-top:2px; }
.realms .mr-side .hq-tr { grid-template-columns:2fr 1fr 1fr 1fr; font-size:12.5px; padding:9px 12px; }
@media (max-width:1100px){
  .realms .mr-grid { grid-template-columns:1fr; }
  .realms .mr-mapcol { position:static; }
  .realms .mr-mapcol .leaflet-holder { height:44vh; }
}
.realms .appr-chip { font-size:11.5px; border-radius:10px; padding:2px 9px; border:1px solid; }
.realms .appr-chip.pending { background:#FBF3E6; color:#9A5B12; border-color:#F0D9B5; }
.realms .appr-chip.approved { background:#E6F4EA; color:#2E7D46; border-color:#BFE3CB; }
.realms .appr-chip.returned { background:#FBE9E6; color:#B4442E; border-color:#F0C9BF; }
.realms .mini.ok { border-color:#BFE3CB; color:#2E7D46; }
.realms .mini.warn { border-color:#F0D9B5; color:#9A5B12; background:#FBF3E6; }
.realms .mini.ok:hover { background:#E6F4EA; }
.realms .submit-panel { background:#fff; border:1px solid var(--line); border-left:3px solid var(--p); border-radius:12px; padding:16px 18px; margin-bottom:18px; }
.realms .submit-head { margin-bottom:12px; }
.realms .submit-head h3 { color:var(--p-deep); font-size:16px; margin-bottom:2px; }
.realms .submit-row { display:flex; flex-wrap:wrap; align-items:center; gap:10px; }
.realms .plan-assign { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; padding-top:10px; border-top:1px solid var(--lav2); }
.realms .plan-assign .sel { font-size:13px; padding:6px 10px; }
.realms .myday { background:var(--lav1); border:1px solid var(--line); border-left:3px solid var(--p); border-radius:12px; padding:14px 16px; margin-bottom:20px; }
.realms .myday-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
.realms .myday-head h3 { color:var(--p-deep); font-size:16px; margin:0; }
.realms .pending-card { max-width:520px; margin:0 auto; text-align:center; background:#fff; border:1px solid var(--line); border-radius:18px; padding:38px 32px; box-shadow:0 12px 34px rgba(58,21,96,.08); }
.realms .pending-ic { display:grid; place-items:center; width:60px; height:60px; border-radius:50%; background:var(--lav2); color:var(--p-deep); margin:0 auto 16px; }
.realms .pending-card h2 { color:var(--p-deep); font-size:22px; margin-bottom:10px; }
.realms .pending-card p { color:#5A4C74; margin-bottom:8px; }
.realms .cta-row.center { justify-content:center; }
.realms .int-alert { background:#FBE9E6; border:1px solid #F0C9BF; border-left:3px solid #B4442E; border-radius:var(--r-md); padding:14px 16px; margin-bottom:16px; }
.realms .int-alert h3 { color:#B4442E; font-size:15px; margin-bottom:8px; }
.realms .int-alert .log-list { border:none; }
.realms .int-tr { grid-template-columns:1.6fr .6fr .8fr .8fr .8fr .7fr 1.6fr; }
.realms .int-flag { background:#FFFBF3; }
.realms .int-flags { display:flex; flex-wrap:wrap; gap:4px; }
.realms .int-flags em { font-style:normal; font-size:11px; background:#FBF3E6; color:#9A5B12; border:1px solid #F0D9B5; border-radius:9px; padding:2px 7px; }
.realms .frow.picked { border-color:var(--p); background:var(--lav2); }
.realms .fchips { display:flex; flex-wrap:wrap; gap:6px; margin-top:6px; }
.realms .reg-chip, .realms .state-chip { font-size:11px; border-radius:9px; padding:2px 8px; border:1px solid; }
.realms .reg-chip.ok { background:#E6F4EA; color:#2E7D46; border-color:#BFE3CB; }
.realms .reg-chip.prog { background:#FBF3E6; color:#9A5B12; border-color:#F0D9B5; }
.realms .reg-chip.no { background:#FBE9E6; color:#B4442E; border-color:#F0C9BF; }
.realms .state-chip { background:var(--lav2); color:var(--p-deep); border-color:var(--line); }
.realms .state-chip.dead { background:#F1EFF4; color:#8A7AA6; }
.realms .state-chip.find { background:#EAF2FB; color:#2E6B8A; border-color:#C9DEF0; }
.realms .fremark { display:block; margin-top:5px; font-size:12px; color:#8A7AA6; font-style:italic; }
.realms .list-tools-row { display:flex; flex-wrap:wrap; gap:10px; align-items:center; }
.realms .numfield .num-row { display:flex; align-items:stretch; border:1px solid var(--line); border-radius:10px; overflow:hidden; background:#fff; }
.realms .num-btn { flex:0 0 auto; width:46px; min-height:46px; border:0; background:var(--lav1); color:var(--p-deep); font-size:20px; line-height:1; cursor:pointer; touch-action:manipulation; -webkit-tap-highlight-color:transparent; }
.realms .num-btn:active { background:var(--lav2); }
.realms .num-btn:disabled { color:#C9BEDA; cursor:default; }
.realms .num-in { flex:1; min-width:0; width:100%; border:0; text-align:center; font-family:inherit; font-size:16px; font-variant-numeric:tabular-nums; color:var(--ink); background:#fff; min-height:46px; padding:0 4px; }
.realms .num-in:focus { outline:none; box-shadow:inset 0 0 0 2px var(--lav2); }
.realms .num-hint { display:block; font-style:normal; font-size:11.5px; color:#8A7AA6; margin-top:4px; }

/* ===== tablets =====
   Two things break forms on iPad specifically. Any input under 16px makes Safari
   zoom the whole page on focus, which throws the layout and feels like the field
   is fighting you. And taps carry a highlight flash and a delay unless told not to. */
@media (pointer: coarse) {
  .realms input, .realms select, .realms textarea,
  .realms .sel, .realms .searchbox, .realms .hef-input, .realms .num-in { font-size:16px; }
  .realms button, .realms .btn, .realms .mini, .realms .segb, .realms .num-btn, .realms .tab, .realms a.mini {
    touch-action:manipulation; -webkit-tap-highlight-color:transparent;
  }
  .realms .field.sm span { font-size:12.5px; }
  /* A sticky header plus a blur is expensive on Safari and can leave artefacts. */
  .realms .ptitle { backdrop-filter:none; background:var(--lav1); }
}
@media (pointer: coarse) and (max-width:1100px) {
  .realms .mr-two { grid-template-columns:1fr 1fr; gap:12px; }
  .realms .mr-card { padding:18px; }
  .realms .plan-assign { flex-direction:column; align-items:stretch; }
  .realms .plan-assign .sel, .realms .plan-assign .btn { width:100%; }
}
.realms .band-note { text-align:center; max-width:720px; margin:16px auto 0; font-size:14px; color:#5A4C74; }

/* ===== UI upscale: tablet-first field ergonomics + depth ===== */
.realms .frow, .realms .rep-row, .realms .fu-card, .realms .saved-card { border-radius:var(--r-md); box-shadow:var(--e1); transition:box-shadow .18s ease, border-color .18s ease, transform .18s ease; }
.realms .frow:hover, .realms .rep-row:hover, .realms .fu-card:hover { box-shadow:var(--e2); border-color:var(--v); }
.realms .frow.pickable:hover { transform:translateY(-1px); }
.realms .mini { min-height:36px; border-radius:9px; padding:7px 13px; font-weight:500; transition:.15s; }
.realms .btn.small { min-height:40px; border-radius:22px; }
.realms .sel, .realms .searchbox, .realms .field input, .realms .field select, .realms .field textarea, .realms .hef-input { min-height:42px; border-radius:10px; transition:border-color .15s ease, box-shadow .15s ease; }
.realms .sel:focus, .realms .field input:focus, .realms .field select:focus, .realms .field textarea:focus { outline:none; border-color:var(--p); box-shadow:0 0 0 3px var(--lav2); }
.realms .cluster { margin-bottom:26px; }
.realms .cluster-head { position:sticky; top:64px; z-index:5; background:var(--lav1); padding:8px 0; margin-bottom:8px; border-bottom:1px solid var(--lav2); }
.realms .cluster-head h3 { font-size:15px; letter-spacing:-.01em; }
.realms .cluster-count { background:#fff; border:1px solid var(--line); border-radius:11px; padding:2px 9px; font-size:11.5px; color:#8A7AA6; }
.realms .an-card, .realms .settings-card, .realms .submit-panel, .realms .chat-wrap, .realms .plan-day, .realms .hq-table, .realms .enquiry { box-shadow:var(--e1); }
.realms .settings-card, .realms .submit-panel { border-radius:var(--r-lg); }
.realms .seg { border-radius:10px; }
.realms .segb { min-height:var(--tap); padding:9px 18px; font-size:13.5px; }
.realms .chkpill { min-height:40px; }
.realms .rag-btn, .realms .ragb { min-height:var(--tap); }
.realms .side-item, .realms .sidebar a, .realms .sidebar button { min-height:var(--tap); }
.realms .hef-sec > summary { min-height:48px; }
.realms .hef-sec { border-radius:var(--r-sm); }
.realms .hef-wrap, .realms .fu-card { border-radius:var(--r-lg); }

/* tablet: two-up analytics, roomier rows, larger type */
@media (min-width:760px) and (max-width:1180px){
  .realms .an-cards { grid-template-columns:repeat(3,1fr); }
  .realms .frow, .realms .rep-row { padding:16px 18px; }
  .realms .fname { font-size:15.5px; }
  .realms .mini { min-height:40px; padding:9px 15px; font-size:13.5px; }
  .realms .hef-fields { padding:16px; gap:16px; }
  .realms .plan-days { grid-template-columns:1fr 1fr; }
}
@media (hover:none){
  .realms .mini { min-height:var(--tap); }
  .realms .frow:hover, .realms .rep-row:hover { transform:none; }
}

.realms .route-list em { margin-left:auto; font-style:normal; font-size:13px; color:#8A7AA6; }

.realms .assign-grid { display:grid; grid-template-columns:1.3fr 1fr; gap:24px; }
.realms .assign-form, .realms .assign-saved { background:#fff; border:1px solid var(--line); border-radius:16px; padding:20px; }
.realms .pick-label { font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:#7A6A93; margin:14px 0 8px; }
.realms .pick-list { display:grid; gap:6px; max-height:260px; overflow:auto; margin-bottom:8px; }
.realms .pick-row { display:flex; align-items:center; gap:10px; font-size:14.5px; padding:8px 10px; border:1px solid var(--line); border-radius:10px; }
.realms .pick-row .nocoord { margin-left:auto; font-style:normal; font-size:11px; color:#B08; opacity:.7; }
.realms .saved-card { border:1px solid var(--line); border-radius:12px; padding:12px 14px; margin-bottom:10px; }
.realms .saved-card strong { color:var(--p-deep); margin-right:8px; }
.realms .saved-card span { font-size:13px; color:#7A6A93; }
.realms .saved-card em { display:block; font-style:normal; font-size:12.5px; color:#8A7AA6; margin-top:2px; }
.realms .saved-card p { font-size:13px; color:#5A4C74; margin-top:4px; }

.realms .foot { background:#4C3B66; color:#EADAF7; padding:clamp(32px,4vw,52px) clamp(18px,4vw,56px); }
.realms .foot-inner { max-width:1800px; margin:0 auto; text-align:center; display:grid; gap:8px; justify-items:center; }
.realms .foot-brand { display:flex; align-items:center; justify-content:center; gap:12px; font-size:15px; color:#fff; }
.realms .foot-mark { height:32px; width:auto; }
.realms .foot p { font-size:14px; }
.realms .foot-tag { font-style:italic; color:#CDA9EC; margin-top:4px; }

@media (max-width:920px){
  .realms .hero { grid-template-columns:1fr; text-align:center; }
  .realms .lede { max-width:none; margin:0 auto; }
  .realms .cta-row { justify-content:center; }
  .realms .hero-art { order:-1; }
  .realms .home-strip { grid-template-columns:1fr 1fr; }
  .realms .stages { grid-template-columns:1fr 1fr; gap:32px; }
  .realms .wave { display:none; }
  .realms .pillars, .realms .mandate-grid, .realms .principles { grid-template-columns:1fr; }
  .realms .enquiry-card { grid-template-columns:1fr; text-align:center; }
  .realms .contacts { justify-items:center; }
  .realms .role-grid, .realms .tool-grid { grid-template-columns:1fr 1fr; }
  .realms .fgrid { grid-template-columns:1fr 1fr; }
  .realms .assign-grid { grid-template-columns:1fr; }
}
@media (max-width:900px){
  .realms .bar { display:flex; flex-wrap:wrap; justify-content:space-between; }
  .realms .bar .tabs { order:3; width:100%; max-width:100%; justify-self:auto; overflow-x:auto; -webkit-overflow-scrolling:touch; }
  .realms .bar-right { justify-self:auto; }
  .realms .home-strip { grid-template-columns:1fr; }
  .realms .stages, .realms .role-grid, .realms .tool-grid, .realms .fgrid, .realms .fgrid.two { grid-template-columns:1fr; }
}

.realms .stepper { list-style:none; display:flex; gap:8px; padding:0; margin:0 0 22px; flex-wrap:wrap; }
.realms .stepper .stp { display:flex; align-items:center; gap:8px; font-size:13.5px; color:#8A7AA6; background:var(--lav1); border:1px solid var(--line); border-radius:22px; padding:7px 14px; }
.realms .stepper .stp span { width:22px; height:22px; border-radius:50%; background:#fff; border:1px solid var(--line); display:grid; place-items:center; font-size:12px; font-weight:700; color:#8A7AA6; }
.realms .stepper .stp.on { color:var(--p-deep); border-color:var(--p); background:#fff; font-weight:600; }
.realms .stepper .stp.on span { background:var(--p); color:#fff; border-color:var(--p); }
.realms .stepper .stp.done span { background:var(--v); color:#fff; border-color:var(--v); }
.realms .frow.pickable { width:100%; text-align:left; cursor:pointer; }
.realms .frow.pickable:hover { border-color:var(--p); }
.realms .engage-card { background:#fff; border:1px solid var(--line); border-radius:16px; padding:24px; max-width:640px; }
.realms .fbig { font-size:22px; color:var(--p-deep); margin:6px 0 4px; }
.realms .fsub { color:#7A6A93; font-size:14px; margin-bottom:16px; }
.realms .ci-row { display:flex; justify-content:space-between; padding:12px 0; border-top:1px solid var(--line); font-size:15px; }
.realms .ci-row span { color:#7A6A93; }
.realms .ci-row em { font-style:normal; color:var(--p-deep); }
.realms .btnrow { display:flex; gap:10px; flex-wrap:wrap; margin-top:18px; }
.realms .engage-present { display:grid; grid-template-columns:1.1fr .9fr; gap:22px; align-items:start; }
.realms .letter { background:#fff; border:1px solid var(--line); border-radius:16px; padding:26px; box-shadow:0 10px 30px rgba(122,52,168,.08); }
.realms .letter-head { display:flex; align-items:center; gap:12px; border-bottom:2px solid var(--lav2); padding-bottom:14px; margin-bottom:14px; }
.realms .letter-head img { height:44px; }
.realms .letter-head strong { display:block; font-size:12.5px; letter-spacing:.04em; color:var(--p-deep); }
.realms .letter-head span { font-size:11.5px; color:#8A7AA6; }
.realms .letter-meta { display:flex; justify-content:space-between; font-size:12.5px; color:#8A7AA6; margin-bottom:16px; }
.realms .letter-to { font-size:14px; line-height:1.5; margin-bottom:14px; color:#4A3B66; }
.realms .letter-sub { margin-bottom:12px; color:var(--p-deep); }
.realms .letter p { font-size:14px; line-height:1.6; color:#4A3B66; margin-bottom:12px; }
.realms .letter-sign { margin-top:18px; font-size:14px; color:var(--p-deep); }
.realms .letter-sign span { color:#8A7AA6; font-size:13px; }
.realms .idcards { display:grid; gap:10px; margin-bottom:12px; }
.realms .idwrap { display:flex; align-items:center; gap:8px; }
.realms .idcard { flex:1; display:flex; align-items:center; gap:12px; background:linear-gradient(135deg,#fff,var(--lav1)); border:1px solid var(--line); border-left:4px solid var(--p); border-radius:12px; padding:12px 14px; }
.realms .idmark { height:36px; }
.realms .idbody { display:flex; flex-direction:column; }
.realms .idname { font-size:15px; font-weight:600; color:var(--p-deep); }
.realms .idrole { font-size:13px; color:#5A4C74; }
.realms .idorg { font-size:10.5px; letter-spacing:.08em; text-transform:uppercase; color:#9C86B8; margin-top:2px; }
.realms .addmember { display:flex; gap:8px; margin-bottom:16px; }
.realms .addmember input { flex:1; font-family:inherit; font-size:13.5px; padding:9px 11px; border:1.5px solid var(--line); border-radius:10px; min-width:0; }
.realms .script { margin:0 0 4px; background:var(--lav1); border-left:3px solid var(--v); border-radius:0 10px 10px 0; padding:14px 16px; font-style:italic; color:#4A3B66; font-size:14px; line-height:1.6; }
.realms .greet { display:flex; align-items:flex-start; gap:10px; margin:18px 0 4px; font-size:14.5px; color:#4A3B66; }
.realms .greet input { margin-top:3px; }
.realms .engage-done { text-align:center; max-width:520px; margin:6vh auto 0; }
.realms .done-badge { display:inline-block; background:#E6F4EA; color:#2E7D46; border:1px solid #BFE3CB; border-radius:20px; padding:5px 16px; font-size:12.5px; letter-spacing:.08em; text-transform:uppercase; margin-bottom:16px; }
.realms .engage-done h2 { font-size:28px; color:var(--p-deep); margin-bottom:8px; }
.realms .engage-done .muted { color:#8A7AA6; margin:8px 0 20px; }
@media (max-width:920px){ .realms .engage-present { grid-template-columns:1fr; } }

.realms .net { font-size:11.5px; letter-spacing:.06em; text-transform:uppercase; padding:5px 12px; border-radius:20px; border:1px solid var(--line); }
.realms .net.on { color:#2E7D46; background:#E6F4EA; border-color:#BFE3CB; }
.realms .net.off { color:#B4442E; background:#FBE9E6; border-color:#F0C9BF; }
.realms .chip { display:inline-block; font-size:12px; letter-spacing:.04em; padding:4px 12px; border-radius:20px; border:1px solid var(--line); white-space:nowrap; }
.realms .chip.green { color:#2E7D46; background:#E6F4EA; border-color:#BFE3CB; }
.realms .chip.amber { color:#9A5B12; background:#FBF3E6; border-color:#F0D9B5; }
.realms .chip.red { color:#B4442E; background:#FBE9E6; border-color:#F0C9BF; }
.realms .chip.none, .realms .chip.engaged, .realms .chip.monitored { color:#7A6A93; background:var(--lav1); }
.realms .mon-list { display:grid; gap:10px; }
.realms .mon-row { display:flex; align-items:center; justify-content:space-between; gap:12px; background:#fff; border:1px solid var(--line); border-radius:12px; padding:14px 16px; text-align:left; cursor:pointer; }
.realms .mon-row:hover { border-color:var(--p); }
.realms .mon-right { display:flex; align-items:center; gap:12px; }
.realms .mon-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; flex-wrap:wrap; border-bottom:1px solid var(--line); padding-bottom:16px; margin-bottom:18px; }
.realms .mon-head h2 { font-size:clamp(22px,2.6vw,28px); color:var(--p-deep); margin-top:6px; }
.realms .mon-head-r { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.realms .rated { font-size:12.5px; color:#8A7AA6; }
.realms .mcat { border:1px solid var(--line); border-radius:14px; padding:16px 18px; margin-bottom:14px; background:#fff; }
.realms .mcat-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px; }
.realms .mcat-head h3 { font-size:17px; color:var(--p-deep); }
.realms .mitems { display:grid; gap:14px; }
.realms .mitem { border-top:1px solid var(--lav2); padding-top:12px; }
.realms .mitem:first-child { border-top:0; padding-top:0; }
.realms .mitem-top { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.realms .mlabel { font-size:15px; color:#3A2B54; }
.realms .rag { display:flex; gap:6px; }
.realms .ragb { width:34px; height:34px; border-radius:9px; border:1.5px solid var(--line); background:#fff; font-weight:700; font-size:13px; color:#8A7AA6; }
.realms .ragb.green.on { background:#2E7D46; border-color:#2E7D46; color:#fff; }
.realms .ragb.amber.on { background:#C77D0A; border-color:#C77D0A; color:#fff; }
.realms .ragb.red.on { background:#B4442E; border-color:#B4442E; color:#fff; }
.realms .mnote { width:100%; font-family:inherit; font-size:14px; padding:8px 11px; border:1.5px solid var(--line); border-radius:10px; margin-top:10px; resize:vertical; color:var(--ink); }
.realms .mnote:focus { outline:none; border-color:var(--p); }
.realms .evrow { display:flex; align-items:center; gap:8px; margin-top:10px; flex-wrap:wrap; }
.realms .ev-btn { font-size:12.5px; padding:7px 13px; border:1px solid var(--line); border-radius:18px; background:#fff; color:var(--p); cursor:pointer; }
.realms .ev-btn:hover { border-color:var(--p); }
.realms .ev-btn input { display:none; }
.realms .ev-btn.recording { background:#FBE9E6; color:#B4442E; border-color:#F0C9BF; }
.realms .geotag { font-size:11.5px; color:#2E7D46; }
.realms .evstrip { display:flex; gap:10px; flex-wrap:wrap; margin-top:12px; }
.realms .evthumb { position:relative; }
.realms .evthumb img { width:64px; height:64px; object-fit:cover; border-radius:8px; border:1px solid var(--line); }
.realms .evthumb audio { height:34px; }
.realms .evx { position:absolute; top:-8px; right:-8px; width:20px; height:20px; border-radius:50%; border:0; background:#B4442E; color:#fff; font-size:13px; line-height:1; cursor:pointer; }
.realms .mon-actions { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-top:20px; }
.realms .save-note { font-size:13px; color:#8A7AA6; font-style:italic; }
@media (max-width:680px){ .realms .mitem-top { flex-direction:column; align-items:flex-start; gap:8px; } }

.realms .dsec { border:1px solid var(--line); border-radius:14px; padding:18px; margin-bottom:14px; background:#fff; }
.realms .dsec h3 { font-size:17px; color:var(--p-deep); margin-bottom:12px; }
.realms .dstr { margin:0; padding-left:20px; }
.realms .dstr li { font-size:14.5px; color:#3A2B54; margin-bottom:5px; }
.realms .gap { border-top:1px solid var(--lav2); padding-top:12px; margin-top:12px; }
.realms .gap:first-child { border-top:0; padding-top:0; margin-top:0; }
.realms .gap-top { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px; }
.realms .gap-label { font-size:15px; color:#3A2B54; }
.realms .chkfield .inl { display:flex; align-items:center; gap:8px; font-size:14.5px; color:#4A3B66; padding:11px 0; }
.realms .sigwrap { display:flex; flex-direction:column; align-items:flex-start; gap:8px; }
.realms .sigpad { width:100%; max-width:600px; height:170px; border:1.5px dashed var(--line); border-radius:12px; background:#fff; touch-action:none; cursor:crosshair; }

.realms .rep-rows { display:grid; gap:10px; }
.realms .rep-row { display:flex; align-items:center; gap:12px; flex-wrap:wrap; background:#fff; border:1px solid var(--line); border-radius:12px; padding:14px 16px; }
.realms .rep-main { display:flex; flex-direction:column; flex:1 1 200px; }
.realms .rep-actions { display:flex; gap:8px; flex-wrap:wrap; }
.realms .notify { flex-basis:100%; display:flex; align-items:center; gap:10px; flex-wrap:wrap; border-top:1px solid var(--lav2); margin-top:6px; padding-top:12px; }
.realms .notify .hintline { margin:0; }
.realms .an-cards { display:grid; grid-template-columns:repeat(6,1fr); gap:12px; margin-bottom:20px; }
.realms .an-card { position:relative; overflow:hidden; background:#fff; border:1px solid var(--line); border-radius:var(--r-md); padding:18px 16px; text-align:left; box-shadow:var(--e1); transition:box-shadow .18s ease, transform .18s ease; }
.realms .an-card:hover { box-shadow:var(--e2); transform:translateY(-2px); }
.realms .an-card::before { content:''; position:absolute; left:0; top:0; bottom:0; width:3px; background:linear-gradient(180deg,var(--p),var(--v)); }
.realms .an-v { display:block; font-family:Lora,serif; font-size:30px; font-weight:700; color:var(--p-deep); line-height:1; margin-bottom:6px; letter-spacing:-.02em; font-variant-numeric:tabular-nums; }
.realms .an-l { font-size:11.5px; color:#8A7AA6; text-transform:uppercase; letter-spacing:.06em; }
.realms .an-two { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }
.realms .an-panel { background:#fff; border:1px solid var(--line); border-radius:14px; padding:18px; margin-bottom:16px; }
.realms .an-panel h3 { font-size:16px; color:var(--p-deep); margin-bottom:14px; }
.realms .bars { display:grid; gap:12px; }
.realms .bar-row { display:flex; align-items:center; gap:12px; }
.realms .bar-lab { width:110px; font-size:13.5px; color:#5A4C74; flex-shrink:0; }
.realms .bar-track { flex:1; height:14px; background:var(--lav1); border-radius:8px; overflow:hidden; }
.realms .bar-fill { height:100%; background:linear-gradient(90deg,var(--p),var(--v)); border-radius:8px; }
.realms .bar-fill.green { background:#2E7D46; } .realms .bar-fill.amber { background:#C77D0A; } .realms .bar-fill.red { background:#B4442E; }
.realms .bar-n { width:34px; text-align:right; font-size:13.5px; color:var(--p-deep); font-weight:600; }
@media (max-width:920px){ .realms .an-cards { grid-template-columns:repeat(3,1fr); } .realms .an-two { grid-template-columns:1fr; } }
@media (max-width:560px){ .realms .an-cards { grid-template-columns:1fr 1fr; } }

.realms .app-bar .tabs { overflow-x:auto; max-width:min(64vw,760px); scrollbar-width:thin; }
.realms .notify { flex-basis:100%; display:flex; flex-direction:column; gap:8px; border-top:1px solid var(--lav2); margin-top:6px; padding-top:12px; }
.realms .notify-row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.realms .ninput { font-family:inherit; font-size:13px; padding:8px 11px; border:1.5px solid var(--line); border-radius:10px; min-width:180px; }
.realms .ninput:focus { outline:none; border-color:var(--p); }
.realms .mini.ghosted { color:#8A7AA6; border-style:dashed; }
.realms .nstat { font-size:12.5px; color:#7A6A93; font-style:italic; }

/* ===== app shell: top bar + left sidebar ===== */
.realms.app-mode { display:flex; flex-direction:column; min-height:100vh; }
.realms .topbar { position:sticky; top:0; z-index:1000; display:flex; align-items:center; justify-content:space-between; gap:16px; padding:10px clamp(14px,3vw,28px); background:linear-gradient(90deg,#4C3B66,#574277); color:#fff; }
.realms .tb-left, .realms .tb-right { display:flex; align-items:center; gap:14px; }
.realms .topbar .mark { height:34px; background:#fff; border-radius:8px; padding:2px; }
.realms .tb-name { font-size:16px; letter-spacing:.14em; font-weight:600; }
.realms .navtoggle { display:none; background:rgba(255,255,255,.15); border:0; color:#fff; width:38px; height:38px; border-radius:10px; align-items:center; justify-content:center; }
.realms .navtoggle svg { width:20px; height:20px; }
.realms .ws { display:flex; align-items:center; gap:8px; margin-left:8px; background:rgba(255,255,255,.14); padding:4px 10px 4px 12px; border-radius:24px; }
.realms .ws label { font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:#E7D8F6; }
.realms .ws select { font-family:inherit; font-size:14px; background:#fff; color:var(--p-deep); border:0; border-radius:16px; padding:6px 10px; }
.realms .topbar .who { font-size:14.5px; color:#F1E5FB; }
.realms .topbar .signin { border:1.5px solid rgba(255,255,255,.5); color:#fff; background:none; }
.realms .topbar .signin:hover { background:#fff; color:var(--p-deep); }
.realms .shell { flex:1; display:flex; align-items:flex-start; }
.realms .sidebar { position:sticky; top:56px; align-self:flex-start; width:214px; flex-shrink:0; height:calc(100vh - 56px); background:#fff; border-right:1px solid var(--line); display:flex; flex-direction:column; padding:14px 12px; transition:width .18s ease; }
.realms .sidebar.collapsed { width:66px; }
.realms .sb-head { padding:6px 10px 12px; }
.realms .sb-role { font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:var(--v); font-weight:600; }
.realms .sidebar.collapsed .sb-head { opacity:0; height:0; padding:0; }
.realms .sb-nav { display:flex; flex-direction:column; gap:4px; flex:1; overflow-y:auto; }
.realms .sb-item { display:flex; align-items:center; gap:12px; padding:10px 12px; border:0; background:none; border-radius:10px; color:#5A4C74; font-size:14.5px; text-align:left; width:100%; transition:.14s; }
.realms .sb-item:hover { background:var(--lav1); color:var(--p); }
.realms .sb-item.active { background:linear-gradient(90deg,var(--p),var(--p-mid)); color:#fff; box-shadow:0 6px 16px rgba(122,52,168,.24); }
.realms .sb-ico { width:22px; height:22px; flex-shrink:0; display:grid; place-items:center; position:relative; }
.realms .sb-ico svg { width:20px; height:20px; }
.realms .sb-badge-lab { margin-left:auto; min-width:20px; height:20px; padding:0 6px; border-radius:10px; background:#B4442E; color:#fff; font-size:11.5px; font-weight:700; display:inline-flex; align-items:center; justify-content:center; font-variant-numeric:tabular-nums; }
.realms .sb-item.active .sb-badge-lab { background:#fff; color:var(--p); }
.realms .sb-badge { display:none; position:absolute; top:-6px; left:12px; min-width:16px; height:16px; padding:0 4px; border-radius:8px; background:#B4442E; color:#fff; font-size:10px; font-weight:700; align-items:center; justify-content:center; font-variant-numeric:tabular-nums; box-shadow:0 0 0 2px #fff; }
.realms .sidebar.collapsed .sb-badge { display:inline-flex; }
.realms .sidebar.collapsed .sb-badge-lab { display:none; }
.realms .sidebar.collapsed .sb-lab { display:none; }
.realms .sidebar.collapsed .sb-item { justify-content:center; padding:11px; }
.realms .sb-collapse { display:flex; align-items:center; gap:12px; padding:10px 12px; border:0; border-top:1px solid var(--line); background:none; color:#8A7AA6; font-size:13.5px; margin-top:8px; }
.realms .sb-collapse svg { width:18px; height:18px; }
.realms .sidebar.collapsed .sb-collapse { justify-content:center; }
.realms .scrim { display:none; }
.realms .app-main { flex:1; min-width:0; }
.realms .app-main .page { min-height:auto; }
@media (max-width:820px){
  .realms .navtoggle { display:flex; }
  .realms .ws { display:none; }
  .realms .sidebar { position:fixed; top:0; left:0; height:100vh; z-index:1200; transform:translateX(-100%); box-shadow:0 0 40px rgba(0,0,0,.2); width:230px; }
  .realms .sidebar.open { transform:none; }
  .realms .sidebar.collapsed { width:230px; }
  .realms .sidebar.collapsed .sb-lab, .realms .sidebar.collapsed .sb-head { display:block; opacity:1; height:auto; }
  .realms .sb-collapse { display:none; }
  .realms .scrim.show { display:block; position:fixed; inset:0; background:rgba(30,15,49,.4); z-index:1100; }
}

/* dashboard banner + quick stats */
.realms .dash-banner { position:relative; border-radius:18px; overflow:hidden; margin-bottom:16px; min-height:180px; display:flex; align-items:flex-end; }
.realms .dash-banner img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
.realms .dash-banner-in { position:relative; display:flex; align-items:center; gap:18px; padding:22px 24px; width:100%; background:linear-gradient(90deg,rgba(58,21,96,.86),rgba(58,21,96,.25)); color:#fff; }
.realms .dash-banner .dash-icon { background:rgba(255,255,255,.18); color:#fff; }
.realms .dash-banner h2 { color:#fff; font-size:clamp(24px,3vw,32px); }
.realms .dash-banner .eyebrow.light { color:#E7D8F6; }
.realms .dash-sub { color:#EAD9FA; font-style:italic; font-size:14px; margin-top:2px; }
.realms .dash-quick { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:20px; }
.realms .dq { background:var(--lav1); border:1px solid var(--line); border-radius:14px; padding:16px; text-align:center; }
.realms .dq-v { display:block; font-size:26px; font-weight:700; color:var(--p); }
.realms .dq-l { font-size:12.5px; color:#5A4C74; }

/* gallery */
.realms .gallery { max-width:1800px; margin:0 auto; padding:clamp(30px,4vw,56px) clamp(18px,4vw,56px); }
.realms .gallery-h { text-align:center; font-size:clamp(24px,3vw,34px); color:var(--p-deep); margin-bottom:26px; }
.realms .gal-grid { display:grid; grid-template-columns:repeat(4,1fr); grid-auto-rows:150px; gap:14px; }
.realms .gal { margin:0; position:relative; border-radius:16px; overflow:hidden; box-shadow:0 10px 26px rgba(58,21,96,.12); }
.realms .gal.big { grid-column:span 2; grid-row:span 2; }
.realms .gal img { width:100%; height:100%; object-fit:cover; transition:transform .5s ease; }
.realms .gal:hover img { transform:scale(1.06); }
.realms .gal figcaption { position:absolute; left:0; right:0; bottom:0; padding:22px 14px 10px; font-size:13px; color:#fff; background:linear-gradient(transparent,rgba(30,15,49,.8)); }

/* impact band */
.realms .impact { max-width:1800px; margin:10px auto 0; padding:0 clamp(18px,4vw,56px) clamp(40px,5vw,70px); display:grid; grid-template-columns:1fr 1fr; gap:0; }
.realms .impact-copy { background:linear-gradient(135deg,var(--p-deep),var(--p-mid)); color:#fff; border-radius:20px 0 0 20px; padding:clamp(28px,4vw,48px); }
.realms .impact-copy h2 { font-size:clamp(24px,3vw,32px); margin-bottom:12px; }
.realms .impact-copy p { color:#F1E5FB; line-height:1.6; margin-bottom:20px; }
.realms .impact-art { border-radius:0 20px 20px 0; overflow:hidden; }
.realms .impact-art img { width:100%; height:100%; object-fit:cover; }

/* pillar photos + about lead */
.realms .pillar.photo { padding-top:0; overflow:hidden; }
.realms .pillar-img { margin:-1px -28px 20px; height:300px; overflow:hidden; }
.realms .pillar-img img { width:100%; height:100%; object-fit:cover; object-position:center top; }
.realms .pillar.photo .pillar-rule { margin-left:28px; }
.realms .pillar.photo h3, .realms .pillar.photo p { padding:0 2px; }
.realms .about-lead { border-radius:18px; overflow:hidden; height:clamp(300px,42vw,470px); margin-bottom:24px; }
.realms .about-lead img { width:100%; height:100%; object-fit:cover; object-position:center; }

/* donut + ring */
.realms .donut { display:flex; align-items:center; gap:20px; flex-wrap:wrap; }
.realms .donut-svg { width:150px; height:150px; flex-shrink:0; }
.realms .donut-num { font-size:26px; font-weight:700; fill:var(--p-deep); }
.realms .donut-lab { font-size:10px; letter-spacing:.1em; text-transform:uppercase; fill:#8A7AA6; }
.realms .donut-legend { display:grid; gap:8px; }
.realms .dl { display:flex; align-items:center; gap:8px; font-size:14px; color:#4A3B66; }
.realms .dl .dot { width:12px; height:12px; border-radius:3px; }
.realms .dl em { font-style:normal; color:var(--p-deep); font-weight:600; margin-left:4px; }
.realms .ring-panel { display:flex; flex-direction:column; }
.realms .ring { display:flex; flex-direction:column; align-items:center; gap:8px; }
.realms .ring-svg { width:140px; height:140px; }
.realms .ring-num { font-size:24px; font-weight:700; fill:var(--p-deep); }
.realms .ring-lab { font-size:10px; letter-spacing:.1em; text-transform:uppercase; fill:#8A7AA6; }
.realms .ring-cap { font-size:13px; color:#7A6A93; text-align:center; }

@media (max-width:820px){
  .realms .gal-grid { grid-template-columns:1fr 1fr; grid-auto-rows:130px; }
  .realms .gal.big { grid-column:span 2; grid-row:span 1; }
  .realms .impact { grid-template-columns:1fr; }
  .realms .impact-copy { border-radius:20px 20px 0 0; }
  .realms .impact-art { border-radius:0 0 20px 20px; min-height:200px; }
  .realms .dash-quick { grid-template-columns:1fr 1fr 1fr; }
}

.realms .topbar .who { background:none; border:0; cursor:pointer; }
.realms .topbar .who:hover { text-decoration:underline; }
.realms .viewas-bar { display:flex; align-items:center; justify-content:center; gap:12px; flex-wrap:wrap; background:#FBF3E6; color:#9A5B12; border-bottom:1px solid #F0D9B5; padding:8px 16px; font-size:13.5px; }
.realms .viewas-bar button { background:#9A5B12; color:#fff; border:0; border-radius:16px; padding:5px 12px; font-size:12.5px; cursor:pointer; }
.realms .seed-card { display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; background:var(--lav1); border:1px solid var(--line); border-radius:14px; padding:16px 18px; margin-bottom:16px; }
.realms .seed-card strong { color:var(--p-deep); display:block; margin-bottom:2px; }
.realms .seed-card span { color:#5A4C74; font-size:13.5px; }
.realms .clear-row { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; background:#FBF3E6; border:1px solid #F0D9B5; border-radius:12px; padding:12px 16px; margin:0 0 20px; font-size:13.5px; color:#9A5B12; }
.realms .db-error { display:flex; flex-direction:column; gap:8px; align-items:flex-start; background:#FBE9E6; border:1px solid #F0C9BF; border-radius:14px; padding:16px 18px; margin-bottom:18px; color:#B4442E; }
.realms .db-error strong { font-size:15px; }
.realms .db-error span { font-size:13.5px; color:#8a4433; }
.realms .db-error .db-msg { font-family:monospace; background:#fff; border:1px solid #F0C9BF; border-radius:8px; padding:6px 10px; color:#B4442E; word-break:break-word; max-width:100%; }
.realms .dash-analytics { margin-bottom:6px; }
.realms .line-chart { width:100%; height:auto; }
.realms .lc-x { font-size:11px; fill:#8A7AA6; }
.realms .lc-v { font-size:11px; fill:var(--p-deep); font-weight:600; }
.realms .perf, .realms .risk { display:grid; gap:10px; }
.realms .perf-row, .realms .risk-row { display:flex; align-items:center; justify-content:space-between; gap:10px; border-top:1px solid var(--lav2); padding-top:10px; }
.realms .perf-row:first-child, .realms .risk-row:first-child { border-top:0; padding-top:0; }
.realms .perf-name, .realms .risk-name { display:flex; flex-direction:column; font-size:14.5px; color:#3A2B54; }
.realms .perf-name em, .realms .risk-name em { font-style:normal; font-size:12px; color:#8A7AA6; }
.realms .perf-stat { font-size:13px; color:#5A4C74; margin-left:auto; margin-right:10px; }
.realms .risk-badge { font-size:12px; padding:4px 12px; border-radius:20px; border:1px solid var(--line); white-space:nowrap; }
.realms .risk-badge.high { background:#FBE9E6; color:#B4442E; border-color:#F0C9BF; }
.realms .risk-badge.medium { background:#FBF3E6; color:#9A5B12; border-color:#F0D9B5; }
.realms .risk-badge.low { background:#E6F4EA; color:#2E7D46; border-color:#BFE3CB; }

/* ===== consulting site ===== */
.realms .bar .nav { min-width:0; }
.realms .bar .tabs { overflow-x:auto; max-width:100%; min-width:0; scrollbar-width:none; flex-wrap:nowrap; justify-self:center; }
.realms .bar .tabs::-webkit-scrollbar { display:none; }
.realms .bar .tab { white-space:nowrap; }
.realms .page-lede { font-size:17px; color:#5A4C74; max-width:720px; margin:-8px auto 26px; text-align:center; }
.realms .center { text-align:center; }
.realms .home-services { max-width:1800px; margin:0 auto; padding:clamp(30px,4vw,56px) clamp(18px,4vw,56px); }
.realms .svc-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-top:22px; }
.realms .svc-card { background:#fff; border:1px solid var(--line); border-radius:16px; overflow:hidden; cursor:pointer; transition:.18s; display:flex; flex-direction:column; }
.realms .svc-card:hover { transform:translateY(-4px); box-shadow:0 16px 34px rgba(58,21,96,.14); border-color:var(--v); }
.realms .svc-img { height:300px; overflow:hidden; }
.realms .svc-img img { width:100%; height:100%; object-fit:cover; object-position:center top; }
.realms .svc-card h3 { font-size:17px; color:var(--p-deep); margin:16px 18px 6px; }
.realms .svc-card p { font-size:13.5px; color:#5A4C74; margin:0 18px 12px; line-height:1.55; flex:1; }
.realms .svc-more { font-size:13px; color:var(--p); font-weight:600; margin:0 18px 16px; }
.realms .clients-band { max-width:1500px; margin:0 auto; padding:10px 18px 30px; text-align:center; }
.realms .clients-row { display:flex; flex-wrap:wrap; gap:10px; justify-content:center; margin-top:14px; }
.realms .client-chip { background:var(--lav1); border:1px solid var(--line); color:#4A3B66; border-radius:22px; padding:8px 16px; font-size:14px; }
.realms .testi-band { max-width:1500px; margin:0 auto; padding:10px 18px 40px; }
.realms .testi-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
.realms .testi { margin:0; background:#fff; border:1px solid var(--line); border-left:3px solid var(--p); border-radius:14px; padding:22px 24px; }
.realms .testi p { font-size:16px; color:#3A2B54; font-style:italic; margin-bottom:12px; }
.realms .testi cite { font-style:normal; font-size:13px; color:#8A7AA6; }
.realms .cta-band, .realms .cta-row.onlight { }
.realms .cta-band { max-width:1500px; margin:34px auto 0; background:linear-gradient(135deg,var(--p-deep),var(--p-mid)); border-radius:20px; padding:clamp(28px,4vw,44px); text-align:center; color:#fff; }
.realms .cta-band h2 { color:#fff; font-size:clamp(22px,3vw,30px); margin-bottom:14px; }
.realms .cta-band p { color:#F1E5FB; margin-bottom:18px; }
.realms .btn.ghost.onlight { border-color:rgba(255,255,255,.7); background:rgba(255,255,255,.16); color:#fff; }
.realms .btn.ghost.onlight:hover { background:#fff; color:var(--p-deep); }
.realms .mon-lead { display:grid; grid-template-columns:1.2fr 1fr; gap:24px; align-items:center; margin-bottom:30px; }
.realms .mon-lead-copy p { color:#4A3B66; line-height:1.65; margin-bottom:12px; }
.realms .mon-lead-art { border-radius:18px; overflow:hidden; }
.realms .mon-lead-art img { width:100%; height:100%; object-fit:cover; }
.realms .case-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:24px; }
.realms .case { background:#fff; border:1px solid var(--line); border-radius:14px; padding:22px; }
.realms .case h3 { color:var(--p-deep); font-size:17px; margin-bottom:8px; }
.realms .case p { color:#5A4C74; font-size:14px; }
.realms .certs { display:flex; flex-wrap:wrap; align-items:center; gap:10px; }
.realms .certs-lab { font-size:12px; letter-spacing:.1em; text-transform:uppercase; color:var(--v); margin-right:6px; }
.realms .cert-chip { background:var(--lav1); border:1px dashed var(--line); border-radius:10px; padding:8px 14px; font-size:13px; color:#5A4C74; }
.realms .leaders { display:grid; grid-template-columns:repeat(3,1fr); gap:18px; margin-bottom:34px; }
.realms .staff-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:18px; margin-bottom:30px; }
.realms .lead-grid { grid-template-columns:1fr 1fr; max-width:860px; margin:0 auto; }
.realms .staff.lead .staff-photo { width:72px; height:72px; }
.realms .staff-photo img { width:100%; height:100%; object-fit:cover; border-radius:50%; }
.realms .staff { background:#fff; border:1px solid var(--line); border-radius:16px; padding:22px; }
.realms .staff.lead { border-color:var(--v); box-shadow:0 12px 30px rgba(58,21,96,.12); background:linear-gradient(180deg,#fff,var(--lav1)); }
.realms .staff-top { display:flex; align-items:center; gap:14px; margin-bottom:12px; }
.realms .staff-photo { width:60px; height:60px; flex-shrink:0; border-radius:50%; background:linear-gradient(135deg,var(--p),var(--v)); display:grid; place-items:center; }
.realms .staff-photo span { color:#fff; font-size:20px; font-weight:700; letter-spacing:.03em; }
.realms .staff-id h3 { color:var(--p-deep); font-size:17px; line-height:1.2; }
.realms .staff-role { color:var(--p); font-size:13.5px; margin-top:3px; }
.realms .staff-unit { color:#8A7AA6; font-size:12.5px; }
.realms .staff-purpose { color:#5A4C74; font-size:14px; line-height:1.55; margin-bottom:8px; }
.realms .staff-duties { margin:10px 0 0; padding-left:18px; display:grid; gap:5px; }
.realms .staff-duties li { font-size:13.5px; color:#3A2B54; }
@media (max-width:900px){ .realms .staff-grid { grid-template-columns:1fr 1fr; } }
@media (max-width:560px){ .realms .staff-grid { grid-template-columns:1fr; } }
.realms .insights { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-bottom:20px; }
.realms .insight { background:#fff; border:1px solid var(--line); border-radius:16px; padding:22px; display:flex; flex-direction:column; gap:6px; }
.realms .insight-tag { display:inline-block; align-self:flex-start; background:var(--lav2); color:var(--p-deep); font-size:11px; letter-spacing:.06em; text-transform:uppercase; padding:3px 10px; border-radius:12px; }
.realms .insight-date { font-size:12px; color:#8A7AA6; }
.realms .insight h3 { color:var(--p-deep); font-size:17px; margin:4px 0; }
.realms .insight p { color:#5A4C74; font-size:14px; flex:1; }
.realms .insight .svc-more { margin:6px 0 0; }
.realms .contact-grid { display:grid; grid-template-columns:1.4fr 1fr; gap:20px; }
.realms .contact-side { background:var(--lav1); border:1px solid var(--line); border-radius:16px; padding:24px; }
.realms .contact-side h3 { color:var(--p-deep); margin-bottom:14px; }
.realms .enquiry-card h2 { color:var(--p-deep); margin-bottom:16px; }
.realms .pillar.clickable { cursor:pointer; }
.realms .pillar.clickable:hover { border-color:var(--v); transform:translateY(-3px); }
@media (max-width:900px){
  .realms .svc-grid, .realms .leaders, .realms .team-dir, .realms .insights { grid-template-columns:1fr 1fr; }
  .realms .testi-grid, .realms .case-grid, .realms .mon-lead, .realms .contact-grid { grid-template-columns:1fr; }
}
@media (max-width:560px){ .realms .svc-grid, .realms .leaders, .realms .team-dir, .realms .insights { grid-template-columns:1fr; } }

.realms .mon-rules { font-size:12.5px; color:#8A5A12; background:#FBF3E6; border:1px solid #F0D9B5; border-radius:10px; padding:8px 12px; margin-bottom:14px; }
.realms .mcat-r { display:flex; align-items:center; gap:8px; }
.realms .need { font-size:11.5px; color:#B4442E; background:#FBE9E6; border:1px solid #F0C9BF; border-radius:12px; padding:3px 9px; white-space:nowrap; }
.realms .ok { font-size:11.5px; color:#2E7D46; background:#E6F4EA; border:1px solid #BFE3CB; border-radius:12px; padding:3px 9px; }
.realms .mitem.flag { border-left:3px solid #B4442E; padding-left:12px; margin-left:-12px; }
.realms .ev-btn.urgent { border-color:#B4442E; color:#B4442E; }
.realms .hintline.req { color:#B4442E; font-weight:600; }
.realms .prop-list { display:grid; gap:14px; }
.realms .prop-card { background:#fff; border:1px solid var(--line); border-radius:16px; padding:20px 22px; }
.realms .prop-head { display:flex; align-items:center; justify-content:space-between; gap:12px; border-bottom:1px solid var(--lav2); padding-bottom:12px; margin-bottom:12px; }
.realms .prop-sec { margin-bottom:12px; }
.realms .prop-sec h4 { font-size:13px; letter-spacing:.04em; text-transform:uppercase; color:var(--v); margin-bottom:8px; }
.realms .corr { margin:0; padding-left:18px; display:grid; gap:6px; }
.realms .corr li { font-size:14px; color:#3A2B54; }
.realms .corr em { color:#5A4C74; font-style:italic; }
.realms .corr-tl { display:inline-block; margin-left:8px; font-size:11.5px; color:#9A5B12; background:#FBF3E6; border:1px solid #F0D9B5; border-radius:10px; padding:2px 8px; }
.realms .prop-actions { margin-top:4px; }
.realms .muted.sm { font-size:13.5px; color:#7A6A93; }
.realms .profile-cat .prof-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:10px; }
@media (max-width:560px){ .realms .profile-cat .prof-grid { grid-template-columns:1fr 1fr; } }
.realms .langsel { font-family:inherit; font-size:13px; border:1px solid var(--line); border-radius:16px; padding:6px 10px; background:#fff; color:var(--p-deep); margin-right:2px; }
.realms .langsel:focus { outline:none; border-color:var(--p); }
.realms .list-tools { margin-bottom:14px; }
.realms .searchbox { font-family:inherit; font-size:14px; width:100%; max-width:340px; border:1px solid var(--line); border-radius:22px; padding:9px 16px; background:#fff; color:var(--ink); }
.realms .searchbox:focus { outline:none; border-color:var(--p); box-shadow:0 0 0 3px var(--lav2); }
.realms .ptools .searchbox { max-width:200px; }
.realms .fu-card { background:#fff; border:1px solid var(--line); border-radius:14px; padding:16px 18px; margin-bottom:10px; }
.realms .fu-head { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.realms .fu-right { display:flex; align-items:center; gap:10px; }
.realms .fu-form { margin-top:12px; padding-top:12px; border-top:1px solid var(--lav2); }
.realms .fu-calls { margin:10px 0 0; padding-left:18px; }
.realms .fu-calls li { font-size:13px; color:#5A4C74; margin-bottom:4px; }
.realms .log-list { list-style:none; margin:0 0 18px; padding:0; border:1px solid var(--line); border-radius:12px; overflow:hidden; }
.realms .log-list li { display:flex; gap:12px; padding:9px 14px; font-size:13px; border-top:1px solid var(--lav2); }
.realms .log-list li:first-child { border-top:none; }
.realms .log-when { color:#8A7AA6; white-space:nowrap; font-variant-numeric:tabular-nums; }
.realms .log-msg { color:#3A2B54; }

/* --- follow-ups redesign --- */
.realms .fu-flag { display:flex; gap:12px; align-items:flex-start; background:#FBE9E6; border:1px solid #F0C9BF; border-radius:var(--r-md); padding:13px 16px; margin:0 0 18px; font-size:14px; color:#7A2E1E; line-height:1.5; }
.realms .fu-flag strong { color:#B4442E; }
.realms .fu-flag-ic { flex:none; width:22px; height:22px; border-radius:50%; background:#B4442E; color:#fff; font-weight:700; display:flex; align-items:center; justify-content:center; font-size:14px; margin-top:1px; }
.realms .fu-kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin:0 0 16px; }
.realms .fu-kpi { text-align:left; padding:14px 16px; background:#fff; border:1.5px solid var(--line); border-radius:var(--r-md); cursor:pointer; transition:.16s; display:flex; flex-direction:column; gap:4px; }
.realms .fu-kpi:hover { border-color:var(--v); box-shadow:var(--e1); }
.realms .fu-kpi.on { border-color:var(--p); box-shadow:var(--e2); background:var(--lav1); }
.realms .fu-kpi-v { font-size:28px; font-weight:700; line-height:1; color:var(--p-deep); font-variant-numeric:tabular-nums; }
.realms .fu-kpi-l { font-size:12.5px; color:#7A6A93; }
.realms .fu-kpi.amber .fu-kpi-v { color:#9A5B12; }
.realms .fu-kpi.green .fu-kpi-v { color:#2E7D46; }
.realms .fu-kpi.red .fu-kpi-v { color:#B4442E; }
.realms .fu-toolbar { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; margin:0 0 16px; }
.realms .fu-segs { display:inline-flex; background:var(--lav2); border-radius:22px; padding:3px; gap:2px; }
.realms .fu-segs.sm { margin-bottom:12px; }
.realms .fu-seg { font-family:inherit; font-size:13px; padding:7px 15px; border:none; background:transparent; color:#6A5A87; border-radius:20px; cursor:pointer; display:inline-flex; align-items:center; gap:7px; transition:.15s; }
.realms .fu-seg.on { background:#fff; color:var(--p-deep); font-weight:600; box-shadow:var(--e1); }
.realms .fu-seg-n { font-size:11px; min-width:18px; height:18px; padding:0 5px; border-radius:9px; background:var(--v); color:#fff; display:inline-flex; align-items:center; justify-content:center; font-variant-numeric:tabular-nums; }
.realms .fu-seg.on .fu-seg-n { background:var(--p); }
.realms .fu-queue { display:grid; gap:12px; }
.realms .fu-card2 { background:#fff; border:1px solid var(--line); border-left:3px solid var(--v); border-radius:var(--r-md); padding:15px 18px; box-shadow:var(--e1); transition:box-shadow .18s ease, border-color .18s ease; }
.realms .fu-card2:hover { box-shadow:var(--e2); }
.realms .fu-card2.awaiting { border-left-color:#D9A340; }
.realms .fu-card2.called { border-left-color:#5FA35A; }
.realms .fu-card2.escalated { border-left-color:#B4442E; background:linear-gradient(180deg,#FDF4F2,#fff 60%); }
.realms .fu-c-top { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
.realms .fu-c-id { display:flex; flex-direction:column; gap:2px; min-width:0; }
.realms .fu-wait { display:inline-block; margin-left:8px; font-size:11.5px; font-weight:600; color:#9A5B12; background:#FBF3E6; border:1px solid #F0D9B5; padding:1px 8px; border-radius:11px; }
.realms .fu-c-actions { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
.realms a.mini.call { text-decoration:none; border-color:#BFE3CB; color:#2E7D46; background:#E6F4EA; font-weight:600; display:inline-flex; align-items:center; gap:5px; }
.realms a.mini.call:hover { background:#d7eede; border-color:#9ED2AE; }
.realms .mini.ghost { color:#6A5A87; font-variant-numeric:tabular-nums; }
.realms .mini.disabled { color:#A89BBE; background:var(--lav1); border-style:dashed; cursor:default; }
.realms .mini.on { border-color:var(--p); background:var(--lav1); }
.realms .fu-timeline { list-style:none; margin:14px 0 0; padding:12px 0 0; border-top:1px solid var(--lav2); display:grid; gap:11px; }
.realms .fu-timeline li { display:flex; gap:11px; align-items:flex-start; }
.realms .fu-dot { flex:none; width:9px; height:9px; border-radius:50%; background:var(--v); margin-top:5px; box-shadow:0 0 0 3px var(--lav2); }
.realms .fu-timeline li.flag .fu-dot { background:#B4442E; box-shadow:0 0 0 3px #F5D9D2; }
.realms .fu-t-body { display:flex; flex-direction:column; gap:2px; min-width:0; }
.realms .fu-t-head { display:flex; align-items:baseline; gap:9px; flex-wrap:wrap; }
.realms .fu-t-head strong { font-size:13.5px; color:var(--p-deep); }
.realms .fu-t-when { font-size:12px; color:#8A7AA6; font-variant-numeric:tabular-nums; }
.realms .fu-t-note { font-size:13px; color:#5A4C74; line-height:1.45; }
.realms .fu-logtoggle { margin:22px 0 0; font-family:inherit; font-size:13px; color:var(--p); background:none; border:none; cursor:pointer; padding:4px 0; }
.realms .fu-logtoggle:hover { color:var(--p-deep); text-decoration:underline; }
.realms .fu-logwrap { margin-top:12px; }
.realms .reins-row { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin:6px 0 4px; }
.realms .reins-stat { text-align:center; padding:14px 8px; background:var(--lav1); border:1px solid var(--line); border-radius:var(--r-md); }
.realms .reins-v { display:block; font-size:30px; font-weight:700; line-height:1; color:var(--p-deep); font-variant-numeric:tabular-nums; }
.realms .reins-v.g { color:#2E7D46; } .realms .reins-v.a { color:#9A5B12; } .realms .reins-v.r { color:#B4442E; }
.realms .reins-l { display:block; margin-top:6px; font-size:12.5px; color:#7A6A93; }
@media (max-width:560px){ .realms .reins-row { grid-template-columns:repeat(2,1fr); } }

/* --- dashboard redesign --- */
.realms .dash-hero { display:flex; gap:22px; align-items:center; background:linear-gradient(120deg,#F3EEFA,#FBF6FF 55%,#F6EEF6); border:1px solid var(--line); border-radius:var(--r-lg); padding:20px 24px; margin:0 0 16px; box-shadow:var(--e1); }
.realms .dash-hero-ring { flex:none; }
.realms .dash-hero-body { flex:1; min-width:0; }
.realms .dash-hero-sum { font-size:17px; line-height:1.5; color:var(--p-deep); margin:0 0 14px; font-weight:500; }
.realms .dash-hero-cov { margin-bottom:14px; }
.realms .cov-bar { height:9px; background:#E7DEF2; border-radius:6px; overflow:hidden; }
.realms .cov-fill { height:100%; background:linear-gradient(90deg,var(--p),var(--p-mid)); border-radius:6px; transition:width .9s cubic-bezier(.2,.8,.2,1); }
.realms .cov-cap { display:block; margin-top:6px; font-size:12.5px; color:#7A6A93; }
.realms .dash-hero-legend { display:flex; flex-wrap:wrap; gap:16px; }
.realms .hero-leg { display:inline-flex; align-items:center; gap:6px; font-size:13px; color:#5A4C74; }
.realms .hero-leg em { font-style:normal; font-weight:700; color:var(--p-deep); font-variant-numeric:tabular-nums; }
.realms .hero-leg .hr-dot { width:9px; height:9px; border-radius:50%; }
.realms .hero-leg.green .hr-dot { background:#2E7D46; } .realms .hero-leg.amber .hr-dot { background:#C77D0A; } .realms .hero-leg.red .hr-dot { background:#B4442E; } .realms .hero-leg.unscored .hr-dot { background:#B9AEC9; }
.realms .dash-kpis { display:grid; grid-template-columns:repeat(6,1fr); gap:10px; margin:0 0 18px; }
.realms .dash-kpi { position:relative; text-align:left; padding:16px 14px 14px; background:#fff; border:1px solid var(--line); border-radius:var(--r-md); cursor:pointer; overflow:hidden; transition:.16s; display:flex; flex-direction:column; gap:3px; }
.realms .dash-kpi::before { content:''; position:absolute; left:0; top:0; bottom:0; width:3px; background:var(--p); }
.realms .dash-kpi.tone-r::before { background:#B4442E; } .realms .dash-kpi.tone-a::before { background:#D9A340; }
.realms .dash-kpi:hover { box-shadow:var(--e2); transform:translateY(-2px); border-color:var(--v); }
.realms .dk-v { font-size:30px; font-weight:700; line-height:1; color:var(--p-deep); font-variant-numeric:tabular-nums; }
.realms .dash-kpi.tone-r .dk-v { color:#B4442E; } .realms .dash-kpi.tone-a .dk-v { color:#9A5B12; }
.realms .dk-l { font-size:12.5px; color:#6A5A87; }
.realms .dk-go { font-size:11.5px; color:var(--v); opacity:0; transition:.16s; margin-top:2px; }
.realms .dash-kpi:hover .dk-go { opacity:1; }
.realms .dash-exp-head { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:6px; }
.realms .dash-exp-head h3 { margin:0; }
.realms .dash-exp { display:grid; grid-template-columns:220px 1fr; gap:20px; align-items:start; margin-top:10px; }
.realms .dash-exp-donut { display:flex; justify-content:center; }
.realms .donut-legend .dl { background:none; border:0; font-family:inherit; font-size:13px; color:#5A4C74; display:flex; align-items:center; gap:7px; width:100%; padding:3px 6px; border-radius:8px; cursor:pointer; transition:.14s; }
.realms .donut-legend .dl:hover { background:var(--lav1); }
.realms .donut-legend .dl.on { background:var(--lav2); font-weight:600; color:var(--p-deep); }
.realms .dash-exp-filters { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; margin-bottom:10px; }
.realms .fu-segs.wrap { flex-wrap:wrap; }
.realms .dash-area-sel { font-family:inherit; font-size:13px; padding:7px 12px; border:1px solid var(--line); border-radius:20px; background:#fff; color:var(--p-deep); }
.realms .dash-flist { list-style:none; margin:0; padding:0; max-height:340px; overflow-y:auto; display:grid; gap:6px; }
.realms .dash-flist li { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:9px 12px; border:1px solid var(--line); border-radius:10px; cursor:pointer; transition:.14s; }
.realms .dash-flist li:hover { border-color:var(--v); background:var(--lav1); }
.realms .df-name { display:flex; flex-direction:column; gap:1px; font-size:14px; color:var(--p-deep); min-width:0; }
.realms .df-name em { font-style:normal; font-size:12px; color:#8A7AA6; }
.realms .bar-row.click { cursor:pointer; border-radius:8px; padding:2px 4px; transition:.14s; }
.realms .bar-row.click:hover { background:var(--lav1); }
.realms .bar-row.click.on .bar-fill { background:linear-gradient(90deg,var(--p),var(--p-mid)); }
.realms .bar-row.click.on .bar-lab { font-weight:600; color:var(--p-deep); }
@media (max-width:720px){ .realms .dash-kpis { grid-template-columns:repeat(3,1fr); } .realms .dash-exp { grid-template-columns:1fr; } .realms .dash-hero { flex-direction:column; align-items:flex-start; } }
@media (max-width:440px){ .realms .dash-kpis { grid-template-columns:repeat(2,1fr); } }

/* --- map/route: manual picker + navigate --- */
.realms .mr-mode { margin-bottom:12px; }
.realms .pick-list { max-height:320px; overflow-y:auto; display:grid; gap:5px; margin:10px 0; padding-right:2px; }
.realms .pick-item { display:flex; align-items:center; gap:10px; padding:9px 11px; border:1px solid var(--line); border-radius:10px; cursor:pointer; transition:.14s; }
.realms .pick-item:hover { border-color:var(--v); background:var(--lav1); }
.realms .pick-item.on { border-color:var(--p); background:var(--lav2); }
.realms .pick-item input { width:17px; height:17px; accent-color:var(--p); flex:none; }
.realms .pi-main { display:flex; flex-direction:column; gap:1px; min-width:0; }
.realms .pi-name { font-size:14px; color:var(--p-deep); font-weight:500; }
.realms .pi-meta { font-size:12px; color:#8A7AA6; }
.realms .pick-actions { display:flex; align-items:center; gap:12px; margin-top:6px; }
.realms .pick-n { font-size:13px; color:var(--p-deep); font-weight:600; margin-right:auto; }
.realms .pf-nav { display:inline-block; margin-top:4px; font-size:12.5px; color:#2E7D46; text-decoration:none; font-weight:600; }
.realms .pf-nav:hover { text-decoration:underline; }

.realms .sa-checkin { margin:0 0 10px; font-size:12.5px; color:#2E7D46; background:#E6F4EA; border:1px solid #BFE3CB; border-radius:8px; padding:6px 10px; display:inline-block; }
.realms .sa-head:disabled { opacity:.75; cursor:progress; }

/* --- dashboard connection banner --- */
.realms .db-banner { display:flex; align-items:center; gap:12px; justify-content:space-between; border-radius:12px; padding:11px 15px; margin-bottom:14px; font-size:14px; }
.realms .db-banner.err { background:#FBE9E6; border:1px solid #E7B9AE; color:#7A2E1E; }
.realms .db-banner.load { background:#F3EEFA; border:1px solid #DCCFEC; color:#574277; }
.realms .db-banner.stale { background:#FBF3E2; border:1px solid #E9D6A8; color:#7A5B12; }
.realms .db-banner .mini { white-space:nowrap; }
.realms .db-spin { width:14px; height:14px; border:2px solid #C9B8DF; border-top-color:#6D4B8E; border-radius:50%; display:inline-block; animation:db-spin .7s linear infinite; }
@keyframes db-spin { to { transform:rotate(360deg); } }

/* --- monitor: route facilities with a baseline to Second Assessment --- */
.realms .mon-row.locked { background:var(--lav1); }
.realms .mon-row.locked .fname { color:#6A5A87; }
.realms .mini.off { color:#B0A4C4; border-color:var(--line); background:#F4F1F8; text-decoration:line-through; cursor:not-allowed; }
.realms .mini.go { border-color:var(--p); color:var(--p); font-weight:600; }

.realms .sa-done-actions { padding:0 18px 14px; }
.realms .sa-check-wrap { margin:2px 0 4px; }
.realms .sa-mcat { border:1px solid var(--line); border-radius:12px; margin-bottom:8px; overflow:hidden; }
.realms .sa-mcat > summary { cursor:pointer; }
.realms .sa-score-live { display:flex; align-items:center; gap:12px; padding:10px 12px; background:#F4F1F8; border:1px solid var(--line); border-radius:12px; }
.realms .sa-score-l { font-weight:600; color:var(--p-deep); }
.realms .sa-score-n { font-size:12.5px; color:#7A6A93; margin-left:auto; }
.realms .sa-confirm-all { display:flex; align-items:center; gap:12px; margin:0 0 10px; }
.realms .sa-confirm-n { font-size:12.5px; color:#7A6A93; }
.realms .sa-sec-tools { padding:0 2px 8px; }
.realms .sa-conf-tag { font-size:11px; font-weight:600; color:#2E7D46; background:#E6F4EA; border:1px solid #BFE3CB; border-radius:6px; padding:1px 6px; margin-left:8px; }
.realms .mcat.confirmed > summary, .realms .hef-sec.confirmed > summary { background:#F2FaF4; }
.realms .mini.ok { color:#2E7D46; border-color:#BFE3CB; background:#E6F4EA; }
/* --- second assessment: roomier data entry --- */.realms .sa-ta { width:100%; font-family:inherit; font-size:15px; line-height:1.5; padding:10px 12px; border:1.5px solid var(--line); border-radius:12px; color:var(--ink); background:#fff; min-height:104px; resize:vertical; }.realms .sa-nowcol .field.sm { margin-bottom:14px; }
.realms .sa-nowcol .field.sm input { min-height:46px; }
.realms .sa-nowcol .field.sm span { margin-bottom:5px; }
@media (pointer: coarse){
  .realms .sa-ta { font-size:16px; min-height:120px; line-height:1.55; }
  .realms .sa-nowcol .field.sm input { min-height:48px; font-size:16px; }
}
@media (max-width:640px){ .realms .fu-kpis { grid-template-columns:repeat(2,1fr); } .realms .fu-toolbar { flex-direction:column; align-items:stretch; } .realms .fu-segs { overflow-x:auto; } }
.realms .hef-wrap { border:1px solid var(--line); border-radius:14px; padding:14px 16px; margin-bottom:18px; background:#fff; }
.realms .hef-title { cursor:pointer; display:flex; align-items:center; justify-content:space-between; font-weight:600; color:var(--p-deep); font-size:16px; }
.realms .hef-total { font-size:12px; color:var(--v); background:var(--lav2); border-radius:12px; padding:3px 10px; }
.realms .rag-summary-head { margin:6px 0 10px; }
.realms .rag-summary-head h3 { color:var(--p-deep); font-size:16px; }
.realms .hef-form { display:grid; gap:8px; margin-top:10px; }
.realms .hef-sec { border:1px solid var(--line); border-radius:10px; overflow:hidden; }
.realms .hef-sec > summary { cursor:pointer; list-style:none; display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:var(--lav1); font-size:14px; color:#3A2B54; font-weight:600; }
.realms .hef-sec > summary::-webkit-details-marker { display:none; }
.realms .hef-count { font-size:11.5px; color:#8A7AA6; background:#fff; border:1px solid var(--line); border-radius:10px; padding:2px 8px; font-weight:500; }
.realms .hef-fields { padding:12px 14px; display:grid; gap:12px; }
.realms .hef-field { display:flex; flex-direction:column; gap:6px; }
.realms .hef-label { font-size:13.5px; color:#4A3B66; }
.realms .hef-input { font-family:inherit; font-size:14px; border:1px solid var(--line); border-radius:8px; padding:8px 10px; background:#fff; color:var(--ink); width:100%; }
.realms .hef-input:focus { outline:none; border-color:var(--p); }
.realms .seg { display:inline-flex; border:1px solid var(--line); border-radius:8px; overflow:hidden; width:max-content; }
.realms .segb { font-family:inherit; font-size:13px; padding:7px 16px; background:#fff; border:none; border-right:1px solid var(--line); color:#5A4C74; cursor:pointer; }
.realms .segb:last-child { border-right:none; }
.realms .segb.on { background:var(--p); color:#fff; }
.realms .chks { display:flex; flex-wrap:wrap; gap:8px; }
.realms .chkpill { display:inline-flex; align-items:center; gap:6px; font-size:13px; border:1px solid var(--line); border-radius:20px; padding:6px 12px; color:#5A4C74; cursor:pointer; background:#fff; }
.realms .chkpill.on { border-color:var(--p); background:var(--lav2); color:var(--p-deep); }
.realms .chkpill input { margin:0; }
.realms .picks { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px; }
.realms .pick { font-family:inherit; font-size:13px; min-height:38px; padding:7px 13px; border:1px solid var(--line); border-radius:19px; background:#fff; color:#5A4C74; cursor:pointer; touch-action:manipulation; -webkit-tap-highlight-color:transparent; }
.realms .pick:active { background:var(--lav1); }
.realms .pick.on { background:var(--p); border-color:var(--p); color:#fff; }
.realms .hq-oversight { margin-top:24px; }
.realms .hq-stats { display:grid; grid-template-columns:repeat(6,1fr); gap:10px; margin-bottom:14px; }
.realms .hq-stat { background:#fff; border:1px solid var(--line); border-radius:12px; padding:14px 10px; text-align:center; }
.realms .hq-stat .v { display:block; font-size:22px; font-weight:700; color:var(--p-deep); font-family:Lora,serif; }
.realms .hq-stat .l { display:block; font-size:11.5px; color:#8A7AA6; margin-top:2px; }
.realms .hq-table { border:1px solid var(--line); border-radius:12px; overflow:hidden; }
.realms .hq-tr { display:grid; grid-template-columns:2.2fr 1.2fr 0.8fr 1fr 1fr; gap:8px; padding:10px 14px; font-size:13px; color:#4A3B66; border-top:1px solid var(--lav2); align-items:center; }
.realms .hq-tr:first-child { border-top:none; }
.realms .hq-th { background:var(--lav1); font-weight:600; color:var(--p-deep); font-size:12px; text-transform:uppercase; letter-spacing:.04em; }
.realms .hq-name { color:#3A2B54; font-weight:500; }
.realms .hq-status { font-size:12px; }
.realms .hq-status.s-notvisited { color:#8A7AA6; }
.realms .hq-status.s-engaged { color:#9A5B12; }
.realms .hq-status.s-assessed { color:#2E6B8A; }
.realms .hq-status.s-debriefed { color:#2E7D46; }
@media (max-width:760px){ .realms .hq-stats { grid-template-columns:repeat(3,1fr); } .realms .hq-tr { grid-template-columns:2fr 1fr 1fr; } .realms .hq-tr span:nth-child(3), .realms .hq-tr span:nth-child(4) { display:none; } }

/* ===== contact page ===== */
.realms .contact-page { max-width:1800px; }
.realms .contact-hero { text-align:center; max-width:720px; margin:0 auto clamp(26px,4vw,44px); }
.realms .contact-hero h1 { font-size:clamp(30px,5vw,48px); line-height:1.06; color:var(--p-deep); letter-spacing:-0.01em; }
.realms .contact-lede { font-size:17px; color:#5A4C74; margin-top:14px; }
.realms .contact-split { display:grid; grid-template-columns:0.95fr 1.05fr; gap:20px; align-items:stretch; }
.realms .contact-panel { position:relative; overflow:hidden; border-radius:22px; padding:clamp(26px,3vw,38px); color:#fff; background:linear-gradient(150deg,#4C3B66 0%,#574277 45%,#6D4B8E 100%); box-shadow:0 24px 60px rgba(58,21,96,.28); }
.realms .panel-glow { position:absolute; width:340px; height:340px; right:-120px; top:-120px; background:radial-gradient(circle,rgba(169,143,196,.55),transparent 70%); pointer-events:none; }
.realms .contact-panel h2 { color:#fff; font-size:24px; margin-bottom:20px; position:relative; }
.realms .reach { list-style:none; margin:0 0 24px; padding:0; display:grid; gap:16px; position:relative; }
.realms .reach li { display:flex; gap:14px; align-items:flex-start; }
.realms .reach-ic { flex:0 0 auto; width:40px; height:40px; border-radius:12px; display:grid; place-items:center; background:rgba(255,255,255,.14); color:#fff; }
.realms .reach-k { display:block; font-size:11.5px; letter-spacing:.1em; text-transform:uppercase; color:#D9C9EC; margin-bottom:2px; }
.realms .reach li em { font-style:normal; font-size:15px; color:#fff; line-height:1.4; }
.realms .panel-cta { display:flex; flex-wrap:wrap; gap:10px; position:relative; }
.realms .enquiry { background:#fff; border:1px solid var(--line); border-radius:22px; padding:clamp(24px,3vw,34px); box-shadow:0 12px 34px rgba(58,21,96,.08); }
.realms .enquiry h2 { color:var(--p-deep); font-size:22px; margin-bottom:18px; }
.realms .btn.wide { width:100%; justify-content:center; }
.realms .enquiry.sent { display:flex; flex-direction:column; align-items:center; text-align:center; justify-content:center; gap:6px; }
.realms .sent-badge { width:64px; height:64px; border-radius:50%; display:grid; place-items:center; background:#E6F4EA; color:#2E7D46; margin-bottom:8px; }
.realms .enquiry.sent p { color:#5A4C74; max-width:380px; margin-bottom:12px; }
@media (max-width:820px){ .realms .contact-split { grid-template-columns:1fr; } }

/* ===== toasts + modal ===== */
.realms .toaster { position:fixed; left:50%; bottom:28px; transform:translateX(-50%); z-index:9999; display:flex; flex-direction:column; gap:8px; align-items:center; pointer-events:none; }
.realms .toast { pointer-events:auto; background:#2E2140; color:#fff; font-size:14px; padding:11px 18px; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,.28); animation:toastin .28s ease; max-width:90vw; }
.realms .toast.ok { background:#2E7D46; } .realms .toast.warn { background:#9A5B12; } .realms .toast.err { background:#B4442E; }
@keyframes toastin { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:none } }
.realms .modal-scrim { position:fixed; inset:0; z-index:9998; background:rgba(36,21,54,.5); backdrop-filter:blur(2px); display:grid; place-items:center; padding:20px; }
.realms .modal { background:#fff; border-radius:18px; padding:26px; max-width:400px; width:100%; box-shadow:0 30px 70px rgba(0,0,0,.3); }
.realms .modal h3 { color:var(--p-deep); font-size:19px; margin-bottom:8px; }
.realms .modal p { color:#5A4C74; font-size:14.5px; margin-bottom:20px; }
.realms .modal-actions { display:flex; justify-content:flex-end; gap:10px; }
.realms .btn.danger { background:#B4442E; color:#fff; }
.realms .btn.danger:hover { background:#98351f; }

/* completion meter */
.realms .mon-meter { display:grid; gap:8px; margin:4px 0 14px; }
.realms .meter-row { display:grid; grid-template-columns:88px 1fr auto; gap:10px; align-items:center; }
.realms .meter-lab { font-size:12px; color:#8A7AA6; }
.realms .meter-track { height:8px; border-radius:6px; background:var(--lav2); overflow:hidden; }
.realms .meter-fill { height:100%; background:linear-gradient(90deg,var(--p),var(--v)); border-radius:6px; transition:width .35s ease; }
.realms .meter-fill.alt { background:linear-gradient(90deg,#2E7D46,#7FC29B); }
.realms .meter-val { font-size:12px; color:#5A4C74; font-variant-numeric:tabular-nums; }

/* lightbox */
.realms .lightbox { position:fixed; inset:0; z-index:9998; background:rgba(20,10,32,.9); display:grid; place-items:center; padding:24px; cursor:zoom-out; }
.realms .lightbox img { max-width:92vw; max-height:88vh; border-radius:10px; box-shadow:0 20px 60px rgba(0,0,0,.5); }
.realms .lightbox-x { position:fixed; top:18px; right:22px; background:rgba(255,255,255,.15); color:#fff; border:none; width:40px; height:40px; border-radius:50%; font-size:24px; cursor:pointer; }

/* facility history drawer */
.realms .drawer-scrim { position:fixed; inset:0; z-index:9997; background:rgba(36,21,54,.45); display:flex; justify-content:flex-end; }
.realms .drawer { width:min(420px,92vw); background:#fff; height:100%; overflow-y:auto; padding:24px; box-shadow:-20px 0 50px rgba(0,0,0,.2); }
.realms .anim-right { animation:slidein .26s ease; }
@keyframes slidein { from { transform:translateX(24px); opacity:.4 } to { transform:none; opacity:1 } }
.realms .drawer-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:16px; }
.realms .drawer-head h3 { color:var(--p-deep); font-size:19px; }
.realms .drawer-sub { color:var(--v); font-size:12px; letter-spacing:.06em; text-transform:uppercase; margin-bottom:10px; }
.realms .drawer-visits { list-style:none; margin:0; padding:0; display:grid; gap:8px; }
.realms .drawer-visits li { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:12px 14px; border:1px solid var(--line); border-radius:12px; }
.realms .dv-main { display:flex; flex-direction:column; }

/* settings */
.realms .settings-card { background:#fff; border:1px solid var(--line); border-radius:16px; padding:24px; max-width:680px; }
.realms .settings-card h3 { color:var(--p-deep); font-size:17px; margin-bottom:6px; }

/* ===== polish: focus, motion, hovers, empty, skeleton ===== */
.realms .btn { transition:transform .15s ease, box-shadow .15s ease, background .15s ease, color .15s ease; }
.realms .btn.primary:hover, .realms .btn.light:hover { transform:translateY(-1px); }
.realms a:focus-visible, .realms button:focus-visible, .realms input:focus-visible, .realms select:focus-visible, .realms textarea:focus-visible, .realms summary:focus-visible { outline:2px solid var(--p); outline-offset:2px; border-radius:6px; }
.realms .empty { text-align:center; color:#8A7AA6; padding:34px 20px; border:1px dashed var(--line); border-radius:14px; background:var(--lav1); }
.realms .empty.sm { padding:18px; }
.realms .skeleton { position:relative; overflow:hidden; background:var(--lav2); border-radius:10px; }
.realms .skeleton::after { content:''; position:absolute; inset:0; transform:translateX(-100%); background:linear-gradient(90deg,transparent,rgba(255,255,255,.6),transparent); animation:shimmer 1.3s infinite; }
@keyframes shimmer { 100% { transform:translateX(100%) } }
.realms .skel-row { height:58px; margin-bottom:10px; }
@media (prefers-reduced-motion: reduce) { .realms *, .realms *::after, .realms *::before { animation-duration:.001ms !important; transition-duration:.001ms !important; } .realms .anim { animation:none !important; opacity:1 !important; transform:none !important; } }

/* ===== AI ===== */
.realms .ai-btn { display:inline-flex; align-items:center; gap:6px; }
.realms .ai-spark { color:var(--v); font-size:13px; }
.realms .ai-panel { background:linear-gradient(180deg,var(--lav1),#fff); border:1px solid var(--line); border-left:3px solid var(--p); border-radius:12px; padding:14px 16px; margin-top:10px; }
.realms .ai-panel h4 { color:var(--p-deep); font-size:13px; text-transform:uppercase; letter-spacing:.05em; margin-bottom:6px; display:flex; align-items:center; gap:6px; }
.realms .ai-panel .ai-text { font-size:14px; color:#3A2B54; white-space:pre-wrap; line-height:1.55; }
.realms .chat-wrap { border:1px solid var(--line); border-radius:16px; overflow:hidden; display:flex; flex-direction:column; height:min(62vh,560px); background:#fff; }
.realms .chat-msgs { flex:1; overflow-y:auto; padding:18px; display:flex; flex-direction:column; gap:12px; }
.realms .cmsg { max-width:80%; padding:11px 15px; border-radius:14px; font-size:14.5px; line-height:1.5; white-space:pre-wrap; }
.realms .cmsg.user { align-self:flex-end; background:var(--p); color:#fff; border-bottom-right-radius:4px; }
.realms .cmsg.assistant { align-self:flex-start; background:var(--lav2); color:#3A2B54; border-bottom-left-radius:4px; }
.realms .chat-input { display:flex; gap:8px; padding:12px; border-top:1px solid var(--line); background:var(--lav1); }
.realms .chat-input input { flex:1; font-family:inherit; font-size:14px; border:1px solid var(--line); border-radius:22px; padding:10px 16px; background:#fff; }
.realms .assistant-fab { position:fixed; right:22px; bottom:22px; z-index:900; background:linear-gradient(135deg,var(--p-deep),var(--p-mid)); color:#fff; border:none; border-radius:26px; padding:13px 22px; font-size:15px; font-weight:600; box-shadow:0 12px 30px rgba(58,21,96,.34); }
.realms .assistant-panel { position:fixed; right:22px; bottom:78px; z-index:900; width:min(380px,92vw); height:min(540px,74vh); background:#fff; border:1px solid var(--line); border-radius:18px; box-shadow:0 24px 60px rgba(58,21,96,.28); display:flex; flex-direction:column; overflow:hidden; animation:slideup .24s ease; }
@keyframes slideup { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:none } }
.realms .assistant-head { display:flex; align-items:center; justify-content:space-between; padding:14px 18px; background:linear-gradient(135deg,var(--p-deep),var(--p-mid)); color:#fff; font-weight:600; }
.realms .assistant-head .linkbtn { color:#EBDDF8; }
.realms .assistant-msgs { flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:10px; background:var(--lav1); }
.realms .amsg { max-width:88%; padding:10px 14px; border-radius:14px; font-size:14px; line-height:1.5; white-space:pre-wrap; }
.realms .amsg.user { align-self:flex-end; background:var(--p); color:#fff; border-bottom-right-radius:4px; }
.realms .amsg.assistant { align-self:flex-start; background:#fff; color:#3A2B54; border:1px solid var(--line); border-bottom-left-radius:4px; }
.realms .assistant-input { display:flex; gap:8px; padding:12px; border-top:1px solid var(--line); }
.realms .assistant-input input { flex:1; font-family:inherit; font-size:14px; border:1px solid var(--line); border-radius:20px; padding:9px 14px; }
.realms .ai-row { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px; }
.realms .ai-check { display:inline-flex; align-items:center; gap:6px; font-size:13px; color:#5A4C74; white-space:nowrap; }
.realms .mnote-row { display:flex; gap:8px; align-items:flex-start; }
.realms .mnote-row .mnote { flex:1; }
.realms .dictate.rec { color:#B4442E; border-color:#B4442E; }
.realms .ev-ai { font-size:11px; padding:3px 8px; margin-top:4px; }
`
