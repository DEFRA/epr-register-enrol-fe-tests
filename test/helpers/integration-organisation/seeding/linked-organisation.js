import { fakerEN_GB as fakerEnGb } from '@faker-js/faker'

import { linkOrganisationToDefraId } from './defra-id.js'
import { createApprovedOrganisation } from './organisation.js'
import { MATERIAL_SUFFIXES } from './reg-acc-number.js'

// Seeds an organisation an operator can sign in to straight away: a company
// registered with Companies House, approved to reprocess and to export every
// material, and linked to a Defra ID user and Defra organisation.

const WASTE_PROCESSING_TYPES = ['Reprocessor', 'Exporter']

// One data row per material, glass once per recycling process, for each
// waste processing type: 16 registrations, each with its accreditation.
export const ALL_MATERIAL_ROWS = WASTE_PROCESSING_TYPES.flatMap(
  (wasteProcessingType) =>
    Object.entries(MATERIAL_SUFFIXES).flatMap(([material, suffix]) =>
      typeof suffix === 'string'
        ? [{ wasteProcessingType, material }]
        : Object.keys(suffix).map((glassRecyclingProcess) => ({
            wasteProcessingType,
            material,
            glassRecyclingProcess
          }))
    )
).map((row, i) => (i === 0 ? { ...row, companiesHouse: true } : row))

/**
 * @param {object} options
 * @param {string} options.email the Defra ID user's email, which becomes the
 *   organisation's contact
 * @param {string} [options.defraOrgName] the Defra ID organisation it is linked
 *   to; a random company name when unset
 * @param {object[]} [options.dataRows] registrations to seed; every material as
 *   reprocessor and exporter when unset
 * @returns {Promise<{orgId: number, refNo: string, email: string, defraOrgName: string, defraOrgId: string, defraUserId: string, registrations: {wasteProcessingType: string, material: string, glassRecyclingProcess?: string, regNumber: string, accNumber: string}[]}>}
 */
export async function seedDefraLinkedOrganisation({
  email,
  defraOrgName = `${fakerEnGb.company.name()} Ltd`,
  dataRows = ALL_MATERIAL_ROWS
}) {
  if (!email) {
    throw new Error('An email is needed for the Defra ID user')
  }

  const approved = await createApprovedOrganisation(dataRows, {
    contactEmail: email
  })
  const linked = await linkOrganisationToDefraId(
    approved.refNo,
    email,
    defraOrgName
  )

  return {
    orgId: approved.orgId,
    refNo: approved.refNo,
    email,
    defraOrgName: linked.linkedDefraOrganisation.defraOrganisation.name,
    defraOrgId: linked.linkedDefraOrganisation.defraOrganisation.id,
    defraUserId: linked.userId,
    registrations: dataRows.map((row, i) => ({
      wasteProcessingType: row.wasteProcessingType,
      material: row.material,
      ...(row.glassRecyclingProcess && {
        glassRecyclingProcess: row.glassRecyclingProcess
      }),
      ...approved.numbers[i]
    }))
  }
}
