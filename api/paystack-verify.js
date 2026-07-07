// /api/paystack-verify.js
// Verifies a Paystack transaction server-side, then records the escrow entry and the
// SafePlate waterfall split. The secret key is held only on the server via the
// PAYSTACK_SECRET_KEY environment variable. Escrow release to the laboratory happens
// later, and only on a signed instruction from the Ministry portal after result approval.

const FOOD_HANDLER_WATERFALL = [
  { who: 'Private Lab, execution', pct: 76.5 },
  { who: 'LSMoH, oversight & regulation', pct: 10 },
  { who: 'Technology partner', pct: 5 },
  { who: 'Financial Partner (Sterling Bank)', pct: 5 },
  { who: 'LASEPA, enforcement', pct: 3.5 }
]

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) {
    return res.status(501).json({ error: 'PAYSTACK_SECRET_KEY not configured' })
  }
  const { reference, safeplateId } = req.body || {}
  if (!reference) return res.status(400).json({ error: 'Missing transaction reference' })

  try {
    const r = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { authorization: `Bearer ${secret}` }
    })
    const data = await r.json()
    const ok = data?.data?.status === 'success'
    if (!ok) return res.status(402).json({ error: 'Payment not successful', paystack: data })

    const amount = (data.data.amount || 0) / 100 // Paystack returns kobo
    const split = FOOD_HANDLER_WATERFALL.map(w => ({ ...w, amount: Math.round(amount * w.pct) / 100 }))

    // TODO: persist escrow entry to the database (transaction_type = FOOD_HANDLER),
    // status = HELD, awaiting Ministry approval before release.
    return res.status(200).json({ ok: true, safeplateId, amount, escrow: 'HELD', split })
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}
