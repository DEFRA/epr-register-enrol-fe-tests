import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'

import {
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

  before(async () => {
    const { orgId } = await organisationUnderTest()
    path = `/v1/accreditations?year=${year}&organisationNumber=${orgId}`
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

  it(
    "answers 401 invalid_signature for another client's secret",
    {
      skip:
        !process.env.ACCREDITATION_API_OTHER_CLIENT_SECRET &&
        'ACCREDITATION_API_OTHER_CLIENT_SECRET is not set'
    },
    async () => {
      assertProblem(
        await getAccreditationApi(path, {
          headers: signedHeaders({
            secret: process.env.ACCREDITATION_API_OTHER_CLIENT_SECRET
          })
        }),
        401,
        'invalid_signature'
      )
    }
  )

  it('answers 405 to anything but GET', async () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const response = await callAccreditationApi(path, { method })
      assert.equal(response.status, 405, method)
    }
  })
})
