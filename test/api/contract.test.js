import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'

import { getAccreditationApi } from '../helpers/accreditation-api.js'
import {
  BANDS,
  assertInterimSite,
  assertOverseasSite,
  assertSummary
} from './shapes.js'
import {
  DATE_TIME,
  assertAbsent,
  assertOneOf,
  assertStatusHistory,
  assertLatestStatus,
  assertLatestStatusMatchesHistory
} from './status-history.js'
import { INTERIM_SITE_STATUSES } from '../helpers/integration-organisation/interim-site-statuses.js'
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

    // RA-802: a search item is a summary (no history) plus, for an exporter,
    // its overseas sites, in the same shape as getting the accreditation, so
    // paging through search gives every accreditation with its sites. A
    // reprocessor item has none.
    it("searches as a page of summaries, with an exporter's overseas sites (RA-802)", async () => {
      const { status, body } = await getAccreditationApi(
        `/v1/accreditations?year=${year}&organisationNumber=${context.organisation.orgId}&limit=100`
      )
      assert.equal(status, 200)
      assert.equal(body.pageNumber, 1)
      assert.equal(body.limit, 100)
      assert.equal(body.totalItems, body.items.length)
      for (const item of body.items) {
        const what = `search item ${item.registrationNumber}`
        assertSummary(item)
        assert.equal(item.accreditationYear, year)
        assertAbsent(
          item,
          ['statusHistory', 'tonnageBandHistory', 'signatories'],
          what
        )
        if (item.wasteProcessingType === 'reprocessor') {
          assertAbsent(item, ['overseasSites'], what)
        }
      }

      // Matched by registration number, so the item compared is the one
      // context.exporter's detail path names, however each picks an exporter.
      const exporter =
        context.exporter &&
        body.items.find(
          ({ registrationNumber }) =>
            registrationNumber === context.exporter.registrationNumber
        )
      if (context.exporter) {
        assert.ok(
          exporter,
          `${context.exporter.registrationNumber} is not in the search`
        )
        assert.ok(
          Array.isArray(exporter.overseasSites),
          `${exporter.registrationNumber} search item has no overseasSites`
        )
        for (const site of exporter.overseasSites) {
          assertOverseasSite(site, { accreditationYear: year })
        }
        const detail = await getAccreditationApi(context.exporter.path)
        assert.equal(detail.status, 200)
        assert.deepStrictEqual(
          exporter.overseasSites,
          detail.body.overseasSites,
          "the search item's overseas sites are the accreditation's"
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
    })

    // Getting one registration was removed in v2 and is back since PAE-2318,
    // in a new shape (its applications' overseas sites), so it is not here.
    describe('endpoints v2 removed', () => {
      for (const [what, path] of [
        [
          'organisation',
          () => `/v1/organisations/${context.organisation.orgId}`
        ],
        ['registration search', () => '/v1/registrations']
      ]) {
        it(`answers 404 for the ${what} endpoint`, async () => {
          assert.equal((await getAccreditationApi(path())).status, 404)
        })
      }
    })
  }
)

// latestStatus (RA-773): in place of the status string, the latest entry of
// the status history, on every accreditation and overseas site.
describe(
  'Accreditation API: latestStatus (RA-773)',
  { skip: notConfigured },
  () => {
    let context

    before(async () => {
      context = await loadApiContext()
    })

    it('gives each search item a latestStatus in place of status', async () => {
      const { status, body } = await getAccreditationApi(
        `/v1/accreditations?year=${year}&organisationNumber=${context.organisation.orgId}&limit=100`
      )
      assert.equal(status, 200)
      for (const item of body.items) {
        assertLatestStatus(item, `accreditation ${item.accreditationNumber}`)
      }
    })

    for (const type of ['reprocessor', 'exporter']) {
      it(`gives the ${type} accreditation the latest entry of its statusHistory as latestStatus`, async (t) => {
        if (!requireGranted(t, context[type], type)) {
          return
        }
        const { status, body } = await getAccreditationApi(context[type].path)
        assert.equal(status, 200)
        assertLatestStatus(body, 'accreditation')
        assertLatestStatusMatchesHistory(body, 'accreditation')
      })
    }

    it('gives each overseas site the latest entry of its statusHistory as latestStatus', async (t) => {
      if (!requireGranted(t, context.exporter, 'exporter')) {
        return
      }
      const detail = await getAccreditationApi(context.exporter.path)
      const listed = await getAccreditationApi(
        `${context.exporter.path}/overseas-sites?limit=100`
      )
      assert.equal(detail.status, 200)
      assert.equal(listed.status, 200)
      for (const site of [...detail.body.overseasSites, ...listed.body.items]) {
        const what = `site ${site.orsId ?? site.siteName}`
        assertLatestStatus(site, what)
        assertLatestStatusMatchesHistory(site, what)
      }
    })
  }
)

// An interim site's status (RA-781), on the exporter accreditation the
// integration workflow granted. assertInterimSite (above) checks every interim
// site's statusHistory and latestStatus wherever one is returned; these check
// the cases the ticket names, on the interim sites the workflow's Test 2 gave
// each history to (INTERIM_SITE_STATUSES): restored, withdrawn, and added in
// place of the withdrawn one. Without them there is nothing to check those
// cases on, so the tests fail rather than skip.
describe(
  'Accreditation API: interim site status (RA-781)',
  { skip: notConfigured },
  () => {
    let context
    let detail
    let listed

    before(async () => {
      context = await loadApiContext()
      if (context.exporter) {
        detail = await getAccreditationApi(context.exporter.path)
        listed = await getAccreditationApi(
          `${context.exporter.path}/overseas-sites?limit=100`
        )
      }
    })

    // Every interim site, with the ORS it is on, from the accreditation.
    const interimSites = () =>
      detail.body.overseasSites.flatMap((site) =>
        site.interimSites.map((interim) => ({ ...interim, ors: site }))
      )

    // The one interim site the workflow named so, failing with what there is.
    function named(name) {
      const matches = interimSites().filter(({ siteName }) => siteName === name)
      assert.equal(
        matches.length,
        1,
        `expected one interim site named ${name} on ${context.exporter.registrationNumber}; ` +
          `it has: ${interimSites()
            .map(
              (i) =>
                `${i.siteName} [${i.statusHistory?.map((e) => e.status).join(' > ')}]`
            )
            .join(', ')}. The integration workflow's Test 2 creates them.`
      )
      return matches[0]
    }

    const statuses = (interim) =>
      interim.statusHistory.map(({ status }) => status)

    it('gives each interim site a statusHistory and latestStatus, and no removedAt', (t) => {
      if (!requireGranted(t, context.exporter, 'exporter')) {
        return
      }
      assert.equal(detail.status, 200)
      const all = interimSites()
      assert.ok(all.length > 0, 'no interim site was checked')
      for (const interim of all) {
        assertInterimSite(interim, detail.body.accreditationYear)
        // latestStatus follows from the history: approved unless the site's
        // last change withdrew it.
        assert.equal(
          interim.latestStatus.status,
          statuses(interim).includes('withdrawn') &&
            statuses(interim).at(-1) === 'withdrawn'
            ? 'withdrawn'
            : 'approved',
          `interim site ${interim.siteName} latestStatus`
        )
      }
    })

    it('gives a never-withdrawn interim site a latestStatus of approved', (t) => {
      if (!requireGranted(t, context.exporter, 'exporter')) {
        return
      }
      const never = interimSites().filter(
        (interim) => !statuses(interim).includes('withdrawn')
      )
      assert.ok(never.length > 0, 'no never-withdrawn interim site was checked')
      for (const interim of never) {
        assert.deepStrictEqual(
          statuses(interim),
          ['approved'],
          interim.siteName
        )
        assert.equal(interim.latestStatus.status, 'approved', interim.siteName)
      }
    })

    it('returns a withdrawn interim site, with a latestStatus of withdrawn', (t) => {
      if (!requireGranted(t, context.exporter, 'exporter')) {
        return
      }
      const withdrawn = named(INTERIM_SITE_STATUSES.withdrawn)
      assert.deepStrictEqual(statuses(withdrawn), ['approved', 'withdrawn'])
      assert.equal(withdrawn.latestStatus.status, 'withdrawn')
      assert.deepStrictEqual(
        withdrawn.latestStatus,
        withdrawn.statusHistory.at(-1)
      )
      // Returned by the overseas sites list too, without being asked for.
      assert.equal(listed.status, 200)
      const inList = listed.body.items
        .flatMap((site) => site.interimSites)
        .find(({ siteId }) => siteId === withdrawn.siteId)
      assert.ok(
        inList,
        'the withdrawn interim site is not in the overseas sites list'
      )
      assert.deepStrictEqual(inList.statusHistory, withdrawn.statusHistory)
    })

    it('keeps a restored interim site as one site: approved, withdrawn, approved', (t) => {
      if (!requireGranted(t, context.exporter, 'exporter')) {
        return
      }
      const restored = named(INTERIM_SITE_STATUSES.restored)
      assert.deepStrictEqual(statuses(restored), [
        'approved',
        'withdrawn',
        'approved'
      ])
      assert.equal(restored.latestStatus.status, 'approved')
      assert.deepStrictEqual(
        restored.latestStatus,
        restored.statusHistory.at(-1)
      )
    })

    // recordedAt is when a status change was recorded. The workflow's Test 2
    // makes each change as its own request, so even without
    // STATUS_STEP_PAUSE_MS they are hundreds of milliseconds apart, and
    // recordedAt has millisecond precision. Each must therefore be strictly
    // later than the one before. Not >=: equal values are the defect this
    // catches (every recordedAt replaced by the approval time).
    it('records when each interim site status change happened (recordedAt)', (t) => {
      if (!requireGranted(t, context.exporter, 'exporter')) {
        return
      }
      for (const name of [
        INTERIM_SITE_STATUSES.restored,
        INTERIM_SITE_STATUSES.withdrawn
      ]) {
        const { statusHistory } = named(name)
        const recorded = statusHistory.map(
          ({ status, recordedAt }) => `${status} ${recordedAt}`
        )
        statusHistory.slice(1).forEach((entry, i) => {
          assert.ok(
            Date.parse(entry.recordedAt) >
              Date.parse(statusHistory[i].recordedAt),
            `${name}: ${entry.status} is recorded at ${entry.recordedAt}, ` +
              `not after the ${statusHistory[i].status} before it ` +
              `(${statusHistory[i].recordedAt}). History: ${recorded.join(', ')}`
          )
        })
      }
    })

    it('shows an interim site added after another was withdrawn as a separate site', (t) => {
      if (!requireGranted(t, context.exporter, 'exporter')) {
        return
      }
      const withdrawn = named(INTERIM_SITE_STATUSES.withdrawn)
      const replacement = named(INTERIM_SITE_STATUSES.replacement)
      assert.notEqual(replacement.siteId, withdrawn.siteId)
      assert.notEqual(replacement.siteNumber, withdrawn.siteNumber)
      assert.equal(
        replacement.ors.siteId,
        withdrawn.ors.siteId,
        "the replacement is on the withdrawn interim site's overseas site"
      )
      // Its own history, which the withdrawn site's does not carry over to.
      assert.deepStrictEqual(statuses(replacement), ['approved'])
      assert.equal(replacement.latestStatus.status, 'approved')
      assert.deepStrictEqual(statuses(withdrawn), ['approved', 'withdrawn'])
    })

    it('serves the same interim sites from the accreditation, its overseas sites list, and each site', async (t) => {
      if (!requireGranted(t, context.exporter, 'exporter')) {
        return
      }
      for (const site of detail.body.overseasSites.filter(
        ({ orsId }) => orsId
      )) {
        const one = await getAccreditationApi(
          `${context.exporter.path}/overseas-sites/${site.orsId}`
        )
        assert.equal(one.status, 200)
        assert.deepStrictEqual(
          one.body.interimSites,
          site.interimSites,
          site.orsId
        )
        const inList = listed.body.items.find(
          ({ orsId }) => orsId === site.orsId
        )
        assert.deepStrictEqual(
          inList?.interimSites,
          site.interimSites,
          site.orsId
        )
      }
    })

    it('no longer takes includeWithdrawn: the same response whatever it says', async (t) => {
      if (!requireGranted(t, context.exporter, 'exporter')) {
        return
      }
      for (const [what, path] of [
        ['accreditation', context.exporter.path],
        ['overseas sites', `${context.exporter.path}/overseas-sites?limit=100`]
      ]) {
        const plain = await getAccreditationApi(path)
        assert.equal(plain.status, 200, what)
        for (const value of ['true', 'false', 'maybe']) {
          const separator = path.includes('?') ? '&' : '?'
          const sent = await getAccreditationApi(
            `${path}${separator}includeWithdrawn=${value}`
          )
          assert.equal(sent.status, 200, `${what} includeWithdrawn=${value}`)
          assert.deepStrictEqual(
            sent.body,
            plain.body,
            `${what} includeWithdrawn=${value}`
          )
        }
      }
    })
  }
)
