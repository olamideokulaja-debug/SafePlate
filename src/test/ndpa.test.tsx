// @ts-nocheck
import { describe, it, expect, beforeAll } from 'vitest'
import { render } from '@testing-library/react'
import { seedDemo, store } from '../lib/store.ts'
import DataRights from '../components/DataRights.tsx'

beforeAll(() => seedDemo())

describe('NDPA data rights', () => {
  it('DataRights panel renders', () => {
    expect(() => render(<DataRights session={{ email: 'x@demo.ng', name: 'Test' }} consent={{ given: true, at: new Date().toISOString(), version: 'NDPA-2026-v1' }} />)).not.toThrow()
  })

  it('exportMyData returns a structured, redacted payload', async () => {
    // seed a handler we can look up
    await store.saveHandler({ safeplateId: 'SP-LG-2026TEST1', name: 'Export Tester', email: 'exp@demo.ng', nin: '12345678901', consentGiven: true, consentAt: new Date().toISOString(), consentVersion: 'NDPA-2026-v1' })
    const out = await store.exportMyData({ email: 'exp@demo.ng' })
    console.log('EXPORT_KEYS:', Object.keys(out).join(','))
    console.log('NIN_MASKED:', out.personalData?.nin)
    expect(out.consent.given).toBe(true)
    expect(out.personalData.nin).toMatch(/\*/)          // NIN masked
    expect(out.personalData.photo).toBeUndefined()      // photo excluded
  })

  it('requestErasure lodges an audited reference', async () => {
    const out = await store.requestErasure({ email: 'exp@demo.ng' }, 'no longer trading')
    console.log('ERASURE_REF:', out.reference)
    expect(out.reference).toMatch(/^ERZ-\d{4}-\d{6}$/)
    expect(out.recordFound).toBe(true)
  })
})
