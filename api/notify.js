// /api/notify.js
// Sends a real SMS via Termii (Nigerian-registered provider) when TERMII_API_KEY is set.
// The app calls this fire-and-forget for lifecycle events (payment confirmed, certificate
// issued, and so on). The API key is held only on the server and never reaches the browser.
//
// Environment variables:
//   TERMII_API_KEY    your Termii API key
//   TERMII_SENDER_ID  an approved Termii sender ID (defaults to "SafePlate")
//
// SafePlate messages are transactional (payment confirmed, certificate issued), so
// this uses Termii's DND route. The DND route delivers at any hour and reaches
// numbers on Do-Not-Disturb, but it must be activated on your Termii account first
// (contact Termii support). If you ever need the generic route, change channel to 'generic'.
//
// Email is not sent through Termii SMS. To enable email, wire an email provider
// (for example Resend or SendGrid) in the email branch below.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const apiKey = process.env.TERMII_API_KEY
  const sender = process.env.TERMII_SENDER_ID || 'SafePlate'
  if (!apiKey) {
    return res.status(501).json({ error: 'TERMII_API_KEY not configured' })
  }
  const { to, channel, message } = req.body || {}
  if (!to || !message) {
    return res.status(400).json({ error: 'Missing recipient or message' })
  }

  try {
    if (channel === 'email') {
      // Not configured. Add your email provider here and send from the server.
      return res.status(200).json({ ok: true, note: 'email channel not configured' })
    }

    const r = await fetch('https://api.ng.termii.com/api/sms/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        to,
        from: sender,
        sms: message,
        type: 'plain',
        channel: 'dnd',
        api_key: apiKey
      })
    })
    const data = await r.json()
    return res.status(r.status).json(data)
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}
