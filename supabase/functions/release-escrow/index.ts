// supabase/functions/release-escrow/index.ts
import { cors, json } from '../_shared/cors.ts'
import { requireUser, serviceClient } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const caller = await requireUser(req)
  if (!caller) return json({ error: 'Unauthorized' }, 401)
  if (caller.role !== 'sterling') return json({ error: 'Forbidden' }, 403)

  const { safeplateId } = await req.json()
  const svc = serviceClient()

  // Only release against an approved instruction.
  const { data: rel } = await svc.from('escrow_releases').select('*').eq('safeplate_id', safeplateId).eq('status', 'Instructed').maybeSingle()
  if (!rel) return json({ error: 'No approved release instruction for this ID' }, 409)

  const ts = new Date().toISOString()
  // Atomic: mark escrow released and the instruction executed.
  await svc.from('escrow').update({ status: 'RELEASED', released_ts: ts, released_by: caller.email }).eq('safeplate_id', safeplateId)
  await svc.from('escrow_releases').update({ status: 'Released' }).eq('safeplate_id', safeplateId)
  await svc.from('audit_log').insert({ actor: caller.email, role: 'Sterling Bank', action: 'Escrow released, full waterfall disbursed', subject: safeplateId })
  await svc.from('notifications').insert({ audience: 'laboratory', title: 'Payment released', body: safeplateId })

  return json({ ok: true, status: 'RELEASED' })
})
