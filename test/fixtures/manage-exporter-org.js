// Org 50018 ("Manage Accreditation Test Ltd", Plastic exporter), which exists
// only for ra-425-view-ors-and-interim-sites.e2e.js.
// The backend dev seed (epr-register-enrol-backend DevExporterAccreditationSeedService) and the frontend stub (stub-manage-accreditations.js) define the same org.

export const ORGANISATION_ID = '50018'
export const ORGANISATION_NAME = 'Manage Accreditation Test Ltd'
export const REGISTRATION_ID = 'aaa000000000000000050018'
export const MATERIAL = 'Plastic'

// The material dashboard, as linked from the operator page.
export const DASHBOARD_PATH = `/manage/${ORGANISATION_ID}/${REGISTRATION_ID}/${MATERIAL}`

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
  antwerpForBharat: 901808
}

// The seed numbers the registration and accreditation for the year it was
// seeded in, e.g. R26EX0500180001PL for 2026.
const yearSuffix = (year) => String(year).slice(-2)

export const registrationNumber = (year) => `R${yearSuffix(year)}EX0500180001PL`

export const accreditationNumber = (year) =>
  `A${yearSuffix(year)}EX0500180001PL`
