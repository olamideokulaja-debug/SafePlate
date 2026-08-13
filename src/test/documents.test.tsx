// @ts-nocheck
import { describe, it, expect } from 'vitest'
import { generateReceiptPDF, generateEnforcementLetter, generateQaReportPDF } from '../lib/helpers.ts'
import { certReminderIcs } from '../lib/calendar.ts'

// Build the documents end to end. jsPDF's .save() triggers a DOM download that
// isn't available in jsdom; we treat ONLY a save/download error as acceptable and
// fail on any real document-build error (bad field access, undefined helper, etc).
function buildOk(fn) {
  try { fn(); return { ok: true } }
  catch (e) {
    const msg = String(e && e.message || e)
    // save/download step is environment-only, not a logic bug
    if (/save|download|createObjectURL|Blob|navigator|document is not defined|appendChild/i.test(msg)) return { ok: true, savedStep: true }
    return { ok: false, msg }
  }
}

describe('document generators build without throwing', () => {
  const cases = {
    'receipt food': () => generateReceiptPDF({ reference: 'PSK-123', safeplateId: 'SP-LG-2026000001', name: 'Ada Test', lab: 'Lancet Ikeja', paidAt: new Date().toISOString(), amount: 15000, type: 'FOOD' }),
    'receipt water': () => generateReceiptPDF({ reference: 'SPW-1', safeplateId: 'SP-W-LG-20260001', name: 'Blue Water Ltd', lab: 'Synlab VI', paidAt: new Date().toISOString(), amount: 65000, type: 'WATER' }),
    'receipt minimal': () => generateReceiptPDF({ safeplateId: 'SP-LG-2026000002', type: 'FOOD' }),
    'enforcement letter': () => generateEnforcementLetter({ name: 'Mama Put Kitchen', lga: 'Ikeja', address: '5 Allen Ave', sanction: 'Closure notice', compliance: 'Non-compliant' }, { name: 'Officer Bello', agency: 'LASEPA', email: 'bello@lasepa.ng' }),
    'qa report': () => generateQaReportPDF({ answers: {}, ts: new Date().toISOString() }, { name: 'Lancet Ikeja', accreditationNumber: 'HEF-LAB-0001', lga: 'Ikeja' }),
    'ics reminder': () => certReminderIcs({ safeplateId: 'SP-LG-2026000003', expiry: '2026-12-01' }),
  }
  for (const [name, fn] of Object.entries(cases)) {
    it(name + ' builds', () => {
      const r = buildOk(fn)
      if (!r.ok) console.log('BUILD ERROR in ' + name + ': ' + r.msg)
      expect(r.ok).toBe(true)
    })
  }
})
