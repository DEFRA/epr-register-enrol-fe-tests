import { seededRegistrationYear, yearSuffix } from './year-suffix.js'

// RA-697: org 50020 ("No Change Requests Ltd", Plastic exporter), an Approved
// current-year accreditation with no in-year change requests, for the change
// request pages' empty states. No spec may write change requests to it. The
// backend (DevSeed/DevExporterOrg.cs) and the frontend
// (src/server/common/constants/test-orgs.js) define the same org: keep all
// three in step.

const ORGANISATION_ID = '50020'
export const ORGANISATION_NAME = 'No Change Requests Ltd'
export const MATERIAL = 'Plastic'

const registrationNumber = (year) => `R${yearSuffix(year)}EX0500200001PL`

// RA-739: by registration number.
export const MANAGE_PATH = `/manage/${ORGANISATION_ID}/${registrationNumber(seededRegistrationYear())}/${MATERIAL}`

export const accreditationNumber = (year) =>
  `A${yearSuffix(year)}EX0500200001PL`
