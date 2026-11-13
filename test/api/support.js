import assert from 'node:assert/strict'

import { accreditationYear } from '../config.js'
import {
  accreditationApiNotConfigured,
  accreditationPath,
  getAccreditationApi
} from '../helpers/accreditation-api.js'
import {
  loadOrganisation,
  seededOrganisation
} from '../helpers/integration-organisation/seeded-organisation.js'

// What every test/api file shares: the organisation the frontend integration
// run seeded, and the accreditations that run granted on it.
//
// Which organisation:
//   SEEDED_ORGANISATION_ID=<id>  that organisation, read from Re-Ex (its id,
//                                not its numeric orgId)
//   otherwise                    the one the last integration run seeded and
//                                kept, from .integration/seeded-organisation.json
//                                (npm run test:integration:api keeps it)

export const year = Number(accreditationYear)

export const log = (text) => process.stdout.write(`${text}\n`)

/** Why the tests cannot run here, or false when they can. */
export const notConfigured =
  (process.env.ENVIRONMENT !== 'test' &&
    `ENVIRONMENT is ${process.env.ENVIRONMENT ?? 'not set'}, not test`) ||
  accreditationApiNotConfigured() ||
  false

export const describeRegistration = (registration) =>
  `${registration.wasteProcessingType} ${registration.glassRecyclingProcess ?? registration.material} (${registration.registrationNumber})`

/**
 * The organisation the tests run against.
 *
 * @returns {Promise<import('../helpers/integration-organisation/seeded-organisation.js').SeededOrganisation>}
 */
export async function organisationUnderTest() {
  const id = process.env.SEEDED_ORGANISATION_ID
  if (id) {
    return loadOrganisation(id)
  }
  try {
    return seededOrganisation()
  } catch (err) {
    throw new Error(
      `${err.message}\nRun npm run test:integration:api, or the integration tests with ` +
        'KEEP_SEEDED_ORGANISATIONS=true, or set SEEDED_ORGANISATION_ID to an organisation on test.'
    )
  }
}

/**
 * @typedef {object} ApiContext
 * @property {import('../helpers/integration-organisation/seeded-organisation.js').SeededOrganisation} organisation
 * @property {object[]} served the search result for the organisation: an
 *   accreditation summary for each registration the API serves
 * @property {{registrationNumber: string, path: string} | undefined} reprocessor
 *   the reprocessor accreditation granted, and its path
 * @property {{registrationNumber: string, path: string} | undefined} exporter
 */

/**
 * The organisation and what the API serves for it.
 *
 * @returns {Promise<ApiContext>}
 */
export async function loadApiContext() {
  const organisation = await organisationUnderTest()
  const searchPath = `/v1/accreditations?year=${year}&organisationNumber=${organisation.orgId}&limit=100`
  const response = await getAccreditationApi(searchPath)
  assert.equal(
    response.status,
    200,
    `GET ${searchPath}: ${JSON.stringify(response.body)}`
  )
  const served = response.body.items

  const granted = (type) => {
    const item = served.find(
      ({ wasteProcessingType }) => wasteProcessingType === type
    )
    return (
      item && {
        registrationNumber: item.registrationNumber,
        path: accreditationPath({
          orgId: organisation.orgId,
          registrationNumber: item.registrationNumber,
          year
        })
      }
    )
  }

  return {
    organisation,
    served,
    reprocessor: granted('reprocessor'),
    exporter: granted('exporter')
  }
}

/** Asserts an application/problem+json error with this status and code. */
export function assertProblem(response, status, code) {
  assert.equal(
    response.status,
    status,
    `expected ${status} ${code}, got ${response.status}: ${JSON.stringify(response.body)}`
  )
  assert.match(response.contentType, /application\/problem\+json/)
  assert.equal(response.body.code, code)
  assert.ok(response.body.detail, 'problem has no detail')
  assert.ok(response.body.traceId, 'problem has no traceId')
}

/** Skips a test when the run granted nothing of a type to use. */
export function requireGranted(t, accreditation, type) {
  if (!accreditation) {
    t.skip(`no ${type} accreditation is served for the organisation`)
    return false
  }
  return true
}
