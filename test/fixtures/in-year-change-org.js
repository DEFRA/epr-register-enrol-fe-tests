// Org 50019 ("In-Year Change Exports Ltd", Plastic exporter), which exists
// only for ra-492-add-registered-ors-to-accreditation.e2e.js: that spec
// submits in-year change requests against it, which is one-way, so no other
// spec may share it. The backend (DevSeed, alongside RA-425's org 50018) and
// the frontend's stub define the same org: keep all three in step.

export const ORGANISATION_ID = '50019'
export const ORGANISATION_NAME = 'In-Year Change Exports Ltd'
const REGISTRATION_ID = 'aaa000000000000000050019'
export const MATERIAL = 'Plastic'

// RA-425's manage registration and accreditation page, and its "Manage
// overseas reprocessing sites" page.
export const MANAGE_PATH = `/manage/${ORGANISATION_ID}/${REGISTRATION_ID}/${MATERIAL}`
export const OVERSEAS_SITES_PATH = `${MANAGE_PATH}/overseas-sites`

// Site ids of the seeded overseas reprocessing sites (ORSs). Hamburg is
// accredited; the rest are registered only.
export const ORS = {
  // ORS 001, Germany.
  hamburg: 901901,
  // ORS 005, France: complete, so nothing to add and no BES evidence.
  lyon: 901910,
  // ORS 006, India: country only, so coordinates, R code and conditions of
  // export are missing, and BES evidence is required unless it meets the
  // conditions of export.
  delhi: 901911,
  // ORS 007, Turkey: coordinates only, so R code and conditions of export
  // are missing; Turkey is in the OECD, so no BES evidence.
  izmir: 901912
}

// The seeded accreditation application's id, which the RA-492 change-request
// routes and backend endpoints take: "a", the year, then the org id padded to
// 19 digits (the backend's DevExporterAccreditationSeedService.ApplicationIdFor).
export const accreditationApplicationId = (year) =>
  `a${year}${ORGANISATION_ID.padStart(19, '0')}`
