import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { request } from 'undici'

import { backendUrl } from '../config.js'
import { serviceClientHeaders } from './service-client-signing.js'

// RA-751: direct calls to epr-register-enrol-backend's /admin API, the
// read-only API the internal Admin UI (epr-register-enrol-admin) reads
// through, signed as one of the service clients this suite's compose stack
// registers on the backend. Their ids and secrets are read from the backend's
// env file, so the stack and the specs cannot disagree, and a client missing
// from it fails the spec rather than signing with something made up.
//
// Only usable against this repo's docker-compose sandbox: a deployed
// environment's admin secret is a CDP secret this suite does not hold, so
// specs that use this are @docker-only.

const operatorBackendEnvFile = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../docker/config/operator-be.env'
)

function operatorBackendSetting(name) {
  const line = readFileSync(operatorBackendEnvFile, 'utf8')
    .split('\n')
    .find((candidate) => candidate.startsWith(`${name}=`))
  const value = line?.slice(name.length + 1).trim()
  if (!value) {
    throw new Error(`${name} is not set in ${operatorBackendEnvFile}`)
  }
  return value
}

/**
 * A service client registered in operator-be.env, by the index N of its
 * ServiceClients__Clients__N__* entries.
 *
 * @param {number} index
 * @returns {{ name: string, clientId: string, secret: string }}
 */
function serviceClient(index) {
  const name = operatorBackendSetting(`ServiceClients__Clients__${index}__Name`)
  return {
    name,
    clientId: operatorBackendSetting(
      `ServiceClients__Clients__${index}__ClientId`
    ),
    secret: operatorBackendSetting(
      `AUTH_SHARED_SECRET__${name.toUpperCase().replaceAll('-', '_')}`
    )
  }
}

/** The admin service client: the only one the /admin routes accept. */
export const adminClient = () => serviceClient(0)

/** Another known service client, which the /admin routes must refuse. */
export const nonAdminClient = () => serviceClient(1)

/**
 * GETs a path on the backend's /admin API.
 *
 * @param {string} path e.g. /admin/accreditation-application-statuses?workItemId=...
 * @param {object} [options]
 * @param {{ clientId: string, secret: string } | null} [options.client] the
 *   client to sign as (default the admin client); null sends it unsigned
 * @returns {Promise<{status: number, contentType: string, body: any}>}
 */
export async function getAdminApi(path, { client = adminClient() } = {}) {
  const { statusCode, headers, body } = await request(`${backendUrl}${path}`, {
    headers: client ? serviceClientHeaders(client) : {}
  })
  const text = await body.text()
  return {
    status: statusCode,
    contentType: String(headers['content-type']),
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
