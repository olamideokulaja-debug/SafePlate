// @ts-nocheck
import { describe, it, expect, vi } from 'vitest'
import * as config from '../lib/config.ts'

// Regression: store.fn() referenced SUPABASE_URL / SUPABASE_ANON_KEY without
// importing them, throwing "SUPABASE_URL is not defined" the moment a regulator
// signed in against a live backend (screenshots 2026-08-13). These symbols must
// be exported from config so the edge-function caller can resolve them.
describe('edge-function config contract', () => {
  it('config exports SUPABASE_URL and SUPABASE_ANON_KEY (even if undefined in demo)', () => {
    expect('SUPABASE_URL' in config).toBe(true)
    expect('SUPABASE_ANON_KEY' in config).toBe(true)
  })

  it('store.fn builds the request URL without a ReferenceError when backend is ready', async () => {
    // Force the live path: pretend the backend is ready and stub the client + fetch.
    vi.resetModules()
    vi.doMock('../lib/config.ts', () => ({
      SUPABASE_READY: true,
      SUPABASE_URL: 'https://demo.supabase.co',
      SUPABASE_ANON_KEY: 'anon-key',
      supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) } },
      PAYSTACK_READY: false, PAYSTACK_PUBLIC_KEY: undefined,
      accentFor: () => '#006600',
    }))
    let calledUrl = null
    globalThis.fetch = vi.fn(async (url) => { calledUrl = url; return { ok: true, status: 200, json: async () => ({ ok: true }) } })
    const { store } = await import('../lib/store.ts')
    const out = await store.fn('ping', { x: 1 })
    expect(calledUrl).toBe('https://demo.supabase.co/functions/v1/safeplate')  // URL resolved, no ReferenceError
    expect(out).toBeTruthy()
    vi.doUnmock('../lib/config.ts'); vi.resetModules()
  })
})
