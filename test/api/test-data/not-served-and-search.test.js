import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { getAccreditationApi as get } from '../../helpers/accreditation-api.js'
import {
  ALL,
  FIXTURES,
  SERVED,
  detailPath,
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

const search = async (query) =>
  assertOk(await get(`/v1/accreditations${query}`), `search ${query}`)

describe('Fixed test data: what is not served', { skip: notConfigured }, () => {
  const { notGranted, before2027, reprocessorAluminium2027, exporterPaper } =
    FIXTURES

  describe(`990007: ${notGranted.what}`, () => {
    it('answers 404 accreditation_not_found for its 2027 accreditation', async () => {
      assertProblem(
        await get(detailPath(notGranted)),
        404,
        'accreditation_not_found'
      )
    })

    it('answers 404 accreditation_not_found on its overseas sites route', async () => {
      assertProblem(
        await get(sitesPath(notGranted)),
        404,
        'accreditation_not_found'
      )
    })

    for (const query of [
      `?organisationNumber=${notGranted.orgId}`,
      `?registrationNumber=${notGranted.registrationNumber}`
    ]) {
      it(`finds nothing for ${query}`, async () => {
        const body = await search(query)
        assert.deepStrictEqual(assertPage(body), [])
        assert.equal(body.totalItems, 0)
      })
    }
  })

  describe(`990008: ${before2027.what}`, () => {
    for (const year of [2026, 2027]) {
      it(`answers 404 accreditation_not_found for ${year}`, async () => {
        assertProblem(
          await get(detailPath(before2027, year)),
          404,
          'accreditation_not_found'
        )
      })
    }

    for (const query of [
      `?organisationNumber=${before2027.orgId}`,
      `?registrationNumber=${before2027.registrationNumber}`,
      `?organisationNumber=${before2027.orgId}&year=2026`
    ]) {
      it(`finds nothing for ${query}`, async () => {
        const body = await search(query)
        assert.deepStrictEqual(assertPage(body), [])
        assert.equal(body.totalItems, 0)
      })
    }
  })

  describe('years and registrations a record was not granted for', () => {
    it('answers 404 for 990006 in 2029, a year after its last', async () => {
      assertProblem(
        await get(detailPath(reprocessorAluminium2027, 2029)),
        404,
        'accreditation_not_found'
      )
    })

    it("answers 404 for 990003's registration under organisation 990001", async () => {
      assertProblem(
        await get(
          `/v1/organisations/${exporterPaper.orgId}/registrations/${FIXTURES.reprocessorPlastic.registrationNumber}/accreditations/2027`
        ),
        404,
        'accreditation_not_found'
      )
    })

    it('answers 404 for the documented NO-SUCH-REGISTRATION', async () => {
      assertProblem(
        await get(
          `/v1/organisations/${exporterPaper.orgId}/registrations/NO-SUCH-REGISTRATION/accreditations/2027`
        ),
        404,
        'accreditation_not_found'
      )
    })
  })
})

describe('Fixed test data: search', { skip: notConfigured }, () => {
  const al2027 = FIXTURES.reprocessorAluminium2027
  const al2028 = FIXTURES.reprocessorAluminium2028

  it('returns both of 990006 accreditations by organisationNumber, in accreditation number order', async () => {
    const body = await search(`?organisationNumber=${al2027.orgId}`)
    assert.deepStrictEqual(assertPage(body), [
      expectedSummary(al2027),
      expectedSummary(al2028)
    ])
    assert.equal(body.totalItems, 2)
  })

  it('returns both by registrationNumber, one registration across years', async () => {
    const body = await search(
      `?registrationNumber=${al2027.registrationNumber}`
    )
    assert.deepStrictEqual(assertPage(body), [
      expectedSummary(al2027),
      expectedSummary(al2028)
    ])
  })

  it('narrows to 2028 with year=2028', async () => {
    const body = await search(`?organisationNumber=${al2027.orgId}&year=2028`)
    assert.deepStrictEqual(assertPage(body), [expectedSummary(al2028)])
    assert.equal(body.totalItems, 1)
  })

  it('pages 990006 one at a time', async () => {
    const first = await search(
      `?organisationNumber=${al2027.orgId}&pageNumber=1&limit=1`
    )
    const second = await search(
      `?organisationNumber=${al2027.orgId}&pageNumber=2&limit=1`
    )
    assert.deepStrictEqual(assertPage(first, { limit: 1 }), [
      expectedSummary(al2027)
    ])
    assert.deepStrictEqual(assertPage(second, { pageNumber: 2, limit: 1 }), [
      expectedSummary(al2028)
    ])
    assert.equal(first.totalItems, 2)
    assert.equal(second.totalItems, 2)
  })

  it('combines filters with AND: a registration under another organisation finds nothing', async () => {
    const body = await search(
      `?organisationNumber=${FIXTURES.exporterPaper.orgId}&registrationNumber=${al2027.registrationNumber}`
    )
    assert.deepStrictEqual(assertPage(body), [])
  })

  for (const status of ['suspended', 'cancelled', 'withdrawn']) {
    it(`accepts status=${status} and finds none of the fixed records`, async () => {
      const body = await search(
        `?organisationNumber=${al2027.orgId}&status=${status}`
      )
      assert.deepStrictEqual(assertPage(body), [])
    })
  }

  it('finds nothing for an organisation with no records', async () => {
    const body = await search('?organisationNumber=999999')
    assert.deepStrictEqual(assertPage(body), [])
    assert.equal(body.totalItems, 0)
  })

  it('defaults to page 1 of 20', async () => {
    const body = await search('')
    const items = assertPage(body)
    assert.equal(items.length, Math.min(body.totalItems, 20))
  })

  it('returns every served fixed record once, and none of the others, across all pages in accreditation number order', async () => {
    const items = []
    let totalItems
    for (let pageNumber = 1; ; pageNumber++) {
      const body = await search(`?pageNumber=${pageNumber}&limit=100`)
      assertPage(body, { pageNumber, limit: 100 })
      totalItems ??= body.totalItems
      assert.equal(
        body.totalItems,
        totalItems,
        'totalItems changed between pages'
      )
      items.push(...body.items)
      if (body.items.length < 100 || items.length >= totalItems) {
        break
      }
    }
    assert.equal(items.length, totalItems)

    const numbers = items.map(({ accreditationNumber }) => accreditationNumber)
    assert.deepStrictEqual(numbers, [...numbers].sort(), 'not ordered')

    for (const f of SERVED) {
      const found = items.filter(
        ({ accreditationNumber }) =>
          accreditationNumber === f.accreditationNumber
      )
      assert.equal(found.length, 1, `${label(f)} found ${found.length} times`)
      assert.deepStrictEqual(found[0], expectedSummary(f))
    }
    for (const f of ALL.filter(({ served }) => !served)) {
      assert.ok(
        !items.some(
          ({ registrationNumber }) =>
            registrationNumber === f.registrationNumber
        ),
        `${label(f)} is served`
      )
    }
  })

  it('finds nothing for year=2026, before the scheme', async () => {
    const body = await search('?year=2026')
    assert.deepStrictEqual(assertPage(body), [])
    assert.equal(body.totalItems, 0)
  })
})
