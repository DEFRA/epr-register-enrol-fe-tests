// RA-697: org 50021 ("Registration Only Exports Ltd", Plastic exporter), an
// Approved registration with no accreditation in any year, for the
// registration-only manage pages. The backend (DevSeed/DevExporterOrg.cs) and
// the frontend (src/server/common/constants/test-orgs.js) define the same
// org: keep all three in step.

const ORGANISATION_ID = '50021'
export const ORGANISATION_NAME = 'Registration Only Exports Ltd'
const REGISTRATION_ID = 'aaa000000000000000050021'
export const MATERIAL = 'Plastic'

export const MANAGE_PATH = `/manage/${ORGANISATION_ID}/${REGISTRATION_ID}/${MATERIAL}`

const yearSuffix = (year) => String(year).slice(-2)

export const registrationNumber = (year) => `R${yearSuffix(year)}EX0500210001PL`
