import { yearSuffix } from './year-suffix.js'

// RA-697: the backend dev seed's fixed change request ids, references and
// dates (DevChangeRequestSeedService, mirrored by the frontend's
// stub-change-request-seed.js; keep all three in step), shared by the orgs'
// fixtures.

// Fixed per year, org, accreditation ("a" exporter, "b" reprocessor; a
// registration-only org's requests use "a" too), request (numbered from 1,
// oldest first) and item (numbered from 1 within the request), e.g.
// 00002026-0000-0001-a000-050018000008 for org 50018's exporter's 8th
// request's first item. The pages key their rows by item id.
export const changeItemId = (organisationId, year, side, request, item) =>
  `0000${year}-0000-${String(item).padStart(4, '0')}-${side}000-${organisationId.padStart(6, '0')}${String(request).padStart(6, '0')}`

// The case management reference the seed gives each submitted request,
// e.g. CR26050018A008.
export const changeRequestReference = (organisationId, year, side, request) =>
  `CR${yearSuffix(year)}${organisationId.padStart(6, '0')}${side.toUpperCase()}${String(request).padStart(3, '0')}`

// Seed dates are 09:00 UTC on a day of the seed's year, as the pages show it.
const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')
export const dayOf = (month, day) => (year) =>
  `${day} ${MONTHS[month - 1]} ${year}`
