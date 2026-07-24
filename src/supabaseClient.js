import { createClient } from '@supabase/supabase-js'

// Trim stray whitespace and wrapping quotes that often slip into env vars.
function clean(v) {
  return typeof v === 'string' ? v.trim().replace(/^["']+|["']+$/g, '') : v
}

const url = clean(import.meta.env.VITE_SUPABASE_URL)
const anon = clean(import.meta.env.VITE_SUPABASE_ANON_KEY)

// Build the client defensively. If keys are missing or malformed, fall back to
// demo mode instead of throwing, so the site always renders.
let client = null
try {
  if (url && anon && /^https?:\/\//i.test(url)) {
    client = createClient(url, anon)
  } else if (url || anon) {
    console.warn('Realms: Supabase keys look incomplete or malformed. Running in demo mode. Check VITE_SUPABASE_URL (must start with https://) and VITE_SUPABASE_ANON_KEY in Vercel.')
  }
} catch (e) {
  console.error('Realms: Supabase failed to initialise, running in demo mode.', e)
  client = null
}

export const supabase = client
export const MODE = client ? 'supabase' : 'demo'
