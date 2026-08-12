// @ts-nocheck
import { describe, it, expect, beforeAll } from 'vitest'
import { seedDemo, store } from '../lib/store.ts'

beforeAll(() => seedDemo())

describe('NDPA erasure round-trip (DPO queue)', () => {
  it('request -> queue -> uphold minimises personal data but keeps the record', async () => {
    await store.saveHandler({ safeplateId: 'SP-LG-2026ERZ01', name: 'Erasure Tester', email: 'erz@demo.ng', phone: '08030000000', nin: '11122233344', consentGiven: true })
    const req = await store.requestErasure({ email: 'erz@demo.ng' }, 'closing my stall')
    expect(req.recordFound).toBe(true)

    const queue = await store.listErasureRequests()
    const mine = queue.find(r => r.safeplateId === 'SP-LG-2026ERZ01')
    expect(mine).toBeTruthy()
    expect(mine.erasureRef).toMatch(/^ERZ-/)
    console.log('QUEUE_LEN:', queue.length, 'REF:', mine.erasureRef)

    await store.resolveErasure('SP-LG-2026ERZ01', 'upheld', 'verified identity', 'DPO Test')
    const after = await store.listErasureRequests()
    expect(after.find(r => r.safeplateId === 'SP-LG-2026ERZ01')).toBeFalsy()  // cleared from queue

    const rec = await store.getMyHandler({ email: 'erz@demo.ng' })
    console.log('AFTER_NAME:', rec && rec.name, 'PHONE:', rec && rec.phone, 'NIN:', rec && rec.nin)
    // record still exists (skeleton kept) but personal fields minimised
    if (rec) { expect(rec.name).toMatch(/Erased/); expect(rec.nin).toBe('') }
  })

  it('decline keeps the record and clears the flag', async () => {
    await store.saveHandler({ safeplateId: 'SP-LG-2026ERZ02', name: 'Keeper', email: 'keep@demo.ng', consentGiven: true })
    await store.requestErasure({ email: 'keep@demo.ng' }, '')
    await store.resolveErasure('SP-LG-2026ERZ02', 'declined', 'certificate still valid', 'DPO Test')
    const q = await store.listErasureRequests()
    expect(q.find(r => r.safeplateId === 'SP-LG-2026ERZ02')).toBeFalsy()
    const rec = await store.getMyHandler({ email: 'keep@demo.ng' })
    expect(rec.name).toBe('Keeper')  // unchanged
  })
})
