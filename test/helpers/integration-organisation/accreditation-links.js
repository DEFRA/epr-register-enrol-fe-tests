// Links straight into epr-register-enrol-frontend's accreditation journey for
// each of a seeded organisation's registrations, in the form the Re-Ex
// frontend's "apply for <year> accreditation" hand-off link takes:
//
//   /operator-accreditation/{organisation id}/{registration id}/{material}/{year}
//
// Both ids are the Re/Ex ones (not the numeric orgId or the registration
// number), the material is as the organisation stores it (both glass
// registrations are 'glass'), and the year is the one being applied for: the
// year after the current accreditation.

export function registerEnrolFrontendUrl(
  environment = process.env.ENVIRONMENT || 'dev'
) {
  return (
    process.env.REGISTER_ENROL_FRONTEND_URL ||
    `https://epr-register-enrol-frontend.${environment}.cdp-int.defra.cloud`
  )
}

/**
 * @param {import('./seeded-organisation.js').SeededOrganisation} organisation
 * @param {object} [options]
 * @param {number} [options.year] the year applied for; next year when unset
 * @param {string} [options.baseUrl]
 * @returns {{wasteProcessingType: string, material: string, glassRecyclingProcess: string | null, registrationNumber: string, url: string}[]}
 */
export function operatorAccreditationLinks(
  organisation,
  {
    year = new Date().getUTCFullYear() + 1,
    baseUrl = registerEnrolFrontendUrl()
  } = {}
) {
  return organisation.registrations.map((registration) => ({
    wasteProcessingType: registration.wasteProcessingType,
    material: registration.material,
    glassRecyclingProcess: registration.glassRecyclingProcess,
    registrationNumber: registration.registrationNumber,
    url: `${baseUrl}/operator-accreditation/${organisation.id}/${registration.registrationId}/${registration.material}/${year}`
  }))
}
