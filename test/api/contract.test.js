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
const STATUSES = ['approved', 'suspended', 'cancelled', 'withdrawn']
const BANDS = ['up_to_500', 'up_to_5000', 'up_to_10000', 'over_10000']
const GLASS = ['glass_re_melt', 'glass_other']
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

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

// The day before an ISO date (yyyy-MM-dd), as effectiveToDate is written.
function dayBefore(date) {
  const day = new Date(`${date}T00:00:00Z`)
  day.setUTCDate(day.getUTCDate() - 1)
  return day.toISOString().slice(0, 10)
}

// Each entry shows the period the status applies: from effectiveFromDate to
// effectiveToDate, which is the day before the next entry starts and null on
// the latest. effectiveToDate is always present, so a missing one is a failure.
// The shape of one status entry, in a statusHistory or as latestStatus.
function assertStatusEntry(entry, what) {
  assertOneOf(entry.status, STATUSES, `${what} status`)
  assert.match(entry.effectiveFromDate, DATE_ONLY, `${what} effectiveFromDate`)
  assert.ok('effectiveToDate' in entry, `${what} entry has no effectiveToDate`)
  assert.match(entry.recordedAt, DATE_TIME, `${what} recordedAt`)
  assertAbsent(entry, ['effectiveDate'], `${what} status entry`)
}

function assertStatusHistory(history, what) {
  assert.ok(
    Array.isArray(history) && history.length > 0,
    `${what} has no statusHistory`
  )
  history.forEach((entry, index) => {
    assertStatusEntry(entry, what)

    // A period never ends before it starts, and the entries run in order.
    if (entry.effectiveToDate !== null) {
      assert.ok(
        entry.effectiveToDate >= entry.effectiveFromDate,
        `${what} effectiveToDate ${entry.effectiveToDate} is before effectiveFromDate ${entry.effectiveFromDate}`
      )
    }
    const next = history[index + 1]
    if (next) {
      assert.ok(
        next.effectiveFromDate >= entry.effectiveFromDate,
        `${what} effectiveFromDate goes backwards`
      )
      // The day before the next entry starts. Where the next starts the same
      // day (a tie, won by the later recordedAt), this one is kept and ends on
      // that same day.
      const expectedTo =
        next.effectiveFromDate === entry.effectiveFromDate
          ? entry.effectiveFromDate
          : dayBefore(next.effectiveFromDate)
      assert.equal(
        entry.effectiveToDate,
        expectedTo,
        `${what} effectiveToDate is the day before the next entry starts`
      )
    } else {
      assert.equal(
        entry.effectiveToDate,
        null,
        `${what} latest entry has no effectiveToDate`
      )
    }
  })
}

// latestStatus replaces the status string. It has the shape of a status history
// entry, and it is the latest one whether or not its effectiveFromDate has
// arrived, so it can be in the future.
function assertLatestStatus(record, what) {
  assertAbsent(record, ['status'], what)
  const latest = record.latestStatus
  assert.equal(typeof latest, 'object', `${what} has no latestStatus`)
  assert.notEqual(latest, null, `${what} has no latestStatus`)
  assertStatusEntry(latest, `${what} latestStatus`)
  // No later entry closes the latest one.
  assert.equal(
    latest.effectiveToDate,
    null,
    `${what} latestStatus has an effectiveToDate`
  )
}

// latestStatus is the same entry as the latest one in the history: the latest
// effectiveFromDate, and the later recordedAt where two share one. The sorted
// check is the only one that applies the recordedAt tie-break; assertStatusHistory
// already checks that the entries are in order, so the last-entry check below it
// guards the order the API returns them in.
function assertLatestStatusMatchesHistory(record, what) {
  const latest = [...record.statusHistory]
    .sort(
      (a, b) =>
        a.effectiveFromDate.localeCompare(b.effectiveFromDate) ||
        a.recordedAt.localeCompare(b.recordedAt)
    )
    .at(-1)
  assert.deepStrictEqual(
    record.latestStatus,
    latest,
    `${what} latestStatus is the latest entry of its statusHistory`
  )
  assert.deepStrictEqual(
    record.latestStatus,
    record.statusHistory.at(-1),
    `${what} latestStatus is the last entry of its statusHistory`
  )
}

function assertSummary(item) {
  assert.equal(typeof item.organisationNumber, 'number')
  assert.equal(typeof item.registrationNumber, 'string')
  assert.equal(typeof item.accreditationNumber, 'string')
  assert.equal(typeof item.accreditationYear, 'number')
  assertOneOf(item.material, MATERIALS, 'material')
  assertOneOf(item.wasteProcessingType, ['reprocessor', 'exporter'], 'type')
  assertLatestStatus(item, 'accreditation')
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

function assertInterimSite(site) {
  const what = `interim site ${site.siteName}`
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
  // removedAt is gone: withdrawn interim sites are always returned, and their
  // status history explains them.
  assertAbsent(site, ['removedAt'], what)
  assertLatestStatus(site, what)
  assertStatusHistory(site.statusHistory, what)
  assertLatestStatusMatchesHistory(site, what)

  // An interim site is approved when its overseas site is, then withdrawn and
  // approved again each time it is withdrawn and restored: it alternates.
  const statuses = site.statusHistory.map((entry) => entry.status)
  assert.equal(statuses[0], 'approved', `${what} history starts approved`)
  statuses.forEach((status, index) => {
    assert.equal(
      status,
      index % 2 === 0 ? 'approved' : 'withdrawn',
      `${what} history alternates approved and withdrawn`
    )
  })
}

function assertOverseasSite(site) {
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
  assertLatestStatus(site, what)
  assertStatusHistory(site.statusHistory, what)
  assertLatestStatusMatchesHistory(site, what)
  assert.ok(Array.isArray(site.interimSites))
  for (const interim of site.interimSites) {
    assertInterimSite(interim)
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
        assertLatestStatusMatchesHistory(body, 'accreditation')

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

      it('always returns withdrawn interim sites, with their status', async (t) => {
        if (!requireGranted(t, context.exporter, 'exporter')) {
          return
        }
        const { status, body } = await getAccreditationApi(
          `${context.exporter.path}/overseas-sites?limit=100`
        )
        assert.equal(status, 200)
        for (const site of body.items) {
          assertOverseasSite(site)
        }

        // includeWithdrawn is no longer a parameter: a client that still sends
        // it gets the same interim sites.
        const sent = await getAccreditationApi(
          `${context.exporter.path}/overseas-sites?limit=100&includeWithdrawn=false`
        )
        assert.equal(sent.status, 200)
        assert.deepStrictEqual(sent.body, body)
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
