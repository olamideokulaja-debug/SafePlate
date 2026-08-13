// Configuration and backend client. Extracted from App.jsx as the first
// leaf module of the modular refactor. Single source of truth for env-driven
// setup so no other module reads import.meta.env directly.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// SUPABASE_URL and SUPABASE_ANON_KEY are exported so the Edge Function caller
// (store.fn) can build the request. Without these exports that call throws a
// "SUPABASE_URL is not defined" ReferenceError in live mode.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const SUPABASE_READY: boolean = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
export const supabase: SupabaseClient | null =
  SUPABASE_READY ? createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string) : null

// Paystack is live when VITE_PAYSTACK_PUBLIC_KEY is set, simulated otherwise.
export const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string | undefined
export const PAYSTACK_READY: boolean = Boolean(PAYSTACK_PUBLIC_KEY)

// Minimal shape of a signed-in session as used across the app.
export interface Session {
  role: string
  agency?: string | null
  lab?: string | null
  name?: string
  email?: string
  phone?: string | null
}

// Accent colour for the current signed-in role/agency.
export function accentFor(x: Session | null | undefined): string {
  if (!x) return '#006600'
  if (x.role === 'regulator' || x.role === 'officer')
    return x.agency === 'LASEPA' ? '#0891b2' : x.agency === 'HEFAMAA' ? '#7c3aed' : '#15803d'
  return (
    ({ food_handler: '#006600', laboratory: '#b45309', sterling: '#1d4ed8', employer: '#be185d' } as Record<string, string>)[
      x.role
    ] || '#006600'
  )
}
