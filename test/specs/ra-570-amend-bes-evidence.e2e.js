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
  getOverseasSites,
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

  // The one exporter site that needs (and so carries) BES evidence files.
  async function getEvidenceSite() {
    const sites = await getOverseasSites(organisationId, applicationId)
    const site = sites.find(
      (s) => (s.besEvidence?.besEvidenceUploads ?? []).length > 0
    )
    expect(site).toBeDefined()
    return site
  }

  function reviewUrl(siteId) {
    return `/accreditation/cya-evidence-for-overseas-site/${applicationId}/${siteId}`
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
    // Skipped when a previous run of this helper already uploaded evidence
    // (no site is still "Not uploaded"), so re-entering it is idempotent.
    if (await BesEvidencePage.pendingUploadLink.isExisting()) {
      await BesEvidencePage.pendingUploadLink.click()
      await BesEvidencePage.uploadFile('business-plan.pdf')
      await BesEvidencePage.selectYes()
      await BesEvidencePage.uploadFile('business-plan.pdf')
      await BesEvidencePage.selectNo()
      await BesEvidencePage.confirmEvidence()
      await browser.waitUntil(
        async () =>
          (await browser.getUrl()).includes(
            '/upload-evidence-for-overseas-site'
          ),
        {
          timeout: 10000,
          timeoutMsg: 'Did not return to evidence list after confirming'
        }
      )
    }
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

    // The review screen renders read-only, with no Amend/Delete/Add controls
    // — matching the read-only-notice pattern RA-481 established for every
    // other section's CYA/review page.
    const { siteId } = await getEvidenceSite()
    await browser.url(reviewUrl(siteId))
    await expect($('[data-testid="read-only-notice"]')).toBeDisplayed()
    expect((await BesEvidencePage.fileRowIds()).length).toBe(2)
    expect((await BesEvidencePage.amendFileLinks).length).toBe(0)
    expect((await BesEvidencePage.deleteFileButtons).length).toBe(0)
    await expect(await BesEvidencePage.addFileLink.isExisting()).toBe(false)

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

    // AC01: Amend is now available. From the query task list the BES task
    // opens the evidence list, whose site row links to the review screen
    // ("Amend evidence") now that files exist for it.
    const { siteId } = await getEvidenceSite()
    await QueryTaskListPage.taskLink('task-bes-evidence').click()
    await expect(browser).toHaveUrl(
      expect.stringContaining(
        '/accreditation/upload-evidence-for-overseas-site/'
      )
    )
    await BesEvidencePage.clickReliably(
      $(`[data-testid="upload-link-${siteId}"]`)
    )
    await expect(browser).toHaveUrl(expect.stringContaining(reviewUrl(siteId)))
    await expect(await $('[data-testid="read-only-notice"]').isExisting()).toBe(
      false
    )
    await expect(BesEvidencePage.addFileLink).toBeDisplayed()

    const fileIds = await BesEvidencePage.fileRowIds()
    expect(fileIds.length).toBe(2)
    const [firstFileId, secondFileId] = fileIds

    // AC02: editing a file's dates succeeds and persists.
    await BesEvidencePage.amendFile(firstFileId)
    await BesEvidencePage.updateDate({
      validFrom: { day: '01', month: '02', year: '2025' },
      validTo: { day: '31', month: '12', year: '2031' }
    })
    await expect(browser).toHaveUrl(expect.stringContaining(reviewUrl(siteId)))
    await expect(await $('[data-testid="error-summary"]').isExisting()).toBe(
      false
    )
    const editedSite = await getEvidenceSite()
    const editedFile = editedSite.besEvidence.besEvidenceUploads.find(
      (file) => file.fileId === firstFileId
    )
    expect(editedFile.besEvidenceValidFromDate).toEqual(
      expect.stringContaining('2025-02-01')
    )
    expect(editedFile.besEvidenceExpiryDate).toEqual(
      expect.stringContaining('2031-12-31')
    )

    // AC02/business rule: deleting a non-last file succeeds.
    await BesEvidencePage.deleteFile(secondFileId)
    await browser.waitUntil(
      async () => (await BesEvidencePage.fileRowIds()).length === 1,
      { timeout: 10000, timeoutMsg: 'Second file was not removed' }
    )
    await expect(await $('[data-testid="error-summary"]').isExisting()).toBe(
      false
    )

    // Negative case: deleting the last remaining file must be blocked — a
    // BES evidence section can never end up with zero files.
    await BesEvidencePage.deleteFile(firstFileId)
    await expect(BesEvidencePage.errorSummary).toBeDisplayed()
    await expect(BesEvidencePage.errorSummary).toHaveText(
      expect.stringContaining('At least one BES evidence file is required')
    )
    expect((await BesEvidencePage.fileRowIds()).length).toBe(1)

    // Confirm the (amended) evidence, then Continue on the evidence list to
    // head back to the query task list, so the resubmit wait below has
    // something driving the navigation instead of relying on it happening
    // on its own.
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
    await browser.url(reviewUrl(siteId))
    await expect($('[data-testid="read-only-notice"]')).toBeDisplayed()
    expect((await BesEvidencePage.amendFileLinks).length).toBe(0)
    expect((await BesEvidencePage.deleteFileButtons).length).toBe(0)
  })
})
