// Org 50019 ("In-Year Change Exports Ltd", Plastic exporter), which exists
// only for ra-492-add-registered-ors-to-accreditation.e2e.js: that spec
// submits in-year change requests against it, which is one-way, so no other
// spec may share it. The backend (DevSeed, alongside RA-425's org 50018) and
// the frontend's stub define the same org: keep all three in step.

import { seededRegistrationYear, yearSuffix } from './year-suffix.js'

export const ORGANISATION_ID = '50019'
export const ORGANISATION_NAME = 'In-Year Change Exports Ltd'
export const MATERIAL = 'Plastic'

export const registrationNumber = (year) => `R${yearSuffix(year)}EX0500190001PL`

// RA-425's manage registration and accreditation page, and its "Manage
// overseas reprocessing sites" page. RA-739: by registration number.
export const MANAGE_PATH = `/manage/${ORGANISATION_ID}/${registrationNumber(seededRegistrationYear())}/${MATERIAL}`
export const OVERSEAS_SITES_PATH = `${MANAGE_PATH}/overseas-sites`

// The seeded overseas reprocessing sites (ORSs): the site id the routes and
// backend take, and the ORS id the pages show. Hamburg is accredited;
// Valencia is on the application but was never registered; the rest are
// registered only.
export const ORS = {
  // Germany.
  hamburg: { siteId: 901901, orsId: '001' },
  // France: complete, so nothing to add and no BES evidence.
  lyon: { siteId: 901910, orsId: '005' },
  // Netherlands (RA-739): complete like Lyon, and listed straight after it,
  // with one interim site, so two complete sites can be added together.
  rotterdam: { siteId: 901914, orsId: '009' },
  // India: country only, so coordinates, R code and conditions of export are
  // missing, and BES evidence is required unless it meets the conditions of
  // export.
  delhi: { siteId: 901911, orsId: '006' },
  // Turkey: coordinates only, so R code and conditions of export are
  // missing; Turkey is in the OECD, so no BES evidence.
  izmir: { siteId: 901912, orsId: '007' },
  // Spain: never registered (IsNewSite), so on neither tab and not addable.
  valencia: { siteId: 901913, orsId: '008' }
}

// The seeded accreditation application's id, which the RA-492 change-request
// routes and backend endpoints take: "a", the year, then the org id padded to
// 19 digits (the backend's DevExporterAccreditationSeedService.ApplicationIdFor).
export const accreditationApplicationId = (year) =>
  `a${year}${ORGANISATION_ID.padStart(19, '0')}`
