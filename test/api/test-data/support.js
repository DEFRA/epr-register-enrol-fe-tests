import assert from 'node:assert/strict'

import { accreditationApiNotConfigured } from '../../helpers/accreditation-api.js'

// Where the fixed test data suite runs: the environments that seed the fixed
// records (TestData__SeedOnStartup in cdp-app-config) and the local compose
// stack, which compose.yml configures to seed them. Not test, whose
// accreditation API test/api/*.test.js covers on a seeded organisation; never
// perf-test or prod, which have no fixed records.
export const ENVIRONMENTS = ['local', 'dev', 'ext-test']

const environment = process.env.ENVIRONMENT

/** Why the suite cannot run here, or false when it can. */
export const notConfigured =
  (!ENVIRONMENTS.includes(environment) &&
    `ENVIRONMENT is ${environment ?? 'not set'}: the fixed test data suite runs on ${ENVIRONMENTS.join(', ')}`) ||
  accreditationApiNotConfigured() ||
  false

/** Asserts a JSON 200 and returns its body. */
export function assertOk(response, what) {
  assert.equal(
    response.status,
    200,
    `${what}: expected 200, got ${response.status}: ${JSON.stringify(response.body)}`
  )
  assert.match(
    response.contentType,
    /^application\/json/,
    `${what} content type`
  )
  return response.body
}

/** Asserts an application/problem+json error with this status and code. */
export function assertProblem(response, status, code) {
  assert.equal(
    response.status,
    status,
    `expected ${status} ${code}, got ${response.status}: ${JSON.stringify(response.body)}`
  )
  assert.match(response.contentType, /application\/problem\+json/)
  const { body } = response
  assert.equal(body.code, code)
  assert.equal(body.status, status, 'problem status')
  assert.equal(typeof body.title, 'string', 'problem title')
  assert.ok(body.detail, 'problem has no detail')
  assert.ok(body.traceId, 'problem has no traceId')
}

/** Asserts a page of results, and returns its items. */
export function assertPage(body, { pageNumber = 1, limit = 20 } = {}) {
  assert.deepEqual(
    Object.keys(body).sort(),
    ['items', 'limit', 'pageNumber', 'totalItems'],
    'page fields'
  )
  assert.equal(body.pageNumber, pageNumber, 'pageNumber')
  assert.equal(body.limit, limit, 'limit')
  assert.ok(Array.isArray(body.items), 'items')
  assert.ok(body.items.length <= limit, 'more items than the limit')
  return body.items
}
