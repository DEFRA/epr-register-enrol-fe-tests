import { browser, expect } from '@wdio/globals'
import LoginPage from 'page-objects/login.page'
import OperatorPage from 'page-objects/operator.page'
import OperatorAccreditationPage from 'page-objects/operator-accreditation.page'
import SamplingPlanPage from 'page-objects/sampling-plan.page'
import { completePrnBusinessPlanSamplingPlan } from '../helpers/accreditation-journey.js'
import { skipDockerOnlyOnDeployedEnvironment } from '../helpers/docker-only.js'

// RA-605: an 11th sampling plan / supporting evidence upload used to fail with the
// generic "problem uploading your file" message. It must now be refused with a message
// naming the limit, and the ten files already uploaded must be left untouched.
//
// Same org (50006, Glass exporter) and run-unique disposable year as
// ra-619-non-latin1-filename.e2e.js, so it does not race the other exporter specs.
describe('RA-605: file-count limit on sampling plan uploads @docker-only', () => {
  before(function () {
    skipDockerOnlyOnDeployedEnvironment(this)
  })

  const MAX_FILES = 10
  const TASK_LIST_PATH = '/accreditation/task-list/'
  const MAX_FILES_MESSAGE =
    'The maximum number of files permitted to be uploaded is ten'

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
    await OperatorPage.navigateToExporterAccreditationGlass()
    const [, organisationId, registrationId, materialType] = new URL(
      await browser.getUrl()
    ).pathname
      .split('/')
      .filter(Boolean)
    const year = String(3000 + (Date.now() % 1000))
    await browser.url(
      `/operator-accreditation/${organisationId}/${registrationId}/${materialType}/${year}`
    )
    await OperatorAccreditationPage.clickContinue()
    await browser.waitUntil(
      async () => (await browser.getUrl()).includes(TASK_LIST_PATH),
      { timeout: 10000, timeoutMsg: 'Did not reach task list' }
    )

    const applicationId = (await browser.getUrl())
      .split(TASK_LIST_PATH)[1]
      .split('?')[0]

    // The sampling plan task is locked until the PRN tonnage and business plan
    // tasks are done; this also uploads (and saves) the first file.
    await completePrnBusinessPlanSamplingPlan({ material: 'Glass' })

    const uploadPageUrl = `/accreditation/sampling-plan/${applicationId}`
    await browser.url(uploadPageUrl)
    for (let i = 1; i < MAX_FILES; i++) {
      // Alternate the document type: the limit covers both combined.
      await SamplingPlanPage.uploadFile(
        'business-plan.pdf',
        i % 2 === 0 ? 'SamplingPlan' : 'SupportingEvidence'
      )
      await SamplingPlanPage.uploadAnotherFileLink.click()
    }
    await browser.url(`${uploadPageUrl}/results`)
    await expect(SamplingPlanPage.fileRows).toBeElementsArrayOfSize(MAX_FILES)

    await SamplingPlanPage.uploadAnotherFileLink.click()
    await SamplingPlanPage.attemptUpload('business-plan.pdf')

    await expect($('[data-testid="file-error"]')).toHaveText(
      expect.stringContaining(MAX_FILES_MESSAGE)
    )

    await browser.url(`${uploadPageUrl}/results`)
    await expect(SamplingPlanPage.fileRows).toBeElementsArrayOfSize(MAX_FILES)
  })
})
