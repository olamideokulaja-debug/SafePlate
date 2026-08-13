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


// Paystack checkout helpers. Live when a public key is configured, simulated
// otherwise. Moved out of App.jsx during the deep QA pass so the FoodHandler and
// Employer portal chunks can call them without a ReferenceError.
export function loadPaystack(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).PaystackPop) return resolve()
    const sc = document.createElement('script'); sc.src = 'https://js.paystack.co/v2/inline.js'
    sc.onload = () => resolve(); sc.onerror = () => reject(new Error('Could not load Paystack')); document.body.appendChild(sc)
  })
}

interface PayArgs { email?: string; amountNaira?: number; reference?: string }
export async function payWithPaystack({ email, amountNaira, reference }: PayArgs = {}): Promise<{ reference: string; simulated?: boolean }> {
  // Guard the inputs first. A bad amount here is a fault in the calling code,
  // not a Paystack configuration problem, and it must say so plainly.
  if (!Number.isFinite(amountNaira) || (amountNaira as number) <= 0) {
    throw new Error('Payment amount was not set correctly (received ' + JSON.stringify(amountNaira) + '). This is an application fault, not a Paystack setting.')
  }
  if (!PAYSTACK_READY) { await new Promise(r => setTimeout(r, 700)); return { reference: reference || ('DEMO-' + Date.now()), simulated: true } }
  await loadPaystack()
  return new Promise((resolve, reject) => {
    try {
      const popup = new (window as any).PaystackPop()
      popup.newTransaction({
        key: PAYSTACK_PUBLIC_KEY,
        email: email || 'noreply@safeplate.lagosstate.gov.ng',
        amount: Math.round((amountNaira as number) * 100),
        currency: 'NGN',
        reference: reference || ('SP-' + Date.now()),
        onSuccess: (tx: any) => resolve({ reference: tx.reference }),
        onCancel: () => reject(new Error('Payment window closed')),
        onError: (e: any) => reject(new Error('Payment could not start: ' + ((e && e.message) || 'Paystack rejected the request. If other payments work, this is not a key or domain problem.')))
      })
    } catch (e) { reject(new Error('Payment could not start. Confirm the Paystack public key is set and this domain is allowed in Paystack.')) }
  })
}
