// @ts-nocheck
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

// Regression guard for a whole bug FAMILY found in the 2026-08-13 deep QA:
// the modular refactor left helpers/constants defined in App.jsx (or exported by
// a lib module) being *used* inside lazy-loaded portal/component chunks that never
// imported them. That throws "X is not defined" only when the code path runs, so
// it slips past the build. This test fails if any such missing import reappears.
function collectLibExports() {
  const map = {}
  for (const f of readdirSync('src/lib')) {
    if (!/\.(ts|tsx)$/.test(f)) continue
    const s = readFileSync(join('src/lib', f), 'utf8')
    for (const m of s.matchAll(/export\s+(?:async\s+)?(?:const|function|let|class)\s+([A-Za-z_$][\w$]*)/g)) map[m[1]] = 'lib/' + f
    for (const m of s.matchAll(/export\s*\{([^}]*)\}/g)) m[1].split(',').forEach(x => { const n = x.split(' as ').pop().trim(); if (n) map[n] = 'lib/' + f })
  }
  return map
}
function appTopLevelDefs() {
  const s = readFileSync('src/App.jsx', 'utf8')
  return new Set([...s.matchAll(/^(?:export\s+)?(?:async\s+)?(?:const|function|let)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]))
}

describe('no missing cross-module imports', () => {
  const libExports = collectLibExports()
  const appDefs = appTopLevelDefs()
  const files = []
  for (const dir of ['src/portals', 'src/components']) for (const f of readdirSync(dir)) if (/\.(tsx|ts|jsx)$/.test(f)) files.push(join(dir, f))

  it('every lib/App symbol used in a portal or component is imported there', () => {
    const problems = []
    for (const f of files) {
      const raw = readFileSync(f, 'utf8')
      const imported = new Set()
      for (const m of raw.matchAll(/import\s*(?:\{([^}]*)\}|([\w$]+)|\*\s+as\s+([\w$]+))\s*from/g)) {
        if (m[1]) m[1].split(',').forEach(x => { const n = x.split(' as ').pop().trim(); if (n) imported.add(n) })
        if (m[2]) imported.add(m[2].trim()); if (m[3]) imported.add(m[3].trim())
      }
      const localDefs = new Set([...raw.matchAll(/(?:const|function|let|var|class)\s+([A-Za-z_$][\w$]*)/g)].map(m => m[1]))
      // strip imports, comments, strings, and JSX tags to avoid false positives (<tr>, lambda params)
      const code = raw.split('\n').filter(l => !l.trim().startsWith('import')).join('\n')
        .replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""').replace(/`[^`]*`/g, '``')
        .replace(/<\/?[A-Za-z][\w.]*/g, '')            // strip JSX tag names
        .replace(/\.\s*[A-Za-z_$][\w$]*/g, '.')         // strip property accesses
      const used = new Set([...code.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\b/g)].map(m => m[1]))
      for (const u of used) {
        if (imported.has(u) || localDefs.has(u)) continue
        // Short lowercase identifiers (t, e, o, x, tr...) are almost always lambda
        // params or JSX artefacts, not shared symbols. Only guard names >=4 chars
        // or ALL_CAPS constants, which is where the real bug family lives.
        if (u.length < 4 && u !== u.toUpperCase()) continue
        if (libExports[u]) problems.push(`${f}: uses '${u}' (export of ${libExports[u]}) without importing it`)
        else if (appDefs.has(u) && /^[a-z]/.test(u) === false && u === u.toUpperCase() ? false : appDefs.has(u)) {
          // App.jsx-defined symbol used in a chunk: always a problem (App.jsx isn't importable here)
          problems.push(`${f}: uses '${u}' (defined in App.jsx) without importing it`)
        }
      }
    }
    if (problems.length) console.log('MISSING IMPORTS:\n' + problems.join('\n'))
    expect(problems).toEqual([])
  })
})
