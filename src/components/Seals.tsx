// Government seal / cross-seal marks. Pure presentational.
// @ts-nocheck
export function Seal({ size = 104 }) {
  return (
    <svg className="seal" width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r="56" fill="#fff" stroke="var(--green)" strokeWidth="2.5" />
      <circle cx="60" cy="60" r="49" fill="none" stroke="var(--gold)" strokeWidth="2" strokeDasharray="3 5" />
      <circle cx="60" cy="60" r="37" fill="var(--green)" />
      <path d="M45 60 l10 10 l21 -23" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <text x="60" y="105" textAnchor="middle" fontSize="8" fontWeight="700" fill="var(--green)" letterSpacing="1.5">LAGOS STATE</text>
    </svg>
  )
}


export function CrossSeal({ size = 104 }) {
  return (
    <svg className="seal" width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r="54" fill="#fff" stroke="#b3261e" strokeWidth="3" />
      <path d="M44 44 l32 32 M76 44 l-32 32" stroke="#b3261e" strokeWidth="6.5" strokeLinecap="round" />
    </svg>
  )
}

