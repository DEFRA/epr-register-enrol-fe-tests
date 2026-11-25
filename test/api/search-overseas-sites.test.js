import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'

import {
  accreditationPath,
  getAccreditationApi
} from '../helpers/accreditation-api.js'
import { assertOverseasSite, assertSummary } from './shapes.js'
import { assertAbsent } from './status-history.js'
import { loadApiContext, log, notConfigured, year } from './support.js'

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

/** Every page of a search, from page 1 until the items run out. */
async function searchAllPages(query, limit) {
  const pages = []
  for (let pageNumber = 1; ; pageNumber++) {
    const path = `/v1/accreditations?${query}&limit=${limit}&pageNumber=${pageNumber}`
    const { status, body } = await getAccreditationApi(path)
    assert.equal(status, 200, `GET ${path}: ${JSON.stringify(body)}`)
    assert.equal(body.pageNumber, pageNumber)
    pages.push(body)
    if (pageNumber * limit >= body.totalItems) {
      return pages
    }
    assert.equal(body.items.length, limit, `page ${pageNumber} is not full`)
  }
}

/** Runs fn over items, a few at a time. */
async function inBatches(items, fn, size = 5) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn))
  }
}

// The overseasSites contract for one search item, on whatever page it came.
function assertOverseasSitesProperty(item) {
  const what = describeItem(item)
  if (item.wasteProcessingType === 'reprocessor') {
    assertAbsent(item, ['overseasSites'], what)
    return
  }
  assert.ok(
    Array.isArray(item.overseasSites),
    `${what} has no overseasSites array: ${JSON.stringify(item.overseasSites)}`
  )
  for (const site of item.overseasSites) {
    assertOverseasSite(site, { accreditationYear: item.accreditationYear })
  }
  const order = item.overseasSites.map(({ orsId, siteId }) => [orsId, siteId])
  const sorted = [...order].sort(([a, x], [b, y]) =>
    a === b ? x - y : a < b ? -1 : 1
  )
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

    before(async () => {
      context = await loadApiContext()
      // With organisationNumber, one item a page, so each item is a page of
      // its own.
      const organisationPages = await searchAllPages(
        `year=${year}&organisationNumber=${context.organisation.orgId}`,
        1
      )
      organisationItems = organisationPages.flatMap(({ items }) => items)
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

    it('searches the organisation, an exporter and a reprocessor at least', () => {
      const types = new Set(
        organisationItems.map(({ wasteProcessingType }) => wasteProcessingType)
      )
      assert.ok(types.has('exporter'), 'the organisation has no exporter')
      assert.ok(types.has('reprocessor'), 'the organisation has no reprocessor')
    })

    it("gives each of the organisation's exporters the same overseasSites as getting it", async () => {
      const exporters = organisationItems.filter(
        ({ wasteProcessingType }) => wasteProcessingType === 'exporter'
      )
      for (const item of exporters) {
        assertOverseasSitesProperty(item)
        assert.ok(
          item.overseasSites.length > 0,
          `${describeItem(item)} has no overseas sites`
        )
        await assertMatchesAccreditation(item)
      }
    })

    it("leaves overseasSites out of each of the organisation's reprocessors", () => {
      const reprocessors = organisationItems.filter(
        ({ wasteProcessingType }) => wasteProcessingType === 'reprocessor'
      )
      for (const item of reprocessors) {
        assertOverseasSitesProperty(item)
      }
    })

    it('carries overseasSites on every page of a search by organisationNumber', () => {
      // One item a page: each page's item is checked on a page of its own.
      assert.ok(organisationItems.length > 1, 'fewer than two pages')
      for (const item of organisationItems) {
        assertOverseasSitesProperty(item)
      }
    })

    it('carries overseasSites on every page of a search without organisationNumber', () => {
      for (const [index, page] of yearPages.entries()) {
        assert.ok(page.items.length > 0, `page ${index + 1} is empty`)
        for (const item of page.items) {
          assertSummary(item)
          assertOverseasSitesProperty(item)
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

    it('keeps every field search returned before, and adds only overseasSites', () => {
      for (const item of yearPages.flatMap(({ items }) => items)) {
        const what = describeItem(item)
        for (const field of REQUIRED_SUMMARY_FIELDS) {
          assert.ok(field in item, `${what} has no ${field}`)
        }
        const extra = Object.keys(item).filter(
          (key) => !SEARCH_ITEM_FIELDS.includes(key)
        )
        assert.deepStrictEqual(extra, [], `${what} has fields search never had`)
      }
    })

    it('gives an exporter with no selected overseas sites overseasSites: []', async (t) => {
      const empty = yearPages
        .flatMap(({ items }) => items)
        .filter(
          (item) =>
            item.wasteProcessingType === 'exporter' &&
            item.overseasSites?.length === 0
        )
      if (empty.length === 0) {
        // A granted exporter always has a selected site: the overseas
        // sites section cannot be completed without one. The backend's
        // Search_ExporterWithNoSelectedSites_HasAnEmptyOverseasSites covers
        // it on seeded data.
        t.todo(`no ${year} exporter on test has no selected overseas sites`)
        return
      }
      for (const item of empty) {
        await assertMatchesAccreditation(item)
      }
    })

    it(`serves a page of ${PAGE_LIMIT}, exporters included, within the ${QUERY_TIMEOUT_MS / 1000}s query timeout`, async (t) => {
      const path = `/v1/accreditations?year=${year}&limit=${PAGE_LIMIT}`
      // Warm: the first call of a connection also signs in and connects.
      await getAccreditationApi(path)
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
      if (body.items.length < PAGE_LIMIT) {
        t.todo(
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
