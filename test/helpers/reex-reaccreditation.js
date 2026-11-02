import { browser, expect } from '@wdio/globals'
import ReexStartPage from 'page-objects/reex-start.page'
import OneLoginPage from 'page-objects/one-login.page'
import ReexHomePage from 'page-objects/reex-home.page'
import ReexRegistrationPage from 'page-objects/reex-registration.page'
import OperatorAccreditationPage from 'page-objects/operator-accreditation.page'
import TaskListPage from 'page-objects/tasklist.page'
import PrnTonnagePage from 'page-objects/prn-tonnage.page'
import PrnAuthorityPage from 'page-objects/prn-authority.page'
import PrnCheckAnswersPage from 'page-objects/prn-check-answers.page'
import BusinessPlanPage from 'page-objects/business-plan.page'
import BusinessPlanDetailPage from 'page-objects/business-plan-detail.page'
import BusinessPlanCheckAnswersPage from 'page-objects/business-plan-check-answers.page'
import SamplingPlanPage from 'page-objects/sampling-plan.page'
import OverseasReprocessingSitesPage from 'page-objects/overseas-reprocessing-sites.page'
import ConfirmOverseasSitesPage from 'page-objects/confirm-overseas-sites.page'
import BesEvidencePage from 'page-objects/bes-evidence.page'
import SubmitApplicationPage from 'page-objects/submit-application.page'
import ApplicationSubmittedPage from 'page-objects/application-submitted.page'
import { accreditationYear, reexPassword, reexUsername } from '../config.js'
import {
  handOffToRegisterEnrol,
  hasSeededOrganisation,
  signInAsSeededOperator
} from './integration-organisation/index.js'
import {
  APPLICABLE_STATUSES,
  completeIncompleteOverseasSites
} from './integration-organisation/seeded-accreditation-journey.js'

const BUSINESS_PLAN_PERCENTAGES = [15, 15, 15, 15, 15, 15, 10]
const EVIDENCE_FIXTURE = 'business-plan.pdf'

/**
 * Signs in to the Re-Ex frontend and lands on the organisation home page: as
 * the run's seeded organisation through the Defra ID stub when there is one
 * (test), otherwise through GOV.UK One Login.
 */
export async function signInToReex() {
  if (hasSeededOrganisation()) {
    await signInAsSeededOperator()
    return
  }

  await ReexStartPage.open()
  await ReexStartPage.clickStart()
  await OneLoginPage.signIn(reexUsername, reexPassword)
  await ReexHomePage.waitUntilLoaded()
}

/**
 * Walks the materials on the given tab and returns the first one that can
 * actually be reapplied for this year, along with its accreditation landing
 * page already open.
 *
 * "Crawling" here is unavoidable rather than decorative: the home-page grid
 * only shows whether a material is accredited, not whether its reapplication
 * has already been started or submitted. That lives on the landing page behind
 * the hand-off link, so each candidate has to be opened to be ruled in or out.
 * Runs against a shared environment consume one material per pass, so the
 * search starts over from the top on every run.
 *
 * Leaves the browser on the chosen material's accreditation landing page.
 *
 * @param {object}  options
 * @param {boolean} options.isExporter  Exporting tab rather than Reprocessing.
 * @returns {Promise<{row: object, applicationId: string}>}
 */
export async function findApplicableMaterial({ isExporter }) {
  if (isExporter) {
    await ReexHomePage.openExporting()
  } else {
    await ReexHomePage.openReprocessing()
  }

  const rows = await ReexHomePage.materialRows()
  const accredited = rows.filter((row) => row.accreditation === 'Approved')

  expect(accredited.length).toBeGreaterThan(0)

  const skipped = []

  for (const row of accredited) {
    await ReexHomePage.openMaterial(row)

    // A material that is accredited but outside its reapplication window has
    // no hand-off link at all — nothing to apply for, so move on.
    if (
      !(await ReexRegistrationPage.hasApplyForAccreditationLink(
        accreditationYear
      ))
    ) {
      skipped.push(`${describeRow(row)}: no ${accreditationYear} hand-off link`)
      continue
    }

    if (hasSeededOrganisation()) {
      await handOffToRegisterEnrol(accreditationYear)
    } else {
      await ReexRegistrationPage.applyForAccreditation(accreditationYear)
      await OperatorAccreditationPage.pageHeading.waitForDisplayed({
        timeout: 30000
      })
    }

    const status = await OperatorAccreditationPage.applicationStatus.getText()
    if (!APPLICABLE_STATUSES.includes(status)) {
      skipped.push(`${describeRow(row)}: ${status}`)
      continue
    }

    const applicationId = await applicationIdFromContinueLink()
    return { row, applicationId }
  }

  throw new Error(
    `No ${isExporter ? 'exporter' : 'reprocessor'} material is available to ` +
      `reapply for ${accreditationYear} — every accredited material has ` +
      `already been taken past NOT STARTED / IN PROGRESS on this ` +
      `environment:\n  ${skipped.join('\n  ')}`
  )
}

function describeRow(row) {
  return row.site ? `${row.site} / ${row.material}` : row.material
}

async function applicationIdFromContinueLink() {
  const href =
    await OperatorAccreditationPage.firstContinueLink.getAttribute('href')
  return href.split('/accreditation/task-list/')[1].split('?')[0]
}

/**
 * Reads the material this accreditation is for, as the register-enrol frontend
 * itself names it.
 *
 * Not the same string as the material was picked by: the Re-Ex grid and the
 * accreditation journey keep separate names for the same material ("Fibre-based
 * composite" on one, "Fibre" on the other), and only the slug in the hand-off
 * URL is shared. So anything asserted inside the journey has to use the
 * journey's own name, which every page of it carries in the caption, formatted
 * as "<operator> (<year>, <material>, <address...>)".
 *
 * @returns {Promise<string>}
 */
async function accreditationMaterial() {
  const caption = await TaskListPage.pageCaption.getText()
  const details = caption.slice(
    caption.lastIndexOf('(') + 1,
    caption.lastIndexOf(')')
  )
  const [year, material] = details.split(',').map((part) => part.trim())

  expect(year).toBe(accreditationYear)
  expect(material).not.toBe('')

  return material
}

/**
 * Whether a task is still to do, read only once the browser is back on the
 * task list. Each task ends on a JavaScript click (clickReliably) that returns
 * before the next page loads, so checking the link straight away can read the
 * task's own last page, find no link and skip a task that is not done.
 *
 * @param {ChainablePromiseElement} link the task's task-list link
 */
async function outstandingTask(link) {
  await browser.waitUntil(
    async () =>
      (await browser.getUrl()).includes('/accreditation/task-list/') &&
      (await browser.execute(() => document.readyState)) === 'complete',
    { timeout: 30000, timeoutMsg: 'Did not return to the task list' }
  )
  await TaskListPage.pageCaption.waitForDisplayed({ timeout: 30000 })
  return link.isExisting()
}

/**
 * Completes every outstanding task on the task list, leaving the browser back
 * on the task list with everything COMPLETED and ready to submit.
 *
 * Each task is skipped when its task-list link is absent, which is how a
 * COMPLETED task renders. That matters here because a run against a shared
 * environment can legitimately pick up an application an earlier, interrupted
 * run left part-finished.
 *
 * @param {object}  options
 * @param {boolean} options.isExporter  Also complete the two exporter-only tasks.
 * @param {(pageName: string) => Promise<void>} [options.checkPage]  Called on
 *   each page of each task as it is reached, e.g. to run an accessibility check.
 * @returns {Promise<string>} The material, as this journey names it.
 */
export async function completeOutstandingTasks({
  isExporter,
  checkPage = async () => {}
}) {
  await expect(browser).toHaveUrl(
    expect.stringContaining('/accreditation/task-list/')
  )

  const material = await accreditationMaterial()
  await checkPage('Task list')

  if (await outstandingTask(TaskListPage.PRNTonnageLink)) {
    await completeTonnage(checkPage)
  }

  if (await outstandingTask(TaskListPage.businessPlanLink)) {
    await completeBusinessPlan(checkPage)
  }

  if (await outstandingTask(TaskListPage.SIPlanLink)) {
    await completeSamplingPlan(material, checkPage)
  }

  if (isExporter) {
    if (await outstandingTask(TaskListPage.overseasSitesLink)) {
      await completeOverseasSites(checkPage)
    }
    if (await outstandingTask(TaskListPage.besLink)) {
      await completeBesEvidence(checkPage)
    }
  }

  await expect(browser).toHaveUrl(
    expect.stringContaining('/accreditation/task-list/')
  )

  return material
}

async function completeTonnage(checkPage) {
  await TaskListPage.PRNTonnageLink.click()
  await expect(browser).toHaveUrl(
    expect.stringContaining('/accreditation/tonnage')
  )
  await checkPage('PRN tonnage')
  const tonnageBand = await PrnTonnagePage.selectRandomOption()
  await PrnTonnagePage.saveAndContinue()

  await expect(browser).toHaveUrl(
    expect.stringContaining('/accreditation/tonnage-authority')
  )
  await checkPage('PRN authority')
  await PrnAuthorityPage.addAuthoriser()
  await PrnAuthorityPage.saveAndContinue()

  await expect(PrnCheckAnswersPage.pageHeading).toHaveText(
    'Check your answers before you continue'
  )
  // Check what was saved, not just that the page moved on: a band or an
  // authoriser that silently failed to save only surfaces at submission.
  await expect(PrnCheckAnswersPage.tonnageValue).toHaveText(tonnageBand)
  await expect(PrnCheckAnswersPage.authorisersValue).not.toHaveText('')
  await checkPage('PRN check your answers')
  await PrnCheckAnswersPage.confirmAndContinue()
}

async function completeBusinessPlan(checkPage) {
  await TaskListPage.businessPlanLink.click()
  await expect(BusinessPlanPage.pageHeading).toHaveText('Business plan')
  await checkPage('Business plan')

  await BusinessPlanPage.fillPercentages(BUSINESS_PLAN_PERCENTAGES)
  await BusinessPlanPage.saveAndContinue()

  // The heading says PRN on a reprocessor journey and PERN on an exporter one.
  await expect(BusinessPlanDetailPage.pageHeading).toHaveText(
    expect.stringContaining("Add more details about how you'll spend the")
  )
  await checkPage('Business plan details')
  await BusinessPlanDetailPage.fillDescriptions()
  for (const area of await BusinessPlanDetailPage.textareas) {
    if (await area.isDisplayed()) {
      await expect(area).not.toHaveValue('')
    }
  }
  await BusinessPlanDetailPage.saveAndContinue()

  await expect(BusinessPlanCheckAnswersPage.pageHeading).toHaveText(
    'Check your answers before continuing'
  )
  for (const percentage of new Set(BUSINESS_PLAN_PERCENTAGES)) {
    await expect(BusinessPlanCheckAnswersPage.summaryList).toHaveText(
      expect.stringContaining(`${percentage}%`)
    )
  }
  await checkPage('Business plan check your answers')
  await BusinessPlanCheckAnswersPage.confirmAndContinue()
}

async function completeSamplingPlan(material, checkPage) {
  await TaskListPage.SIPlanLink.click()
  await expect(SamplingPlanPage.pageHeading).toHaveText(
    `Upload sampling and inspection plan - part 2 - ${material}`
  )
  await checkPage('Sampling and inspection plan')
  await SamplingPlanPage.uploadFile(EVIDENCE_FIXTURE)
  await SamplingPlanPage.saveAndContinue()
}

async function completeOverseasSites(checkPage) {
  await TaskListPage.overseasSitesLink.click()
  await expect(browser).toHaveUrl(
    expect.stringContaining('/accreditation/select-overseas-sites')
  )
  await checkPage('Select overseas sites')
  // The list will not continue while any site is tagged Incomplete (RA-597),
  // which every site an organisation is seeded with is: migrated sites come
  // without contact details, recycling operations or Basel codes.
  if (await $('[data-testid*="-incomplete-"]').isExisting()) {
    const applicationId = (await browser.getUrl())
      .split('/accreditation/select-overseas-sites/')[1]
      .split(/[/?]/)[0]
    await completeIncompleteOverseasSites(applicationId, { checkPage })
  }
  // Keeps whichever sites the registration is already accredited against —
  // adding one is its own journey, covered by exporter-accreditation.e2e.js.
  await OverseasReprocessingSitesPage.continue()

  await expect(browser).toHaveUrl(
    expect.stringContaining('/confirm-overseas-sites')
  )
  await checkPage('Confirm overseas sites')
  await ConfirmOverseasSitesPage.confirmAndContinue()
}

async function completeBesEvidence(checkPage) {
  await TaskListPage.besLink.click()
  await expect(browser).toHaveUrl(
    expect.stringContaining('/accreditation/upload-evidence-for-overseas-site/')
  )
  await checkPage('BES evidence sites')
  // Uploads for every site still showing "Not uploaded", then continues.
  // EU/OECD sites read "Not required for application" and are left alone, so
  // an accreditation whose sites are all EU/OECD uploads nothing at all.
  await BesEvidencePage.uploadAllEvidence(EVIDENCE_FIXTURE)
}

/**
 * From the declaration page, submits the application and checks the
 * confirmation page: its reference, and the charge and bank details to pay it.
 *
 * @param {string} material as the journey names it (completeOutstandingTasks)
 * @param {object} [options]
 * @param {(pageName: string) => Promise<void>} [options.checkPage]
 * @returns {Promise<string>} the application reference
 */
export async function submitAndAssertConfirmation(
  material,
  { checkPage = async () => {} } = {}
) {
  await expect(browser).toHaveUrl(
    expect.stringContaining('/accreditation/submit-declaration/')
  )
  await expect(SubmitApplicationPage.pageHeading).toHaveText('Declaration')
  await checkPage('Declaration')
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
  await checkPage('Application submitted')

  return reference
}
