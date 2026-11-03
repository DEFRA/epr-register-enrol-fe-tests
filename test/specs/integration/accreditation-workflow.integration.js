import { browser, expect, $$ } from '@wdio/globals'
import ApplicationSubmittedPage from 'page-objects/application-submitted.page'
import CmWorkItemPage from 'page-objects/cm-work-item.page'
import CmWorkItemsPage from 'page-objects/cm-work-items.page'
import OperatorAccreditationPage from 'page-objects/operator-accreditation.page'
import QueryTaskListPage from 'page-objects/query-task-list.page'
import TaskListPage from 'page-objects/tasklist.page'
import { QUERY_SECTIONS } from 'page-objects/cm-query.page'

import { accreditationYear, caseManagementFrontendUrl } from '../../config.js'
import { createAccessibilityAudit } from '../../helpers/accessibility.js'
import {
  WORK_ITEM_STATES,
  approveWorkItem,
  confirmApplicantContact,
  dulyMakeWorkItem,
  findWorkItem,
  queryWorkItem,
  signInToCaseManagement
} from '../../helpers/case-management-journey.js'
import {
  ACCREDITATION_APPLICATIONS_FILE,
  recordAccreditationApplication
} from '../../helpers/integration-organisation/accreditation-applications.js'
import {
  hasSeededOrganisation,
  seededOrganisation
} from '../../helpers/integration-organisation/index.js'
import {
  addNewSiteWithInterimSites,
  addRegisteredSitesToAccreditation,
  completeIncompleteOverseasSites,
  openSeededAccreditation,
  seededRegistrations,
  startFirstApplicableAccreditation
} from '../../helpers/integration-organisation/seeded-accreditation-journey.js'
import {
  addOverseasSiteWithInterimSite,
  confirmOverseasSites,
  resubmitApplication,
  updateQueriedBusinessPlan,
  updateQueriedSamplingPlan,
  uploadOutstandingBesEvidence
} from '../../helpers/query-response-journey.js'
import {
  completeOutstandingTasks,
  submitAndAssertConfirmation
} from '../../helpers/reex-reaccreditation.js'
import { reportDetails, reportStep } from '../../helpers/report-step.js'

// The end-to-end accreditation workflow on the test environment, as the
// integration test workflow skill (.claude/integration/SKILL.md) lays it out:
//
//   Prerequisites  the organisation seeded for the run (onPrepare, see
//                  integration-organisation/hooks.js): approved in Re-Ex to
//                  reprocess and export every material, linked to a new Defra
//                  ID user (whose Defra organisation holds both roles), with
//                  registered and accredited overseas sites on its paper
//                  exporter registration
//   Test 1         apply for reprocessor accreditation, record the application
//   Test 2         apply for exporter accreditation: keep the accredited
//                  overseas sites, add the registered one, and add a new site
//                  with two interim sites; record the application
//   Accessibility  every page Tests 1 and 2 reached, checked as they reached
//                  it, has no WCAG 2.1 A/AA violations: one test for each
//                  journey, so a violation does not stop the journey itself
//   Test 3        case management: duly make and query the reprocessor
//                  application; operator: update the queried sections and
//                  resubmit; case management: see the changes, approve it
//                  (Approved) and confirm the applicant has been contacted
//                  (Granted); operator: the application reads Granted
//   Test 4         the same for the exporter application: case management
//                  sees every overseas and interim site submitted; querying
//                  its overseas sites and BES evidence, the operator adds
//                  another site with an interim site, which case management
//                  then sees too
//
// So the run submits one reprocessor and one exporter application, and works
// both through case management. It is the only spec that submits on test (see
// wdio.integration.conf.js), and the run's onComplete deletes the organisation.
//
// Each step of the journey is a step in the Allure report, with a screenshot
// and the page's URL on the one that failed. The organisation, each
// application as it is submitted and each work item as it is found are
// attached too; the run's onComplete also lists the organisation, and whether
// it was deleted, in the report's Environment section.
//
// The tests share the organisation and run in order: each skips, saying why,
// when the one it builds on did not get as far as it needs. Every application
// is appended to .integration/accreditation-applications.jsonl as it is
// submitted.

// Reprocessor materials to try first; then any.
const REPROCESSOR_MATERIALS = ['aluminium']
// The exporter material seeded with overseas sites, which its overseas sites
// task needs some of to keep, and how many of each: as seeded-organisation.js
// seeds them.
const EXPORTER_MATERIAL = 'paper'
const EXPORTER_SITES = { accredited: 2, registered: 1 }

// Test 3's query response: a different spending split from the one the
// application was submitted with, and a further sampling plan whose name case
// management can be checked for.
const UPDATED_BUSINESS_PLAN = [25, 25, 20, 10, 10, 5, 5]
const UPDATED_SAMPLING_PLAN = 'sampling-plan-query-response'

// Test 2: the new overseas site added when applying, and its interim sites
// (named after SUBMISSION_INTERIM_SITE, numbered from 1).
const SUBMISSION_SITE = {
  name: 'Penang Paper Reprocessing Sdn Bhd',
  location: {
    addressLine1: '8 Jalan Perusahaan',
    townOrCity: 'George Town',
    country: 'Malaysia',
    coordinates: '5.4141, 100.3288'
  },
  contact: {
    name: 'Mei Ling Tan',
    email: 'meiling.tan@example.com',
    phone: '+60 4 123 4567'
  }
}
const SUBMISSION_INTERIM_SITE = {
  country: 'Malaysia',
  name: 'Penang Interim Storage Yard',
  location: {
    addressLine1: '21 Lorong Pelabuhan',
    townOrCity: 'George Town',
    stateOrRegion: 'Penang',
    postcode: '10300'
  },
  contact: {
    name: 'Ahmad Rahman',
    email: 'ahmad.rahman@example.com',
    phone: '+60 4 765 4321'
  }
}
const SUBMISSION_INTERIM_SITE_COUNT = 2

// Test 4's query response: a further overseas site with an interim site.
const QUERY_SITE = {
  name: 'Mumbai Paper Reprocessing Pvt Ltd',
  location: {
    addressLine1: '12 Dockside Road',
    townOrCity: 'Mumbai',
    country: 'India',
    coordinates: '19.0760, 72.8777'
  },
  contact: {
    name: 'Priya Sharma',
    email: 'priya.sharma@example.com',
    phone: '+91 22 1234 5678'
  }
}
const QUERY_INTERIM_SITE = {
  country: 'India',
  name: 'Mumbai Interim Storage Depot',
  location: {
    addressLine1: '44 Harbour Way',
    townOrCity: 'Mumbai',
    stateOrRegion: 'Maharashtra',
    postcode: '400001'
  },
  contact: {
    name: 'Ravi Patel',
    email: 'ravi.patel@example.com',
    phone: '+91 22 8765 4321'
  }
}

const APPROVAL_NOTE = 'All queried sections were updated and are satisfactory.'

describe(`Accreditation workflow ${accreditationYear} on the run's organisation - test environment`, () => {
  let organisation
  // The names of the paper exporter's overseas sites the organisation is
  // seeded with.
  let seededSiteNames = []
  // By waste processing type: the registration applied for, and the
  // application's id and reference once submitted.
  const applications = {}
  // By waste processing type: each page the submission journey reaches is
  // checked for accessibility, once, the first time it is reached.
  const audits = {
    reprocessor: createAccessibilityAudit(),
    exporter: createAccessibilityAudit()
  }

  /**
   * Applies for accreditation on the first of `registrations` that can be,
   * completes every task, submits, and records the application.
   *
   * @param {object} options
   * @param {boolean} options.isExporter
   * @param {(applicationId: string, checkPage: (pageName: string) => Promise<void>) => Promise<{material: string, overseasSiteNames?: string[]}>} [options.completeTasks]
   *   completes the tasks, from the task list back to it, checking each page
   *   with `checkPage`; by default each outstanding task as
   *   completeOutstandingTasks does it
   */
  async function applyForAccreditation(
    registrations,
    {
      isExporter,
      completeTasks = async (_applicationId, checkPage) => ({
        material: await completeOutstandingTasks({ isExporter, checkPage })
      })
    }
  ) {
    const type = isExporter ? 'exporter' : 'reprocessor'
    const checkPage = (pageName) => audits[type].check(pageName)
    const { registration, applicationId } = await reportStep(
      `Operator: start a ${type} application`,
      async () => {
        const started = await startFirstApplicableAccreditation(registrations, {
          organisation
        })
        reportDetails(`${type} application started`, {
          applicationId: started.applicationId,
          material:
            started.registration.glassRecyclingProcess ??
            started.registration.material,
          registrationNumber: started.registration.registrationNumber
        })
        return started
      }
    )

    const { material, overseasSiteNames = [] } = await reportStep(
      `Operator: complete every ${type} task`,
      async () => {
        const completed = await completeTasks(applicationId, checkPage)
        await TaskListPage.assertAllTasksCompleted({ isExporter })
        return completed
      }
    )

    const applicationReference = await reportStep(
      `Operator: submit the ${type} application`,
      async () => {
        await TaskListPage.continueToSubmit()
        await submitAndAssertConfirmation(material, { checkPage })
        return ApplicationSubmittedPage.referenceNumber.getText()
      }
    )

    recordAccreditationApplication({
      orgId: organisation.orgId,
      organisationId: organisation.id,
      defraIdEmail: organisation.email,
      defraIdUserId: organisation.defraUserId ?? null,
      defraOrganisation: organisation.defraOrganisation,
      wasteProcessingType: registration.wasteProcessingType,
      material: registration.glassRecyclingProcess ?? registration.material,
      registrationNumber: registration.registrationNumber,
      applicationId,
      applicationReference
    })
    process.stdout.write(
      `${registration.wasteProcessingType} application ${applicationReference} ` +
        `(${applicationId}) recorded in ${ACCREDITATION_APPLICATIONS_FILE}\n`
    )
    applications[registration.wasteProcessingType] = {
      registration,
      applicationId,
      applicationReference,
      overseasSiteNames
    }
    reportDetails(`${registration.wasteProcessingType} application submitted`, {
      applicationId,
      applicationReference,
      material: registration.glassRecyclingProcess ?? registration.material,
      registrationNumber: registration.registrationNumber,
      orgId: organisation.orgId,
      organisationName: organisation.name,
      ...(overseasSiteNames.length && { overseasSiteNames })
    })
  }

  /**
   * Exporter tasks: the others first, as the overseas sites task only opens
   * once they are done. Then the overseas sites: the accredited ones the
   * organisation is seeded with are kept and completed, the registered one is
   * added, and a new site is added with its interim sites. Then BES evidence,
   * which the new site, outside the EU and OECD, needs.
   */
  async function completeExporterTasks(applicationId, checkPage) {
    const material = await completeOutstandingTasks({
      isExporter: false,
      checkPage
    })

    const added = await addRegisteredSitesToAccreditation(applicationId, {
      checkPage
    })
    expect(added).toHaveLength(EXPORTER_SITES.registered)
    await completeIncompleteOverseasSites(applicationId, { checkPage })
    await expect($$('[data-testid*="-incomplete-"]')).toBeElementsArrayOfSize(0)

    const { interimSites } = await addNewSiteWithInterimSites(applicationId, {
      site: SUBMISSION_SITE,
      interimSite: SUBMISSION_INTERIM_SITE,
      interimSiteCount: SUBMISSION_INTERIM_SITE_COUNT,
      checkPage
    })
    expect(interimSites).toHaveLength(SUBMISSION_INTERIM_SITE_COUNT)
    process.stdout.write(
      `Added overseas site ${SUBMISSION_SITE.name} with interim sites ` +
        `${interimSites.map(({ name, orsId }) => `${name} (ORS ${orsId})`).join(', ')}\n`
    )

    await confirmOverseasSites({ checkPage })
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )
    await expect(TaskListPage.overseasSitesStatus).toHaveText('COMPLETED')
    // What is left: BES evidence.
    await completeOutstandingTasks({ isExporter: true, checkPage })

    return {
      material,
      overseasSiteNames: [
        SUBMISSION_SITE.name,
        ...interimSites.map(({ name }) => name)
      ]
    }
  }

  /** Case management: the work item's overseas sites include every one of `names`. */
  async function expectOverseasSitesInCaseManagement(names) {
    const overseasSitesText = await CmWorkItemPage.overseasSitesText()
    for (const name of names) {
      expect(overseasSitesText).toContain(name)
    }
  }

  /**
   * Case management: finds the application's work item, runs `checkWorkItem`
   * on it, duly makes it and queries `sections`. Leaves the browser on the
   * work item, now Queried.
   *
   * @returns {Promise<string>} the work item id
   */
  async function dulyMakeAndQuery(
    application,
    applicantType,
    sections,
    checkWorkItem = async () => {}
  ) {
    const workItem = await reportStep(
      `Case management: find the ${applicantType} work item ` +
        `${application.applicationReference} (${WORK_ITEM_STATES.notStarted}) ` +
        `for ${organisation.name}`,
      async () => {
        await signInToCaseManagement()
        const found = await findWorkItem({
          organisation: organisation.name,
          applicantType,
          state: WORK_ITEM_STATES.notStarted,
          reference: application.applicationReference
        })
        reportDetails(`${applicantType} work item`, {
          ...found,
          url: `${caseManagementFrontendUrl}/work-items/${found.workItemId}`
        })
        await CmWorkItemsPage.openWorkItem(found.workItemId)
        await CmWorkItemPage.waitUntilLoaded()
        await checkWorkItem()
        return found
      }
    )

    await reportStep('Case management: duly make the work item', async () => {
      await dulyMakeWorkItem({ paymentDate: new Date() })
      await expect(CmWorkItemPage.stateTag).toHaveText(
        WORK_ITEM_STATES.dulyMade
      )
    })

    await reportStep(
      `Case management: query ${sections.join(', ')}`,
      async () => {
        await queryWorkItem({
          sections,
          reason: 'Please review and update the queried sections.'
        })
        await expect(CmWorkItemPage.stateTag).toHaveText(
          WORK_ITEM_STATES.queried
        )
      }
    )
    return workItem.workItemId
  }

  /**
   * Operator: signs in as the organisation's Defra ID user and opens the
   * queried application's query task list, checking `queriedTasks` (query
   * task list test ids) are the ones open to update.
   */
  async function openQueriedApplication(application, queriedTasks) {
    await reportStep(
      `Operator: open the queried application ${application.applicationReference}`,
      async () => {
        const status = await openSeededAccreditation(
          application.registration,
          organisation
        )
        expect(status).toBe('QUERIED')
        // The landing page, to come back to once the application is granted,
        // when the registration may no longer offer the hand-off link to it.
        application.landingUrl = await browser.getUrl()
        await OperatorAccreditationPage.clickContinue()
        await expect(browser).toHaveUrl(
          expect.stringContaining('/accreditation/query-task-list/')
        )
        for (const task of queriedTasks) {
          await expect(QueryTaskListPage.taskTag(task)).toHaveText('QUERIED')
        }
      }
    )
  }

  /** Operator: resubmits, and the application moves on to Updated. */
  async function resubmit() {
    await reportStep('Operator: resubmit the application', async () => {
      await resubmitApplication()
      await expect(OperatorAccreditationPage.applicationStatus).toHaveText(
        'UPDATED'
      )
    })
  }

  /** Case management: reopens the work item, now Updated. */
  async function reopenUpdatedWorkItem(workItemId) {
    await reportStep(
      `Case management: reopen work item ${workItemId}, now ${WORK_ITEM_STATES.updated}`,
      async () => {
        await signInToCaseManagement()
        await CmWorkItemPage.open(workItemId)
        await CmWorkItemPage.waitUntilLoaded()
        await expect(CmWorkItemPage.stateTag).toHaveText(
          WORK_ITEM_STATES.updated
        )
      }
    )
  }

  /**
   * Case management: the two-step determination. Approving leaves the work
   * item Approved, pending contact; confirming the applicant has been
   * contacted then grants it.
   */
  async function approveAndConfirmContact() {
    await reportStep('Case management: approve the work item', async () => {
      await approveWorkItem({ note: APPROVAL_NOTE })
      await expect(CmWorkItemPage.stateTag).toHaveText(
        WORK_ITEM_STATES.approved
      )
      await expect(CmWorkItemPage.pendingContactBanner).toBeDisplayed()
    })

    await reportStep(
      'Case management: confirm the applicant has been contacted',
      async () => {
        await confirmApplicantContact()
        await expect(CmWorkItemPage.stateTag).toHaveText(
          WORK_ITEM_STATES.granted
        )
        await expect(CmWorkItemPage.flashBanner).toHaveText(
          expect.stringContaining(
            'The applicant has been contacted and accreditation is granted.'
          )
        )
        await expect(CmWorkItemPage.pendingContactBanner).not.toBeExisting()
        await expect(CmWorkItemPage.decisionMetadata).toBeDisplayed()
      }
    )
  }

  /**
   * Operator: the application reads Granted on its landing page. Case
   * management pushes the status to the operator side, so it is read again
   * until it arrives.
   */
  async function expectGrantedForOperator(application) {
    await reportStep(
      `Operator: the application ${application.applicationReference} reads GRANTED`,
      () => waitUntilGrantedForOperator(application)
    )
  }

  async function waitUntilGrantedForOperator(application) {
    let status
    await browser.waitUntil(
      async () => {
        status = await openSeededAccreditation(
          application.registration,
          organisation
        )
        if (status === null) {
          await browser.url(application.landingUrl)
          await OperatorAccreditationPage.applicationStatus.waitForDisplayed({
            timeout: 30000
          })
          status = await OperatorAccreditationPage.applicationStatus.getText()
        }
        return status.includes('GRANTED')
      },
      {
        timeout: 2 * 60 * 1000,
        interval: 10000,
        timeoutMsg: `${application.applicationReference} did not read GRANTED for the operator`
      }
    )
    await expect(OperatorAccreditationPage.applicationStatus).toHaveText(
      expect.stringContaining('GRANTED')
    )
  }

  // ── Prerequisites ─────────────────────────────────────────────────────────
  // The organisation onPrepare seeded, and registered with
  // epr-register-enrol-frontend's own Defra ID stub, for the run.
  before(function () {
    if (!hasSeededOrganisation()) {
      this.skip()
    }
    organisation = seededOrganisation()

    const exporter = organisation.registrations.find(
      (registration) =>
        registration.wasteProcessingType === 'exporter' &&
        registration.material === EXPORTER_MATERIAL
    )
    seededSiteNames = exporter.overseasSiteNames ?? []
    reportDetails('Organisation', {
      orgId: organisation.orgId,
      id: organisation.id,
      name: organisation.name,
      environment: process.env.ENVIRONMENT,
      defraIdEmail: organisation.email,
      defraIdUserId: organisation.defraUserId ?? null,
      defraOrganisation: organisation.defraOrganisation,
      paperExporterOverseasSites: seededSiteNames
    })
    expect(Object.keys(exporter.overseasSites)).toHaveLength(
      EXPORTER_SITES.accredited + EXPORTER_SITES.registered
    )
  })

  /** Skips the test, saying why in the console and the report. */
  function skipBecause(context, reason) {
    reportDetails('Skipped', { reason })
    context.skip()
  }

  it('Test 1: should apply for reprocessor accreditation', async () => {
    await applyForAccreditation(
      seededRegistrations('reprocessor', REPROCESSOR_MATERIALS, organisation),
      { isExporter: false }
    )
  })

  it('Test 2: should apply for exporter accreditation', async () => {
    // Paper only: it is the one seeded with the overseas sites the journey
    // adds to and builds on, so falling back to another material would only
    // fail later, and less clearly.
    await applyForAccreditation(
      seededRegistrations('exporter', [EXPORTER_MATERIAL], organisation).filter(
        ({ material }) => material === EXPORTER_MATERIAL
      ),
      { isExporter: true, completeTasks: completeExporterTasks }
    )
  })

  for (const [type, test] of [
    ['reprocessor', 'Test 1'],
    ['exporter', 'Test 2']
  ]) {
    it(`should have no accessibility violations on the ${type} submission pages`, function () {
      const audit = audits[type]
      if (audit.checkedPages.length === 0) {
        skipBecause(this, `${test} reached no page to check`)
      }
      reportDetails(`${type} pages checked for accessibility`, {
        pages: audit.checkedPages
      })
      audit.assertNoViolations()
    })
  }

  it('Test 3: should query, update and grant the reprocessor application', async function () {
    const application = applications.reprocessor
    if (!application) {
      skipBecause(this, 'Test 1 did not submit a reprocessor application')
    }

    const workItemId = await dulyMakeAndQuery(application, 'Reprocessor', [
      QUERY_SECTIONS.businessPlan,
      QUERY_SECTIONS.samplingPlan
    ])

    await openQueriedApplication(application, [
      'task-business-plan',
      'task-sampling-plan'
    ])
    await reportStep(
      'Operator: update the queried business plan and sampling plan',
      async () => {
        await updateQueriedBusinessPlan(UPDATED_BUSINESS_PLAN)
        await updateQueriedSamplingPlan(UPDATED_SAMPLING_PLAN)
      }
    )
    await resubmit()

    await reopenUpdatedWorkItem(workItemId)
    await reportStep(
      'Case management: the updated business plan and sampling plan show',
      async () => {
        await expect(
          $('[data-testid="app-detail-value-business-plan"]')
        ).toHaveText(
          expect.stringContaining(
            `New infrastructure — ${UPDATED_BUSINESS_PLAN[0]}% of PRN income`
          )
        )
        await expect(
          $('[data-testid="app-detail-value-sampling-inspection-plan"]')
        ).toHaveText(expect.stringContaining(UPDATED_SAMPLING_PLAN))
      }
    )

    await approveAndConfirmContact()
    await expectGrantedForOperator(application)
  })

  it('Test 4: should query, update and grant the exporter application', async function () {
    const application = applications.exporter
    if (!application) {
      skipBecause(this, 'Test 2 did not submit an exporter application')
    }

    // Every site submitted: those seeded, and the new one and its interim
    // sites.
    const submittedSiteNames = [
      ...seededSiteNames,
      ...application.overseasSiteNames
    ]
    const workItemId = await dulyMakeAndQuery(
      application,
      'Exporter',
      [QUERY_SECTIONS.overseasSites, QUERY_SECTIONS.bes],
      () => expectOverseasSitesInCaseManagement(submittedSiteNames)
    )

    await openQueriedApplication(application, [
      'task-overseas-sites',
      'task-bes-evidence'
    ])
    await reportStep(
      `Operator: add overseas site ${QUERY_SITE.name} with interim site ${QUERY_INTERIM_SITE.name}`,
      async () => {
        await QueryTaskListPage.taskLink('task-overseas-sites').click()
        await expect(browser).toHaveUrl(
          expect.stringContaining('/accreditation/select-overseas-sites')
        )
        await addOverseasSiteWithInterimSite({
          site: QUERY_SITE,
          interimSite: QUERY_INTERIM_SITE,
          additionalCodes: ['R12', 'R13'],
          interimRecyclingOperationCodes: ['R12', 'R13']
        })
        await confirmOverseasSites()
        await expect(browser).toHaveUrl(
          expect.stringContaining('/accreditation/query-task-list/')
        )
      }
    )
    // Required for the query's new site, outside the EU and OECD.
    await reportStep('Operator: upload the outstanding BES evidence', () =>
      uploadOutstandingBesEvidence()
    )
    await resubmit()

    await reopenUpdatedWorkItem(workItemId)
    await reportStep(
      'Case management: the overseas sites and BES evidence the query added show',
      async () => {
        // The site and interim site the query added, beside the ones
        // submitted.
        await expectOverseasSitesInCaseManagement([
          ...submittedSiteNames,
          QUERY_SITE.name,
          QUERY_INTERIM_SITE.name
        ])
        await expect(CmWorkItemPage.besValue).toHaveText(
          expect.stringContaining(QUERY_SITE.name)
        )
      }
    )

    await approveAndConfirmContact()
    await expectGrantedForOperator(application)
  })
})
