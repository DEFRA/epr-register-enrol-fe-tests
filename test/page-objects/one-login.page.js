import { browser } from '@wdio/globals'
import { Page } from 'page-objects/page'
import { reexFrontendUrl } from '../config.js'

// GOV.UK One Login (signin.integration.account.gov.uk on the dev tier). Three
// pages: "create or sign in" -> email -> password. On success it hands back to
// Defra Customer Identity (B2C), which redirects on to the Re-Ex frontend's
// organisation home — several seconds and several redirects later, hence the
// generous wait in signIn() rather than a bare URL check.
class OneLoginPage extends Page {
  get signInButton() {
    return $('#sign-in-button')
  }

  get emailInput() {
    return $('#email')
  }

  get passwordInput() {
    return $('#password')
  }

  get submitButton() {
    return $('button[type="submit"]')
  }

  // The start button either lands on One Login or, when the identity session
  // from an earlier test in the same browser is still live, goes straight back
  // to the Re-Ex frontend signed in. Both are success; the caller needs to
  // know which so it can skip the credential pages in the second case.
  async waitForSignInOrSession() {
    let signedInAlready = false

    await browser.waitUntil(
      async () => {
        const url = await browser.getUrl()
        if (url.includes('signin')) {
          return true
        }
        // Back on the frontend past the public start page - already signed in.
        if (url.startsWith(reexFrontendUrl) && !url.includes('/start')) {
          signedInAlready = true
          return true
        }
        return false
      },
      {
        timeout: 60000,
        timeoutMsg:
          'Start button reached neither GOV.UK One Login nor a signed-in page'
      }
    )

    return signedInAlready
  }

  async signIn(username, password) {
    if (await this.waitForSignInOrSession()) {
      return
    }

    await this.signInButton.waitForDisplayed({ timeout: 30000 })
    await this.clickReliably(this.signInButton)

    await this.emailInput.waitForDisplayed({ timeout: 30000 })
    await this.emailInput.setValue(username)
    await this.clickReliably(this.submitButton)

    await this.passwordInput.waitForDisplayed({ timeout: 30000 })
    await this.passwordInput.setValue(password)
    await this.clickReliably(this.submitButton)

    // One Login -> B2C -> Re-Ex frontend. Anything still on an identity host
    // after this means the credentials were rejected or an extra step (MFA,
    // an interstitial) was added, so report where we actually ended up rather
    // than letting the next page object fail on a missing selector.
    await browser.waitUntil(
      async () => (await browser.getUrl()).startsWith(reexFrontendUrl),
      {
        timeout: 120000,
        timeoutMsg: `Sign-in did not return to ${reexFrontendUrl}`
      }
    )
  }
}

export default new OneLoginPage()
