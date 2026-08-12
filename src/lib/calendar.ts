// Calendar (.ics) generation for certificate expiry and renewal reminders.
// No external provider: an .ics file is plain text the person's calendar app
// imports directly. Helps handlers renew before their certificate lapses.
// @ts-nocheck

function pad(n: number) { return String(n).padStart(2, '0') }

// All-day date stamp in the local calendar's floating form (YYYYMMDD).
function icsDate(d: Date) {
  return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate())
}

function icsStamp(d: Date) {
  return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z'
}

function esc(s: string) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

// Build an .ics with the certificate expiry as an all-day event plus a reminder
// two weeks before, so the person is nudged in time to renew.
export function certReminderIcs(cert: any): string {
  const id = cert.safeplateId || cert.safeplate_id || 'SP'
  const expiry = new Date(cert.expiry || cert.expiry_date)
  const remind = new Date(expiry.getTime() - 14 * 86400000)
  const now = new Date()
  const uid = 'safeplate-' + id + '-' + expiry.getTime() + '@safeplate.lagosstate.gov.ng'
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SafePlate//Certificate Reminder//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:' + uid,
    'DTSTAMP:' + icsStamp(now),
    'DTSTART;VALUE=DATE:' + icsDate(expiry),
    'DTEND;VALUE=DATE:' + icsDate(new Date(expiry.getTime() + 86400000)),
    'SUMMARY:' + esc('SafePlate certificate expires (' + id + ')'),
    'DESCRIPTION:' + esc('Your food handler Certificate of Fitness expires today. Renew at SafePlate to stay certified. Renewal repeats the full test panel.'),
    'BEGIN:VALARM',
    'TRIGGER;VALUE=DATE-TIME:' + icsStamp(new Date(remind.getTime())),
    'ACTION:DISPLAY',
    'DESCRIPTION:' + esc('Your SafePlate certificate expires in two weeks. Book your renewal test now.'),
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.join('\r\n')
}

// Trigger a download of the .ics for the given certificate.
export function downloadCertReminder(cert: any) {
  const ics = certReminderIcs(cert)
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'safeplate-renewal-reminder.ics'
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
