import { browser, expect } from '@wdio/globals'
import LoginPage from 'page-objects/login.page'
import OperatorPage from 'page-objects/operator.page'
import OperatorAccreditationPage from 'page-objects/operator-accreditation.page'
import TaskListPage from 'page-objects/tasklist.page'
import PrnTonnagePage from 'page-objects/prn-tonnage.page'
import PrnAuthorityPage from 'page-objects/prn-authority.page'
import PrnCheckAnswersPage from 'page-objects/prn-check-answers.page'
import BusinessPlanPage from 'page-objects/business-plan.page'
import BusinessPlanDetailPage from 'page-objects/business-plan-detail.page'
import BusinessPlanCheckAnswersPage from 'page-objects/business-plan-check-answers.page'
import SamplingPlanPage from 'page-objects/sampling-plan.page'

describe('RA-436: S&I plan upload page vs the browser back button', () => {
  beforeEach(async () => {
    await browser.deleteCookies()
    await LoginPage.open()
    await browser.execute(() => {
      // eslint-disable-next-line no-undef
      localStorage.clear()
      // eslint-disable-next-line no-undef
      sessionStorage.clear()
    })
    await LoginPage.switchToOperator()
    await LoginPage.loginAsOperator()
    await OperatorPage.open()
  })

  afterEach(async () => {
    await LoginPage.signOut()
  })

  // Drives a fresh reaccreditation application only as far as the S&I plan
  // upload step - the rest of the wizard is irrelevant to this bug.
  //
  // Org 50003 (Delta Green Ltd, Plastic) is shared with status-push.e2e.js
  // and owned at its fixed/default year by query-resubmit.e2e.js, which
  // drives that year's application to Submitted within the same CI run.
  // Reusing the default year here would land on that already-submitted
  // application, whose Continue link no longer leads to the task list. A
  // fresh, run-unique year makes the landing controller's seed-on-miss path
  // create a brand new disposable draft instead (same reasoning as
  // status-push.e2e.js and withdraw-application.e2e.js).
  async function reachSamplingPlanUpload() {
    await OperatorPage.navigateToReaccreditationPlastic()
    const landing = await browser.getUrl()
    const [, organisationId, registrationId, materialType] = new URL(
      landing
    ).pathname
      .split('/')
      .filter(Boolean)
    const year = String(3000 + (Date.now() % 1000))
    await browser.url(
      `/operator-accreditation/${organisationId}/${registrationId}/${materialType}/${year}`
    )

    await OperatorAccreditationPage.clickContinue()
    await browser.waitUntil(
      async () =>
        (await browser.getUrl()).includes('/accreditation/task-list/'),
      { timeout: 10000, timeoutMsg: 'Did not reach task list' }
    )

    if (await TaskListPage.PRNTonnageLink.isExisting()) {
      await TaskListPage.PRNTonnageLink.click()
      await PrnTonnagePage.selectRandomOption()
      await PrnTonnagePage.saveAndContinue()
      await PrnAuthorityPage.addAuthoriser()
      await PrnAuthorityPage.saveAndContinue()
      await PrnCheckAnswersPage.confirmAndContinue()
    }

    if (await TaskListPage.businessPlanLink.isExisting()) {
      await TaskListPage.businessPlanLink.click()
      await browser.waitUntil(
        async () =>
          (await browser.getUrl()).includes('/accreditation/business-plan'),
        { timeout: 10000 }
      )
      await BusinessPlanPage.fillPercentages([20, 20, 20, 15, 15, 10])
      await BusinessPlanPage.saveAndContinue()
      // Stub may go straight to CYA if percentages were already saved
      if (
        (await $('h1').getText()) === 'Check your answers before continuing'
      ) {
        await $('a.govuk-back-link').click()
      }
      await BusinessPlanDetailPage.fillDescriptions()
      await BusinessPlanDetailPage.saveAndContinue()
      await BusinessPlanCheckAnswersPage.confirmAndContinue()
    }

    await TaskListPage.SIPlanLink.click()
    await expect(SamplingPlanPage.pageHeading).toHaveText(
      expect.stringContaining('Upload sampling and inspection plan')
    )
  }

  it('clears the chosen file on back navigation so it cannot be resubmitted as a duplicate', async () => {
    await reachSamplingPlanUpload()

    await SamplingPlanPage.uploadFile('business-plan.pdf')
    await expect(SamplingPlanPage.fileRows).toBeElementsArrayOfSize(1)

    // Reproduces the bug report: repeatedly pressing browser back (not the
    // app's own "upload another file" link) from the post-upload page —
    // through however many intermediate status-page history entries the
    // CDP-upload redirect chain produced (RA-290 AC04 made upload / checking
    // / results three separate pages) — eventually lands back on the
    // upload form itself.
    await browser.waitUntil(
      async () => {
        await browser.back()
        const heading = await SamplingPlanPage.pageHeading.getText()
        return heading.includes('Upload sampling and inspection plan')
      },
      {
        timeout: 10000,
        interval: 500,
        timeoutMsg: 'Never landed back on the upload form'
      }
    )

    // RA-436: browsers can silently reassert a previously chosen file into
    // the input across this kind of navigation (bfcache restore, or a
    // separate session-history form-state restore Cache-Control: no-store
    // doesn't prevent), so clicking "Upload file" here with no further
    // action used to silently resubmit it as a second row for the same
    // file. The fix gates submission on a fresh 'change' event having fired
    // since the page was last shown, regardless of what the input's value
    // claims — so clicking upload with nothing (re-)selected must be
    // rejected, not silently resubmit the previous file.
    await SamplingPlanPage.uploadFileButton.click()
    await expect($('[data-testid="file-error"]')).toBeDisplayed()

    // Confirm no duplicate ever landed: exactly the one file uploaded
    // before the back navigation is on the results page.
    await $('[data-testid="view-uploaded-files-link"]').click()
    await expect(SamplingPlanPage.fileRows).toBeElementsArrayOfSize(1)
  })
})
