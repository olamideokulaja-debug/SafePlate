// @ts-nocheck
import { describe, it, expect } from 'vitest'
import { certReminderIcs } from '../lib/calendar.ts'
describe('calendar ICS', () => {
  it('produces a valid VCALENDAR with expiry event and alarm', () => {
    const ics = certReminderIcs({ safeplateId: 'SP-LG-2026TEST9', expiry: '2026-12-01' })
    console.log('ICS_HEAD:', JSON.stringify(ics.split('\r\n').slice(0, 6)))
    expect(ics).toMatch(/^BEGIN:VCALENDAR/)
    expect(ics).toMatch(/END:VCALENDAR$/)
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('BEGIN:VALARM')
    expect(ics).toContain('DTSTART;VALUE=DATE:20261201')
    expect(ics).toContain('SP-LG-2026TEST9')
  })
})
