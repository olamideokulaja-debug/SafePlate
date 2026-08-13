// @ts-nocheck
// Shared helpers extracted from App.jsx so the lazy-loaded portal chunks can use
// them without "X is not defined" ReferenceErrors. Consolidated during the deep
// QA pass (2026-08-13).
import { jsPDF } from 'jspdf'
import { CHART, AUDIT_CATS, naira, FEE, WATER_FEE, WATERFALL, WATER_WATERFALL } from './constants.ts'
import { LAB_QA_TEMPLATE, QA_OUTCOMES } from './audit-template.ts'

export function makeSafeplateId() {
  const year = new Date().getFullYear()
  const seq = String(Math.floor(1000 + Math.random() * 8999)) + String(Math.floor(10 + Math.random() * 89))
  return ('SP-LG-' + year + seq).slice(0, 16)
}

export function statusKey(s) {
  if (s === 'Scheduled') return 'Scheduled'
  if (s === 'Sample Collected') return 'Sample'
  if (s === 'Testing in Progress') return 'Testing'
  if (s === 'Submitted') return 'Submitted'
  return 'Flag'
}

export function journeyStep(order, cert) {
  if (cert && cert.status === 'VALID') return 6
  const st = (order && order.status) || ''
  if (/Rejected|Flagged/.test(st)) return 5
  if (st === 'Submitted') return 5
  if (/Approved/.test(st)) return 6
  if (/Scheduled|Sample|Testing/.test(st)) return 4
  return 3
}

export const smatch = (q, ...fields) => { const ql = (q || '').trim().toLowerCase(); return !ql || fields.filter(Boolean).join(' ').toLowerCase().includes(ql) }

export function timeAgo(ts) { const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000); if (m < 1) return 'just now'; if (m < 60) return m + 'm ago'; const h = Math.floor(m / 60); if (h < 24) return h + 'h ago'; return Math.floor(h / 24) + 'd ago' }

export function qaGrade(answers) {
  const all = LAB_QA_TEMPLATE.flatMap(s => s.items)
  const applicable = all.filter(i => (answers[i.id] || 'unanswered') !== 'na')
  const answered = applicable.filter(i => ['met', 'not'].includes(answers[i.id]))
  const met = applicable.filter(i => answers[i.id] === 'met')
  const criticalFailures = all.filter(i => i.critical && answers[i.id] === 'not')
  const score = applicable.length ? Math.round((met.length / applicable.length) * 100) : 0
  let band = QA_OUTCOMES.find(o => score >= o.min) || QA_OUTCOMES[QA_OUTCOMES.length - 1]
  if (criticalFailures.length) band = { ...QA_OUTCOMES[QA_OUTCOMES.length - 1], note: 'A critical requirement was not met, so the audit fails regardless of the overall score.' }
  return { score, met: met.length, applicable: applicable.length, answered: answered.length, total: all.length, criticalFailures, band, complete: answered.length === applicable.length }
}

export function auditCat(a) {
  const str = (a || '').toLowerCase()
  for (const name in AUDIT_CATS) if (AUDIT_CATS[name].re.test(str)) return { cat: name, color: AUDIT_CATS[name].color, icon: AUDIT_CATS[name].icon }
  return { cat: 'Other', color: CHART[6], icon: 'audit' }
}

export const auditCatColor = name => (AUDIT_CATS[name] && AUDIT_CATS[name].color) || CHART[6]

export function generateReceiptPDF(rec) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth(), M = 60
  let y = 58
  const legs = rec.type === 'WATER' ? WATER_WATERFALL : WATERFALL
  const amount = rec.amount || (rec.type === 'WATER' ? WATER_FEE : FEE)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(0, 102, 0)
  doc.text('SAFEPLATE', M, y)
  doc.setFontSize(10); doc.setTextColor(90, 90, 90); doc.setFont('helvetica', 'normal')
  doc.text('Lagos State food and water safety programme', M, y + 15)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(0, 51, 102)
  doc.text('PAYMENT RECEIPT', W - M, y, { align: 'right' })
  y += 40
  doc.setDrawColor(0, 102, 0); doc.setLineWidth(1.2); doc.line(M, y, W - M, y); y += 26
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(40, 40, 40)
  const row = (k, v) => { doc.setTextColor(110, 110, 110); doc.text(k, M, y); doc.setTextColor(20, 20, 20); doc.setFont('helvetica', 'bold'); doc.text(String(v || 'Not recorded'), M + 165, y); doc.setFont('helvetica', 'normal'); y += 19 }
  row('Receipt reference', rec.reference)
  row('SAFEPLATE ID', rec.safeplateId)
  row('Paid by', rec.name)
  row('Laboratory', rec.lab)
  row('Date', rec.paidAt ? new Date(rec.paidAt).toLocaleString('en-GB') : new Date().toLocaleString('en-GB'))
  row('Amount paid', naira(amount))
  row('Status', 'Received, held in escrow')
  y += 12
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(0, 51, 102)
  doc.text('How this fee is distributed', M, y); y += 8
  doc.setDrawColor(220, 220, 220); doc.line(M, y, W - M, y); y += 18
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(40, 40, 40)
  legs.forEach(w => {
    doc.setTextColor(70, 70, 70); doc.text(w.who + ' (' + w.pct + '%)', M, y)
    doc.setTextColor(20, 20, 20); doc.text(naira(w.amount), W - M, y, { align: 'right' }); y += 17
  })
  doc.setDrawColor(220, 220, 220); doc.line(M, y - 4, W - M, y - 4); y += 12
  doc.setFont('helvetica', 'bold'); doc.text('Total', M, y); doc.text(naira(amount), W - M, y, { align: 'right' })
  y += 34
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110, 110, 110)
  doc.text('Funds are held in escrow by Sterling Bank and released only after the Ministry approves the result.', M, y); y += 12
  doc.text('This receipt is system-generated and recorded in the SafePlate audit trail.', M, y)
  doc.save('SafePlate-Receipt-' + (rec.safeplateId || 'payment') + '.pdf')
}

export function generateEnforcementLetter(est, session) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth(), M = 64
  let y = 56
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const ref = 'LASEPA/ENF/' + new Date().getFullYear() + '/' + String(Math.floor(1000 + Math.random() * 8999))
  doc.setFont('times', 'bold'); doc.setFontSize(15); doc.setTextColor(0, 51, 0)
  doc.text('LAGOS STATE ENVIRONMENTAL PROTECTION AGENCY', W / 2, y, { align: 'center' }); y += 18
  doc.setFontSize(10.5); doc.setTextColor(90, 90, 90)
  doc.text('Food & Water Safety Enforcement Directorate  ·  SafePlate Initiative', W / 2, y, { align: 'center' }); y += 26
  doc.setDrawColor(0, 102, 0); doc.setLineWidth(1.4); doc.line(M, y, W - M, y); y += 28
  doc.setFont('times', 'normal'); doc.setFontSize(10.5); doc.setTextColor(40, 40, 40)
  doc.text('Ref: ' + ref, M, y); doc.text(today, W - M, y, { align: 'right' }); y += 26
  doc.setFont('times', 'bold'); doc.text('The Proprietor / Manager', M, y); y += 15
  doc.setFont('times', 'normal'); doc.text(est.name || 'Establishment', M, y); y += 14
  if (est.lga) { doc.text(est.lga + ' LGA, Lagos State', M, y); y += 14 }
  y += 14
  doc.setFont('times', 'bold'); doc.setFontSize(11.5)
  const subj = 'RE: ENFORCEMENT NOTICE, ' + String(est.sanction || 'Compliance action').toUpperCase()
  doc.text(subj, M, y); y += 22
  doc.setFont('times', 'normal'); doc.setFontSize(10.8)
  const body = [
    'Following inspection and review of your establishment under the SafePlate food and water safety programme, deficiencies were identified that place your establishment in breach of the required food and water safety standards.',
    '',
    'Accordingly, the Agency hereby issues the following enforcement action: ' + (est.sanction || 'a formal warning') + '. This action is taken pursuant to the NAFDAC Food Hygiene Regulations 2019 and applicable Lagos State food and public-health law.',
    '',
    'You are required to take immediate corrective steps to bring your establishment into full compliance, including ensuring that all food handlers hold a valid Certificate of Fitness verifiable on the SafePlate platform, and that potable-water sources are tested and certified.',
    '',
    'Where a fine, closure or licence action applies, it takes effect on the date of this notice unless a valid appeal is lodged. You have the right to appeal this decision within fourteen (14) days through the SafePlate platform, where the matter will be reviewed by the appropriate authority.',
    '',
    'Continued non-compliance may result in escalation along the enforcement ladder up to and including temporary closure and loss of operating licence.'
  ]
  body.forEach(para => {
    if (para === '') { y += 8; return }
    const lines = doc.splitTextToSize(para, W - 2 * M)
    lines.forEach(ln => { if (y > 740) { doc.addPage(); y = 64 } doc.text(ln, M, y); y += 15 })
  })
  y += 20
  doc.text('Issued for and on behalf of the Agency,', M, y); y += 34
  doc.setFont('times', 'bold'); doc.text(session && session.name ? session.name : 'Authorised Officer', M, y); y += 14
  doc.setFont('times', 'normal'); doc.setFontSize(9.5); doc.setTextColor(90, 90, 90)
  doc.text('LASEPA Enforcement Officer  ·  SafePlate', M, y); y += 12
  doc.text('This notice is system-generated and logged in the SafePlate audit trail. Ref ' + ref + '.', M, y)
  doc.save('SafePlate-Enforcement-Notice-' + (est.name || 'establishment').replace(/[^A-Za-z0-9]+/g, '-') + '.pdf')
}

export function generateQaReportPDF(rec, lab) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth(), M = 54
  let y = 56
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(0, 51, 0)
  doc.text('HEFAMAA LABORATORY ACCREDITATION AUDIT', W / 2, y, { align: 'center' }); y += 17
  doc.setFontSize(10); doc.setTextColor(90, 90, 90); doc.setFont('helvetica', 'normal')
  doc.text('Health Facility Monitoring and Accreditation Agency  ·  SafePlate', W / 2, y, { align: 'center' }); y += 24
  doc.setDrawColor(0, 102, 0); doc.setLineWidth(1.3); doc.line(M, y, W - M, y); y += 24
  doc.setFontSize(10.5); doc.setTextColor(40, 40, 40)
  const row = (k, v) => { doc.setTextColor(110, 110, 110); doc.text(k, M, y); doc.setTextColor(20, 20, 20); doc.setFont('helvetica', 'bold'); doc.text(String(v), M + 150, y); doc.setFont('helvetica', 'normal'); y += 17 }
  row('Laboratory', lab.name)
  row('Area', lab.area || lab.lga || 'Not recorded')
  row('Audit reference', rec.id)
  row('Auditor', rec.auditor)
  row('Date', new Date(rec.ts).toLocaleString('en-GB'))
  row('Score', rec.score + '% (' + rec.met + ' of ' + rec.applicable + ' applicable criteria met)')
  row('Outcome', rec.outcome)
  if ((rec.criticalFailures || []).length) row('Critical failures', String(rec.criticalFailures.length))
  y += 10
  LAB_QA_TEMPLATE.forEach(sec => {
    if (y > 720) { doc.addPage(); y = 60 }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(0, 51, 102)
    doc.text(sec.section, M, y); y += 6
    doc.setDrawColor(225, 225, 225); doc.line(M, y, W - M, y); y += 14
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5)
    sec.items.forEach(it => {
      if (y > 760) { doc.addPage(); y = 60 }
      const a = (rec.answers || {})[it.id] || 'unanswered'
      const label = a === 'met' ? 'Met' : a === 'not' ? 'NOT MET' : a === 'na' ? 'N/A' : 'Not answered'
      if (a === 'not') doc.setTextColor(179, 38, 30); else if (a === 'met') doc.setTextColor(10, 107, 57); else doc.setTextColor(120, 120, 120)
      doc.text(label, W - M, y, { align: 'right' })
      doc.setTextColor(40, 40, 40)
      const lines = doc.splitTextToSize((it.critical ? '[critical] ' : '') + it.text, W - 2 * M - 70)
      lines.forEach((ln, i) => { doc.text(ln, M, y + i * 12) })
      y += Math.max(14, lines.length * 12 + 2)
    })
    y += 8
  })
  if (rec.note) {
    if (y > 700) { doc.addPage(); y = 60 }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(0, 51, 102); doc.text('Auditor notes', M, y); y += 14
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(40, 40, 40)
    doc.splitTextToSize(rec.note, W - 2 * M).forEach(ln => { if (y > 780) { doc.addPage(); y = 60 } doc.text(ln, M, y); y += 12 })
  }
  doc.save('HEFAMAA-QA-Audit-' + (lab.name || 'laboratory').replace(/[^A-Za-z0-9]+/g, '-') + '.pdf')
}
