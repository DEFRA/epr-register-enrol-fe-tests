import { browser, expect } from '@wdio/globals'
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
  openSeededAccreditation,
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
//   Test 2         apply for exporter accreditation, record the application
//   Test 3         case management: duly make and query the reprocessor
//                  application; operator: update the queried sections and
//                  resubmit; case management: see the changes, approve it
//                  (Approved) and confirm the applicant has been contacted
//                  (Granted); operator: the application reads Granted
//   Test 4         the same for the exporter application, querying its
//                  overseas sites and BES evidence
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

// Test 4's query response.
const NEW_SITE = {
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
const INTERIM_SITE = {
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

// Registrations of one waste processing type, `preferred` materials first.
function registrationsToTry(organisation, wasteProcessingType, preferred) {
  const rank = (registration) => {
    const index = preferred.indexOf(registration.material)
    return index === -1 ? preferred.length : index
  }
  return organisation.registrations
    .filter(
      (registration) => registration.wasteProcessingType === wasteProcessingType
    )
    .sort((a, b) => rank(a) - rank(b))
}

describe(`Accreditation workflow ${accreditationYear} on a new organisation - test environment`, () => {
  let organisation
  let seededOrgId
  let defraIdUserId
  // By waste processing type: the registration applied for, and the
  // application's id and reference once submitted.
  const applications = {}

  /**
   * Applies for accreditation on the first of `registrations` that can be,
   * completes every task, submits, and records the application.
   */
  async function applyForAccreditation(registrations, { isExporter }) {
    const { registration, applicationId } =
      await startFirstApplicableAccreditation(registrations, { organisation })

    const material = await completeOutstandingTasks({ isExporter })
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
      applicationReference
    }
    allureReporter.addAttachment(
      `${registration.wasteProcessingType} application`,
      JSON.stringify(
        {
          applicationId,
          applicationReference,
          material: registration.glassRecyclingProcess ?? registration.material,
          registrationNumber: registration.registrationNumber,
          orgId: organisation.orgId
        },
        null,
        2
      ),
      'application/json'
    )
  }

  /**
   * Case management: finds the application's work item, duly makes it and
   * queries `sections`. Leaves the browser on the work item, now Queried.
   *
   * @returns {Promise<string>} the work item id
   */
  async function dulyMakeAndQuery(application, applicantType, sections) {
    await signInToCaseManagement()
    const workItem = await findWorkItem({
      organisation: organisation.name,
      applicantType,
      state: WORK_ITEM_STATES.notStarted,
      reference: application.applicationReference
    })
    await CmWorkItemsPage.openWorkItem(workItem.workItemId)
    await CmWorkItemPage.waitUntilLoaded()

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

    await addOverseasSites(seeded.refNo, OVERSEAS_SITES)
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
      registrationsToTry(organisation, 'reprocessor', REPROCESSOR_MATERIALS),
      { isExporter: false }
    )
  })

  it('Test 2: should apply for exporter accreditation', async () => {
    await applyForAccreditation(
      registrationsToTry(organisation, 'exporter', [EXPORTER_MATERIAL]),
      { isExporter: true }
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

    const workItemId = await dulyMakeAndQuery(application, 'Exporter', [
      QUERY_SECTIONS.overseasSites,
      QUERY_SECTIONS.bes
    ])

    await openQueriedApplication(application, [
      'task-overseas-sites',
      'task-bes-evidence'
    ])
    await QueryTaskListPage.taskLink('task-overseas-sites').click()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/select-overseas-sites')
    )
    await addOverseasSiteWithInterimSite({
      site: NEW_SITE,
      interimSite: INTERIM_SITE,
      additionalCodes: ['R12', 'R13'],
      interimRecyclingOperationCodes: ['R12', 'R13']
    })
    await confirmOverseasSites()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/query-task-list/')
    )
    // Required for the new site, outside the EU and OECD.
    await uploadOutstandingBesEvidence()
    await resubmit()

    await reopenUpdatedWorkItem(workItemId)
    const overseasSitesText = await CmWorkItemPage.overseasSitesText()
    expect(overseasSitesText).toContain(NEW_SITE.name)
    expect(overseasSitesText).toContain(INTERIM_SITE.name)
    await expect(CmWorkItemPage.besValue).toHaveText(
      expect.stringContaining(NEW_SITE.name)
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
