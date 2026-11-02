import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// A flat file of every accreditation application an integrated run has
// submitted on an organisation it seeded for the purpose, one JSON object per
// line: which organisation, which Defra ID user and Defra organisation it was
// made as, and the application's id and reference. Unlike
// created-organisations.jsonl nothing ever removes a line, so it stays a log
// of what was submitted after the organisation itself has been deleted.

export const ACCREDITATION_APPLICATIONS_FILE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../.integration/accreditation-applications.jsonl'
)

/**
 * @typedef {object} AccreditationApplication
 * @property {number} orgId
 * @property {string} organisationId the organisation's id (not its orgId)
 * @property {string} defraIdEmail the Defra ID user the application was made as
 * @property {string} defraIdUserId the Re-Ex Defra ID stub's id for that user
 * @property {{id: string, name: string}} defraOrganisation the Defra ID
 *   organisation the organisation is linked to
 * @property {string} wasteProcessingType
 * @property {string} material
 * @property {string} registrationNumber
 * @property {string} applicationId
 * @property {string} applicationReference
 */

/** @param {AccreditationApplication} application */
export function recordAccreditationApplication(application) {
  mkdirSync(dirname(ACCREDITATION_APPLICATIONS_FILE), { recursive: true })
  appendFileSync(
    ACCREDITATION_APPLICATIONS_FILE,
    `${JSON.stringify({
      ...application,
      environment: process.env.ENVIRONMENT,
      submittedAt: new Date().toISOString()
    })}\n`
  )
}
