// supabase/functions/decrypt-result/index.ts
import { cors, json } from '../_shared/cors.ts'
import { requireUser, serviceClient } from '../_shared/auth.ts'
import { decrypt } from '../_shared/crypto.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const caller = await requireUser(req)
  if (!caller) return json({ error: 'Unauthorized' }, 401)

  const { orderId } = await req.json()
  const svc = serviceClient()
  const { data: order } = await svc.from('test_orders').select('*').eq('id', orderId).single()
  if (!order) return json({ error: 'Order not found' }, 404)

  // Only the Ministry, or the food handler who owns this record, may decrypt.
  let allowed = caller.role === 'regulator' && caller.agency === 'LSMoH'
  if (!allowed) {
    const { data: fh } = await svc.from('food_handlers').select('user_id').eq('safeplate_id', order.safeplate_id).single()
    allowed = fh?.user_id === caller.id
  }
  if (!allowed) return json({ error: 'Forbidden' }, 403)

  await svc.from('audit_log').insert({ actor: caller.email, role: caller.role, action: 'Result decrypted/viewed', subject: order.safeplate_id })
  let results = {}
  try { results = JSON.parse(await decrypt(order.results_enc || '')) } catch { /* ignore */ }
  return json({ ok: true, results })
})
