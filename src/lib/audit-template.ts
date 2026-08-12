// HEFAMAA 42-criterion lab quality-audit template and outcome bands.
/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
export const LAB_QA_TEMPLATE = [
  {
    section: 'Legal status and licensing',
    items: [
      { id: 'L1', text: 'Current MLSCN licence for the facility, displayed and in date', critical: true },
      { id: 'L2', text: 'Corporate Affairs Commission registration certificate available' },
      { id: 'L3', text: 'HEFAMAA facility registration current for this premises', critical: true },
      { id: 'L4', text: 'Premises address matches the address on the registration' }
    ]
  },
  {
    section: 'Personnel',
    items: [
      { id: 'P1', text: 'A registered Medical Laboratory Scientist is in charge of the laboratory', critical: true },
      { id: 'P2', text: 'All scientific staff hold current practising licences' },
      { id: 'P3', text: 'Staffing is sufficient for the stated daily sample capacity' },
      { id: 'P4', text: 'Records of staff induction and continuing training are kept' },
      { id: 'P5', text: 'Staff handling samples are vaccinated against Hepatitis B' }
    ]
  },
  {
    section: 'Premises and infrastructure',
    items: [
      { id: 'I1', text: 'Separate, clearly identified sample reception area' },
      { id: 'I2', text: 'Work surfaces are non-porous, intact and disinfected between runs' },
      { id: 'I3', text: 'Reliable power supply with backup for refrigeration' },
      { id: 'I4', text: 'Running water and handwashing facilities in the working area', critical: true },
      { id: 'I5', text: 'Adequate lighting and ventilation in the testing area' },
      { id: 'I6', text: 'Clean and dirty zones are physically separated' }
    ]
  },
  {
    section: 'Equipment and reagents',
    items: [
      { id: 'E1', text: 'Microscope, centrifuge and analyser present and in working order', critical: true },
      { id: 'E2', text: 'Documented calibration and servicing schedule, up to date' },
      { id: 'E3', text: 'Refrigerator and freezer temperatures logged daily and within range' },
      { id: 'E4', text: 'All reagents in date, correctly stored, with lot numbers recorded', critical: true },
      { id: 'E5', text: 'Autoclave or validated alternative available and functioning' },
      { id: 'E6', text: 'Backup arrangements documented for equipment failure' }
    ]
  },
  {
    section: 'Quality management',
    items: [
      { id: 'Q1', text: 'Written standard operating procedures for every test offered', critical: true },
      { id: 'Q2', text: 'Internal quality control run at documented frequency, results retained' },
      { id: 'Q3', text: 'Enrolled in an external quality assessment or proficiency scheme', critical: true },
      { id: 'Q4', text: 'Corrective action recorded whenever quality control fails' },
      { id: 'Q5', text: 'Documented criteria for rejecting an unusable sample' },
      { id: 'Q6', text: 'Results reviewed and authorised by a qualified scientist before release' }
    ]
  },
  {
    section: 'Sample handling and turnaround',
    items: [
      { id: 'S1', text: 'Unique sample identification from receipt to result, no reuse of IDs', critical: true },
      { id: 'S2', text: 'Chain of custody documented from collection to testing' },
      { id: 'S3', text: 'Samples stored at the correct temperature before analysis' },
      { id: 'S4', text: 'Turnaround time monitored against the 48-hour SafePlate standard' },
      { id: 'S5', text: 'SafePlate IDs recorded against every sample received' }
    ]
  },
  {
    section: 'Biosafety and waste',
    items: [
      { id: 'B1', text: 'Personal protective equipment available and worn in the working area', critical: true },
      { id: 'B2', text: 'Sharps containers in use and not overfilled' },
      { id: 'B3', text: 'Spill kit available and staff trained in its use' },
      { id: 'B4', text: 'Contract with a licensed medical waste handler, current', critical: true },
      { id: 'B5', text: 'Segregated waste bins, correctly labelled' },
      { id: 'B6', text: 'Incident and exposure log maintained' }
    ]
  },
  {
    section: 'Records and confidentiality',
    items: [
      { id: 'R1', text: 'Results archived and retrievable for the required retention period' },
      { id: 'R2', text: 'Patient data held securely and access restricted to authorised staff', critical: true },
      { id: 'R3', text: 'Laboratory register complete, legible and current' },
      { id: 'R4', text: 'Complaints and their resolution recorded' }
    ]
  }
]


export const QA_OUTCOMES = [
  { min: 85, outcome: 'Accredited', months: 24, tone: 'ok', note: 'Full accreditation for 24 months.' },
  { min: 70, outcome: 'Provisional', months: 6, tone: 'warn', note: 'Provisional accreditation for 6 months, re-audit required.' },
  { min: 0, outcome: 'Not accredited', months: 0, tone: 'no', note: 'Below the accreditation threshold. The laboratory may not receive SafePlate samples.' }
]

