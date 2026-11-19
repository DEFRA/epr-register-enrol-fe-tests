import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { getAccreditationApi as get } from '../../helpers/accreditation-api.js'
import { EXPORTERS, SERVED, detailPath, label, sitesPath } from './fixtures.js'
import { assertOk, notConfigured } from './support.js'

// RA-773's acceptance criteria, one test each where the fixed records can show
// it: latestStatus in place of the status string, on every accreditation, its
// search item and each overseas site (ORS). The same values are also checked
// field for field in served-accreditations.test.js.
//
// Not covered here: two latest entries sharing an effectiveFromDate (the
// recordedAt tie-break). The backend serves every accreditation with one
// approved entry (AccreditationApiMapper's StatusHistory), so no record in any
// environment can show it until a second status change can be recorded.

const STATUS_ENTRY_FIELDS = [
  'effectiveFromDate',
  'effectiveToDate',
  'recordedAt',
  'status'
]

// Today's UK date (yyyy-MM-dd), as effectiveFromDate is written.
const todayInUk = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(
    new Date()
  )

/** No status string, and a latestStatus with a status entry's fields. */
function assertHasLatestStatus(record, what) {
  assert.ok(!('status' in record), `${what} still has a status string`)
  assert.ok(record.latestStatus, `${what} has no latestStatus`)
  assert.deepStrictEqual(
    Object.keys(record.latestStatus).sort(),
    STATUS_ENTRY_FIELDS,
    `${what} latestStatus fields`
  )
  for (const entry of record.statusHistory ?? []) {
    assert.deepStrictEqual(
      Object.keys(entry).sort(),
      STATUS_ENTRY_FIELDS,
      `${what} statusHistory entry fields`
    )
  }
}

/** latestStatus is the latest statusHistory entry, identical. */
function assertLatestIsLastEntry(record, what) {
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
    `${what}: not the latest entry`
  )
  assert.deepStrictEqual(
    record.latestStatus,
    record.statusHistory.at(-1),
    `${what}: not the last entry of statusHistory`
  )
}

/** Every overseas site an exporter serves, from all three site routes. */
async function allSites(f) {
  const detail = assertOk(
    await get(`${detailPath(f)}?includeWithdrawn=true`),
    'detail'
  )
  const listed = assertOk(
    await get(`${sitesPath(f)}?limit=100&includeWithdrawn=true`),
    'sites'
  )
  const single = []
  for (const { orsId } of listed.items) {
    single.push(
      assertOk(await get(`${sitesPath(f)}/${orsId}`), `site ${orsId}`)
    )
  }
  return [
    ...detail.overseasSites.map((s) => [`detail site ${s.orsId}`, s]),
    ...listed.items.map((s) => [`listed site ${s.orsId}`, s]),
    ...single.map((s) => [`site ${s.orsId}`, s])
  ]
}

describe(
  'RA-773 latestStatus: acceptance criteria',
  { skip: notConfigured },
  () => {
    describe('An accreditation has no status string, and has a latestStatus with the same fields as a status history entry', () => {
      for (const f of SERVED) {
        it(label(f), async () => {
          assertHasLatestStatus(
            assertOk(await get(detailPath(f)), 'detail'),
            label(f)
          )
        })
      }
    })

    describe('Each ORS has no status string, and has a latestStatus with the same fields as a status history entry', () => {
      for (const f of EXPORTERS) {
        it(label(f), async () => {
          for (const [what, site] of await allSites(f)) {
            assertHasLatestStatus(site, `${label(f)} ${what}`)
          }
        })
      }
    })

    describe("An accreditation's latestStatus is identical to the latest entry in its statusHistory", () => {
      for (const f of SERVED) {
        it(label(f), async () => {
          assertLatestIsLastEntry(
            assertOk(await get(detailPath(f)), 'detail'),
            label(f)
          )
        })
      }
    })

    describe("Each ORS's latestStatus is identical to the latest entry in its statusHistory", () => {
      for (const f of EXPORTERS) {
        it(label(f), async () => {
          for (const [what, site] of await allSites(f)) {
            assertLatestIsLastEntry(site, `${label(f)} ${what}`)
          }
        })
      }
    })

    describe("Where the latest entry's effectiveFromDate is in the future, latestStatus is still that entry", () => {
      for (const f of SERVED) {
        it(label(f), async (t) => {
          const body = assertOk(await get(detailPath(f)), 'detail')
          const latest = body.statusHistory.at(-1)
          const today = todayInUk()
          if (latest.effectiveFromDate <= today) {
            t.skip(
              `its latest entry applies from ${latest.effectiveFromDate}, not after today (${today})`
            )
            return
          }
          assert.deepStrictEqual(body.latestStatus, latest)
          assert.ok(body.latestStatus.effectiveFromDate > today)
          for (const site of body.overseasSites ?? []) {
            assert.deepStrictEqual(site.latestStatus, site.statusHistory.at(-1))
            assert.ok(site.latestStatus.effectiveFromDate > today)
          }
        })
      }
    })

    it(
      'Where the two latest entries share an effectiveFromDate, latestStatus is the one with the later recordedAt',
      {
        todo: 'the API serves every accreditation with one status entry, so no record can show the tie-break yet'
      },
      () => {}
    )

    describe('Search results carry latestStatus on each accreditation', () => {
      for (const f of SERVED) {
        it(label(f), async () => {
          const body = assertOk(
            await get(
              `/v1/accreditations?registrationNumber=${f.registrationNumber}&year=${f.year}`
            ),
            'search'
          )
          assert.equal(body.items.length, 1)
          const [item] = body.items
          assertHasLatestStatus(item, `search item ${label(f)}`)
          const detail = assertOk(await get(detailPath(f)), 'detail')
          assert.deepStrictEqual(item.latestStatus, detail.latestStatus)
        })
      }
    })
  }
)
