// Org 50018 ("Manage Accreditation Test Ltd", Plastic exporter and, since
// RA-697, Glass reprocessor), which exists only for
// ra-425-view-ors-and-interim-sites.e2e.js and RA-697's read-only specs. The
// backend's dev seed also gives both accreditations change requests
// (DevChangeRequestSeedService); the RA-425 spec doesn't assert on them.
// The backend (DevSeed/DevExporterOrg.cs) and the frontend
// (src/server/common/constants/test-orgs.js) define the same org: keep all
// three in step.

const ORGANISATION_ID = '50018'
export const ORGANISATION_NAME = 'Manage Accreditation Test Ltd'
const REGISTRATION_ID = 'aaa000000000000000050018'
export const MATERIAL = 'Plastic'

// The manage registration and accreditation page, which Re/Ex and the
// operator page link to.
export const MANAGE_PATH = `/manage/${ORGANISATION_ID}/${REGISTRATION_ID}/${MATERIAL}`

// The Re/Ex material page the manage pages lead back to. The Re/Ex base URL
// differs by environment, so match on the end of the href.
export const REEX_REGISTRATION_PATH = `/organisations/${ORGANISATION_ID}/registrations/${REGISTRATION_ID}`

// Site ids of the seeded overseas reprocessing sites (ORSs).
export const ORS = {
  rotterdam: 901801,
  bharat: 901805,
  berlin: 901806,
  dragon: 901807
}

// Site ids of the seeded interim sites.
export const INTERIM = {
  calais: 901802,
  antwerpForRotterdam: 901803,
  oldDepot: 901804,
  antwerpForBharat: 901808,
  // On the registered-only Dragon ORS: the page must never show it.
  saigonForDragon: 901809
}

// The seed numbers the registration and accreditation for the year it was
// seeded in, e.g. R26EX0500180001PL for 2026.
const yearSuffix = (year) => String(year).slice(-2)

export const registrationNumber = (year) => `R${yearSuffix(year)}EX0500180001PL`

export const accreditationNumber = (year) =>
  `A${yearSuffix(year)}EX0500180001PL`

// RA-697: the org's Glass (remelt) reprocessor registration and accreditation.
const REPROCESSOR_REGISTRATION_ID = 'bbb000000000000000050018'
export const REPROCESSOR_MATERIAL = 'Glass'
// The manage page's caption names the glass recycling process.
export const REPROCESSOR_CAPTION_MATERIAL = 'Glass - Remelt'
export const REPROCESSOR_MANAGE_PATH = `/manage/${ORGANISATION_ID}/${REPROCESSOR_REGISTRATION_ID}/${REPROCESSOR_MATERIAL}`

export const reprocessorRegistrationNumber = (year) =>
  `R${yearSuffix(year)}ER0500180002GR`

export const reprocessorAccreditationNumber = (year) =>
  `A${yearSuffix(year)}ER0500180002GR`
