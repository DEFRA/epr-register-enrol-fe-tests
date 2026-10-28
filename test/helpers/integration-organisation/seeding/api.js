import { FormData, request } from 'undici'

import config from './config.js'

// The HTTP client, Entra token client and response checks the seeding calls
// share. Ported from epr-re-ex-journey-tests (test/apis/base-api.js,
// test/support/auth.js, test/support/response-assertions.js).

export class ReexApi {
  constructor() {
    this.baseUrl = config.apiUri
    this.defaultHeaders = config.apiHeaders
  }

  get(endpoint, headers = {}) {
    return this.#call('GET', endpoint, undefined, headers)
  }

  post(endpoint, data, headers = {}) {
    return this.#call('POST', endpoint, data, headers)
  }

  put(endpoint, data, headers = {}) {
    return this.#call('PUT', endpoint, data, headers)
  }

  async #call(method, endpoint, data, headers) {
    const { statusCode, body } = await request(`${this.baseUrl}${endpoint}`, {
      method,
      headers: { ...this.defaultHeaders, ...headers },
      body: data,
      dispatcher: config.dispatcher
    })
    return { statusCode, body }
  }
}

function requireValue(value, variableName) {
  if (!value) {
    throw new Error(
      `${variableName} is not set. This run signs in to real Entra, not its stub.`
    )
  }
  return value
}

// Signs in as the regulator (EA) identity, which the organisation read and the
// non-prod organisation PUT both require.
export class EntraAuthClient {
  async authenticate() {
    let body
    let url
    if (config.usesRealEntra) {
      body = new FormData()
      body.append('client_id', config.auth.clientId)
      body.append(
        'client_secret',
        requireValue(config.auth.clientSecret, 'ENTRA_CLIENT_SECRET')
      )
      body.append(
        'username',
        requireValue(config.auth.username, 'ENTRA_USERNAME')
      )
      body.append(
        'password',
        requireValue(config.auth.password, 'ENTRA_PASSWORD')
      )
      body.append('scope', config.auth.scope)
      body.append('grant_type', config.auth.grantType)
      url = config.authUri
    } else {
      body = JSON.stringify({
        clientId: 'clientId',
        username: config.auth.username
      })
      url = `${config.authUri}/sign`
    }

    const response = await request(url, {
      method: 'POST',
      headers: { ...config.apiHeaders },
      body,
      dispatcher: config.dispatcher
    })
    const json = await response.body.json()
    if (!json.access_token) {
      throw new Error(
        `Entra sign-in at ${url} returned ${response.statusCode} with no access_token`
      )
    }
    this.accessToken = json.access_token
  }

  authHeader() {
    return this.accessToken
      ? { Authorization: `Bearer ${this.accessToken}` }
      : {}
  }
}

// Reads the body as text, not JSON, on failure: a gateway or HTML error page
// would otherwise throw on parse and lose the status code being reported.
export async function assertStatus(response, expectedStatusCode, context) {
  if (response.statusCode === expectedStatusCode) {
    return response.body.text()
  }
  throw new Error(
    `${context}: expected ${expectedStatusCode} but got ${response.statusCode}\n${await response.body.text()}`
  )
}

export async function assertSuccessResponse(response, context) {
  const text = await response.body.text()
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(
      `${context}: expected 2xx but got ${response.statusCode}\n${text}`
    )
  }
  return text ? JSON.parse(text) : null
}
