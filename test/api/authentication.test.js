import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { before, describe, it } from 'node:test'

import {
  accreditationPath,
  callAccreditationApi,
  getAccreditationApi,
  signedHeaders,
  timestamp
} from '../helpers/accreditation-api.js'
import {
  assertProblem,
  notConfigured,
  organisationUnderTest,
  year
} from './support.js'

// Request signing (docs/reex-api-onboarding.md in epr-register-enrol-backend),
// against a search for the seeded organisation's accreditations: a request
// the API serves when it is signed properly, refused for each way it is not.
// A search is 200 whether or not the frontend run granted anything, so these
// do not depend on it.

describe('Accreditation API: authentication', { skip: notConfigured }, () => {
  let path
  let organisation

  before(async () => {
    organisation = await organisationUnderTest()
    path = `/v1/accreditations?year=${year}&organisationNumber=${organisation.orgId}`
  })

  it('signs the worked example from the guide', () => {
    const headers = signedHeaders({
      clientId: 'example-client',
      secret: 'example-secret-do-not-use',
      timestamp: '2027-01-15T10:30:00Z',
      nonce: 'bm9uY2UtZXhhbXBsZS0wMDAx'
    })
    assert.equal(
      headers['x-cdp-auth-signature'],
      'mJPc+QOEbTNBzB60Pj2NjSOy8bOYmvoCjCwPQS2CSTk='
    )
  })

  it('serves a properly signed request', async () => {
    const response = await getAccreditationApi(path)
    assert.equal(response.status, 200)
  })

  it('answers 401 missing_header with no auth headers', async () => {
    assertProblem(
      await getAccreditationApi(path, { signed: false }),
      401,
      'missing_header'
    )
  })

  it('answers 401 unknown_client for a client it does not know', async () => {
    assertProblem(
      await getAccreditationApi(path, {
        headers: signedHeaders({ clientId: 'no-such-client' })
      }),
      401,
      'unknown_client'
    )
  })

  it('answers 401 invalid_signature for the wrong secret', async () => {
    assertProblem(
      await getAccreditationApi(path, {
        headers: signedHeaders({ secret: 'not-the-secret' })
      }),
      401,
      'invalid_signature'
    )
  })

  it('answers 401 invalid_timestamp for a timestamp that is not a date', async () => {
    assertProblem(
      await getAccreditationApi(path, {
        headers: signedHeaders({ timestamp: 'not-a-timestamp' })
      }),
      401,
      'invalid_timestamp'
    )
  })

  it('answers 401 expired_timestamp for a timestamp 10 minutes old', async () => {
    assertProblem(
      await getAccreditationApi(path, {
        headers: signedHeaders({
          timestamp: timestamp(new Date(Date.now() - 10 * 60 * 1000))
        })
      }),
      401,
      'expired_timestamp'
    )
  })

  it('answers 401 reused_nonce when the same signed request is replayed', async () => {
    const headers = signedHeaders()
    assert.equal((await getAccreditationApi(path, { headers })).status, 200)
    assertProblem(
      await getAccreditationApi(path, { headers }),
      401,
      'reused_nonce'
    )
  })

  it("answers 401 invalid_signature for another client's secret", async () => {
    // A dummy secret shaped like a real one (32 random bytes, base64), new
    // each run: our client id, signed with a secret that is not its own.
    const otherClientSecret = randomBytes(32).toString('base64')
    assertProblem(
      await getAccreditationApi(path, {
        headers: signedHeaders({ secret: otherClientSecret })
      }),
      401,
      'invalid_signature'
    )
  })

  it('answers 405 to anything but GET', async () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const response = await callAccreditationApi(path, { method })
      assert.equal(response.status, 405, method)
    }
  })
  // An unknown route, or a method other than GET, is answered before the
  // signature is checked: it reveals nothing beyond the published API (the
  // guide, since epr-register-enrol-backend#273). Every route that returns
  // data checks the signature first.
  describe('what is answered before authentication', () => {
    it('answers 404 not_found to an unsigned request for a route it does not have', async () => {
      assertProblem(
        await getAccreditationApi('/v1/no-such-route', { signed: false }),
        404,
        'not_found'
      )
    })

    it('answers 405 method_not_allowed to an unsigned request with a method other than GET', async () => {
      assertProblem(
        await callAccreditationApi(path, { method: 'DELETE', signed: false }),
        405,
        'method_not_allowed'
      )
    })

    it('answers 401 missing_header to an unsigned request on every route that returns data', async () => {
      const accreditation = accreditationPath({
        orgId: organisation.orgId,
        registrationNumber: organisation.registrations[0].registrationNumber,
        year
      })
      for (const route of [
        path,
        accreditation,
        `${accreditation}/overseas-sites`,
        `${accreditation}/overseas-sites/001`
      ]) {
        const response = await getAccreditationApi(route, { signed: false })
        assert.equal(
          response.status,
          401,
          `GET ${route} unsigned: ${response.status} ${JSON.stringify(response.body)}`
        )
        assert.equal(response.body.code, 'missing_header', route)
      }
    })
  })
})
