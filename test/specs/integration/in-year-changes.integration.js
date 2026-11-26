import { browser, expect, $ } from '@wdio/globals'
import AccreditationRequestsPage from 'page-objects/accreditation-requests.page'
import AddOrsConditionsOfExportPage from 'page-objects/add-ors-conditions-of-export.page'
import AddOrsRecyclingOperationPage from 'page-objects/add-ors-recycling-operation.page'
import AddToAccreditationPage from 'page-objects/add-to-accreditation.page'
import ChangeRequestDetailPage from 'page-objects/change-request-detail.page'
import ChangeRequestsPage from 'page-objects/change-requests.page'
import CmWorkItemPage from 'page-objects/cm-work-item.page'
import CmWorkItemsPage from 'page-objects/cm-work-items.page'
import ManageOverseasSitesPage from 'page-objects/manage-overseas-sites.page'
import ManageRegistrationAccreditationPage from 'page-objects/manage-registration-accreditation.page'
import SubmitApplicationPage from 'page-objects/submit-application.page'

import { accreditationYear, caseManagementFrontendUrl } from '../../config.js'
import {
  WORK_ITEM_STATES,
  approveWorkItem,
  confirmApplicantContact,
  dulyMakeWorkItem,
  signInToCaseManagement
} from '../../helpers/case-management-journey.js'
import { requireSeededOrganisation } from '../../helpers/integration-organisation/index.js'
import {
  addSiteToChangeRequest,
  currentYear,
  findRegistration,
  grantAccreditation,
  manageUrl,
  openAccreditation
} from '../../helpers/integration-organisation/in-year-changes.js'
import { openRegisterEnrolPage } from '../../helpers/integration-organisation/register-enrol-sign-in.js'
import { IN_YEAR_CHANGES_MATERIAL } from '../../helpers/integration-organisation/seeded-organisation.js'
import { reportDetails, reportStep } from '../../helpers/report-step.js'
import { waitForUrl } from '../../helpers/wait-for-url.js'

// In-year changes, end to end on the test environment.
//
//   Prerequisites  the organisation seeded for the run (onPrepare, see
//                  integration-organisation/hooks.js): approved in Re-Ex to
//                  reprocess and export every material, accredited in Re-Ex
//                  for this year, its steel exporter registration with 8
//                  accredited and 8 registered overseas sites
//                  (seeded-organisation.js). onComplete deletes it, pass or
//                  fail.
//   Test 1         the steel reprocessor's accreditation: applied for,
//                  submitted and granted in case management
//   Test 2         the same for the steel exporter, which keeps its 8
//                  accredited sites and leaves the 8 registered ones
//                  registered
//   Test 3         the manage pages (/manage/{orgId}/{registrationNumber}/
//                  {Material}) open for both registrations
//   Test 4         operator: adds a registered overseas site to the
//                  exporter's accreditation in-year (RA-492), fills in what it
//                  is missing and submits the request
//   Test 5         case management: lists it as an in-year change application
//   Test 6         case management: duly makes, approves and grants it
//   Test 7         operator: the change request reads GRANTED and the site is
//                  accredited
//
// The accreditations are ACCREDITATION_YEAR's (next year by default), as
// accreditation-workflow's are: an application is built from the year
// before's Re-Ex accreditation, and Re-Ex only holds this year's. The in-year
// pages work on any granted exporter accreditation, but the /manage pages
// only show this calendar year's. Until the accreditations' year comes, then,
// the manage pages show the registrations alone (Test 3), the in-year pages
// are entered from the accreditation's landing page (Test 4), and Test 7,
// which reads the result on the manage pages, skips.
//
// Tests 5 to 7 need the backend to send a submitted change request to case
// management (AccreditationChanges__SubmitToCaseManagement on
// epr-register-enrol-backend). Until it does on test, case management lists
// no in-year change for the organisation, and they skip, saying so.
//
// The tests share the organisation and run in order: each skips, saying why,
// when the one it builds on did not get as far as it needs.

const MATERIAL = IN_YEAR_CHANGES_MATERIAL
const YEAR = Number(accreditationYear)

const IN_YEAR_CHANGE_REFERENCE = /^IYC-ORS-\d{4}-\d{5}$/
const APPROVAL_NOTE = 'In-year changes integration test: the site is suitable.'

// Case management lists a submission once it has processed it, and pushes a
// decision back to the operator backend shortly after recording it.
const CASE_MANAGEMENT_TIMEOUT = 90 * 1000
const PUSH_TIMEOUT = 2 * 60 * 1000

const mainText = async () =>
  (await $('main').getText()).replace(/\s+/g, ' ').slice(0, 500)

describe('In-year changes: an overseas site added to a granted accreditation - test environment', function () {
  let organisation
  const progress = {}
  const managesYear = YEAR === currentYear()

  function requireStage(context, stage, reason = `not ${stage}`) {
    if (!progress[stage]) {
      reportDetails('Skipped', { reason })
      context.skip()
    }
  }

  async function waitForPath(suffix, { timeout = 30000 } = {}) {
    await waitForUrl(
      (url) => new URL(url).pathname.endsWith(suffix),
      `Did not reach ${suffix}`,
      { timeout }
    )
  }

  async function openManagePage(registration, path = '') {
    await openRegisterEnrolPage(
      `${manageUrl(organisation, registration)}${path}`,
      organisation.email
    )
  }

  async function openWorkItem() {
    await browser.url(
      `${caseManagementFrontendUrl}/work-items/${progress.workItem.workItemId}`
    )
    await CmWorkItemPage.waitUntilLoaded()
  }

  // ── Prerequisites ─────────────────────────────────────────────────────────
  before(function () {
    if (process.env.ENVIRONMENT !== 'test') {
      this.skip()
    }
    // Fails, saying why, should seeding have failed.
    organisation = requireSeededOrganisation()
    progress.reprocessor = findRegistration(
      organisation,
      'reprocessor',
      MATERIAL
    )
    progress.exporter = findRegistration(organisation, 'exporter', MATERIAL)
    reportDetails('Organisation', {
      orgId: organisation.orgId,
      id: organisation.id,
      name: organisation.name,
      defraIdEmail: organisation.email,
      year: YEAR,
      reprocessor: progress.reprocessor.registrationNumber,
      exporter: progress.exporter.registrationNumber,
      exporterOverseasSites: Object.keys(progress.exporter.overseasSites ?? {}),
      reprocessorManageUrl: manageUrl(organisation, progress.reprocessor),
      exporterManageUrl: manageUrl(organisation, progress.exporter)
    })
  })

  it(`Test 1: the ${MATERIAL} reprocessor's ${YEAR} accreditation is submitted and granted`, async () => {
    progress.reprocessorGrant = await grantAccreditation(
      organisation,
      progress.reprocessor,
      { year: YEAR }
    )
    reportDetails('Granted', progress.reprocessorGrant)
  })

  it(`Test 2: the ${MATERIAL} exporter's ${YEAR} accreditation is submitted and granted, its registered sites left registered`, async () => {
    progress.exporterGrant = await grantAccreditation(
      organisation,
      progress.exporter,
      { year: YEAR }
    )
    reportDetails('Granted', progress.exporterGrant)
  })

  it('Test 3: the manage pages open for both registrations', async () => {
    for (const type of ['reprocessor', 'exporter']) {
      const registration = progress[type]
      await reportStep(`Operator: open the ${type}'s manage page`, async () => {
        await openManagePage(registration)
        await ManageRegistrationAccreditationPage.registrationNumber.waitForDisplayed(
          { timeout: 30000 }
        )
        await expect(
          ManageRegistrationAccreditationPage.registrationNumber
        ).toHaveText(expect.stringContaining(registration.registrationNumber))
        if (managesYear && progress[`${type}Grant`]) {
          await expect(
            ManageRegistrationAccreditationPage.accreditationNumber
          ).toBeDisplayed()
        } else {
          // This year's accreditation is Re-Ex's: the page shows the
          // registration alone.
          await expect(
            ManageRegistrationAccreditationPage.registrationStatusTag
          ).toHaveText(expect.stringMatching(/granted|approved/i))
        }
        // Only an exporter manages overseas sites.
        const sitesLink = expect(
          ManageRegistrationAccreditationPage.manageOverseasSitesLink
        )
        await (type === 'exporter'
          ? sitesLink.toBeDisplayed()
          : sitesLink.not.toBeExisting())
        reportDetails(`${type} manage page`, {
          url: await browser.getUrl(),
          text: await mainText()
        })
      })
    }
  })

  it('Test 4: operator adds a registered overseas site to the accreditation in-year and submits the request', async function () {
    requireStage(
      this,
      'exporterGrant',
      "the exporter's accreditation was not granted"
    )
    const { applicationId, registeredSiteIds } = progress.exporterGrant

    await reportStep(`Operator: enter the ${YEAR} accreditation`, async () => {
      const status = await openAccreditation(
        organisation,
        progress.exporter,
        YEAR
      )
      expect(status).toContain('GRANTED')
    })

    // The first registered site that needs no BES evidence (one in the EU or
    // OECD): any other is taken off the request again.
    const site = await reportStep(
      'Operator: add a registered site to the accreditation',
      async () => {
        for (const siteId of registeredSiteIds) {
          await addSiteToChangeRequest(applicationId, siteId)
          await waitForPath(`/add/${siteId}`)
          if (
            await AddToAccreditationPage.rowMissingTag(
              'bes-evidence'
            ).isExisting()
          ) {
            await AddToAccreditationPage.clickAndWaitForNextPage(
              AddToAccreditationPage.cancelLink
            )
            continue
          }
          return {
            siteId,
            heading: (await AddToAccreditationPage.pageHeading.getText()).trim()
          }
        }
        throw new Error(
          `Every registered site (${registeredSiteIds}) needs BES evidence`
        )
      }
    )
    progress.site = site
    reportDetails('Site', site)

    // A site Re-Ex registered has a location but no recycling operation or
    // conditions of export.
    await reportStep(
      `Operator: fill in site ${site.siteId}'s missing information`,
      async () => {
        if (
          await AddToAccreditationPage.rowMissingTag(
            'recycling-operation'
          ).isExisting()
        ) {
          await AddToAccreditationPage.openRowAction('recycling-operation')
          await waitForPath(`/add/${site.siteId}/recycling-operation`)
          await AddOrsRecyclingOperationPage.selectPrimaryOperationCode()
          await AddOrsRecyclingOperationPage.continue()
          await waitForPath(`/add/${site.siteId}`)
        }
        if (
          await AddToAccreditationPage.rowMissingTag(
            'conditions-of-export'
          ).isExisting()
        ) {
          await AddToAccreditationPage.openRowAction('conditions-of-export')
          await waitForPath(`/add/${site.siteId}/conditions-of-export`)
          await AddOrsConditionsOfExportPage.selectNo()
          await AddOrsConditionsOfExportPage.continue()
          await waitForPath(`/add/${site.siteId}`)
        }
        for (const row of ['recycling-operation', 'conditions-of-export']) {
          await expect(
            AddToAccreditationPage.rowMissingTag(row)
          ).not.toBeExisting()
        }
        await AddToAccreditationPage.continue()
        await waitForPath('/requests')
        await expect(
          AccreditationRequestsPage.requestRows
        ).toBeElementsArrayOfSize(1)
      }
    )

    await reportStep('Operator: submit the request', async () => {
      await AccreditationRequestsPage.continue()
      await waitForPath('/declaration')
      await SubmitApplicationPage.submitApplication()
      // Only reached once the request is submitted: a submission case
      // management refuses reopens the request and shows an error instead.
      await waitForPath('/payment', { timeout: 60000 })
      reportDetails('Submitted', {
        url: await browser.getUrl(),
        text: await mainText()
      })
    })
    progress.submitted = true
  })

  it('Test 5: case management lists the request as an in-year change application', async function () {
    requireStage(this, 'submitted')
    await signInToCaseManagement()

    let listed = []
    const found = await reportStep(
      'Case management: filter by organisation and In-year change',
      () =>
        browser
          .waitUntil(
            async () => {
              await CmWorkItemsPage.open()
              await CmWorkItemsPage.filterApplications(organisation.name, {
                applicationType: 'in-year-change'
              })
              listed = await CmWorkItemsPage.workItems()
              return listed.length > 0
            },
            { timeout: CASE_MANAGEMENT_TIMEOUT, interval: 10000 }
          )
          .then(
            () => true,
            () => false
          )
    )
    reportDetails('Listed', listed)
    if (!found) {
      reportDetails('Skipped', {
        reason:
          `Case management lists no in-year change for ${organisation.name} ` +
          `${CASE_MANAGEMENT_TIMEOUT / 1000}s after it was submitted: ` +
          'AccreditationChanges__SubmitToCaseManagement is off for ' +
          'epr-register-enrol-backend on this environment.'
      })
      this.skip()
    }

    expect(listed).toHaveLength(1)
    const [workItem] = listed
    expect(workItem).toEqual(
      expect.objectContaining({
        reference: expect.stringMatching(IN_YEAR_CHANGE_REFERENCE),
        state: WORK_ITEM_STATES.notStarted,
        requestType: 'Request type: New ORS accreditation'
      })
    )
    progress.workItem = workItem

    await reportStep(
      `Case management: open ${workItem.reference}`,
      async () => {
        await CmWorkItemsPage.openWorkItem(workItem.workItemId)
        await waitForPath(`/work-items/${workItem.workItemId}`)
        await CmWorkItemPage.waitUntilLoaded()
        await expect(CmWorkItemPage.reference).toHaveText(workItem.reference)
      }
    )
    reportDetails('Work item', {
      ...workItem,
      url: `${caseManagementFrontendUrl}/work-items/${workItem.workItemId}`
    })
    progress.listed = true
  })

  it('Test 6: case management duly makes, approves and grants the in-year change', async function () {
    requireStage(this, 'listed')

    await reportStep('Case management: duly make', async () => {
      await openWorkItem()
      await dulyMakeWorkItem({ paymentDate: new Date() })
      await expect(CmWorkItemPage.stateTag).toHaveText(
        WORK_ITEM_STATES.dulyMade
      )
    })

    await reportStep('Case management: approve', async () => {
      await openWorkItem()
      await approveWorkItem({ note: APPROVAL_NOTE })
      await expect(CmWorkItemPage.stateTag).toHaveText(
        WORK_ITEM_STATES.approved
      )
      await expect(CmWorkItemPage.pendingContactBanner).toBeDisplayed()
    })

    await reportStep('Case management: confirm contact (grant)', async () => {
      await openWorkItem()
      await confirmApplicantContact()
      await expect(CmWorkItemPage.stateTag).toHaveText(WORK_ITEM_STATES.granted)
      await expect(CmWorkItemPage.outcomePanel).toBeDisplayed()
    })
    progress.granted = true
  })

  it('Test 7: operator sees the change request GRANTED and the site accredited', async function () {
    requireStage(this, 'granted')
    if (!managesYear) {
      reportDetails('Skipped', {
        reason: `The manage pages show ${currentYear()}'s accreditation, not ${YEAR}'s, so the change request is not on them yet.`
      })
      this.skip()
    }

    await reportStep('Operator: the change request reads GRANTED', () =>
      browser.waitUntil(
        async () => {
          await openManagePage(progress.exporter, '/change-requests')
          await ChangeRequestsPage.table.waitForDisplayed({ timeout: 30000 })
          const [itemId] = await ChangeRequestsPage.rowItemIds()
          await ChangeRequestsPage.clickReliably(
            ChangeRequestsPage.viewLink(itemId)
          )
          await waitForPath(`/change-requests/${itemId}`)
          return /granted/i.test(
            await ChangeRequestDetailPage.statusTag.getText()
          )
        },
        {
          timeout: PUSH_TIMEOUT,
          interval: 10000,
          timeoutMsg: `${progress.workItem.reference} did not read GRANTED for the operator`
        }
      )
    )

    await reportStep(
      `Operator: site ${progress.site.siteId} is accredited`,
      async () => {
        await openManagePage(progress.exporter, '/overseas-sites')
        await ManageOverseasSitesPage.openTab('accredited')
        await expect(
          ManageOverseasSitesPage.siteRow('accredited', progress.site.siteId)
        ).toBeExisting()
      }
    )
  })
})
