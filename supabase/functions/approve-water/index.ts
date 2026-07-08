// supabase/functions/approve-water/index.ts
import { cors, json } from '../_shared/cors.ts'
import { requireUser, serviceClient } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const caller = await requireUser(req)
  if (!caller) return json({ error: 'Unauthorized' }, 401)
  if (caller.role !== 'regulator' || caller.agency !== 'LASEPA') return json({ error: 'Forbidden' }, 403)

  const { swid, decision } = await req.json() // 'approve' | 'flag'
  const svc = serviceClient()
  const { data: w } = await svc.from('water_tests').select('*').eq('swid', swid).single()
  if (!w) return json({ error: 'Water test not found' }, 404)

  if (decision === 'flag') {
    await svc.from('water_tests').update({ status: 'Flagged, retest required' }).eq('swid', swid)
    await svc.from('audit_log').insert({ actor: caller.email, role: 'LASEPA', action: 'Water result flagged, retest required', subject: swid })
    return json({ ok: true, status: 'Flagged' })
  }

  const now = Date.now(), day = 86400000
  const series = 'SP-W-CERT-' + new Date().getFullYear() + '-' + String(Math.floor(100000 + Math.random() * 899999))
  await svc.from('certificates').upsert({
    safeplate_id: swid, name: w.facility, panel: 'Potable water quality', lab: w.lab,
    issued: new Date(now).toISOString(), expiry: new Date(now + 182 * day).toISOString(), status: 'VALID', series
  }, { onConflict: 'safeplate_id' })
  await svc.from('escrow').update({ status: 'RELEASED', released_ts: new Date().toISOString(), released_by: caller.email }).eq('safeplate_id', swid)
  await svc.from('water_tests').update({ status: 'Certified', cert_series: series }).eq('swid', swid)
  await svc.from('audit_log').insert({ actor: caller.email, role: 'LASEPA', action: 'Water approved, certificate issued, 80/10/5/5 disbursed', subject: swid })
  await svc.from('notifications').insert({ audience: 'all', title: 'Facility water certified', body: w.facility })

  return json({ ok: true, status: 'Certified', series })
})
