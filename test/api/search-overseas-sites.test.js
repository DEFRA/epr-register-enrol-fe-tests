import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'

import {
  accreditationPath,
  getAccreditationApi
} from '../helpers/accreditation-api.js'
import { assertOverseasSite, assertSummary } from './shapes.js'
import { assertAbsent } from './status-history.js'
import {
  loadApiContext,
  log,
  notConfigured,
  requireGranted,
  year
} from './support.js'

// RA-802: search returns, on each exporter item, the overseasSites that
// getting that accreditation does (selected sites only, ordered by ORS id,
// with their interim sites and status histories), so paging through search
// once gives every accreditation with its sites. A reprocessor item has no
// overseasSites. Every field search returned before is unchanged.
//
// Checked on the seeded organisation (searched with organisationNumber) and
// on every accreditation the year has on test (searched without it).

// What a search item returned before RA-802 (AccreditationSummary), and the
// one field RA-802 adds.
const SUMMARY_FIELDS = [
  'organisationNumber',
  'registrationNumber',
  'accreditationNumber',
  'accreditationYear',
  'material',
  'glassRecyclingProcess',
  'wasteProcessingType',
  'latestStatus',
  'tonnageBand'
]
const REQUIRED_SUMMARY_FIELDS = [
  'organisationNumber',
  'registrationNumber',
  'accreditationNumber',
  'accreditationYear',
  'material',
  'wasteProcessingType',
  'latestStatus'
]
const SEARCH_ITEM_FIELDS = [...SUMMARY_FIELDS, 'overseasSites']

// The service's query timeout (the backend's service-client default). A
// search that overran it would answer 503 query_timeout.
const QUERY_TIMEOUT_MS = 5000
const PAGE_LIMIT = 100

const describeItem = (item) =>
  `${item.wasteProcessingType} ${item.registrationNumber} (organisation ${item.organisationNumber})`

const pathOf = (item) =>
  accreditationPath({
    orgId: item.organisationNumber,
    registrationNumber: item.registrationNumber,
    year: item.accreditationYear
  })

/**
 * Every page of a search, from page 1 until the items run out. Test is
 * shared, so accreditations can come and go between pages: a short page or
 * a changed totalItems is logged, not failed, and an item that moved onto
 * the next page is kept once (by accreditationNumber).
 */
async function searchAllPages(query, limit) {
  const pages = []
  const seen = new Set()
  let firstTotal
  for (let pageNumber = 1; ; pageNumber++) {
    const path = `/v1/accreditations?${query}&limit=${limit}&pageNumber=${pageNumber}`
    const { status, body } = await getAccreditationApi(path)
    assert.equal(status, 200, `GET ${path}: ${JSON.stringify(body)}`)
    assert.equal(body.pageNumber, pageNumber)
    firstTotal ??= body.totalItems
    if (body.totalItems !== firstTotal) {
      log(
        `${query}: totalItems went from ${firstTotal} to ${body.totalItems} while paging`
      )
    }
    const items = body.items.filter(({ accreditationNumber }) => {
      const isNew = !seen.has(accreditationNumber)
      seen.add(accreditationNumber)
      return isNew
    })
    pages.push({ ...body, items })
    if (body.items.length < limit || pageNumber * limit >= body.totalItems) {
      return pages
    }
  }
}

/** Runs fn over items, a few at a time. */
async function inBatches(items, fn, size = 5) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn))
  }
}

// Orders as the backend does (ordinal by orsId, a missing orsId first, then
// by siteId).
const bySiteOrder = ([a, x], [b, y]) => {
  const left = a ?? ''
  const right = b ?? ''
  if (left !== right) {
    return left < right ? -1 : 1
  }
  return x - y
}

// The overseasSites contract for one search item, on whatever page it came.
// strict also checks each site's full shape: done for the seeded
// organisation, whose data the run owns. Other organisations on test get the
// RA-802 contract only, so a legacy record of theirs that predates a shape
// rule does not fail this suite.
function assertOverseasSitesProperty(item, { strict = true } = {}) {
  const what = describeItem(item)
  if (item.wasteProcessingType === 'reprocessor') {
    assertAbsent(item, ['overseasSites'], what)
    return
  }
  assert.ok(
    Array.isArray(item.overseasSites),
    `${what} has no overseasSites array: ${JSON.stringify(item.overseasSites)}`
  )
  if (strict) {
    for (const site of item.overseasSites) {
      assertOverseasSite(site, { accreditationYear: item.accreditationYear })
    }
  }
  const order = item.overseasSites.map(({ orsId, siteId }) => [orsId, siteId])
  const sorted = [...order].sort(bySiteOrder)
  assert.deepStrictEqual(order, sorted, `${what}: sites not ordered by orsId`)
}

// The search item's overseasSites against getting the same accreditation:
// the same sites, in the same order, with the same fields, interim sites and
// status histories. Its other fields are the accreditation's summary.
async function assertMatchesAccreditation(item) {
  const what = describeItem(item)
  const { status, body } = await getAccreditationApi(pathOf(item))
  assert.equal(status, 200, `${what}: ${JSON.stringify(body)}`)
  assert.deepStrictEqual(
    item.overseasSites,
    body.overseasSites,
    `${what}: the search item's overseasSites differ from the accreditation's`
  )
  for (const field of SUMMARY_FIELDS) {
    assert.deepStrictEqual(
      item[field],
      body[field],
      `${what}: search ${field} differs from the accreditation's`
    )
  }
}

describe(
  'Accreditation API: search with overseas sites (RA-802)',
  { skip: notConfigured },
  () => {
    let context
    let organisationItems
    let yearPages
    let ownedNumbers
    const isOwned = ({ accreditationNumber }) =>
      ownedNumbers.has(accreditationNumber)
    const ofType = (type) =>
      organisationItems.filter(
        ({ wasteProcessingType }) => wasteProcessingType === type
      )

    before(async () => {
      context = await loadApiContext()
      // With organisationNumber, one item a page, so each item is a page of
      // its own.
      const organisationPages = await searchAllPages(
        `year=${year}&organisationNumber=${context.organisation.orgId}`,
        1
      )
      organisationItems = organisationPages.flatMap(({ items }) => items)
      ownedNumbers = new Set(
        organisationItems.map(({ accreditationNumber }) => accreditationNumber)
      )
      // Without it: every accreditation the year has on test.
      yearPages = await searchAllPages(`year=${year}`, PAGE_LIMIT)
      const yearItems = yearPages.flatMap(({ items }) => items)
      const exporters = yearItems.filter(
        ({ wasteProcessingType }) => wasteProcessingType === 'exporter'
      )
      log(
        `Search for ${year}: ${yearItems.length} accreditations on ${yearPages.length} page(s), ` +
          `${exporters.length} exporters, up to ` +
          `${Math.max(0, ...exporters.map((e) => e.overseasSites?.length ?? 0))} sites each`
      )
    })

    it("gives each of the organisation's exporters the same overseasSites as getting it", async (t) => {
      const exporters = ofType('exporter')
      if (!requireGranted(t, exporters[0], 'exporter')) {
        return
      }
      for (const item of exporters) {
        assertOverseasSitesProperty(item)
        assert.ok(
          item.overseasSites.length > 0,
          `${describeItem(item)} has no overseas sites`
        )
        await assertMatchesAccreditation(item)
      }
    })

    it("leaves overseasSites out of each of the organisation's reprocessors", (t) => {
      const reprocessors = ofType('reprocessor')
      if (!requireGranted(t, reprocessors[0], 'reprocessor')) {
        return
      }
      for (const item of reprocessors) {
        assertOverseasSitesProperty(item)
      }
    })

    it('carries overseasSites on every page of a search by organisationNumber', (t) => {
      // One item a page: each page's item is checked on a page of its own.
      if (organisationItems.length < 2) {
        t.skip('the organisation has fewer than two accreditations to page')
        return
      }
      for (const item of organisationItems) {
        assertOverseasSitesProperty(item)
      }
    })

    it('carries overseasSites on every page of a search without organisationNumber', () => {
      for (const [index, page] of yearPages.entries()) {
        assert.ok(page.items.length > 0, `page ${index + 1} is empty`)
        for (const item of page.items) {
          const strict = isOwned(item)
          if (strict) {
            assertSummary(item)
          }
          assertOverseasSitesProperty(item, { strict })
        }
      }
    })

    it('gives every exporter in the year the same overseasSites as getting it', async () => {
      const exporters = yearPages
        .flatMap(({ items }) => items)
        .filter(({ wasteProcessingType }) => wasteProcessingType === 'exporter')
      assert.ok(exporters.length > 0, `no exporters in ${year}`)
      const failures = []
      await inBatches(exporters, async (item) => {
        try {
          await assertMatchesAccreditation(item)
        } catch (err) {
          failures.push(err.message)
        }
      })
      assert.deepStrictEqual(failures, [], failures.join('\n'))
    })

    it('returns the same item for the organisation with and without organisationNumber', () => {
      const byRegistration = new Map(
        yearPages
          .flatMap(({ items }) => items)
          .map((item) => [item.registrationNumber, item])
      )
      for (const item of organisationItems) {
        assert.deepStrictEqual(
          byRegistration.get(item.registrationNumber),
          item,
          `${describeItem(item)} differs without organisationNumber`
        )
      }
    })

    it("keeps every field search returned before, and adds only an exporter's overseasSites", () => {
      for (const item of yearPages.flatMap(({ items }) => items)) {
        const what = describeItem(item)
        for (const field of REQUIRED_SUMMARY_FIELDS) {
          assert.ok(field in item, `${what} has no ${field}`)
        }
        const allowed =
          item.wasteProcessingType === 'exporter'
            ? SEARCH_ITEM_FIELDS
            : SUMMARY_FIELDS
        const extra = Object.keys(item).filter((key) => !allowed.includes(key))
        assert.deepStrictEqual(extra, [], `${what} has fields search never had`)
      }
    })

    it(`serves a page of ${PAGE_LIMIT}, exporters included, within the ${QUERY_TIMEOUT_MS / 1000}s query timeout`, async (t) => {
      const path = `/v1/accreditations?year=${year}&limit=${PAGE_LIMIT}`
      // Warm: the first call of a connection also signs in and connects.
      // Timed from here is the client's round trip, network included: an
      // upper bound on the server's query time.
      const warm = await getAccreditationApi(path)
      assert.equal(
        warm.status,
        200,
        `GET ${path}: ${JSON.stringify(warm.body)}`
      )
      const started = performance.now()
      const { status, body } = await getAccreditationApi(path)
      const elapsed = Math.round(performance.now() - started)
      assert.equal(status, 200, `GET ${path}: ${JSON.stringify(body)}`)
      const bytes = Buffer.byteLength(JSON.stringify(body))
      const exporters = body.items.filter(
        ({ wasteProcessingType }) => wasteProcessingType === 'exporter'
      ).length
      t.diagnostic(
        `${body.items.length} items, ${exporters} exporters, ${elapsed}ms, ${Math.round(bytes / 1024)} KB`
      )
      log(
        `Page of ${body.items.length} (${exporters} exporters): ${elapsed}ms, ${Math.round(bytes / 1024)} KB`
      )
      // Not t.todo: a todo test's failures are not counted, so the checks
      // below would stop meaning anything.
      if (body.items.length < PAGE_LIMIT) {
        t.diagnostic(
          `only ${body.items.length} accreditations in ${year} on test, not a full page`
        )
      }
      assert.ok(exporters > 0, 'the page has no exporters')
      assert.ok(
        elapsed < QUERY_TIMEOUT_MS,
        `a page of ${body.items.length} took ${elapsed}ms`
      )
    })
  }
)
