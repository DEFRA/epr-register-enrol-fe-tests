import { browser, expect, $, $$ } from '@wdio/globals'
import ApplicationSubmittedPage from 'page-objects/application-submitted.page'
import CmWorkItemPage from 'page-objects/cm-work-item.page'
import CmWorkItemsPage from 'page-objects/cm-work-items.page'
import OperatorAccreditationPage from 'page-objects/operator-accreditation.page'
import TaskListPage from 'page-objects/tasklist.page'

import {
  WORK_ITEM_STATES,
  approveWorkItem,
  confirmApplicantContact,
  dulyMakeWorkItem,
  findWorkItem,
  signInToCaseManagement
} from '../case-management-journey.js'
import { confirmOverseasSites } from '../query-response-journey.js'
import {
  completeOutstandingTasks,
  submitAndAssertConfirmation
} from '../reex-reaccreditation.js'
import { reportDetails, reportStep } from '../report-step.js'
import {
  operatorAccreditationLinks,
  registerEnrolFrontendUrl
} from './accreditation-links.js'
import { recordAccreditationApplication } from './accreditation-applications.js'
import { openRegisterEnrolPage } from './register-enrol-sign-in.js'
import { completeIncompleteOverseasSites } from './seeded-accreditation-journey.js'

// What in-year-changes.integration.js needs on the run's seeded organisation:
// a registration's accreditation applied for, submitted and granted, and the
// in-year change pages for it.
//
// An application for a year is built from the registration's Re-Ex
// accreditation for the year before, and Re-Ex only holds the current year's.
// So the accreditation granted here is next year's (ACCREDITATION_YEAR), as
// accreditation-workflow's is. The in-year change pages work on any granted
// exporter accreditation, but the /manage pages only ever show the current
// calendar year's: until next year they show the registration alone, with no
// way into the in-year pages, so those are entered as the accreditation's own
// landing page leaves the operator, with it in the session.

const APPROVAL_NOTE = 'Granted for the in-year changes integration test.'

// The year the /manage pages show (the frontend's currentYear: UTC).
export const currentYear = () => new Date().getUTCFullYear()

const capitalise = (text) => text.charAt(0).toUpperCase() + text.slice(1)

/**
 * The registration's "Manage registration and accreditation" page, which
 * Re-Ex links to: /manage/{orgId}/{registrationNumber}/{Material}. There is no
 * year in it: the page shows the current year's accreditation.
 */
export const manageUrl = (organisation, registration) =>
  `${registerEnrolFrontendUrl()}/manage/${organisation.orgId}/` +
  `${encodeURIComponent(registration.registrationNumber)}/${capitalise(registration.material)}`

const accreditationUrl = (organisation, registration, year) =>
  operatorAccreditationLinks(organisation, { year }).find(
    (link) => link.registrationNumber === registration.registrationNumber
  ).url

/** The in-year "Accreditation requests" page for a granted accreditation. */
export const inYearRequestsUrl = (applicationId) =>
  `${registerEnrolFrontendUrl()}/accreditation/manage-overseas-sites/${applicationId}/requests`

/** The organisation's one registration of that type and material. */
export function findRegistration(organisation, wasteProcessingType, material) {
  const registration = organisation.registrations.find(
    (candidate) =>
      candidate.wasteProcessingType === wasteProcessingType &&
      candidate.material === material &&
      !candidate.glassRecyclingProcess
  )
  if (!registration) {
    throw new Error(
      `Organisation ${organisation.orgId} has no ${material} ${wasteProcessingType} registration`
    )
  }
  return registration
}

// The test id suffixes of the elements whose test id starts with prefix.
async function testIds(prefix) {
  const ids = []
  for (const el of await $$(`[data-testid^="${prefix}"]`)) {
    ids.push((await el.getAttribute('data-testid')).slice(prefix.length))
  }
  return ids
}

/**
 * Opens the registration's accreditation landing page for the year, which
 * also puts the accreditation in the session; returns its status.
 */
export async function openAccreditation(organisation, registration, year) {
  const url = accreditationUrl(organisation, registration, year)
  await openRegisterEnrolPage(url, organisation.email)
  try {
    await OperatorAccreditationPage.applicationStatus.waitForDisplayed({
      timeout: 30000
    })
  } catch {
    throw new Error(
      `${url} shows no application status. At ${await browser.getUrl()}:\n` +
        (await $('main')
          .getText()
          .catch(() => '(no main)'))
    )
  }
  return (await OperatorAccreditationPage.applicationStatus.getText()).trim()
}

// An exporter keeps its accredited overseas sites and leaves its registered
// ones registered, never added to the application, so they are there to add
// in-year. Returns the registered sites' ids.
async function completeExporterTasks(applicationId) {
  const material = await completeOutstandingTasks({ isExporter: false })

  // Only the accredited sites are completed: completing a registered one
  // would add it to the application.
  await completeIncompleteOverseasSites(applicationId, {
    section: 'accredited-site'
  })
  await expect(
    $$('[data-testid^="accredited-site-incomplete-"]')
  ).toBeElementsArrayOfSize(0)

  const registeredSiteIds = await testIds('add-button-registered-')
  reportDetails('Overseas sites', {
    accredited: await testIds('accredited-site-row-'),
    registered: registeredSiteIds
  })
  if (registeredSiteIds.length === 0) {
    throw new Error(
      'The exporter has no registered overseas site to add in-year'
    )
  }

  await confirmOverseasSites()
  await expect(TaskListPage.overseasSitesStatus).toHaveText('COMPLETED')
  // BES evidence, for the sites outside the EU and OECD.
  await completeOutstandingTasks({ isExporter: true })
  return { material, registeredSiteIds }
}

async function applyAndSubmit(organisation, registration) {
  const isExporter = registration.wasteProcessingType === 'exporter'
  await OperatorAccreditationPage.clickContinue()
  await expect(browser).toHaveUrl(
    expect.stringContaining('/accreditation/task-list/')
  )
  const applicationId = (await browser.getUrl())
    .split('/accreditation/task-list/')[1]
    .split('?')[0]

  const { material, registeredSiteIds } = await reportStep(
    'Operator: complete every task',
    async () =>
      isExporter
        ? completeExporterTasks(applicationId)
        : { material: await completeOutstandingTasks({ isExporter: false }) }
  )
  await TaskListPage.assertAllTasksCompleted({ isExporter })

  const applicationReference = await reportStep(
    'Operator: submit the application',
    async () => {
      await TaskListPage.continueToSubmit()
      await submitAndAssertConfirmation(material)
      return ApplicationSubmittedPage.referenceNumber.getText()
    }
  )
  recordAccreditationApplication({
    orgId: organisation.orgId,
    organisationId: organisation.id,
    defraIdEmail: organisation.email,
    defraOrganisation: organisation.defraOrganisation,
    wasteProcessingType: registration.wasteProcessingType,
    material: registration.material,
    registrationNumber: registration.registrationNumber,
    applicationId,
    applicationReference
  })
  reportDetails('Submitted', { applicationId, applicationReference })
  return {
    applicationId,
    applicationReference,
    ...(registeredSiteIds && { registeredSiteIds })
  }
}

async function grantInCaseManagement(organisation, registration, reference) {
  await signInToCaseManagement()
  let workItem
  await reportStep(`Case management: find ${reference}`, () =>
    // Case management lists a submission once it has processed it.
    browser.waitUntil(
      async () => {
        try {
          workItem = await findWorkItem({
            organisation: organisation.name,
            applicantType: capitalise(registration.wasteProcessingType),
            state: WORK_ITEM_STATES.notStarted,
            reference
          })
          return true
        } catch {
          return false
        }
      },
      {
        timeout: 2 * 60 * 1000,
        interval: 10000,
        timeoutMsg: `Case management never listed ${reference} for ${organisation.name}`
      }
    )
  )
  reportDetails('Work item', workItem)
  await CmWorkItemsPage.openWorkItem(workItem.workItemId)
  await CmWorkItemPage.waitUntilLoaded()

  await reportStep('Case management: duly make', async () => {
    await dulyMakeWorkItem({ paymentDate: new Date() })
    await expect(CmWorkItemPage.stateTag).toHaveText(WORK_ITEM_STATES.dulyMade)
  })
  await reportStep('Case management: approve', async () => {
    await approveWorkItem({ note: APPROVAL_NOTE })
    await expect(CmWorkItemPage.stateTag).toHaveText(WORK_ITEM_STATES.approved)
  })
  await reportStep('Case management: confirm contact (grant)', async () => {
    await confirmApplicantContact()
    await expect(CmWorkItemPage.stateTag).toHaveText(WORK_ITEM_STATES.granted)
  })
}

/**
 * Applies for the registration's accreditation for the year, submits it, has
 * case management grant it, and waits until the operator sees it GRANTED.
 * Fails should it already be past IN PROGRESS: the run's organisation is new,
 * so something else applied for it.
 *
 * @param {import('./seeded-organisation.js').SeededOrganisation} organisation
 * @param {import('./seeded-organisation.js').SeededRegistration} registration
 * @param {{year: number}} options
 * @returns {Promise<{applicationId: string, applicationReference: string, year: number, registeredSiteIds?: string[]}>}
 *   registeredSiteIds: an exporter's overseas sites left registered
 */
export async function grantAccreditation(organisation, registration, { year }) {
  const status = await reportStep(
    `Operator: open the ${year} accreditation`,
    () => openAccreditation(organisation, registration, year)
  )
  if (!['NOT STARTED', 'IN PROGRESS'].includes(status)) {
    throw new Error(
      `${registration.registrationNumber}'s ${year} accreditation is already ${status}`
    )
  }

  const submitted = await applyAndSubmit(organisation, registration)
  await grantInCaseManagement(
    organisation,
    registration,
    submitted.applicationReference
  )

  await reportStep('Operator: the application reads GRANTED', () =>
    browser.waitUntil(
      async () =>
        (await openAccreditation(organisation, registration, year)).includes(
          'GRANTED'
        ),
      {
        timeout: 3 * 60 * 1000,
        interval: 15000,
        timeoutMsg: `${submitted.applicationReference} did not read GRANTED for the operator`
      }
    )
  )
  return { ...submitted, year }
}

/**
 * Adds a registered overseas site to the accreditation's in-progress change
 * request, as its "Add to accreditation" button on Manage overseas
 * reprocessing sites does (a form posting to .../sites/{siteId}), and leaves
 * the browser on the site's "Add to accreditation" summary. Posted from the
 * in-year requests page: for an accreditation the /manage pages do not show,
 * that button is not there.
 *
 * Expects the browser on a register-enrol page with the accreditation in the
 * session (see openAccreditation).
 */
export async function addSiteToChangeRequest(applicationId, siteId) {
  await browser.url(inYearRequestsUrl(applicationId))
  await browser.execute((action) => {
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = action
    const crumb = document.querySelector('input[name="crumb"]')
    if (crumb) {
      form.appendChild(crumb.cloneNode())
    }
    document.body.appendChild(form)
    form.submit()
  }, `/accreditation/manage-overseas-sites/${applicationId}/sites/${siteId}`)
}
