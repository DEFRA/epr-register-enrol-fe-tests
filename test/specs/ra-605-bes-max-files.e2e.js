import { browser, expect } from '@wdio/globals'
import LoginPage from 'page-objects/login.page'
import OperatorPage from 'page-objects/operator.page'
import TaskListPage from 'page-objects/tasklist.page'
import OverseasReprocessingSitesPage from 'page-objects/overseas-reprocessing-sites.page'
import ConfirmOverseasSitesPage from 'page-objects/confirm-overseas-sites.page'
import BesEvidencePage from 'page-objects/bes-evidence.page'
import {
  completePrnBusinessPlanSamplingPlan,
  startDisposableGlassExporterApplication
} from '../helpers/accreditation-journey.js'
import { completeOverseasSites } from '../helpers/case-management.js'
import { skipDockerOnlyOnDeployedEnvironment } from '../helpers/docker-only.js'

// RA-605: BES evidence is capped at 10 files per overseas site. An 11th upload must be
// refused with a message naming the limit, and the ten already uploaded must be kept.
//
// Same org (50006, Glass exporter) and run-unique disposable year as
// ra-605-max-files.e2e.js, so it does not race the other exporter specs.
describe('RA-605: file-count limit on BES evidence uploads @docker-only', () => {
  before(function () {
    skipDockerOnlyOnDeployedEnvironment(this)
  })

  const MAX_FILES = 10
  const MAX_FILES_MESSAGE =
    'You can only upload a maximum of 10 files as evidence of broadly equivalent standards.'

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
    await OperatorPage.open()
  })

  afterEach(async () => {
    await LoginPage.signOut()
  })

  it('refuses an 11th file with the limit message and keeps the ten already uploaded', async () => {
    const { organisationId, applicationId } =
      await startDisposableGlassExporterApplication()

    await completePrnBusinessPlanSamplingPlan({ material: 'Glass' })

    await TaskListPage.overseasSitesLink.click()
    await completeOverseasSites(organisationId, applicationId)
    await OverseasReprocessingSitesPage.continue()
    await ConfirmOverseasSitesPage.confirmAndContinue()

    await TaskListPage.besLink.click()
    await BesEvidencePage.pendingUploadLink.click()

    for (let i = 0; i < MAX_FILES; i++) {
      await BesEvidencePage.uploadFile('business-plan.pdf')
      await BesEvidencePage.selectYes()
    }

    await BesEvidencePage.attemptUpload('business-plan.pdf')

    await expect(BesEvidencePage.fileError).toHaveText(
      expect.stringContaining(MAX_FILES_MESSAGE)
    )

    // Nothing was added: the review screen still lists exactly ten files.
    const siteId = new URL(await browser.getUrl()).pathname
      .split('/')
      .filter(Boolean)[3]
    await browser.url(
      `/accreditation/cya-evidence-for-overseas-site/${applicationId}/${siteId}`
    )
    expect((await BesEvidencePage.fileRowIds()).length).toBe(MAX_FILES)
  })
})
