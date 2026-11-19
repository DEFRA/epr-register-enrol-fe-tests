import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { getAccreditationApi as get } from '../../helpers/accreditation-api.js'
import {
  EXPORTERS,
  FIXTURES,
  SERVED,
  detailPath,
  expectedDetail,
  expectedSite,
  expectedSites,
  expectedSummary,
  label,
  sitesPath
} from './fixtures.js'
import {
  assertOk,
  assertPage,
  assertProblem,
  notConfigured
} from './support.js'

// Every fixed accreditation the API serves, checked field for field against
// what the backend seeds: the detail, the search item, and for an exporter
// each accredited overseas site and its interim sites.

describe(
  'Fixed test data: served accreditations',
  { skip: notConfigured },
  () => {
    for (const f of SERVED) {
      describe(`${label(f)}: ${f.what}`, () => {
        it('returns the whole accreditation, field for field', async () => {
          const body = assertOk(await get(detailPath(f)), 'detail')
          assert.deepStrictEqual(body, expectedDetail(f))
        })

        it('gives latestStatus as the latest statusHistory entry, with no status string', async () => {
          const body = assertOk(await get(detailPath(f)), 'detail')
          assert.ok(!('status' in body), 'the status string is still served')
          assert.deepStrictEqual(body.latestStatus, body.statusHistory.at(-1))
        })

        it('finds it by organisationNumber, registrationNumber and year together', async () => {
          const body = assertOk(
            await get(
              `/v1/accreditations?organisationNumber=${f.orgId}&registrationNumber=${f.registrationNumber}&year=${f.year}`
            ),
            'search'
          )
          assert.deepStrictEqual(assertPage(body), [expectedSummary(f)])
          assert.equal(body.totalItems, 1)
        })

        it('finds it with status=approved', async () => {
          const body = assertOk(
            await get(
              `/v1/accreditations?registrationNumber=${f.registrationNumber}&year=${f.year}&status=approved`
            ),
            'search'
          )
          assert.deepStrictEqual(assertPage(body), [expectedSummary(f)])
        })

        if (f.wasteProcessingType === 'reprocessor') {
          it('has no overseas sites (an empty page on the sites route)', async () => {
            const body = assertOk(await get(sitesPath(f)), 'sites')
            assert.deepStrictEqual(assertPage(body), [])
            assert.equal(body.totalItems, 0)
          })
        }
      })
    }

    for (const f of EXPORTERS) {
      describe(`${label(f)}: overseas sites`, () => {
        it('includeWithdrawn=false returns the same as no parameter', async () => {
          const body = assertOk(
            await get(`${detailPath(f)}?includeWithdrawn=false`),
            'detail'
          )
          assert.deepStrictEqual(body, expectedDetail(f))
        })

        it('includeWithdrawn=true returns the detail with any withdrawn interim site', async () => {
          const body = assertOk(
            await get(`${detailPath(f)}?includeWithdrawn=true`),
            'detail'
          )
          assert.deepStrictEqual(
            body,
            expectedDetail(f, { includeWithdrawn: true })
          )
        })

        it('lists the accredited sites, ordered by orsId, on the sites route', async () => {
          const body = assertOk(await get(`${sitesPath(f)}?limit=100`), 'sites')
          assert.deepStrictEqual(
            assertPage(body, { limit: 100 }),
            expectedSites(f)
          )
          assert.equal(body.totalItems, f.overseasSites)
        })

        it('lists them with any withdrawn interim site when includeWithdrawn=true', async () => {
          const body = assertOk(
            await get(`${sitesPath(f)}?limit=100&includeWithdrawn=true`),
            'sites'
          )
          assert.deepStrictEqual(
            assertPage(body, { limit: 100 }),
            expectedSites(f, { includeWithdrawn: true })
          )
        })

        it('lists a first page of up to 20 by default', async () => {
          const body = assertOk(await get(sitesPath(f)), 'sites')
          assert.deepStrictEqual(
            assertPage(body),
            expectedSites(f).slice(0, 20)
          )
        })

        for (let number = 1; number <= f.overseasSites; number++) {
          const orsId = String(number).padStart(3, '0')
          it(`returns site ${orsId} by orsId`, async () => {
            const body = assertOk(await get(`${sitesPath(f)}/${orsId}`), 'site')
            assert.deepStrictEqual(body, expectedSite(f, number))
          })
        }

        const beyond = String(
          f.overseasSites + f.unaccreditedOverseasSites + 1
        ).padStart(3, '0')
        it(`answers 404 overseas_site_not_found for site ${beyond}, which it does not have`, async () => {
          assertProblem(
            await get(`${sitesPath(f)}/${beyond}`),
            404,
            'overseas_site_not_found'
          )
        })
      })
    }

    describe('990002: paging 10 overseas sites', () => {
      const f = FIXTURES.exporterFibre
      const page = async (pageNumber) =>
        assertOk(
          await get(`${sitesPath(f)}?pageNumber=${pageNumber}&limit=3`),
          `page ${pageNumber}`
        )

      it('returns 004 to 006 on page 2 of 3 a page', async () => {
        const body = await page(2)
        assert.deepStrictEqual(
          assertPage(body, { pageNumber: 2, limit: 3 }),
          expectedSites(f).slice(3, 6)
        )
        assert.equal(body.totalItems, 10)
      })

      it('returns only 010 on the last page', async () => {
        const body = await page(4)
        assert.deepStrictEqual(assertPage(body, { pageNumber: 4, limit: 3 }), [
          expectedSite(f, 10)
        ])
      })

      it('returns an empty page past the end', async () => {
        const body = await page(5)
        assert.deepStrictEqual(
          assertPage(body, { pageNumber: 5, limit: 3 }),
          []
        )
        assert.equal(body.totalItems, 10)
      })
    })

    describe('990005: sites registered but not accredited, and a withdrawn interim site', () => {
      const f = FIXTURES.exporterWood

      it('answers 404 overseas_site_not_found for 003, registered but not accredited', async () => {
        assertProblem(
          await get(`${sitesPath(f)}/003`),
          404,
          'overseas_site_not_found'
        )
      })

      it('leaves the withdrawn interim site off 001 without includeWithdrawn', async () => {
        const body = assertOk(await get(`${sitesPath(f)}/001`), 'site')
        assert.deepStrictEqual(
          body.interimSites.map(({ siteNumber }) => siteNumber),
          ['TD-990005-001-1']
        )
      })

      it('returns the withdrawn interim site on 001, with removedAt, when includeWithdrawn=true', async () => {
        const body = assertOk(
          await get(`${sitesPath(f)}/001?includeWithdrawn=true`),
          'site'
        )
        assert.deepStrictEqual(
          body,
          expectedSite(f, 1, { includeWithdrawn: true })
        )
        assert.equal(body.interimSites[1].removedAt, '2026-10-15T00:00:00Z')
      })
    })
  }
)
