// Shared search input. Extracted leaf UI component.
// @ts-nocheck
export function SearchBar({ value, onChange, placeholder, hint }) {
  return (
    <div className="audsearch" style={{ maxWidth: 460 }}>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || 'Search...'} aria-label={placeholder || 'Search'} />
      {hint && <div className="muted" style={{ fontSize: 12, marginTop: 5 }}>{hint}</div>}
    </div>
  )
}

export default SearchBar
