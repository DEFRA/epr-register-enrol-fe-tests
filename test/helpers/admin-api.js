import { expect } from '@wdio/globals'
import { request } from 'undici'

import { adminApiClient, backendUrl } from '../config.js'
import { serviceClientHeaders } from './service-client-signing.js'

// RA-751: direct calls to epr-register-enrol-backend's /admin API, the
// read-only API the internal Admin UI (epr-register-enrol-admin) reads
// through, signed as one of the service clients this suite's compose stack
// registers on the backend (test/config.js reads their ids and secrets from
// the environment).
//
// Only usable against this repo's docker-compose sandbox: a deployed
// environment's admin secret is a CDP secret this suite does not hold, so
// specs that use this are @docker-only.

/**
 * GETs a path on the backend's /admin API.
 *
 * @param {string} path e.g. /admin/accreditation-application-statuses?workItemId=...
 * @param {object} [options]
 * @param {{ clientId: string, secret: string } | null} [options.client] the
 *   client to sign as (default the admin client); null sends it unsigned
 * @returns {Promise<{status: number, contentType: string, retryAfter: string | undefined, body: any}>}
 */
export async function getAdminApi(path, { client = adminApiClient() } = {}) {
  const { statusCode, headers, body } = await request(`${backendUrl}${path}`, {
    headers: client ? serviceClientHeaders(client) : {}
  })
  const text = await body.text()
  return {
    status: statusCode,
    contentType: String(headers['content-type']),
    retryAfter: headers['retry-after'],
    body: text ? JSON.parse(text) : null
  }
}

/**
 * Asserts an /admin response is an application/problem+json error.
 *
 * @param {Awaited<ReturnType<typeof getAdminApi>>} response
 * @param {number} status
 * @param {string} code
 * @param {string} [detail] the exact text, or omitted where only its presence
 *   is asserted (a problem that is not the route's own, such as the
 *   service-client authentication in front of /admin, or one whose wording
 *   the spec does not pin)
 */
export function expectProblem(response, status, code, detail) {
  expect(response.status).toBe(status)
  expect(response.contentType).toContain('application/problem+json')
  expect(response.body.code).toBe(code)
  if (detail) {
    expect(response.body.detail).toBe(detail)
  } else {
    expect(response.body.detail).toBeTruthy()
  }
}

/**
 * GETs the Legacy accreditation application status of each case management
 * work item, in one batch.
 *
 * @param {string[]} workItemIds
 * @param {object} [options] as getAdminApi
 */
export function getLegacyApplicationStatuses(workItemIds, options) {
  const query = new URLSearchParams(
    workItemIds.map((workItemId) => ['workItemId', workItemId])
  )
  return getAdminApi(
    `/admin/accreditation-application-statuses?${query}`,
    options
  )
}

/**
 * GETs the table of which application status each case management push sets.
 *
 * @param {object} [options] as getAdminApi
 */
export const getCaseManagementStatusMapping = (options) =>
  getAdminApi('/admin/case-management-status-mapping', options)

/**
 * RA-753: the Operator journey record types the Admin UI searches, each read
 * from its own domain model collection under /admin/operator-journey/.
 */
export const OPERATOR_JOURNEY_RECORD_TYPES = [
  'accreditations',
  'accreditation-applications',
  'registrations',
  'organisations',
  'overseas-sites'
]

/**
 * RA-753: searches one Operator journey record type.
 *
 * @param {string} type one of OPERATOR_JOURNEY_RECORD_TYPES
 * @param {Record<string, string | number | boolean | Array<string | number | boolean>>} [params]
 *   q, searchFields, the type's filters, pageNumber and limit; an array
 *   sends that parameter once per value
 * @param {object} [options] as getAdminApi
 */
export function searchOperatorJourney(type, params = {}, options) {
  if (!OPERATOR_JOURNEY_RECORD_TYPES.includes(type)) {
    throw new Error(`${type} is not an Operator journey record type`)
  }
  const query = new URLSearchParams(
    Object.entries(params).flatMap(([name, value]) =>
      [value].flat().map((each) => [name, String(each)])
    )
  )
  return getAdminApi(`/admin/operator-journey/${type}?${query}`, options)
}

/**
 * RA-753: the countries current overseas sites hold, for the country filter.
 *
 * @param {object} [options] as getAdminApi
 */
export const getOverseasSiteCountries = (options) =>
  getAdminApi('/admin/operator-journey/overseas-site-countries', options)
