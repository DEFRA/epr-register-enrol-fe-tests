import { randomInt } from 'node:crypto'

// Registration and accreditation numbers in the format the Re/Ex service
// issues, for approving a seeded organisation. Ported from
// epr-re-ex-journey-tests (test/support/reg-acc-number.js, materials.js).
//
// [1]     R=registration, A=accreditation
// [2-3]   relevant year
// [4]     nation E/W/S/N
// [5]     R=reprocessor, X=exporter
// [6-11]  6-digit org id
// [12-15] serial
// [16-17] material
// e.g. A26ER5000270063WO
//
// No two organisations may hold the same number, and an environment keeps the
// numbers of every earlier run, so the org id and serial are drawn at random.

// The form's material answer, and the suffix its numbers end in. Glass splits
// by recycling process.
export const MATERIAL_SUFFIXES = {
  'Aluminium (R4)': 'AL',
  'Fibre-based composite material (R3)': 'FB',
  'Glass (R5)': { 'Glass re-melt': 'GR', 'Glass other': 'GO' },
  'Paper or board (R3)': 'PA',
  'Plastic (R3)': 'PL',
  'Steel (R4)': 'ST',
  'Wood (R3)': 'WO'
}

export function materialSuffix(material, glassRecyclingProcess) {
  const suffix = MATERIAL_SUFFIXES[material]
  if (typeof suffix === 'string') {
    return suffix
  }
  if (suffix && suffix[glassRecyclingProcess]) {
    return suffix[glassRecyclingProcess]
  }
  throw new Error(
    `No number suffix for material "${material}"${glassRecyclingProcess ? ` (${glassRecyclingProcess})` : ''}`
  )
}

const PROCESSING_TYPE_LETTERS = {
  exporter: 'X',
  reprocessor: 'R'
}

const twoDigitYear = () => String(new Date().getUTCFullYear()).slice(-2)

const randomDigits = (length) =>
  String(randomInt(10 ** length)).padStart(length, '0')

function buildNumber(
  typeChar,
  { wasteProcessingType, materialSuffix: suffix, nation = 'E', orgId, serial }
) {
  const letter = PROCESSING_TYPE_LETTERS[wasteProcessingType]
  if (!letter) {
    throw new Error(
      `No registration number letter for the processing type "${wasteProcessingType}"`
    )
  }
  return `${typeChar}${twoDigitYear()}${nation}${letter}${orgId}${serial}${suffix}`
}

/**
 * A registration number and its accreditation number, sharing one org id and
 * serial.
 *
 * @param {{wasteProcessingType: 'reprocessor' | 'exporter', materialSuffix: string, nation?: string}} options
 * @returns {{regNumber: string, accNumber: string}}
 */
export function generateNumbers(options) {
  const shared = { orgId: randomDigits(6), serial: randomDigits(4), ...options }
  return {
    regNumber: buildNumber('R', shared),
    accNumber: buildNumber('A', shared)
  }
}
