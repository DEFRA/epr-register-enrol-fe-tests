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

// The case management reference the seed gives each item of a submitted
// request: the request's, e.g. CR26050018A008, then the item's number within
// it (RA-739: Case Management makes each site its own application), e.g.
// CR26050018A008-1.
export const changeItemReference = (
  organisationId,
  year,
  side,
  request,
  item
) =>
  `CR${yearSuffix(year)}${organisationId.padStart(6, '0')}${side.toUpperCase()}${String(request).padStart(3, '0')}-${item}`

// A seeded item's id and reference, by year.
export const seededIds = (organisationId, side, request, item = 1) => ({
  itemId: (year) => changeItemId(organisationId, year, side, request, item),
  reference: (year) =>
    changeItemReference(organisationId, year, side, request, item)
})

// Who the seed says submitted every submitted request.
export const SUBMITTER_NAME = 'Sam Patel'

// Seed dates fall on a day of the seed's year (created, valid from and
// withdrawn at 09:00 UTC; sent, the submitted date, 2 hours after creation,
// at 11:00 UTC), and the pages show only the day.
const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')
export const dayOf = (month, day) => (year) =>
  `${day} ${MONTHS[month - 1]} ${year}`

// RA-698: the note the seed gives every Queried item (DevChangeRequestSeedService
// and the frontend's stub-change-request-seed.js).
export const QUERY_NOTE =
  'Please confirm the site contact details and upload evidence of broadly equivalent standards.'

// The id of the request holding an item: the item id with item number 0, e.g.
// 00002026-0000-0000-a000-050018000008 for org 50018's exporter's 8th request.
export const changeRequestId = (organisationId, year, side, request) =>
  changeItemId(organisationId, year, side, request, 0)

// The seeded exporter accreditation's application id, which the backend's
// accreditation-changes routes take: "a", the year, then the org id padded to
// 19 digits (the backend's DevExporterAccreditationSeedService.ApplicationIdFor).
export const exporterApplicationId = (organisationId, year) =>
  `a${year}${organisationId.padStart(19, '0')}`
