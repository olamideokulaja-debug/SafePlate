// Shared chart primitives (Donut, Bars, Line, ChartCard). Extracted from
// App.jsx so every portal imports the same components. Kept loosely typed
// (any props) to preserve exact rendering; tighten later.
/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import { naira } from '../lib/constants.ts'

export function Donut({ data, size = 128, thick = 20, center, sub }) {
  const total = data.reduce((a, d) => a + d.value, 0) || 1
  const r = (size - thick) / 2, circ = 2 * Math.PI * r
  let off = 0
  return (
    <div className="chartrow">
      <svg width={size} height={size} viewBox={'0 0 ' + size + ' ' + size} className="donut">
        <g transform={'rotate(-90 ' + size / 2 + ' ' + size / 2 + ')'}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={thick} />
          {data.map((d, i) => { const len = (d.value / total) * circ; const seg = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.color} strokeWidth={thick} strokeDasharray={len + ' ' + (circ - len)} strokeDashoffset={-off} />; off += len; return seg })}
        </g>
        {center != null && <text x="50%" y="47%" textAnchor="middle" dominantBaseline="central" className="donutc">{center}</text>}
        {sub && <text x="50%" y="63%" textAnchor="middle" className="donuts">{sub}</text>}
      </svg>
      <div className="legend">{data.map((d, i) => <div key={i} className="legrow"><i style={{ background: d.color }} /><span>{d.label}</span><b>{d.display != null ? d.display : d.value}</b></div>)}</div>
    </div>
  )
}


export function Bars({ data, unit }) {
  const max = Math.max(1, ...data.map(d => d.value))
  return (
    <div className="bars">
      {data.map((d, i) => (
        <div key={i} className="barrow">
          <span className="barlabel">{d.label}</span>
          <span className="bartrack"><span className="barfill" style={{ width: (d.value / max * 100) + '%', background: d.color || 'var(--green)' }} /></span>
          <b className="barval">{unit === 'naira' ? naira(d.value) : d.value}</b>
        </div>
      ))}
    </div>
  )
}


export function Line({ series, labels }) {
  const w = 480, h = 170, pad = 34
  const max = Math.max(1, ...series)
  const xs = i => pad + i * (w - pad * 2) / (series.length - 1 || 1)
  const ys = v => h - pad - (v / max) * (h - pad * 2)
  const pts = series.map((v, i) => [xs(i), ys(v)])
  const path = pts.map((pt, i) => (i ? 'L' : 'M') + pt[0].toFixed(1) + ' ' + pt[1].toFixed(1)).join(' ')
  const areaPath = path + ' L ' + pts[pts.length - 1][0].toFixed(1) + ' ' + (h - pad) + ' L ' + pts[0][0].toFixed(1) + ' ' + (h - pad) + ' Z'
  return (
    <svg viewBox={'0 0 ' + w + ' ' + h} className="linechart" preserveAspectRatio="xMidYMid meet">
      <path d={areaPath} fill="var(--green-pale)" />
      <path d={path} fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinejoin="round" />
      {pts.map((pt, i) => <circle key={i} cx={pt[0]} cy={pt[1]} r="3.2" fill="#fff" stroke="var(--green)" strokeWidth="2" />)}
      {labels && labels.map((l, i) => <text key={i} x={xs(i)} y={h - 12} textAnchor="middle" className="axl">{l}</text>)}
    </svg>
  )
}


export function ChartCard({ title, hint, children }) {
  return <div className="chartcard"><div className="charttitle"><span>{title}</span>{hint && <span className="charthint">{hint}</span>}</div>{children}</div>
}

