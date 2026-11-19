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

// What contract.test.js and validation.test.js leave out: the search's status
// filter and order, the scheme years, business keys only, and the errors for
// routes and methods the API does not have. Then the reprocessor's site, the
// overseas sites' status dates (RA-772) and personal data, and, as a todo
// test, the scope question still open with the backend.

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

// The UK date (yyyy-MM-dd) of a moment, as effectiveFromDate is written.
const ukDate = (moment) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(
    new Date(moment)
  )

// The first day a status applies: the later of 1 January of the accreditation
// year and the UK date it was recorded (RA-772).
function appliesFrom(recordedAt, accreditationYear) {
  const startOfYear = `${accreditationYear}-01-01`
  const recordedOn = ukDate(recordedAt)
  return recordedOn > startOfYear ? recordedOn : startOfYear
}

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
      const startOfYear = `${body.accreditationYear}-01-01`
      for (const site of body.overseasSites) {
        const what = `site ${site.orsId}`
        for (const field of ['approvedOn', 'validFrom']) {
          assert.ok(!(field in site), `${what} still has ${field}`)
        }
        const history = site.statusHistory
        assert.ok(history?.length, `${what} has no status history`)
        const approved = history.find(({ status: s }) => s === 'approved')
        assert.ok(approved, `${what} was never approved`)
        assert.equal(
          approved.effectiveFromDate,
          appliesFrom(approved.recordedAt, body.accreditationYear),
          `${what} approved effectiveFromDate`
        )
        history.forEach((entry, i) => {
          assert.match(entry.effectiveFromDate, DATE_ONLY, what)
          assert.ok(
            entry.effectiveFromDate >= startOfYear,
            `${what} status applies from ${entry.effectiveFromDate}, before ${startOfYear}`
          )
          if (i === history.length - 1) {
            assert.equal(
              entry.effectiveToDate,
              null,
              `${what} latest status has an end date`
            )
          } else {
            assert.match(entry.effectiveToDate, DATE_ONLY, what)
            assert.ok(
              entry.effectiveToDate >= entry.effectiveFromDate,
              `${what} status ends before it starts`
            )
          }
        })
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

// What the ticket asks for and the API does not do yet: reported, saying
// what is missing, without failing the run. Drop the todo once the backend
// team settles it (the report says when it starts passing).
describe(
  'Accreditation API: open scope questions',
  { skip: notConfigured },
  () => {
    let context

    before(async () => {
      context = await loadApiContext()
    })

    it(
      "serves the reprocessor's site on its accreditation",
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
  }
)
