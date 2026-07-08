// supabase/functions/submit-result/index.ts
import { cors, json } from '../_shared/cors.ts'
import { requireUser, serviceClient } from '../_shared/auth.ts'
import { encrypt } from '../_shared/crypto.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const caller = await requireUser(req)
  if (!caller) return json({ error: 'Unauthorized' }, 401)
  if (caller.role !== 'laboratory') return json({ error: 'Forbidden' }, 403)

  const { orderId, results, technicianId, accreditationNumber } = await req.json()
  const svc = serviceClient()

  const { data: order } = await svc.from('test_orders').select('*').eq('id', orderId).single()
  if (!order) return json({ error: 'Order not found' }, 404)
  if (caller.lab && order.lab !== caller.lab) return json({ error: 'Not your order' }, 403)

  // Accreditation must match the lab on record, else quarantine.
  const { data: labRow } = await svc.from('laboratories').select('acc_no').eq('name', order.lab).single()
  if (labRow && accreditationNumber !== labRow.acc_no) {
    await svc.from('test_orders').update({ status: 'Quarantined', note: 'Accreditation number mismatch, referred to LSMoH.' }).eq('id', orderId)
    await svc.from('audit_log').insert({ actor: caller.email, role: 'laboratory', action: 'Result quarantined, accreditation mismatch', subject: order.safeplate_id })
    return json({ ok: true, status: 'Quarantined' })
  }

  const referred = Object.values(results || {}).some((v) => v === 'refer')
  const results_enc = await encrypt(JSON.stringify(results || {}))

  await svc.from('test_orders').update({
    status: 'Submitted', results_enc, technician_id: technicianId, accreditation_number: accreditationNumber,
    reported_lsmoh: referred, biobank_confirm: referred, submitted_at: new Date().toISOString()
  }).eq('id', orderId)

  await svc.from('audit_log').insert({ actor: caller.email, role: 'laboratory', action: 'Results submitted (encrypted)', subject: order.safeplate_id })
  await svc.from('notifications').insert({ audience: 'LSMoH', title: 'Results submitted', body: order.handler_name + ' pending Ministry review' })

  return json({ ok: true, status: 'Submitted' })
})
