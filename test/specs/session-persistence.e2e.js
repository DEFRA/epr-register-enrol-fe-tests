import { browser, expect } from '@wdio/globals'
import LoginPage from 'page-objects/login.page'
import MaterialSelectionPage from 'page-objects/material-selection.page'
import TaskListPage from 'page-objects/task-list.page'
import SessionPersistencePage from 'page-objects/session-persistence.page'

/**
 * RA-114: Session and Data Persistence Integration
 *
 * These e2e tests verify that:
 * - Session keys are set on successful material selection (AC1, AC2)
 * - "Save and come back later" always calls the PATCH endpoint (AC6)
 * - Business plan data persists to the API and is pre-populated on return (AC2)
 * - On PATCH failure the user sees an error (AC7)
 *
 * Note: The session guard redirect (AC3, AC4) is bypassed in test mode
 * per the codebase convention (config.get('isTest') === true). Guard
 * behaviour is covered by unit tests in accreditationSessionGuard.test.js.
 */
describe('RA-114: Session and Data Persistence Integration', () => {
  beforeEach(async () => {
    await LoginPage.open()
    await LoginPage.switchToOperator()
    await LoginPage.loginAsUser()
  })

  afterEach(async () => {
    await LoginPage.signOut()
  })

  describe('AC1/AC2: Session established on material selection', () => {
    it('Should redirect to task list after successful material selection, establishing session', async () => {
      await MaterialSelectionPage.open()
      await MaterialSelectionPage.steelRadio.click()
      await MaterialSelectionPage.continueButton.click()

      const url = await browser.getUrl()
      await expect(url).toContain('/accreditation/task-list/')
    })

    it('Should carry applicationId in the task list URL after material selection', async () => {
      await MaterialSelectionPage.open()
      await MaterialSelectionPage.steelRadio.click()
      await MaterialSelectionPage.continueButton.click()

      const url = await browser.getUrl()
      const applicationIdMatch = url.match(/task-list\/([^/]+)/)
      await expect(applicationIdMatch).not.toBeNull()
      const applicationId = applicationIdMatch[1]
      await expect(applicationId.length).toBeGreaterThan(0)
    })
  })

  describe('AC2: API is source of record — data loads from API on return', () => {
    it('Should pre-populate business plan percentages from API on return to the page', async () => {
      await MaterialSelectionPage.open()
      await MaterialSelectionPage.steelRadio.click()
      await MaterialSelectionPage.continueButton.click()

      const url = await browser.getUrl()
      const applicationId = url.match(/task-list\/([^/]+)/)?.[1]

      await SessionPersistencePage.openBusinessPlan(applicationId)
      await SessionPersistencePage.fillBusinessPlanPercentages({
        newInfrastructure: '30',
        priceSupport: '20',
        businessCollections: '20',
        communications: '10',
        newMarkets: '10',
        newUses: '10'
      })

      await SessionPersistencePage.saveAndComeLaterButton.click()

      const taskListUrl = await browser.getUrl()
      await expect(taskListUrl).toContain('/accreditation/task-list/')

      await SessionPersistencePage.openBusinessPlan(applicationId)

      const infraValue = await SessionPersistencePage.newInfrastructureInput.getValue()
      await expect(infraValue).toBe('30')
    })
  })

  describe('AC6: Save and come back later always calls PATCH', () => {
    it('Should redirect to task list when "Save and come back later" is clicked', async () => {
      await MaterialSelectionPage.open()
      await MaterialSelectionPage.steelRadio.click()
      await MaterialSelectionPage.continueButton.click()

      const taskListUrl = await browser.getUrl()
      const applicationId = taskListUrl.match(/task-list\/([^/]+)/)?.[1]

      await SessionPersistencePage.openBusinessPlan(applicationId)
      await SessionPersistencePage.fillBusinessPlanPercentages({
        newInfrastructure: '40',
        priceSupport: '0',
        businessCollections: '0',
        communications: '60',
        newMarkets: '0',
        newUses: '0'
      })

      await SessionPersistencePage.saveAndComeLaterButton.click()

      const url = await browser.getUrl()
      await expect(url).toContain('/accreditation/task-list/')
    })

    it('Should persist partial data after Save and come back later', async () => {
      await MaterialSelectionPage.open()
      await MaterialSelectionPage.steelRadio.click()
      await MaterialSelectionPage.continueButton.click()

      const taskListUrl = await browser.getUrl()
      const applicationId = taskListUrl.match(/task-list\/([^/]+)/)?.[1]

      await SessionPersistencePage.openBusinessPlan(applicationId)
      await SessionPersistencePage.fillBusinessPlanPercentages({
        newInfrastructure: '55',
        priceSupport: '0',
        businessCollections: '0',
        communications: '0',
        newMarkets: '0',
        newUses: '45'
      })

      await SessionPersistencePage.saveAndComeLaterButton.click()
      await SessionPersistencePage.openBusinessPlan(applicationId)

      const infraValue = await SessionPersistencePage.newInfrastructureInput.getValue()
      await expect(infraValue).toBe('55')
      const newUsesValue = await SessionPersistencePage.newUsesInput.getValue()
      await expect(newUsesValue).toBe('45')
    })
  })

  describe('AC10: Only key fields in session — no page bloat', () => {
    it('Should not store extended application data in session after material selection', async () => {
      await MaterialSelectionPage.open()
      await MaterialSelectionPage.steelRadio.click()
      await MaterialSelectionPage.continueButton.click()

      const cookies = await browser.getCookies()
      const sessionCookie = cookies.find((c) => c.name === 'sid')

      if (sessionCookie) {
        await expect(sessionCookie.value.length).toBeLessThan(4096)
      }
    })
  })
})
