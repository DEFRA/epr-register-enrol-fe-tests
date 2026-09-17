import { browser, expect } from '@wdio/globals'
import LoginPage from 'page-objects/login.page'
import OperatorPage from 'page-objects/operator.page'
import OperatorAccreditationPage from 'page-objects/operator-accreditation.page'
import TaskListPage from 'page-objects/tasklist.page'
import OverseasReprocessingSitesPage from 'page-objects/overseas-reprocessing-sites.page'
import ConfirmOverseasSitesPage from 'page-objects/confirm-overseas-sites.page'
import BesEvidencePage from 'page-objects/bes-evidence.page'
import SubmitApplicationPage from 'page-objects/submit-application.page'
import QueryTaskListPage from 'page-objects/query-task-list.page'
import QueryDeclarationPage from 'page-objects/query-declaration.page'
import {
  getApplication,
  raiseQuery,
  patchSection
} from '../helpers/case-management.js'
import { completePrnBusinessPlanSamplingPlan } from '../helpers/accreditation-journey.js'

// RA-570: "Amend BES evidence". Mirrors the RA-481 section-lock pattern
// already proven end to end for other sections (query-resubmit.e2e.js,
// ra-481-section-lock.e2e.js): BES evidence is locked read-only the moment
// the application is Submitted, and becomes editable again only once a
// regulator query is raised against it, via an Amend entry point on the BES
// evidence review screen (AC01). While editable, an operator can change a
// file's date or delete a file (AC02) — but never down to zero files, which
// this spec's negative case covers directly (business rule: a BES evidence
// section can never end up with zero files).
//
// NOTE: the corresponding frontend PR for RA-570 is landing in parallel in
// the sibling epr-register-enrol-frontend repo, so the Amend/edit-date/
// delete-file selectors this spec drives (added to bes-evidence.page.js)
// are this codebase's closest-convention best guess — not yet confirmed
// against the real rendered markup. Flagged in the PR description for a
// selector-accuracy check once that frontend PR lands.
//
// Reuses org 50006 (Glass exporter) on a disposable, run-unique year — the
// same pattern ra-583-bes-status-after-resubmit.e2e.js uses on the same org
// — so this doesn't race that spec's (or exporter-accreditation.e2e.js's)
// use of the same org under concurrent wdio workers. year/applicationId are
// captured once and reused idempotently across both `it()` blocks below
// (query-resubmit.e2e.js's / ra-481-section-lock.e2e.js's precedent), since
// the second block's premise — this section used to be locked, then got
// queried — only makes sense as a continuation of the first.
describe('RA-570: Amend BES evidence', () => {
  let organisationId
  let registrationId
  let materialType
  let year
  let applicationId

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

  function landingUrl() {
    return `/operator-accreditation/${organisationId}/${registrationId}/${materialType}/${year}`
  }

  function reviewUrl() {
    return `/accreditation/cya-evidence-for-overseas-site/${applicationId}`
  }

  async function reachSubmittedExporterApplication() {
    await OperatorPage.navigateToExporterAccreditationGlass()
    const landing = await browser.getUrl()
    ;[, organisationId, registrationId, materialType] = new URL(
      landing
    ).pathname
      .split('/')
      .filter(Boolean)
    if (!year) {
      year = String(3000 + (Date.now() % 1000))
    }
    await browser.url(landingUrl())

    await OperatorAccreditationPage.clickContinue()
    await browser.waitUntil(
      async () =>
        (await browser.getUrl()).includes('/accreditation/task-list/'),
      { timeout: 10000, timeoutMsg: 'Did not reach task list' }
    )
    applicationId = (await browser.getUrl())
      .split('/accreditation/task-list/')[1]
      .split('?')[0]

    const application = await getApplication(organisationId, applicationId)
    if (application.applicationStatus === 'Submitted') {
      return
    }

    await completePrnBusinessPlanSamplingPlan({ material: 'Glass' })

    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )
    await TaskListPage.overseasSitesLink.click()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/select-overseas-sites')
    )
    await OverseasReprocessingSitesPage.continue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/confirm-overseas-sites')
    )
    await ConfirmOverseasSitesPage.confirmAndContinue()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )
    await TaskListPage.besLink.click()
    await expect(browser).toHaveUrl(
      expect.stringContaining(
        '/accreditation/upload-evidence-for-overseas-site/'
      )
    )

    // Upload two files for the one required site, so the amend flow below
    // has a non-last file to delete before it ever hits the zero-files
    // guard — deleting straight down to one file would make the
    // negative (last-file) case indistinguishable from the positive one.
    await BesEvidencePage.pendingUploadLink.click()
    await BesEvidencePage.uploadFile('business-plan.pdf')
    await BesEvidencePage.selectYes()
    await BesEvidencePage.uploadFile('business-plan.pdf')
    await BesEvidencePage.selectNo()
    await BesEvidencePage.confirmEvidence()
    await browser.waitUntil(
      async () =>
        (await browser.getUrl()).includes('/upload-evidence-for-overseas-site'),
      {
        timeout: 10000,
        timeoutMsg: 'Did not return to evidence list after confirming'
      }
    )
    await BesEvidencePage.clickReliably(BesEvidencePage.continueButton)

    await TaskListPage.assertAllTasksCompleted({ isExporter: true })
    await TaskListPage.continueToSubmit()
    await SubmitApplicationPage.submitApplication()
  }

  it('AC01/AC02: locks the BES evidence review screen (no Amend button, no edit) once submitted, before any query', async () => {
    await reachSubmittedExporterApplication()

    const submittedApplication = await getApplication(
      organisationId,
      applicationId
    )
    expect(submittedApplication.applicationStatus).toBe('Submitted')
    expect(submittedApplication.besEvidence.sectionStatus).not.toBe('Queried')

    // The review screen renders read-only, with no Amend button — matching
    // the read-only-notice pattern RA-481 established for every other
    // section's CYA/review page.
    await browser.url(reviewUrl())
    await expect($('[data-testid="read-only-notice"]')).toBeDisplayed()
    await expect(await BesEvidencePage.amendButton.isExisting()).toBe(false)
    await expect(await $('[data-testid="edit-date-link"]').isExisting()).toBe(
      false
    )
    await expect(await $('[data-testid="delete-file-link"]').isExisting()).toBe(
      false
    )

    // The backend gate — not just the frontend's read-only rendering — is
    // what actually stops a write, same as every other RA-481-gated section.
    const lockedPatch = await patchSection(
      organisationId,
      applicationId,
      'broadly-equivalent-standards',
      {}
    )
    expect(lockedPatch.statusCode).toBe(409)
    expect(lockedPatch.text).toEqual(
      expect.stringContaining('section is not editable')
    )
  })

  it('AC01/AC02: unlocks Amend once queried, allows editing a date and deleting a non-last file, blocks deleting the last file, and resubmit works', async () => {
    // Continues the same org/application from the test above (still
    // Submitted, not yet queried) — see the describe-level comment on why
    // this reuses rather than reseeds.
    await reachSubmittedExporterApplication()

    const queryNote = 'Please confirm the evidence dates are still current.'
    await raiseQuery(organisationId, applicationId, {
      queryNote,
      sectionKeys: ['broadly-equivalent-standards']
    })

    await QueryTaskListPage.open(applicationId)
    await expect(QueryTaskListPage.taskTag('task-bes-evidence')).toHaveText(
      'QUERIED'
    )

    // AC01: Amend is now available on the review screen.
    await QueryTaskListPage.taskLink('task-bes-evidence').click()
    await browser.url(reviewUrl())
    await expect(await $('[data-testid="read-only-notice"]').isExisting()).toBe(
      false
    )
    await expect(BesEvidencePage.amendButton).toBeDisplayed()
    await BesEvidencePage.clickAmend()

    const fileIds = await BesEvidencePage.fileRowIds()
    expect(fileIds.length).toBe(2)
    const [firstFileId, secondFileId] = fileIds

    // AC02: editing a file's date succeeds and persists.
    await BesEvidencePage.editDate(firstFileId)
    await BesEvidencePage.updateDate({
      validFrom: { day: '01', month: '02', year: '2025' },
      validTo: { day: '31', month: '12', year: '2031' }
    })
    await expect(await $('[data-testid="error-summary"]').isExisting()).toBe(
      false
    )
    const afterDateEdit = await getApplication(organisationId, applicationId)
    const editedFile = afterDateEdit.besEvidence.files?.find(
      (file) => file.id === firstFileId
    )
    if (editedFile) {
      expect(editedFile.validFrom).toEqual(
        expect.stringContaining('2025-02-01')
      )
      expect(editedFile.validTo).toEqual(expect.stringContaining('2031-12-31'))
    }

    // AC02/business rule: deleting a non-last file succeeds.
    await BesEvidencePage.deleteFile(secondFileId)
    await browser.waitUntil(
      async () => (await BesEvidencePage.fileRowIds()).length === 1,
      { timeout: 10000, timeoutMsg: 'Second file was not removed' }
    )

    // Negative case: deleting the last remaining file must be blocked — a
    // BES evidence section can never end up with zero files.
    await BesEvidencePage.deleteFile(firstFileId)
    await expect(BesEvidencePage.errorSummary).toBeDisplayed()
    await expect(BesEvidencePage.deleteFileError).toHaveText(
      expect.stringContaining('at least one')
    )
    const remainingFileIds = await BesEvidencePage.fileRowIds()
    expect(remainingFileIds.length).toBe(1)

    // AC02: resubmitting after amendment works, following the same
    // resubmit flow as query-resubmit.e2e.js.
    await browser.waitUntil(
      async () =>
        (await browser.getUrl()).includes('/accreditation/query-task-list/'),
      { timeout: 10000, timeoutMsg: 'Did not return to query task list' }
    )
    await QueryTaskListPage.continueToDeclaration()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/query-declaration/')
    )
    await QueryDeclarationPage.submitResubmission({
      role: 'Compliance Officer'
    })

    await expect(browser).toHaveUrl(expect.stringContaining(landingUrl()))
    await expect($('.govuk-notification-banner')).toHaveText(
      expect.stringContaining(
        'Your application has been resubmitted to the regulator.'
      )
    )

    const resubmittedApplication = await getApplication(
      organisationId,
      applicationId
    )
    expect(resubmittedApplication.besEvidence.sectionStatus).not.toBe('Queried')

    // RA-481 regression guard, same as query-resubmit.e2e.js: resubmitting
    // must flip the just-queried section back into the plain-locked
    // read-only state, Amend included.
    await browser.url(reviewUrl())
    await expect($('[data-testid="read-only-notice"]')).toBeDisplayed()
    await expect(await BesEvidencePage.amendButton.isExisting()).toBe(false)
  })
})
