import assert from 'node:assert/strict'
import { isDeepStrictEqual } from 'node:util'
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
// RA-820: the largest page the search takes.
const MAX_SEARCH_LIMIT = 500
// Requests at a time when getting accreditations one by one.
const CONCURRENCY = 5
// How many of other teams' accreditations are compared with getting them, on
// top of every one the seeded organisation has: a sample spread across the
// year, so the run does not grow with the environment.
const OTHERS_SAMPLE = 40
// Times a search is paged again from page 1 when its totalItems changes
// part-way (shared data changing under it).
const PAGING_ATTEMPTS = 3

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
 * totalItems the pages agreed on. Test is shared, so another team's
 * accreditations can come and go while it pages: an item can move onto the
 * next page (kept once, by accreditationNumber) or back onto one already read
 * (missed). So when totalItems changes part-way, it pages again from page 1,
 * up to PAGING_ATTEMPTS times. `stable` is false when no attempt saw the same
 * totalItems throughout. Each page keeps its items as served (`served`).
 */
async function searchAllPages(query, limit) {
  let result
  for (let attempt = 1; attempt <= PAGING_ATTEMPTS; attempt++) {
    result = await pageOnce(query, limit)
    if (result.stable) {
      return result
    }
    log(
      `${query}: totalItems changed while paging (attempt ${attempt} of ${PAGING_ATTEMPTS})`
    )
  }
  return result
}

async function pageOnce(query, limit) {
  const pages = []
  const seen = new Set()
  let totalItems
  let stable = true
  for (let pageNumber = 1; ; pageNumber++) {
    const body = await getSearchPage(query, limit, pageNumber)
    totalItems ??= body.totalItems
    stable &&= body.totalItems === totalItems
    const items = body.items.filter(({ accreditationNumber }) => {
      const isNew = !seen.has(accreditationNumber)
      seen.add(accreditationNumber)
      return isNew
    })
    pages.push({ served: body.items, items })
    if (body.items.length < limit || pageNumber * limit >= body.totalItems) {
      return {
        pages,
        totalItems,
        stable,
        items: pages.flatMap((page) => page.items)
      }
    }
  }
}

/** Every nth item, at most `size` of them, spread across the list. */
const spreadSample = (items, size) =>
  items.length <= size
    ? items
    : items.filter((_, i) => i % Math.ceil(items.length / size) === 0)

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
 * Returns what differs, empty when they agree.
 */
async function differencesFromAccreditation(item) {
  const what = describeItem(item)
  const { status, body } = await getAccreditationApi(pathOf(item))
  if (status !== 200) {
    return [`${what}: getting it answered ${status}: ${JSON.stringify(body)}`]
  }
  if (body.accreditationNumber !== item.accreditationNumber) {
    return [
      `${what}: getting it returns another accreditation, ${body.accreditationNumber}`
    ]
  }
  const differences = []
  for (const field of [...SUMMARY_FIELDS, 'overseasSites']) {
    if (field in item !== field in body) {
      differences.push(
        `${what}: ${field} is ${field in item ? '' : 'not '}in search but ${field in body ? '' : 'not '}in getting it`
      )
    } else if (!isDeepStrictEqual(item[field], body[field])) {
      differences.push(`${what}: search ${field} differs from getting it`)
    }
  }
  return differences
}

/**
 * The item as search serves it now, by searching for its registration
 * (without organisationNumber), or undefined if it is no longer served.
 */
async function searchAgain(item) {
  const query =
    `year=${item.accreditationYear}` +
    `&registrationNumber=${encodeURIComponent(item.registrationNumber)}`
  const { items } = await getSearchPage(query, PAGE_LIMIT, 1)
  return items.find(
    ({ accreditationNumber }) =>
      accreditationNumber === item.accreditationNumber
  )
}

/**
 * differencesFromAccreditation for an item another team owns. Their data can
 * change between the search in before() and getting it, so on a difference
 * the item is searched again, and only a difference that remains between the
 * fresh search item and getting it counts. An item no longer served is
 * logged, not failed.
 */
async function differencesForOthers(item) {
  if ((await differencesFromAccreditation(item)).length === 0) {
    return []
  }
  const fresh = await searchAgain(item)
  if (!fresh) {
    log(`${describeItem(item)} is no longer served; not compared`)
    return []
  }
  return differencesFromAccreditation(fresh)
}

describe(
  'Accreditation API: search with overseas sites (RA-802)',
  { skip: notConfigured },
  () => {
    let organisationSearch
    let yearSearch
    let ownedNumbers
    let yearLimit
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
      yearLimit = Math.max(1, Math.min(PAGE_LIMIT, Math.ceil(totalItems / 2)))
      yearSearch = await searchAllPages(`year=${year}`, yearLimit)
      const exporters = yearSearch.items.filter(isExporter)
      log(
        `Search for ${year}: ${yearSearch.items.length} accreditations on ` +
          `${yearSearch.pages.length} pages of ${yearLimit}, ${exporters.length} exporters, up to ` +
          `${Math.max(0, ...exporters.map((e) => e.overseasSites?.length ?? 0))} sites each`
      )
    })

    // Each type on its own, so an organisation without one still has the
    // other checked.
    it("gives each of the organisation's exporters its overseasSites", (t) => {
      const exporters = ofType(organisationSearch.items, 'exporter')
      if (!requireGranted(t, exporters[0], 'exporter')) {
        return
      }
      for (const item of exporters) {
        assertSummary(item)
        assert.equal(item.accreditationYear, year)
        assertSearchItemSites(item)
        assert.ok(
          item.overseasSites.length > 0,
          `${describeItem(item)} has no overseas sites`
        )
      }
    })

    it("leaves overseasSites out of each of the organisation's reprocessors", (t) => {
      const reprocessors = ofType(organisationSearch.items, 'reprocessor')
      if (!requireGranted(t, reprocessors[0], 'reprocessor')) {
        return
      }
      for (const item of reprocessors) {
        assertSummary(item)
        assert.equal(item.accreditationYear, year)
        assertSearchItemSites(item)
      }
    })

    it('pages the search by organisationNumber, one accreditation a page', (t) => {
      // The run owns this organisation's data, so its search is stable: one
      // page per accreditation, each a different one.
      const { pages, totalItems, items, stable } = organisationSearch
      if (totalItems < 2) {
        t.skip(
          `the organisation has ${totalItems} accreditation(s), fewer than two to page`
        )
        return
      }
      assert.ok(stable, "the organisation's totalItems changed while paging")
      assert.equal(
        pages.length,
        totalItems,
        `${pages.length} pages for ${totalItems} accreditations`
      )
      for (const [index, { served }] of pages.entries()) {
        assert.equal(served.length, 1, `page ${index + 1} of limit 1`)
      }
      assert.equal(
        items.length,
        totalItems,
        'a page repeated an accreditation from an earlier page'
      )
    })

    it('carries overseasSites on every page of a search without organisationNumber', (t) => {
      const { pages } = yearSearch
      // The limit came from a count taken just before paging; other teams'
      // data can shrink in between, until the year fits on one page.
      if (yearSearch.totalItems <= yearLimit) {
        t.skip(
          `${yearSearch.totalItems} accreditations in ${year} fit on one page of ${yearLimit}`
        )
        return
      }
      assert.ok(pages.length >= 2, `only ${pages.length} page searched`)
      for (const [index, { served, items }] of pages.entries()) {
        // Each page must bring accreditations no earlier page did: a search
        // that served page 1 again would leave a later page with none new.
        // Only a last page may, when other teams' data shrank while paging
        // and no attempt saw it hold still.
        const mayBeEmpty = !yearSearch.stable && index === pages.length - 1
        assert.ok(
          items.length > 0 || mayBeEmpty,
          `page ${index + 1} has no accreditation an earlier page did not (served ${served.length})`
        )
        for (const item of items) {
          const fullShape = isOwned(item)
          if (fullShape) {
            assertSummary(item)
          }
          assertSearchItemSites(item, { fullShape })
        }
      }
    })

    // Reprocessors included: the overseasSites for an exporter, and every
    // summary field (tonnageBand and glassRecyclingProcess too) for both
    // types, which the backend copies onto the search item one by one. Every
    // one of the seeded organisation's, as its own search serves them,
    // compared strictly; and a sample of OTHERS_SAMPLE of other teams', whose
    // data can change mid-run.
    it(
      'serves items as getting the accreditation does: overseasSites and every summary field',
      { timeout: 5 * 60 * 1000 },
      async () => {
        const owned = organisationSearch.items
        const others = spreadSample(
          yearSearch.items.filter((item) => !isOwned(item)),
          OTHERS_SAMPLE
        )
        assert.ok(owned.length > 0, 'none of the organisation’s items found')
        log(
          `Comparing ${owned.length} of the organisation's items and ${others.length} of other teams'`
        )
        const failures = []
        await inBatches(owned, async (item) => {
          failures.push(...(await differencesFromAccreditation(item)))
        })
        await inBatches(others, async (item) => {
          failures.push(...(await differencesForOthers(item)))
        })
        assert.deepStrictEqual(failures, [], failures.join('\n'))
      }
    )

    it('returns the same items for the organisation with and without organisationNumber', async () => {
      assert.ok(
        organisationSearch.items.length > 0,
        'the organisation search returned nothing'
      )
      const index = (search) =>
        new Map(search.items.map((item) => [item.accreditationNumber, item]))
      let byAccreditationNumber = index(yearSearch)
      // Other teams' data can shift items between pages while the year is
      // paged, even with totalItems unchanged (one added, one removed). So if
      // any of the organisation's items is missing, the year is paged once
      // more, and an item still missing fails: the year search skipped it.
      const missing = () =>
        organisationSearch.items.filter(
          ({ accreditationNumber }) =>
            !byAccreditationNumber.has(accreditationNumber)
        )
      if (missing().length > 0) {
        log(
          `${missing().map(describeItem).join(', ')} not in the year search; paging it again`
        )
        byAccreditationNumber = index(
          await searchAllPages(`year=${year}`, yearLimit)
        )
      }
      for (const item of organisationSearch.items) {
        const unfiltered = byAccreditationNumber.get(item.accreditationNumber)
        assert.ok(
          unfiltered,
          `${describeItem(item)} is missing from the search without organisationNumber, paged twice`
        )
        assert.deepStrictEqual(
          unfiltered,
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
    it(`serves a page of ${PAGE_LIMIT}, its exporters with their overseasSites, without a query timeout`, async (t) => {
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
        return
      }
      // The payload this page's cost is about: a page this large must still
      // carry each exporter's sites.
      for (const item of body.items) {
        assertSearchItemSites(item, { fullShape: false })
      }
    })

    // RA-820: the search takes pages of up to 500, so a client reading every
    // accreditation needs as few requests as possible (the rest of the API
    // stays at 100: validation.test.js). A page of the largest size is served
    // whole, each accreditation once, every exporter with its sites. As
    // above, the elapsed time and size are reported, not asserted: how 500
    // performs under load is for the performance tests.
    it(`takes the largest page, ${MAX_SEARCH_LIMIT}, and serves it whole without a query timeout (RA-820)`, async (t) => {
      const path = `/v1/accreditations?year=${year}&limit=${MAX_SEARCH_LIMIT}&pageNumber=1`
      const started = performance.now()
      const { status, body } = await getAccreditationApi(path)
      const elapsed = Math.round(performance.now() - started)
      assert.equal(status, 200, `GET ${path}: ${JSON.stringify(body)}`)
      assert.equal(body.limit, MAX_SEARCH_LIMIT)
      assert.equal(body.pageNumber, 1)
      assert.equal(
        body.items.length,
        Math.min(MAX_SEARCH_LIMIT, body.totalItems),
        `a page of up to ${MAX_SEARCH_LIMIT} of ${body.totalItems}`
      )
      const numbers = body.items.map((item) => item.accreditationNumber)
      assert.equal(
        new Set(numbers).size,
        numbers.length,
        'an accreditation is served twice on the page'
      )
      for (const item of body.items) {
        assertSearchItemSites(item, { fullShape: false })
      }

      const exporters = body.items.filter(isExporter).length
      const kilobytes = Math.round(
        Buffer.byteLength(JSON.stringify(body)) / 1024
      )
      const report = `Page of ${body.items.length} of ${body.totalItems} at limit ${MAX_SEARCH_LIMIT} (${exporters} exporters): ${elapsed}ms, ${kilobytes} KB`
      t.diagnostic(report)
      log(report)
    })
  }
)
