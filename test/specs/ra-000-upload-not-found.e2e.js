import { browser, expect } from '@wdio/globals'
import LoginPage from 'page-objects/login.page'
import OperatorPage from 'page-objects/operator.page'
import TaskListPage from 'page-objects/tasklist.page'
import SamplingPlanPage from 'page-objects/sampling-plan.page'
import OverseasReprocessingSitesPage from 'page-objects/overseas-reprocessing-sites.page'
import ConfirmOverseasSitesPage from 'page-objects/confirm-overseas-sites.page'
import BesEvidencePage from 'page-objects/bes-evidence.page'
import UploadNotFoundPage from 'page-objects/upload-not-found.page'
import {
  completePrnBusinessPlanSamplingPlan,
  startDisposableGlassExporterApplication
} from '../helpers/accreditation-journey.js'
import { completeOverseasSites } from '../helpers/case-management.js'
import { expirePendingUploadOf } from '../helpers/sandbox-mongo.js'
import { skipDockerOnlyOnDeployedEnvironment } from '../helpers/docker-only.js'

// RA-000: the backend now answers 404 from an upload's status route once it has
// no record of the upload (the pending-upload record expired, or the id was
// never issued there), where it used to answer "pending" for ever, and the
// operator's status page polled it for ever. This proves the whole chain end to
// end, which the backend's and frontend's unit tests each only cover half of: a
// real upload whose record goes missing lands the operator on the "could not
// find your file upload" page, that page stops polling (no meta refresh, and a
// reload shows it again rather than resuming), its link goes back to the
// journey's upload page, and the upload never reaches the application.
//
// The record is made to go missing by deleting the backend's pendingUploads
// document for the upload as soon as the upload creates it, which is what the
// collection's TTL index does when a record expires (see
// helpers/sandbox-mongo.js). That needs the compose sandbox's MongoDB, hence
// @docker-only.
//
// Same org (50006, Glass exporter) and run-unique disposable year as
// ra-605-max-files.e2e.js, so it does not race the other exporter specs; the
// helper only deletes the record this upload creates, under this application's
// own S3 path.
describe('RA-000: upload status page for an expired or unknown upload @docker-only', () => {
  before(function () {
    skipDockerOnlyOnDeployedEnvironment(this)
  })

  const HEADING = 'We could not find your file upload'
  const MESSAGE =
    'Your upload may have expired or not finished, so your file has not been saved.'
  const UPLOAD_AGAIN = 'Upload your file again'

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

  const currentPath = async () => new URL(await browser.getUrl()).pathname

  // Asserts the operator is on the upload-not-found page at the status route,
  // and that it is not polling: no meta refresh, and a reload shows it again.
  async function expectUploadNotFoundAt(statusPath) {
    // The upload POST redirects to the status route; wait for its render.
    await UploadNotFoundPage.pageHeading.waitForDisplayed({ timeout: 30000 })
    expect(await currentPath()).toBe(statusPath)
    await expect(UploadNotFoundPage.pageHeading).toHaveText(HEADING)
    await expect(UploadNotFoundPage.message).toHaveText(MESSAGE)
    await expect(UploadNotFoundPage.uploadAgainLink).toHaveText(UPLOAD_AGAIN)
    await expect(UploadNotFoundPage.metaRefresh).not.toExist()

    await browser.refresh()
    await expect(UploadNotFoundPage.pageHeading).toHaveText(HEADING)
    await expect(UploadNotFoundPage.metaRefresh).not.toExist()
  }

  it('sampling plan: shows upload-not-found without polling, and links back to the upload page', async () => {
    const { applicationId } = await startDisposableGlassExporterApplication()

    // The sampling plan task is locked until the PRN tonnage and business plan
    // tasks are done. This also uploads one file the normal way, through
    // checking to ready, which the expired upload below must not add to.
    await completePrnBusinessPlanSamplingPlan({ material: 'Glass' })

    const uploadPath = `/accreditation/sampling-plan/${applicationId}`
    await browser.url(uploadPath)
    await expirePendingUploadOf(
      `accreditation/sampling-plan/${applicationId}`,
      () => SamplingPlanPage.attemptUpload('business-plan.pdf')
    )

    await expectUploadNotFoundAt(`${uploadPath}/status`)

    await UploadNotFoundPage.clickReliably(UploadNotFoundPage.uploadAgainLink)
    await browser.waitUntil(async () => (await currentPath()) === uploadPath, {
      timeout: 10000,
      timeoutMsg: `Upload again link did not lead to ${uploadPath}`
    })
    await expect(SamplingPlanPage.pageHeading).toHaveText(
      expect.stringContaining('Upload sampling and inspection plan')
    )

    // The expired upload was never added: only the earlier file is listed.
    await browser.url(`${uploadPath}/results`)
    await expect(SamplingPlanPage.fileRows).toBeElementsArrayOfSize(1)
  })

  it('BES evidence: shows upload-not-found without polling, and links back to the upload page', async () => {
    const { organisationId, applicationId } =
      await startDisposableGlassExporterApplication()

    await completePrnBusinessPlanSamplingPlan({ material: 'Glass' })

    await TaskListPage.overseasSitesLink.click()
    await completeOverseasSites(organisationId, applicationId)
    await OverseasReprocessingSitesPage.continue()
    await ConfirmOverseasSitesPage.confirmAndContinue()

    await TaskListPage.besLink.click()
    await BesEvidencePage.pendingUploadLink.click()
    await BesEvidencePage.fileInput.waitForExist()

    // /accreditation/upload-bes-evidence/{applicationId}/{siteId}
    const uploadPath = await currentPath()
    const siteId = uploadPath.split('/').filter(Boolean)[3]
    await expirePendingUploadOf(
      `accreditation/bes-evidence/${applicationId}/${siteId}`,
      () => BesEvidencePage.attemptUpload('business-plan.pdf')
    )

    await expectUploadNotFoundAt(`${uploadPath}/status`)

    await UploadNotFoundPage.clickReliably(UploadNotFoundPage.uploadAgainLink)
    await browser.waitUntil(async () => (await currentPath()) === uploadPath, {
      timeout: 10000,
      timeoutMsg: `Upload again link did not lead to ${uploadPath}`
    })
    await expect(BesEvidencePage.fileInput).toExist()
  })
})
