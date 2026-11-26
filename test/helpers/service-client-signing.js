import { createHmac, randomBytes } from 'node:crypto'

// Signs a request to one of epr-register-enrol-backend's service-client APIs
// (the /v1 accreditation API and the /admin API), as docs/reex-api-onboarding.md
// in that repo describes: HMAC-SHA256 over "v3", the client id, two empty
// lines, the timestamp and a nonce. Shared by accreditation-api.js (ReEx and
// other readers) and admin-api.js (the admin service client).

// yyyy-MM-ddTHH:mm:ssZ, the only form the guide documents.
export const timestamp = (date = new Date()) =>
  date.toISOString().replace(/\.\d{3}Z$/, 'Z')

/**
 * The four auth headers for one request.
 *
 * @param {object} parts
 * @param {string} parts.clientId
 * @param {string} parts.secret
 * @param {string} [parts.timestamp] default now
 * @param {string} [parts.nonce] default 16 random bytes, base64
 */
export function serviceClientHeaders({
  clientId,
  secret,
  timestamp: ts = timestamp(),
  nonce = randomBytes(16).toString('base64')
}) {
  if (!clientId || !secret) {
    throw new Error('A signed request needs both a client id and a secret')
  }
  const payload = ['v3', clientId, '', '', ts, nonce].join('\n')
  return {
    'x-cdp-client-id': clientId,
    'x-cdp-auth-timestamp': ts,
    'x-cdp-auth-nonce': nonce,
    'x-cdp-auth-signature': createHmac('sha256', secret)
      .update(payload)
      .digest('base64')
  }
}
