import { request } from 'undici'
import { backendUrl } from '../config.js'

export async function getOrganisations() {
  const { statusCode, body } = await request(`${backendUrl}/organisation`)
  if (statusCode !== 200) {
    throw new Error(`Failed to fetch organisations: HTTP ${statusCode}`)
  }

  const orgs = await body.json()

  return orgs.map((org) => ({
    companyName: org.companyName,
    companiesHouseNumber: org.companiesHouseNumber,
    schemeRegistrationId: org.schemeRegistrationId,
    registeredAddress: org.registeredAddress,
    approvedPerson: org.approvedPerson,
    directors: org.directors.map((d) => d.name)
  }))
}

export async function getOrganisationById(schemeRegistrationId) {
  const orgs = await getOrganisations()
  return orgs.find((org) => org.schemeRegistrationId === schemeRegistrationId)
}
