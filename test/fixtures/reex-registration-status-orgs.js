// RA-806: two Plastic exporters whose registration status comes only from
// the stub ReEx, for ra-806-reex-registration-status.e2e.js. Neither is in any
// backend dev seed, so their registrationVersions record is written only by
// the seed dual-write when an application is started, from the status ReEx
// gives: org 50023's registration is `approved`, org 50024's is `created`.
// The backend's stub ReEx (Organisation/Services/FakeOrganisationPersistence.cs)
// defines the same orgs and registration numbers, and the frontend's stub
// operator is related to both (src/server/common/stub-operator-orgs.js): keep
// all three in step. The operator page doesn't link to them; the spec opens
// their pages by URL.

const MATERIAL = 'Plastic'

// The application year the operator page's accreditation links use. The
// stub ReEx gives the registration for the year before it, so the
// registration numbers below are 2026's.
const APPLICATION_YEAR = 2027

const reExOrg = ({ organisationId, organisationName, registrationNumber }) => {
  const registrationId = `aaa${organisationId.padStart(21, '0')}`
  return {
    organisationId,
    organisationName,
    material: MATERIAL,
    registrationNumber,
    // The application landing page, whose GET seeds the application and with
    // it the registration's current version.
    accreditationPath: `/operator-accreditation/${organisationId}/${registrationId}/${MATERIAL}/${APPLICATION_YEAR}`,
    // RA-739: the manage pages are by registration number.
    managePath: `/manage/${organisationId}/${registrationNumber}/${MATERIAL}`
  }
}

export const APPROVED_REGISTRATION_ORG = reExOrg({
  organisationId: '50023',
  organisationName: 'RA-806 Approved Exporter Ltd',
  registrationNumber: 'R26EX0500230938PL'
})

export const CREATED_REGISTRATION_ORG = reExOrg({
  organisationId: '50024',
  organisationName: 'RA-806 Created Exporter Ltd',
  registrationNumber: 'R26EX0500242843PL'
})
