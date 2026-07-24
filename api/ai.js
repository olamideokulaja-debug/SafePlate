// RHSC AI endpoint. Thin proxy to the Claude Messages API.
// Set ANTHROPIC_API_KEY (and optionally AI_MODEL) in Vercel to enable AI features.
// Without the key, every AI feature degrades gracefully to "not configured".
export const maxDuration = 60 // AI calls can take longer than the 10s default

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.setHeader('Allow', 'POST'); res.status(200).end(); return }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, reason: 'method_not_allowed' }); return }
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) { res.status(200).json({ ok: false, reason: 'ai_not_configured' }); return }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const { system, prompt, image, max_tokens } = body
    const content = []
    if (image && typeof image === 'string' && image.indexOf('data:') === 0) {
      const m = image.match(/^data:(.*?);base64,(.*)$/)
      if (m) content.push({ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } })
    }
    content.push({ type: 'text', text: String(prompt || '') })
    const mt = Math.min(Math.max(parseInt(max_tokens, 10) || 1024, 64), 8192)
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'claude-sonnet-5',
        max_tokens: mt,
        system: system || 'You are a careful assistant for REALMS Healthcare Services Consulting Limited (RHSC), a Lagos healthcare consulting firm and licensed HEFAMAA facility-monitoring operator. Be concise, professional and accurate. Never invent regulatory facts.',
        messages: [{ role: 'user', content }]
      })
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) { const m = (data && data.error && data.error.message) || ('HTTP ' + r.status); res.status(200).json({ ok: false, reason: m }); return }
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim()
    res.status(200).json({ ok: true, text, truncated: data.stop_reason === 'max_tokens' })
  } catch (e) { res.status(200).json({ ok: false, reason: 'exception', message: String((e && e.message) || e) }) }
}
