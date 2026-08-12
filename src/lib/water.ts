// Potable-water domain helpers: constants, ID/series generation, quality checks.
/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
export const WATER_FUND = 6500
export const WATER_SOURCES = ['Borehole', 'Sachet water production', 'Well water', 'Piped supply']
export function makeWaterId() { const y = new Date().getFullYear(); const seq = String(Math.floor(10000 + Math.random() * 89999)); return ('SP-W-LG-' + y + seq).slice(0, 17) }
export function makeWaterCertSeries() { const y = new Date().getFullYear(); return 'SP-W-CERT-' + y + '-' + String(Math.floor(100000 + Math.random() * 899999)) }
export function waterChecks(r) {
  const ph = parseFloat(r.ph), turb = parseFloat(r.turbidity), ec = parseFloat(r.ecoli)
  return [
    { k: 'pH', v: r.ph, ok: ph >= 6.5 && ph <= 8.5, bench: '6.5 to 8.5' },
    { k: 'Turbidity', v: r.turbidity, ok: turb < 5, bench: 'under 5 NTU' },
    { k: 'E. coli', v: r.ecoli, ok: ec === 0, bench: '0 CFU/100ml' }
  ]
}

