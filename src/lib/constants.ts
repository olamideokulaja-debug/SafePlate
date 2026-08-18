// Shared domain constants and small validators.
//
// Extracted as a leaf module so both the data layer (store.ts) and the UI can
// import a single source of truth. Nothing here depends on any other app module,
// which is what makes it safe to extract first in the bottom-up refactor.

export const NDPA_CONSENT_VERSION = 'NDPA-2026-v1'

export const MANDATORY_TESTS: string[] = [
  'Hepatitis A',
  'Hepatitis E',
  'Stool Microscopy & Culture (MC)',
]

export const LAGOS_LGAS: string[] = [
  'Agege', 'Ajeromi-Ifelodun', 'Alimosho', 'Amuwo-Odofin', 'Apapa', 'Badagry',
  'Epe', 'Eti-Osa', 'Ibeju-Lekki', 'Ifako-Ijaiye', 'Ikeja', 'Ikorodu', 'Kosofe',
  'Lagos Island', 'Lagos Mainland', 'Mushin', 'Ojo', 'Oshodi-Isolo', 'Shomolu',
  'Surulere',
]

export const FEE = 15000
export const WATER_FEE = 65000

export const isValidEmail = (v: unknown): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim())

export const isValidPhone = (v: unknown): boolean =>
  /^0\d{10}$/.test(String(v || '').replace(/\s+/g, ''))

export interface Lab {
  id: string; name: string; area: string; turnaround?: string;
  accredited: boolean; mobile?: boolean; accNo?: string | null;
  availability?: any; status?: string;
}
export const LABS: Lab[] = [
  { id: 'lancet-ikeja', name: 'Lancet Ikeja', area: 'Ikeja', turnaround: '48 hours', accredited: true, mobile: true, accNo: 'HEF-LAB-0142' },
  { id: 'synlab-vi', name: 'Synlab Victoria Island', area: 'Victoria Island', turnaround: '24 hours', accredited: true, mobile: true, accNo: 'HEF-LAB-0088' },
  { id: 'clinix-surulere', name: 'Clinix Surulere', area: 'Surulere', turnaround: '72 hours', accredited: true, mobile: false, accNo: 'HEF-LAB-0210' },
  { id: 'medbury-yaba', name: 'Medbury Yaba', area: 'Yaba', turnaround: '48 hours', accredited: true, mobile: true, accNo: 'HEF-LAB-0175' },
  { id: 'zaine-lekki', name: 'Zaine Diagnostics Lekki', area: 'Lekki', turnaround: '36 hours', accredited: false, mobile: false, accNo: null }
]

export interface WaterfallRow { who: string; pct: number; amount: number }
export const WATERFALL: WaterfallRow[] = [
  { who: 'Private Lab, execution', pct: 76.5, amount: 11475 },
  { who: 'LSMoH, oversight & regulation', pct: 10, amount: 1500 },
  { who: 'Technology partner', pct: 5, amount: 750 },
  { who: 'Financial Partner (Sterling Bank)', pct: 5, amount: 750 },
  { who: 'LASEPA, enforcement', pct: 3.5, amount: 525 }
]
export const WATER_WATERFALL: WaterfallRow[] = [
  { who: 'LASEPA, enforcement & execution', pct: 80, amount: 52000 },
  { who: 'LSMoH, regulation', pct: 10, amount: 6500 },
  { who: 'Technology partner', pct: 5, amount: 3250 },
  { who: 'Financial Partner (Sterling Bank)', pct: 5, amount: 3250 }
]
export const CHART: string[] = ['#006600', '#FBAE40', '#003366', '#0891b2', '#b3261e', '#7c3aed', '#0f766e']
export const naira = (n: number | string): string => '\u20A6' + Number(n).toLocaleString('en-NG')
export const otp6 = (v: unknown): boolean => /^[0-9]{6}$/.test(String(v))
export const FUND_PER_TXN = 1500

export const WEEKDAYS: string[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const DEFAULT_SLOTS: string[] = ['08:00 to 10:00', '10:00 to 12:00', '12:00 to 14:00', '14:00 to 16:00']

export const PALETTE = { green: '#006600', gold: '#FBAE40', navy: '#003366', white: '#FFFFFF' }

export const STAFF_STATUSES: Record<string,string> = { 'Certified': 'ok', 'Pending results': 'no', 'Overdue': 'no', 'Not registered': 'no' }

export const SANCTION_LADDER: string[] = ['Warning', 'Fine', 'Temporary closure', 'Loss of operating licence']
export const SANCTION_SEVERE: string[] = ['Fine', 'Temporary closure', 'Loss of operating licence']
export const MINI = { padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 9, fontFamily: 'inherit', fontSize: 14, flex: '1 1 130px', minWidth: 110, background: '#fff' }

export const METRICS = [
  { k: 'Statewide compliance', v: '89.4%' },
  { k: 'Active certificates', v: '14,892' },
  { k: 'Non-compliant handlers', v: '1,764' },
  { k: 'Fees collected', v: '\u20A6223M' }
]


// AUDIT_CATS uses CHART (imported at top of consumers); kept here as data.
export const AUDIT_CATS = {
  'Approval': { color: CHART[0], icon: 'review', re: /approv|issued|certified/ },
  'Flag / reject': { color: CHART[4], icon: 'enforcement', re: /flag|reject|refer|quarant|non-compl/ },
  'Escrow': { color: CHART[3], icon: 'fund', re: /releas|disburse|escrow|fund/ },
  'Revocation': { color: '#b3261e', icon: 'certificates', re: /revok/ },
  'Regulatory': { color: CHART[2], icon: 'accreditation', re: /accredit|enforce|sanction|water/ },
  'Access': { color: CHART[5], icon: 'verify', re: /sign|verif|decrypt|view|scan|login|attempt/ }
}


// Food handler registration wizard step labels (used by FoodHandlerPortal).
export const STEP_LABELS = ['Register', 'Tests', 'Laboratory', 'Payment', 'Done']

// Shared status helpers (used across portals and Insights). Moved out of App.jsx
// so the lazy-loaded portal chunks can reference them without a ReferenceError.
export function slaExceeded(order: any): boolean {
  const t = order.submittedAt || order.createdAt
  return t ? (Date.now() - new Date(t).getTime()) / 3600000 > 48 : false
}

// Ministry-review SLA: target time for LSMoH to approve or flag a submitted result.
// Distinct from the 48h LAB turnaround. Measured from submission.
export const MINISTRY_SLA_HOURS = 72
export function reviewHoursLeft(order: any): number | null {
  const t = order.submittedAt || order.submitted_at
  if (!t) return null
  const elapsed = (Date.now() - new Date(t).getTime()) / 3600000
  return MINISTRY_SLA_HOURS - elapsed
}
export function reviewOverdue(order: any): boolean {
  const left = reviewHoursLeft(order)
  return left != null && left < 0
}
export const statusColor = (s: string): string => /Approved|Certified|Released/.test(s) ? CHART[0] : /Flag|Reject|Overdue|Quarant/.test(s) ? CHART[4] : /Submitted|Pending|Testing/.test(s) ? CHART[1] : CHART[2]
