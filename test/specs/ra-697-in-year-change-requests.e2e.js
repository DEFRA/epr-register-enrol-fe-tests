import { browser, expect } from '@wdio/globals'
import LoginPage from 'page-objects/login.page'
import OperatorPage from 'page-objects/operator.page'
import ManageRegistrationAccreditationPage from 'page-objects/manage-registration-accreditation.page'
import ChangeRequestsPage from 'page-objects/change-requests.page'
import ChangeRequestDetailPage from 'page-objects/change-request-detail.page'
import ManageOverseasSitesPage from 'page-objects/manage-overseas-sites.page'
import {
  DOCKER_ONLY_TAG,
  skipDockerOnlyOnDeployedEnvironment
} from '../helpers/docker-only.js'
import { readSeededYear } from '../helpers/seeded-year.js'
import { waitForUrl } from '../helpers/wait-for-url.js'
import {
  ORGANISATION_NAME,
  MATERIAL,
  MANAGE_PATH,
  REEX_REGISTRATION_PATH,
  INTERIM,
  CHANGE_ITEMS,
  REPROCESSOR_CHANGE_ITEMS,
  REPROCESSOR_CAPTION_MATERIAL,
  REPROCESSOR_MANAGE_PATH,
  reprocessorAccreditationNumber,
  reprocessorRegistrationNumber
} from '../fixtures/manage-exporter-org.js'
import {
  ORGANISATION_NAME as EMPTY_ORGANISATION_NAME,
  MATERIAL as EMPTY_MATERIAL,
  MANAGE_PATH as EMPTY_MANAGE_PATH,
  accreditationNumber as emptyAccreditationNumber
} from '../fixtures/no-change-requests-org.js'
import {
  ORGANISATION_NAME as REGISTRATION_ONLY_ORGANISATION_NAME,
  MATERIAL as REGISTRATION_ONLY_MATERIAL,
  MANAGE_PATH as REGISTRATION_ONLY_MANAGE_PATH,
  CHANGE_ITEMS as REGISTRATION_ONLY_CHANGE_ITEMS,
  REGISTERED_ORS as REGISTRATION_ONLY_ORS,
  PORTO_INTERIM_SITES,
  registrationNumber as registrationOnlyRegistrationNumber
} from '../fixtures/registration-only-org.js'

/**
 * RA-697: an operator views the in-year change requests on its current
 * accreditation - the dashboard's "In year change requests" section on
 * "Manage registration and accreditation", the list behind it at
 * {manage page}/change-requests (sorted most urgent first, 10 a page,
 * filtered by status and type) and each item's read-only detail page. The
 * operator test page stands in for Re/Ex's material page as the way in.
 *
 * Runs against the backend's dev seed only (DevExporterAccreditationSeedService
 * and DevChangeRequestSeedService, on in this stack via
 * DevSeedData__ManageExporterEnabled and FeatureFlags__InYearChangesEnabled,
 * with IN_YEAR_CHANGES_ENABLED on the frontend), for the calendar year the
 * stack started in:
 *   - org 50018's Plastic exporter (test/fixtures/manage-exporter-org.js,
 *     shared read-only with RA-425): 14 items over 12 requests, in all 8
 *     statuses and all 3 types, so the list runs to two pages, including
 *     one registration-only ORS update (no accreditation) on Dragon;
 *   - org 50018's Glass reprocessor: 3 tonnage band upgrades;
 *   - org 50020 (test/fixtures/no-change-requests-org.js): an exporter with
 *     no change requests, for the empty states;
 *   - org 50021 (test/fixtures/registration-only-org.js): an exporter with an
 *     Approved registration and no accreditation, whose dashboard shows the
 *     registration only, and five registration-only ORS updates, each with
 *     its read-only detail page.
 * Nothing here writes, and every check is scoped to the seeded item ids (the
 * rows' test ids end with them): mongo is not reset between runs, so a
 * failure here that names an unknown id means something wrote to these orgs.
 *
 * Not covered here: filters kept across pages. No seeded status or type has
 * more than 10 items, so a filtered list never paginates; the frontend's
 * route tests cover the pagination links keeping the filters.
 * Docker-only because deployed environments have no such seed.
 */

const LIST_PATH = `${MANAGE_PATH}/change-requests`
const REPROCESSOR_LIST_PATH = `${REPROCESSOR_MANAGE_PATH}/change-requests`
const EMPTY_LIST_PATH = `${EMPTY_MANAGE_PATH}/change-requests`
const REGISTRATION_ONLY_LIST_PATH = `${REGISTRATION_ONLY_MANAGE_PATH}/change-requests`

const urlEndingWith = (path) =>
  expect.stringMatching(new RegExp(`${path.replaceAll('/', '\\/')}(\\?.*)?$`))

const ids = (items, year) => items.map((item) => item.itemId(year))

// The exporter's items as the list orders them: most urgent status first,
// then most recently submitted (the In progress draft by last updated).
const {
  rotterdamUpdateQueried,
  dragonNewInProgress,
  bharatUpdateSubmitted,
  berlinUpdateUpdated,
  tonnageDulyMade,
  tonnageGranted,
  rotterdamUpdateGranted,
  bharatUpdateGranted,
  dragonUpdateRefusedRegistrationOnly,
  tonnageRefused,
  berlinUpdateRefused,
  dragonNewRefused,
  rotterdamUpdateWithdrawn,
  dragonNewWithdrawn
} = CHANGE_ITEMS
const FIRST_PAGE = [
  rotterdamUpdateQueried,
  dragonNewInProgress,
  bharatUpdateSubmitted,
  berlinUpdateUpdated,
  tonnageDulyMade,
  tonnageGranted,
  rotterdamUpdateGranted,
  bharatUpdateGranted,
  dragonUpdateRefusedRegistrationOnly,
  tonnageRefused
]
const SECOND_PAGE = [
  berlinUpdateRefused,
  dragonNewRefused,
  rotterdamUpdateWithdrawn,
  dragonNewWithdrawn
]

// Org 50021 has one item in each status.
const registrationOnlyItem = (status) =>
  REGISTRATION_ONLY_CHANGE_ITEMS.find((item) => item.status === status)
const registrationOnlyPortoSubmitted = registrationOnlyItem('SUBMITTED')
const registrationOnlyJakartaGranted = registrationOnlyItem('GRANTED')

// The query string a filter change or pagination link should land on, in
// the order the page writes it, and then the page fully loaded.
async function waitForListQuery(path, search) {
  let last
  await waitForUrl((url) => {
    last = url
    const { pathname, search: actual } = new URL(url)
    return pathname === path && actual === search
  }, `Did not reach ${path}${search}`).catch((error) => {
    throw new Error(`${error.message} (last at ${last})`)
  })
  await browser.waitUntil(
    async () =>
      (await browser.execute(() => document.readyState)) === 'complete',
    { timeoutMsg: `${path}${search} did not finish loading` }
  )
}

async function expectRows(items, year) {
  expect(await ChangeRequestsPage.rowItemIds()).toEqual(ids(items, year))
  for (const item of items) {
    await expect(ChangeRequestsPage.status(item.itemId(year))).toHaveText(
      item.status
    )
    await expect(ChangeRequestsPage.type(item.itemId(year))).toHaveText(
      item.type
    )
  }
}

async function expectSelectedFilters(status, type) {
  expect(
    await ChangeRequestsPage.selectedFilterText(ChangeRequestsPage.statusFilter)
  ).toBe(status)
  expect(
    await ChangeRequestsPage.selectedFilterText(ChangeRequestsPage.typeFilter)
  ).toBe(type)
}

async function expectRequestDetails(item, year, { submitted = true } = {}) {
  const detail = ChangeRequestDetailPage
  await expect(detail.requestType).toHaveText(item.type)
  if (submitted) {
    await expect(detail.requestSent).toHaveText(item.sent(year))
    await expect(detail.requestSubmittedBy).toHaveText('Sam Patel')
    await expect(detail.requestReference).toHaveText(item.reference(year))
  } else {
    await expect(detail.requestSent).toHaveText('Not submitted')
    await expect(detail.requestSubmittedBy).toHaveText('Not submitted')
    await expect(detail.requestReference).toHaveText('Not applicable')
  }
  await expect(detail.requestValidFrom).toHaveText(
    item.validFrom?.(year) ?? 'Not applicable'
  )
  await expect(detail.requestValidTo).toHaveText(
    item.validTo?.(year) ?? 'Not applicable'
  )
  // Read-only: nothing on the page changes the request.
  await expect(detail.actions).toBeElementsArrayOfSize(0)
}

describe(`RA-697: view in-year change requests ${DOCKER_ONLY_TAG}`, () => {
  before(function () {
    skipDockerOnlyOnDeployedEnvironment(this)
  })

  // Set by the first beforeEach, from the exporter's manage page caption; the
  // seed gives the reprocessor and org 50020 the same year.
  let year

  beforeEach(async () => {
    await browser.deleteCookies()
    await LoginPage.open()
    await browser.execute(() => {
      // eslint-disable-next-line no-undef
      localStorage.clear()
      // eslint-disable-next-line no-undef
      sessionStorage.clear()
    })
    await LoginPage.openOperatorLogin()
    await LoginPage.loginAsOperator()
    if (!year) {
      year = await readSeededYear({
        managePath: MANAGE_PATH,
        organisationName: ORGANISATION_NAME,
        material: MATERIAL
      })
    }
  })

  afterEach(async () => {
    await LoginPage.signOut()
  })

  describe('Plastic exporter dashboard', () => {
    it('shows each type once, at its most urgent active status, and links each to the filtered list', async () => {
      await OperatorPage.open()
      await OperatorPage.navigateToManageExporter()

      const managePage = ManageRegistrationAccreditationPage
      await expect(managePage.changeRequestsHeading).toHaveText(
        'In year change requests'
      )
      expect(await managePage.changeRequestsSummaryTypes()).toEqual([
        'add-overseas-site',
        'update-overseas-site',
        'upgrade-tonnage-band'
      ])
      await expect(
        managePage.changeRequestsSummaryStatus('add-overseas-site')
      ).toHaveText('IN PROGRESS')
      await expect(
        managePage.changeRequestsSummaryStatus('update-overseas-site')
      ).toHaveText('QUERIED')
      await expect(
        managePage.changeRequestsSummaryStatus('upgrade-tonnage-band')
      ).toHaveText('DULY MADE')
      for (const type of ['add-overseas-site', 'upgrade-tonnage-band']) {
        await expect(
          managePage.changeRequestsSummaryViewLink(type)
        ).toHaveAttribute('href', `${LIST_PATH}?type=${type}`)
      }

      await managePage.clickAndWaitForNextPage(
        managePage.changeRequestsSummaryViewLink('update-overseas-site')
      )

      await waitForListQuery(LIST_PATH, '?type=update-overseas-site')
      await expectSelectedFilters('Select status', 'ORS update')
      // Every ORS update, final ones too, and the registration-only one.
      await expectRows(
        [
          rotterdamUpdateQueried,
          bharatUpdateSubmitted,
          berlinUpdateUpdated,
          rotterdamUpdateGranted,
          bharatUpdateGranted,
          dragonUpdateRefusedRegistrationOnly,
          berlinUpdateRefused,
          rotterdamUpdateWithdrawn
        ],
        year
      )
      await expect(ChangeRequestsPage.countLine).toHaveText('Showing 1-8 of 8')
      await expect(ChangeRequestsPage.pagination).not.toBeExisting()
    })
  })

  describe('Plastic exporter list', () => {
    it('orders the items by status, then most recent, 10 a page', async () => {
      await ChangeRequestsPage.open(LIST_PATH)

      await expect(ChangeRequestsPage.pageHeading).toHaveText(
        'In year change requests'
      )
      await expect(ChangeRequestsPage.pageCaption).toHaveText(
        `${ORGANISATION_NAME} (${year}, ${MATERIAL})`
      )
      await expectSelectedFilters('Select status', 'Select type')
      await expect(ChangeRequestsPage.countLine).toHaveText(
        'Showing 1-10 of 14'
      )
      await expectRows(FIRST_PAGE, year)
      await expect(ChangeRequestsPage.currentPageNumber).toHaveText('1')
      await expect(ChangeRequestsPage.previousPageLink).not.toBeExisting()

      // An ORS row names its site and address; a tonnage row has no site.
      const queriedId = rotterdamUpdateQueried.itemId(year)
      await expect(ChangeRequestsPage.siteName(queriedId)).toHaveText(
        'Rotterdam Recycling BV'
      )
      await expect(ChangeRequestsPage.siteAddress(queriedId)).toHaveText(
        'Industrieweg 44, Netherlands'
      )
      // A registration-only row finds its site by ORS id, as its site id is
      // the ORS id's integer value, not the accreditation's.
      await expect(
        ChangeRequestsPage.siteAddress(
          dragonUpdateRefusedRegistrationOnly.itemId(year)
        )
      ).toHaveText('8 Harbour Avenue, Vietnam')
      await expect(
        ChangeRequestsPage.siteName(tonnageDulyMade.itemId(year))
      ).toHaveText('Not applicable')
      await expect(ChangeRequestsPage.viewLink(queriedId)).toHaveAttribute(
        'href',
        urlEndingWith(`${LIST_PATH}/${queriedId}`)
      )
      await expect(ChangeRequestsPage.backLink).toHaveAttribute(
        'href',
        urlEndingWith(MANAGE_PATH)
      )
      // Re/Ex isn't in this stack, so check where the link goes without following it.
      await expect(ChangeRequestsPage.returnToHomeLink).toHaveAttribute(
        'href',
        urlEndingWith(REEX_REGISTRATION_PATH)
      )

      await ChangeRequestsPage.clickAndWaitForNextPage(
        ChangeRequestsPage.nextPageLink
      )

      await waitForListQuery(LIST_PATH, '?page=2')
      await expect(ChangeRequestsPage.countLine).toHaveText(
        'Showing 11-14 of 14'
      )
      await expectRows(SECOND_PAGE, year)
      await expect(ChangeRequestsPage.currentPageNumber).toHaveText('2')
      await expect(ChangeRequestsPage.nextPageLink).not.toBeExisting()

      await ChangeRequestsPage.clickAndWaitForNextPage(
        ChangeRequestsPage.previousPageLink
      )

      await waitForListQuery(LIST_PATH, '?page=1')
      await expectRows(FIRST_PAGE, year)
    })

    it('filters by status, then by status and type together, then by type', async () => {
      await ChangeRequestsPage.open(LIST_PATH)

      // The form has no Apply button: choosing an option submits it.
      await ChangeRequestsPage.statusFilter.selectByVisibleText('Granted')

      await waitForListQuery(LIST_PATH, '?status=Approved')
      await expectSelectedFilters('Granted', 'Select type')
      await expectRows(
        [tonnageGranted, rotterdamUpdateGranted, bharatUpdateGranted],
        year
      )
      await expect(ChangeRequestsPage.countLine).toHaveText('Showing 1-3 of 3')
      await expect(ChangeRequestsPage.pagination).not.toBeExisting()

      await ChangeRequestsPage.typeFilter.selectByVisibleText('ORS update')

      await waitForListQuery(
        LIST_PATH,
        '?status=Approved&type=update-overseas-site'
      )
      await expectSelectedFilters('Granted', 'ORS update')
      await expectRows([rotterdamUpdateGranted, bharatUpdateGranted], year)
      await expect(ChangeRequestsPage.countLine).toHaveText('Showing 1-2 of 2')

      // Back to the placeholder drops the status from the query.
      await ChangeRequestsPage.statusFilter.selectByVisibleText('Select status')

      await waitForListQuery(LIST_PATH, '?type=update-overseas-site')
      await ChangeRequestsPage.typeFilter.selectByVisibleText(
        'Tonnage band upgrade'
      )

      await waitForListQuery(LIST_PATH, '?type=upgrade-tonnage-band')
      await expectSelectedFilters('Select status', 'Tonnage band upgrade')
      await expectRows([tonnageDulyMade, tonnageGranted, tonnageRefused], year)
      await expect(ChangeRequestsPage.countLine).toHaveText('Showing 1-3 of 3')
    })

    it('starts a filtered list on its first page', async () => {
      await ChangeRequestsPage.open(`${LIST_PATH}?page=2`)
      await expectRows(SECOND_PAGE, year)

      await ChangeRequestsPage.statusFilter.selectByVisibleText('Withdrawn')

      await waitForListQuery(LIST_PATH, '?status=Withdrawn')
      await expectRows([rotterdamUpdateWithdrawn, dragonNewWithdrawn], year)
      await expect(ChangeRequestsPage.countLine).toHaveText('Showing 1-2 of 2')
    })

    it('clears the filters back to the whole list', async () => {
      await ChangeRequestsPage.open(
        `${LIST_PATH}?status=Approved&type=update-overseas-site`
      )
      await expectRows([rotterdamUpdateGranted, bharatUpdateGranted], year)

      await ChangeRequestsPage.clickAndWaitForNextPage(
        ChangeRequestsPage.clearFiltersLink
      )

      await waitForListQuery(LIST_PATH, '')
      await expectSelectedFilters('Select status', 'Select type')
      await expect(ChangeRequestsPage.countLine).toHaveText(
        'Showing 1-10 of 14'
      )
      await expectRows(FIRST_PAGE, year)
    })

    it('says so when no item matches the filters', async () => {
      await ChangeRequestsPage.open(LIST_PATH)
      await ChangeRequestsPage.statusFilter.selectByVisibleText('Queried')
      await waitForListQuery(LIST_PATH, '?status=Queried')
      await expectRows([rotterdamUpdateQueried], year)

      await ChangeRequestsPage.typeFilter.selectByVisibleText(
        'Tonnage band upgrade'
      )

      await waitForListQuery(
        LIST_PATH,
        '?status=Queried&type=upgrade-tonnage-band'
      )
      await expectSelectedFilters('Queried', 'Tonnage band upgrade')
      await expect(ChangeRequestsPage.noResultsTitle).toHaveText(
        'There are no matching results'
      )
      await expect(ChangeRequestsPage.noResultsBody).toHaveText(
        'Improve your search results by removing one or more of your selected filters.'
      )
      await expect(ChangeRequestsPage.table).not.toBeExisting()
      await expect(ChangeRequestsPage.countLine).not.toBeExisting()
      await expect(ChangeRequestsPage.pagination).not.toBeExisting()
      await expect(ChangeRequestsPage.clearFiltersLink).toBeDisplayed()
    })
  })

  describe('Plastic exporter detail pages', () => {
    it('shows a queried ORS update, opened from the list, read-only', async () => {
      const item = rotterdamUpdateQueried
      const itemId = item.itemId(year)
      await ChangeRequestsPage.open(LIST_PATH)

      await ChangeRequestsPage.clickAndWaitForNextPage(
        ChangeRequestsPage.viewLink(itemId)
      )

      expect(new URL(await browser.getUrl()).pathname).toBe(
        `${LIST_PATH}/${itemId}`
      )
      const detail = ChangeRequestDetailPage
      await expect(detail.pageCaption).toHaveText(
        `${ORGANISATION_NAME} (${year}, ${MATERIAL})`
      )
      await expect(detail.pageHeading).toHaveText(
        `Rotterdam Recycling BV (${item.orsId})`
      )
      await expect(detail.queryRaisedBanner).toHaveText(
        expect.stringContaining('A query has been raised on this request')
      )

      await expect(detail.headerLocation).toHaveText(
        'Industrieweg 44, Netherlands'
      )
      await expect(detail.headerSiteId).toHaveText(item.orsId)
      await expect(detail.statusTag).toHaveText('QUERIED')
      // The date the request was started.
      await expect(detail.headerDateAdded).toHaveText(item.sent(year))
      await expect(detail.headerBesExpiry).toHaveText('Not applicable')

      await expect(detail.rowValue('site-name')).toHaveText(
        'Rotterdam Recycling BV'
      )
      await expect(detail.rowValue('location')).toHaveText(
        'Industrieweg 44, Netherlands'
      )
      await expect(detail.rowValue('recycling-operation')).toHaveText('R3')
      await expect(detail.rowValue('bes-evidence')).toHaveText('Not provided')
      // Coordinates aren't on the design's site details.
      await expect(detail.rowValue('coordinates')).not.toBeExisting()

      // Only the ORS's current interim sites: Old Depot was removed.
      await expect(detail.interimSitesHeading).toHaveText('Interim sites (2)')
      await expect(detail.interimSiteRows).toBeElementsArrayOfSize(2)
      await expect(detail.interimSite(INTERIM.calais)).toHaveText(
        'Calais Storage SARL, France, R13'
      )
      await expect(detail.interimSite(INTERIM.antwerpForRotterdam)).toHaveText(
        'Antwerp Transfer Hub, Belgium, R3, R13'
      )
      await expect(detail.interimSite(INTERIM.oldDepot)).not.toBeExisting()

      await expectRequestDetails(item, year)
      await expect(detail.backLink).toHaveAttribute(
        'href',
        urlEndingWith(LIST_PATH)
      )
    })

    it("shows a granted ORS update's validity to the end of the year", async () => {
      const item = rotterdamUpdateGranted
      await ChangeRequestDetailPage.open(`${LIST_PATH}/${item.itemId(year)}`)

      const detail = ChangeRequestDetailPage
      await expect(detail.pageHeading).toHaveText(
        `Rotterdam Recycling BV (${item.orsId})`
      )
      await expect(detail.statusTag).toHaveText('GRANTED')
      await expect(detail.queryRaisedBanner).not.toBeExisting()
      await expectRequestDetails(item, year)
    })

    it("shows a withdrawn ORS update's validity to its withdrawal", async () => {
      const item = rotterdamUpdateWithdrawn
      await ChangeRequestDetailPage.open(`${LIST_PATH}/${item.itemId(year)}`)

      await expect(ChangeRequestDetailPage.statusTag).toHaveText('WITHDRAWN')
      await expectRequestDetails(item, year)
    })

    it('shows the draft New ORS accreditation as not yet submitted', async () => {
      const item = dragonNewInProgress
      await ChangeRequestDetailPage.open(`${LIST_PATH}/${item.itemId(year)}`)

      const detail = ChangeRequestDetailPage
      await expect(detail.pageHeading).toHaveText(
        `Dragon Recyclers (${item.orsId})`
      )
      await expect(detail.headerSiteId).toHaveText(item.orsId)
      await expect(detail.headerLocation).toHaveText(
        '8 Harbour Avenue, Vietnam'
      )
      await expect(detail.statusTag).toHaveText('IN PROGRESS')
      await expectRequestDetails(item, year, { submitted: false })
    })

    // RA-697 task 014: a registration-only request on an accredited exporter.
    it('shows the registration-only ORS update on Dragon, opened from the list', async () => {
      const item = dragonUpdateRefusedRegistrationOnly
      const itemId = item.itemId(year)
      await ChangeRequestsPage.open(LIST_PATH)

      await ChangeRequestsPage.clickAndWaitForNextPage(
        ChangeRequestsPage.viewLink(itemId)
      )

      expect(new URL(await browser.getUrl()).pathname).toBe(
        `${LIST_PATH}/${itemId}`
      )
      const detail = ChangeRequestDetailPage
      await expect(detail.pageCaption).toHaveText(
        `${ORGANISATION_NAME} (${year}, ${MATERIAL})`
      )
      await expect(detail.pageHeading).toHaveText(
        `Dragon Recyclers (${item.orsId})`
      )
      await expect(detail.headerSiteId).toHaveText(item.orsId)
      await expect(detail.headerLocation).toHaveText(
        '8 Harbour Avenue, Vietnam'
      )
      await expect(detail.statusTag).toHaveText('REFUSED')
      await expectRequestDetails(item, year)
    })

    it('shows a duly made tonnage band upgrade, opened from the list, read-only', async () => {
      const item = tonnageDulyMade
      await ChangeRequestsPage.open(`${LIST_PATH}?type=upgrade-tonnage-band`)

      await ChangeRequestsPage.clickAndWaitForNextPage(
        ChangeRequestsPage.viewLink(item.itemId(year))
      )

      const detail = ChangeRequestDetailPage
      await expect(detail.pageHeading).toHaveText('Tonnage band upgrade')
      await expect(detail.statusTag).toHaveText('DULY MADE')
      await expect(detail.requestedBandLabel).toHaveText('Tonnage band')
      await expect(detail.requestedBand).toHaveText(item.band)
      // No site: no site header, site details or interim sites.
      await expect(detail.headerSiteId).not.toBeExisting()
      await expect(detail.siteSummary).not.toBeExisting()
      await expect(detail.interimSitesHeading).not.toBeExisting()
      await expect(detail.queryRaisedBanner).not.toBeExisting()
      await expectRequestDetails(item, year)
      await expect(detail.backLink).toHaveAttribute(
        'href',
        urlEndingWith(LIST_PATH)
      )
    })

    it("shows a granted tonnage band upgrade's band and validity", async () => {
      const item = tonnageGranted
      await ChangeRequestDetailPage.open(`${LIST_PATH}/${item.itemId(year)}`)

      await expect(ChangeRequestDetailPage.statusTag).toHaveText('GRANTED')
      await expect(ChangeRequestDetailPage.requestedBand).toHaveText(item.band)
      await expectRequestDetails(item, year)
    })
  })

  describe('Glass reprocessor', () => {
    const {
      tonnageSubmitted,
      tonnageGranted: granted,
      tonnageRefused: refused
    } = REPROCESSOR_CHANGE_ITEMS

    it('opens from the operator page, with its active tonnage band upgrade on the dashboard', async () => {
      await OperatorPage.open()
      await OperatorPage.navigateToManageReprocessor()

      await expect(browser).toHaveUrl(urlEndingWith(REPROCESSOR_MANAGE_PATH))
      const managePage = ManageRegistrationAccreditationPage
      await expect(managePage.pageCaption).toHaveText(
        `${ORGANISATION_NAME} (${year}, ${REPROCESSOR_CAPTION_MATERIAL})`
      )
      await expect(managePage.applicationStatusTag).toHaveText('GRANTED')
      await expect(managePage.accreditationNumber).toHaveText(
        reprocessorAccreditationNumber(year)
      )
      await expect(managePage.registrationNumber).toHaveText(
        reprocessorRegistrationNumber(year)
      )
      // A reprocessor has no overseas sites to manage.
      await expect(managePage.manageOverseasSitesCard).not.toBeExisting()

      expect(await managePage.changeRequestsSummaryTypes()).toEqual([
        'upgrade-tonnage-band'
      ])
      await expect(
        managePage.changeRequestsSummaryStatus('upgrade-tonnage-band')
      ).toHaveText('SUBMITTED')
    })

    it('lists only tonnage band upgrades, and opens one read-only', async () => {
      await ChangeRequestsPage.open(REPROCESSOR_LIST_PATH)

      await expect(ChangeRequestsPage.pageHeading).toHaveText(
        'In year change requests'
      )
      await expectRows([tonnageSubmitted, granted, refused], year)
      await expect(ChangeRequestsPage.countLine).toHaveText('Showing 1-3 of 3')
      await expect(ChangeRequestsPage.pagination).not.toBeExisting()
      await expect(
        ChangeRequestsPage.siteName(tonnageSubmitted.itemId(year))
      ).toHaveText('Not applicable')
      await expect(ChangeRequestsPage.backLink).toHaveAttribute(
        'href',
        urlEndingWith(REPROCESSOR_MANAGE_PATH)
      )

      await ChangeRequestsPage.clickAndWaitForNextPage(
        ChangeRequestsPage.viewLink(tonnageSubmitted.itemId(year))
      )

      const detail = ChangeRequestDetailPage
      expect(new URL(await browser.getUrl()).pathname).toBe(
        `${REPROCESSOR_LIST_PATH}/${tonnageSubmitted.itemId(year)}`
      )
      await expect(detail.pageHeading).toHaveText('Tonnage band upgrade')
      await expect(detail.statusTag).toHaveText('SUBMITTED')
      await expect(detail.requestedBandLabel).toHaveText('Tonnage band')
      await expect(detail.requestedBand).toHaveText(tonnageSubmitted.band)
      await expect(detail.queryRaisedBanner).not.toBeExisting()
      await expectRequestDetails(tonnageSubmitted, year)
      await expect(detail.backLink).toHaveAttribute(
        'href',
        urlEndingWith(REPROCESSOR_LIST_PATH)
      )
    })
  })

  describe('Exporter with no change requests', () => {
    it('opens from the operator page, with no active change requests on the dashboard', async () => {
      await OperatorPage.open()
      await OperatorPage.navigateToNoChangeRequestsOrg()

      await expect(browser).toHaveUrl(urlEndingWith(EMPTY_MANAGE_PATH))
      const managePage = ManageRegistrationAccreditationPage
      await expect(managePage.pageCaption).toHaveText(
        `${EMPTY_ORGANISATION_NAME} (${year}, ${EMPTY_MATERIAL})`
      )
      await expect(managePage.applicationStatusTag).toHaveText('GRANTED')
      await expect(managePage.accreditationNumber).toHaveText(
        emptyAccreditationNumber(year)
      )
      await expect(managePage.manageOverseasSitesCard).toBeDisplayed()

      await expect(managePage.changeRequestsHeading).toHaveText(
        'In year change requests'
      )
      await expect(managePage.changeRequestsSummaryTable).not.toBeExisting()
      await expect(managePage.noActiveChangeRequests).toHaveText(
        'You currently have no active change requests. View change requests.'
      )

      await managePage.clickAndWaitForNextPage(
        managePage.viewChangeRequestsLink
      )

      await waitForListQuery(EMPTY_LIST_PATH, '')
      await expect(ChangeRequestsPage.pageHeading).toHaveText(
        'In year change requests'
      )
      await expect(ChangeRequestsPage.noResultsTitle).toHaveText(
        'There are no matching results'
      )
      await expect(ChangeRequestsPage.noResultsBody).toHaveText(
        'Improve your search results by removing one or more of your selected filters.'
      )
      await expect(ChangeRequestsPage.table).not.toBeExisting()
      await expect(ChangeRequestsPage.countLine).not.toBeExisting()
      await expect(ChangeRequestsPage.pagination).not.toBeExisting()
      await expect(ChangeRequestsPage.backLink).toHaveAttribute(
        'href',
        urlEndingWith(EMPTY_MANAGE_PATH)
      )
    })
  })

  // RA-697 tasks 010 to 015: org 50021 has an Approved registration and no
  // accreditation, so each page shows the registration only. Its seeded
  // requests make some overseas sites Pending, which isn't asserted on.
  describe('Registration-only exporter', () => {
    it('follows its path from the operator page: dashboard, overseas sites, the change requests list and an ORS update with its interim sites', async () => {
      await OperatorPage.open()
      await OperatorPage.navigateToRegistrationOnlyOrg()

      // Dashboard: the registration, and no accreditation.
      await expect(browser).toHaveUrl(
        urlEndingWith(REGISTRATION_ONLY_MANAGE_PATH)
      )
      const managePage = ManageRegistrationAccreditationPage
      await expect(managePage.pageCaption).toHaveText(
        `${REGISTRATION_ONLY_ORGANISATION_NAME} (${year}, ${REGISTRATION_ONLY_MATERIAL})`
      )
      await expect(managePage.registrationStatusTag).toHaveText('GRANTED')
      await expect(managePage.registrationNumber).toHaveText(
        registrationOnlyRegistrationNumber(year)
      )
      await expect(managePage.applicationStatusTag).not.toBeExisting()
      await expect(managePage.accreditationNumber).not.toBeExisting()
      await expect(managePage.expiryDate).not.toBeExisting()
      await expect(managePage.manageAccreditationCard).not.toBeExisting()
      await expect(managePage.manageOverseasSitesCard).toBeDisplayed()

      // Its change requests section: ORS updates, the only type it can have.
      await expect(managePage.changeRequestsHeading).toHaveText(
        'In year change requests'
      )
      expect(await managePage.changeRequestsSummaryTypes()).toEqual([
        'update-overseas-site'
      ])
      await expect(
        managePage.changeRequestsSummaryStatus('update-overseas-site')
      ).toHaveText('QUERIED')

      // Overseas sites: none accredited, all four registered, and no
      // accreditation to add one to.
      await managePage.openManageOverseasSites()

      await expect(browser).toHaveUrl(
        urlEndingWith(`${REGISTRATION_ONLY_MANAGE_PATH}/overseas-sites`)
      )
      const sitesPage = ManageOverseasSitesPage
      await expect(sitesPage.pageHeading).toHaveText(
        'Manage overseas reprocessing sites'
      )
      await expect(sitesPage.pageCaption).toHaveText(
        `${REGISTRATION_ONLY_ORGANISATION_NAME} (${year}, ${REGISTRATION_ONLY_MATERIAL})`
      )
      await expect(sitesPage.tab('accredited')).toHaveText('Accredited (0)')
      await expect(sitesPage.panel('accredited')).toBeDisplayed()
      await expect(sitesPage.emptyMessage('accredited')).toBeDisplayed()

      await expect(sitesPage.tab('registered')).toHaveText(
        `Registered (${REGISTRATION_ONLY_ORS.length})`
      )
      await sitesPage.openTab('registered')
      for (const site of REGISTRATION_ONLY_ORS) {
        await expect(sitesPage.siteOrsId('registered', site.siteId)).toHaveText(
          site.orsId
        )
        await expect(sitesPage.siteName('registered', site.siteId)).toHaveText(
          site.name
        )
        await expect(
          sitesPage.siteAddress('registered', site.siteId)
        ).toHaveText(site.address)
        await expect(sitesPage.viewRequestLink(site.siteId)).not.toBeExisting()
      }
      await expect(sitesPage.anyAddToAccreditationButton).not.toBeExisting()
      await expect(sitesPage.requestsBanner).not.toBeExisting()

      await sitesPage.goBack()

      // The section's ORS update link opens the list filtered to that type.
      await expect(browser).toHaveUrl(
        urlEndingWith(REGISTRATION_ONLY_MANAGE_PATH)
      )
      await managePage.clickAndWaitForNextPage(
        managePage.changeRequestsSummaryViewLink('update-overseas-site')
      )

      await waitForListQuery(
        REGISTRATION_ONLY_LIST_PATH,
        '?type=update-overseas-site'
      )
      await expectSelectedFilters('Select status', 'ORS update')
      await expectRows(REGISTRATION_ONLY_CHANGE_ITEMS, year)

      // The whole list: one type to filter by, and the status filter.
      await ChangeRequestsPage.clickAndWaitForNextPage(
        ChangeRequestsPage.clearFiltersLink
      )

      await waitForListQuery(REGISTRATION_ONLY_LIST_PATH, '')
      await expect(ChangeRequestsPage.pageCaption).toHaveText(
        `${REGISTRATION_ONLY_ORGANISATION_NAME} (${year}, ${REGISTRATION_ONLY_MATERIAL})`
      )
      expect(
        await ChangeRequestsPage.filterOptionTexts(
          ChangeRequestsPage.typeFilter
        )
      ).toEqual(['Select type', 'ORS update'])
      await expectRows(REGISTRATION_ONLY_CHANGE_ITEMS, year)
      await expect(ChangeRequestsPage.countLine).toHaveText('Showing 1-5 of 5')
      await expect(ChangeRequestsPage.pagination).not.toBeExisting()
      for (const item of REGISTRATION_ONLY_CHANGE_ITEMS) {
        await expect(ChangeRequestsPage.siteName(item.itemId(year))).toHaveText(
          item.siteName
        )
        await expect(
          ChangeRequestsPage.siteAddress(item.itemId(year))
        ).toHaveText(item.siteAddress)
      }
      await expect(ChangeRequestsPage.backLink).toHaveAttribute(
        'href',
        urlEndingWith(REGISTRATION_ONLY_MANAGE_PATH)
      )

      await ChangeRequestsPage.statusFilter.selectByVisibleText('Submitted')

      await waitForListQuery(REGISTRATION_ONLY_LIST_PATH, '?status=Submitted')
      await expectSelectedFilters('Submitted', 'Select type')
      await expectRows([registrationOnlyPortoSubmitted], year)
      await expect(ChangeRequestsPage.countLine).toHaveText('Showing 1-1 of 1')

      // An ORS update: the registration's ORS, with its interim sites, and
      // dates in the current year.
      const item = registrationOnlyPortoSubmitted
      const itemId = item.itemId(year)
      await ChangeRequestsPage.clickAndWaitForNextPage(
        ChangeRequestsPage.viewLink(itemId)
      )

      expect(new URL(await browser.getUrl()).pathname).toBe(
        `${REGISTRATION_ONLY_LIST_PATH}/${itemId}`
      )
      const detail = ChangeRequestDetailPage
      await expect(detail.pageCaption).toHaveText(
        `${REGISTRATION_ONLY_ORGANISATION_NAME} (${year}, ${REGISTRATION_ONLY_MATERIAL})`
      )
      await expect(detail.pageHeading).toHaveText(
        `${item.siteName} (${item.orsId})`
      )

      await expect(detail.headerLocation).toHaveText(item.siteAddress)
      await expect(detail.headerSiteId).toHaveText(item.orsId)
      await expect(detail.statusTag).toHaveText('SUBMITTED')
      await expect(detail.headerDateAdded).toHaveText(item.sent(year))
      await expect(detail.headerBesExpiry).toHaveText('Not applicable')

      await expect(detail.rowValue('site-name')).toHaveText(item.siteName)
      await expect(detail.rowValue('location')).toHaveText(item.siteAddress)
      await expect(detail.rowValue('contact-name')).toHaveText('Site Manager')
      await expect(detail.rowValue('recycling-operation')).toHaveText('R3')

      await expect(detail.interimSitesHeading).toHaveText(
        `Interim sites (${PORTO_INTERIM_SITES.length})`
      )
      await expect(detail.interimSiteRows).toBeElementsArrayOfSize(
        PORTO_INTERIM_SITES.length
      )
      for (const interimSite of PORTO_INTERIM_SITES) {
        await expect(detail.interimSite(interimSite.siteId)).toHaveText(
          interimSite.line
        )
      }

      await expectRequestDetails(item, year)
      await expect(detail.backLink).toHaveAttribute(
        'href',
        urlEndingWith(REGISTRATION_ONLY_LIST_PATH)
      )
    })

    it("shows a granted ORS update's validity to the end of the current year", async () => {
      const item = registrationOnlyJakartaGranted
      await ChangeRequestDetailPage.open(
        `${REGISTRATION_ONLY_LIST_PATH}/${item.itemId(year)}`
      )

      const detail = ChangeRequestDetailPage
      await expect(detail.pageHeading).toHaveText(
        `${item.siteName} (${item.orsId})`
      )
      await expect(detail.statusTag).toHaveText('GRANTED')
      await expect(detail.interimSitesHeading).toHaveText('Interim sites')
      await expect(detail.noInterimSites).toHaveText(
        'No interim sites have been added.'
      )
      await expectRequestDetails(item, year)
    })
  })
})
