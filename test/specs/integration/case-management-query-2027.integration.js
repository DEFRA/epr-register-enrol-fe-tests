import { browser, expect } from '@wdio/globals'
import CmWorkItemPage from 'page-objects/cm-work-item.page'
import CmWorkItemsPage from 'page-objects/cm-work-items.page'
import OperatorAccreditationPage from 'page-objects/operator-accreditation.page'
import QueryTaskListPage from 'page-objects/query-task-list.page'
import TaskListPage from 'page-objects/tasklist.page'
import ReexHomePage from 'page-objects/reex-home.page'
import ReexRegistrationPage from 'page-objects/reex-registration.page'
import { QUERY_SECTIONS } from 'page-objects/cm-query.page'
import {
  approveWorkItem,
  dulyMakeWorkItem,
  findWorkItem,
  queryWorkItem,
  signInToCaseManagement,
  WORK_ITEM_STATES
} from '../../helpers/case-management-journey.js'
import {
  addOverseasSiteWithInterimSite,
  confirmOverseasSites,
  resubmitApplication,
  uploadOutstandingBesEvidence
} from '../../helpers/query-response-journey.js'
import { signInToReex } from '../../helpers/reex-reaccreditation.js'
import { accreditationYear } from '../../config.js'

const ORGANISATION = process.env.CASE_MANAGEMENT_ORGANISATION || 'Feeney'

// Case management and the Re-Ex grid name the same material differently, and
// not just in punctuation: "Paper or board" against "Paper and board",
// "Glass - Remelt" against "Glass remelt", "Fibre-based composite material"
// against "Fibre-based composite". Comparing the significant words of each name
// handles all of those while still telling Glass remelt and Glass other apart,
// which a looser substring match would not.
const MATERIAL_STOP_WORDS = new Set(['and', 'or', 'material'])

const materialTokens = (value) =>
  new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter((token) => token && !MATERIAL_STOP_WORDS.has(token))
  )

const materialsMatch = (gridMaterial, caseManagementMaterial) => {
  const grid = materialTokens(gridMaterial)
  const caseManagement = materialTokens(caseManagementMaterial)
  return (
    grid.size === caseManagement.size &&
    [...grid].every((token) => caseManagement.has(token))
  )
}

const NEW_SITE = {
  name: 'Cardiff Metals Reprocessing Ltd',
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

// The full regulator-and-operator loop for a queried exporter application, run
// against a deployed environment (dev by default):
//
//   case management  duly make -> query ORS and BES
//   operator         add an overseas site with an interim site, upload BES
//                    evidence, resubmit
//   case management  see the updated application, approve it
//
// Run with `npm run test:integration`.
//
// It changes real state and cannot be repeated against the same application:
// approving issues the accreditation and is final. The test therefore claims an
// exporter work item that is still "Not started" — if none is waiting, it fails
// saying so rather than interfering with another one.
describe(`Case management query and determination ${accreditationYear} - integration`, () => {
  it('should duly make, query, take the operator response and approve the application', async () => {
    // ── Case management: find and duly make the exporter work item ──────────
    await signInToCaseManagement()

    const workItem = await findWorkItem({
      organisation: ORGANISATION,
      applicantType: 'Exporter',
      state: WORK_ITEM_STATES.notStarted
    })
    await CmWorkItemsPage.openWorkItem(workItem.workItemId)
    await CmWorkItemPage.waitUntilLoaded()

    // The material this whole journey is about — captured here so the operator
    // side below acts on the same one rather than assuming.
    const material = await CmWorkItemPage.material.getText()
    expect(material).not.toBe('')

    await dulyMakeWorkItem({ paymentDate: new Date() })

    await expect(CmWorkItemPage.stateTag).toHaveText(WORK_ITEM_STATES.dulyMade)
    await expect(CmWorkItemPage.flashBanner).toHaveText(
      expect.stringContaining(
        'The payment date has been recorded and the application is now duly made.'
      )
    )

    // ── Case management: query the overseas sites and BES sections ──────────
    await queryWorkItem({
      sections: [QUERY_SECTIONS.overseasSites, QUERY_SECTIONS.bes],
      reason:
        'Please add an additional overseas reprocessing site and upload BES evidence.'
    })
    await expect(CmWorkItemPage.stateTag).toHaveText(WORK_ITEM_STATES.queried)

    // ── Operator: respond to the query ──────────────────────────────────────
    await signInToReex()
    await ReexHomePage.openExporting()

    const rows = await ReexHomePage.materialRows()
    const row = rows.find((candidate) =>
      materialsMatch(candidate.material, material)
    )
    if (!row) {
      throw new Error(
        `No exporting row matches the work item's material "${material}". ` +
          `The grid holds: ${rows.map((r) => r.material).join(', ')}`
      )
    }

    await ReexHomePage.openMaterial(row)
    await ReexRegistrationPage.applyForAccreditation(accreditationYear)

    await expect(OperatorAccreditationPage.applicationStatus).toHaveText(
      'QUERIED'
    )
    await OperatorAccreditationPage.clickContinue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/query-task-list/')
    )

    // Only the two queried sections are unlocked for editing.
    await expect(QueryTaskListPage.taskTag('task-overseas-sites')).toHaveText(
      'QUERIED'
    )
    await expect(QueryTaskListPage.taskTag('task-bes-evidence')).toHaveText(
      'QUERIED'
    )

    await QueryTaskListPage.taskLink('task-overseas-sites').click()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/select-overseas-sites')
    )

    await addOverseasSiteWithInterimSite({
      site: NEW_SITE,
      interimSite: INTERIM_SITE,
      // R12 and R13 are rejected without a primary recycling code alongside
      // them ("Select R3, R4 or R5"). Which primary code applies depends on the
      // material, so the helper takes it from the page.
      additionalCodes: ['R12', 'R13'],
      interimRecyclingOperationCodes: ['R12', 'R13']
    })
    await confirmOverseasSites()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/query-task-list/')
    )
    await uploadOutstandingBesEvidence()

    await resubmitApplication()

    // ── Operator: the application is now Updated ────────────────────────────
    await expect(OperatorAccreditationPage.applicationStatus).toHaveText(
      'UPDATED'
    )

    await OperatorAccreditationPage.clickContinue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )
    await expect(TaskListPage.PRNTagStatus).toHaveText('COMPLETED')
    await expect(TaskListPage.businessPlanStatus).toHaveText('COMPLETED')
    await expect(TaskListPage.SIPlanStatus).toHaveText('COMPLETED')
    await expect(TaskListPage.overseasSitesStatus).toHaveText('COMPLETED')

    // BES reads NOT STARTED here on the deployed environment, even though every
    // site shows "Uploaded" and case management receives the evidence — and the
    // same application's BES task reads COMPLETED when it is submitted for the
    // first time (asserted in reaccreditation-2027.integration.js). So the
    // status is lost by the query-and-resubmit cycle. Checked at the end of the
    // test rather than here, so that this known defect does not stop the
    // determination steps below from being exercised.
    const besStatusAfterResubmission = await TaskListPage.besStatus.getText()

    // ── Case management: the updated application, with the new sites ────────
    await signInToCaseManagement()
    await CmWorkItemPage.open(workItem.workItemId)
    await CmWorkItemPage.waitUntilLoaded()

    await expect(CmWorkItemPage.stateTag).toHaveText(WORK_ITEM_STATES.updated)
    const overseasSitesText = await CmWorkItemPage.overseasSitesText()
    expect(overseasSitesText).toContain(NEW_SITE.name)
    expect(overseasSitesText).toContain(INTERIM_SITE.name)
    await expect(CmWorkItemPage.besValue).toHaveText(
      expect.stringContaining(NEW_SITE.name)
    )

    // ── Case management: approve ────────────────────────────────────────────
    await approveWorkItem({
      note: 'All queried sections were updated and are satisfactory.'
    })

    await expect(CmWorkItemPage.stateTag).toHaveText(WORK_ITEM_STATES.granted)
    await expect(CmWorkItemPage.flashBanner).toHaveText(
      expect.stringContaining('Decision logged: Approved')
    )
    await expect(CmWorkItemPage.decisionMetadata).toBeDisplayed()

    // Deferred from the operator task list above — see the comment there.
    expect(besStatusAfterResubmission).toBe('COMPLETED')
  })
})
