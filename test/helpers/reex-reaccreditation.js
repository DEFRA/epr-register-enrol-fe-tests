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
import { accreditationYear, reexPassword, reexUsername } from '../config.js'
import {
  hasSeededOrganisation,
  signInAsSeededOperator
} from './integration-organisation/index.js'

const BUSINESS_PLAN_PERCENTAGES = [15, 15, 15, 15, 15, 15, 10]
const EVIDENCE_FIXTURE = 'business-plan.pdf'

// Statuses a 2027 application can already be in on the shared dev tier. Only
// the first two can be driven through to submission — SUBMITTED, UPDATED and
// QUERIED all mean somebody (a previous run, or a regulator) has moved the
// application past the point this journey starts from.
const APPLICABLE_STATUSES = ['NOT STARTED', 'IN PROGRESS']

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

    await ReexRegistrationPage.applyForAccreditation(accreditationYear)
    await OperatorAccreditationPage.pageHeading.waitForDisplayed({
      timeout: 30000
    })

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
 * @returns {Promise<string>} The material, as this journey names it.
 */
export async function completeOutstandingTasks({ isExporter }) {
  await expect(browser).toHaveUrl(
    expect.stringContaining('/accreditation/task-list/')
  )

  const material = await accreditationMaterial()

  if (await TaskListPage.PRNTonnageLink.isExisting()) {
    await completeTonnage()
  }

  if (await TaskListPage.businessPlanLink.isExisting()) {
    await completeBusinessPlan()
  }

  if (await TaskListPage.SIPlanLink.isExisting()) {
    await completeSamplingPlan(material)
  }

  if (isExporter) {
    if (await TaskListPage.overseasSitesLink.isExisting()) {
      await completeOverseasSites()
    }
    if (await TaskListPage.besLink.isExisting()) {
      await completeBesEvidence()
    }
  }

  await expect(browser).toHaveUrl(
    expect.stringContaining('/accreditation/task-list/')
  )

  return material
}

async function completeTonnage() {
  await TaskListPage.PRNTonnageLink.click()
  await expect(browser).toHaveUrl(
    expect.stringContaining('/accreditation/tonnage')
  )
  const tonnageBand = await PrnTonnagePage.selectRandomOption()
  await PrnTonnagePage.saveAndContinue()

  await expect(browser).toHaveUrl(
    expect.stringContaining('/accreditation/tonnage-authority')
  )
  await PrnAuthorityPage.addAuthoriser()
  await PrnAuthorityPage.saveAndContinue()

  await expect(PrnCheckAnswersPage.pageHeading).toHaveText(
    'Check your answers before you continue'
  )
  // Check what was saved, not just that the page moved on: a band or an
  // authoriser that silently failed to save only surfaces at submission.
  await expect(PrnCheckAnswersPage.tonnageValue).toHaveText(tonnageBand)
  await expect(PrnCheckAnswersPage.authorisersValue).not.toHaveText('')
  await PrnCheckAnswersPage.confirmAndContinue()
}

async function completeBusinessPlan() {
  await TaskListPage.businessPlanLink.click()
  await expect(BusinessPlanPage.pageHeading).toHaveText('Business plan')

  await BusinessPlanPage.fillPercentages(BUSINESS_PLAN_PERCENTAGES)
  await BusinessPlanPage.saveAndContinue()

  // The heading says PRN on a reprocessor journey and PERN on an exporter one.
  await expect(BusinessPlanDetailPage.pageHeading).toHaveText(
    expect.stringContaining("Add more details about how you'll spend the")
  )
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
  await BusinessPlanCheckAnswersPage.confirmAndContinue()
}

async function completeSamplingPlan(material) {
  await TaskListPage.SIPlanLink.click()
  await expect(SamplingPlanPage.pageHeading).toHaveText(
    `Upload sampling and inspection plan - part 2 - ${material}`
  )
  await SamplingPlanPage.uploadFile(EVIDENCE_FIXTURE)
  await SamplingPlanPage.saveAndContinue()
}

async function completeOverseasSites() {
  await TaskListPage.overseasSitesLink.click()
  await expect(browser).toHaveUrl(
    expect.stringContaining('/accreditation/select-overseas-sites')
  )
  // Keeps whichever sites the registration is already accredited against —
  // adding one is its own journey, covered by exporter-accreditation.e2e.js.
  await OverseasReprocessingSitesPage.continue()

  await expect(browser).toHaveUrl(
    expect.stringContaining('/confirm-overseas-sites')
  )
  await ConfirmOverseasSitesPage.confirmAndContinue()
}

async function completeBesEvidence() {
  await TaskListPage.besLink.click()
  await expect(browser).toHaveUrl(
    expect.stringContaining('/accreditation/upload-evidence-for-overseas-site/')
  )
  // Uploads for every site still showing "Not uploaded", then continues.
  // EU/OECD sites read "Not required for application" and are left alone, so
  // an accreditation whose sites are all EU/OECD uploads nothing at all.
  await BesEvidencePage.uploadAllEvidence(EVIDENCE_FIXTURE)
}
