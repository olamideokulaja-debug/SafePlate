// supabase/functions/revoke-certificate/index.ts
import { cors, json } from '../_shared/cors.ts'
import { requireUser, serviceClient } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const caller = await requireUser(req)
  if (!caller) return json({ error: 'Unauthorized' }, 401)
  if (caller.role !== 'regulator' || caller.agency !== 'LSMoH') return json({ error: 'Forbidden' }, 403)

  const { safeplateId } = await req.json()
  const svc = serviceClient()
  await svc.from('certificates').update({ status: 'REVOKED' }).eq('safeplate_id', (safeplateId || '').toUpperCase())
  await svc.from('audit_log').insert({ actor: caller.email, role: 'LSMoH', action: 'Certificate revoked', subject: safeplateId })
  return json({ ok: true, status: 'REVOKED' })
})
