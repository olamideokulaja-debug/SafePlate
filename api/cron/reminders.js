// /api/cron/reminders.js
// Daily renewal-reminder engine (Vercel Cron). Sends the 30/14/7/2-day and
// day-of-expiry ladder by SMS, and a 14-day-post-expiry non-compliance alert to
// LASEPA. Uses the Supabase service role. Protected by CRON_SECRET.

import { createClient } from '@supabase/supabase-js'

const LADDER = [30, 14, 7, 2, 0]

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.authorization !== 'Bearer ' + secret) return res.status(401).json({ error: 'Unauthorized' })

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return res.status(501).json({ error: 'Supabase service env not set' })
  const svc = createClient(url, key, { auth: { persistSession: false } })
  const termiiKey = process.env.TERMII_API_KEY
  const sender = process.env.TERMII_SENDER_ID || 'SafePlate'

  const { data: certs } = await svc.from('certificates').select('safeplate_id,name,expiry,status').eq('status', 'VALID')
  const now = new Date(); now.setHours(0, 0, 0, 0)
  let sent = 0

  for (const c of (certs || [])) {
    const exp = new Date(c.expiry); exp.setHours(0, 0, 0, 0)
    const days = Math.round((exp - now) / 86400000)
    let msg = null, lasepa = false
    if (LADDER.includes(days)) {
      msg = days === 0
        ? 'SafePlate: your food handler certificate expires today. Renew now to stay compliant. ID ' + c.safeplate_id
        : 'SafePlate: your certificate expires in ' + days + ' day(s). Renew to stay compliant. ID ' + c.safeplate_id
    } else if (days === -14) {
      msg = 'SafePlate: your certificate expired 14 days ago. You are non-compliant; renew immediately.'
      lasepa = true
    }
    if (!msg) continue

    const { data: fh } = await svc.from('food_handlers').select('phone').eq('safeplate_id', c.safeplate_id).limit(1)
    const phone = fh && fh[0] && fh[0].phone
    if (phone && termiiKey) {
      try {
        await fetch('https://api.ng.termii.com/api/sms/send', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ to: phone, from: sender, sms: msg, type: 'plain', channel: 'dnd', api_key: termiiKey })
        })
      } catch (e) { /* ignore */ }
    }
    await svc.from('notifications').insert({ audience: 'all', title: days < 0 ? 'Certificate expired' : 'Renewal reminder', body: c.name + ' — ' + msg })
    if (lasepa) await svc.from('notifications').insert({ audience: 'LASEPA', title: 'Non-compliance', body: c.name + ' certificate expired 14 days ago (' + c.safeplate_id + ')' })
    await svc.from('audit_log').insert({ actor: 'system', role: 'system', action: 'Reminder sent (' + days + 'd)', subject: c.safeplate_id })
    sent++
  }
  return res.status(200).json({ ok: true, checked: (certs || []).length, sent })
}
