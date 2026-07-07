// /api/anthropic.js
// Server-side proxy for the SafePlate AI Engine (document generation, non-compliance
// and anomaly detection, regulator summaries). The API key is held only on the server
// via the ANTHROPIC_API_KEY environment variable and is never exposed to the browser.
// Human oversight is retained: AI output informs regulator decisions, it does not make them.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(501).json({ error: 'ANTHROPIC_API_KEY not configured' })
  }
  try {
    const { messages, system, max_tokens } = req.body || {}
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: max_tokens || 1024,
        system: system || 'You assist Lagos State SafePlate regulators. Be concise and factual.',
        messages: messages || []
      })
    })
    const data = await r.json()
    return res.status(r.status).json(data)
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}
