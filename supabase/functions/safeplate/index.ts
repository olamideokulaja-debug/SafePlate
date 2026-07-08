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
// TEMPORARY: while Termii SMS is being fixed, skip the login OTP so staff can sign in.
// Set this back to false to restore real 2FA once SMS works.
const OTP_BYPASS = true

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const me = await caller(req)
  if (!me) return json({ error: 'Unauthorized' }, 401)
  const body = await req.json().catch(() => ({}))
  const action = body.action
  const db = svc()

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
        return json({ ok: true, status: 'Rejected' })
      }
      const { data: lsh } = await db.rpc('next_lsh')
      const now = Date.now(), day = 86400000
      await db.from('certificates').upsert({ safeplate_id: order.safeplate_id, name: order.handler_name, panel: (order.tests || []).join(', '), lab: order.lab, issued: new Date(now).toISOString(), expiry: new Date(now + 182 * day).toISOString(), status: 'VALID', cert_no: lsh }, { onConflict: 'safeplate_id' })
      await db.from('escrow_releases').insert({ safeplate_id: order.safeplate_id, name: order.handler_name, lab: order.lab, amount: FEE, status: 'Instructed', approved_by: me.email, ts: new Date().toISOString() })
      await db.from('test_orders').update({ status: 'Approved' }).eq('id', body.orderId)
      await db.from('audit_log').insert({ actor: me.email, role: 'LSMoH', action: 'Approved, certificate ' + lsh + ' issued, escrow release instructed', subject: order.safeplate_id })
      await db.from('notifications').insert([{ audience: 'sterling', title: 'Escrow release instructed', body: order.safeplate_id }, { audience: 'all', title: 'Certificate issued', body: order.handler_name + ' is now certified' }])
      // Email the certificate link to the handler (optional; needs RESEND_API_KEY).
      try {
        const { data: fh } = await db.from('food_handlers').select('email').eq('safeplate_id', order.safeplate_id).single()
        const resendKey = Deno.env.get('RESEND_API_KEY')
        const appUrl = Deno.env.get('APP_URL') || ''
        if (fh?.email && resendKey) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST', headers: { authorization: 'Bearer ' + resendKey, 'content-type': 'application/json' },
            body: JSON.stringify({ from: 'SafePlate <onboarding@resend.dev>', to: fh.email, subject: 'Your SafePlate Certificate of Fitness (' + lsh + ')', html: 'Your Certificate of Fitness is issued. View, download or verify it here: <a href="' + appUrl + '/#/verify/' + order.safeplate_id + '">' + appUrl + '/#/verify/' + order.safeplate_id + '</a>' })
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
