// supabase/functions/_shared/auth.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const URL = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// A service-role client bypasses RLS. Only Edge Functions hold it; it is never
// shipped to the browser.
export function serviceClient() {
  return createClient(URL, SERVICE, { auth: { persistSession: false } })
}

export interface Caller {
  id: string
  email: string | null
  role: string
  agency: string | null
  lab: string | null
  phone: string | null
}

// Verify the caller's access token and return their identity + claims, or null.
export async function requireUser(req: Request): Promise<Caller | null> {
  const authHeader = req.headers.get('Authorization') || ''
  const jwt = authHeader.replace('Bearer ', '').trim()
  if (!jwt) return null
  const sb = createClient(URL, ANON, { global: { headers: { Authorization: authHeader } } })
  const { data, error } = await sb.auth.getUser(jwt)
  if (error || !data.user) return null
  const m = (data.user.user_metadata || {}) as Record<string, string>
  return {
    id: data.user.id,
    email: data.user.email ?? null,
    role: m.role || '',
    agency: m.agency || null,
    lab: m.lab || null,
    phone: m.phone || null
  }
}
