import { createHmac, randomBytes } from 'node:crypto'

import { request } from 'undici'

import seedingConfig from './integration-organisation/seeding/config.js'

// A client for epr-register-enrol-backend's read-only accreditation API, the
// one ReEx and other service clients read granted accreditations from. Every
// request is signed as docs/reex-api-onboarding.md in that repo describes
// (HMAC-SHA256 over "v3", the client id, two empty lines, the timestamp and
// a nonce).
//
// ACCREDITATION_API_CLIENT_SECRET  the client's secret; without it the tests
//                                  that use this skip (test/api)
// ACCREDITATION_API_CLIENT_ID      the client id (default epr-ReEx-Client, the
//                                  client every environment registers)
// ACCREDITATION_API_URL            overrides the base URL below
//
// From outside CDP the backend answers 403, so with X_API_KEY (a CDP developer
// API key, as seeding uses) requests go through the ephemeral-protected
// gateway instead. Without it, requests go to the backend directly, through
// HTTP_PROXY when set.

const environment = process.env.ENVIRONMENT

function baseUrl() {
  if (process.env.ACCREDITATION_API_URL) {
    return process.env.ACCREDITATION_API_URL
  }
  if (process.env.X_API_KEY) {
    return `https://ephemeral-protected.api.${environment}.cdp-int.defra.cloud/epr-register-enrol-backend`
  }
  return `https://epr-register-enrol-backend.${environment}.cdp-int.defra.cloud`
}

const clientId = () =>
  process.env.ACCREDITATION_API_CLIENT_ID || 'epr-ReEx-Client'
const clientSecret = () => process.env.ACCREDITATION_API_CLIENT_SECRET

/** Why the API cannot be called, or undefined when it can. */
export function accreditationApiNotConfigured() {
  return clientSecret()
    ? undefined
    : 'ACCREDITATION_API_CLIENT_SECRET is not set, so the accreditation API cannot be called'
}

// yyyy-MM-ddTHH:mm:ssZ, the only form the guide documents.
export const timestamp = (date = new Date()) =>
  date.toISOString().replace(/\.\d{3}Z$/, 'Z')

/**
 * The four auth headers, signed as the guide describes. Each part can be
 * overridden, so a test can send a request the API must refuse.
 *
 * @param {object} [overrides]
 * @param {string} [overrides.clientId]
 * @param {string} [overrides.secret]
 * @param {string} [overrides.timestamp]
 * @param {string} [overrides.nonce]
 */
export function signedHeaders(overrides = {}) {
  const id = overrides.clientId ?? clientId()
  const secret = overrides.secret ?? clientSecret()
  const ts = overrides.timestamp ?? timestamp()
  const nonce = overrides.nonce ?? randomBytes(16).toString('base64')
  const payload = ['v3', id, '', '', ts, nonce].join('\n')
  return {
    'x-cdp-client-id': id,
    'x-cdp-auth-timestamp': ts,
    'x-cdp-auth-nonce': nonce,
    'x-cdp-auth-signature': createHmac('sha256', secret)
      .update(payload)
      .digest('base64')
  }
}

/**
 * Calls a path on the API.
 *
 * @param {string} path e.g. /v1/accreditations?year=2027
 * @param {object} [options]
 * @param {string} [options.method] default GET
 * @param {boolean} [options.signed] sign the request (default true)
 * @param {Record<string, string>} [options.headers] auth headers to send
 *   instead of signing, e.g. signedHeaders({ secret: 'wrong' }), or the same
 *   headers again to replay a nonce
 * @returns {Promise<{status: number, contentType: string, body: any}>}
 */
export async function callAccreditationApi(
  path,
  { method = 'GET', signed = true, headers: authHeaders } = {}
) {
  const { statusCode, headers, body } = await request(`${baseUrl()}${path}`, {
    method,
    headers: {
      ...(process.env.X_API_KEY && { 'x-api-key': process.env.X_API_KEY }),
      ...(authHeaders ?? (signed && signedHeaders()))
    },
    dispatcher: seedingConfig.dispatcher
  })
  const text = await body.text()
  let parsed = text
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    // Not JSON: a gateway's error page, say. Kept as text for the report.
  }
  return {
    status: statusCode,
    contentType: String(headers['content-type'] ?? ''),
    body: parsed
  }
}

/** GETs a path on the API: callAccreditationApi with GET. */
export const getAccreditationApi = (path, options = {}) =>
  callAccreditationApi(path, { ...options, method: 'GET' })

/** The path of one accreditation. */
export const accreditationPath = ({ orgId, registrationNumber, year }) =>
  `/v1/organisations/${orgId}/registrations/${encodeURIComponent(registrationNumber)}/accreditations/${year}`
