import { Page } from 'page-objects/page'

class LoginPage extends Page {
  open() {
    return super.open('/')
  }

  get pageHeading() {
    return $('.govuk-fieldset__heading')
  }

  get userRadioButton() {
    return $('#user-1')
  }

  get loginButton() {
    return $(".govuk-button[type='submit']")
  }

  // RA-537: the OJ frontend has no regulator side any more, so the stub
  // chooser must offer no link into a regulator login (formerly
  // a[href="/auth/stub/login?type=regulator"]). Matched loosely on
  // "regulator" so a renamed route can't slip past the negative assertion.
  get regulatorLinks() {
    return $$('a[href*="regulator"]')
  }

  async loginAsOperator() {
    await $('input[type="radio"]').waitForExist({ timeout: 15000 })
    await browser.execute(() => {
      // eslint-disable-next-line no-undef
      document.querySelector('input[type="radio"]').click()
    })
    const submitBtn = await $('button.govuk-button')
    await this.clickReliably(submitBtn)
    await browser.waitUntil(
      async () => !(await browser.getUrl()).includes('/stub/login'),
      { timeout: 15000, timeoutMsg: 'Stub login did not redirect after login' }
    )
  }

  // RA-537: any type the stub chooser doesn't know — including the removed
  // `regulator` — 302s to the operator chooser rather than 404ing.
  async openStubLogin(type) {
    await super.open(`/auth/stub/login?type=${type}`)
  }

  async switchToOperator() {
    await super.open('/auth/stub/login?type=operator')
    await $('input[type="radio"]').waitForExist({ timeout: 15000 })
  }

  get signOutLink() {
    return $('a[href="/auth/logout"]')
  }

  async signOut() {
    await browser.url('/auth/logout')
  }
}

export default new LoginPage()
