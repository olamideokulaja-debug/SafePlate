// supabase/functions/send-otp/index.ts
import { cors, json } from '../_shared/cors.ts'
import { requireUser, serviceClient } from '../_shared/auth.ts'
import { sha256 } from '../_shared/crypto.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const caller = await requireUser(req)
  if (!caller) return json({ error: 'Unauthorized' }, 401)
  const to = caller.phone
  if (!to) return json({ error: 'No registered phone on this account' }, 400)

  const code = String(Math.floor(100000 + Math.random() * 900000))
  const svc = serviceClient()
  await svc.from('otp_codes').insert({
    subject: caller.id, code_hash: await sha256(code),
    expires_at: new Date(Date.now() + 5 * 60000).toISOString(), attempts: 0
  })

  const apiKey = Deno.env.get('TERMII_API_KEY')
  if (apiKey) {
    await fetch('https://api.ng.termii.com/api/sms/send', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ to, from: Deno.env.get('TERMII_SENDER_ID') || 'SafePlate', sms: 'Your SafePlate verification code is ' + code, type: 'plain', channel: 'dnd', api_key: apiKey })
    })
  }
  return json({ ok: true, sent: Boolean(apiKey) })
})
