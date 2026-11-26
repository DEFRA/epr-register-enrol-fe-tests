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
