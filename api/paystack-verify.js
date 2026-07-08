// /api/paystack-verify.js
// Verifies a Paystack transaction server-side, then records the escrow entry using
// the Supabase service role. With hardened RLS the browser cannot write the escrow
// table, so this trusted server path is the only way escrow is created. The secret
// key and service role key are held only on the server.

import { createClient } from '@supabase/supabase-js'

const FOOD_WATERFALL = [
  { who: 'Private Lab, execution', pct: 76.5 },
  { who: 'LSMoH, oversight & regulation', pct: 10 },
  { who: 'Technology partner', pct: 5 },
  { who: 'Financial Partner (Sterling Bank)', pct: 5 },
  { who: 'LASEPA, enforcement', pct: 3.5 }
]

function snake(o) {
  return o ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k.replace(/[A-Z]/g, m => '_' + m.toLowerCase()), v])) : o
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) return res.status(501).json({ error: 'PAYSTACK_SECRET_KEY not configured' })

  const { reference, safeplateId, escrow } = req.body || {}
  if (!reference) return res.status(400).json({ error: 'Missing transaction reference' })

  try {
    const r = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { authorization: `Bearer ${secret}` }
    })
    const data = await r.json()
    if (data?.data?.status !== 'success') return res.status(402).json({ error: 'Payment not successful', paystack: data })

    const amount = (data.data.amount || 0) / 100 // kobo to naira
    const split = FOOD_WATERFALL.map(w => ({ ...w, amount: Math.round(amount * w.pct) / 100 }))

    // Record escrow with the service role (only after this trusted payment check).
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (url && serviceKey && escrow) {
      const svc = createClient(url, serviceKey, { auth: { persistSession: false } })
      await svc.from('escrow').upsert(snake({ ...escrow, status: 'HELD' }), { onConflict: 'safeplate_id' })
      await svc.from('audit_log').insert({ actor: 'paystack', role: 'system', action: 'Payment verified, escrow funded', subject: safeplateId })
    }

    return res.status(200).json({ ok: true, safeplateId, amount, escrow: 'HELD', split })
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}
