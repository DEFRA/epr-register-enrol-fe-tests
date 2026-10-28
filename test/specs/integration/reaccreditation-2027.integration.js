import { browser, expect } from '@wdio/globals'
import OperatorAccreditationPage from 'page-objects/operator-accreditation.page'
import TaskListPage from 'page-objects/tasklist.page'
import SubmitApplicationPage from 'page-objects/submit-application.page'
import ApplicationSubmittedPage from 'page-objects/application-submitted.page'
import {
  completeOutstandingTasks,
  findApplicableMaterial,
  signInToReex
} from '../../helpers/reex-reaccreditation.js'
import { accreditationYear } from '../../config.js'

// Integration journey against a deployed environment (dev by default), not
// this repo's docker-compose sandbox. It starts where a real operator does —
// the Re-Ex frontend's start page — signs in through GOV.UK One Login, picks a
// material off the organisation home page, and follows the hand-off link into
// epr-register-enrol-frontend to reapply for accreditation and submit.
//
// Run with `npm run test:integration`; it is excluded from every other wdio
// config, all of which point at localhost.
//
// Note it changes real state: a passing run leaves one more material SUBMITTED
// for `accreditationYear` on the target environment, and a material cannot be
// reused until that application is withdrawn or the seed data is refreshed.
// findApplicableMaterial() picks a fresh one each run and fails with the list
// of what it rejected once none are left.
describe(`Re-Ex reaccreditation ${accreditationYear} - integration`, () => {
  beforeEach(async () => {
    await signInToReex()
  })

  it('Should reapply for reprocessor accreditation and submit the application', async () => {
    const { row, applicationId } = await findApplicableMaterial({
      isExporter: false
    })

    await expect(OperatorAccreditationPage.pageHeading).toHaveText(
      'Reapply for accreditation'
    )
    await expect(OperatorAccreditationPage.applicationPeriod).toHaveText(
      accreditationYear
    )
    // The reprocessor landing page names the UK site the accreditation is for.
    await expect(
      OperatorAccreditationPage.applicationHeaderOperatorName
    ).toHaveText(expect.stringContaining(row.site))

    await OperatorAccreditationPage.clickContinue()
    await expect(browser).toHaveUrl(
      expect.stringContaining(`/accreditation/task-list/${applicationId}`)
    )

    const material = await completeOutstandingTasks({ isExporter: false })

    await TaskListPage.assertAllTasksCompleted({ isExporter: false })
    await TaskListPage.continueToSubmit()

    await submitAndAssertConfirmation(material)
  })

  it('Should reapply for exporter accreditation and submit the application', async () => {
    const { row, applicationId } = await findApplicableMaterial({
      isExporter: true
    })

    await expect(OperatorAccreditationPage.pageHeading).toHaveText(
      'Reapply for accreditation'
    )
    await expect(OperatorAccreditationPage.applicationPeriod).toHaveText(
      accreditationYear
    )
    // Exporters have no UK site, so the home-page grid never groups them under
    // one — the distinguishing feature of the exporter journey is the two
    // extra tasks asserted below.
    expect(row.site).toBeNull()

    await OperatorAccreditationPage.clickContinue()
    await expect(browser).toHaveUrl(
      expect.stringContaining(`/accreditation/task-list/${applicationId}`)
    )

    await expect(TaskListPage.overseasSitesStatus).toBeDisplayed()
    await expect(TaskListPage.besStatus).toBeDisplayed()

    const material = await completeOutstandingTasks({ isExporter: true })

    await expect(TaskListPage.PRNTagStatus).toHaveText('COMPLETED')
    await expect(TaskListPage.businessPlanStatus).toHaveText('COMPLETED')
    await expect(TaskListPage.SIPlanStatus).toHaveText('COMPLETED')
    await expect(TaskListPage.overseasSitesStatus).toHaveText('COMPLETED')
    await expect(TaskListPage.besStatus).toHaveText('COMPLETED')

    await TaskListPage.continueToSubmit()

    await submitAndAssertConfirmation(material)
  })
})

async function submitAndAssertConfirmation(material) {
  await expect(browser).toHaveUrl(
    expect.stringContaining('/accreditation/submit-declaration/')
  )
  await expect(SubmitApplicationPage.pageHeading).toHaveText('Declaration')
  await SubmitApplicationPage.submitApplication()

  // A rejected submission re-renders on the declaration URL, either with a
  // validation summary or as the generic "Sorry, there is a problem with the
  // service" page, so a bare URL assertion would only report "still on
  // submit-declaration". Wait for the page to change, then say what it shows.
  await browser.waitUntil(
    async () =>
      (await SubmitApplicationPage.pageHeading.getText()) !== 'Declaration' ||
      (await $('.govuk-error-summary').isExisting()),
    { timeout: 60000, timeoutMsg: 'Submitting the declaration did nothing' }
  )
  const url = await browser.getUrl()
  if (!url.includes('/accreditation/submit-confirmation/')) {
    const heading = await SubmitApplicationPage.pageHeading.getText()
    const body = await $('main').getText()
    throw new Error(
      `Submission was rejected at ${new Date().toISOString()} (${url}):\n` +
        `${heading}\n${body}`
    )
  }
  await expect(ApplicationSubmittedPage.panelTitle).toHaveText(
    'Now pay the application charge'
  )
  await expect(ApplicationSubmittedPage.panel).toHaveText(
    expect.stringContaining(`Application reference for ${material}`)
  )

  const reference = await ApplicationSubmittedPage.referenceNumber.getText()
  expect(reference).toMatch(
    new RegExp(`^AP${accreditationYear.slice(-2)}[A-Z]{2}`)
  )

  // Payment details are rendered inline on the confirmation page (RA-290 AC06),
  // with the charge and the regulator's bank details filled in for whichever
  // nation the registration belongs to.
  await expect(ApplicationSubmittedPage.amountDue).toBeDisplayed()
  await expect(ApplicationSubmittedPage.bankSortCode).toBeDisplayed()
  await expect(ApplicationSubmittedPage.bankAccountNumber).toBeDisplayed()
  await expect(ApplicationSubmittedPage.bankPaymentReference).not.toHaveText('')
  await expect(ApplicationSubmittedPage.contactRegulatorHeading).toHaveText(
    'Contact your regulator'
  )
}
