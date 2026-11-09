// Org 50018 ("Manage Accreditation Test Ltd", Plastic exporter and, since
// RA-697, Glass reprocessor), which exists only for
// ra-425-view-ors-and-interim-sites.e2e.js and ra-697-in-year-change-requests.e2e.js,
// both read-only. The backend's dev seed also gives both accreditations change
// requests (DevChangeRequestSeedService); the RA-425 spec doesn't assert on them.
// The backend (DevSeed/DevExporterOrg.cs) and the frontend
// (src/server/common/constants/test-orgs.js) define the same org: keep all
// three in step.

import {
  changeItemId,
  changeRequestReference,
  dayOf
} from './change-request-seed.js'
import { yearSuffix } from './year-suffix.js'

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

// RA-697: the backend's seeded change request items, with ids and references
// as change-request-seed.js describes.
const item = (side, request, itemNumber, fields) => ({
  ...fields,
  itemId: (year) =>
    changeItemId(ORGANISATION_ID, year, side, request, itemNumber),
  reference: (year) =>
    changeRequestReference(ORGANISATION_ID, year, side, request)
})

// The ORS ids the pages show for the ORSs above.
const ORS_IDS = {
  rotterdam: '001',
  bharat: '002',
  berlin: '003',
  dragon: '004'
}

// Each ORS item keeps the ORS id the pages show with the site id it is for.
const orsSite = (name) => ({ siteId: ORS[name], orsId: ORS_IDS[name] })

// The Plastic exporter's 14 items over 12 requests: each ORS has at most one
// active item, Dragon's New ORS accreditation is the only draft
// (In progress), and every other request was submitted. RA-697 task 014: the
// registration also has one registration-only ORS update (no accreditation),
// on Dragon, which the accreditation's pages list too. `sent` is the
// request's submitted date (In progress has none), `validFrom`/`validTo` are
// set only on granted items and Rotterdam's withdrawn update (Dragon's
// withdrawn New ORS accreditation was never granted).
export const CHANGE_ITEMS = {
  rotterdamUpdateGranted: item('a', 1, 1, {
    ...orsSite('rotterdam'),
    type: 'ORS update',
    status: 'GRANTED',
    sent: dayOf(2, 3),
    validFrom: dayOf(3, 2),
    validTo: dayOf(12, 31)
  }),
  bharatUpdateGranted: item('a', 1, 2, {
    ...orsSite('bharat'),
    type: 'ORS update',
    status: 'GRANTED',
    sent: dayOf(2, 3)
  }),
  dragonNewRefused: item('a', 2, 1, {
    ...orsSite('dragon'),
    type: 'New ORS accreditation',
    status: 'REFUSED',
    sent: dayOf(2, 20)
  }),
  tonnageGranted: item('a', 3, 1, {
    type: 'Tonnage band upgrade',
    status: 'GRANTED',
    band: 'Up to 5,000 tonnes',
    sent: dayOf(3, 10),
    validFrom: dayOf(4, 1),
    validTo: dayOf(12, 31)
  }),
  dragonNewWithdrawn: item('a', 4, 1, {
    ...orsSite('dragon'),
    type: 'New ORS accreditation',
    status: 'WITHDRAWN',
    sent: dayOf(4, 6)
  }),
  berlinUpdateRefused: item('a', 5, 1, {
    ...orsSite('berlin'),
    type: 'ORS update',
    status: 'REFUSED',
    sent: dayOf(5, 12)
  }),
  rotterdamUpdateWithdrawn: item('a', 6, 1, {
    ...orsSite('rotterdam'),
    type: 'ORS update',
    status: 'WITHDRAWN',
    sent: dayOf(6, 2),
    validFrom: dayOf(6, 22),
    validTo: dayOf(7, 10)
  }),
  tonnageRefused: item('a', 7, 1, {
    type: 'Tonnage band upgrade',
    status: 'REFUSED',
    sent: dayOf(6, 25)
  }),
  rotterdamUpdateQueried: item('a', 8, 1, {
    ...orsSite('rotterdam'),
    type: 'ORS update',
    status: 'QUERIED',
    sent: dayOf(7, 14)
  }),
  bharatUpdateSubmitted: item('a', 8, 2, {
    ...orsSite('bharat'),
    type: 'ORS update',
    status: 'SUBMITTED',
    sent: dayOf(7, 14)
  }),
  berlinUpdateUpdated: item('a', 9, 1, {
    ...orsSite('berlin'),
    type: 'ORS update',
    status: 'UPDATED',
    sent: dayOf(8, 20)
  }),
  tonnageDulyMade: item('a', 10, 1, {
    type: 'Tonnage band upgrade',
    status: 'DULY MADE',
    band: 'Up to 10,000 tonnes',
    sent: dayOf(9, 8)
  }),
  dragonNewInProgress: item('a', 11, 1, {
    ...orsSite('dragon'),
    type: 'New ORS accreditation',
    status: 'IN PROGRESS'
  }),
  // Keyed by the ORS id's integer value, as every registration-only item is,
  // not Dragon's accreditation site id; Refused, as Dragon's draft is its one
  // active item.
  dragonUpdateRefusedRegistrationOnly: item('a', 12, 1, {
    ...orsSite('dragon'),
    siteId: 4,
    type: 'ORS update',
    status: 'REFUSED',
    sent: dayOf(9, 15)
  })
}

// The Glass reprocessor's 3 items: tonnage band upgrades only.
export const REPROCESSOR_CHANGE_ITEMS = {
  tonnageGranted: item('b', 1, 1, {
    type: 'Tonnage band upgrade',
    status: 'GRANTED',
    sent: dayOf(3, 3)
  }),
  tonnageRefused: item('b', 2, 1, {
    type: 'Tonnage band upgrade',
    status: 'REFUSED',
    sent: dayOf(5, 19)
  }),
  tonnageSubmitted: item('b', 3, 1, {
    type: 'Tonnage band upgrade',
    status: 'SUBMITTED',
    band: 'Up to 10,000 tonnes',
    sent: dayOf(8, 4)
  })
}
