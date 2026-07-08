// supabase/functions/approve-result/index.ts
import { cors, json } from '../_shared/cors.ts'
import { requireUser, serviceClient } from '../_shared/auth.ts'
import { decrypt } from '../_shared/crypto.ts'

const FEE = 15000

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const caller = await requireUser(req)
  if (!caller) return json({ error: 'Unauthorized' }, 401)
  if (caller.role !== 'regulator' || caller.agency !== 'LSMoH') return json({ error: 'Forbidden' }, 403)

  const { orderId, decision } = await req.json() // decision: 'approve' | 'flag' | 'reject'
  const svc = serviceClient()
  const { data: order } = await svc.from('test_orders').select('*').eq('id', orderId).single()
  if (!order) return json({ error: 'Order not found' }, 404)

  if (decision === 'flag') {
    await svc.from('test_orders').update({ status: 'Flagged' }).eq('id', orderId)
    await svc.from('audit_log').insert({ actor: caller.email, role: 'LSMoH', action: 'Flagged for review, escrow held', subject: order.safeplate_id })
    return json({ ok: true, status: 'Flagged' })
  }

  // Determine pass/refer from the decrypted result.
  let anyRefer = false
  try { const r = JSON.parse(await decrypt(order.results_enc || '')); anyRefer = Object.values(r).some((v) => v === 'refer') } catch { /* ignore */ }

  if (decision === 'reject' || anyRefer) {
    await svc.from('test_orders').update({ status: 'Rejected' }).eq('id', orderId)
    await svc.from('audit_log').insert({ actor: caller.email, role: 'LSMoH', action: 'Result rejected, referral pathway, escrow held', subject: order.safeplate_id })
    await svc.from('notifications').insert({ audience: 'all', title: 'Result referred', body: order.handler_name + ' must retest' })
    return json({ ok: true, status: 'Rejected' })
  }

  // Approve: mint LSH number, issue certificate, instruct release, atomically.
  const { data: lsh } = await svc.rpc('next_lsh')
  const now = Date.now(), day = 86400000
  await svc.from('certificates').upsert({
    safeplate_id: order.safeplate_id, name: order.handler_name, panel: (order.tests || []).join(', '),
    lab: order.lab, issued: new Date(now).toISOString(), expiry: new Date(now + 182 * day).toISOString(),
    status: 'VALID', cert_no: lsh
  }, { onConflict: 'safeplate_id' })
  await svc.from('escrow_releases').insert({ safeplate_id: order.safeplate_id, name: order.handler_name, lab: order.lab, amount: FEE, status: 'Instructed', approved_by: caller.email, ts: new Date().toISOString() })
  await svc.from('test_orders').update({ status: 'Approved' }).eq('id', orderId)
  await svc.from('audit_log').insert({ actor: caller.email, role: 'LSMoH', action: 'Approved, certificate ' + lsh + ' issued, escrow release instructed', subject: order.safeplate_id })
  await svc.from('notifications').insert([
    { audience: 'sterling', title: 'Escrow release instructed', body: order.safeplate_id },
    { audience: 'all', title: 'Certificate issued', body: order.handler_name + ' is now certified' }
  ])

  return json({ ok: true, status: 'Approved', cert_no: lsh })
})
