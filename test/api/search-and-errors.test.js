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
import { readRequestLog } from './request-log.js'
import { assertStatusHistory, statusOf } from './status-history.js'

// What contract.test.js and validation.test.js leave out: the search's status
// filter and order, the scheme years, business keys only, and the errors for
// routes and methods the API does not have. Then the seeded reprocessor's
// site, the overseas sites' status dates (RA-772), siteId as a business key,
// and personal data.
//
// A reprocessor's site is in Re-Ex but not in the API: the v2 spec and the
// guide define no site on an accreditation, so only the seeding is checked.

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
          .filter((item) => statusOf(item) === 'approved')
          .map(({ registrationNumber }) => registrationNumber)
      )
    })

    for (const filter of OTHER_STATUSES) {
      it(`accepts status=${filter} as a search filter`, async () => {
        const { status, body } = await getAccreditationApi(
          `/v1/accreditations?status=${filter}&limit=1`
        )
        assert.equal(status, 200, JSON.stringify(body))
      })

      // RA-702: case management cannot send this status yet, so test has no
      // accreditation to return. Todo until it has one: a known gap in the
      // report until then, then it checks what the filter returns.
      it(
        `returns only ${filter} accreditations for status=${filter}`,
        { todo: `case management cannot send ${filter} yet (RA-702)` },
        async () => {
          const { status, body } = await getAccreditationApi(
            `/v1/accreditations?status=${filter}&limit=100`
          )
          assert.equal(status, 200, JSON.stringify(body))
          assert.ok(
            body.items.length > 0,
            `no ${filter} accreditation on test to check the filter with`
          )
          for (const item of body.items) {
            assert.equal(statusOf(item), filter, item.accreditationNumber)
          }
        }
      )
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
        // By code unit, as the database sorts, not by locale.
        first.toSorted((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
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
      assert.match(
        String(served.accreditationNumber),
        /^A\d{2}/,
        'the served accreditation has no accreditation number'
      )
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

// The ticket's remaining points, as the seeded organisation shows them.
describe(
  'Accreditation API: sites, status dates and personal data',
  { skip: notConfigured },
  () => {
    let context

    before(async () => {
      context = await loadApiContext()
    })

    it("seeds the reprocessor's accreditation with a site", async (t) => {
      if (!requireGranted(t, context.reprocessor, 'reprocessor')) {
        return
      }
      const registration = context.organisation.registrations.find(
        ({ registrationNumber }) =>
          registrationNumber === context.reprocessor.registrationNumber
      )
      assert.ok(registration, 'the reprocessor is not a seeded registration')
      if (registration.siteAddress === undefined) {
        t.skip(
          'the snapshot predates site addresses: rerun the integration tests or set SEEDED_ORGANISATION_ID'
        )
        return
      }
      assert.ok(registration.siteAddress, 'the reprocessor has no site')
      for (const field of ['line1', 'town', 'postcode']) {
        assert.ok(
          typeof registration.siteAddress[field] === 'string' &&
            registration.siteAddress[field],
          `the reprocessor's site has no ${field}`
        )
      }
    })

    // RA-772: an overseas site's approval date is no longer approvedOn (or
    // validFrom) but the status history, each status dated by
    // effectiveFromDate and effectiveToDate.
    it('dates each overseas site by effectiveFromDate and effectiveToDate, not approvedOn', async (t) => {
      if (!requireGranted(t, context.exporter, 'exporter')) {
        return
      }
      const { status, body } = await getAccreditationApi(context.exporter.path)
      assert.equal(status, 200)
      assert.ok(body.overseasSites.length > 0, 'no overseas sites')
      for (const site of body.overseasSites) {
        const what = `site ${site.orsId}`
        for (const field of ['approvedOn', 'validFrom']) {
          assert.ok(!(field in site), `${what} still has ${field}`)
        }
        assert.ok(
          site.statusHistory?.some(({ status: s }) => s === 'approved'),
          `${what} was never approved`
        )
        // Each period runs from effectiveFromDate (the later of 1 January and
        // the UK date recorded) to effectiveToDate (the day before the next
        // starts, null on the latest), checked as contract.test.js checks it.
        assertStatusHistory(site.statusHistory, what, body.accreditationYear)
      }
    })

    // siteId is a business key within its accreditation, across overseas and
    // interim sites, never reused once a site is removed, and not a database
    // id (the guide, since epr-register-enrol-backend#273).
    it('identifies each site by a siteId unique within its accreditation, withdrawn sites included', async (t) => {
      if (!requireGranted(t, context.exporter, 'exporter')) {
        return
      }
      const { status, body } = await getAccreditationApi(
        `${context.exporter.path}?includeWithdrawn=true`
      )
      assert.equal(status, 200)
      const sites = body.overseasSites.flatMap((site) => [
        [`overseas site ${site.orsId ?? site.siteName}`, site.siteId],
        ...(site.interimSites ?? []).map((interim) => [
          `interim site ${interim.siteNumber}`,
          interim.siteId
        ])
      ])
      assert.ok(sites.length > 0, 'no sites')
      const seen = new Map()
      for (const [what, siteId] of sites) {
        assert.ok(Number.isInteger(siteId), `${what} siteId ${siteId}`)
        assert.ok(
          !seen.has(siteId),
          `${what} has siteId ${siteId}, as ${seen.get(siteId)} does`
        )
        seen.set(siteId, what)
      }
    })

    // The API serves signatories and contacts; what the report shows of them
    // (the request log, test/api/request-log.js) is redacted.
    it('serves signatories and contacts, redacted in the report', async (t) => {
      if (!requireGranted(t, context.exporter, 'exporter')) {
        return
      }
      const path = context.exporter.path
      const { status, body } = await getAccreditationApi(path)
      assert.equal(status, 200)

      // [where, the person] for every signatory and contact served.
      const people = (accreditation) => [
        ...(accreditation.signatories ?? []).map((s, i) => [
          `signatories[${i}]`,
          s,
          ['fullName', 'email']
        ]),
        ...(accreditation.overseasSites ?? []).flatMap((site, i) => [
          ...(site.contact
            ? [
                [
                  `overseasSites[${i}].contact`,
                  site.contact,
                  ['fullName', 'email', 'phone']
                ]
              ]
            : []),
          ...(site.interimSites ?? []).flatMap((interim, j) =>
            interim.contact
              ? [
                  [
                    `overseasSites[${i}].interimSites[${j}].contact`,
                    interim.contact,
                    ['fullName', 'email', 'phone']
                  ]
                ]
              : []
          )
        ])
      ]
      const served = people(body)
      assert.ok(body.signatories?.length, 'no signatories served')
      for (const [where, person, fields] of served) {
        for (const field of fields) {
          assert.equal(
            typeof person[field],
            'string',
            `${where}.${field} is not served`
          )
        }
      }

      if (!process.env.ACCREDITATION_API_REQUEST_LOG) {
        t.diagnostic(
          'no request log in this run (run through test/api/run.js), so the redaction is not checked'
        )
        return
      }
      const logged = readRequestLog()
        .filter(({ request }) => request.url.endsWith(path))
        .at(-1)
      assert.ok(logged, `${path} is not in the request log`)
      const redacted = people(logged.response.body)
      assert.equal(redacted.length, served.length)
      for (const [where, person, fields] of redacted) {
        for (const field of fields) {
          if (person[field]) {
            assert.equal(
              person[field],
              '[redacted]',
              `${where}.${field} is not redacted in the report`
            )
          }
        }
      }
    })
  }
)
