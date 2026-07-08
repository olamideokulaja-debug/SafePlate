// supabase/functions/verify-otp/index.ts
import { cors, json } from '../_shared/cors.ts'
import { requireUser, serviceClient } from '../_shared/auth.ts'
import { sha256 } from '../_shared/crypto.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const caller = await requireUser(req)
  if (!caller) return json({ error: 'Unauthorized' }, 401)
  const { code } = await req.json()
  const svc = serviceClient()

  const { data: row } = await svc.from('otp_codes').select('*').eq('subject', caller.id).order('ts', { ascending: false }).limit(1).maybeSingle()
  if (!row) return json({ ok: false, error: 'No code, request a new one' }, 400)
  if (new Date(row.expires_at).getTime() < Date.now()) return json({ ok: false, error: 'Code expired' }, 400)
  if ((row.attempts || 0) >= 5) return json({ ok: false, error: 'Too many attempts' }, 429)

  const ok = (await sha256(String(code))) === row.code_hash
  if (!ok) {
    await svc.from('otp_codes').update({ attempts: (row.attempts || 0) + 1 }).eq('id', row.id)
    return json({ ok: false, error: 'Incorrect code' }, 401)
  }
  // Consume the code.
  await svc.from('otp_codes').delete().eq('id', row.id)
  return json({ ok: true })
})
