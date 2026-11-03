import { browser, expect, $$ } from '@wdio/globals'
import allureReporter from '@wdio/allure-reporter'
import ApplicationSubmittedPage from 'page-objects/application-submitted.page'
import CmWorkItemPage from 'page-objects/cm-work-item.page'
import CmWorkItemsPage from 'page-objects/cm-work-items.page'
import OperatorAccreditationPage from 'page-objects/operator-accreditation.page'
import QueryTaskListPage from 'page-objects/query-task-list.page'
import TaskListPage from 'page-objects/tasklist.page'
import { QUERY_SECTIONS } from 'page-objects/cm-query.page'

import { accreditationYear } from '../../config.js'
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
  addNewSiteWithInterimSites,
  addRegisteredSitesToAccreditation,
  completeIncompleteOverseasSites,
  openSeededAccreditation,
  seededRegistrations,
  startFirstApplicableAccreditation
} from '../../helpers/integration-organisation/seeded-accreditation-journey.js'
import { loadOrganisation } from '../../helpers/integration-organisation/seeded-organisation.js'
import {
  deleteCreatedOrganisation,
  recordCreatedOrganisation
} from '../../helpers/integration-organisation/seeding/created-organisations.js'
import { seedDefraLinkedOrganisation } from '../../helpers/integration-organisation/seeding/linked-organisation.js'
import { addOverseasSites } from '../../helpers/integration-organisation/seeding/overseas-sites.js'
import { registerWithRegisterEnrolDefraId } from '../../helpers/integration-organisation/seeding/register-enrol-defra-id.js'
import { logRunOrganisation } from '../../helpers/integration-organisation/seeding/run-organisations.js'
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

// The end-to-end accreditation workflow on the test environment, as the
// integration test workflow skill (.claude/integration/SKILL.md) lays it out:
//
//   Prerequisites  seed an organisation in Re-Ex approved to reprocess and
//                  export every material, linked to a new Defra ID user (whose
//                  Defra organisation holds both roles), with registered and
//                  accredited overseas sites on its paper exporter registration
//   Test 1         apply for reprocessor accreditation, record the application
//   Test 2         apply for exporter accreditation: keep the accredited
//                  overseas sites, add the registered one, and add a new site
//                  with two interim sites; record the application
//   Test 3         case management: duly make and query the reprocessor
//                  application; operator: update the queried sections and
//                  resubmit; case management: see the changes, approve it
//                  (Approved) and confirm the applicant has been contacted
//                  (Granted); operator: the application reads Granted
//   Test 4         the same for the exporter application: case management
//                  sees every overseas and interim site submitted; querying
//                  its overseas sites and BES evidence, the operator adds
//                  another site with an interim site, which case management
//                  then sees too
//   Clean up       delete the organisation
//
// The organisation, and each application as it is submitted, is attached to
// the Allure report; the run's onComplete also lists every organisation it
// touched, and whether it was deleted, in the report's Environment section.
//
// The tests share the organisation and run in order: each skips when the one
// it builds on did not get as far as it needs. Every application is appended
// to .integration/accreditation-applications.jsonl as it is submitted.
//
// Clean-up happens whether the tests pass or fail: the `after` hook runs
// either way, even when the prerequisites themselves fail part-way. The
// organisation is listed in .integration/created-organisations.jsonl the
// moment it is created, so should the `after` not get to delete it (a failed
// delete, a killed run, or KEEP_SEEDED_ORGANISATIONS=true), the end of this
// run or of a later one deletes it instead.

// Reprocessor materials to try first; then any.
const REPROCESSOR_MATERIALS = ['aluminium']
// The exporter material seeded with overseas sites, which its overseas sites
// task needs some of to keep.
const EXPORTER_MATERIAL = 'paper'
const OVERSEAS_SITES = [
  { material: EXPORTER_MATERIAL, accredited: 2, registered: 1 }
]

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

const timestamp = () => new Date().toISOString().replace(/\D/g, '').slice(0, 14)

describe(`Accreditation workflow ${accreditationYear} on a new organisation - test environment`, () => {
  let organisation
  let seededOrgId
  let defraIdUserId
  // The names of the overseas sites the organisation is seeded with.
  let seededSiteNames = []
  // By waste processing type: the registration applied for, and the
  // application's id and reference once submitted.
  const applications = {}

  /**
   * Applies for accreditation on the first of `registrations` that can be,
   * completes every task, submits, and records the application.
   *
   * @param {object} options
   * @param {boolean} options.isExporter
   * @param {(applicationId: string) => Promise<{material: string, overseasSiteNames?: string[]}>} [options.completeTasks]
   *   completes the tasks, from the task list back to it; by default each
   *   outstanding task as completeOutstandingTasks does it
   */
  async function applyForAccreditation(
    registrations,
    {
      isExporter,
      completeTasks = async () => ({
        material: await completeOutstandingTasks({ isExporter })
      })
    }
  ) {
    const { registration, applicationId } =
      await startFirstApplicableAccreditation(registrations, { organisation })

    const { material, overseasSiteNames = [] } =
      await completeTasks(applicationId)
    await TaskListPage.assertAllTasksCompleted({ isExporter })
    await TaskListPage.continueToSubmit()

    await submitAndAssertConfirmation(material)
    const applicationReference =
      await ApplicationSubmittedPage.referenceNumber.getText()

    recordAccreditationApplication({
      orgId: organisation.orgId,
      organisationId: organisation.id,
      defraIdEmail: organisation.email,
      defraIdUserId,
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
    allureReporter.addAttachment(
      `${registration.wasteProcessingType} application`,
      JSON.stringify(
        {
          applicationId,
          applicationReference,
          material: registration.glassRecyclingProcess ?? registration.material,
          registrationNumber: registration.registrationNumber,
          orgId: organisation.orgId,
          ...(overseasSiteNames.length && { overseasSiteNames })
        },
        null,
        2
      ),
      'application/json'
    )
  }

  /**
   * Exporter tasks: the others first, as the overseas sites task only opens
   * once they are done. Then the overseas sites: the accredited ones the
   * organisation is seeded with are kept and completed, the registered one is
   * added, and a new site is added with its interim sites. Then BES evidence,
   * which the new site, outside the EU and OECD, needs.
   */
  async function completeExporterTasks(applicationId) {
    const material = await completeOutstandingTasks({ isExporter: false })

    const added = await addRegisteredSitesToAccreditation(applicationId)
    expect(added).toHaveLength(OVERSEAS_SITES[0].registered)
    await completeIncompleteOverseasSites(applicationId)
    await expect($$('[data-testid*="-incomplete-"]')).toBeElementsArrayOfSize(0)

    const { interimSites } = await addNewSiteWithInterimSites(applicationId, {
      site: SUBMISSION_SITE,
      interimSite: SUBMISSION_INTERIM_SITE,
      interimSiteCount: SUBMISSION_INTERIM_SITE_COUNT
    })
    expect(interimSites).toHaveLength(SUBMISSION_INTERIM_SITE_COUNT)
    process.stdout.write(
      `Added overseas site ${SUBMISSION_SITE.name} with interim sites ` +
        `${interimSites.map(({ name, orsId }) => `${name} (ORS ${orsId})`).join(', ')}\n`
    )

    await confirmOverseasSites()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )
    await expect(TaskListPage.overseasSitesStatus).toHaveText('COMPLETED')
    // What is left: BES evidence.
    await completeOutstandingTasks({ isExporter: true })

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
    await signInToCaseManagement()
    const workItem = await findWorkItem({
      organisation: organisation.name,
      applicantType,
      state: WORK_ITEM_STATES.notStarted,
      reference: application.applicationReference
    })
    await CmWorkItemsPage.openWorkItem(workItem.workItemId)
    await CmWorkItemPage.waitUntilLoaded()
    await checkWorkItem()

    await dulyMakeWorkItem({ paymentDate: new Date() })
    await expect(CmWorkItemPage.stateTag).toHaveText(WORK_ITEM_STATES.dulyMade)

    await queryWorkItem({
      sections,
      reason: 'Please review and update the queried sections.'
    })
    await expect(CmWorkItemPage.stateTag).toHaveText(WORK_ITEM_STATES.queried)
    return workItem.workItemId
  }

  /**
   * Operator: signs in as the organisation's Defra ID user and opens the
   * queried application's query task list, checking `queriedTasks` (query
   * task list test ids) are the ones open to update.
   */
  async function openQueriedApplication(application, queriedTasks) {
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

  /** Operator: resubmits, and the application moves on to Updated. */
  async function resubmit() {
    await resubmitApplication()
    await expect(OperatorAccreditationPage.applicationStatus).toHaveText(
      'UPDATED'
    )
  }

  /** Case management: reopens the work item, now Updated. */
  async function reopenUpdatedWorkItem(workItemId) {
    await signInToCaseManagement()
    await CmWorkItemPage.open(workItemId)
    await CmWorkItemPage.waitUntilLoaded()
    await expect(CmWorkItemPage.stateTag).toHaveText(WORK_ITEM_STATES.updated)
  }

  /**
   * Case management: the two-step determination. Approving leaves the work
   * item Approved, pending contact; confirming the applicant has been
   * contacted then grants it.
   */
  async function approveAndConfirmContact() {
    await approveWorkItem({ note: APPROVAL_NOTE })
    await expect(CmWorkItemPage.stateTag).toHaveText(WORK_ITEM_STATES.approved)
    await expect(CmWorkItemPage.pendingContactBanner).toBeDisplayed()

    await confirmApplicantContact()
    await expect(CmWorkItemPage.stateTag).toHaveText(WORK_ITEM_STATES.granted)
    await expect(CmWorkItemPage.flashBanner).toHaveText(
      expect.stringContaining(
        'The applicant has been contacted and accreditation is granted.'
      )
    )
    await expect(CmWorkItemPage.pendingContactBanner).not.toBeExisting()
    await expect(CmWorkItemPage.decisionMetadata).toBeDisplayed()
  }

  /**
   * Operator: the application reads Granted on its landing page. Case
   * management pushes the status to the operator side, so it is read again
   * until it arrives.
   */
  async function expectGrantedForOperator(application) {
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

  before(async function () {
    if (process.env.ENVIRONMENT !== 'test') {
      this.skip()
    }

    // ── Prerequisites ───────────────────────────────────────────────────────
    const email = `reex-operator-${timestamp()}@example.com`
    // Recorded for clean-up the moment it exists, so the `after` below (or,
    // failing that, the end of the run) deletes it even when the rest of the
    // seeding fails.
    const seeded = await seedDefraLinkedOrganisation({
      email,
      onCreated: ({ orgId, refNo }) => {
        seededOrgId = orgId
        recordCreatedOrganisation({
          orgId,
          id: refNo,
          email,
          defraOrganisation: null
        })
      }
    })
    logRunOrganisation('linked', {
      orgId: seeded.orgId,
      id: seeded.refNo,
      email,
      defraOrganisation: { id: seeded.defraOrgId, name: seeded.defraOrgName }
    })
    defraIdUserId = seeded.defraUserId
    allureReporter.addAttachment(
      'Organisation',
      JSON.stringify(
        {
          orgId: seeded.orgId,
          id: seeded.refNo,
          environment: process.env.ENVIRONMENT,
          defraIdEmail: email,
          defraIdUserId: seeded.defraUserId,
          defraOrganisation: {
            id: seeded.defraOrgId,
            name: seeded.defraOrgName
          }
        },
        null,
        2
      ),
      'application/json'
    )
    process.stdout.write(
      `Seeded organisation ${seeded.orgId} (${seeded.refNo}) linked to Defra ID ` +
        `user ${email} and organisation ${seeded.defraOrgId}\n`
    )

    seededSiteNames = (
      await addOverseasSites(seeded.refNo, OVERSEAS_SITES)
    ).map(({ name }) => name)
    organisation = await loadOrganisation(seeded.refNo)
    // The accreditation journey signs in again through
    // epr-register-enrol-frontend's own Defra ID stub.
    await registerWithRegisterEnrolDefraId(
      organisation.email,
      organisation.defraOrganisation
    )

    const exporter = organisation.registrations.find(
      (registration) =>
        registration.wasteProcessingType === 'exporter' &&
        registration.material === EXPORTER_MATERIAL
    )
    expect(Object.keys(exporter.overseasSites)).toHaveLength(
      OVERSEAS_SITES[0].accredited + OVERSEAS_SITES[0].registered
    )
  })

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

  it('Test 3: should query, update and grant the reprocessor application', async function () {
    const application = applications.reprocessor
    if (!application) {
      this.skip()
    }

    const workItemId = await dulyMakeAndQuery(application, 'Reprocessor', [
      QUERY_SECTIONS.businessPlan,
      QUERY_SECTIONS.samplingPlan
    ])

    await openQueriedApplication(application, [
      'task-business-plan',
      'task-sampling-plan'
    ])
    await updateQueriedBusinessPlan(UPDATED_BUSINESS_PLAN)
    await updateQueriedSamplingPlan(UPDATED_SAMPLING_PLAN)
    await resubmit()

    await reopenUpdatedWorkItem(workItemId)
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

    await approveAndConfirmContact()
    await expectGrantedForOperator(application)
  })

  it('Test 4: should query, update and grant the exporter application', async function () {
    const application = applications.exporter
    if (!application) {
      this.skip()
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
    // Required for the query's new site, outside the EU and OECD.
    await uploadOutstandingBesEvidence()
    await resubmit()

    await reopenUpdatedWorkItem(workItemId)
    // The site and interim site the query added, beside the ones submitted.
    await expectOverseasSitesInCaseManagement([
      ...submittedSiteNames,
      QUERY_SITE.name,
      QUERY_INTERIM_SITE.name
    ])
    await expect(CmWorkItemPage.besValue).toHaveText(
      expect.stringContaining(QUERY_SITE.name)
    )

    await approveAndConfirmContact()
    await expectGrantedForOperator(application)
  })

  // ── Clean up ────────────────────────────────────────────────────────────
  after(async () => {
    if (!seededOrgId) {
      return
    }
    if (process.env.KEEP_SEEDED_ORGANISATIONS === 'true') {
      process.stdout.write(
        `KEEP_SEEDED_ORGANISATIONS is set: keeping organisation ${seededOrgId}\n`
      )
      return
    }
    await deleteCreatedOrganisation(seededOrgId)
    process.stdout.write(`Deleted organisation ${seededOrgId}\n`)
  })
})
