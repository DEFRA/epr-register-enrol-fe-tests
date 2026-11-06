// RA-697: org 50021 ("Registration Only Exports Ltd", Plastic exporter), an
// Approved registration with no accreditation in any year, for the
// registration-only manage pages. The backend (DevSeed/DevExporterOrg.cs) and
// the frontend (src/server/common/constants/test-orgs.js) define the same
// org: keep all three in step.

const ORGANISATION_ID = '50021'
export const ORGANISATION_NAME = 'Registration Only Exports Ltd'
const REGISTRATION_ID = 'aaa000000000000000050021'
export const MATERIAL = 'Plastic'

export const MANAGE_PATH = `/manage/${ORGANISATION_ID}/${REGISTRATION_ID}/${MATERIAL}`

const yearSuffix = (year) => String(year).slice(-2)

export const registrationNumber = (year) => `R${yearSuffix(year)}EX0500210001PL`

// RA-697 task 011: the backend dev seed's five registration-only ORS updates
// for org 50021 (DevChangeRequestSeedService, mirrored by the frontend's
// stub-change-request-seed.js; keep all three in step), one item each on its
// registered ORSs, in the order the list shows them: most urgent status
// first. Ids follow the same fixed scheme as org 50018's, under "a", e.g.
// 00002026-0000-0001-a000-050021000004 for the 4th request's item.
const changeItemId = (year, request) =>
  `0000${year}-0000-0001-a000-${ORGANISATION_ID.padStart(6, '0')}${String(request).padStart(6, '0')}`

const orsUpdate = (request, siteName, siteAddress, status) => ({
  itemId: (year) => changeItemId(year, request),
  siteName,
  siteAddress,
  type: 'ORS update',
  status
})

export const CHANGE_ITEMS = [
  orsUpdate(4, 'Milano Riciclo SpA', 'Via Industriale 7, Italy', 'QUERIED'),
  orsUpdate(5, 'Porto Plasticos Lda', 'Rua do Porto 21, Portugal', 'SUBMITTED'),
  orsUpdate(
    3,
    'Penang Polymers Sdn Bhd',
    'Jalan Pelabuhan 3, Malaysia',
    'DULY MADE'
  ),
  orsUpdate(
    2,
    'Jakarta Daur Ulang PT',
    'Jalan Pelabuhan 12, Indonesia',
    'GRANTED'
  ),
  orsUpdate(1, 'Porto Plasticos Lda', 'Rua do Porto 21, Portugal', 'REFUSED')
]
