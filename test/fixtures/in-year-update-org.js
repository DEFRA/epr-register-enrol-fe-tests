// Org 50025 ("In-Year Update Exports Ltd", Plastic exporter), which exists
// only for the RA-682 in-year ORS update specs. The backend
// (DevExporterOrg.InYearUpdate, DevExporterAccreditationSeedService) and the
// frontend's stub (IN_YEAR_UPDATE_ORG) define the same org: keep all three in step.

import { seededRegistrationYear, yearSuffix } from './year-suffix.js'

export const ORGANISATION_ID = '50025'
export const ORGANISATION_NAME = 'In-Year Update Exports Ltd'
export const MATERIAL = 'Plastic'

export const registrationNumber = (year) => `R${yearSuffix(year)}EX0500250001PL`

export const MANAGE_PATH = `/manage/${ORGANISATION_ID}/${registrationNumber(seededRegistrationYear())}/${MATERIAL}`
export const OVERSEAS_SITES_PATH = `${MANAGE_PATH}/overseas-sites`

// The change request pages under the accreditation application: the
// request's sites (/requests) and each accredited site's details
// (/update/{siteId}).
export const changeRequestPath = (applicationId) =>
  `/accreditation/manage-overseas-sites/${applicationId}`

// The seeded ORSs. A, B and E are accredited (A with two interim sites); C and
// D are registered only, and complete, so either can be added with nothing to
// fill in.
export const ORS = {
  a: { siteId: 902501, orsId: '001', siteName: 'Gdansk Recykling Sp. z o.o.' },
  b: { siteId: 902502, orsId: '002', siteName: 'Porto Reciclagem Lda' },
  e: { siteId: 902503, orsId: '003', siteName: 'Milano Riciclo SpA' },
  c: { siteId: 902504, orsId: '004', siteName: 'Ghent Recycling NV' },
  d: { siteId: 902505, orsId: '005', siteName: 'Vienna Recycling GmbH' }
}

export const INTERIM = {
  gdynia: { siteId: 902511, siteName: 'Gdynia Transfer Hub' },
  szczecin: { siteId: 902512, siteName: 'Szczecin Sorting Centre' }
}

export const accreditationApplicationId = (year) =>
  `a${year}${ORGANISATION_ID.padStart(19, '0')}`
