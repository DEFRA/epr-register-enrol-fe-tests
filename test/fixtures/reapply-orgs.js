// RA-765: four Plastic exporters, one for each case of the manage page's
// "apply for accreditation" banner. Each has its own applications, by year
// relative to the clock's (Y), so no other spec's data changes the banner:
//   50026 Approved Y-1                 -> offers Y
//   50027 Approved Y, Submitted Y+1    -> no banner
//   50028 Approved Y, Rejected Y+1     -> offers Y+1; that year's apply page
//                                         shows the refused application with
//                                         "start new"
//   50029 Approved Y-2 (lapsed)        -> offers Y
// No spec may start an application for them: landing on an empty offered year
// seeds one, which would change what the banner offers on the next run.
// The backend (DevSeed/DevExporterOrg.cs) and the frontend
// (src/server/common/constants/test-orgs.js) define the same orgs: keep all
// three in step.

import { seededRegistrationYear, yearSuffix } from './year-suffix.js'

const MATERIAL = 'Plastic'

const reapplyOrg = ({
  organisationId,
  organisationName,
  operatorLinkTestId,
  offeredYearOffset
}) => {
  const registrationNumber = (year) =>
    `R${yearSuffix(year)}EX0${organisationId}0001PL`
  const seededRegistrationNumber = registrationNumber(seededRegistrationYear())
  const offeredYear =
    offeredYearOffset === null
      ? null
      : seededRegistrationYear() + offeredYearOffset
  return {
    organisationId,
    organisationName,
    material: MATERIAL,
    registrationId: `aaa${organisationId.padStart(21, '0')}`,
    registrationNumber,
    // The operator page's link to the manage page.
    operatorLinkTestId,
    managePath: `/manage/${organisationId}/${seededRegistrationNumber}/${MATERIAL}`,
    // The year the banner offers, or null for no banner.
    offeredYear,
    // The banner's link: the apply page by organisation and registration
    // number.
    applyPath:
      offeredYear === null
        ? null
        : `/operator-accreditation/${organisationId}/${seededRegistrationNumber}/${MATERIAL}/${offeredYear}`
  }
}

export const REAPPLY_CURRENT_YEAR_ORG = reapplyOrg({
  organisationId: '50026',
  organisationName: 'Reapply Current Year Ltd',
  operatorLinkTestId: 'manage-reapply-current-year-link',
  offeredYearOffset: 0
})

export const APPLIED_NEXT_YEAR_ORG = reapplyOrg({
  organisationId: '50027',
  organisationName: 'Applied Next Year Ltd',
  operatorLinkTestId: 'manage-applied-next-year-link',
  offeredYearOffset: null
})

export const REFUSED_NEXT_YEAR_ORG = reapplyOrg({
  organisationId: '50028',
  organisationName: 'Refused Next Year Ltd',
  operatorLinkTestId: 'manage-refused-next-year-link',
  offeredYearOffset: 1
})

export const LAPSED_ACCREDITATION_ORG = reapplyOrg({
  organisationId: '50029',
  organisationName: 'Lapsed Accreditation Ltd',
  operatorLinkTestId: 'manage-lapsed-accreditation-link',
  offeredYearOffset: 0
})

export const REAPPLY_ORGS = [
  REAPPLY_CURRENT_YEAR_ORG,
  APPLIED_NEXT_YEAR_ORG,
  REFUSED_NEXT_YEAR_ORG,
  LAPSED_ACCREDITATION_ORG
]
