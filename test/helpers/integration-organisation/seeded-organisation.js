import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  EntraAuthClient,
  ReexApi,
  assertSuccessResponse
} from './seeding/api.js'
import { seedDefraLinkedOrganisation } from './seeding/linked-organisation.js'
import { addOverseasSites } from './seeding/overseas-sites.js'
import { isRunActive, runId } from './run-id.js'

// The organisation an integrated run signs in as. It is seeded once per run,
// in the wdio launcher (see hooks.js), and written to a snapshot file: wdio
// runs each spec in its own worker process, so the file is how every worker
// reads the same organisation back.

const INTEGRATION_DIRECTORY = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../.integration'
)

// Each run's own directory (run-id.js), so a run - and its spec retries -
// only ever read back the organisation it seeded. Outside a run, e.g. a
// script run on its own, the directory's top level.
const runDirectory = () =>
  runId()
    ? resolve(INTEGRATION_DIRECTORY, 'runs', runId())
    : INTEGRATION_DIRECTORY

const snapshotFile = () => resolve(runDirectory(), 'seeded-organisation.json')

// Why seeding failed, for the specs to fail with: it is done in the launcher,
// before any worker starts, and wdio only logs an error thrown there.
const seedingFailureFile = () => resolve(runDirectory(), 'seeding-failure.txt')

// The exporter material the exporter scenario applies for: a few accredited
// overseas reprocessing sites to complete and registered ones to add, before
// it adds a new site of its own.
export const OVERSEAS_SITES_MATERIAL = 'plastic'

// Exporter materials given overseas reprocessing sites, so the accreditation
// journey's select-overseas-sites page has accredited sites to show and
// registered ones to add.
const OVERSEAS_SITES = [
  { material: OVERSEAS_SITES_MATERIAL, accredited: 3, registered: 2 },
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
 * @param {(organisation: {orgId: number, id: string, email: string, defraOrganisation: null}) => void} [options.onCreated]
 *   called as soon as the organisation exists, before it is approved, linked
 *   or given overseas sites, so a caller can record it for clean-up even if
 *   the rest fails
 * @param {(organisation: {orgId: number, id: string, email: string, defraOrganisation: {id: string, name: string}}) => void} [options.onLinked]
 *   called once it is linked to its Defra ID user and organisation
 * @returns {Promise<SeededOrganisation>}
 */
export async function seedOrganisation({
  email = `reex-operator-${timestamp()}@example.com`,
  onCreated = () => {},
  onLinked = () => {}
} = {}) {
  const seeded = await seedDefraLinkedOrganisation({
    email,
    onCreated: ({ orgId, refNo }) =>
      onCreated({ orgId, id: refNo, email, defraOrganisation: null })
  })
  onLinked({
    orgId: seeded.orgId,
    id: seeded.refNo,
    email,
    defraOrganisation: { id: seeded.defraOrgId, name: seeded.defraOrgName }
  })
  const sites = await addOverseasSites(seeded.refNo, OVERSEAS_SITES)
  const organisation = await loadOrganisation(seeded.refNo)
  // What the organisation's API record does not say, but the tests check
  // case management for: the seeded sites' names, and who they were for.
  return {
    ...organisation,
    defraUserId: seeded.defraUserId,
    registrations: organisation.registrations.map((registration) => ({
      ...registration,
      overseasSiteNames: sites
        .filter(
          (site) => site.registrationNumber === registration.registrationNumber
        )
        .map(({ name }) => name)
    }))
  }
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
    name: data.companyDetails?.name ?? null,
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
  mkdirSync(runDirectory(), { recursive: true })
  writeFileSync(snapshotFile(), `${JSON.stringify(organisation, null, 2)}\n`)
}

/**
 * Removes the snapshot, so nothing reads back an organisation from an earlier
 * run, one that has since been deleted or belongs to another environment.
 */
export function removeSnapshot() {
  rmSync(snapshotFile(), { force: true })
  rmSync(seedingFailureFile(), { force: true })
  if (runId()) {
    rmSync(runDirectory(), { recursive: true, force: true })
  }
}

/**
 * Removes the snapshots of runs that are no longer going (they died, or kept
 * their organisation), and the one runs wrote at the top level before each
 * had its own directory. A run's organisation itself is kept or deleted by
 * the delete list, not by these.
 */
export function removeEndedRunsSnapshots() {
  const runsDirectory = resolve(INTEGRATION_DIRECTORY, 'runs')
  if (existsSync(runsDirectory)) {
    for (const id of readdirSync(runsDirectory)) {
      if (id !== runId() && !isRunActive(id)) {
        rmSync(resolve(runsDirectory, id), { recursive: true, force: true })
      }
    }
  }
  rmSync(resolve(INTEGRATION_DIRECTORY, 'seeded-organisation.json'), {
    force: true
  })
  rmSync(resolve(INTEGRATION_DIRECTORY, 'seeding-failure.txt'), {
    force: true
  })
}

/** Records why seeding the run's organisation failed. */
export function recordSeedingFailure(err) {
  mkdirSync(runDirectory(), { recursive: true })
  writeFileSync(seedingFailureFile(), `${err?.stack ?? err}\n`)
}

/**
 * The organisation seeded for this run, for a spec that cannot run without
 * one: when there is none, it throws, with why seeding failed if it did.
 *
 * @returns {SeededOrganisation}
 */
export function requireSeededOrganisation() {
  if (hasSeededOrganisation()) {
    return seededOrganisation()
  }
  let failure
  try {
    failure = readFileSync(seedingFailureFile(), 'utf8')
  } catch {
    return seededOrganisation()
  }
  throw new Error(
    `Seeding the run's organisation failed, so this cannot run:\n${failure}`
  )
}

/**
 * The organisation seeded for this run.
 *
 * @returns {SeededOrganisation}
 */
export function seededOrganisation() {
  try {
    return JSON.parse(readFileSync(snapshotFile(), 'utf8'))
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(
        `No organisation was seeded for this run (${snapshotFile()}). ` +
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
 * @property {string[]} [overseasSiteNames] the overseas sites' names; only
 *   for an organisation seeded by this run, not one reused by id
 *
 * @typedef {object} SeededOrganisation
 * @property {string} id
 * @property {number} orgId
 * @property {string | null} name the company name, as case management lists it
 * @property {string} status
 * @property {string} email the linked Defra ID user's
 * @property {string} [defraUserId] the linked Defra ID user's id; only for an
 *   organisation seeded by this run
 * @property {{id: string, name: string} | null} defraOrganisation
 * @property {SeededRegistration[]} registrations
 *
 * @typedef {SeededRegistration & {id: string, orgId: number, email: string}} SeededMaterial
 */
