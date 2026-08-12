// Portal smoke tests (refactor item 4).
//
// The single most valuable regression guard for SafePlate: mount every portal
// the way the app mounts it, for each role and agency, and assert it renders
// without throwing. The original blank-portal bug (a const referenced before
// declaration) crashed a portal on every render; a test like this would have
// caught it before it ever reached a user. These run with no Supabase env, so
// the app uses its built-in demo data.

import { describe, it, expect, beforeAll } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { Suspense } from 'react'
import { afterEach } from 'vitest'

import { seedDemo } from '../lib/store.ts'
import FoodHandlerModule from '../portals/FoodHandlerPortal.tsx'
import LaboratoryModule from '../portals/LaboratoryPortal.tsx'
import RegulatorModule from '../portals/RegulatorPortal.tsx'
import OfficerModule from '../portals/OfficerPortal.tsx'
import SterlingModule from '../portals/SterlingPortal.tsx'
import EmployerModule from '../portals/EmployerPortal.tsx'

beforeAll(() => {
  // Populate the demo store so portals have data to render.
  seedDemo()
})

afterEach(() => cleanup())

// Every distinct signed-in surface the app can route to. Agencies matter because
// a "regulator" is LSMoH, LASEPA or HEFAMAA and each drives a different view.
const cases: Array<{ name: string; Comp: any; session: any; extra?: any }> = [
  { name: 'Food handler', Comp: FoodHandlerModule, session: { role: 'food_handler', email: 'fh@demo.ng', name: 'Test Handler' } },
  { name: 'Laboratory', Comp: LaboratoryModule, session: { role: 'laboratory', email: 'lab@demo.ng', lab: 'Lancet Ikeja', name: 'Lab Tech' }, extra: { tab: 'queue', adminView: false } },
  { name: 'Regulator (LSMoH)', Comp: RegulatorModule, session: { role: 'regulator', agency: 'LSMoH', email: 'lsmoh@demo.ng', name: 'Ministry' }, extra: { tab: 'home', onTab: () => {} } },
  { name: 'Regulator (LASEPA)', Comp: RegulatorModule, session: { role: 'regulator', agency: 'LASEPA', email: 'lasepa@demo.ng', name: 'LASEPA' }, extra: { tab: 'home', onTab: () => {} } },
  { name: 'Regulator (HEFAMAA)', Comp: RegulatorModule, session: { role: 'regulator', agency: 'HEFAMAA', email: 'hefamaa@demo.ng', name: 'HEFAMAA' }, extra: { tab: 'home', onTab: () => {} } },
  { name: 'Officer', Comp: OfficerModule, session: { role: 'officer', agency: 'LASEPA', email: 'officer@demo.ng', name: 'Field Officer' }, extra: { tab: 'home' } },
  { name: 'Sterling', Comp: SterlingModule, session: { role: 'sterling', email: 'sterling@demo.ng', name: 'Bank' }, extra: { tab: 'home', onTab: () => {} } },
  { name: 'Employer', Comp: EmployerModule, session: { role: 'employer', email: 'employer@demo.ng', name: 'Employer' }, extra: { tab: 'home' } },
]

describe('every portal mounts without crashing', () => {
  for (const c of cases) {
    it(c.name + ' renders', () => {
      const { Comp, session, extra } = c
      expect(() =>
        render(
          <Suspense fallback={null}>
            <Comp session={session} {...(extra || {})} />
          </Suspense>
        )
      ).not.toThrow()
    })
  }
})
