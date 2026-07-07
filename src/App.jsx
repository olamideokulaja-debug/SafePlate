/*
  SafePlate - Lagos State Unified Food Handler Safety and Compliance Platform
  Single-file application (src/App.jsx). Stages 1 to 3 plus public certificate verification.

  Stage 1: Landing, brand and public verification teaser
  Stage 2: Deployable stack and role entry flow (Supabase auth, role-aware)
  Stage 3: Food Handler module - registration to payment into escrow (Paystack)

  Later stages (laboratory pipeline, regulator portals, escrow ledger, certificate
  issuance, water module) are scaffolded as role-aware placeholders and built next.
*/

import React, { useEffect, useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { createClient } from '@supabase/supabase-js'

/* ------------------------------------------------------------------ */
/*  Configuration and backend abstraction                              */
/* ------------------------------------------------------------------ */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const SUPABASE_READY = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
const supabase = SUPABASE_READY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null

// Demo store used when Supabase env vars are not set, so the app runs and can be
// reviewed before the backend is wired. Persists to localStorage.
const DEMO = {
  key: 'safeplate:v3',
  read() {
    try { return JSON.parse(localStorage.getItem(this.key)) || {} } catch { return {} }
  },
  write(data) {
    try { localStorage.setItem(this.key, JSON.stringify(data)) } catch { /* ignore */ }
  }
}

function seedDemo() {
  const data = DEMO.read()
  if (data.seeded) return
  const now = Date.now()
  const day = 86400000
  data.users = data.users || {}
  data.handlers = data.handlers || {}
  data.certificates = {
    'SP-LG-2026004821': {
      safeplateId: 'SP-LG-2026004821', name: 'Adewale Babatunde Okonkwo',
      panel: 'Hepatitis A, Hepatitis E, Stool MC', lab: 'Lancet Ikeja',
      issued: new Date(now - 40 * day).toISOString(), expiry: new Date(now + 140 * day).toISOString(),
      status: 'VALID'
    },
    'SP-LG-2025008114': {
      safeplateId: 'SP-LG-2025008114', name: 'Chidinma Eze',
      panel: 'Hepatitis A, Hepatitis E, Stool MC', lab: 'Synlab Victoria Island',
      issued: new Date(now - 220 * day).toISOString(), expiry: new Date(now - 40 * day).toISOString(),
      status: 'EXPIRED'
    },
    'SP-LG-2026001990': {
      safeplateId: 'SP-LG-2026001990', name: 'Bola Adeyemi',
      panel: 'Hepatitis A, Hepatitis E, Stool MC', lab: 'Clinix Surulere',
      issued: new Date(now - 10 * day).toISOString(), expiry: new Date(now + 170 * day).toISOString(),
      status: 'REVOKED'
    }
  }
  data.seeded = true
  DEMO.write(data)
}

const store = {
  async signUp(email, password, meta) {
    if (SUPABASE_READY) {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: meta } })
      if (error) throw new Error(error.message)
      return { id: data.user?.id, email, ...meta }
    }
    const db = DEMO.read()
    db.users = db.users || {}
    if (db.users[email]) throw new Error('An account with this email already exists. Sign in instead.')
    db.users[email] = { email, password, ...meta }
    DEMO.write(db)
    return { email, ...meta }
  },
  async signIn(email, password) {
    if (SUPABASE_READY) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message)
      const meta = data.user?.user_metadata || {}
      return { id: data.user?.id, email, ...meta }
    }
    const db = DEMO.read()
    const u = db.users?.[email]
    if (!u || u.password !== password) throw new Error('Email or password is incorrect.')
    return { email, role: u.role, name: u.name, title: u.title }
  },
  async signOut() {
    if (SUPABASE_READY) await supabase.auth.signOut()
  },
  async saveHandler(record) {
    if (SUPABASE_READY) {
      const { error } = await supabase.from('food_handlers').upsert(record, { onConflict: 'safeplate_id' })
      if (error) throw new Error(error.message)
      return record
    }
    const db = DEMO.read()
    db.handlers = db.handlers || {}
    db.handlers[record.safeplateId] = record
    DEMO.write(db)
    return record
  },
  async phoneExists(phone) {
    if (SUPABASE_READY) {
      const { data } = await supabase.from('food_handlers').select('phone').eq('phone', phone).limit(1)
      return Boolean(data && data.length)
    }
    const db = DEMO.read()
    return Object.values(db.handlers || {}).some(h => h.phone === phone)
  },
  async verifyCertificate(id) {
    const clean = (id || '').trim().toUpperCase()
    if (SUPABASE_READY) {
      const { data } = await supabase.from('certificates').select('*').eq('safeplate_id', clean).limit(1)
      const cert = data && data[0]
      if (!cert) return null
      return normaliseCert(cert)
    }
    const db = DEMO.read()
    // check seeded certificates and any issued handler
    const cert = db.certificates?.[clean]
    if (cert) return normaliseCert(cert)
    const handler = db.handlers?.[clean]
    if (handler && handler.certificate) return normaliseCert(handler.certificate)
    return null
  }
}

function normaliseCert(cert) {
  const expiry = new Date(cert.expiry || cert.expiry_date)
  let status = cert.status
  if (status === 'REVOKED') return { ...cert, status: 'REVOKED' }
  status = expiry.getTime() < Date.now() ? 'EXPIRED' : 'VALID'
  return { ...cert, status }
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

const LABS = [
  { id: 'lancet-ikeja', name: 'Lancet Ikeja', area: 'Ikeja', turnaround: '48 hours', accredited: true, mobile: true },
  { id: 'synlab-vi', name: 'Synlab Victoria Island', area: 'Victoria Island', turnaround: '24 hours', accredited: true, mobile: true },
  { id: 'clinix-surulere', name: 'Clinix Surulere', area: 'Surulere', turnaround: '72 hours', accredited: true, mobile: false },
  { id: 'medbury-yaba', name: 'Medbury Yaba', area: 'Yaba', turnaround: '48 hours', accredited: true, mobile: true },
  { id: 'zaine-lekki', name: 'Zaine Diagnostics Lekki', area: 'Lekki', turnaround: '36 hours', accredited: false, mobile: false }
]

const FEE = 15000
const WATERFALL = [
  { who: 'Private Lab, execution', pct: 76.5, amount: 11475 },
  { who: 'LSMoH, oversight & regulation', pct: 10, amount: 1500 },
  { who: 'Technology partner', pct: 5, amount: 750 },
  { who: 'Financial Partner (Sterling Bank)', pct: 5, amount: 750 },
  { who: 'LASEPA, enforcement', pct: 3.5, amount: 525 }
]

const ROLES = [
  { id: 'food_handler', code: 'FH', label: 'Food Handler', tag: 'Register, pay, get certified' },
  { id: 'employer', code: 'EM', label: 'Employer / Establishment', tag: "Manage your team's compliance" },
  { id: 'laboratory', code: 'LB', label: 'Approved Laboratory', tag: 'View orders and upload results' },
  { id: 'regulator', code: 'MH', label: 'Regulator', tag: 'LSMoH, LASEPA or HEFAMAA oversight' },
  { id: 'sterling', code: 'SB', label: 'Sterling Bank', tag: 'Escrow management' }
]

const AGENCIES = ['LSMoH', 'LASEPA', 'HEFAMAA']

const naira = n => '\u20A6' + Number(n).toLocaleString('en-NG')

function makeSafeplateId() {
  const year = new Date().getFullYear()
  const seq = String(Math.floor(1000 + Math.random() * 8999)) + String(Math.floor(10 + Math.random() * 89))
  return `SP-LG-${year}${seq}`.slice(0, 16)
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

function Styles() {
  return (
    <style>{`
      :root{
        --green:${PALETTE.green}; --gold:${PALETTE.gold}; --navy:${PALETTE.navy};
        --ink:#12241f; --muted:#5b6b64; --line:#e3e7e4; --paper:#fbfcfb;
        --green-pale:#eef4ee; --gold-pale:#fdf3e0; --navy-pale:#eaf0f6;
      }
      *{box-sizing:border-box}
      html,body,#root{margin:0;padding:0}
      body{background:var(--paper);color:var(--ink);font-family:'Inter',system-ui,-apple-system,sans-serif;line-height:1.55;-webkit-font-smoothing:antialiased}
      h1,h2,h3,h4,.serif{font-family:'Lora',Georgia,serif}
      a{color:inherit}
      button{font-family:inherit;cursor:pointer}
      .wrap{max-width:1100px;margin:0 auto;padding:0 22px}
      .govbar{background:var(--green);color:#fff;font-size:12.5px;letter-spacing:.02em}
      .govbar .wrap{display:flex;align-items:center;justify-content:space-between;min-height:38px;gap:12px;flex-wrap:wrap}
      .govbar .dot{width:7px;height:7px;border-radius:50%;background:var(--gold);display:inline-block;margin-right:7px}
      .seal{width:30px;height:30px;border-radius:50%;background:var(--gold);color:var(--navy);display:grid;place-items:center;font-family:'Lora',serif;font-weight:700;font-size:16px;flex:0 0 auto}
      header.top{background:#fff;border-bottom:1px solid var(--line);position:sticky;top:0;z-index:40}
      header.top .wrap{display:flex;align-items:center;justify-content:space-between;min-height:66px;gap:14px}
      .brand{display:flex;align-items:center;gap:12px}
      .brand b{font-family:'Lora',serif;font-size:20px;letter-spacing:.01em}
      .brand b span{color:var(--green)}
      .brand small{display:block;color:var(--muted);font-size:11px;letter-spacing:.03em;text-transform:uppercase}
      nav.top-nav{display:flex;align-items:center;gap:8px}
      .btn{border:1px solid var(--line);background:#fff;color:var(--ink);padding:10px 16px;border-radius:9px;font-weight:600;font-size:14px;transition:.15s}
      .btn:hover{border-color:var(--green)}
      .btn.p{background:var(--green);border-color:var(--green);color:#fff}
      .btn.p:hover{background:#00560a}
      .btn.g{background:var(--gold);border-color:var(--gold);color:#3a2600}
      .btn.g:hover{filter:brightness(1.03)}
      .btn.ghost{background:transparent;border-color:transparent}
      .btn:disabled{opacity:.5;cursor:not-allowed}
      .btn.block{width:100%;justify-content:center;display:flex}

      .hero{background:linear-gradient(180deg,var(--green-pale),#fff);border-bottom:1px solid var(--line)}
      .hero .wrap{padding:66px 22px 54px}
      .eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--green);background:#fff;border:1px solid #cfe0cf;padding:6px 12px;border-radius:100px}
      .hero h1{font-size:clamp(30px,5vw,50px);line-height:1.08;margin:20px 0 14px;max-width:16ch}
      .hero p.lede{font-size:18px;color:var(--muted);max-width:56ch;margin:0 0 26px}
      .hero-cta{display:flex;gap:12px;flex-wrap:wrap}
      .ticker{margin-top:34px;display:flex;gap:10px;flex-wrap:wrap}
      .chip{background:#fff;border:1px solid var(--line);border-radius:100px;padding:8px 14px;font-size:13px;color:var(--muted);display:flex;align-items:center;gap:8px}
      .chip b{color:var(--ink);font-family:'Lora',serif}
      .pulse{width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 0 0 rgba(0,102,0,.5);animation:pulse 2s infinite}
      @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(0,102,0,.45)}70%{box-shadow:0 0 0 9px rgba(0,102,0,0)}100%{box-shadow:0 0 0 0 rgba(0,102,0,0)}}

      section.band{padding:56px 0;border-bottom:1px solid var(--line)}
      section.band.alt{background:var(--paper)}
      .kicker{font-size:12px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--gold);filter:brightness(.85)}
      h2.sec{font-size:clamp(23px,3.4vw,32px);margin:8px 0 6px}
      .sub{color:var(--muted);max-width:60ch;margin:0 0 26px}
      .pillars{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
      .pillar{background:#fff;border:1px solid var(--line);border-radius:14px;padding:22px;position:relative;overflow:hidden}
      .pillar .num{font-family:'Lora',serif;font-size:13px;font-weight:700;color:#fff;background:var(--green);width:30px;height:30px;border-radius:8px;display:grid;place-items:center;margin-bottom:14px}
      .pillar h3{font-size:18px;margin:0 0 8px}
      .pillar p{margin:0;color:var(--muted);font-size:14px}
      .burden{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
      .burden .cell{background:var(--navy);color:#fff;border-radius:14px;padding:26px}
      .burden .cell .big{font-family:'Lora',serif;font-size:40px;line-height:1;color:var(--gold)}
      .burden .cell .lbl{margin-top:10px;font-size:14px;color:#d7e0ea}
      .burden .cell .src{margin-top:10px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#9fb2c7}

      .verify-panel{background:#fff;border:1px solid var(--line);border-radius:16px;padding:26px;max-width:560px}
      .field{display:block;margin-bottom:14px}
      .field label{display:block;font-size:13px;font-weight:600;margin-bottom:6px;color:var(--ink)}
      .field input,.field select{width:100%;padding:12px 13px;border:1px solid var(--line);border-radius:10px;font-size:15px;font-family:inherit;background:#fff}
      .field input:focus,.field select:focus{outline:2px solid var(--green);border-color:var(--green)}
      .result{margin-top:18px;border-radius:12px;padding:18px;border:1px solid var(--line)}
      .result.VALID{background:var(--green-pale);border-color:#bcdcbc}
      .result.EXPIRED{background:#fdeeee;border-color:#f0c9c9}
      .result.REVOKED{background:#fdeeee;border-color:#f0c9c9}
      .badge{display:inline-block;font-weight:700;font-size:12px;letter-spacing:.06em;padding:4px 10px;border-radius:6px}
      .badge.VALID{background:var(--green);color:#fff}
      .badge.EXPIRED,.badge.REVOKED{background:#b3261e;color:#fff}

      .footer{background:var(--navy);color:#cdd8e4;padding:40px 0;font-size:13px}
      .footer .wrap{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap}
      .footer b{color:#fff;font-family:'Lora',serif}

      /* auth + app shell */
      .shell{min-height:70vh;padding:40px 0}
      .card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:28px}
      .center-narrow{max-width:520px;margin:0 auto}
      .role-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin:22px 0}
      .role-card{text-align:left;background:#fff;border:1.5px solid var(--line);border-radius:14px;padding:18px;transition:.15s}
      .role-card:hover{border-color:var(--green);transform:translateY(-2px)}
      .role-card.on{border-color:var(--green);box-shadow:0 0 0 3px var(--green-pale)}
      .role-card .code{width:38px;height:38px;border-radius:9px;background:var(--green-pale);color:var(--green);font-family:'Lora',serif;font-weight:700;display:grid;place-items:center;margin-bottom:12px}
      .role-card h4{margin:0 0 4px;font-size:16px}
      .role-card p{margin:0;font-size:13px;color:var(--muted)}

      .steps{display:flex;gap:6px;margin-bottom:24px;flex-wrap:wrap}
      .steps .s{flex:1;min-width:90px;height:5px;border-radius:100px;background:var(--line)}
      .steps .s.on{background:var(--green)}
      .steps .s.done{background:var(--gold)}
      .wizard-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:4px}
      .wizard-head .st{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}

      .lab-row{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1.5px solid var(--line);border-radius:12px;padding:14px 16px;margin-bottom:10px;transition:.15s;background:#fff;width:100%;text-align:left}
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
      .stack-gap>*+*{margin-top:12px}
      .dash-hd{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:20px}
      .placeholder{border:1.5px dashed var(--line);border-radius:14px;padding:34px;text-align:center;color:var(--muted)}
      @media(max-width:820px){.pillars{grid-template-columns:repeat(2,1fr)}.burden{grid-template-columns:1fr}}
      @media(prefers-reduced-motion:reduce){.pulse{animation:none}.role-card:hover{transform:none}}
    `}</style>
  )
}

/* ------------------------------------------------------------------ */
/*  Shared chrome                                                      */
/* ------------------------------------------------------------------ */

function GovBar() {
  return (
    <div className="govbar">
      <div className="wrap">
        <span><span className="dot" />Lagos State Government, Ministry of Health</span>
        <span>Official platform, secured</span>
      </div>
    </div>
  )
}

function TopNav({ onHome, onVerify, session, onSignIn, onSignOut }) {
  return (
    <header className="top">
      <div className="wrap">
        <button className="brand" onClick={onHome} style={{ border: 0, background: 'none', padding: 0 }}>
          <span className="seal">S</span>
          <span style={{ textAlign: 'left' }}>
            <b>Safe<span>Plate</span></b>
            <small>Food handler safety and compliance</small>
          </span>
        </button>
        <nav className="top-nav">
          <button className="btn ghost" onClick={onVerify}>Verify a certificate</button>
          {session
            ? <button className="btn" onClick={onSignOut}>Sign out</button>
            : <button className="btn p" onClick={onSignIn}>Sign in</button>}
        </nav>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div>
          <b>SafePlate</b><br />
          Operated by the Lagos State Ministry of Health.<br />
          Oversight: LSMoH, LASEPA, HEFAMAA. Escrow: Sterling Bank.
        </div>
        <div style={{ textAlign: 'right' }}>
          One Health strategy for food and water safety.<br />
          Aligned with NAFDAC Food Hygiene Regulation 2019 and NDPA 2023.<br />
          {SUPABASE_READY ? 'Connected backend' : 'Preview mode, backend not yet connected'}
        </div>
      </div>
    </footer>
  )
}

/* ------------------------------------------------------------------ */
/*  Stage 1: Landing                                                   */
/* ------------------------------------------------------------------ */

function Landing({ onStart, onVerify }) {
  return (
    <>
      <div className="hero">
        <div className="wrap">
          <span className="eyebrow"><span className="pulse" />Statewide, live compliance</span>
          <h1 className="serif">Every plate in Lagos, backed by a verified food handler.</h1>
          <p className="lede">
            SafePlate registers, tests, certifies and monitors every food handler in Lagos State,
            through accredited laboratories, with payments held in escrow and released only on
            approved results. Certificates are verifiable by anyone, in seconds.
          </p>
          <div className="hero-cta">
            <button className="btn p" onClick={onStart}>Register as a food handler</button>
            <button className="btn g" onClick={onVerify}>Verify a certificate</button>
          </div>
          <div className="ticker">
            <span className="chip"><span className="pulse" /><b>14,892</b> active certificates</span>
            <span className="chip"><b>89.4%</b> statewide compliance</span>
            <span className="chip"><b>{naira(FEE)}</b> per handler, every 6 months</span>
          </div>
        </div>
      </div>

      <section className="band">
        <div className="wrap">
          <div className="kicker">The system</div>
          <h2 className="sec serif">Four pillars, one accountable platform</h2>
          <p className="sub">SafePlate moves Lagos from fragmented, reactive checks to a preventive, data-driven model that pays for itself.</p>
          <div className="pillars">
            {PILLARS.map(p => (
              <div className="pillar" key={p.n}>
                <div className="num">{p.n}</div>
                <h3 className="serif">{p.title}</h3>
                <p>{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="band alt">
        <div className="wrap">
          <div className="kicker">Why it matters</div>
          <h2 className="sec serif">The cost of unsafe food is measured in lives</h2>
          <p className="sub">Health, economy and governance all point the same way: prevention beats episodic crackdowns.</p>
          <div className="burden">
            {BURDEN.map(b => (
              <div className="cell" key={b.label}>
                <div className="big">{b.stat}</div>
                <div className="lbl">{b.label}</div>
                <div className="src">Source: {b.src}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <div className="kicker">Public trust</div>
          <h2 className="sec serif">Scan, or type an ID, to check any certificate</h2>
          <p className="sub">Consumers and inspectors can confirm a food handler is certified and in date, with no login.</p>
          <VerifyWidget compact onOpen={onVerify} />
        </div>
      </section>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Public certificate verification (Stage 1 teaser / Stage 7)         */
/* ------------------------------------------------------------------ */

function VerifyWidget({ compact, onOpen, initialId }) {
  const [id, setId] = useState(initialId || '')
  const [result, setResult] = useState(undefined) // undefined = not searched
  const [loading, setLoading] = useState(false)

  useEffect(() => { if (initialId) run(initialId) /* eslint-disable-next-line */ }, [initialId])

  async function run(value) {
    const q = (value ?? id).trim()
    if (!q) return
    setLoading(true)
    const cert = await store.verifyCertificate(q)
    setResult(cert || null)
    setLoading(false)
  }

  if (compact && onOpen) {
    return (
      <div className="verify-panel">
        <div className="field">
          <label htmlFor="q">Certificate ID, for example SP-LG-2026004821</label>
          <input id="q" value={id} onChange={e => setId(e.target.value)} placeholder="SP-LG-YYYYNNNNN" />
        </div>
        <button className="btn p block" onClick={() => onOpen(id)}>Verify certificate</button>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 12, marginBottom: 0 }}>
          Try the seeded IDs: SP-LG-2026004821 (valid), SP-LG-2025008114 (expired), SP-LG-2026001990 (revoked).
        </p>
      </div>
    )
  }

  return (
    <div className="verify-panel">
      <div className="field">
        <label htmlFor="q2">Certificate ID</label>
        <input id="q2" value={id} onChange={e => setId(e.target.value)} placeholder="SP-LG-YYYYNNNNN"
          onKeyDown={e => e.key === 'Enter' && run()} />
      </div>
      <button className="btn p block" onClick={() => run()} disabled={loading}>
        {loading ? 'Checking...' : 'Verify certificate'}
      </button>

      {result === null && (
        <div className="result EXPIRED" style={{ marginTop: 18 }}>
          <span className="badge EXPIRED">NOT FOUND</span>
          <p style={{ margin: '10px 0 0' }}>No certificate matches that ID. Check the ID and try again.</p>
        </div>
      )}
      {result && (
        <div className={`result ${result.status}`}>
          <span className={`badge ${result.status}`}>{result.status}</span>
          <p style={{ margin: '12px 0 4px', fontFamily: 'Lora, serif', fontSize: 18 }}>{result.name}</p>
          <div className="muted" style={{ fontSize: 13.5 }}>
            <div>{result.safeplateId || result.safeplate_id}</div>
            <div>Panel: {result.panel}</div>
            <div>Laboratory: {result.lab}</div>
            <div>Expires: {new Date(result.expiry || result.expiry_date).toLocaleDateString('en-GB')}</div>
          </div>
        </div>
      )}
    </div>
  )
}

function VerifyPage({ initialId, onHome }) {
  return (
    <div className="shell">
      <div className="wrap">
        <button className="btn ghost" onClick={onHome} style={{ marginBottom: 16, paddingLeft: 0 }}>&larr; Back</button>
        <div className="kicker">Public verification</div>
        <h2 className="sec serif">Verify a food handler certificate</h2>
        <p className="sub">Enter a SAFEPLATE ID to confirm status, panel and expiry. No account needed.</p>
        <VerifyWidget initialId={initialId} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Stage 2: Role entry + auth                                         */
/* ------------------------------------------------------------------ */

function AuthFlow({ onDone, onHome }) {
  const [role, setRole] = useState(null)
  const [agency, setAgency] = useState('LSMoH')
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const needs2fa = role && ['regulator', 'sterling'].includes(role.id)

  async function submit() {
    setErr(''); setBusy(true)
    try {
      const meta = { role: role.id, agency: role.id === 'regulator' ? agency : null, name: name || email.split('@')[0], title: roleTitle(role.id, agency) }
      const user = mode === 'signup'
        ? await store.signUp(email, password, meta)
        : await store.signIn(email, password)
      onDone({ ...user, role: user.role || role.id, agency: user.agency || meta.agency, title: user.title || meta.title, name: user.name || meta.name })
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (!role) {
    return (
      <div className="shell">
        <div className="wrap center-narrow">
          <button className="btn ghost" onClick={onHome} style={{ paddingLeft: 0, marginBottom: 12 }}>&larr; Back</button>
          <div className="kicker">Sign in</div>
          <h2 className="sec serif">Which best describes you?</h2>
          <p className="sub">Each role has its own portal and sees only its own data.</p>
          <div className="role-grid">
            {ROLES.map(r => (
              <button key={r.id} className="role-card" onClick={() => setRole(r)}>
                <div className="code">{r.code}</div>
                <h4 className="serif">{r.label}</h4>
                <p>{r.tag}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="shell">
      <div className="wrap center-narrow">
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
            <div className="field">
              <label>Agency</label>
              <select value={agency} onChange={e => setAgency(e.target.value)}>
                {AGENCIES.map(a => <option key={a}>{a}</option>)}
              </select>
            </div>
          )}
          {mode === 'signup' && (
            <div className="field">
              <label>Full name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
            </div>
          )}
          <div className="field">
            <label>Email or phone</label>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" />
          </div>

          {needs2fa && <div className="note" style={{ marginBottom: 14 }}>This portal requires 2FA. In the connected build, an OTP is sent to your registered phone on every sign-in and approval.</div>}

          <button className="btn p block" onClick={submit} disabled={busy || !email || !password}>
            {busy ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Continue to dashboard'}
          </button>
          <p className="muted" style={{ textAlign: 'center', fontSize: 13, marginTop: 14, marginBottom: 0 }}>
            {mode === 'signup' ? 'Already registered? ' : 'New here? '}
            <button className="btn ghost" style={{ padding: 0, color: 'var(--green)', fontWeight: 600 }}
              onClick={() => { setErr(''); setMode(mode === 'signup' ? 'signin' : 'signup') }}>
              {mode === 'signup' ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

function roleTitle(roleId, agency) {
  switch (roleId) {
    case 'food_handler': return 'Food Handler'
    case 'employer': return 'Establishment Manager'
    case 'laboratory': return 'Laboratory Officer'
    case 'regulator': return `${agency} Officer`
    case 'sterling': return 'Sterling Bank Officer'
    default: return 'User'
  }
}

/* ------------------------------------------------------------------ */
/*  Dashboards                                                         */
/* ------------------------------------------------------------------ */

function Dashboard({ session, onSignOut }) {
  return (
    <div className="shell">
      <div className="wrap">
        <div className="dash-hd">
          <div>
            <div className="kicker">{session.title}</div>
            <h2 className="sec serif" style={{ margin: '4px 0 0' }}>Welcome, {session.name}</h2>
          </div>
          <button className="btn" onClick={onSignOut}>Sign out</button>
        </div>
        {session.role === 'food_handler'
          ? <FoodHandlerModule session={session} />
          : <StagePlaceholder role={session.role} agency={session.agency} />}
      </div>
    </div>
  )
}

function StagePlaceholder({ role, agency }) {
  const map = {
    employer: { title: 'Employer portal', stage: 'Stage 8', body: 'Register your business, add staff, bulk-pay and track team compliance without medical detail.' },
    laboratory: { title: 'Laboratory portal', stage: 'Stage 4', body: 'Receive orders, schedule collection and upload encrypted results, with payment released only after Ministry approval.' },
    regulator: { title: `${agency || 'Regulator'} portal`, stage: 'Stage 5', body: 'Review and approve results, run the escalating sanctions ladder and see live statewide compliance with a full audit trail.' },
    sterling: { title: 'Sterling Bank escrow portal', stage: 'Stage 6', body: 'Hold payments in escrow and disburse the full waterfall atomically on approval, reconciled by SAFEPLATE ID.' }
  }
  const m = map[role] || { title: 'Portal', stage: 'Next', body: '' }
  return (
    <div className="placeholder">
      <div className="kicker" style={{ color: 'var(--green)' }}>{m.stage}</div>
      <h3 className="serif" style={{ fontSize: 22, margin: '8px 0' }}>{m.title}</h3>
      <p style={{ maxWidth: '52ch', margin: '0 auto' }}>{m.body}</p>
      <p className="muted" style={{ marginTop: 14, fontSize: 13 }}>Your role-aware sign-in works now. This portal is built in the next stage of the plan.</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Stage 3: Food Handler onboarding to payment                        */
/* ------------------------------------------------------------------ */

const STEP_LABELS = ['Register', 'Tests', 'Laboratory', 'Payment', 'Done']

function FoodHandlerModule({ session }) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    name: session.name || '', phone: '', nin: '', email: session.email || '', employer: '',
    safeplateId: '', lab: null, paid: false
  })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const nextDue = useMemo(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 6)
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  }, [])

  async function register() {
    setErr('')
    if (!form.name.trim() || !form.phone.trim()) { setErr('Name and phone number are required to register.'); return }
    if (!/^0?\d{10,11}$/.test(form.phone.replace(/\s+/g, ''))) { setErr('Enter a valid Nigerian phone number.'); return }
    setBusy(true)
    try {
      if (await store.phoneExists(form.phone)) {
        setErr('An account already exists for this phone number. Recover it from the sign-in screen.')
        setBusy(false); return
      }
      const id = makeSafeplateId()
      setF('safeplateId', id)
      setStep(1)
    } finally { setBusy(false) }
  }

  function chooseLab(lab) {
    if (!lab.accredited) { setErr('That laboratory is not currently accredited. Choose an accredited laboratory.'); return }
    setErr(''); setF('lab', lab); setStep(3)
  }

  async function pay() {
    setErr(''); setBusy(true)
    try {
      // Real build: POST to /api/paystack-verify with the transaction reference,
      // then the server records the escrow entry and the waterfall split.
      // Preview build: simulate a successful escrow-funded payment.
      await new Promise(r => setTimeout(r, 700))
      const now = Date.now(); const day = 86400000
      const certificate = {
        safeplateId: form.safeplateId, name: form.name,
        panel: MANDATORY_TESTS.join(', '), lab: form.lab.name,
        issued: null, expiry: new Date(now + 182 * day).toISOString(),
        status: 'PENDING_RESULTS'
      }
      await store.saveHandler({
        safeplateId: form.safeplateId, name: form.name, phone: form.phone, nin: form.nin,
        email: form.email, employer: form.employer, lab: form.lab.name, tests: MANDATORY_TESTS,
        fee: FEE, waterfall: WATERFALL, paid: true, certificate, createdAt: new Date().toISOString()
      })
      setF('paid', true); setStep(4)
    } catch (e) { setErr('Payment could not be completed. Your test order is saved for 48 hours, try again.') }
    finally { setBusy(false) }
  }

  return (
    <div>
      <div className="steps">
        {STEP_LABELS.map((l, i) => (
          <div key={l} className={`s ${i === step ? 'on' : ''} ${i < step ? 'done' : ''}`} title={l} />
        ))}
      </div>

      {err && <div className="err">{err}</div>}

      {step === 0 && (
        <div className="card">
          <div className="wizard-head"><h3 className="serif" style={{ margin: 0, fontSize: 21 }}>Register and get your SAFEPLATE ID</h3><span className="st">Step 1 of 4</span></div>
          <p className="muted" style={{ marginTop: 4 }}>Your details are verified and you receive a unique, traceable ID.</p>
          <div style={{ marginTop: 8 }}>
            <div className="field"><label>Full name</label><input value={form.name} onChange={e => setF('name', e.target.value)} placeholder="First and last name" /></div>
            <div className="field"><label>Phone number</label><input value={form.phone} onChange={e => setF('phone', e.target.value)} placeholder="080..." /></div>
            <div className="field"><label>NIN (optional, verified when provided)</label><input value={form.nin} onChange={e => setF('nin', e.target.value)} placeholder="11-digit NIN" /></div>
            <div className="field"><label>Email (optional)</label><input value={form.email} onChange={e => setF('email', e.target.value)} placeholder="you@example.com" /></div>
            <div className="field"><label>Employer (optional)</label><input value={form.employer} onChange={e => setF('employer', e.target.value)} placeholder="Restaurant, hotel or company" /></div>
          </div>
          <button className="btn p block" onClick={register} disabled={busy}>{busy ? 'Checking...' : 'Create my SAFEPLATE ID'}</button>
        </div>
      )}

      {step === 1 && (
        <div className="card">
          <div className="wizard-head"><h3 className="serif" style={{ margin: 0, fontSize: 21 }}>Your mandatory test panel</h3><span className="st">Step 2 of 4</span></div>
          <div className="note" style={{ marginTop: 6, marginBottom: 16 }}>
            SAFEPLATE ID assigned: <b>{form.safeplateId}</b>. Keep it, it identifies you across every test cycle.
          </div>
          <p className="muted" style={{ marginTop: 0 }}>Every food handler completes the same core panel, biannually.</p>
          <div className="stack-gap" style={{ marginBottom: 16 }}>
            {MANDATORY_TESTS.map(t => (
              <div key={t} className="lab-row on" style={{ cursor: 'default' }}>
                <span>{t}</span><span className="pill ok">Mandatory</span>
              </div>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 13 }}>Next testing window will be set for <b>{nextDue}</b>. Reminders go out 14 and 2 days before.</p>
          <button className="btn p block" onClick={() => setStep(2)}>Choose a laboratory</button>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <div className="wizard-head"><h3 className="serif" style={{ margin: 0, fontSize: 21 }}>Choose an accredited laboratory</h3><span className="st">Step 3 of 4</span></div>
          <p className="muted" style={{ marginTop: 4 }}>Accreditation is checked in real time. Unaccredited labs cannot take your order.</p>
          <div style={{ marginTop: 12 }}>
            {LABS.map(l => (
              <button key={l.id} className={`lab-row ${l.accredited ? '' : 'off'}`} onClick={() => chooseLab(l)}>
                <span>
                  <b style={{ fontFamily: 'Lora,serif' }}>{l.name}</b>
                  <div className="meta">{l.area} &middot; results in {l.turnaround}{l.mobile ? ' \u00b7 mobile collection' : ''}</div>
                </span>
                <span className={`pill ${l.accredited ? 'ok' : 'no'}`}>{l.accredited ? 'Accredited' : 'Not accredited'}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <div className="wizard-head"><h3 className="serif" style={{ margin: 0, fontSize: 21 }}>Pay into escrow</h3><span className="st">Step 4 of 4</span></div>
          <p className="muted" style={{ marginTop: 4 }}>
            Your {naira(FEE)} is held in Sterling Bank escrow and released only after the Ministry approves your results.
            Payment is by Paystack: card, bank transfer, USSD or mobile money.
          </p>
          <table className="split-tbl">
            <tbody>
              <tr><td colSpan={2} style={{ fontWeight: 700 }}>Laboratory: {form.lab?.name}</td></tr>
              {WATERFALL.map(w => (
                <tr key={w.who}><td>{w.who} <span className="muted">({w.pct}%)</span></td><td>{naira(w.amount)}</td></tr>
              ))}
              <tr className="tot"><td>Total fee</td><td>{naira(FEE)}</td></tr>
            </tbody>
          </table>
          <button className="btn p block" style={{ marginTop: 18 }} onClick={pay} disabled={busy}>
            {busy ? 'Processing with Paystack...' : `Pay ${naira(FEE)} into escrow`}
          </button>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 10, marginBottom: 0 }}>
            {SUPABASE_READY ? 'Live Paystack checkout opens on the connected build.' : 'Preview mode simulates a funded escrow payment so you can review the full flow.'}
          </p>
        </div>
      )}

      {step === 4 && (
        <div className="ok-banner">
          <div className="kicker" style={{ color: 'var(--green)' }}>Escrow funded</div>
          <h3 className="serif" style={{ fontSize: 22, margin: '8px 0' }}>You are registered and paid. Your test is scheduled.</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            The laboratory has been notified. After your sample is tested and the Ministry approves the result,
            your Certificate of Fitness is issued and becomes publicly verifiable by the QR below.
          </p>
          <div className="cert">
            <div className="kicker" style={{ color: 'var(--green)' }}>SafePlate certificate</div>
            <h4 className="serif" style={{ fontSize: 20, margin: '6px 0 2px' }}>{form.name}</h4>
            <div className="muted" style={{ fontSize: 13.5 }}>{form.safeplateId}</div>
            <div className="qwrap">
              <QRCodeSVG value={`${window.location.origin}/#/verify/${form.safeplateId}`} size={128} fgColor={PALETTE.navy} level="M" />
            </div>
            <div className="muted" style={{ fontSize: 12.5 }}>Status once approved: valid for 6 months</div>
          </div>
          <p className="muted" style={{ fontSize: 13, marginTop: 16 }}>
            Panel: {MANDATORY_TESTS.join(', ')} &middot; Laboratory: {form.lab?.name}
          </p>
        </div>
      )}
    </div>
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
  const [view, setView] = useState('home') // home | verify | auth | dash
  const [verifyId, setVerifyId] = useState('')
  const [session, setSession] = useState(null)

  useEffect(() => { seedDemo() }, [])

  // Support public verify deep links: #/verify/SP-LG-...
  useEffect(() => {
    function onHash() {
      const { route, param } = parseHash()
      if (route === 'verify') { setVerifyId(param || ''); setView('verify') }
    }
    onHash()
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const goHome = () => { window.location.hash = ''; setView(session ? 'dash' : 'home') }
  const goVerify = (id) => { setVerifyId(typeof id === 'string' ? id : ''); setView('verify') }
  const goAuth = () => setView('auth')

  async function signOut() { await store.signOut(); setSession(null); setView('home') }
  function onAuthed(user) { setSession(user); setView('dash') }

  return (
    <>
      <Styles />
      <GovBar />
      <TopNav
        onHome={goHome}
        onVerify={() => goVerify('')}
        session={session}
        onSignIn={goAuth}
        onSignOut={signOut}
      />

      {view === 'home' && !session && <Landing onStart={goAuth} onVerify={goVerify} />}
      {view === 'verify' && <VerifyPage initialId={verifyId} onHome={goHome} />}
      {view === 'auth' && <AuthFlow onDone={onAuthed} onHome={goHome} />}
      {(view === 'dash' && session) && <Dashboard session={session} onSignOut={signOut} />}
      {view === 'home' && session && <Dashboard session={session} onSignOut={signOut} />}

      <Footer />
    </>
  )
}
