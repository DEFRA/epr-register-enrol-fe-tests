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

// A flat file of every organisation an integrated run has seeded and not yet
// deleted, one JSON object per line. Seeding appends to it as soon as an
// organisation exists, and the end of the run deletes everything it lists
// through epr-backend's non-prod DELETE /v1/dev/organisations/{orgId}.
//
// An organisation that fails to delete stays listed, so the next run's
// clean-up retries it, as does one left behind by a run that died before it
// got to clean up. Organisations reused through SEEDED_ORGANISATION_ID are
// never listed: only what a run created is a run's to delete.

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
 */

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
      createdAt: new Date().toISOString()
    })}\n`
  )
}

/**
 * Deletes every organisation the file lists for this ENVIRONMENT, and rewrites
 * it with only those that could not be deleted (and any for other
 * environments, which this run cannot reach).
 *
 * @returns {Promise<{deleted: CreatedOrganisation[], failed: {organisation: CreatedOrganisation, error: string}[]}>}
 */
export async function deleteCreatedOrganisations() {
  const environment = process.env.ENVIRONMENT
  const listed = readCreatedOrganisations()
  const api = new ReexApi()
  const deleted = []
  const failed = []
  const kept = []

  for (const organisation of listed) {
    if (organisation.environment !== environment) {
      kept.push(organisation)
      continue
    }
    try {
      await assertSuccessResponse(
        await api.delete(`/v1/dev/organisations/${organisation.orgId}`),
        `DELETE /v1/dev/organisations/${organisation.orgId}`
      )
      deleted.push(organisation)
    } catch (err) {
      failed.push({ organisation, error: err.message })
      kept.push(organisation)
    }
  }

  if (listed.length) {
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
  await assertSuccessResponse(
    await new ReexApi().delete(`/v1/dev/organisations/${orgId}`),
    `DELETE /v1/dev/organisations/${orgId}`
  )
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
