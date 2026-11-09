import { execFileSync } from 'node:child_process'

/**
 * Helpers for the @monorepo specs (test/specs/monorepo), which run from this
 * machine against the DEFRA/epr-register-enrol monorepo's local stack
 * (`docker compose up` at its root) rather than this repo's own sandbox:
 * the operator frontend on localhost:3000, its backend, and the real case
 * management services in place of the sandbox's stub. See wdio.monorepo.conf.js.
 */

export const MONOREPO_TAG = '@monorepo'

/**
 * The stub organisations the specs apply for. Both are e2e test organisations
 * in the operator frontend's stub fixtures (src/server/common/stub-operator-orgs.js),
 * not the dev seed user's own organisation or the perf-test ones, so clearing
 * their applications loses nobody's manual work.
 */
export const MONOREPO_ORGS = {
  reprocessor: {
    organisationId: '50016',
    registrationId: 'aaa000000000000000050016',
    material: 'Plastic',
    name: 'Section Lock Test Recycling Ltd'
  },
  exporter: {
    organisationId: '50015',
    registrationId: 'aaa000000000000000050015',
    material: 'Plastic',
    name: 'Exporter Accreditation Test Exports Ltd'
  }
}

const OPERATOR_DATABASE = 'epr'
const CASE_MANAGEMENT_DATABASE = 'epr-register-case-management'

/**
 * The monorepo's MongoDB container: the compose service named mongodb that
 * publishes 27017 on this machine (this repo's sandbox keeps its MongoDB
 * unpublished, so it never matches). MONOREPO_MONGO_CONTAINER overrides it.
 */
function mongoContainer() {
  if (process.env.MONOREPO_MONGO_CONTAINER) {
    return process.env.MONOREPO_MONGO_CONTAINER
  }

  const ids = execFileSync(
    'docker',
    [
      'ps',
      '--quiet',
      '--filter',
      'label=com.docker.compose.service=mongodb',
      '--filter',
      'publish=27017'
    ],
    { encoding: 'utf8' }
  )
    .split('\n')
    .filter(Boolean)

  if (ids.length !== 1) {
    throw new Error(
      `Expected one running MongoDB container publishing 27017 (the monorepo's), found ${ids.length}. ` +
        'Start the monorepo stack, or set MONOREPO_MONGO_CONTAINER.'
    )
  }
  return ids[0]
}

/**
 * Runs a mongosh script in the monorepo's MongoDB container and returns what
 * it prints as JSON.
 *
 * @param {string} script must end by printing one JSON value
 */
function mongosh(script) {
  const output = execFileSync(
    'docker',
    ['exec', mongoContainer(), 'mongosh', '--quiet', '--eval', script],
    { encoding: 'utf8' }
  )
  return JSON.parse(output.trim().split('\n').pop())
}

/**
 * Deletes every accreditation application the organisation has for the
 * registration, and the case management work items raised for it, so the
 * journey starts from NOT STARTED. Visiting the accreditation page afterwards
 * creates a fresh application.
 *
 * @param {{ organisationId: string, registrationId: string }} org
 * @returns {{ applications: number, workItems: number }} how many were deleted
 */
export function clearApplications({ organisationId, registrationId }) {
  const filter = JSON.stringify({ organisationId, registrationId })
  const workItemFilter = JSON.stringify({
    'payload.operatorRegistrationId': registrationId
  })

  return mongosh(`
    const applications = db.getSiblingDB('${OPERATOR_DATABASE}')
      .accreditationApplications.deleteMany(${filter}).deletedCount
    const workItems = db.getSiblingDB('${CASE_MANAGEMENT_DATABASE}')
      .workItems.deleteMany(${workItemFilter}).deletedCount
    print(JSON.stringify({ applications, workItems }))
  `)
}

/**
 * The case management work items raised for the registration.
 *
 * @param {{ registrationId: string }} org
 * @returns {Array<{ typeId: string, stateId: string, applicationReference: string }>}
 */
export function workItemsFor({ registrationId }) {
  const filter = JSON.stringify({
    'payload.operatorRegistrationId': registrationId
  })

  return mongosh(`
    print(JSON.stringify(
      db.getSiblingDB('${CASE_MANAGEMENT_DATABASE}').workItems
        .find(${filter})
        .toArray()
        .map((w) => ({
          typeId: w.typeId,
          stateId: w.stateId,
          applicationReference: w.payload.applicationReference
        }))
    ))
  `)
}
