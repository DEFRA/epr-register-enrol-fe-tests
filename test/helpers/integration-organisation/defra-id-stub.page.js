import { browser } from '@wdio/globals'
import { Page } from 'page-objects/page'
import { reexFrontendUrl } from '../../config.js'

// The Defra ID stub's sign-in page (epr-re-ex-defra-id-stub), where the Re-Ex
// frontend's "Start now" lands on test and perf-test. It asks only for an
// email: any user registered with the stub signs in as itself, no password.
// It then redirects back through the frontend's /auth/callback to the
// organisation home.
class DefraIdStubPage extends Page {
  get emailInput() {
    return $('#email')
  }

  get submitButton() {
    return $('button[type="submit"]')
  }

  // As with One Login, the start button either reaches the stub or, when an
  // earlier test in the same browser left a session, goes straight back to
  // the frontend signed in. Reports which, so the caller can skip the form.
  async waitForSignInOrSession() {
    let signedInAlready = false

    await browser.waitUntil(
      async () => {
        const url = await browser.getUrl()
        if (url.includes('defra-id-stub')) {
          return true
        }
        if (url.startsWith(reexFrontendUrl) && url.includes('/organisations')) {
          signedInAlready = true
          return true
        }
        return false
      },
      {
        timeout: 60000,
        timeoutMsg:
          'Start button reached neither the Defra ID stub nor a signed-in page'
      }
    )

    return signedInAlready
  }

  async signIn(email) {
    if (await this.waitForSignInOrSession()) {
      return
    }

    await this.emailInput.waitForDisplayed({ timeout: 30000 })
    await this.emailInput.setValue(email)
    await this.clickReliably(this.submitButton)

    // A stub that does not know the email, or a user not linked to any
    // organisation, stops short of the organisation home, so say where.
    await browser.waitUntil(
      async () => {
        const url = await browser.getUrl()
        return url.startsWith(reexFrontendUrl) && url.includes('/organisations')
      },
      {
        timeout: 60000,
        timeoutMsg: `Signing in as ${email} did not reach an organisation on ${reexFrontendUrl}`
      }
    )
  }
}

export default new DefraIdStubPage()
