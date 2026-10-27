import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  EntraAuthClient,
  ReexApi,
  assertSuccessResponse
} from './seeding/api.js'
import { seedDefraLinkedOrganisation } from './seeding/linked-organisation.js'
import { addOverseasSites } from './seeding/overseas-sites.js'

// The organisation an integrated run signs in as. It is seeded once per run,
// in the wdio launcher (see hooks.js), and written to a snapshot file: wdio
// runs each spec in its own worker process, so the file is how every worker
// reads the same organisation back.

const SNAPSHOT_FILE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../.integration/seeded-organisation.json'
)

// Exporter materials given overseas reprocessing sites, so the accreditation
// journey's select-overseas-sites page has accredited sites to show and
// registered ones to add.
const OVERSEAS_SITES = [
  { material: 'plastic', accredited: 2, registered: 1 },
  { material: 'paper', accredited: 2, registered: 1 },
  { material: 'aluminium', accredited: 1, registered: 2 },
  {
    material: 'glass',
    glassRecyclingProcess: 'glass_re_melt',
    accredited: 1,
    registered: 1
  }
]

const timestamp = () => new Date().toISOString().replace(/\D/g, '').slice(0, 14)

/**
 * Seeds a Companies House organisation approved to reprocess and export every
 * material, linked to a Defra ID user, with overseas sites on a few of its
 * exporter registrations.
 *
 * @param {object} [options]
 * @param {string} [options.email] the Defra ID user's email; a new
 *   example.com address when unset
 * @returns {Promise<SeededOrganisation>}
 */
export async function seedOrganisation({
  email = `reex-operator-${timestamp()}@example.com`
} = {}) {
  const seeded = await seedDefraLinkedOrganisation({ email })
  await addOverseasSites(seeded.refNo, OVERSEAS_SITES)
  return loadOrganisation(seeded.refNo)
}

/**
 * Reads an organisation already on the environment as a snapshot, e.g. to
 * rerun against one an earlier run seeded. It signs in as the organisation's
 * contact, which is the Defra ID user it was linked for.
 *
 * @param {string} id the organisation's id (not its numeric orgId)
 * @returns {Promise<SeededOrganisation>}
 */
export async function loadOrganisation(id) {
  const api = new ReexApi()
  const auth = new EntraAuthClient()
  await auth.authenticate()

  const data = await assertSuccessResponse(
    await api.get(`/v1/organisations/${id}`, auth.authHeader()),
    `GET /v1/organisations/${id}`
  )
  const accreditations = new Map(
    data.accreditations.map((accreditation) => [
      accreditation.id,
      accreditation
    ])
  )

  return {
    id: data.id,
    orgId: data.orgId,
    status: data.status,
    email: data.submitterContactDetails.email,
    defraOrganisation: data.linkedDefraOrganisation
      ? {
          id: data.linkedDefraOrganisation.orgId,
          name: data.linkedDefraOrganisation.orgName
        }
      : null,
    registrations: data.registrations.map((registration) => ({
      wasteProcessingType: registration.wasteProcessingType,
      material: registration.material,
      glassRecyclingProcess: registration.glassRecyclingProcess?.[0] ?? null,
      registrationId: registration.id,
      registrationNumber: registration.registrationNumber,
      accreditationId: registration.accreditationId ?? null,
      accreditationNumber:
        accreditations.get(registration.accreditationId)?.accreditationNumber ??
        null,
      overseasSites: Object.fromEntries(
        Object.entries(registration.overseasSites ?? {}).map(
          ([orsId, { overseasSiteId }]) => [orsId, overseasSiteId]
        )
      )
    }))
  }
}

export function writeSnapshot(organisation) {
  mkdirSync(dirname(SNAPSHOT_FILE), { recursive: true })
  writeFileSync(SNAPSHOT_FILE, `${JSON.stringify(organisation, null, 2)}\n`)
}

/**
 * The organisation seeded for this run.
 *
 * @returns {SeededOrganisation}
 */
export function seededOrganisation() {
  try {
    return JSON.parse(readFileSync(SNAPSHOT_FILE, 'utf8'))
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(
        `No organisation was seeded for this run (${SNAPSHOT_FILE}). ` +
          'Seeding runs in onPrepare when ENVIRONMENT=test.'
      )
    }
    throw err
  }
}

export function hasSeededOrganisation() {
  try {
    seededOrganisation()
    return true
  } catch {
    return false
  }
}

/**
 * The ids a test needs for one of the seeded organisation's materials.
 *
 * @param {object} spec
 * @param {string} spec.material as the organisation stores it: 'aluminium',
 *   'fibre', 'glass', 'paper', 'plastic', 'steel' or 'wood'
 * @param {'reprocessor' | 'exporter'} spec.wasteProcessingType
 * @param {'glass_re_melt' | 'glass_other'} [spec.glassRecyclingProcess]
 *   which glass registration; required for glass
 * @returns {SeededMaterial}
 */
export function seededMaterial({
  material,
  wasteProcessingType,
  glassRecyclingProcess
}) {
  const organisation = seededOrganisation()
  const matches = organisation.registrations.filter(
    (registration) =>
      registration.material === material &&
      registration.wasteProcessingType === wasteProcessingType &&
      (!glassRecyclingProcess ||
        registration.glassRecyclingProcess === glassRecyclingProcess)
  )
  const describe = (r) =>
    `${r.wasteProcessingType} ${r.material}${r.glassRecyclingProcess ? ` (${r.glassRecyclingProcess})` : ''}`

  if (matches.length !== 1) {
    throw new Error(
      `${matches.length ? 'More than one' : 'No'} ${describe({ material, wasteProcessingType, glassRecyclingProcess })} ` +
        `registration on organisation ${organisation.orgId}. It has:\n  ` +
        organisation.registrations.map(describe).join('\n  ')
    )
  }

  return {
    id: organisation.id,
    orgId: organisation.orgId,
    email: organisation.email,
    ...matches[0]
  }
}

/**
 * @typedef {object} SeededRegistration
 * @property {'reprocessor' | 'exporter'} wasteProcessingType
 * @property {string} material
 * @property {string | null} glassRecyclingProcess
 * @property {string} registrationId
 * @property {string} registrationNumber
 * @property {string | null} accreditationId
 * @property {string | null} accreditationNumber
 * @property {Record<string, string>} overseasSites overseas site id by ORS id
 *
 * @typedef {object} SeededOrganisation
 * @property {string} id
 * @property {number} orgId
 * @property {string} status
 * @property {string} email the linked Defra ID user's
 * @property {{id: string, name: string} | null} defraOrganisation
 * @property {SeededRegistration[]} registrations
 *
 * @typedef {SeededRegistration & {id: string, orgId: number, email: string}} SeededMaterial
 */
