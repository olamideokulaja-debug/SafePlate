// @ts-nocheck
import { describe, it, expect, beforeAll } from 'vitest'
import { render } from '@testing-library/react'
import { seedDemo, store } from '../lib/store.ts'
import RegulatorModule from '../portals/RegulatorPortal.tsx'

beforeAll(() => seedDemo())

describe('anomaly / integrity signals', () => {
  it('LSMoH review tab (with AnomalySignals) mounts without throwing', () => {
    expect(() =>
      render(<RegulatorModule session={{ role: 'regulator', agency: 'LSMoH', email: 'l@demo.ng', name: 'Ministry' }} tab="review" onTab={() => {}} />)
    ).not.toThrow()
  })

  it('anomaly inputs are queryable from the store', async () => {
    // Guards that the data the signals compute over is actually reachable.
    const [orders, certs, complaints] = await Promise.all([
      store.listAllOrders(), store.listAllCertificates(), store.listComplaints(),
    ])
    expect(Array.isArray(orders)).toBe(true)
    expect(Array.isArray(certs)).toBe(true)
    expect(Array.isArray(complaints)).toBe(true)
    console.log('ANOMALY_INPUTS: orders=' + orders.length + ' certs=' + certs.length + ' complaints=' + complaints.length)
  })
})
