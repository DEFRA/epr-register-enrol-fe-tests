import { browser, expect } from '@wdio/globals'

import HomePage from 'page-objects/home.page'
import LoginPage from 'page-objects/login.page'
import RegulatorPage from 'page-objects/regulator.page'
import WorklistItemsPage from 'page-objects/worklistitems.page'

describe('Regulator Journey', () => {
  beforeEach(async () => {
    await browser.deleteCookies()
    await LoginPage.open()
    await browser.execute(() => {
      // eslint-disable-next-line no-undef
      localStorage.clear()
      // eslint-disable-next-line no-undef
      sessionStorage.clear()
    })
    await LoginPage.loginAsUser()
    await browser.waitUntil(
      async () => !(await browser.getUrl()).includes('/stub/login'),
      { timeout: 15000, timeoutMsg: 'Stub login did not redirect after login' }
    )
    await HomePage.regulatorLink.waitForDisplayed()
    await HomePage.regulatorLink.click()
    await RegulatorPage.pageHeading.waitForDisplayed()
  })

  afterEach(async () => {
    await LoginPage.signOut()
  })

  it('Should view work items', async () => {
    await RegulatorPage.navigateToWorkItems()
    await expect(browser).toHaveUrl(expect.stringContaining('/worklist'))
    await expect(WorklistItemsPage.pageHeading).toHaveText('Worklist Items')
    const count = await WorklistItemsPage.getWorkItemsCount()
    await expect(count).toBeGreaterThan(0)
  })
})
