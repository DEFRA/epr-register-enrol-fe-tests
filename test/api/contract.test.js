import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'

import { getAccreditationApi } from '../helpers/accreditation-api.js'
import {
  loadApiContext,
  notConfigured,
  requireGranted,
  year
} from './support.js'

// The response shapes, as docs/openapi/registration-accreditation-api.v2.yaml
// in epr-register-enrol-backend describes them (v2, RA-644; an exporter's
// sites inlined in the accreditation since RA-647), checked on the seeded
// organisation's granted accreditations.

const MATERIALS = [
  'Steel',
  'Wood',
  'Aluminium',
  'Fibre',
  'Glass',
  'Paper',
  'Plastic'
]
const STATUSES = ['approved', 'suspended', 'cancelled']
const BANDS = ['up_to_500', 'up_to_5000', 'up_to_10000', 'over_10000']
const GLASS = ['glass_re_melt', 'glass_other']
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

// Today in the UK, as effectiveDate is written.
const todayUk = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/London'
}).format(new Date())

function assertAbsent(object, fields, what) {
  for (const field of fields) {
    assert.ok(!(field in object), `${what} should not have ${field}`)
  }
}

function assertOneOf(value, allowed, what) {
  assert.ok(
    allowed.includes(value),
    `${what} ${value} is not one of ${allowed}`
  )
}

function assertStatusHistory(history, what) {
  assert.ok(
    Array.isArray(history) && history.length > 0,
    `${what} has no statusHistory`
  )
  for (const entry of history) {
    assertOneOf(entry.status, STATUSES, `${what} status`)
    assert.match(entry.effectiveDate, DATE_ONLY, `${what} effectiveDate`)
    assert.match(entry.recordedAt, DATE_TIME, `${what} recordedAt`)
  }
}

// The latest entry effective on or before today; approved when none is yet,
// as the backend projects it.
function projectedStatus(history) {
  const effective = history
    .filter((entry) => entry.effectiveDate <= todayUk)
    .sort(
      (a, b) =>
        a.effectiveDate.localeCompare(b.effectiveDate) ||
        a.recordedAt.localeCompare(b.recordedAt)
    )
  return effective.at(-1)?.status ?? 'approved'
}

function assertSummary(item) {
  assert.equal(typeof item.organisationNumber, 'number')
  assert.equal(typeof item.registrationNumber, 'string')
  assert.equal(typeof item.accreditationNumber, 'string')
  assert.equal(typeof item.accreditationYear, 'number')
  assertOneOf(item.material, MATERIALS, 'material')
  assertOneOf(item.wasteProcessingType, ['reprocessor', 'exporter'], 'type')
  assertOneOf(item.status, STATUSES, 'status')
  if ('tonnageBand' in item) {
    assertOneOf(item.tonnageBand, BANDS, 'tonnageBand')
  }
  if ('glassRecyclingProcess' in item) {
    assertOneOf(item.glassRecyclingProcess, GLASS, 'glassRecyclingProcess')
  }
  // v1 names and application data, removed in v2.
  assertAbsent(
    item,
    [
      'accreditationReference',
      'year',
      'prnIssuance',
      'businessPlan',
      'siteAddress',
      'submitterContactDetails',
      'applicationStatus',
      'samplingPlan',
      'samplingInspectionPlan',
      'besEvidence',
      'formSubmissionTime'
    ],
    'accreditation'
  )
}

function assertInterimSite(site, includeWithdrawn) {
  assert.equal(typeof site.siteId, 'number')
  assert.equal(typeof site.siteNumber, 'string')
  assert.equal(typeof site.siteName, 'string')
  for (const field of ['line1', 'town', 'country']) {
    assert.equal(
      typeof site.address?.[field],
      'string',
      `interim address.${field}`
    )
  }
  for (const field of ['fullName', 'email', 'phone']) {
    assert.equal(
      typeof site.contact?.[field],
      'string',
      `interim contact.${field}`
    )
  }
  assert.ok(Array.isArray(site.operationCodes))
  assertAbsent(
    site,
    ['isNewSite', 'addressLine1', 'contactName'],
    'interim site'
  )
  if ('removedAt' in site) {
    assert.ok(
      includeWithdrawn,
      `withdrawn interim site ${site.siteName} returned`
    )
    assert.match(site.removedAt, DATE_TIME)
  }
}

function assertOverseasSite(site, includeWithdrawn = false) {
  const what = `site ${site.orsId ?? site.siteName}`
  assert.equal(typeof site.siteId, 'number')
  if (site.orsId) {
    assert.match(site.orsId, /^\d{3}$/)
  }
  assert.equal(typeof site.siteName, 'string')
  assert.ok(Array.isArray(site.operationCodes))
  assert.equal(typeof site.isEu, 'boolean')
  assert.equal(typeof site.isOecd, 'boolean')
  if ('address' in site) {
    assert.equal(typeof site.address, 'object')
  }
  if ('contact' in site) {
    assert.equal(typeof site.contact, 'object')
  }
  if ('validFrom' in site) {
    assert.match(site.validFrom, DATE_TIME)
  }
  assertOneOf(site.status, STATUSES, `${what} status`)
  assertStatusHistory(site.statusHistory, what)
  assert.equal(
    site.status,
    projectedStatus(site.statusHistory),
    `${what} status`
  )
  assert.ok(Array.isArray(site.interimSites))
  for (const interim of site.interimSites) {
    assertInterimSite(interim, includeWithdrawn)
  }
  assertAbsent(
    site,
    [
      'code1',
      'code2',
      'code3',
      'isNewSite',
      'selected',
      'registeredNowAccredited',
      'interimSiteIds',
      'siteAddress'
    ],
    what
  )
}

describe(
  'Accreditation API: v2 response shapes',
  { skip: notConfigured },
  () => {
    let context

    before(async () => {
      context = await loadApiContext()
    })

    for (const type of ['reprocessor', 'exporter']) {
      it(`returns the ${type} accreditation in the v2 shape`, async (t) => {
        if (!requireGranted(t, context[type], type)) {
          return
        }
        const { status, body } = await getAccreditationApi(context[type].path)
        assert.equal(status, 200)

        assertSummary(body)
        assertStatusHistory(body.statusHistory, 'accreditation')
        assert.equal(body.status, projectedStatus(body.statusHistory))

        assert.ok(Array.isArray(body.tonnageBandHistory))
        for (const entry of body.tonnageBandHistory) {
          assertOneOf(entry.tonnageBand, BANDS, 'tonnageBandHistory')
          assert.match(entry.recordedAt, DATE_TIME)
          assert.ok(
            !('effectiveDate' in entry),
            'a tonnage band cannot be dated'
          )
        }
        if (body.tonnageBandHistory.length) {
          assert.equal(
            body.tonnageBand,
            body.tonnageBandHistory.at(-1).tonnageBand
          )
        } else {
          assert.ok(!('tonnageBand' in body))
        }

        assert.ok(Array.isArray(body.signatories))
        for (const signatory of body.signatories) {
          assert.equal(typeof signatory.fullName, 'string')
          assert.equal(typeof signatory.email, 'string')
          assertAbsent(signatory, ['isNew', 'title'], 'signatory')
        }

        if (type === 'exporter') {
          assert.ok(body.overseasSites.length > 0, 'no overseas sites')
          for (const site of body.overseasSites) {
            assertOverseasSite(site)
          }
        } else {
          assert.ok(!('overseasSites' in body))
        }
      })
    }

    it('searches as a page of summaries only', async () => {
      const { status, body } = await getAccreditationApi(
        `/v1/accreditations?year=${year}&organisationNumber=${context.organisation.orgId}&limit=100`
      )
      assert.equal(status, 200)
      assert.equal(body.pageNumber, 1)
      assert.equal(body.limit, 100)
      assert.equal(body.totalItems, body.items.length)
      for (const item of body.items) {
        assertSummary(item)
        assert.equal(item.accreditationYear, year)
        assertAbsent(
          item,
          [
            'statusHistory',
            'tonnageBandHistory',
            'signatories',
            'overseasSites'
          ],
          'search item'
        )
      }
    })

    it('searches by registration number for exactly that accreditation', async (t) => {
      if (!requireGranted(t, context.exporter, 'exporter')) {
        return
      }
      const { status, body } = await getAccreditationApi(
        `/v1/accreditations?registrationNumber=${context.exporter.registrationNumber}`
      )
      assert.equal(status, 200)
      assert.deepEqual(
        body.items.map(({ registrationNumber }) => registrationNumber),
        [context.exporter.registrationNumber]
      )
    })

    it('pages the search by limit and pageNumber', async () => {
      const { status, body } = await getAccreditationApi(
        `/v1/accreditations?year=${year}&organisationNumber=${context.organisation.orgId}&pageNumber=2&limit=1`
      )
      assert.equal(status, 200)
      assert.equal(body.pageNumber, 2)
      assert.equal(body.limit, 1)
      assert.ok(body.items.length <= 1)
    })

    it('defaults the search to page 1 of 20', async () => {
      const { status, body } = await getAccreditationApi('/v1/accreditations')
      assert.equal(status, 200)
      assert.equal(body.pageNumber, 1)
      assert.equal(body.limit, 20)
      assert.ok(body.items.length <= 20)
    })

    it('answers a search that matches nothing with an empty page, not 404', async () => {
      const { status, body } = await getAccreditationApi(
        `/v1/accreditations?registrationNumber=NO-SUCH-REG`
      )
      assert.equal(status, 200)
      assert.deepEqual(body.items, [])
      assert.equal(body.totalItems, 0)
    })

    describe('overseas sites', () => {
      let sites

      before(async () => {
        if (!context.exporter) {
          return
        }
        sites = (await getAccreditationApi(context.exporter.path)).body
          .overseasSites
      })

      it('lists the same sites as the accreditation, in the v2 shape', async (t) => {
        if (!requireGranted(t, context.exporter, 'exporter')) {
          return
        }
        const { status, body } = await getAccreditationApi(
          `${context.exporter.path}/overseas-sites?limit=100`
        )
        assert.equal(status, 200)
        assert.equal(body.totalItems, sites.length)
        assert.deepEqual(
          body.items.map(({ siteName }) => siteName).sort(),
          sites.map(({ siteName }) => siteName).sort()
        )
        for (const site of body.items) {
          assertOverseasSite(site)
        }
      })

      it('pages the overseas sites', async (t) => {
        if (!requireGranted(t, context.exporter, 'exporter')) {
          return
        }
        const { status, body } = await getAccreditationApi(
          `${context.exporter.path}/overseas-sites?pageNumber=1&limit=1`
        )
        assert.equal(status, 200)
        assert.equal(body.limit, 1)
        assert.equal(body.items.length, Math.min(1, sites.length))
        assert.equal(body.totalItems, sites.length)
      })

      it('returns one site by orsId', async (t) => {
        if (!requireGranted(t, context.exporter, 'exporter')) {
          return
        }
        const site = sites.find(({ orsId }) => orsId)
        if (!site) {
          t.skip('no overseas site has an orsId')
          return
        }
        const { status, body } = await getAccreditationApi(
          `${context.exporter.path}/overseas-sites/${site.orsId}`
        )
        assert.equal(status, 200)
        assert.equal(body.siteName, site.siteName)
        assertOverseasSite(body)
      })

      it('returns withdrawn interim sites only with includeWithdrawn=true', async (t) => {
        if (!requireGranted(t, context.exporter, 'exporter')) {
          return
        }
        const without = await getAccreditationApi(
          `${context.exporter.path}/overseas-sites?limit=100&includeWithdrawn=false`
        )
        assert.equal(without.status, 200)
        for (const site of without.body.items) {
          assertOverseasSite(site, false)
        }

        const withWithdrawn = await getAccreditationApi(
          `${context.exporter.path}/overseas-sites?limit=100&includeWithdrawn=true`
        )
        assert.equal(withWithdrawn.status, 200)
        for (const site of withWithdrawn.body.items) {
          assertOverseasSite(site, true)
        }
        const count = (body) =>
          body.items.reduce(
            (total, site) => total + site.interimSites.length,
            0
          )
        assert.ok(count(withWithdrawn.body) >= count(without.body))
      })
    })

    describe('endpoints v2 removed', () => {
      for (const [what, path] of [
        [
          'organisation',
          () => `/v1/organisations/${context.organisation.orgId}`
        ],
        ['registration search', () => '/v1/registrations'],
        [
          'registration',
          () =>
            `/v1/organisations/${context.organisation.orgId}/registrations/${context.organisation.registrations[0].registrationNumber}`
        ]
      ]) {
        it(`answers 404 for the ${what} endpoint`, async () => {
          assert.equal((await getAccreditationApi(path())).status, 404)
        })
      }
    })
  }
)
