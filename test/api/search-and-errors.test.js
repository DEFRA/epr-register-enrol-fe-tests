import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'

import {
  accreditationPath,
  callAccreditationApi,
  getAccreditationApi
} from '../helpers/accreditation-api.js'
import {
  assertProblem,
  loadApiContext,
  notConfigured,
  requireGranted,
  year
} from './support.js'

// What contract.test.js and validation.test.js leave out: the search's status
// filter and order, the scheme years, business keys only, and the errors for
// routes and methods the API does not have. Then, as todo tests, the scope
// questions still open with the backend: they show in the report, saying
// what is missing, without failing the run.

const OTHER_STATUSES = ['suspended', 'cancelled', 'withdrawn']
// Scheme years start with 2027 (the API serves nothing earlier).
const BEFORE_THE_SCHEME = 2026

// Database ids: _id, id, *Id for the four records, or an ObjectId's 24 hex.
function databaseIds(value, path = '$', found = []) {
  if (Array.isArray(value)) {
    value.forEach((item, i) => databaseIds(item, `${path}[${i}]`, found))
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (
        key === '_id' ||
        key === 'id' ||
        /^(organisation|registration|accreditation|application)Id$/.test(key)
      ) {
        found.push(`${path}.${key}`)
      }
      databaseIds(item, `${path}.${key}`, found)
    }
  } else if (typeof value === 'string' && /^[0-9a-f]{24}$/.test(value)) {
    found.push(`${path} (${value})`)
  }
  return found
}

describe(
  'Accreditation API: search, scheme years and errors',
  { skip: notConfigured },
  () => {
    let context
    let orgId
    const searchFor = (query) =>
      `/v1/accreditations?year=${year}&organisationNumber=${orgId}&limit=100${query}`

    before(async () => {
      context = await loadApiContext()
      orgId = context.organisation.orgId
    })

    it('filters the search by status=approved', async () => {
      const { status, body } = await getAccreditationApi(
        searchFor('&status=approved')
      )
      assert.equal(status, 200)
      assert.deepEqual(
        body.items.map(({ registrationNumber }) => registrationNumber),
        context.served
          .filter(({ status: s }) => s === 'approved')
          .map(({ registrationNumber }) => registrationNumber)
      )
    })

    for (const filter of OTHER_STATUSES) {
      it(`accepts status=${filter} as a search filter`, async () => {
        const { status, body } = await getAccreditationApi(
          `/v1/accreditations?status=${filter}&limit=100`
        )
        assert.equal(status, 200, JSON.stringify(body))
        for (const item of body.items) {
          assert.equal(item.status, filter, item.accreditationNumber)
        }
      })
    }

    it('orders the search by accreditationNumber, the same on every call', async () => {
      const numbers = async () => {
        const { status, body } = await getAccreditationApi(
          `/v1/accreditations?year=${year}&limit=100`
        )
        assert.equal(status, 200)
        return body.items.map(({ accreditationNumber }) => accreditationNumber)
      }
      const first = await numbers()
      assert.deepEqual(
        first,
        first.toSorted((a, b) => a.localeCompare(b)),
        'not ordered by accreditationNumber'
      )
      assert.deepEqual(await numbers(), first, 'the order changed')
    })

    it(`serves no accreditations for ${BEFORE_THE_SCHEME}, before the scheme`, async () => {
      const { status, body } = await getAccreditationApi(
        `/v1/accreditations?year=${BEFORE_THE_SCHEME}`
      )
      assert.equal(status, 200)
      assert.equal(body.totalItems, 0)
      assert.deepEqual(body.items, [])
    })

    it(`answers 404 accreditation_not_found for a ${BEFORE_THE_SCHEME} accreditation`, async (t) => {
      const granted = context.exporter ?? context.reprocessor
      if (!requireGranted(t, granted, 'reprocessor or exporter')) {
        return
      }
      assertProblem(
        await getAccreditationApi(
          accreditationPath({
            orgId,
            registrationNumber: granted.registrationNumber,
            year: BEFORE_THE_SCHEME
          })
        ),
        404,
        'accreditation_not_found'
      )
    })

    it('serves no database ids in the search or an accreditation', async () => {
      const responses = [await getAccreditationApi(searchFor(''))]
      for (const type of ['reprocessor', 'exporter']) {
        if (context[type]) {
          responses.push(await getAccreditationApi(context[type].path))
        }
      }
      const found = responses.flatMap(({ body }) => databaseIds(body))
      assert.deepEqual(found, [], `database ids: ${found.join(', ')}`)
    })

    it('answers 404 not_found for an accreditation by its accreditation number', async (t) => {
      const [served] = context.served
      if (!served) {
        t.skip('no accreditation is served for the organisation')
        return
      }
      assertProblem(
        await getAccreditationApi(
          `/v1/accreditations/${encodeURIComponent(served.accreditationNumber)}`
        ),
        404,
        'not_found'
      )
    })

    it("has no overseas sites for a reprocessor's accreditation", async (t) => {
      if (!requireGranted(t, context.reprocessor, 'reprocessor')) {
        return
      }
      const { status, body } = await getAccreditationApi(
        `${context.reprocessor.path}/overseas-sites`
      )
      // Not found, or none: the guide does not say which.
      assert.ok(
        status === 404 || (status === 200 && body.totalItems === 0),
        `${status}: ${JSON.stringify(body)}`
      )
    })

    it('answers 404 not_found as problem+json for a route it does not have', async () => {
      assertProblem(
        await getAccreditationApi('/v1/no-such-route'),
        404,
        'not_found'
      )
    })

    it('answers 405 method_not_allowed as problem+json to POST a search', async () => {
      assertProblem(
        await callAccreditationApi('/v1/accreditations', { method: 'POST' }),
        405,
        'method_not_allowed'
      )
    })

    it('answers 405 method_not_allowed as problem+json to DELETE an accreditation', async (t) => {
      const granted = context.exporter ?? context.reprocessor
      if (!requireGranted(t, granted, 'reprocessor or exporter')) {
        return
      }
      assertProblem(
        await callAccreditationApi(granted.path, { method: 'DELETE' }),
        405,
        'method_not_allowed'
      )
    })
  }
)

// Each is what the ticket asks for and the API does not do yet. Drop the todo
// once the backend team settles it (the report says when one starts passing).
describe(
  'Accreditation API: open scope questions',
  { skip: notConfigured },
  () => {
    let context

    before(async () => {
      context = await loadApiContext()
    })

    it(
      "gives a reprocessor's accreditation its site",
      {
        todo: 'the ticket says reprocessors have a site; the v2 spec defines no site'
      },
      async (t) => {
        if (!requireGranted(t, context.reprocessor, 'reprocessor')) {
          return
        }
        const { body } = await getAccreditationApi(context.reprocessor.path)
        assert.ok('site' in body, 'the accreditation has no site')
      }
    )

    it(
      'gives each overseas site the date it was approved (approvedOn)',
      {
        todo: 'the ticket asks for approvedOn; the API serves only the status history'
      },
      async (t) => {
        if (!requireGranted(t, context.exporter, 'exporter')) {
          return
        }
        const { body } = await getAccreditationApi(context.exporter.path)
        const missing = body.overseasSites.filter(
          (site) => !('approvedOn' in site)
        )
        assert.equal(
          missing.length,
          0,
          `${missing.length} of ${body.overseasSites.length} sites have no approvedOn`
        )
      }
    )

    it(
      'serves no signatories or contacts (personal data)',
      {
        todo: 'the ticket keeps contacts and signatories out of ReEx responses; the API and spec still serve them'
      },
      async (t) => {
        const granted = context.exporter ?? context.reprocessor
        if (!requireGranted(t, granted, 'reprocessor or exporter')) {
          return
        }
        const { body } = await getAccreditationApi(granted.path)
        const found = []
        if (body.signatories?.length) {
          found.push(`${body.signatories.length} signatories`)
        }
        for (const site of body.overseasSites ?? []) {
          if (site.contact) {
            found.push(`overseas site ${site.orsId} contact`)
          }
          for (const interim of site.interimSites ?? []) {
            if (interim.contact) {
              found.push(`interim site ${interim.siteNumber} contact`)
            }
          }
        }
        assert.deepEqual(found, [], `personal data served: ${found.join(', ')}`)
      }
    )
  }
)
