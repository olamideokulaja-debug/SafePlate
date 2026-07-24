// RHSC geocoding endpoint. Hybrid by design:
//   1. Google Geocoding API (GOOGLE_MAPS_KEY) for exact street-level pins.
//   2. Claude (ANTHROPIC_API_KEY) to estimate a neighbourhood centre for whatever
//      Google cannot find, which is common with informal Lagos addressing.
//   3. OpenStreetMap only as a last resort if neither key is set.
export const maxDuration = 60

const UA = 'RealmsFieldMonitoring/1.0 (info@realmsconsulting.com)'
const inLagos = (lat, lng) => isFinite(lat) && isFinite(lng) && lat >= 6.3 && lat <= 6.8 && lng >= 2.6 && lng <= 4.4

async function google(q, key) {
  const url = 'https://maps.googleapis.com/maps/api/geocode/json?address=' +
    encodeURIComponent(q) + '&components=country:NG|administrative_area:Lagos&key=' + key
  const r = await fetch(url)
  const d = await r.json().catch(() => ({}))
  if (d.status === 'OK' && d.results && d.results[0]) {
    const g = d.results[0]
    const lat = g.geometry.location.lat, lng = g.geometry.location.lng
    if (!inLagos(lat, lng)) return null
    return { lat, lng, precision: g.geometry.location_type || 'GOOGLE', label: g.formatted_address }
  }
  if (d.status === 'ZERO_RESULTS') return null
  if (d.status && d.status !== 'OK') throw new Error(d.status + (d.error_message ? ': ' + d.error_message : ''))
  return null
}

async function osm(q) {
  const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ng' +
    '&viewbox=2.70,6.75,4.35,6.35&bounded=1&q=' + encodeURIComponent(q)
  const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } })
  if (!r.ok) return null
  const j = await r.json().catch(() => [])
  if (j && j[0] && inLagos(parseFloat(j[0].lat), parseFloat(j[0].lon))) {
    return { lat: parseFloat(j[0].lat), lng: parseFloat(j[0].lon), precision: 'OSM', label: j[0].display_name }
  }
  return null
}

async function aiEstimate(list) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return list.map(() => null)
  const items = list.map((q, i) => ({ i, q }))
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: process.env.AI_MODEL || 'claude-sonnet-5',
      max_tokens: 2000,
      system: 'You are a geographer of Lagos State, Nigeria. For each numbered place give the approximate centre coordinates of that neighbourhood or landmark. Reply with ONLY compact JSON, no prose, no code fences: {"r":[{"i":0,"lat":6.6018,"lng":3.3515}]}. Use 4 decimal places. OMIT any entry you are not reasonably confident about rather than guessing. Every place is in Lagos State (latitude 6.35 to 6.75, longitude 2.70 to 4.35); never return a point outside that box.',
      messages: [{ role: 'user', content: JSON.stringify(items) }]
    })
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((d && d.error && d.error.message) || ('HTTP ' + r.status))
  let txt = (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim()
  txt = txt.replace(/```json/gi, '').replace(/```/g, '').trim()
  const a = txt.indexOf('{'), b = txt.lastIndexOf('}')
  if (a < 0 || b <= a) return list.map(() => null)
  const rows = (JSON.parse(txt.slice(a, b + 1)).r) || []
  const out = list.map(() => null)
  rows.forEach(x => {
    const lat = Number(x.lat), lng = Number(x.lng)
    if (!inLagos(lat, lng)) return
    if (x.i >= 0 && x.i < out.length) out[x.i] = { lat, lng, precision: 'AI_LOCALITY' }
  })
  return out
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ ok: false, reason: 'method_not_allowed' }); return }
  const hasGoogle = !!process.env.GOOGLE_MAPS_KEY
  const hasAI = !!process.env.ANTHROPIC_API_KEY
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})

    // Probe: tell the app which engines are available, without spending anything.
    if (body.probe) { res.status(200).json({ ok: true, hasGoogle, hasAI, source: hasGoogle ? 'google' : hasAI ? 'ai' : 'osm' }); return }

    const list = (Array.isArray(body.list) ? body.list : (body.q ? [body.q] : [])).slice(0, 60).map(x => String(x || '').trim())
    if (!list.length) { res.status(200).json({ ok: false, reason: 'nothing_to_look_up' }); return }
    const engine = body.engine || 'auto'

    if (engine === 'ai' || (engine === 'auto' && !hasGoogle && hasAI)) {
      res.status(200).json({ ok: true, source: 'ai', results: await aiEstimate(list) }); return
    }
    if (engine === 'google' || (engine === 'auto' && hasGoogle)) {
      if (!hasGoogle) { res.status(200).json({ ok: false, reason: 'google_key_missing' }); return }
      const out = []
      for (const q of list) {
        if (!q) { out.push(null); continue }
        try { out.push(await google(q, process.env.GOOGLE_MAPS_KEY)) }
        catch (e) { res.status(200).json({ ok: false, reason: String(e.message || e), results: out }); return }
      }
      res.status(200).json({ ok: true, source: 'google', results: out }); return
    }
    const out = []
    for (const q of list) {
      if (!q) { out.push(null); continue }
      try { out.push(await osm(q)); await new Promise(r => setTimeout(r, 1100)) } catch (e) { out.push(null) }
    }
    res.status(200).json({ ok: true, source: 'osm', results: out })
  } catch (e) {
    res.status(200).json({ ok: false, reason: String((e && e.message) || e) })
  }
}
