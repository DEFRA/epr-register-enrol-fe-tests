import { browser, expect } from '@wdio/globals'
import CmWorkItemPage from 'page-objects/cm-work-item.page'
import CmWorkItemsPage from 'page-objects/cm-work-items.page'
import OperatorAccreditationPage from 'page-objects/operator-accreditation.page'
import QueryTaskListPage from 'page-objects/query-task-list.page'
import { QUERY_SECTIONS } from 'page-objects/cm-query.page'

import {
  WORK_ITEM_STATES,
  approveWorkItem,
  caseManagementDate,
  changeDeterminationDeadline,
  changePaymentDate,
  confirmApplicantContact,
  continueReview,
  dulyMakeWorkItem,
  findWorkItem,
  queryWorkItem,
  signInToCaseManagement
} from '../../helpers/case-management-journey.js'
import { MONOREPO_ORGS } from '../../helpers/monorepo.js'
import {
  openAccreditation,
  signInAsOperator,
  startFresh,
  submitAccreditation
} from '../../helpers/monorepo-journey.js'
import {
  addOverseasSiteWithInterimSite,
  confirmOverseasSites,
  resubmitApplication,
  updateQueriedBusinessPlan,
  updateQueriedSamplingPlan,
  uploadOutstandingBesEvidence
} from '../../helpers/query-response-journey.js'
import { reportDetails, reportStep } from '../../helpers/report-step.js'
import { accreditationYear } from '../../config.js'

// Runs only against the DEFRA/epr-register-enrol monorepo's local stack:
// npm run test:monorepo (wdio.monorepo.conf.js). Never in CI.
//
// The whole accreditation workflow across the operator frontend
// (localhost:3000) and case management (localhost:5001), for one reprocessor
// and one exporter application:
//
//   1 operator    submits both applications
//   2 regulator   for each: duly makes it, changes the payment date and the
//                 determination deadline, and queries it - the reprocessor's
//                 business plan and sampling plan, the exporter's overseas
//                 sites and BES evidence
//   3 operator    answers both queries - for the exporter, a new overseas site
//                 with an interim site - and resubmits, so both read UPDATED
//   4 regulator   sees what each query response changed, continues the
//                 review, approves both and confirms the applicant has been
//                 contacted, so both are Granted, which the operator then sees
//                 too
//
// The tests share the two applications and run in order: each skips when the
// one before it did not get as far as it needs.

const DAY = 24 * 60 * 60 * 1000
const daysFromToday = (days) => new Date(Date.now() + days * DAY)

// Duly made with one payment date, then corrected to another. Both must be
// today or in the past.
const PAYMENT_DATE = daysFromToday(-5)
const CHANGED_PAYMENT_DATE = daysFromToday(-2)
const CHANGED_DEADLINE = daysFromToday(90)

// The reprocessor's query response.
const UPDATED_BUSINESS_PLAN = [25, 25, 20, 10, 10, 5, 5]
const UPDATED_SAMPLING_PLAN = 'sampling-plan-query-response'

// The exporter's query response: a new site outside the EU and OECD, which so
// needs BES evidence, with an interim site.
const QUERY_SITE = {
  name: 'Mumbai Plastics Reprocessing Pvt Ltd',
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

const APPLICATIONS = {
  reprocessor: {
    org: MONOREPO_ORGS.reprocessor,
    isExporter: false,
    applicantType: 'Reprocessor',
    querySections: [QUERY_SECTIONS.businessPlan, QUERY_SECTIONS.samplingPlan],
    queriedTasks: ['task-business-plan', 'task-sampling-plan']
  },
  exporter: {
    org: MONOREPO_ORGS.exporter,
    isExporter: true,
    applicantType: 'Exporter',
    querySections: [QUERY_SECTIONS.overseasSites, QUERY_SECTIONS.bes],
    queriedTasks: ['task-overseas-sites', 'task-bes-evidence']
  }
}

describe(`Accreditation case management workflow ${accreditationYear} @monorepo`, () => {
  // By type: the reference once submitted, the work item id once found, and
  // how far it got.
  const progress = { reprocessor: {}, exporter: {} }

  function requireStage(context, stage) {
    const behind = Object.entries(progress)
      .filter(([, application]) => !application[stage])
      .map(([type]) => type)
    if (behind.length) {
      reportDetails('Skipped', { reason: `${behind.join(', ')} not ${stage}` })
      context.skip()
    }
  }

  before(async () => {
    await startFresh(MONOREPO_ORGS.reprocessor, MONOREPO_ORGS.exporter)
  })

  it('Operator: submits a reprocessor and an exporter application', async () => {
    for (const [type, application] of Object.entries(APPLICATIONS)) {
      progress[type].reference = await reportStep(
        `Operator: submit the ${type} application`,
        () =>
          submitAccreditation({
            org: application.org,
            isExporter: application.isExporter
          })
      )
      progress[type].submitted = true
    }
    reportDetails('Submitted', progress)
  })

  it('Regulator: duly makes both, changes the payment and determination dates, and queries both', async function () {
    requireStage(this, 'submitted')
    await signInToCaseManagement()

    for (const [type, application] of Object.entries(APPLICATIONS)) {
      const { reference } = progress[type]

      await reportStep(
        `Regulator: open the ${type} work item ${reference}`,
        async () => {
          const workItem = await findWorkItem({
            organisation: application.org.name,
            applicantType: application.applicantType,
            state: WORK_ITEM_STATES.notStarted,
            reference
          })
          progress[type].workItemId = workItem.workItemId
          await CmWorkItemsPage.openWorkItem(workItem.workItemId)
          await CmWorkItemPage.waitUntilLoaded()
          await expect(CmWorkItemPage.paymentDate).toHaveText('Not received')
        }
      )

      await reportStep(
        `Regulator: duly make the ${type} application`,
        async () => {
          await dulyMakeWorkItem({ paymentDate: PAYMENT_DATE })
          await expect(CmWorkItemPage.stateTag).toHaveText(
            WORK_ITEM_STATES.dulyMade
          )
          await expect(CmWorkItemPage.paymentDate).toHaveText(
            caseManagementDate(PAYMENT_DATE)
          )
        }
      )

      await reportStep(
        `Regulator: change the ${type} payment date`,
        async () => {
          await changePaymentDate({
            paymentDate: CHANGED_PAYMENT_DATE,
            reason: 'The payment was received later than first recorded.'
          })
          await expect(CmWorkItemPage.paymentDate).toHaveText(
            caseManagementDate(CHANGED_PAYMENT_DATE)
          )
        }
      )

      await reportStep(
        `Regulator: change the ${type} determination deadline`,
        async () => {
          await changeDeterminationDeadline({
            deadline: CHANGED_DEADLINE,
            reason: 'More time is needed to assess the application.'
          })
          await expect(CmWorkItemPage.dueDate).toHaveText(
            caseManagementDate(CHANGED_DEADLINE)
          )
        }
      )

      await reportStep(
        `Regulator: query the ${type} ${application.querySections.join(', ')}`,
        async () => {
          await queryWorkItem({
            sections: application.querySections,
            reason: 'Please review and update the queried sections.'
          })
          await expect(CmWorkItemPage.stateTag).toHaveText(
            WORK_ITEM_STATES.queried
          )
        }
      )
      progress[type].queried = true
    }
    reportDetails('Queried', progress)
  })

  /**
   * Operator: opens the queried application's query task list, checking the
   * queried tasks are the ones open to update.
   */
  async function openQueriedApplication(application) {
    expect(await openAccreditation(application.org)).toBe('QUERIED')
    await OperatorAccreditationPage.clickContinue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/query-task-list/')
    )
    for (const task of application.queriedTasks) {
      await expect(QueryTaskListPage.taskTag(task)).toHaveText('QUERIED')
    }
  }

  async function resubmit(type) {
    await reportStep(`Operator: resubmit the ${type} application`, async () => {
      await resubmitApplication()
      await expect(OperatorAccreditationPage.applicationStatus).toHaveText(
        'UPDATED'
      )
    })
    progress[type].updated = true
  }

  it('Operator: answers both queries, adding an overseas site with an interim site for the exporter, and resubmits', async function () {
    requireStage(this, 'queried')
    await signInAsOperator()

    await reportStep(
      'Operator: update the reprocessor business plan and sampling plan',
      async () => {
        await openQueriedApplication(APPLICATIONS.reprocessor)
        await updateQueriedBusinessPlan(UPDATED_BUSINESS_PLAN)
        await updateQueriedSamplingPlan(UPDATED_SAMPLING_PLAN)
      }
    )
    await resubmit('reprocessor')

    await reportStep(
      `Operator: add overseas site ${QUERY_SITE.name} with interim site ${QUERY_INTERIM_SITE.name}`,
      async () => {
        await openQueriedApplication(APPLICATIONS.exporter)
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
    // The new site is outside the EU and OECD, so needs BES evidence.
    await reportStep('Operator: upload the BES evidence for the new site', () =>
      uploadOutstandingBesEvidence()
    )
    await resubmit('exporter')
  })

  /** Case management: reopens the work item, now Updated. */
  async function reopenUpdatedWorkItem(type) {
    await CmWorkItemPage.open(progress[type].workItemId)
    await CmWorkItemPage.waitUntilLoaded()
    await expect(CmWorkItemPage.stateTag).toHaveText(WORK_ITEM_STATES.updated)
    // What the regulator changed before the query is kept.
    await expect(CmWorkItemPage.paymentDate).toHaveText(
      caseManagementDate(CHANGED_PAYMENT_DATE)
    )
  }

  /**
   * Case management: the two-step determination. Approving leaves the work
   * item Approved, pending contact; confirming the applicant has been
   * contacted grants it.
   */
  async function approveAndGrant(type) {
    await reportStep(`Regulator: continue the ${type} review`, () =>
      continueReview()
    )

    await reportStep(`Regulator: approve the ${type} application`, async () => {
      await approveWorkItem({
        note: 'All queried sections were updated and are satisfactory.'
      })
      await expect(CmWorkItemPage.stateTag).toHaveText(
        WORK_ITEM_STATES.approved
      )
      await expect(CmWorkItemPage.pendingContactBanner).toBeDisplayed()
    })

    await reportStep(
      `Regulator: confirm the ${type} applicant has been contacted`,
      async () => {
        await confirmApplicantContact()
        await expect(CmWorkItemPage.stateTag).toHaveText(
          WORK_ITEM_STATES.granted
        )
        await expect(CmWorkItemPage.decisionMetadata).toBeDisplayed()
      }
    )
    progress[type].granted = true
  }

  it('Regulator: sees each query response, approves both and moves them to Granted', async function () {
    requireStage(this, 'updated')
    await signInToCaseManagement()

    await reportStep(
      'Regulator: the reprocessor business plan and sampling plan show the update',
      async () => {
        await reopenUpdatedWorkItem('reprocessor')
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
    await approveAndGrant('reprocessor')

    await reportStep(
      'Regulator: the exporter overseas site, interim site and BES evidence show',
      async () => {
        await reopenUpdatedWorkItem('exporter')
        const overseasSites = await CmWorkItemPage.overseasSitesText()
        expect(overseasSites).toContain(QUERY_SITE.name)
        expect(overseasSites).toContain(QUERY_INTERIM_SITE.name)
        await expect(CmWorkItemPage.besValue).toHaveText(
          expect.stringContaining(QUERY_SITE.name)
        )
      }
    )
    await approveAndGrant('exporter')
  })

  it('Operator: both applications read GRANTED', async function () {
    requireStage(this, 'granted')
    await signInAsOperator()

    for (const [type, application] of Object.entries(APPLICATIONS)) {
      await reportStep(`Operator: the ${type} application reads GRANTED`, () =>
        // Case management pushes the status to the operator side.
        browser.waitUntil(
          async () =>
            (await openAccreditation(application.org)).includes('GRANTED'),
          {
            timeout: 60000,
            interval: 5000,
            timeoutMsg: `The ${type} application did not read GRANTED`
          }
        )
      )
    }
  })
})
