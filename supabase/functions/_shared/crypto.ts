// supabase/functions/_shared/crypto.ts
// App-layer AES-256-GCM. The 32-byte key is base64 in RESULT_ENC_KEY, injected
// from Supabase Vault. Plaintext health results never touch the database.

const b64 = {
  enc: (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))),
  dec: (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0))
}

async function key(): Promise<CryptoKey> {
  const raw = b64.dec(Deno.env.get('RESULT_ENC_KEY')!)
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

export async function encrypt(plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(), new TextEncoder().encode(plaintext))
  return b64.enc(iv.buffer) + ':' + b64.enc(ct)
}

export async function decrypt(payload: string): Promise<string> {
  const [ivB64, ctB64] = payload.split(':')
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64.dec(ivB64) }, await key(), b64.dec(ctB64))
  return new TextDecoder().decode(pt)
}

// SHA-256 hex, used to store OTP codes as hashes rather than plaintext.
export async function sha256(s: string): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('')
}
