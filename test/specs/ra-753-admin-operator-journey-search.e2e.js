import { randomUUID } from 'node:crypto'

import { browser, expect } from '@wdio/globals'
import LoginPage from 'page-objects/login.page'
import OperatorPage from 'page-objects/operator.page'
import {
  getApplication,
  issueAccreditationNumber,
  pushStatusChanged
} from '../helpers/case-management.js'
import { skipDockerOnlyOnDeployedEnvironment } from '../helpers/docker-only.js'
import { disposableYear } from '../helpers/disposable-year.js'
import {
  openApplicationForYear,
  submitApplicationForYear
} from '../helpers/accreditation-journey.js'
import {
  expectProblem,
  getOverseasSiteCountries,
  OPERATOR_JOURNEY_RECORD_TYPES,
  searchOperatorJourney
} from '../helpers/admin-api.js'
import { nonAdminApiClient } from '../config.js'

/**
 * RA-753: Search Operator journey (remodelled) records (epic RA-639).
 *
 * The Admin UI's Operator journey search reads five record types from the
 * backend's domain model collections, through
 * GET /admin/operator-journey/{accreditations | accreditation-applications |
 * registrations | organisations | overseas-sites}, behind the admin-only
 * service client policy: q (an id, a number or reference, or an organisation
 * name, in part and in any case), each type's filters, and paging, most
 * recently changed first, current versions only.
 *
 * What this proves end to end that the backend's unit tests do not: that the
 * records an operator's real journey writes through the frontend (the seed
 * when a year's application is opened, every save and the submit, and case
 * management's status pushes, all dual-written: docker/config/operator-be.env)
 * are the ones these searches find, by the ids, numbers and names the backend
 * stored, with the organisation's name and number joined in from
 * `organisations`; that each record shows once, at its current version,
 * however many versions it has; and that the routes answer the signed admin
 * client this stack registers and refuse any other.
 *
 * Each search is narrowed to this spec's own records by a run-unique
 * disposableYear() (applications and accreditations) or by an id or number
 * the spec read back, so records other specs write in parallel cannot change
 * its counts. Organisation 50003 (Delta Green Ltd, Plastic) and 50006 (Glass
 * exporter) are shared with other specs, so for them it only asserts what
 * holds whatever else those specs write.
 *
 * The Admin UI page itself has no e2e suite; its own tests cover it.
 */
describe('RA-753: Operator journey search on the admin API @docker-only', () => {
  // An application in a year no other spec uses, opened (seeded) and left,
  // and another submitted after it: the most recently changed.
  const startedYear = disposableYear()
  const submittedYear = disposableYear()
  const years = [submittedYear, startedYear]
  let submitted
  let started
  // The application reference case management issued at submission, as
  // the Legacy application stores it.
  let submittedReference

  // Every search here also needs a q or a filter no other spec's records
  // match, so a page holds only this spec's records.
  const search = (type, params) => searchOperatorJourney(type, params)
  const ids = (response) => response.body.items.map((item) => item.id)
  const noSuchText = () => `ra-753-no-such-record-${randomUUID()}`

  before(async function () {
    skipDockerOnlyOnDeployedEnvironment(this)

    await browser.deleteCookies()
    await LoginPage.open()
    await LoginPage.openOperatorLogin()
    await LoginPage.loginAsOperator()
    await OperatorPage.open()
    await OperatorPage.navigateToReaccreditationPlastic()
    await openApplicationForYear(startedYear)
    await OperatorPage.open()
    await OperatorPage.navigateToReaccreditationPlastic()
    const { organisationId, applicationId } =
      await submitApplicationForYear(submittedYear)
    ;({ applicationReference: submittedReference } = await getApplication(
      organisationId,
      applicationId
    ))
    expect(submittedReference).toEqual(expect.any(String))

    const both = await search('accreditation-applications', { year: years })
    expect(both.status).toBe(200)
    ;[submitted, started] = both.body.items
    expect(submitted?.year).toBe(Number(submittedYear))
    expect(started?.year).toBe(Number(startedYear))
  })

  after(async () => {
    await LoginPage.signOut()
  })

  describe('accreditation applications', () => {
    it('lists every current application of the years selected, once each, most recently changed first', async () => {
      const both = await search('accreditation-applications', { year: years })

      expect(both.status).toBe(200)
      // Each has a version per save, and the submitted one more again, but
      // only the current one is listed.
      expect(both.body).toEqual({
        pageNumber: 1,
        limit: 50,
        totalItems: 2,
        items: [submitted, started]
      })
      expect(Date.parse(submitted.updatedAt)).toBeGreaterThan(
        Date.parse(started.updatedAt)
      )
    })

    it('shows each application its reference, status, year, registration, organisation and last changed date', async () => {
      expect(submitted).toEqual({
        id: expect.stringMatching(/^[0-9a-f]{24}$/),
        applicationReference: submittedReference,
        accreditationNumber: submitted.accreditationNumber,
        status: 'Submitted',
        year: Number(submittedYear),
        registrationId: expect.stringMatching(/^[0-9a-f]{24}$/),
        registrationNumber: expect.any(String),
        material: 'Plastic',
        nation: expect.any(String),
        organisation: {
          id: expect.stringMatching(/^[0-9a-f]{24}$/),
          name: expect.any(String),
          number: 50003
        },
        updatedAt: expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/
        )
      })
      // A draft has no reference until it is first submitted.
      expect(started.applicationReference).toBeNull()
      expect(started.status).not.toBe('Submitted')
      // Both are the same registration's, so the same organisation's.
      expect(started.registrationId).toBe(submitted.registrationId)
      expect(started.organisation).toEqual(submitted.organisation)
    })

    it('finds an application by its exact id or application reference (AC03)', async () => {
      const byReference = await search('accreditation-applications', {
        q: submitted.applicationReference
      })
      expect(byReference.status).toBe(200)
      expect(byReference.body.totalItems).toBe(1)
      expect(byReference.body.items).toEqual([submitted])

      const byId = await search('accreditation-applications', {
        q: started.id,
        searchFields: 'id'
      })
      expect(byId.body.totalItems).toBe(1)
      expect(byId.body.items).toEqual([started])

      // An id only matches whole.
      const byPartId = await search('accreditation-applications', {
        q: started.id.slice(0, 20),
        searchFields: 'id',
        year: years
      })
      expect(byPartId.body.totalItems).toBe(0)
    })

    it('finds applications by their exact registration and organisation numbers (AC03)', async () => {
      const byRegistration = await search('accreditation-applications', {
        q: submitted.registrationNumber,
        searchFields: 'registrationNumber',
        year: years
      })
      expect(ids(byRegistration)).toEqual([submitted.id, started.id])

      const byOrganisation = await search('accreditation-applications', {
        q: String(submitted.organisation.number),
        searchFields: 'organisationNumber',
        year: years
      })
      expect(ids(byOrganisation)).toEqual([submitted.id, started.id])
    })

    it('finds applications by part of a reference or number (AC04)', async () => {
      // The reference without its first and last two characters.
      const byPartReference = await search('accreditation-applications', {
        q: submitted.applicationReference.slice(2, -2),
        searchFields: 'applicationReference'
      })
      expect(ids(byPartReference)).toEqual([submitted.id])

      const registrationNumber = submitted.registrationNumber
      const byPartRegistration = await search('accreditation-applications', {
        q: registrationNumber.slice(1, -1),
        searchFields: 'registrationNumber',
        year: years
      })
      expect(ids(byPartRegistration)).toEqual([submitted.id, started.id])

      const byPartOrganisation = await search('accreditation-applications', {
        q: String(submitted.organisation.number).slice(1),
        searchFields: 'organisationNumber',
        year: years
      })
      expect(ids(byPartOrganisation)).toEqual([submitted.id, started.id])
    })

    it('finds applications by part of their organisation name, in any case (AC05, AC06)', async () => {
      const name = submitted.organisation.name
      const part = name.slice(1, -1)
      const mixed = [...part]
        .map((c, i) => (i % 2 ? c.toLowerCase() : c.toUpperCase()))
        .join('')

      for (const q of [
        name,
        part,
        part.toUpperCase(),
        part.toLowerCase(),
        mixed
      ]) {
        const response = await search('accreditation-applications', {
          q,
          year: years
        })
        expect(ids(response)).toEqual([submitted.id, started.id])
      }

      const lowerReference = await search('accreditation-applications', {
        q: submitted.applicationReference.toLowerCase()
      })
      expect(ids(lowerReference)).toEqual([submitted.id])
    })

    it('searches only the search fields given', async () => {
      const response = await search('accreditation-applications', {
        q: submitted.organisation.name,
        searchFields: ['applicationReference', 'registrationNumber'],
        year: years
      })
      expect(response.status).toBe(200)
      expect(response.body.totalItems).toBe(0)
    })

    it('matches any of one filter’s values, and every filter and the search together (AC07, AC08)', async () => {
      const withStatus = (status) =>
        search('accreditation-applications', { year: years, status })

      expect(ids(await withStatus('Submitted'))).toEqual([submitted.id])
      expect(ids(await withStatus(['Submitted', started.status]))).toEqual([
        submitted.id,
        started.id
      ])

      const allFilters = await search('accreditation-applications', {
        q: submitted.organisation.name.toLowerCase(),
        year: years,
        status: 'Submitted',
        material: ['Glass', 'Plastic'],
        nation: submitted.nation
      })
      expect(allFilters.body.items).toEqual([submitted])

      const otherMaterial = await search('accreditation-applications', {
        q: submitted.organisation.name,
        year: years,
        material: 'Glass'
      })
      expect(otherMaterial.body.totalItems).toBe(0)
    })

    it('pages through the matches, with the total on every page (AC11)', async () => {
      const page = (pageNumber) =>
        search('accreditation-applications', {
          year: years,
          limit: 1,
          pageNumber
        })

      const [first, second, pastTheEnd] = [
        await page(1),
        await page(2),
        await page(3)
      ]
      expect(first.body).toEqual({
        pageNumber: 1,
        limit: 1,
        totalItems: 2,
        items: [submitted]
      })
      expect(second.body).toEqual({
        pageNumber: 2,
        limit: 1,
        totalItems: 2,
        items: [started]
      })
      expect(pastTheEnd.status).toBe(200)
      expect(pastTheEnd.body).toEqual({
        pageNumber: 3,
        limit: 1,
        totalItems: 2,
        items: []
      })

      const hundred = await search('accreditation-applications', {
        year: years,
        limit: 100
      })
      expect(hundred.status).toBe(200)
      expect(hundred.body.limit).toBe(100)
    })
  })

  describe('registrations', () => {
    let registration

    before(async () => {
      const response = await search('registrations', {
        q: submitted.registrationNumber,
        searchFields: 'registrationNumber'
      })
      expect(response.status).toBe(200)
      registration = response.body.items.find(
        (item) => item.id === submitted.registrationId
      )
    })

    it('finds the applications’ registration by its exact number, with its status, material, nation and organisation (AC03, AC09)', () => {
      expect(registration).toEqual({
        id: submitted.registrationId,
        registrationNumber: submitted.registrationNumber,
        status: expect.any(String),
        material: 'Plastic',
        nation: submitted.nation,
        wasteProcessingType: 'Reprocessor',
        organisation: submitted.organisation,
        updatedAt: expect.any(String)
      })
    })

    it('finds it by its exact id, by part of its number and by its organisation, in any case (AC03 to AC06)', async () => {
      const byId = await search('registrations', {
        q: registration.id.toUpperCase(),
        searchFields: 'id'
      })
      expect(byId.body.totalItems).toBe(1)
      expect(byId.body.items).toEqual([registration])

      for (const params of [
        {
          q: registration.registrationNumber.slice(1, -1).toLowerCase(),
          searchFields: 'registrationNumber'
        },
        { q: String(registration.organisation.number) },
        { q: registration.organisation.name.toUpperCase() }
      ]) {
        const response = await search('registrations', {
          ...params,
          limit: 100
        })
        expect(ids(response)).toContain(registration.id)
      }
    })

    it('matches its filters with the search (AC07, AC08)', async () => {
      const filtered = (filters) =>
        search('registrations', {
          q: registration.id,
          searchFields: 'id',
          ...filters
        })

      expect(
        ids(
          await filtered({
            status: registration.status,
            material: ['Glass', 'Plastic'],
            nation: registration.nation
          })
        )
      ).toEqual([registration.id])
      expect((await filtered({ material: 'Glass' })).body.totalItems).toBe(0)
    })
  })

  describe('organisations', () => {
    let organisation

    before(async () => {
      const response = await search('organisations', {
        q: submitted.organisation.id,
        searchFields: 'id'
      })
      expect(response.status).toBe(200)
      expect(response.body.totalItems).toBe(1)
      organisation = response.body.items[0]
    })

    it('finds the applications’ organisation by its exact id, with its registration count (AC03, AC09)', () => {
      expect(organisation).toEqual({
        id: submitted.organisation.id,
        organisation: submitted.organisation,
        registrationCount: expect.any(Number),
        updatedAt: expect.any(String)
      })
      expect(organisation.registrationCount).toBeGreaterThanOrEqual(1)
    })

    it('finds it by its exact or part number and part name, in any case (AC03 to AC06)', async () => {
      const { name, number } = organisation.organisation
      for (const params of [
        { q: String(number), searchFields: 'organisationNumber' },
        { q: String(number).slice(1, -1), searchFields: 'organisationNumber' },
        { q: name.slice(1, -1).toUpperCase() },
        { q: name.toLowerCase(), searchFields: 'organisationName' }
      ]) {
        const response = await search('organisations', {
          ...params,
          limit: 100
        })
        expect(ids(response)).toContain(organisation.id)
      }
    })

    it('matches its nation and has-a-registration filters with the search (AC07, AC08)', async () => {
      const filtered = (filters) =>
        search('organisations', {
          q: organisation.id,
          searchFields: 'id',
          ...filters
        })

      expect(
        ids(await filtered({ hasRegistration: true, nation: submitted.nation }))
      ).toEqual([organisation.id])
      expect(ids(await filtered({ hasRegistration: [true, false] }))).toEqual([
        organisation.id
      ])
      expect((await filtered({ hasRegistration: false })).body.totalItems).toBe(
        0
      )
    })
  })

  describe('overseas reprocessing sites', () => {
    let registrationNumber
    let sites

    before(async () => {
      // Opening a year's application for the Glass exporter seeds its
      // registration's overseas sites from the ReEx stub.
      const exporterYear = disposableYear()
      await OperatorPage.open()
      await OperatorPage.navigateToExporterAccreditationGlass()
      await openApplicationForYear(exporterYear)
      const application = await search('accreditation-applications', {
        year: exporterYear
      })
      expect(application.body.totalItems).toBe(1)
      registrationNumber = application.body.items[0].registrationNumber

      const response = await search('overseas-sites', {
        q: registrationNumber,
        searchFields: 'registrationNumber',
        limit: 100
      })
      expect(response.status).toBe(200)
      sites = response.body.items.filter(
        (site) =>
          site.registrationId === application.body.items[0].registrationId
      )
      expect(sites.length).toBeGreaterThan(0)
    })

    it('finds a registration’s sites by its number, each with its ORS id, name, country, status and organisation (AC03, AC09)', () => {
      for (const site of sites) {
        expect(site).toEqual({
          id: expect.stringMatching(/^[0-9a-f]{24}$/),
          orsId: site.orsId,
          siteName: site.siteName,
          country: site.country,
          status: expect.stringMatching(/^(Proposed|Active|Discarded)$/),
          registrationId: site.registrationId,
          registrationNumber,
          organisation: {
            id: expect.stringMatching(/^[0-9a-f]{24}$/),
            name: expect.any(String),
            number: 50006
          },
          updatedAt: expect.any(String)
        })
      }
    })

    it('finds a site by its exact id, its ORS id, and its organisation name in any case (AC03, AC05, AC06)', async () => {
      const [site] = sites
      const byId = await search('overseas-sites', {
        q: site.id,
        searchFields: 'id'
      })
      expect(byId.body.items).toEqual([site])

      for (const params of [
        { q: site.orsId.toLowerCase(), searchFields: 'orsId' },
        { q: site.organisation.name.slice(1, -1).toUpperCase() }
      ]) {
        const response = await search('overseas-sites', {
          ...params,
          country: site.country,
          limit: 100
        })
        expect(ids(response)).toContain(site.id)
      }
    })

    it('offers each country a current site holds, and filters by country and status with the search (AC07, AC08)', async () => {
      const [site] = sites
      const countries = await getOverseasSiteCountries()
      expect(countries.status).toBe(200)
      expect(countries.body.items).toContain(site.country)
      expect(countries.body.items).toEqual([...countries.body.items].sort())

      const filtered = (filters) =>
        search('overseas-sites', {
          q: registrationNumber,
          searchFields: 'registrationNumber',
          limit: 100,
          ...filters
        })

      const sameCountry = await filtered({
        country: site.country,
        status: site.status
      })
      expect(ids(sameCountry)).toContain(site.id)
      expect(
        sameCountry.body.items.every(
          (each) => each.country === site.country && each.status === site.status
        )
      ).toBe(true)

      const noCountry = await filtered({ country: noSuchText() })
      expect(noCountry.status).toBe(200)
      expect(noCountry.body.totalItems).toBe(0)
    })
  })

  describe('accreditations', () => {
    const approvedYear = disposableYear()
    let accreditation

    before(async () => {
      await OperatorPage.open()
      await OperatorPage.navigateToReaccreditationPlastic()
      const { organisationId, applicationId } =
        await submitApplicationForYear(approvedYear)
      // Case management's approval: the accreditation number first, then
      // the status push, which creates the accreditation.
      await issueAccreditationNumber(organisationId, applicationId)
      await pushStatusChanged(organisationId, applicationId, {
        toStateId: 'approved',
        toStateDisplayName: 'Approved',
        actionId: 'approve',
        actionDisplayName: 'Approve',
        occurredAt: new Date().toISOString()
      })

      const response = await search('accreditations', { year: approvedYear })
      expect(response.status).toBe(200)
      expect(response.body.totalItems).toBe(1)
      accreditation = response.body.items[0]
    })

    it('lists the accreditation an approval creates, with its number, status, year, tonnage band, registration and organisation (AC07, AC09)', () => {
      expect(accreditation).toEqual({
        id: expect.stringMatching(/^[0-9a-f]{24}$/),
        accreditationNumber: expect.any(String),
        status: 'Approved',
        year: Number(approvedYear),
        tonnageBand: expect.stringMatching(
          /^(up_to_500|up_to_5000|up_to_10000|over_10000)$/
        ),
        registrationId: submitted.registrationId,
        registrationNumber: submitted.registrationNumber,
        material: 'Plastic',
        organisation: submitted.organisation,
        updatedAt: expect.any(String)
      })
    })

    it('finds it by its exact id and number, part of its number, and its organisation in any case (AC03 to AC06)', async () => {
      const number = accreditation.accreditationNumber
      for (const params of [
        { q: accreditation.id, searchFields: 'id' },
        { q: number },
        {
          q: number.slice(1, -1).toLowerCase(),
          searchFields: 'accreditationNumber'
        },
        {
          q: accreditation.registrationNumber,
          searchFields: 'registrationNumber'
        },
        { q: String(accreditation.organisation.number).slice(1) },
        { q: accreditation.organisation.name.toUpperCase() }
      ]) {
        const response = await search('accreditations', {
          ...params,
          year: approvedYear
        })
        expect(response.body.items).toEqual([accreditation])
      }
    })

    it('matches its status and tonnage band filters with the search (AC07, AC08)', async () => {
      const filtered = (filters) =>
        search('accreditations', {
          q: accreditation.accreditationNumber,
          year: approvedYear,
          ...filters
        })

      expect(
        ids(
          await filtered({
            status: ['Approved', 'Suspended'],
            tonnageBand: accreditation.tonnageBand
          })
        )
      ).toEqual([accreditation.id])
      expect((await filtered({ status: 'Cancelled' })).body.totalItems).toBe(0)
    })
  })

  describe('a search with no matches', () => {
    it('answers an empty first page with a total of 0, for every record type (AC12)', async () => {
      for (const type of OPERATOR_JOURNEY_RECORD_TYPES) {
        const response = await search(type, { q: noSuchText() })
        expect(response.status).toBe(200)
        expect(response.body).toEqual({
          pageNumber: 1,
          limit: 50,
          totalItems: 0,
          items: []
        })
      }
    })
  })

  describe('a search it cannot run', () => {
    const invalidFilter = {
      accreditations: ['status', 'Submitted', 'invalid_status'],
      'accreditation-applications': ['nation', 'Atlantis', 'invalid_nation'],
      registrations: ['material', 'Gold', 'invalid_material'],
      organisations: ['hasRegistration', 'maybe', 'invalid_has_registration'],
      'overseas-sites': ['status', 'Approved', 'invalid_status']
    }

    for (const type of OPERATOR_JOURNEY_RECORD_TYPES) {
      it(`answers 400 for a limit over 100, a filter value ${type} does not have, or a parameter it does not take`, async () => {
        expectProblem(await search(type, { limit: 101 }), 400, 'invalid_limit')
        expectProblem(await search(type, { limit: 0 }), 400, 'invalid_limit')
        expectProblem(
          await search(type, { pageNumber: 0 }),
          400,
          'invalid_page_number'
        )

        const [filter, value, code] = invalidFilter[type]
        expectProblem(await search(type, { [filter]: value }), 400, code)

        expectProblem(
          await search(type, { q: 'x', searchFields: 'siteName' }),
          400,
          'invalid_search_fields'
        )
        expectProblem(
          await search(type, { tonnage: 'up_to_500' }),
          400,
          'unknown_parameter'
        )
      })
    }

    it('answers 400 unknown_parameter for a filter of another record type', async () => {
      expectProblem(
        await search('accreditations', { nation: 'England' }),
        400,
        'unknown_parameter'
      )
    })
  })

  describe('a caller that is not the admin service client', () => {
    for (const type of OPERATOR_JOURNEY_RECORD_TYPES) {
      it(`is refused ${type}: 401 unsigned, 403 forbidden for another known client`, async () => {
        expectProblem(
          await searchOperatorJourney(type, {}, { client: null }),
          401,
          'missing_header'
        )
        expectProblem(
          await searchOperatorJourney(
            type,
            {},
            { client: nonAdminApiClient() }
          ),
          403,
          'forbidden'
        )
      })
    }

    it('is refused the overseas site countries too', async () => {
      expectProblem(
        await getOverseasSiteCountries({ client: nonAdminApiClient() }),
        403,
        'forbidden'
      )
    })
  })
})
