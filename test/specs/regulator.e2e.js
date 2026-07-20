import { browser, expect } from '@wdio/globals'

import LoginPage from 'page-objects/login.page'
import RegulatorPage from 'page-objects/regulator.page'

describe('Regulator Journey', () => {
  beforeEach(async () => {
    await browser.deleteCookies()
    await LoginPage.openRegulatorLogin()
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
  })

  afterEach(async () => {
    await LoginPage.signOut()
  })

  it('Should land on the regulator page after login', async () => {
    await expect(browser).toHaveUrl(expect.stringContaining('/regulator'))
    await expect(RegulatorPage.pageHeading).toHaveText('Regulator Landing Page')
    await expect(RegulatorPage.pageText).toHaveText('Regulator')
  })
})
