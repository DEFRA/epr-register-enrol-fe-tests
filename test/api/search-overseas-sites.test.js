import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'

import {
  accreditationPath,
  getAccreditationApi
} from '../helpers/accreditation-api.js'
import {
  REQUIRED_SUMMARY_FIELDS,
  SUMMARY_FIELDS,
  assertOverseasSite,
  assertSummary
} from './shapes.js'
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
// Checked on the seeded organisation (searched with organisationNumber, whose
// data the run owns) and on every accreditation the year has on test
// (searched without it, other teams' data included).

const SEARCH_ITEM_FIELDS = [...SUMMARY_FIELDS, 'overseasSites']

const PAGE_LIMIT = 100
// Requests at a time when getting every accreditation in the year.
const CONCURRENCY = 5

const describeItem = (item) =>
  `${item.wasteProcessingType} ${item.accreditationNumber} (organisation ${item.organisationNumber})`

const isExporter = ({ wasteProcessingType }) =>
  wasteProcessingType === 'exporter'

const ofType = (items, type) =>
  items.filter(({ wasteProcessingType }) => wasteProcessingType === type)

const pathOf = (item) =>
  accreditationPath({
    orgId: item.organisationNumber,
    registrationNumber: item.registrationNumber,
    year: item.accreditationYear
  })

async function getSearchPage(query, limit, pageNumber) {
  const path = `/v1/accreditations?${query}&limit=${limit}&pageNumber=${pageNumber}`
  const { status, body } = await getAccreditationApi(path)
  assert.equal(status, 200, `GET ${path}: ${JSON.stringify(body)}`)
  assert.equal(body.pageNumber, pageNumber, `${path}: pageNumber`)
  assert.equal(body.limit, limit, `${path}: limit`)
  return body
}

/**
 * Every page of a search, from page 1 until the items run out, with the
 * totalItems page 1 gave. Test is shared, so another team's accreditations
 * can come and go between pages: a changed totalItems is logged, and an item
 * that moved onto the next page is kept once, by accreditationNumber. Each
 * page keeps its own items as served (`served`) as well.
 */
async function searchAllPages(query, limit) {
  const pages = []
  const seen = new Set()
  let totalItems
  for (let pageNumber = 1; ; pageNumber++) {
    const body = await getSearchPage(query, limit, pageNumber)
    totalItems ??= body.totalItems
    if (body.totalItems !== totalItems) {
      log(
        `${query}: totalItems went from ${totalItems} to ${body.totalItems} while paging`
      )
    }
    const items = body.items.filter(({ accreditationNumber }) => {
      const isNew = !seen.has(accreditationNumber)
      seen.add(accreditationNumber)
      return isNew
    })
    pages.push({ served: body.items, items })
    if (body.items.length < limit || pageNumber * limit >= body.totalItems) {
      return { pages, totalItems, items: pages.flatMap((page) => page.items) }
    }
  }
}

/** Runs fn over items, CONCURRENCY at a time. */
async function inBatches(items, fn) {
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    await Promise.all(items.slice(i, i + CONCURRENCY).map(fn))
  }
}

// Orders sites as the backend does: ordinal by orsId (a missing one first),
// then by siteId.
const bySiteOrder = (left, right) => {
  const leftOrsId = left.orsId ?? ''
  const rightOrsId = right.orsId ?? ''
  if (leftOrsId !== rightOrsId) {
    return leftOrsId < rightOrsId ? -1 : 1
  }
  return left.siteId - right.siteId
}

/**
 * RA-802's overseasSites on one search item: an exporter has them, in the
 * backend's order; a reprocessor has none. fullShape also checks each site's
 * whole shape, for the seeded organisation's items: other teams' legacy
 * records may predate a shape rule, and are not this suite's to fail.
 */
function assertSearchItemSites(item, { fullShape = true } = {}) {
  const what = describeItem(item)
  if (!isExporter(item)) {
    assertAbsent(item, ['overseasSites'], what)
    return
  }
  assert.ok(
    Array.isArray(item.overseasSites),
    `${what} has no overseasSites array: ${JSON.stringify(item.overseasSites)}`
  )
  if (fullShape) {
    for (const site of item.overseasSites) {
      assertOverseasSite(site, { accreditationYear: item.accreditationYear })
    }
  }
  const order = item.overseasSites.map(({ orsId, siteId }) => ({
    orsId,
    siteId
  }))
  assert.deepStrictEqual(
    order,
    [...order].sort(bySiteOrder),
    `${what}: sites not ordered by orsId, then siteId`
  )
}

/**
 * The search item against getting the same accreditation: the same
 * overseasSites (sites, order, fields, interim sites, status histories), or
 * none on both, and the same value, or absence, for every summary field.
 */
async function assertMatchesAccreditation(item) {
  const what = describeItem(item)
  const { status, body } = await getAccreditationApi(pathOf(item))
  assert.equal(status, 200, `${what}: ${JSON.stringify(body)}`)
  assert.equal(
    body.accreditationNumber,
    item.accreditationNumber,
    `${what}: getting it returns another accreditation`
  )
  for (const field of [...SUMMARY_FIELDS, 'overseasSites']) {
    assert.equal(
      field in item,
      field in body,
      `${what}: ${field} is ${field in item ? '' : 'not '}in search but ${field in body ? '' : 'not '}in getting it`
    )
    assert.deepStrictEqual(
      item[field],
      body[field],
      `${what}: search ${field} differs from getting it`
    )
  }
}

describe(
  'Accreditation API: search with overseas sites (RA-802)',
  { skip: notConfigured },
  () => {
    let organisationSearch
    let yearSearch
    let ownedNumbers
    const isOwned = ({ accreditationNumber }) =>
      ownedNumbers.has(accreditationNumber)

    before(async () => {
      const context = await loadApiContext()
      // With organisationNumber, one accreditation a page.
      organisationSearch = await searchAllPages(
        `year=${year}&organisationNumber=${context.organisation.orgId}`,
        1
      )
      ownedNumbers = new Set(
        organisationSearch.items.map(
          ({ accreditationNumber }) => accreditationNumber
        )
      )
      // Without it: every accreditation the year has on test, at a limit
      // that makes at least two pages of it.
      const { totalItems } = await getSearchPage(`year=${year}`, 1, 1)
      const limit = Math.max(1, Math.min(PAGE_LIMIT, Math.ceil(totalItems / 2)))
      yearSearch = await searchAllPages(`year=${year}`, limit)
      const exporters = yearSearch.items.filter(isExporter)
      log(
        `Search for ${year}: ${yearSearch.items.length} accreditations on ` +
          `${yearSearch.pages.length} pages of ${limit}, ${exporters.length} exporters, up to ` +
          `${Math.max(0, ...exporters.map((e) => e.overseasSites?.length ?? 0))} sites each`
      )
    })

    it("gives the organisation's exporters their overseasSites and its reprocessors none", (t) => {
      const exporters = ofType(organisationSearch.items, 'exporter')
      const reprocessors = ofType(organisationSearch.items, 'reprocessor')
      if (
        !requireGranted(t, exporters[0], 'exporter') ||
        !requireGranted(t, reprocessors[0], 'reprocessor')
      ) {
        return
      }
      for (const item of organisationSearch.items) {
        assertSummary(item)
        assert.equal(item.accreditationYear, year)
        assertSearchItemSites(item)
      }
      for (const item of exporters) {
        assert.ok(
          item.overseasSites.length > 0,
          `${describeItem(item)} has no overseas sites`
        )
      }
    })

    it('pages the search by organisationNumber, one accreditation a page', (t) => {
      // The run owns this organisation's data, so its search is stable: one
      // page per accreditation, each a different one.
      const { pages, totalItems, items } = organisationSearch
      assert.equal(
        pages.flatMap(({ served }) => served).length,
        totalItems,
        `${pages.length} pages served other than ${totalItems} accreditations`
      )
      assert.equal(
        items.length,
        totalItems,
        'a page repeated an accreditation from an earlier page'
      )
      for (const [index, { served }] of pages.entries()) {
        assert.equal(served.length, 1, `page ${index + 1} of limit 1`)
      }
      if (totalItems < 2) {
        t.skip('the organisation has fewer than two accreditations to page')
      }
    })

    it('carries overseasSites on every page of a search without organisationNumber', (t) => {
      const { pages } = yearSearch
      if (yearSearch.totalItems < 2) {
        t.skip(`fewer than two accreditations in ${year}, so one page only`)
        return
      }
      assert.ok(pages.length >= 2, `only ${pages.length} page searched`)
      for (const [index, { served, items }] of pages.entries()) {
        assert.ok(served.length > 0, `page ${index + 1} is empty`)
        for (const item of items) {
          const fullShape = isOwned(item)
          if (fullShape) {
            assertSummary(item)
          }
          assertSearchItemSites(item, { fullShape })
        }
      }
    })

    // Every item, reprocessors included: the overseasSites for an exporter,
    // and every summary field (tonnageBand and glassRecyclingProcess too) for
    // both types, which the backend copies onto the search item one by one.
    it('serves each item in the year as getting its accreditation does: overseasSites and every summary field', async () => {
      const { items } = yearSearch
      assert.ok(items.length > 0, `no accreditations in ${year}`)
      const failures = []
      await inBatches(items, async (item) => {
        try {
          await assertMatchesAccreditation(item)
        } catch (err) {
          failures.push(err.message)
        }
      })
      assert.deepStrictEqual(failures, [], failures.join('\n'))
    })

    it('returns the same items for the organisation with and without organisationNumber', () => {
      assert.ok(
        organisationSearch.items.length > 0,
        'the organisation search returned nothing'
      )
      const byAccreditationNumber = new Map(
        yearSearch.items.map((item) => [item.accreditationNumber, item])
      )
      for (const item of organisationSearch.items) {
        assert.deepStrictEqual(
          byAccreditationNumber.get(item.accreditationNumber),
          item,
          `${describeItem(item)} differs without organisationNumber`
        )
      }
    })

    it("keeps the fields search returned before, and adds only an exporter's overseasSites", () => {
      for (const item of yearSearch.items) {
        const what = describeItem(item)
        for (const field of REQUIRED_SUMMARY_FIELDS) {
          assert.ok(field in item, `${what} has no ${field}`)
        }
        const allowed = isExporter(item) ? SEARCH_ITEM_FIELDS : SUMMARY_FIELDS
        const extra = Object.keys(item).filter((key) => !allowed.includes(key))
        assert.deepStrictEqual(extra, [], `${what} has fields search never had`)
      }
    })

    // A search that overran the service's query timeout would answer 503
    // query_timeout, so the status is the check. The elapsed time is the
    // client's whole round trip (network and gateway included), so it is
    // reported, not asserted.
    it(`serves a page of ${PAGE_LIMIT}, exporters included, without a query timeout`, async (t) => {
      const path = `/v1/accreditations?year=${year}&limit=${PAGE_LIMIT}`
      const started = performance.now()
      const { status, body } = await getAccreditationApi(path)
      const elapsed = Math.round(performance.now() - started)
      assert.equal(status, 200, `GET ${path}: ${JSON.stringify(body)}`)
      const exporters = body.items.filter(isExporter).length
      const kilobytes = Math.round(
        Buffer.byteLength(JSON.stringify(body)) / 1024
      )
      const report = `Page of ${body.items.length} (${exporters} exporters): ${elapsed}ms, ${kilobytes} KB`
      t.diagnostic(report)
      log(report)
      if (body.items.length < PAGE_LIMIT) {
        t.skip(
          `only ${body.items.length} accreditations in ${year} on test, not a page of ${PAGE_LIMIT}`
        )
        return
      }
      if (exporters === 0) {
        t.skip(`no exporters in the first ${PAGE_LIMIT} of ${year}`)
      }
    })
  }
)
