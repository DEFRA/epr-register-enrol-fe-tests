import { randomUUID } from 'node:crypto'

import { expect } from '@wdio/globals'
import { skipDockerOnlyOnDeployedEnvironment } from '../helpers/docker-only.js'
import { getLegacyApplicationStatuses } from '../helpers/admin-api.js'
import {
  clearApplicationsFindTimeout,
  failNextApplicationsFindWithTimeout
} from '../helpers/sandbox-mongo.js'

/**
 * RA-751: Search Case management information (epic RA-639).
 *
 * GET /admin/accreditation-application-statuses answers 503 query_timeout,
 * with Retry-After, when MongoDB stops its query for running past the
 * backend's limit (ServiceClients QueryTimeoutSeconds), rather than a bare
 * 500. What this proves end to end that the backend's unit tests do not: that
 * the timeout MongoDB itself reports (MaxTimeMSExpired) reaches the admin
 * client as that 503.
 *
 * MongoDB cannot be made slow for one query, so the sandbox's failCommand fail
 * point answers the backend's next find on the Legacy applications collection
 * with MaxTimeMSExpired. Every spec reads that collection, so this spec is in
 * test/serial-specs: wdio.github.serial.conf.js runs it on its own, after the
 * parallel run, so no other spec's find can take the failure or be failed by
 * it. The fail point is cleared in `after`, which runs even when the test
 * fails.
 */
describe('RA-751: Legacy application statuses when the database times out @docker-only', () => {
  // Set before the fail point is, so `after` clears it even when setting it
  // failed part way.
  let armed = false

  before(function () {
    skipDockerOnlyOnDeployedEnvironment(this)
  })

  after(async () => {
    if (armed) {
      await clearApplicationsFindTimeout()
    }
  })

  it('answers 503 query_timeout with Retry-After when its query times out', async () => {
    armed = true
    const firedBefore = await failNextApplicationsFindWithTimeout()

    const response = await getLegacyApplicationStatuses([randomUUID()])

    // The backend's find, and only it, took the failure.
    expect((await clearApplicationsFindTimeout()) - firedBefore).toBe(1)
    expect(response.status).toBe(503)
    expect(response.contentType).toContain('application/problem+json')
    expect(response.retryAfter).toBe('5')
    expect(response.body.code).toBe('query_timeout')
    expect(response.body.detail).toBe(
      'The request took too long to answer. Try again, with a narrower search if you can.'
    )
  })
})
