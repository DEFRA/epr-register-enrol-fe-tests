import { browser, expect } from '@wdio/globals'
import LoginPage from 'page-objects/login.page'
import OperatorPage from 'page-objects/operator.page'
import ManageRegistrationAccreditationPage from 'page-objects/manage-registration-accreditation.page'
import {
  DOCKER_ONLY_TAG,
  skipDockerOnlyOnDeployedEnvironment
} from '../helpers/docker-only.js'
import { readSeededYear } from '../helpers/seeded-year.js'
import {
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
 *   - org 50018's Glass reprocessor (test/fixtures/manage-exporter-org.js),
 *     whose seeded change requests are tonnage band upgrades only;
 *   - org 50020 (test/fixtures/no-change-requests-org.js), an exporter with
 *     no change requests, for the empty states.
 * Both accreditations are seeded by DevExporterAccreditationSeedService
 * (DevSeedData__ManageExporterEnabled in docker/config) for the calendar year
 * the stack started in, and their change requests by DevChangeRequestSeedService
 * (with FeatureFlags__InYearChangesEnabled). Read-only: nothing here writes.
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
})
