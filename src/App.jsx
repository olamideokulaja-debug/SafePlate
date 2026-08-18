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

import React, { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { generateCertPDF } from './lib/helpers.ts'
import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import jsQR from 'jsqr'
import * as XLSX from 'xlsx'
import { unzipSync, zipSync } from 'fflate'
import { SUPABASE_READY, supabase, PAYSTACK_READY, PAYSTACK_PUBLIC_KEY, accentFor } from './lib/config.ts'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import { Donut, Bars, Line, ChartCard } from './components/Charts.tsx'
import SearchBar from './components/SearchBar.tsx'
import Insights from './components/Insights.tsx'
import NavIcon from './components/NavIcon.tsx'
import { AppealButton, AppealsList } from './components/Appeals.tsx'
import { compressImage } from './lib/image.ts'
import { WEEKDAYS, DEFAULT_SLOTS } from './lib/constants.ts'
import { WATER_FUND, WATER_SOURCES, makeWaterId, makeWaterCertSeries, waterChecks } from './lib/water.ts'
import { STAFF_STATUSES } from './lib/constants.ts'
import { SANCTION_LADDER, SANCTION_SEVERE, MINI } from './lib/constants.ts'
import { Seal, CrossSeal } from './components/Seals.tsx'
import QrScanner from './components/QrScanner.tsx'
import Directory from './components/Directory.tsx'
const SterlingModule = lazy(() => import('./portals/SterlingPortal.tsx'))
const FoodHandlerModule = lazy(() => import('./portals/FoodHandlerPortal.tsx'))
const LaboratoryModule = lazy(() => import('./portals/LaboratoryPortal.tsx'))
const EmployerModule = lazy(() => import('./portals/EmployerPortal.tsx'))
const OfficerModule = lazy(() => import('./portals/OfficerPortal.tsx'))
const RegulatorModule = lazy(() => import('./portals/RegulatorPortal.tsx'))
import { NDPA_CONSENT_VERSION, MANDATORY_TESTS, LAGOS_LGAS, FEE, WATER_FEE, isValidEmail, isValidPhone } from './lib/constants.ts'
import { LABS, CHART, WATERFALL, WATER_WATERFALL, FUND_PER_TXN, naira, otp6, PALETTE } from './lib/constants.ts'
import { DEMO, OFFLINE, seedDemo, normaliseCert, labsView, store } from './lib/store.ts'
import { STRINGS, LANGS, I18N, t, tr } from './lib/i18n.ts'
import { toast, registerToast } from './lib/toast.ts'

/* ------------------------------------------------------------------ */
/*  Configuration and backend abstraction now live in ./lib/config.ts  */
/* ------------------------------------------------------------------ */

function Toasts() {
  const [items, setItems] = useState([])
  useEffect(() => {
    const add = (msg, kind) => { const id = Math.random(); setItems(x => [...x, { id, msg, kind }]); setTimeout(() => setItems(x => x.filter(i => i.id !== id)), 4200) }
    return registerToast(add)
  }, [])
  if (!items.length) return null
  // aria-live region so screen-reader users hear status messages. Errors are
  // assertive (interrupt), successes are polite. WCAG 2.1 AA 4.1.3.
  return <div className="toasts" role="status" aria-live="polite" aria-atomic="true">{items.map(i => <div key={i.id} className={'toast ' + (i.kind || '')} role={i.kind === 'err' ? 'alert' : undefined}>{i.msg}</div>)}</div>
}

/* Internationalisation. English and Yoruba, extend by adding keys. */

// Data layer now lives in ./lib/store.ts
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


const PILLARS = [
  { n: '1', title: 'Mandatory testing', body: 'Standardised biannual testing for food handlers, and testing of potable water and beverages, through accredited ISO-certified laboratories.' },
  { n: '2', title: 'Digital platform', body: 'Register, schedule, pay, get results, get certified, and stay monitored, end to end.' },
  { n: '3', title: 'Coordinated enforcement', body: 'LSMoH, LASEPA and HEFAMAA aligned under one operational system with a live audit trail.' },
  { n: '4', title: 'Self-sustaining finance', body: 'A standardised fee and transparent waterfall keep the programme running without indefinite public funding.' }
]

const BURDEN = [
  { stat: '200,000', label: 'food-poisoning deaths a year in Nigeria', src: 'NAFDAC' },
  { stat: '600m', label: 'foodborne illness cases worldwide each year', src: 'WHO' },
  { stat: 'US$110bn', label: 'annual cost to low and middle-income economies', src: 'World Bank' }
]



// Compress a photo to <= ~200KB and return a JPEG data URL.


// Build and download a Certificate of Fitness PDF.



// Chart palette (defined early: referenced by AUDIT_CATS and the chart components).



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






function tabsForSession(session) {
  if (!session) return [
    { id: 'overview', label: t('nav_overview') },
    { id: 'system', label: t('nav_system') },
    { id: 'impact', label: t('nav_impact') },
    { id: 'report', label: 'Report a concern' },
    { id: 'directory', label: 'Directory' },
    { id: 'faq', label: 'FAQ' },
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
    case 'laboratory': return [{ id: 'queue', label: t('nav_queue') }, { id: 'availability', label: 'Availability' }, { id: 'verify', label: t('nav_verify') }]
    case 'employer': return [{ id: 'team', label: t('nav_team') }, { id: 'premises', label: 'Premises' }, { id: 'water', label: t('nav_water') }, { id: 'verify', label: t('nav_verify') }]
    case 'sterling': return [
      { id: 'home', label: t('nav_home') }, { id: 'ledger', label: t('nav_ledger') }, { id: 'releases', label: t('nav_releases') },
      { id: 'batch', label: t('nav_batch') }, { id: 'beneficiaries', label: t('nav_beneficiaries') }, { id: 'fund', label: t('nav_fund') }, { id: 'reconcile', label: t('nav_reconcile') }, { id: 'reports', label: 'Reports' }, { id: 'admin', label: 'Admin' }, { id: 'verify', label: t('nav_verify') }
    ]
    case 'regulator':
      if (session.agency === 'LASEPA') return [{ id: 'home', label: t('nav_home') }, { id: 'enforcement', label: t('nav_enforcement') }, { id: 'complaints', label: 'Complaints' }, { id: 'water', label: t('nav_water') }, { id: 'officers', label: 'Officers' }, { id: 'reports', label: 'Reports' }, { id: 'audit', label: t('nav_audit') }, { id: 'verify', label: t('nav_verify') }]
      if (session.agency === 'HEFAMAA') return [{ id: 'home', label: t('nav_home') }, { id: 'accreditation', label: t('nav_accreditation') }, { id: 'officers', label: 'Officers' }, { id: 'reports', label: 'Reports' }, { id: 'audit', label: t('nav_audit') }, { id: 'verify', label: t('nav_verify') }]
      return [{ id: 'home', label: t('nav_home') }, { id: 'review', label: t('nav_review') }, { id: 'certificates', label: t('nav_certificates') }, { id: 'complaints', label: 'Complaints' }, { id: 'officers', label: 'Officers' }, { id: 'reports', label: 'Reports' }, { id: 'documents', label: 'Documents' }, { id: 'audit', label: t('nav_audit') }, { id: 'verify', label: t('nav_verify') }]
    default: return [{ id: 'verify', label: t('nav_verify') }]
  }
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

function Styles() {
  return (
    <style>{`
      :root{
        --green:${PALETTE.green};--gold:${PALETTE.gold};--navy:${PALETTE.navy};
        --ink:#0b1a13;--muted:#5a6b62;--faint:#8a9a90;
        --line:#e5ebe6;--line-strong:#d3ddd6;
        --paper:#f4f8f5;--surface:#ffffff;--surface-2:#f8fbf9;
        --green-pale:#e8f4ec;--green-soft:#d5ecdd;--gold-pale:#fdf4e2;--navy-pale:#eef2f7;
        --green-deep:#034023;--green-glow:#10a04c;--green-bright:#0a8a44;--gold-deep:#d98a1f;
        --mono:'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,monospace;
        --display:'Fraunces','Lora',Georgia,serif;
        --sans:'Plus Jakarta Sans','Inter',system-ui,-apple-system,sans-serif;
        --r-xs:7px;--r-sm:10px;--r:13px;--r-lg:18px;--r-xl:26px;--r-2xl:32px;
        --sh-xs:0 1px 2px rgba(11,26,19,.05);
        --sh-sm:0 1px 3px rgba(11,26,19,.05),0 2px 8px -2px rgba(11,26,19,.06);
        --sh-md:0 2px 6px rgba(11,26,19,.05),0 12px 28px -8px rgba(11,26,19,.12);
        --sh-lg:0 4px 10px rgba(11,26,19,.06),0 28px 56px -14px rgba(11,26,19,.20);
        --sh-glow:0 10px 30px -6px rgba(6,102,52,.42);
        --sh-gold:0 10px 30px -6px rgba(217,138,31,.36);
        --ease:cubic-bezier(.22,.61,.36,1);--spring:cubic-bezier(.34,1.56,.64,1);
        --accent:${PALETTE.green};
        --grad-green:linear-gradient(135deg,#0a8a44 0%,#046634 55%,#034023 100%);
        --grad-surface:linear-gradient(180deg,#ffffff 0%,#fbfdfc 100%);
      }
      *{box-sizing:border-box}
      html,body,#root{margin:0;padding:0}
      body{background:var(--paper);color:var(--ink);font-family:var(--sans);line-height:1.55;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;font-feature-settings:'cv02','cv03','cv04','ss01'}
      h1,h2,h3,h4,.serif{font-family:var(--display);font-optical-sizing:auto;letter-spacing:-.02em;font-weight:600}
      button{font-family:inherit;cursor:pointer}
      .wrap{max-width:1180px;margin:0 auto;padding:0 22px}
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
      .navtab{padding:11px 16px;border:0;background:none;font-weight:600;font-size:14.5px;color:var(--muted);border-radius:9px;min-height:42px}
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

      .btn{border:1px solid var(--line);background:#fff;color:var(--ink);padding:12px 20px;border-radius:10px;font-weight:600;font-size:14.5px;min-height:44px;transition:.15s}
      .btn:hover{border-color:var(--green)}
      .btn.p{background:var(--green);border-color:var(--green);color:#fff}
      .btn.p:hover{background:#00560a}
      .btn.g{background:var(--gold);border-color:var(--gold);color:#3a2600}
      .btn.ghost{background:transparent;border-color:transparent}
      .btn.sm{padding:9px 15px;font-size:13.5px;min-height:38px}
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

      .card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:30px}
      .center-narrow{max-width:520px;margin:0 auto}
      .verify-panel{background:#fff;border:1px solid var(--line);border-radius:16px;padding:26px;max-width:560px}
      .field{display:block;margin-bottom:14px}
      .field label{display:block;font-size:13px;font-weight:600;margin-bottom:6px}
      .field input,.field select{width:100%;padding:13px 15px;border:1px solid var(--line);border-radius:10px;font-size:15px;font-family:inherit;background:#fff;min-height:48px}
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
      .tile{background:#fff;border:1px solid var(--line);border-radius:14px;padding:20px}
      .trend{font-size:11.5px;font-weight:700;margin-top:6px}
      .attn-pill{background:#fff;border:1px solid var(--line);border-radius:11px;padding:12px 16px;font-size:13.5px;display:flex;align-items:baseline;gap:7px;cursor:pointer;text-align:left;font-family:inherit;color:inherit;transition:border-color .15s,box-shadow .15s}
      .attn-pill:hover{border-color:var(--green);box-shadow:0 2px 10px rgba(0,102,0,.10)}
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
      .notif-count{position:absolute;top:2px;right:2px;min-width:16px;height:16px;padding:0 4px;border-radius:9px;background:var(--gold);color:#3a2a00;border:1.5px solid #fff;font-size:10px;font-weight:800;font-style:normal;display:grid;place-items:center;line-height:1}
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
      .sidelink{display:flex;align-items:center;gap:12px;padding:13px 14px;border:0;background:none;border-radius:11px;font-weight:600;font-size:15px;color:var(--muted);text-align:left;cursor:pointer;min-height:46px;transition:background .15s,color .15s}
      .sidelink svg{width:18px;height:18px;flex:0 0 18px;opacity:.75}
      .sidelink:hover{background:var(--green-pale);color:var(--ink)}
      .sidelink.on{background:var(--green-pale);color:var(--accent, var(--green));box-shadow:inset 3px 0 0 var(--accent, var(--green))}
      .sidelink.on svg{opacity:1;color:var(--accent, var(--green))}
      .appmain{flex:1;min-width:0;display:flex;flex-direction:column;min-height:calc(100vh - 36px)}
      #maincontent{flex:1 0 auto;display:flex;flex-direction:column}
      .landing-shell{min-height:100vh;display:flex;flex-direction:column}
      .landing-main{flex:1 0 auto}
      #maincontent > .page{flex:1 0 auto}
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
      .lnk{background:none;border:0;color:#9a6200;font-weight:700;cursor:pointer;padding:0;text-decoration:underline;font:inherit}
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
      #maincontent:focus{outline:none}
      .skip-link{position:absolute;left:-9999px;top:8px;z-index:200;background:var(--green);color:#fff;padding:11px 18px;border-radius:9px;font-weight:700;font-size:14px}
      .skip-link:focus{left:12px}
      @media print{
        .apptop,.sidebar,.hamburger,.footer,.navtabs,.actions,.consent,.toast,.bellpanel,.skip-link,.avatar,.floaty{display:none!important}
        .appmain,.page,.wrap{padding:0!important;margin:0!important}
        .trust{box-shadow:none!important;border:2px solid var(--green)!important;page-break-inside:avoid}
        body,html,#root{background:#fff!important}
        .btn{display:none!important}
      }
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

      /* ============================================================
         v2 ELEVATION LAYER — materiality, depth, refined hierarchy
         ============================================================ */
      body{background:
        radial-gradient(1100px 520px at 8% -8%, rgba(16,160,76,.10), transparent 60%),
        radial-gradient(900px 480px at 100% 0%, rgba(251,174,64,.09), transparent 55%),
        linear-gradient(180deg,#f0f7f2 0%, var(--paper) 40%) fixed;
      }

      /* Typographic scale + rhythm */
      .serif,h1,h2,h3,h4{letter-spacing:-.022em;font-weight:600}
      .hero h1{font-weight:600;letter-spacing:-.032em}
      h2.sec{font-weight:600;letter-spacing:-.028em}
      .kicker{color:var(--gold-deep);filter:none;font-weight:800;letter-spacing:.14em;font-size:11.5px}
      .eyebrow{font-weight:700;background:linear-gradient(180deg,#fff,#f4faf6);border-color:var(--green-soft);box-shadow:var(--sh-xs);color:var(--green-deep)}

      /* Government bar — richer, layered */
      .govbar{background:var(--grad-green);box-shadow:inset 0 -1px 0 rgba(255,255,255,.08)}

      /* Header — glassy, subtle depth */
      .hdr{background:rgba(255,255,255,.82);backdrop-filter:saturate(1.4) blur(14px);-webkit-backdrop-filter:saturate(1.4) blur(14px);border-bottom:1px solid rgba(210,221,214,.7)}
      .hdr.sc{box-shadow:0 10px 30px -12px rgba(11,26,19,.14)}
      .brand b{font-family:var(--display);letter-spacing:-.02em}
      .navtab{border-radius:10px;font-weight:600}
      .navtab.on{background:linear-gradient(180deg,var(--green-pale),#dff0e6);color:var(--green-deep);box-shadow:inset 0 0 0 1px rgba(16,160,76,.14)}
      .navtab:after{height:0}

      /* Buttons — confident, tactile */
      .btn{border-radius:var(--r);font-weight:600;letter-spacing:-.005em;box-shadow:var(--sh-xs);background:var(--grad-surface)}
      .btn:hover{border-color:var(--line-strong);box-shadow:var(--sh-sm)}
      .btn.p{background:var(--grad-green);border:1px solid var(--green-deep);color:#fff;box-shadow:0 1px 2px rgba(3,64,35,.3),0 8px 20px -8px rgba(6,102,52,.5)}
      .btn.p:hover{box-shadow:var(--sh-glow);filter:brightness(1.04)}
      .btn.g{background:linear-gradient(135deg,#fdc063,#f2a838);border:1px solid var(--gold-deep);color:#3a2600}
      .btn.g:hover{box-shadow:var(--sh-gold)}
      .btn.ghost{box-shadow:none;background:none}

      /* Cards & surfaces — soft depth, hairline ring */
      .card{background:var(--grad-surface);border:1px solid var(--line);border-radius:var(--r-lg);box-shadow:var(--sh-sm)}
      .card:hover{box-shadow:var(--sh-md)}
      .pillar,.role-card,.tile,.chartcard,.journey,.verify-panel,.ord,.attn-pill,.lab-row{background:var(--grad-surface)}
      .verify-panel{border-radius:var(--r-xl);box-shadow:var(--sh-md)}

      /* Pillars — number chip becomes a jewel */
      .pillar{border-radius:var(--r-lg)}
      .pillar .num{background:var(--grad-green);box-shadow:0 6px 14px -4px rgba(6,102,52,.5);border-radius:10px;width:34px;height:34px;font-family:var(--display)}
      .pillar h3{letter-spacing:-.02em}

      /* Burden stat cells — deep, premium navy with texture */
      .burden .cell{background:linear-gradient(155deg,#0a2a4a 0%, var(--navy) 60%, #04223e 100%);border-radius:var(--r-lg);box-shadow:var(--sh-md);position:relative;overflow:hidden}
      .burden .cell:before{content:'';position:absolute;inset:0;background:radial-gradient(420px 200px at 100% 0,rgba(251,174,64,.14),transparent 60%);pointer-events:none}
      .burden .cell .big{font-family:var(--display);background:linear-gradient(180deg,#ffd88a,var(--gold));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}

      /* Stat tiles — the accent rail becomes a gradient, numbers sing */
      .tile{border-radius:var(--r-lg);box-shadow:var(--sh-sm)}
      .tile:before{width:3px;background:linear-gradient(180deg,var(--green-glow),var(--green))}
      .tile .v{font-family:var(--display);font-weight:600;color:var(--ink)}

      /* Badges & statuses — pill-perfect */
      .badge{border-radius:100px;font-weight:700}
      .status{font-weight:700}

      /* Inputs — softer, focus glow refined */
      .field input,.field select,.field textarea{background:#fff;border-color:var(--line-strong);border-radius:var(--r)}
      .field input:focus,.field select:focus,.field textarea:focus{border-color:var(--green-bright);box-shadow:0 0 0 4px rgba(16,160,76,.14)}

      /* Sidebar — cleaner rail, active state pops */
      .sidebar{background:linear-gradient(180deg,#fff, #fafdfb)}
      .sidelink.on{background:linear-gradient(90deg,var(--green-pale),transparent);box-shadow:inset 3px 0 0 var(--green)}
      .apptop{background:rgba(255,255,255,.85);backdrop-filter:saturate(1.3) blur(12px);-webkit-backdrop-filter:saturate(1.3) blur(12px);border-top:3px solid transparent;border-image:var(--grad-green) 1;box-shadow:0 1px 0 rgba(210,221,214,.6)}

      /* Chart cards — quiet elevation */
      .chartcard{border-radius:var(--r-lg);box-shadow:var(--sh-sm);border-color:var(--line)}
      .charttitle{letter-spacing:-.01em}

      /* Trust result (verify) — hero moment */
      .trust{border-radius:var(--r-2xl);box-shadow:var(--sh-lg)}
      .trust.ok{background:linear-gradient(160deg,#eafaf0 0%,#fff 70%)}

      /* Modals & panels — floating glass */
      .modal{border-radius:var(--r-xl);box-shadow:var(--sh-lg);border:1px solid var(--line)}
      .modal-bg{background:rgba(6,20,14,.42);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}
      .bellpanel,.avmenu,.wsmenu{border-radius:var(--r-lg);box-shadow:var(--sh-lg);border-color:var(--line)}

      /* Toast — refined */
      .toast{border-radius:var(--r);box-shadow:var(--sh-lg)}

      /* Footer — richer */
      .footer{background:linear-gradient(180deg,#04223e,var(--navy));color:#c6d4e2}
      .footer b{font-family:var(--display)}

      /* Chips & pills */
      .chip{background:var(--grad-surface);box-shadow:var(--sh-xs)}
      .chip b{font-family:var(--display)}

      /* Section reveal easing already present; add gentle scale to cards on hover for tactility */
      .role-card:hover{box-shadow:var(--sh-md);border-color:var(--green-soft)}

      @media(prefers-reduced-motion:reduce){.hdr,.apptop{backdrop-filter:none;-webkit-backdrop-filter:none}}

      /* ---- Landing v2 composition ---- */
      .landing-v2 .hero{padding:26px 0 8px}
      .hero-badge{position:relative;display:grid;place-items:center;width:300px;height:300px;max-width:74vw}
      .hero-badge img{width:230px;max-width:60vw;filter:drop-shadow(0 14px 34px rgba(6,20,14,.18));position:relative;z-index:1}
      .hero-badge-ring{position:absolute;inset:0;border-radius:50%;background:
        radial-gradient(circle at 50% 42%, rgba(16,160,76,.14), transparent 58%);
        box-shadow:inset 0 0 0 1px rgba(16,160,76,.12)}
      .hero-badge:before{content:'';position:absolute;width:260px;height:260px;border-radius:50%;border:1px dashed rgba(6,102,52,.22);animation:spin 60s linear infinite}
      @keyframes spin{to{transform:rotate(360deg)}}

      .metric-band{margin:38px 0 8px;display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--line);border:1px solid var(--line);border-radius:var(--r-xl);overflow:hidden;box-shadow:var(--sh-sm)}
      .metric{background:var(--grad-surface);padding:24px 22px;text-align:center}
      .metric .m-v{font-family:var(--display);font-weight:600;font-size:clamp(26px,3.6vw,38px);letter-spacing:-.03em;color:var(--green-deep);line-height:1}
      .metric .m-k{margin-top:8px;font-size:12.5px;color:var(--muted);font-weight:500}

      .lsec{margin:56px 0}
      .lsec-head{max-width:640px;margin-bottom:26px}
      .lsec-head .sec{margin:8px 0 8px}

      .trust-band{margin:48px 0 8px;background:linear-gradient(150deg,#0a2a4a 0%,var(--navy) 55%,#04223e 100%);border-radius:var(--r-2xl);padding:clamp(28px,4vw,48px);display:grid;grid-template-columns:1.3fr .8fr;gap:32px;align-items:center;box-shadow:var(--sh-lg);position:relative;overflow:hidden}
      .trust-band:before{content:'';position:absolute;inset:0;background:radial-gradient(600px 300px at 100% 0,rgba(251,174,64,.16),transparent 60%);pointer-events:none}
      .trust-band>*{position:relative;z-index:1}
      .trust-band-art{display:grid;place-items:center}
      .tb-qr{background:#fff;border-radius:var(--r-lg);padding:18px;box-shadow:var(--sh-lg);transform:rotate(-4deg)}
      .tb-qr-grid{display:grid;grid-template-columns:repeat(7,16px);grid-auto-rows:16px;gap:3px}
      .tb-qr-grid span{background:#eef2ef;border-radius:3px}
      .tb-qr-grid span.on{background:var(--navy)}

      @media(max-width:860px){
        .metric-band{grid-template-columns:repeat(2,1fr)}
        .trust-band{grid-template-columns:1fr}
        .trust-band-art{display:none}
      }
      @media(prefers-reduced-motion:reduce){.hero-badge:before{animation:none}}

      /* ---- Centered top navigation ---- */
      .hdr .bar:not(.app){display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px}
      .hdr .bar:not(.app) .navtabs{flex:initial;justify-content:center;gap:4px}
      .hdr .bar:not(.app) .actions{margin-left:0}
      .navtab{padding:10px 15px}
      @media(max-width:1040px){
        .hdr .bar:not(.app){grid-template-columns:auto auto;grid-template-areas:'brand actions' 'nav nav';row-gap:6px}
        .hdr .bar:not(.app) .brand{grid-area:brand}
        .hdr .bar:not(.app) .actions{grid-area:actions;margin-left:auto}
        .hdr .bar:not(.app) .navtabs{grid-area:nav;justify-content:flex-start;overflow-x:auto;flex-wrap:nowrap;-webkit-overflow-scrolling:touch;padding-bottom:2px}
      }

      /* ============================================================
         HERO BANNER + 3D scene
         ============================================================ */
      .hero-banner{position:relative;margin-bottom:8px;overflow:hidden;
        background:
          radial-gradient(900px 460px at 12% 8%, rgba(16,160,76,.16), transparent 58%),
          radial-gradient(760px 420px at 92% 4%, rgba(251,174,64,.14), transparent 55%),
          linear-gradient(168deg,#ffffff 0%, #f2f9f4 52%, #eaf4ee 100%);
        border-bottom:1px solid var(--line)}
      .hero-banner:before{content:'';position:absolute;inset:0;pointer-events:none;
        background-image:linear-gradient(rgba(6,102,52,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(6,102,52,.05) 1px,transparent 1px);
        background-size:46px 46px;mask-image:radial-gradient(70% 60% at 50% 0,#000,transparent 78%);-webkit-mask-image:radial-gradient(70% 60% at 50% 0,#000,transparent 78%);opacity:.5}
      .hero-banner-inner{position:relative;z-index:2;padding:34px 22px 40px;max-width:1280px;margin:0 auto}
      .landing-v2 .hero{padding:0}
      .banner-desc{font-size:16px;color:var(--ink);font-weight:500;margin:0 0 12px;max-width:52ch;opacity:.9}
      .hero .lede{margin-top:0}

      /* ---- Side-filling floating 3D field ---- */
      .hero-field{position:absolute;inset:0;z-index:1;pointer-events:none;transform-style:preserve-3d;perspective:1000px}
      .hf-card{position:absolute;display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.9);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);border:1px solid var(--line);border-radius:12px;padding:10px 14px;font-size:12.5px;font-weight:600;color:var(--ink);box-shadow:var(--sh-lg);white-space:nowrap;
        transform:translate3d(calc(var(--mx,0)*var(--d,20px)*-1),calc(var(--my,0)*var(--d,20px)*-1),0) rotate(var(--rot,0deg));transition:transform .35s var(--ease)}
      .hf-card .hc-dot{width:8px;height:8px;border-radius:50%;background:var(--green-glow);box-shadow:0 0 0 4px rgba(16,160,76,.18)}
      .hf-card .hc-dot.amber{background:var(--gold);box-shadow:0 0 0 4px rgba(251,174,64,.22)}
      .hf-c{top:19%;right:2.5%;--d:52px;--rot:5deg}
      .hf-d{top:76%;right:5%;--d:34px;--rot:-4deg}
      @media(max-width:1120px){.hf-c,.hf-d,.hf-qr{display:none}}
      .hf-orb{position:absolute;border-radius:50%;filter:blur(2px);
        transform:translate3d(calc(var(--mx,0)*var(--d,60px)*-1),calc(var(--my,0)*var(--d,60px)*-1),0);transition:transform .4s var(--ease)}
      .hf-orb-1{width:150px;height:150px;top:6%;left:6%;--d:70px;background:radial-gradient(circle at 35% 30%,rgba(16,160,76,.20),rgba(16,160,76,.02) 68%)}
      .hf-orb-2{width:170px;height:170px;bottom:4%;right:12%;--d:90px;background:radial-gradient(circle at 40% 35%,rgba(251,174,64,.22),rgba(251,174,64,.02) 68%)}
      .hf-orb-3{width:120px;height:120px;top:44%;left:-2%;--d:52px;background:radial-gradient(circle at 40% 35%,rgba(0,51,102,.14),rgba(0,51,102,.01) 66%)}
      .hf-ring{position:absolute;border-radius:50%;border:1.5px dashed rgba(6,102,52,.16);
        transform:translate3d(calc(var(--mx,0)*var(--d,40px)*-1),calc(var(--my,0)*var(--d,40px)*-1),0);transition:transform .5s var(--ease)}
      .hf-ring-1{width:230px;height:230px;top:30%;left:-4%;--d:40px}
      .hf-ring-2{width:150px;height:150px;bottom:-4%;left:22%;--d:56px;border-color:rgba(217,138,31,.18)}
      .hf-qr{position:absolute;top:52%;right:1.5%;background:#fff;border-radius:12px;padding:12px;box-shadow:var(--sh-lg);
        transform:translate3d(calc(var(--mx,0)*60px*-1),calc(var(--my,0)*60px*-1),0) rotate(6deg);transition:transform .4s var(--ease)}
      .hf-qr-grid{display:grid;grid-template-columns:repeat(6,11px);grid-auto-rows:11px;gap:2.5px}
      .hf-qr-grid span{background:#eef2ef;border-radius:2px}
      .hf-qr-grid span.on{background:var(--navy)}
      @media(max-width:1100px){.hf-a,.hf-b,.hf-c,.hf-d,.hf-qr,.hf-ring{display:none}}

      /* 3D scene: deeper perspective, parallax-reactive layers */
      .hero-scene{position:relative;width:360px;max-width:82vw;height:360px;display:grid;place-items:center;perspective:1000px;transform-style:preserve-3d}
      .hero-scene .hero-badge{transform:rotateY(calc(-16deg + var(--mx,0)*16deg)) rotateX(calc(7deg + var(--my,0)*-12deg));transform-style:preserve-3d;transition:transform .3s var(--ease)}
      .hero-badge img{filter:drop-shadow(0 26px 34px rgba(6,20,14,.32))}
      .hero-card{position:absolute;display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.94);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border:1px solid var(--line);border-radius:12px;padding:11px 14px;font-size:13px;font-weight:600;color:var(--ink);box-shadow:var(--sh-lg);white-space:nowrap}
      .hero-card .hc-dot{width:9px;height:9px;border-radius:50%;background:var(--green-glow);box-shadow:0 0 0 4px rgba(16,160,76,.18)}
      .hero-card .hc-dot.amber{background:var(--gold);box-shadow:0 0 0 4px rgba(251,174,64,.22)}
      .hero-card-1{top:30px;left:-14px;transform:translate3d(calc(var(--mx,0)*-40px),calc(var(--my,0)*-40px),80px) rotate(-4deg);animation:float3d 6s ease-in-out infinite;transition:transform .3s var(--ease)}
      .hero-card-2{bottom:38px;right:-18px;transform:translate3d(calc(var(--mx,0)*-56px),calc(var(--my,0)*-56px),110px) rotate(3deg);animation:float3d2 6s ease-in-out infinite .8s;transition:transform .3s var(--ease)}
      @keyframes float3d{0%,100%{translate:0 0}50%{translate:0 -10px}}
      @keyframes float3d2{0%,100%{translate:0 0}50%{translate:0 -12px}}

      /* ---- 3D depth on interactive cards ---- */
      .pillars,.role-grid{perspective:1200px}
      .pillar,.role-card{transform-style:preserve-3d;transition:transform .3s var(--ease),box-shadow .3s var(--ease),border-color .2s}
      .pillar:hover{transform:translateY(-6px) rotateX(4deg) rotateY(-3deg);box-shadow:0 30px 50px -18px rgba(11,26,19,.28)}
      .role-card:hover{transform:translateY(-5px) rotateX(3deg);box-shadow:0 26px 44px -18px rgba(11,26,19,.26)}
      .metric{transition:transform .25s var(--ease)}
      .metric:hover{transform:translateY(-3px)}
      .tb-qr{transform:rotate(-4deg) rotateY(14deg) rotateX(6deg);transition:transform .5s var(--ease)}
      .trust-band:hover .tb-qr{transform:rotate(-2deg) rotateY(8deg) rotateX(3deg)}

      @media(max-width:860px){
        .hero-scene{height:280px}
        .hero-card{font-size:12px;padding:9px 12px}
      }
      @media(prefers-reduced-motion:reduce){
        .hero-card-1,.hero-card-2{animation:none}
        .hero-scene .hero-badge,.pillar:hover,.role-card:hover,.tb-qr,.trust-band:hover .tb-qr{transform:none}
        .hf-card,.hf-orb,.hf-ring,.hf-qr,.hero-card-1,.hero-card-2{transform:none!important}
      }
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
          <span className="wordmark"><b>Safe<span>Plate</span></b><small>Lagos food &amp; water safety</small></span>
        </button>
        <nav className="navtabs">
          {tabs.map(tb => (<button key={tb.id} className={'navtab ' + (active === tb.id ? 'on' : '')} aria-current={active === tb.id ? 'page' : undefined} onClick={() => onTab(tb.id)}>{tb.label}</button>))}
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
                  {notices.length > 0 && <i className="notif-count">{notices.length > 9 ? '9+' : notices.length}</i>}
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
            <button key={tb.id} className={'sidelink' + (active === tb.id ? ' on' : '')} aria-current={active === tb.id ? 'page' : undefined} onClick={() => { onTab(tb.id); onClose() }}>
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
            {notices.length > 0 && <i className="notif-count">{notices.length > 9 ? '9+' : notices.length}</i>}
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


function Footer({ onPrivacy }) {
  return (
    <footer className="footer"><div className="wrap">
      <div><b>SafePlate</b><br />Operated by the Lagos State Ministry of Health.<br />Oversight: LSMoH, LASEPA, HEFAMAA. Escrow: Sterling Bank.</div>
      <div style={{ textAlign: 'right' }}>One Health strategy for food and water safety.<br />NAFDAC Food Hygiene Regulation 2019, NDPA 2023 and GDPR aligned.<br /><button className="foot-lnk" onClick={openHelp}>Help and support</button> · <button className="foot-lnk" onClick={onPrivacy}>Privacy notice</button> &middot; {SUPABASE_READY ? 'Connected backend' : 'Preview mode'}</div>
    </div></footer>
  )
}

/* Shared 2FA guard used by regulator and Sterling actions */

/* ------------------------------------------------------------------ */
/*  Public pages (Stage 1)                                             */
/* ------------------------------------------------------------------ */

function Overview({ onStart, onVerify }) {
  const certs = useCountUp(14892)
  const comp = useCountUp(89.4)
  const labs = useCountUp(38)
  const bannerRef = useRef(null)
  useEffect(() => {
    const el = bannerRef.current
    if (!el) return
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    const onMove = e => {
      const r = el.getBoundingClientRect()
      const mx = (e.clientX - r.left) / r.width - 0.5
      const my = (e.clientY - r.top) / r.height - 0.5
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => { el.style.setProperty('--mx', mx.toFixed(3)); el.style.setProperty('--my', my.toFixed(3)) })
    }
    const onLeave = () => { el.style.setProperty('--mx', '0'); el.style.setProperty('--my', '0') }
    el.addEventListener('mousemove', onMove); el.addEventListener('mouseleave', onLeave)
    return () => { el.removeEventListener('mousemove', onMove); el.removeEventListener('mouseleave', onLeave); cancelAnimationFrame(raf) }
  }, [])
  return (
    <div className="page landing-v2">
      <div className="hero-banner" ref={bannerRef}>
        {/* side-filling floating 3D field */}
        <div className="hero-field" aria-hidden="true">
          <div className="hf-card hf-c"><span className="hc-dot" /> Escrow released</div>
          <div className="hf-card hf-d"><span className="hc-dot amber" /> Lab accredited</div>
          <div className="hf-orb hf-orb-1" />
          <div className="hf-orb hf-orb-2" />
          <div className="hf-orb hf-orb-3" />
          <div className="hf-ring hf-ring-1" />
          <div className="hf-ring hf-ring-2" />
          <div className="hf-qr" aria-hidden="true"><div className="hf-qr-grid">{Array.from({ length: 36 }).map((_, i) => <span key={i} className={((i * 5 + (i % 4) * 3) % 3 === 0) ? 'on' : ''} />)}</div></div>
        </div>
        <div className="hero-banner-inner">
          <div className="hero">
            <div className="hero-copy">
              <span className="eyebrow"><span className="pulse" />{t('hero_eyebrow')}</span>
              <h1 className="serif">{t('hero_title')}</h1>
              <p className="banner-desc">SafePlate is the Lagos State unified platform for food handler, potable water and beverage safety, one place to register, test, certify, verify and monitor.</p>
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
            <div className="hero-art">
              <div className="hero-scene">
                <div className="hero-badge floaty">
                  <img src="/lagos-logo.png" alt="Lagos State Government coat of arms" />
                  <div className="hero-badge-ring" />
                </div>
                <div className="hero-card hero-card-1" aria-hidden="true"><span className="hc-dot" /> Verified certificate</div>
                <div className="hero-card hero-card-2" aria-hidden="true"><span className="hc-dot amber" /> Water test passed</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="wrap">

      {/* Live metrics band */}
      <div className="metric-band reveal">
        <div className="metric"><div className="m-v">{Math.round(certs).toLocaleString('en-NG')}</div><div className="m-k">Active certificates</div></div>
        <div className="metric"><div className="m-v">{comp.toFixed(1)}%</div><div className="m-k">Statewide compliance</div></div>
        <div className="metric"><div className="m-v">{Math.round(labs)}</div><div className="m-k">Accredited laboratories</div></div>
        <div className="metric"><div className="m-v">₦0</div><div className="m-k">Hidden charges</div></div>
      </div>

      {/* How it works */}
      <div className="lsec">
        <div className="lsec-head reveal">
          <span className="kicker">How SafePlate works</span>
          <h2 className="sec serif">One system, from registration to certificate.</h2>
          <p className="sub">A preventive, data-driven model that replaces fragmented checks and pays for itself.</p>
        </div>
        <div className="pillars">{PILLARS.map((p, i) => (
          <div className="pillar reveal" key={p.n} style={{ animationDelay: (i * 0.08) + 's' }}><div className="num">{p.n}</div><h3 className="serif">{p.title}</h3><p>{p.body}</p></div>
        ))}</div>
      </div>

      {/* Trust / verify band */}
      <div className="trust-band reveal">
        <div>
          <span className="kicker" style={{ color: '#ffd88a' }}>Public trust</span>
          <h2 className="serif" style={{ color: '#fff', fontSize: 'clamp(22px,3vw,30px)', margin: '8px 0 8px' }}>Anyone can verify a certificate in seconds.</h2>
          <p style={{ color: '#c9dbe9', margin: '0 0 18px', maxWidth: '52ch', fontSize: 15 }}>Scan the QR on any SafePlate certificate, or search the SAFEPLATE ID, to confirm a food handler, water source or beverage producer is genuinely certified and in date.</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button className="btn g" onClick={onVerify}>Verify a certificate</button>
            <button className="btn" onClick={onStart} style={{ background: 'rgba(255,255,255,.08)', color: '#fff', borderColor: 'rgba(255,255,255,.25)' }}>Register as a handler</button>
          </div>
        </div>
        <div className="trust-band-art" aria-hidden="true">
          <div className="tb-qr">
            <div className="tb-qr-grid">{Array.from({ length: 49 }).map((_, i) => <span key={i} className={((i * 7 + (i % 5) * 3) % 3 === 0) ? 'on' : ''} />)}</div>
          </div>
        </div>
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

// Camera QR scanner. Reads a SafePlate QR and hands back the SAFEPLATE ID.
// Requires HTTPS (Vercel provides it) and one-off camera permission.

function FaqPage() {
  const [faqs, setFaqs] = useState(null)
  const [open, setOpen] = useState(0)
  useEffect(() => { store.listFaqs().then(setFaqs).catch(() => setFaqs([])) }, [])
  return (
    <div className="page"><div className="wrap" style={{ maxWidth: 820 }}>
      <div style={{ margin: '10px 0 22px' }}>
        <span className="kicker">Help centre</span>
        <h2 className="sec serif" style={{ margin: '8px 0 6px' }}>Frequently asked questions</h2>
        <p className="sub">Common questions about registering, testing, certificates and verification. Maintained by the Lagos State Ministry of Health.</p>
      </div>
      {faqs === null && <div className="muted">Loading…</div>}
      {faqs && faqs.length === 0 && <div className="note">No questions have been published yet.</div>}
      {faqs && faqs.map((f, i) => (
        <div key={f.id || i} className="card" style={{ marginBottom: 10, cursor: 'pointer' }} onClick={() => setOpen(open === i ? -1 : i)}>
          <div className="row-between" style={{ alignItems: 'center' }}>
            <b className="serif" style={{ fontSize: 16 }}>{f.question}</b>
            <span aria-hidden="true" style={{ fontSize: 20, color: 'var(--green)', transform: open === i ? 'rotate(45deg)' : 'none', transition: 'transform .2s' }}>+</span>
          </div>
          {open === i && <p className="muted" style={{ margin: '10px 0 0', fontSize: 14.5, lineHeight: 1.6 }}>{f.answer}</p>}
        </div>
      ))}
      <div className="note" style={{ marginTop: 18 }}>Still need help? Use <b>Report a concern</b> for vendor issues, or contact your local government health office.</div>
    </div></div>
  )
}

function VerifyWidget({ initialId }) {
  const [id, setId] = useState(initialId || '')
  const [result, setResult] = useState(undefined)
  const [loading, setLoading] = useState(false)
  const [scan, setScan] = useState(false)
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
      <button className="btn block" style={{ marginTop: 8 }} onClick={() => setScan(v => !v)}>{scan ? 'Close camera' : 'Scan QR code'}</button>
      {scan && <QrScanner onClose={() => setScan(false)} onFound={code => { setScan(false); setId(code); run(code) }} />}
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
          {result.status === 'VALID' && <div style={{ background: '#fff', padding: 8, borderRadius: 12, border: '1px solid var(--line)', textAlign: 'center' }}><QRCodeSVG value={window.location.origin + '/#/verify/' + (result.safeplateId || result.safeplate_id)} size={104} fgColor={PALETTE.navy} level="M" /><div className="muted" style={{ fontSize: 11, marginTop: 6 }}>Scan to verify</div></div>}
          {result.photo && <img src={result.photo} alt="Certificate holder" style={{ width: 108, height: 128, objectFit: 'cover', borderRadius: 12, border: '3px solid ' + (result.status === 'VALID' ? 'var(--green)' : '#e3c9c9'), boxShadow: 'var(--sh-md)' }} />}
        </div>
      )}
    </div>
  )
}

function ReportConcern() {
  const [f, setF] = useState({ establishment: '', lga: '', detail: '' })
  const [photos, setPhotos] = useState([])
  async function addPhotos(files) {
    const list = Array.from(files || []).slice(0, 4 - photos.length)
    for (const file of list) {
      try { const d = await compressImage(file, 260); setPhotos(p => (p.length >= 4 ? p : [...p, d])) }
      catch (e) { /* skip unreadable file */ }
    }
  }
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(null)
  async function submit() {
    setErr('')
    if (f.establishment.trim().length < 3) { setErr('Please enter the name of the establishment.'); return }
    if (f.detail.trim().length < 20) { setErr('Please describe what you saw, in at least 20 characters, so an officer knows what to look for.'); return }
    setBusy(true)
    try { const out = await store.fileComplaint({ establishment: f.establishment.trim(), lga: f.lga, detail: f.detail.trim(), photos }); setDone(out) }
    catch (e) { setErr(e.message || 'Your report could not be sent. Please try again.') }
    setBusy(false)
  }
  if (done) return (
    <div className="page"><div className="wrap" style={{ maxWidth: 640 }}>
      <div className="ok-banner">
        <div className="kicker" style={{ color: 'var(--green)' }}>Report received</div>
        <h3 className="serif" style={{ fontSize: 22, margin: '8px 0' }}>Thank you, an officer will look into this</h3>
        <p className="muted" style={{ marginTop: 0 }}>Your reference is <b className="mono">{done.reference}</b>. Keep it if you wish, though you do not need it, and we have not recorded who you are.</p>
        <p className="muted" style={{ fontSize: 13 }}>A report prompts an inspection. It is not by itself proof of wrongdoing, so no penalty follows from a report alone.</p>
      </div>
    </div></div>
  )
  return (
    <div className="page"><div className="wrap" style={{ maxWidth: 640 }}>
      <div className="greeting"><h2 className="sec serif" style={{ margin: 0 }}>Report a food or water concern</h2></div>
      <div className="note" style={{ marginBottom: 16 }}>This report is anonymous. We do not ask for your name or number and we do not record them. Tell us where and what you saw, and an officer will be sent to inspect.</div>
      <div className="card">
        <div className="field"><label>Establishment name</label><input value={f.establishment} onChange={e => setF({ ...f, establishment: e.target.value })} placeholder="e.g. Mama Nkechi Kitchen" /></div>
        <div className="field"><label>LGA</label><select value={f.lga} onChange={e => setF({ ...f, lga: e.target.value })}><option value="">Select LGA (optional)</option>{LAGOS_LGAS.map(l => <option key={l}>{l}</option>)}</select></div>
        <div className="field"><label>What did you see?</label><textarea value={f.detail} onChange={e => setF({ ...f, detail: e.target.value })} rows={5} placeholder="Describe what concerned you, and when. For example: no running water for handwashing, food left uncovered overnight." style={{ width: '100%', padding: '13px 15px', border: '1px solid var(--line)', borderRadius: 10, fontSize: 15, fontFamily: 'inherit' }} /></div>
        <div className="field">
          <label>Photographs or documents (optional, up to 4)</label>
          <input type="file" accept="image/*" multiple onChange={e => addPhotos(e.target.files)} />
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>A photograph helps an officer know what to look for. Please do not photograph people's faces.</div>
          {photos.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              {photos.map((p, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img src={p} alt={'Evidence ' + (i + 1)} style={{ width: 82, height: 82, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--line)' }} />
                  <button className="btn sm" style={{ position: 'absolute', top: -8, right: -8, padding: '2px 8px', minHeight: 0, borderRadius: 20 }} onClick={() => setPhotos(ps => ps.filter((_, k) => k !== i))}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
        {err && <div className="err" style={{ marginBottom: 10 }}>{err}</div>}
        <button className="btn p" onClick={submit} disabled={busy}>{busy ? 'Sending...' : 'Send report anonymously'}</button>
        <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>Because reports are anonymous we cannot come back to you for more detail, so please be as specific as you can.</p>
      </div>
    </div></div>
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
  const [labForm, setLabForm] = useState({ labName: '', contactPerson: '', phone: '', address: '', lga: '', bankName: '', accountNumber: '', accountName: '' })
  const [recOpen, setRecOpen] = useState(false)
  const [rec, setRec] = useState({ phone: '', nin: '' })
  const [recResult, setRecResult] = useState(null)
  const [recErr, setRecErr] = useState('')
  async function recoverId() {
    setRecErr(''); setRecResult(null)
    if (!/^0\d{10}$/.test(rec.phone.replace(/\s+/g, ''))) { setRecErr('Enter your 11-digit phone number, e.g. 08031234567.'); return }
    if (!/^\d{11}$/.test(rec.nin.replace(/\s+/g, ''))) { setRecErr('Enter your 11-digit NIN.'); return }
    try { const out = await store.recoverId(rec.phone, rec.nin); setRecResult(out) } catch (e) { setRecErr(e.message || 'No record matches those details.') }
  }
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
      if (mode === 'signup' && role.id === 'laboratory' && labForm.accountNumber && !/^\d{10}$/.test(labForm.accountNumber.replace(/\s+/g, ''))) { setErr('Bank account number must be exactly 10 digits.'); setBusy(false); return }
      // Food handlers may sign in with either their email or their phone number.
      // Supabase auth is email-keyed, so a phone is resolved to the account email.
      let loginEmail = email.trim()
      if (mode === 'signin' && role.id === 'food_handler' && isValidPhone(loginEmail)) {
        const r = await store.emailForPhone(loginEmail)
        if (!r.ok) { setErr(r.reason || 'That phone number is not registered. Try your email instead.'); setBusy(false); return }
        loginEmail = r.email
      }
      if (mode === 'signup' && !isValidEmail(loginEmail)) { setErr('Enter a valid email address to create your account.'); setBusy(false); return }
      if (mode === 'signin' && !isValidEmail(loginEmail) && !isValidPhone(email)) { setErr('Enter the email or phone number registered to your account.'); setBusy(false); return }
      const meta = { role: role.id, agency: ['regulator', 'officer'].includes(role.id) ? agency : null, name: name || loginEmail.split('@')[0], title: roleTitle(role.id, agency) }
      const user = mode === 'signup' ? await store.signUp(loginEmail, password, meta) : await store.signIn(loginEmail, password, role.id, meta.agency, meta.name)
      let finalUser = { ...user, email: user.email || loginEmail, role: user.role || role.id, agency: user.agency || meta.agency, title: user.title || meta.title, name: user.name || meta.name }
      if (finalUser.role === 'officer') {
        let off = await store.getOfficerByEmail(finalUser.email)
        if (!off) { off = await store.addOfficer({ name: finalUser.name, email: finalUser.email, agency: finalUser.agency, status: 'Pending' }) }
        finalUser = { ...finalUser, status: off.status, badge: off.badge, lga: off.lga, target: off.target, agency: off.agency || finalUser.agency }
      }
      if (finalUser.role === 'laboratory' && mode === 'signup' && labForm.labName.trim()) {
        try { await store.registerLab({ name: labForm.labName.trim(), contactPerson: labForm.contactPerson.trim(), phone: labForm.phone.trim(), address: labForm.address.trim(), lga: labForm.lga, bankName: labForm.bankName.trim(), accountNumber: labForm.accountNumber.trim(), accountName: labForm.accountName.trim() }) } catch (e) { /* lab can still sign in; HEFAMAA can add later */ }
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
            <div className="kicker" style={{ color: 'var(--green)', margin: '4px 0 8px' }}>Bank details for disbursement</div>
            <div className="field"><label>Bank</label><input value={labForm.bankName} onChange={e => setLabForm({ ...labForm, bankName: e.target.value })} placeholder="e.g. Sterling Bank" /></div>
            <div className="field"><label>Account number</label><input value={labForm.accountNumber} onChange={e => setLabForm({ ...labForm, accountNumber: e.target.value })} placeholder="10-digit NUBAN" inputMode="numeric" /></div>
            <div className="field"><label>Account name</label><input value={labForm.accountName} onChange={e => setLabForm({ ...labForm, accountName: e.target.value })} placeholder="Registered account name" /></div>
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>Your laboratory is submitted to HEFAMAA for accreditation. As a waterfall beneficiary your bank details are held securely and used to disburse your share when escrow is released. You can sign in immediately; you can receive samples once approved.</p>
          </div>
        )}
        {mode === 'signup' && <div className="field"><label>{role.id === 'laboratory' ? 'Your full name' : 'Full name'}</label><input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" /></div>}
        <div className="field"><label>{role.id === 'food_handler' ? 'Email or phone number' : 'Email'}</label><input value={email} onChange={e => setEmail(e.target.value)} placeholder={role.id === 'food_handler' ? 'you@example.com or 08031234567' : 'you@example.com'} /></div>
        <div className="field"><label>Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" /></div>
        {needs2fa && <div className="note" style={{ marginBottom: 14 }}>This portal requires 2FA. In the connected build an OTP is sent to your registered phone on every sign-in and approval.</div>}
        <button className="btn p block" onClick={submit} disabled={busy || !email || !password}>{busy ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Continue to portal'}</button>
        <p className="muted" style={{ textAlign: 'center', fontSize: 13, marginTop: 14, marginBottom: 0 }}>
          {mode === 'signup' ? 'Already registered? ' : 'New here? '}
          <button className="btn ghost" style={{ padding: 0, color: 'var(--green)', fontWeight: 600 }} onClick={() => { setErr(''); setMode(mode === 'signup' ? 'signin' : 'signup') }}>{mode === 'signup' ? 'Sign in' : 'Create an account'}</button>
        </p>
        {role.id === 'food_handler' && (
          <div style={{ marginTop: 10 }}>
            <button className="btn ghost" style={{ padding: 0, color: 'var(--muted)', fontWeight: 600, fontSize: 13 }} onClick={() => setRecOpen(v => !v)}>Forgot your SAFEPLATE ID?</button>
            {recOpen && (
              <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px', marginTop: 10, background: '#fafcfb' }}>
                <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>Enter the phone number and NIN you registered with. Both must match, so nobody can look you up with a phone number alone.</p>
                <div className="field"><label>Phone number</label><input value={rec.phone} onChange={e => setRec({ ...rec, phone: e.target.value })} placeholder="08031234567" inputMode="numeric" /></div>
                <div className="field"><label>NIN</label><input value={rec.nin} onChange={e => setRec({ ...rec, nin: e.target.value })} placeholder="11-digit NIN" inputMode="numeric" /></div>
                {recErr && <div className="err" style={{ marginBottom: 8 }}>{recErr}</div>}
                {recResult && <div className="ok-banner" style={{ padding: '12px 14px', marginBottom: 8 }}><div className="muted" style={{ fontSize: 12.5 }}>Your SAFEPLATE ID</div><div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{recResult.safeplateId}</div></div>}
                <button className="btn sm" onClick={recoverId}>Recover my ID</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div></div>
  )
}

/* ------------------------------------------------------------------ */
/*  Stage 3: Food handler onboarding                                   */
/* ------------------------------------------------------------------ */







/* ------------------------------------------------------------------ */
/*  Stage 4: Laboratory portal                                         */
/* ------------------------------------------------------------------ */






/* ------------------------------------------------------------------ */
/*  Stage 5: Regulator portals                                         */
/* ------------------------------------------------------------------ */

















/* --------------------------------------------------------------------------
   HEFAMAA laboratory accreditation criteria.

   A structured checklist scored on inspection. Items marked critical are
   non-negotiable: failing any one of them fails the audit outright, whatever
   the overall percentage, because they are the conditions under which a result
   cannot be trusted at all.

   NOTE FOR HEFAMAA: this criteria set is drafted from standard medical
   laboratory accreditation practice (MLSCN licensing, biosafety and quality
   management). It must be reviewed and signed off by the Agency before live
   use, and the wording here is deliberately easy to amend.
-------------------------------------------------------------------------- */








/* ------------------------------------------------------------------ */
/*  Stage 6: Sterling Bank escrow ledger                               */
/* ------------------------------------------------------------------ */







/* ------------------------------------------------------------------ */
/*  Stage 8: Employer portal and potable water module                  */
/* ------------------------------------------------------------------ */







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
      <div className="modal privacy" role="dialog" aria-modal="true" aria-label="Privacy notice" onClick={e => e.stopPropagation()}>
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
    function onHash() { const { route, param } = parseHash(); if (route === 'status') { setSpecial('status') } else if (route === 'verify') { setSpecial(null); setVerifyId(param || ''); setMode('app'); setTab('verify') } else if (route === 'directory') { setSpecial(null); setMode('app'); setTab('directory') } else { setSpecial(null) } }
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
      if (tab === 'report') return <ReportConcern />
      if (tab === 'directory') return <Directory />
      if (tab === 'faq') return <FaqPage />
      return <Overview onStart={() => setMode('auth')} onVerify={() => setTab('verify')} />
    }
    if (eff.role === 'food_handler') return <Suspense fallback={<div style={{padding:24}} className="muted">Loading…</div>}><FoodHandlerModule session={eff} /></Suspense>
    if (eff.role === 'laboratory') return <Suspense fallback={<div style={{padding:24}} className="muted">Loading…</div>}><LaboratoryModule session={eff} tab={tab} adminView={isAdmin && workspace !== 'lsmoh'} /></Suspense>
    if (eff.role === 'regulator') return <Suspense fallback={<div style={{padding:24}} className="muted">Loading…</div>}><RegulatorModule session={eff} tab={tab} onTab={setTab} /></Suspense>
    if (eff.role === 'officer') return <Suspense fallback={<div style={{padding:24}} className="muted">Loading…</div>}><OfficerModule session={eff} tab={tab} /></Suspense>
    if (eff.role === 'sterling') return <Suspense fallback={<div style={{padding:24}} className="muted">Loading…</div>}><SterlingModule session={eff} tab={tab} onTab={setTab} /></Suspense>
    if (eff.role === 'employer') return <Suspense fallback={<div style={{padding:24}} className="muted">Loading…</div>}><EmployerModule session={eff} tab={tab} /></Suspense>
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
            <a href="#maincontent" className="skip-link">Skip to content</a>
            <AppTopBar session={session} onSignOut={signOut} lang={lang} onLang={changeLang} onPrivacy={() => setPrivacyOpen(true)} admin={isAdmin} workspace={workspace} onSwitch={switchWorkspace} onMenu={() => setNavOpen(v => !v)} />
            <div id="maincontent" tabIndex={-1}><ErrorBoundary label={tab} onReset={() => setTab('home')}>{page()}</ErrorBoundary></div>
            <Footer onPrivacy={() => setPrivacyOpen(true)} />
          </div>
        </div>
      ) : (
        <div className="landing-shell">
          <Header tabs={tabs} active={mode === 'auth' ? '' : tab} onTab={onTab} onBrand={onBrand} session={session} onSignIn={() => setMode('auth')} onSignOut={signOut} lang={lang} onLang={changeLang} onPrivacy={() => setPrivacyOpen(true)} admin={isAdmin} workspace={workspace} onSwitch={switchWorkspace} />
          <div className="landing-main"><ErrorBoundary label={tab} onReset={() => setTab('home')}>{page()}</ErrorBoundary></div>
          <Footer onPrivacy={() => setPrivacyOpen(true)} />
        </div>
      )}
      <ConsentBanner onPrivacy={() => setPrivacyOpen(true)} />
      <PrivacyModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
    </>
  )
}
