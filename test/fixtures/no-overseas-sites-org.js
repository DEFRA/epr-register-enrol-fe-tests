import { seededRegistrationYear, yearSuffix } from './year-suffix.js'

// RA-697: org 50022 ("No Overseas Sites Exports Ltd", Plastic exporter), an
// Approved registration with no accreditation and no registered ORSs, for the
// overseas sites page's empty state (RA-814). Nothing writes to it. The
// backend (DevSeed/DevExporterOrg.cs) and the frontend
// (src/server/common/constants/test-orgs.js) define the same org: keep all
// three in step.

const ORGANISATION_ID = '50022'
export const ORGANISATION_NAME = 'No Overseas Sites Exports Ltd'
export const MATERIAL = 'Plastic'

const registrationNumber = (year) => `R${yearSuffix(year)}EX0500220001PL`

// RA-739: by registration number.
export const MANAGE_PATH = `/manage/${ORGANISATION_ID}/${registrationNumber(seededRegistrationYear())}/${MATERIAL}`
