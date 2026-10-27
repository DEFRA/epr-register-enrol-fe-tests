import { browser } from '@wdio/globals'
import { Page } from 'page-objects/page'
import { caseManagementFrontendUrl } from '../config.js'

// Stub login on the case management frontend. "/" redirects here while stub
// auth is enabled; leaving the nation select on "None" logs in as a caseworker
// who can see every nation's work items.
class CmLoginPage extends Page {
  open() {
    return browser.url(`${caseManagementFrontendUrl}/`)
  }

  get loginButton() {
    return $('button=Log in')
  }

  async login() {
    await this.open()

    // "/" either redirects to the stub login form or, when a sign-in earlier in
    // the same browser is still live, straight past it to the work items list.
    await browser.waitUntil(
      async () => {
        const url = await browser.getUrl()
        return url.includes('/auth/stub/login') || url.includes('/work-items')
      },
      {
        timeout: 30000,
        timeoutMsg:
          'Case management reached neither the stub login nor the work items list'
      }
    )

    if (!(await browser.getUrl()).includes('/auth/stub/login')) {
      return
    }

    await this.loginButton.waitForDisplayed({ timeout: 30000 })
    await this.clickReliably(this.loginButton)
    await browser.waitUntil(
      async () => !(await browser.getUrl()).includes('/auth/stub/login'),
      {
        timeout: 30000,
        timeoutMsg: 'Case management stub login did not redirect'
      }
    )
  }
}

export default new CmLoginPage()
