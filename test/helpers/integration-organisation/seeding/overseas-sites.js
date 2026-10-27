import { fakerEN_GB as fakerEnGb } from '@faker-js/faker'

import { EntraAuthClient, ReexApi, assertSuccessResponse } from './api.js'
import { SEEDED_VALID_FROM } from './organisation.js'

// Gives a seeded organisation's exporter registrations overseas reprocessing
// sites (ORS), as the regulator's ORS upload would. Extends
// seedOverseasSites in epr-re-ex-journey-tests
// (test/support/seeding/organisation.js) to several sites per registration.
//
// A site with a validFrom is approved for the registration's accreditation;
// one without is registered only. The register-enrol accreditation journey
// shows the first as "accredited" sites and the second as "registered" sites
// that can be added to the accreditation.

// Real reprocessing towns, so the coordinates agree with the address.
const LOCATIONS = [
  {
    country: 'Germany',
    townOrCity: 'Duisburg',
    stateOrRegion: 'North Rhine-Westphalia',
    postcode: '47051',
    coordinates: '51.4344, 6.7623'
  },
  {
    country: 'Netherlands',
    townOrCity: 'Rotterdam',
    stateOrRegion: 'South Holland',
    postcode: '3011 AA',
    coordinates: '51.9244, 4.4777'
  },
  {
    country: 'Poland',
    townOrCity: 'Gdansk',
    stateOrRegion: 'Pomeranian',
    postcode: '80-001',
    coordinates: '54.3520, 18.6466'
  },
  {
    country: 'Spain',
    townOrCity: 'Valencia',
    stateOrRegion: 'Valencian Community',
    postcode: '46001',
    coordinates: '39.4699, -0.3763'
  },
  {
    country: 'France',
    townOrCity: 'Le Havre',
    stateOrRegion: 'Normandy',
    postcode: '76600',
    coordinates: '49.4944, 0.1079'
  },
  {
    country: 'Belgium',
    townOrCity: 'Antwerp',
    stateOrRegion: 'Flanders',
    postcode: '2000',
    coordinates: '51.2194, 4.4025'
  },
  {
    country: 'Turkey',
    townOrCity: 'Izmir',
    stateOrRegion: 'Izmir Province',
    postcode: '35210',
    coordinates: '38.4237, 27.1428'
  },
  {
    country: 'India',
    townOrCity: 'Mumbai',
    stateOrRegion: 'Maharashtra',
    postcode: '400001',
    coordinates: '19.0760, 72.8777'
  }
]

function siteFor(material, n) {
  const location = LOCATIONS[n % LOCATIONS.length]
  const { coordinates, country, ...place } = location
  return {
    name: `${fakerEnGb.company.name()} ${material.split(' ')[0]} Recycling`,
    address: {
      line1: `${fakerEnGb.number.int({ min: 1, max: 250 })} Industrial Way`,
      ...place
    },
    country,
    coordinates
  }
}

const sameMaterial = (registration, { material, glassRecyclingProcess }) =>
  registration.wasteProcessingType === 'exporter' &&
  registration.material === material &&
  (!glassRecyclingProcess ||
    registration.glassRecyclingProcess?.includes(glassRecyclingProcess))

/**
 * Creates overseas sites and maps them onto the organisation's exporter
 * registrations, under three-digit ORS ids unique across the organisation.
 *
 * @param {string} refNo
 * @param {{material: string, glassRecyclingProcess?: string, accredited?: number, registered?: number}[]} specs
 *   material as the organisation stores it ('plastic', 'glass', ...);
 *   glassRecyclingProcess likewise ('glass_re_melt' | 'glass_other')
 * @param {{validFrom?: string, firstOrsId?: number}} [options]
 * @returns {Promise<{registrationNumber: string, accreditationNumber: string | null, orsId: string, siteId: string, name: string, country: string, accredited: boolean}[]>}
 */
export async function addOverseasSites(
  refNo,
  specs,
  { validFrom = SEEDED_VALID_FROM, firstOrsId = 101 } = {}
) {
  const api = new ReexApi()
  const auth = new EntraAuthClient()
  await auth.authenticate()

  const data = await assertSuccessResponse(
    await api.get(`/v1/organisations/${refNo}`, auth.authHeader()),
    `GET /v1/organisations/${refNo}`
  )

  const usedOrsIds = data.registrations.flatMap((registration) =>
    Object.keys(registration.overseasSites ?? {}).map(Number)
  )
  let nextOrsId = Math.max(firstOrsId - 1, ...usedOrsIds) + 1

  const added = []
  for (const spec of specs) {
    const registration = data.registrations.find((candidate) =>
      sameMaterial(candidate, spec)
    )
    if (!registration) {
      throw new Error(
        `No exporter registration for ${spec.material}${spec.glassRecyclingProcess ? ` (${spec.glassRecyclingProcess})` : ''} on ${refNo}`
      )
    }
    const accreditationNumber =
      data.accreditations.find(({ id }) => id === registration.accreditationId)
        ?.accreditationNumber ?? null

    const kinds = [
      ...Array(spec.accredited ?? 0).fill(true),
      ...Array(spec.registered ?? 0).fill(false)
    ]
    for (const accredited of kinds) {
      const orsId = String(nextOrsId++).padStart(3, '0')
      const site = await assertSuccessResponse(
        await api.post(
          '/v1/overseas-sites',
          JSON.stringify({
            ...siteFor(spec.material, added.length),
            validFrom: accredited ? validFrom : null
          }),
          { 'content-type': 'application/json', ...auth.authHeader() }
        ),
        'POST /v1/overseas-sites'
      )
      registration.overseasSites = {
        ...registration.overseasSites,
        [orsId]: { overseasSiteId: site.id }
      }
      added.push({
        registrationNumber: registration.registrationNumber,
        accreditationNumber,
        orsId,
        siteId: site.id,
        name: site.name,
        country: site.country,
        accredited
      })
    }
  }

  await assertSuccessResponse(
    await api.put(
      `/v1/dev/organisations/${refNo}`,
      JSON.stringify({ version: Number(data.version), updateFragment: data }),
      auth.authHeader()
    ),
    `PUT /v1/dev/organisations/${refNo}`
  )

  return added
}
