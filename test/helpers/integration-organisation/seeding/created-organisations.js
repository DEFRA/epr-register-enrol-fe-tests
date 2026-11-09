import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { ReexApi, assertSuccessResponse } from './api.js'
import { logRunOrganisation } from './run-organisations.js'
import { isRunActive, runId } from '../run-id.js'

// A flat file of every organisation an integrated run has seeded and not yet
// deleted, one JSON object per line. Seeding appends to it as soon as an
// organisation exists, and the end of the run deletes everything it lists
// through epr-backend's non-prod DELETE /v1/dev/organisations/{orgId}.
//
// An organisation that fails to delete stays listed, so the next run's
// clean-up retries it, as does one left behind by a run that died before it
// got to clean up. Organisations reused through SEEDED_ORGANISATION_ID are
// never listed: only what a run created is a run's to delete.
//
// Each organisation created or deleted is also logged for the run's Allure
// report (run-organisations.js).

export const CREATED_ORGANISATIONS_FILE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../.integration/created-organisations.jsonl'
)

/**
 * @typedef {object} CreatedOrganisation
 * @property {number} orgId
 * @property {string} id
 * @property {string} environment
 * @property {string} email the Defra ID user it is linked for
 * @property {{id: string, name: string} | null} defraOrganisation
 * @property {string} createdAt
 * @property {string} [runId] the run that created it (run-id.js); absent on
 *   entries written before runs were tagged
 */

// An untagged entry is only taken for a leftover once it is this old, so a
// run on an older checkout, which does not tag its entries, is not cleaned up
// under it.
const UNTAGGED_LEFTOVER_AGE_MS = 2 * 60 * 60 * 1000

/**
 * Whether an entry is this run's to delete: created by this run, or left
 * behind by one that is no longer running. Another run that is still going
 * keeps its organisation.
 *
 * @param {CreatedOrganisation} organisation
 */
function isOursToDelete(organisation) {
  if (organisation.runId) {
    return organisation.runId === runId() || !isRunActive(organisation.runId)
  }
  return (
    Date.now() - Date.parse(organisation.createdAt) > UNTAGGED_LEFTOVER_AGE_MS
  )
}

const sameEntry = (a, b) =>
  a.orgId === b.orgId && a.environment === b.environment

/** @returns {CreatedOrganisation[]} */
export function readCreatedOrganisations() {
  if (!existsSync(CREATED_ORGANISATIONS_FILE)) {
    return []
  }
  return readFileSync(CREATED_ORGANISATIONS_FILE, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line))
}

/** @param {Omit<CreatedOrganisation, 'environment' | 'createdAt'>} organisation */
export function recordCreatedOrganisation(organisation) {
  mkdirSync(dirname(CREATED_ORGANISATIONS_FILE), { recursive: true })
  appendFileSync(
    CREATED_ORGANISATIONS_FILE,
    `${JSON.stringify({
      ...organisation,
      environment: process.env.ENVIRONMENT,
      createdAt: new Date().toISOString(),
      runId: runId()
    })}\n`
  )
  logRunOrganisation('created', organisation)
}

/**
 * Deletes this run's organisation, and any a run that is no longer going left
 * behind, for this ENVIRONMENT. Organisations of another run still in
 * progress are left for it. Whatever fails to delete stays listed, for a later
 * run to retry.
 *
 * @param {object} [options]
 * @param {string} [options.except] the id of an organisation to leave, e.g.
 *   the one SEEDED_ORGANISATION_ID reuses
 *
 * @returns {Promise<{deleted: CreatedOrganisation[], failed: {organisation: CreatedOrganisation, error: string}[]}>}
 */
export async function deleteCreatedOrganisations({ except } = {}) {
  const environment = process.env.ENVIRONMENT
  const toDelete = readCreatedOrganisations().filter(
    (organisation) =>
      organisation.environment === environment &&
      organisation.id !== except &&
      isOursToDelete(organisation)
  )
  const api = new ReexApi()
  const deleted = []
  const failed = []

  for (const organisation of toDelete) {
    try {
      await assertSuccessResponse(
        await api.delete(`/v1/dev/organisations/${organisation.orgId}`),
        `DELETE /v1/dev/organisations/${organisation.orgId}`
      )
      deleted.push(organisation)
      logRunOrganisation('deleted', organisation)
    } catch (err) {
      failed.push({ organisation, error: err.message })
      logRunOrganisation('delete-failed', organisation, err.message)
    }
  }

  if (deleted.length) {
    // Read again: another run may have added to the file meanwhile.
    const kept = readCreatedOrganisations().filter(
      (organisation) => !deleted.some((gone) => sameEntry(gone, organisation))
    )
    writeFileSync(
      CREATED_ORGANISATIONS_FILE,
      kept.map((organisation) => `${JSON.stringify(organisation)}\n`).join('')
    )
  }
  return { deleted, failed }
}

/**
 * Deletes one organisation this run created, and takes it off the file. One
 * that fails to delete stays listed, for a later run's clean-up to retry.
 *
 * @param {number} orgId
 */
export async function deleteCreatedOrganisation(orgId) {
  try {
    await assertSuccessResponse(
      await new ReexApi().delete(`/v1/dev/organisations/${orgId}`),
      `DELETE /v1/dev/organisations/${orgId}`
    )
  } catch (err) {
    logRunOrganisation('delete-failed', { orgId }, err.message)
    throw err
  }
  logRunOrganisation('deleted', { orgId })
  const kept = readCreatedOrganisations().filter(
    (organisation) =>
      organisation.orgId !== orgId ||
      organisation.environment !== process.env.ENVIRONMENT
  )
  writeFileSync(
    CREATED_ORGANISATIONS_FILE,
    kept.map((organisation) => `${JSON.stringify(organisation)}\n`).join('')
  )
}
