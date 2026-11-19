import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { describe, it } from 'node:test'

import {
  callAccreditationApi as call,
  getAccreditationApi as get,
  signedHeaders,
  timestamp
} from '../../helpers/accreditation-api.js'
import { FIXTURES, detailPath, sitesPath } from './fixtures.js'
import { assertOk, assertProblem, notConfigured } from './support.js'

// The documented errors, each provoked on a fixed record, and the request
// signing the onboarding guide describes.

const exporter = FIXTURES.exporterFibre
const detail = detailPath(exporter)
const sites = sitesPath(exporter)
const searchFor = `/v1/accreditations?organisationNumber=${exporter.orgId}`

describe('Fixed test data: bad input', { skip: notConfigured }, () => {
  for (const [path, code] of [
    [
      `/v1/organisations/abc/registrations/${exporter.registrationNumber}/accreditations/2027`,
      'invalid_organisation_number'
    ],
    [
      `/v1/organisations/${exporter.orgId}/registrations/R26.EX/accreditations/2027`,
      'invalid_registration_number'
    ],
    [
      `/v1/organisations/${exporter.orgId}/registrations/${exporter.registrationNumber}/accreditations/27`,
      'invalid_year'
    ],
    [
      `/v1/organisations/${exporter.orgId}/registrations/${exporter.registrationNumber}/accreditations/abcd`,
      'invalid_year'
    ],
    [`${detail}?includeWithdrawn=yes`, 'invalid_include_withdrawn'],
    [`${sites}?includeWithdrawn=yes`, 'invalid_include_withdrawn'],
    [`${sites}/001?includeWithdrawn=yes`, 'invalid_include_withdrawn'],
    [`${sites}/1`, 'invalid_ors_id'],
    [`${sites}/0001`, 'invalid_ors_id'],
    [`${sites}?limit=101`, 'invalid_paging'],
    [`${sites}?limit=0`, 'invalid_paging'],
    [`${sites}?pageNumber=0`, 'invalid_paging'],
    ['/v1/accreditations?limit=101', 'invalid_paging'],
    ['/v1/accreditations?limit=0', 'invalid_paging'],
    ['/v1/accreditations?pageNumber=0', 'invalid_paging'],
    ['/v1/accreditations?year=abc', 'invalid_year'],
    ['/v1/accreditations?year=1999', 'invalid_year'],
    [
      '/v1/accreditations?organisationNumber=abc',
      'invalid_organisation_number'
    ],
    [
      '/v1/accreditations?registrationNumber=R26.EX',
      'invalid_registration_number'
    ],
    ['/v1/accreditations?status=granted', 'invalid_status']
  ]) {
    it(`answers 400 ${code} for ${path}`, async () => {
      assertProblem(await get(path), 400, code)
    })
  }

  it('accepts limit=100, the largest page', async () => {
    assertOk(await get(`${sites}?limit=100`), 'sites')
    assertOk(await get('/v1/accreditations?limit=100'), 'search')
  })
})

describe('Fixed test data: routes and methods', { skip: notConfigured }, () => {
  it('answers 404 not_found for a route it does not have', async () => {
    assertProblem(await get('/v1/no-such-route'), 404, 'not_found')
  })

  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    for (const path of [detail, '/v1/accreditations', `${sites}/001`]) {
      it(`answers 405 method_not_allowed to ${method} ${path}`, async () => {
        assertProblem(await call(path, { method }), 405, 'method_not_allowed')
      })
    }
  }
})

describe('Fixed test data: signing', { skip: notConfigured }, () => {
  it("signs the guide's worked example to its signature", () => {
    const payload = [
      'v3',
      'example-client',
      '',
      '',
      '2027-01-15T10:30:00Z',
      'bm9uY2UtZXhhbXBsZS0wMDAx'
    ].join('\n')
    assert.equal(
      createHmac('sha256', 'example-secret-do-not-use')
        .update(payload)
        .digest('base64'),
      'mJPc+QOEbTNBzB60Pj2NjSOy8bOYmvoCjCwPQS2CSTk='
    )
  })

  it('serves a request signed as the guide describes', async () => {
    assertOk(await get(searchFor), 'search')
  })

  for (const header of [
    'x-cdp-client-id',
    'x-cdp-auth-timestamp',
    'x-cdp-auth-nonce',
    'x-cdp-auth-signature'
  ]) {
    it(`answers 401 missing_header without ${header}`, async () => {
      const headers = signedHeaders()
      delete headers[header]
      assertProblem(await get(searchFor, { headers }), 401, 'missing_header')
    })
  }

  it('answers 401 unknown_client for a client id it does not know', async () => {
    assertProblem(
      await get(searchFor, {
        headers: signedHeaders({ clientId: 'no-such-client' })
      }),
      401,
      'unknown_client'
    )
  })

  it('answers 401 unknown_client for the client id in another case', async () => {
    assertProblem(
      await get(searchFor, {
        headers: signedHeaders({ clientId: 'epr-reex-client' })
      }),
      401,
      'unknown_client'
    )
  })

  it('answers 401 invalid_timestamp for a timestamp that is not a time', async () => {
    assertProblem(
      await get(searchFor, {
        headers: signedHeaders({ timestamp: 'not-a-date' })
      }),
      401,
      'invalid_timestamp'
    )
  })

  for (const [what, offset] of [
    ['6 minutes behind', -6],
    ['6 minutes ahead of', 6]
  ]) {
    it(`answers 401 expired_timestamp for a timestamp ${what} the clock`, async () => {
      const ts = timestamp(new Date(Date.now() + offset * 60000))
      assertProblem(
        await get(searchFor, { headers: signedHeaders({ timestamp: ts }) }),
        401,
        'expired_timestamp'
      )
    })
  }

  it('serves a timestamp 4 minutes behind the clock, within the 5 allowed', async () => {
    const ts = timestamp(new Date(Date.now() - 4 * 60000))
    assertOk(
      await get(searchFor, { headers: signedHeaders({ timestamp: ts }) }),
      'search'
    )
  })

  it('answers 401 invalid_signature for the wrong secret', async () => {
    assertProblem(
      await get(searchFor, {
        headers: signedHeaders({ secret: 'wrong-secret' })
      }),
      401,
      'invalid_signature'
    )
  })

  it('answers 401 reused_nonce when the same signed request is sent twice', async () => {
    const headers = signedHeaders()
    assertOk(await get(searchFor, { headers }), 'first request')
    assertProblem(await get(searchFor, { headers }), 401, 'reused_nonce')
  })
})
