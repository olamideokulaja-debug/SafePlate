// supabase/functions/safeplate/index.ts
//
// ONE function that handles every privileged SafePlate action. Deploy this single
// function (named "safeplate") from the Supabase Dashboard: Edge Functions >
// Deploy a new function > Via Editor > paste this whole file > Deploy.
//
// Secrets to set in the Dashboard (Edge Functions > Secrets):
//   RESULT_ENC_KEY    base64 32-byte key (from keygen.html) for result encryption
//   TERMII_API_KEY    your Termii key (for 2FA SMS)
//   TERMII_SENDER_ID  SafePlate
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided
// automatically by Supabase, no need to add them.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'content-type': 'application/json' } })

const URL = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const svc = () => createClient(URL, SERVICE, { auth: { persistSession: false } })

async function caller(req: Request) {
  const authHeader = req.headers.get('Authorization') || ''
  const jwt = authHeader.replace('Bearer ', '').trim()
  if (!jwt) return null
  const sb = createClient(URL, ANON, { global: { headers: { Authorization: authHeader } } })
  const { data, error } = await sb.auth.getUser(jwt)
  if (error || !data.user) return null
  const m = (data.user.user_metadata || {}) as Record<string, string>
  return { id: data.user.id, email: data.user.email ?? null, role: m.role || '', agency: m.agency || null, lab: m.lab || null, phone: m.phone || null }
}

// AES-256-GCM using the Vault key.
const b64enc = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)))
const b64dec = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0))
async function encKey() { return crypto.subtle.importKey('raw', b64dec(Deno.env.get('RESULT_ENC_KEY')!), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']) }
async function encrypt(t: string) { const iv = crypto.getRandomValues(new Uint8Array(12)); const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encKey(), new TextEncoder().encode(t)); return b64enc(iv.buffer) + ':' + b64enc(ct) }
async function decrypt(p: string) { const [i, c] = p.split(':'); const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64dec(i) }, await encKey(), b64dec(c)); return new TextDecoder().decode(pt) }
async function sha256(s: string) { const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('') }

const FEE = 15000

// Send a status update to a food handler. Built ready: it becomes live the
// moment TERMII_API_KEY is set. Until then the notification is still logged.
async function tellHandler(db: any, safeplateId: string, message: string) {
  try {
    const { data: fh } = await db.from('food_handlers').select('phone, name').eq('safeplate_id', safeplateId).maybeSingle()
    await db.from('notifications').insert({ audience: 'all', title: 'Status update', body: safeplateId + ': ' + message })
    const key = Deno.env.get('TERMII_API_KEY')
    if (fh && fh.phone && key) {
      await fetch('https://api.ng.termii.com/api/sms/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ to: fh.phone, from: Deno.env.get('TERMII_SENDER_ID') || 'SafePlate', sms: 'SafePlate: ' + message + ' (' + safeplateId + ')', type: 'plain', channel: 'generic', api_key: key }) })
    }
  } catch (e) { /* status updates must never block the workflow */ }
}
// TEMPORARY: while Termii SMS is being fixed, skip the login OTP so staff can sign in.
// Set this back to false to restore real 2FA once SMS works.
const OTP_BYPASS = true

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const body = await req.json().catch(() => ({}))
  const action = body.action
  const db = svc()

  // ---- Public actions (no sign-in required) ----------------------------------
  // Deliberately limited: they never reveal test results or personal records
  // beyond what the requester already proves they know.
  try {
    // Recover a forgotten SAFEPLATE ID. Requires BOTH phone and NIN so that
    // knowing a phone number alone is not enough to identify someone.
    if (action === 'recover-id') {
      const phone = String(body.phone || '').replace(/\s+/g, '')
      const nin = String(body.nin || '').replace(/\s+/g, '')
      if (!/^0\d{10}$/.test(phone) || !/^\d{11}$/.test(nin)) return json({ error: 'Enter your 11-digit phone number and 11-digit NIN.' }, 400)
      const { data: fh } = await db.from('food_handlers').select('safeplate_id, name').eq('phone', phone).eq('nin', nin).maybeSingle()
      if (!fh) return json({ error: 'No record matches that phone number and NIN.' }, 404)
      await db.from('audit_log').insert({ actor: 'public', role: 'public', action: 'SAFEPLATE ID recovered', subject: fh.safeplate_id })
      return json({ ok: true, safeplateId: fh.safeplate_id, name: fh.name })
    }

    // Anonymous public complaint about an establishment. Intelligence only:
    // it opens a triage case and schedules an inspection, and never applies a
    // sanction, because an anonymous report cannot be tested for truth.
    if (action === 'file-complaint') {
      const est = String(body.establishment || '').trim()
      const detail = String(body.detail || '').trim()
      const lga = String(body.lga || '').trim()
      if (est.length < 3) return json({ error: 'Enter the name of the establishment.' }, 400)
      if (detail.length < 20) return json({ error: 'Please describe what you saw, in at least 20 characters.' }, 400)
      // Light rate limit: cap complaints about one establishment per hour.
      const since = new Date(Date.now() - 3600000).toISOString()
      const { data: recent } = await db.from('complaints').select('id').eq('establishment', est).gte('created_at', since)
      if ((recent || []).length >= 5) return json({ error: 'Several reports about this establishment are already under review. Thank you.' }, 429)
      const ref = 'CMP-' + new Date().getFullYear() + '-' + String(Math.floor(100000 + Math.random() * 899999))
      const photos = Array.isArray(body.photos) ? body.photos.slice(0, 4) : []
      await db.from('complaints').insert({ id: ref, establishment: est, lga, detail, photos, status: 'Open', created_at: new Date().toISOString() })
      // Mark the establishment as under review (internal marker, not a sanction)
      // and schedule an inspection for an officer to pick up.
      const { data: match } = await db.from('establishments').select('id').ilike('name', est).maybeSingle()
      if (match) {
        await db.from('establishments').update({ under_review: true }).eq('id', match.id)
        await db.from('inspections').insert({ id: 'INS-' + Date.now(), agency: 'LASEPA', kind: 'Complaint follow-up', subject: est, note: 'Scheduled from public complaint ' + ref, status: 'Scheduled', target_id: match.id })
      }
      await db.from('audit_log').insert({ actor: 'anonymous', role: 'public', action: 'Public complaint filed, inspection scheduled', subject: ref })
      await db.from('notifications').insert([{ audience: 'LASEPA', title: 'New public complaint', body: est + ' (' + ref + ')' }, { audience: 'LSMoH', title: 'New public complaint', body: est + ' (' + ref + ')' }])
      return json({ ok: true, reference: ref })
    }
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500)
  }

  const me = await caller(req)
  if (!me) return json({ error: 'Unauthorized' }, 401)

  try {
    // ---- Laboratory submits encrypted results ----
    if (action === 'submit-result') {
      if (me.role !== 'laboratory') return json({ error: 'Forbidden' }, 403)
      const { data: order } = await db.from('test_orders').select('*').eq('id', body.orderId).single()
      if (!order) return json({ error: 'Order not found' }, 404)
      if (me.lab && order.lab !== me.lab) return json({ error: 'Not your order' }, 403)
      const { data: labRow } = await db.from('laboratories').select('acc_no').eq('name', order.lab).single()
      if (labRow && body.accreditationNumber !== labRow.acc_no) {
        await db.from('test_orders').update({ status: 'Quarantined', note: 'Accreditation mismatch, referred to LSMoH.' }).eq('id', body.orderId)
        await db.from('audit_log').insert({ actor: me.email, role: 'laboratory', action: 'Result quarantined, accreditation mismatch', subject: order.safeplate_id })
        return json({ ok: true, status: 'Quarantined' })
      }
      const referred = Object.values(body.results || {}).some((v) => v === 'refer')
      await db.from('test_orders').update({ status: 'Submitted', results_enc: await encrypt(JSON.stringify(body.results || {})), technician_id: body.technicianId, accreditation_number: body.accreditationNumber, reported_lsmoh: referred, biobank_confirm: referred, submitted_at: new Date().toISOString() }).eq('id', body.orderId)
      await db.from('audit_log').insert({ actor: me.email, role: 'laboratory', action: 'Results submitted (encrypted)', subject: order.safeplate_id })
      await db.from('notifications').insert({ audience: 'LSMoH', title: 'Results submitted', body: order.handler_name + ' pending Ministry review' })
      return json({ ok: true, status: 'Submitted' })
    }

    // ---- LSMoH approves / flags / rejects ----
    if (action === 'approve-result') {
      if (me.role !== 'regulator' || me.agency !== 'LSMoH') return json({ error: 'Forbidden' }, 403)
      const { data: order } = await db.from('test_orders').select('*').eq('id', body.orderId).single()
      if (!order) return json({ error: 'Order not found' }, 404)
      if (body.decision === 'flag') {
        await db.from('test_orders').update({ status: 'Flagged' }).eq('id', body.orderId)
        await db.from('audit_log').insert({ actor: me.email, role: 'LSMoH', action: 'Flagged for review, escrow held', subject: order.safeplate_id })
        return json({ ok: true, status: 'Flagged' })
      }
      let anyRefer = false
      try { const r = JSON.parse(await decrypt(order.results_enc || '')); anyRefer = Object.values(r).some((v) => v === 'refer') } catch { /* ignore */ }
      if (body.decision === 'reject' || anyRefer) {
        await db.from('test_orders').update({ status: 'Rejected' }).eq('id', body.orderId)
        await db.from('audit_log').insert({ actor: me.email, role: 'LSMoH', action: 'Result rejected, referral pathway, escrow held', subject: order.safeplate_id })
        await db.from('notifications').insert({ audience: 'all', title: 'Result referred', body: order.handler_name + ' must retest' })
        await tellHandler(db, order.safeplate_id, 'your result has been referred by the Ministry and a retest is required. You may lodge an appeal in the app.')
        return json({ ok: true, status: 'Rejected' })
      }
      const { data: lsh } = await db.rpc('next_lsh')
      const now = Date.now(), day = 86400000
      const { data: fhRow } = await db.from('food_handlers').select('email, photo').eq('safeplate_id', order.safeplate_id).single()
      await db.from('certificates').upsert({ safeplate_id: order.safeplate_id, name: order.handler_name, panel: (order.tests || []).join(', '), lab: order.lab, issued: new Date(now).toISOString(), expiry: new Date(now + 182 * day).toISOString(), status: 'VALID', cert_no: lsh, photo: fhRow?.photo || null }, { onConflict: 'safeplate_id' })
      await db.from('escrow_releases').insert({ safeplate_id: order.safeplate_id, name: order.handler_name, lab: order.lab, amount: FEE, status: 'Instructed', approved_by: me.email, ts: new Date().toISOString() })
      await db.from('test_orders').update({ status: 'Approved' }).eq('id', body.orderId)
      await db.from('audit_log').insert({ actor: me.email, role: 'LSMoH', action: 'Approved, certificate ' + lsh + ' issued, escrow release instructed', subject: order.safeplate_id })
      await db.from('notifications').insert([{ audience: 'sterling', title: 'Escrow release instructed', body: order.safeplate_id }, { audience: 'all', title: 'Certificate issued', body: order.handler_name + ' is now certified' }])
      await tellHandler(db, order.safeplate_id, 'your Certificate of Fitness has been approved and is ready. Certificate number ' + lsh + '.')
      // Email the certificate link to the handler (optional; needs RESEND_API_KEY).
      try {
        const resendKey = Deno.env.get('RESEND_API_KEY')
        const appUrl = Deno.env.get('APP_URL') || ''
        if (fhRow?.email && resendKey) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST', headers: { authorization: 'Bearer ' + resendKey, 'content-type': 'application/json' },
            body: JSON.stringify({ from: 'SafePlate <onboarding@resend.dev>', to: fhRow.email, subject: 'Your SafePlate Certificate of Fitness (' + lsh + ')', html: 'Your Certificate of Fitness is issued. View, download or verify it here: <a href="' + appUrl + '/#/verify/' + order.safeplate_id + '">' + appUrl + '/#/verify/' + order.safeplate_id + '</a>' })
          })
        }
      } catch (_) { /* ignore email errors */ }
      return json({ ok: true, status: 'Approved', cert_no: lsh })
    }

    // ---- LASEPA approves / flags water ----
    if (action === 'approve-water') {
      if (me.role !== 'regulator' || me.agency !== 'LASEPA') return json({ error: 'Forbidden' }, 403)
      const { data: w } = await db.from('water_tests').select('*').eq('swid', body.swid).single()
      if (!w) return json({ error: 'Water test not found' }, 404)
      if (body.decision === 'flag') {
        await db.from('water_tests').update({ status: 'Flagged, retest required' }).eq('swid', body.swid)
        await db.from('audit_log').insert({ actor: me.email, role: 'LASEPA', action: 'Water result flagged, retest required', subject: body.swid })
        return json({ ok: true, status: 'Flagged' })
      }
      const now = Date.now(), day = 86400000
      const series = 'SP-W-CERT-' + new Date().getFullYear() + '-' + String(Math.floor(100000 + Math.random() * 899999))
      await db.from('certificates').upsert({ safeplate_id: body.swid, name: w.facility, panel: 'Potable water quality', lab: w.lab, issued: new Date(now).toISOString(), expiry: new Date(now + 182 * day).toISOString(), status: 'VALID', series }, { onConflict: 'safeplate_id' })
      await db.from('escrow').update({ status: 'RELEASED', released_ts: new Date().toISOString(), released_by: me.email }).eq('safeplate_id', body.swid)
      await db.from('water_tests').update({ status: 'Certified', cert_series: series }).eq('swid', body.swid)
      await db.from('audit_log').insert({ actor: me.email, role: 'LASEPA', action: 'Water approved, certificate issued, 80/10/5/5 disbursed', subject: body.swid })
      await db.from('notifications').insert({ audience: 'all', title: 'Facility water certified', body: w.facility })
      return json({ ok: true, status: 'Certified', series })
    }

    // ---- Sterling releases escrow ----
    if (action === 'release-escrow') {
      if (me.role !== 'sterling') return json({ error: 'Forbidden' }, 403)
      const { data: rel } = await db.from('escrow_releases').select('*').eq('safeplate_id', body.safeplateId).eq('status', 'Instructed').maybeSingle()
      if (!rel) return json({ error: 'No approved release instruction for this ID' }, 409)
      const ts = new Date().toISOString()
      await db.from('escrow').update({ status: 'RELEASED', released_ts: ts, released_by: me.email }).eq('safeplate_id', body.safeplateId)
      await db.from('escrow_releases').update({ status: 'Released' }).eq('safeplate_id', body.safeplateId)
      await db.from('audit_log').insert({ actor: me.email, role: 'Sterling Bank', action: 'Escrow released, full waterfall disbursed', subject: body.safeplateId })
      await db.from('notifications').insert({ audience: 'laboratory', title: 'Payment released', body: body.safeplateId })
      return json({ ok: true, status: 'RELEASED' })
    }

    // ---- Laboratory advances a sample through the pre-result stages ----
    if (action === 'advance-order') {
      if (me.role !== 'laboratory') return json({ error: 'Forbidden' }, 403)
      const allowed = ['Sample Collected', 'Testing in Progress', 'No Show', 'Spoiled sample']
      if (!allowed.includes(body.status)) return json({ error: 'Invalid status' }, 400)
      const { data: order } = await db.from('test_orders').select('*').eq('id', body.orderId).single()
      if (!order) return json({ error: 'Order not found' }, 404)
      if (me.lab && order.lab !== me.lab) return json({ error: 'Not your order' }, 403)
      await db.from('test_orders').update({ status: body.status }).eq('id', body.orderId)
      await db.from('audit_log').insert({ actor: me.email, role: 'laboratory', action: 'Sample updated to ' + body.status, subject: order.safeplate_id })
      const msg: Record<string, string> = {
        'Sample Collected': 'your sample has been collected. Results are expected within 48 hours.',
        'Testing in Progress': 'testing of your sample has started.',
        'No Show': 'you missed your sample appointment. Please contact your laboratory to rebook.',
        'Spoiled sample': 'your sample could not be used and must be recollected. Please return to your laboratory.'
      }
      if (msg[body.status]) await tellHandler(db, order.safeplate_id, msg[body.status])
      return json({ ok: true, status: body.status })
    }

    // ---- Employer bulk-enrols staff (creates handlers, orders and held escrow) ----
    if (action === 'bulk-enroll') {
      if (me.role !== 'employer') return json({ error: 'Forbidden' }, 403)
      const staff = Array.isArray(body.staff) ? body.staff : []
      const lab = body.lab || 'Lancet Ikeja'
      const tests = ['Hepatitis A', 'Hepatitis E', 'Stool Microscopy & Culture (MC)']
      const year = new Date().getFullYear()
      const created = []
      for (let i = 0; i < staff.length; i++) {
        const st = staff[i]
        const id = 'SP-LG-' + year + String(Math.floor(100000 + Math.random() * 899999))
        const oid = 'ORD-' + year + '-' + id.slice(-6) + '-' + i
        await db.from('food_handlers').upsert({ safeplate_id: id, name: st.name, phone: st.phone, employer: body.employer || me.email, created_at: new Date().toISOString() }, { onConflict: 'safeplate_id' })
        await db.from('test_orders').insert({ id: oid, safeplate_id: id, handler_name: st.name, phone: st.phone, lab, tests, status: 'Scheduled', appointment_date: body.appointmentDate || null, appointment_slot: body.appointmentSlot || null, created_at: new Date().toISOString() })
        await db.from('escrow').insert({ safeplate_id: id, name: st.name, lab, amount: FEE, type: 'FOOD', status: 'HELD', ts: new Date().toISOString() })
        created.push({ name: st.name, phone: st.phone, safeplateId: id })
      }
      await db.from('audit_log').insert({ actor: me.email, role: 'employer', action: 'Bulk-enrolled ' + created.length + ' staff into testing', subject: body.employer || me.email })
      return json({ ok: true, created })
    }

    // ---- LSMoH revokes a certificate ----
    if (action === 'revoke-certificate') {
      if (me.role !== 'regulator' || me.agency !== 'LSMoH') return json({ error: 'Forbidden' }, 403)
      await db.from('certificates').update({ status: 'REVOKED' }).eq('safeplate_id', (body.safeplateId || '').toUpperCase())
      await db.from('audit_log').insert({ actor: me.email, role: 'LSMoH', action: 'Certificate revoked', subject: body.safeplateId })
      return json({ ok: true, status: 'REVOKED' })
    }

    // ---- Decrypt a result (Ministry or the owning food handler) ----
    if (action === 'decrypt-result') {
      const { data: order } = await db.from('test_orders').select('*').eq('id', body.orderId).single()
      if (!order) return json({ error: 'Order not found' }, 404)
      let allowed = me.role === 'regulator' && me.agency === 'LSMoH'
      if (!allowed) { const { data: fh } = await db.from('food_handlers').select('user_id').eq('safeplate_id', order.safeplate_id).single(); allowed = fh?.user_id === me.id }
      if (!allowed) return json({ error: 'Forbidden' }, 403)
      await db.from('audit_log').insert({ actor: me.email, role: me.role, action: 'Result decrypted/viewed', subject: order.safeplate_id })
      let results = {}
      try { results = JSON.parse(await decrypt(order.results_enc || '')) } catch { /* ignore */ }
      return json({ ok: true, results })
    }

    // ---- Certificate expiry reminders (built ready; trigger on a daily schedule) ----
    // Intended to run once a day via a Supabase Scheduled Function or pg_cron calling
    // this action. It texts holders whose certificate expires in 30, 14 or 7 days.
    // Requires TERMII_API_KEY to be live; until then, sends are attempted and skipped.
    if (action === 'send-reminders') {
      const { data: certs } = await db.from('certificates').select('safeplate_id, expiry, name, status').eq('status', 'VALID')
      const now = Date.now(), day = 86400000
      const key = Deno.env.get('TERMII_API_KEY')
      let sent = 0, due = 0
      for (const c of (certs || [])) {
        if (!c.expiry) continue
        const daysLeft = Math.round((new Date(c.expiry).getTime() - now) / day)
        if (![30, 14, 7].includes(daysLeft)) continue
        due++
        const { data: fh } = await db.from('food_handlers').select('phone').eq('safeplate_id', c.safeplate_id).maybeSingle()
        const phone = fh && fh.phone
        await db.from('notifications').insert({ audience: 'all', title: 'Certificate expiring', body: (c.name || c.safeplate_id) + ' expires in ' + daysLeft + ' days' })
        if (phone && key) {
          try {
            await fetch('https://api.ng.termii.com/api/sms/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ to: phone, from: Deno.env.get('TERMII_SENDER_ID') || 'SafePlate', sms: 'SafePlate: your Certificate of Fitness (' + c.safeplate_id + ') expires in ' + daysLeft + ' days. Renew to stay compliant.', type: 'plain', channel: 'generic', api_key: key }) })
            sent++
          } catch (e) { /* Termii unavailable; reminder still logged in notifications */ }
        }
      }
      await db.from('audit_log').insert({ actor: 'system', role: 'system', action: 'Expiry reminders processed: ' + due + ' due, ' + sent + ' SMS sent', subject: '' })
      return json({ ok: true, due, sent })
    }

    // ---- 48-hour laboratory SLA sweep ----
    // Run on the same daily schedule as the reminders. Notifies the Ministry,
    // raises the order on their home queue, and alerts the laboratory.
    if (action === 'check-sla') {
      const cutoff = new Date(Date.now() - 48 * 3600000).toISOString()
      const { data: late } = await db.from('test_orders')
        .select('id, safeplate_id, handler_name, lab, status, created_at, sla_breached')
        .in('status', ['Scheduled', 'Sample Collected', 'Testing in Progress'])
        .lt('created_at', cutoff)
      let flagged = 0
      for (const o of (late || [])) {
        if (o.sla_breached) continue
        await db.from('test_orders').update({ sla_breached: true, sla_breached_at: new Date().toISOString() }).eq('id', o.id)
        await db.from('notifications').insert([
          { audience: 'LSMoH', title: '48-hour SLA breached', body: (o.lab || 'A laboratory') + ' has held ' + o.safeplate_id + ' beyond 48 hours' },
          { audience: 'laboratory', title: 'Overdue sample', body: o.safeplate_id + ' has passed the 48-hour turnaround. Submit the result.' }
        ])
        await db.from('audit_log').insert({ actor: 'system', role: 'system', action: '48-hour SLA breached, escalated to LSMoH and laboratory alerted', subject: o.safeplate_id })
        await tellHandler(db, o.safeplate_id, 'your result is taking longer than the 48-hour target. The Ministry has been notified and is following it up.')
        flagged++
      }
      return json({ ok: true, checked: (late || []).length, flagged })
    }

    // ---- Send a 2FA OTP over Termii ----
    if (action === 'send-otp') {
      if (OTP_BYPASS) return json({ ok: true, sent: false, bypass: true })
      if (!me.phone) return json({ error: 'No registered phone on this account' }, 400)
      const code = String(Math.floor(100000 + Math.random() * 900000))
      await db.from('otp_codes').insert({ subject: me.id, code_hash: await sha256(code), expires_at: new Date(Date.now() + 5 * 60000).toISOString(), attempts: 0 })
      const key = Deno.env.get('TERMII_API_KEY')
      if (key) {
        const tRes = await fetch('https://api.ng.termii.com/api/sms/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ to: me.phone, from: Deno.env.get('TERMII_SENDER_ID') || 'SafePlate', sms: 'Your SafePlate verification code is ' + code, type: 'plain', channel: 'generic', api_key: key }) })
        console.log('TERMII_RESPONSE', tRes.status, await tRes.text())
      }
      return json({ ok: true, sent: Boolean(key) })
    }

    // ---- Verify a 2FA OTP ----
    if (action === 'verify-otp') {
      if (OTP_BYPASS) return json({ ok: true })
      const { data: row } = await db.from('otp_codes').select('*').eq('subject', me.id).order('ts', { ascending: false }).limit(1).maybeSingle()
      if (!row) return json({ ok: false, error: 'No code, request a new one' }, 400)
      if (new Date(row.expires_at).getTime() < Date.now()) return json({ ok: false, error: 'Code expired' }, 400)
      if ((row.attempts || 0) >= 5) return json({ ok: false, error: 'Too many attempts' }, 429)
      if ((await sha256(String(body.code))) !== row.code_hash) { await db.from('otp_codes').update({ attempts: (row.attempts || 0) + 1 }).eq('id', row.id); return json({ ok: false, error: 'Incorrect code' }, 401) }
      await db.from('otp_codes').delete().eq('id', row.id)
      return json({ ok: true })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
