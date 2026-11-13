// RA-697: org 50021 ("Registration Only Exports Ltd", Plastic exporter), an
// Approved registration with no accreditation in any year, for the
// registration-only manage pages. The backend (DevSeed/DevExporterOrg.cs) and
// the frontend (src/server/common/constants/test-orgs.js) define the same
// org: keep all three in step.

import { dayOf, seededIds } from './change-request-seed.js'
import { seededRegistrationYear, yearSuffix } from './year-suffix.js'

const ORGANISATION_ID = '50021'
export const ORGANISATION_NAME = 'Registration Only Exports Ltd'
export const MATERIAL = 'Plastic'

export const registrationNumber = (year) => `R${yearSuffix(year)}EX0500210001PL`

// RA-739: by registration number.
export const MANAGE_PATH = `/manage/${ORGANISATION_ID}/${registrationNumber(seededRegistrationYear())}/${MATERIAL}`

// RA-697 task 012: the registration's four Active ORSs, from the backend dev
// seed (DevExporterAccreditationSeedService.RegisteredOverseasSites, mirrored
// by the frontend's stub-manage-accreditations.js). The overseas-sites page
// keys each row by the ORS id's integer value.
const registeredOrs = (orsId, name, address) => ({
  siteId: Number(orsId),
  orsId,
  name,
  address
})

export const REGISTERED_ORS = [
  registeredOrs('001', 'Porto Plasticos Lda', 'Rua do Porto 21, Portugal'),
  registeredOrs('002', 'Milano Riciclo SpA', 'Via Industriale 7, Italy'),
  registeredOrs(
    '003',
    'Penang Polymers Sdn Bhd',
    'Jalan Pelabuhan 3, Malaysia'
  ),
  registeredOrs('004', 'Jakarta Daur Ulang PT', 'Jalan Pelabuhan 12, Indonesia')
]

// RA-697 task 013: the active interim sites of ORS 001 (Porto), keyed on the
// detail page by their site number's integer value.
export const PORTO_INTERIM_SITES = [
  { siteId: 1, line: 'Leixoes Port Storage, Portugal, R13' },
  { siteId: 2, line: 'Aveiro Transfer Hub, Portugal, R13' }
]

// RA-697 task 011: the backend dev seed's five registration-only ORS updates,
// one item each on a registered ORS, with ids and references as
// change-request-seed.js describes, under "a" as there is no accreditation.
// `sent` is the request's submitted date; `validFrom`/`validTo` are set only
// on the granted item.
const orsUpdate = (request, orsId, status, fields) => {
  const ors = REGISTERED_ORS.find((site) => site.orsId === orsId)
  return {
    ...seededIds(ORGANISATION_ID, 'a', request),
    orsId,
    siteName: ors.name,
    siteAddress: ors.address,
    type: 'ORS update',
    status,
    ...fields
  }
}

// In the order the list shows them: most urgent status first.
export const CHANGE_ITEMS = [
  orsUpdate(4, '002', 'QUERIED', { sent: dayOf(6, 18) }),
  orsUpdate(5, '001', 'SUBMITTED', { sent: dayOf(8, 25) }),
  orsUpdate(3, '003', 'DULY MADE', { sent: dayOf(5, 6) }),
  orsUpdate(2, '004', 'GRANTED', {
    sent: dayOf(3, 15),
    validFrom: dayOf(4, 20),
    validTo: dayOf(12, 31)
  }),
  orsUpdate(1, '001', 'REFUSED', { sent: dayOf(2, 10) })
]
