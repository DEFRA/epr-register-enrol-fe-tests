import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'

import { getAccreditationApi } from '../helpers/accreditation-api.js'
import {
  DATE_TIME,
  assertAbsent,
  assertOneOf,
  assertStatusHistory,
  assertLatestStatus,
  assertLatestStatusMatchesHistory,
  LATEST_STATUS_TODO,
  INTERIM_STATUS_TODO
} from './status-history.js'
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
const BANDS = ['up_to_500', 'up_to_5000', 'up_to_10000', 'over_10000']
const GLASS = ['glass_re_melt', 'glass_other']

function assertSummary(item) {
  assert.equal(typeof item.organisationNumber, 'number')
  assert.equal(typeof item.registrationNumber, 'string')
  assert.equal(typeof item.accreditationNumber, 'string')
  assert.equal(typeof item.accreditationYear, 'number')
  assertOneOf(item.material, MATERIALS, 'material')
  assertOneOf(item.wasteProcessingType, ['reprocessor', 'exporter'], 'type')
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

// accreditationYear is the year of the accreditation the site is on: the
// response's own, or the year the path was built with (support.js's year).
function assertOverseasSite(
  site,
  { includeWithdrawn = false, accreditationYear = year } = {}
) {
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
  // validFrom is no longer served: the status history carries the dates.
  assertAbsent(site, ['validFrom'], what)
  assertStatusHistory(site.statusHistory, what, accreditationYear)
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
        assertStatusHistory(
          body.statusHistory,
          'accreditation',
          body.accreditationYear
        )

        assert.ok(Array.isArray(body.tonnageBandHistory))
        for (const entry of body.tonnageBandHistory) {
          assertOneOf(entry.tonnageBand, BANDS, 'tonnageBandHistory')
          assert.match(entry.recordedAt, DATE_TIME)
          assertAbsent(
            entry,
            ['effectiveDate', 'effectiveFromDate', 'effectiveToDate'],
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
            assertOverseasSite(site, {
              accreditationYear: body.accreditationYear
            })
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

    it('pages the search by limit and pageNumber', async (t) => {
      const page = async (pageNumber) => {
        const { status, body } = await getAccreditationApi(
          `/v1/accreditations?year=${year}&organisationNumber=${context.organisation.orgId}&pageNumber=${pageNumber}&limit=1`
        )
        assert.equal(status, 200)
        assert.equal(body.pageNumber, pageNumber)
        assert.equal(body.limit, 1)
        return body
      }
      const first = await page(1)
      if (first.totalItems < 2) {
        t.skip(
          `the organisation has ${first.totalItems} accreditation(s) served, so there is no second page to compare`
        )
        return
      }
      const second = await page(2)
      assert.equal(second.totalItems, first.totalItems)
      assert.equal(first.items.length, 1, 'page 1 does not hold one item')
      assert.equal(second.items.length, 1, 'page 2 does not hold one item')
      assert.notEqual(
        second.items[0].registrationNumber,
        first.items[0].registrationNumber,
        'page 2 repeats page 1'
      )
      const served = context.served.map(
        ({ registrationNumber }) => registrationNumber
      )
      for (const { items } of [first, second]) {
        assert.ok(
          served.includes(items[0].registrationNumber),
          `${items[0].registrationNumber} is not one of the organisation's accreditations`
        )
      }
    })

    it('defaults the search to page 1 of 20', async () => {
      const { status, body } = await getAccreditationApi('/v1/accreditations')
      assert.equal(status, 200)
      assert.equal(body.pageNumber, 1)
      assert.equal(body.limit, 20)
      // Every accreditation on test that the API serves, so its first page is
      // full whenever there are 20 or more, and holds them all otherwise.
      assert.equal(body.items.length, Math.min(body.totalItems, 20))
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
          assertOverseasSite(site, { includeWithdrawn: false })
        }

        const withWithdrawn = await getAccreditationApi(
          `${context.exporter.path}/overseas-sites?limit=100&includeWithdrawn=true`
        )
        assert.equal(withWithdrawn.status, 200)
        for (const site of withWithdrawn.body.items) {
          assertOverseasSite(site, { includeWithdrawn: true })
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

// latestStatus (RA-773): in place of the status string, the latest entry of
// the status history, on every accreditation and overseas site. Todo until
// RA-773 is deployed to test (LATEST_STATUS_TODO in status-history.js).
describe(
  'Accreditation API: latestStatus (RA-773)',
  { skip: notConfigured },
  () => {
    let context

    before(async () => {
      context = await loadApiContext()
    })

    it(
      'gives each search item a latestStatus in place of status',
      { todo: LATEST_STATUS_TODO },
      async () => {
        const { status, body } = await getAccreditationApi(
          `/v1/accreditations?year=${year}&organisationNumber=${context.organisation.orgId}&limit=100`
        )
        assert.equal(status, 200)
        for (const item of body.items) {
          assertLatestStatus(item, `accreditation ${item.accreditationNumber}`)
        }
      }
    )

    for (const type of ['reprocessor', 'exporter']) {
      it(
        `gives the ${type} accreditation the latest entry of its statusHistory as latestStatus`,
        { todo: LATEST_STATUS_TODO },
        async (t) => {
          if (!requireGranted(t, context[type], type)) {
            return
          }
          const { status, body } = await getAccreditationApi(context[type].path)
          assert.equal(status, 200)
          assertLatestStatus(body, 'accreditation')
          assertLatestStatusMatchesHistory(body, 'accreditation')
        }
      )
    }

    it(
      'gives each overseas site the latest entry of its statusHistory as latestStatus',
      { todo: LATEST_STATUS_TODO },
      async (t) => {
        if (!requireGranted(t, context.exporter, 'exporter')) {
          return
        }
        const detail = await getAccreditationApi(context.exporter.path)
        const listed = await getAccreditationApi(
          `${context.exporter.path}/overseas-sites?limit=100&includeWithdrawn=true`
        )
        assert.equal(detail.status, 200)
        assert.equal(listed.status, 200)
        for (const site of [
          ...detail.body.overseasSites,
          ...listed.body.items
        ]) {
          const what = `site ${site.orsId ?? site.siteName}`
          assertLatestStatus(site, what)
          assertLatestStatusMatchesHistory(site, what)
        }
      }
    )
  }
)

// An interim site's status (RA-781): approved from when its overseas site was,
// then withdrawn and approved again each time it is withdrawn and restored. Its
// statusHistory and latestStatus have an accreditation's shape and date rules.
// Withdrawn interim sites are always returned, so removedAt and the
// includeWithdrawn parameter are gone. Todo until RA-781 is deployed to test
// (INTERIM_STATUS_TODO in status-history.js).
function assertInterimStatus(interim, accreditationYear) {
  const what = `interim site ${interim.siteName}`
  assertAbsent(interim, ['removedAt'], what)
  assertLatestStatus(interim, what)
  assertStatusHistory(interim.statusHistory, what, accreditationYear)
  assertLatestStatusMatchesHistory(interim, what)

  const statuses = interim.statusHistory.map((entry) => entry.status)
  statuses.forEach((status, index) => {
    assert.equal(
      status,
      index % 2 === 0 ? 'approved' : 'withdrawn',
      `${what} history is approved, then alternates withdrawn and approved`
    )
  })
}

describe(
  'Accreditation API: interim site status (RA-781)',
  { skip: notConfigured },
  () => {
    let context

    before(async () => {
      context = await loadApiContext()
    })

    it(
      'gives each interim site a statusHistory and latestStatus, and no removedAt',
      { todo: INTERIM_STATUS_TODO },
      async (t) => {
        if (!requireGranted(t, context.exporter, 'exporter')) {
          return
        }
        const { status, body } = await getAccreditationApi(
          context.exporter.path
        )
        assert.equal(status, 200)
        const interimSites = body.overseasSites.flatMap(
          (site) => site.interimSites
        )
        assert.ok(interimSites.length > 0, 'no interim site was checked')
        for (const interim of interimSites) {
          assertInterimStatus(interim, body.accreditationYear)
        }
      }
    )

    it(
      'returns withdrawn interim sites without being asked, and ignores includeWithdrawn',
      { todo: INTERIM_STATUS_TODO },
      async (t) => {
        if (!requireGranted(t, context.exporter, 'exporter')) {
          return
        }
        const plain = await getAccreditationApi(
          `${context.exporter.path}/overseas-sites?limit=100`
        )
        assert.equal(plain.status, 200)
        const interimSites = plain.body.items.flatMap(
          (site) => site.interimSites
        )
        assert.ok(interimSites.length > 0, 'no interim site was checked')
        for (const interim of interimSites) {
          assertInterimStatus(interim, year)
        }
        // No longer a parameter: whatever it says, the same interim sites.
        for (const value of ['true', 'false', 'maybe']) {
          const sent = await getAccreditationApi(
            `${context.exporter.path}/overseas-sites?limit=100&includeWithdrawn=${value}`
          )
          assert.equal(sent.status, 200, `includeWithdrawn=${value}`)
          assert.deepStrictEqual(sent.body, plain.body, value)
        }
      }
    )
  }
)
