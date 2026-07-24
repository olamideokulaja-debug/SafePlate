// Realms Field notification endpoint (Vercel serverless function).
// SMS via Termii, email via Resend. Both are optional: if the relevant keys
// are not set, the endpoint returns a clear "not configured" response and the
// app falls back to opening the device mail or SMS app.
//
// Environment variables (set in Vercel, none required for the app to run):
//   TERMII_API_KEY, TERMII_SENDER_ID   -> SMS
//   RESEND_API_KEY, NOTIFY_FROM        -> email (NOTIFY_FROM must be a verified sender)

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ ok: false, reason: 'method_not_allowed' }); return }
  const body = typeof req.body === 'string' ? safeParse(req.body) : (req.body || {})
  const { channel, to, subject, message } = body

  try {
    if (channel === 'sms') {
      const key = process.env.TERMII_API_KEY
      const from = process.env.TERMII_SENDER_ID || 'RHSC'
      if (!key) { res.status(200).json({ ok: false, reason: 'sms_not_configured' }); return }
      if (!to) { res.status(200).json({ ok: false, reason: 'missing_recipient' }); return }
      const r = await fetch('https://api.ng.termii.com/api/sms/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, from, sms: message, type: 'plain', channel: 'generic', api_key: key })
      })
      const detail = await r.json().catch(() => ({}))
      res.status(200).json({ ok: r.ok, provider: 'termii', detail }); return
    }

    if (channel === 'email') {
      const key = process.env.RESEND_API_KEY
      const from = process.env.NOTIFY_FROM
      if (!key || !from) { res.status(200).json({ ok: false, reason: 'email_not_configured' }); return }
      if (!to) { res.status(200).json({ ok: false, reason: 'missing_recipient' }); return }
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({ from, to, subject: subject || 'RHSC notification', text: message })
      })
      const detail = await r.json().catch(() => ({}))
      res.status(200).json({ ok: r.ok, provider: 'resend', detail }); return
    }

    if (channel === 'whatsapp') {
      const sid = process.env.TWILIO_ACCOUNT_SID
      const token = process.env.TWILIO_AUTH_TOKEN
      const from = process.env.TWILIO_WHATSAPP_FROM // e.g. whatsapp:+14155238886
      if (!sid || !token || !from) { res.status(200).json({ ok: false, reason: 'whatsapp_not_configured' }); return }
      if (!to) { res.status(200).json({ ok: false, reason: 'missing_recipient' }); return }
      const toWa = String(to).startsWith('whatsapp:') ? to : 'whatsapp:' + to
      const body = new URLSearchParams({ From: from, To: toWa, Body: message || '' })
      const r = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + sid + '/Messages.json', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': 'Basic ' + Buffer.from(sid + ':' + token).toString('base64') },
        body: body.toString()
      })
      const detail = await r.json().catch(() => ({}))
      res.status(200).json({ ok: r.ok, provider: 'twilio', detail }); return
    }

    res.status(400).json({ ok: false, reason: 'unknown_channel' })
  } catch (e) {
    res.status(200).json({ ok: false, reason: 'error', detail: String((e && e.message) || e) })
  }
}

function safeParse(s) { try { return JSON.parse(s) } catch (e) { return {} } }
