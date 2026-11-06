import { browser, expect } from '@wdio/globals'
import LoginPage from 'page-objects/login.page'
import OperatorPage from 'page-objects/operator.page'
import ManageRegistrationAccreditationPage from 'page-objects/manage-registration-accreditation.page'
import ChangeRequestsPage from 'page-objects/change-requests.page'
import {
  DOCKER_ONLY_TAG,
  skipDockerOnlyOnDeployedEnvironment
} from '../helpers/docker-only.js'
import { readSeededYear } from '../helpers/seeded-year.js'
import {
  MANAGE_PATH as EXPORTER_MANAGE_PATH,
  ORGANISATION_NAME as MANAGE_ORGANISATION_NAME,
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

/**
 * RA-697: the orgs the backend's dev seed adds for the in-year change request
 * pages, reached from the operator test page as Re/Ex would link to them:
 *   - org 50018's Plastic exporter (test/fixtures/manage-exporter-org.js),
 *     whose seeded change requests run to more than one page;
 *   - org 50018's Glass reprocessor, whose seeded change requests are
 *     tonnage band upgrades only;
 *   - org 50020 (test/fixtures/no-change-requests-org.js), an exporter with
 *     no change requests, for the empty states.
 * Both accreditations are seeded by DevExporterAccreditationSeedService
 * (DevSeedData__ManageExporterEnabled in docker/config) for the calendar year
 * the stack started in, and their change requests by DevChangeRequestSeedService
 * (with FeatureFlags__InYearChangesEnabled). Read-only: nothing here writes.
 * The In year change requests list is opened by URL here; the dashboard's
 * link to it comes later in RA-697.
 * Docker-only because deployed environments have no such seed.
 */

const urlEndingWith = (path) =>
  expect.stringMatching(new RegExp(`${path.replaceAll('/', '\\/')}(\\?.*)?$`))

describe(`RA-697: seeded orgs for the in-year change request pages ${DOCKER_ONLY_TAG}`, () => {
  before(function () {
    skipDockerOnlyOnDeployedEnvironment(this)
  })

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
  })

  afterEach(async () => {
    await LoginPage.signOut()
  })

  it("opens the manage test org's Glass reprocessor from the operator page", async () => {
    const year = await readSeededYear({
      managePath: REPROCESSOR_MANAGE_PATH,
      organisationName: MANAGE_ORGANISATION_NAME,
      material: REPROCESSOR_CAPTION_MATERIAL
    })

    await OperatorPage.open()
    await OperatorPage.navigateToManageReprocessor()

    await expect(browser).toHaveUrl(urlEndingWith(REPROCESSOR_MANAGE_PATH))
    const managePage = ManageRegistrationAccreditationPage
    await expect(managePage.pageCaption).toHaveText(
      `${MANAGE_ORGANISATION_NAME} (${year}, ${REPROCESSOR_CAPTION_MATERIAL})`
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
  })

  it('opens the exporter with no change requests from the operator page', async () => {
    const year = await readSeededYear({
      managePath: EMPTY_MANAGE_PATH,
      organisationName: EMPTY_ORGANISATION_NAME,
      material: EMPTY_MATERIAL
    })

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
  })

  it("lists the Glass reprocessor's tonnage band upgrades, most urgent first", async () => {
    await ChangeRequestsPage.open(`${REPROCESSOR_MANAGE_PATH}/change-requests`)

    await expect(ChangeRequestsPage.pageHeading).toHaveText(
      'In year change requests'
    )
    expect(await ChangeRequestsPage.statusTexts()).toEqual([
      'SUBMITTED',
      'GRANTED',
      'REFUSED'
    ])
    expect(await ChangeRequestsPage.typeTexts()).toEqual([
      'Tonnage band upgrade',
      'Tonnage band upgrade',
      'Tonnage band upgrade'
    ])
    await expect(ChangeRequestsPage.backLink).toHaveAttribute(
      'href',
      urlEndingWith(REPROCESSOR_MANAGE_PATH)
    )
  })

  it("pages the Plastic exporter's change requests 10 at a time", async () => {
    await ChangeRequestsPage.open(`${EXPORTER_MANAGE_PATH}/change-requests`)

    const firstCount = await ChangeRequestsPage.countLine.getText()
    const [, total] = firstCount.match(/^Showing 1-10 of (\d+)$/) ?? []
    expect(Number(total)).toBeGreaterThan(10)
    expect(await ChangeRequestsPage.statusTexts()).toHaveLength(10)

    await ChangeRequestsPage.nextPageLink.click()

    await expect(browser).toHaveUrl(expect.stringContaining('?page=2'))
    const secondPageRows = Math.min(Number(total) - 10, 10)
    await expect(ChangeRequestsPage.countLine).toHaveText(
      `Showing 11-${10 + secondPageRows} of ${total}`
    )
    expect(await ChangeRequestsPage.statusTexts()).toHaveLength(secondPageRows)
  })

  it("filters the Plastic exporter's change requests by status and type", async () => {
    await ChangeRequestsPage.open(`${EXPORTER_MANAGE_PATH}/change-requests`)

    // The form has no Apply button: choosing an option submits it.
    await ChangeRequestsPage.statusFilter.selectByVisibleText('Granted')

    await expect(browser).toHaveUrl(expect.stringContaining('?status=Approved'))
    expect(await ChangeRequestsPage.statusTexts()).toEqual([
      'GRANTED',
      'GRANTED',
      'GRANTED'
    ])
    await expect(ChangeRequestsPage.countLine).toHaveText('Showing 1-3 of 3')

    await ChangeRequestsPage.typeFilter.selectByVisibleText('ORS update')

    await expect(browser).toHaveUrl(
      expect.stringContaining('?status=Approved&type=update-overseas-site')
    )
    expect(await ChangeRequestsPage.typeTexts()).toEqual([
      'ORS update',
      'ORS update'
    ])

    await ChangeRequestsPage.clearFiltersLink.click()

    await expect(browser).toHaveUrl(
      urlEndingWith(`${EXPORTER_MANAGE_PATH}/change-requests`)
    )
    await expect(ChangeRequestsPage.countLine).toHaveText(
      /^Showing 1-10 of \d+$/
    )
  })

  it('shows the no-results message for the exporter with no change requests', async () => {
    await ChangeRequestsPage.open(`${EMPTY_MANAGE_PATH}/change-requests`)

    await expect(ChangeRequestsPage.noResultsTitle).toHaveText(
      'There are no matching results'
    )
    await expect(ChangeRequestsPage.noResultsBody).toHaveText(
      'Improve your search results by removing one or more of your selected filters.'
    )
    await expect(ChangeRequestsPage.clearFiltersLink).toBeDisplayed()
    await expect(ChangeRequestsPage.table).not.toBeExisting()
    await expect(ChangeRequestsPage.countLine).not.toBeExisting()
    await expect(ChangeRequestsPage.pagination).not.toBeExisting()
  })
})
