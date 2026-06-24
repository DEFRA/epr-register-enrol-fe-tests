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

  get switchToOperatorLink() {
    return $('a[href="/auth/stub/login?type=operator"]')
  }

  get switchToRegulatorLink() {
    return $('a[href="/auth/stub/login?type=regulator"]')
  }

  async loginAsUser() {
    await $('input[type="radio"]').waitForExist({ timeout: 15000 })
    await browser.execute(() => {
      // eslint-disable-next-line no-undef
      document.querySelector('input[type="radio"]').click()
    })
    const submitBtn = await $('button.govuk-button')
    await submitBtn.waitForClickable()
    await submitBtn.click()
  }

  async loginAsOperator() {
    await $('input[type="radio"]').waitForExist({ timeout: 15000 })
    await browser.execute(() => {
      // eslint-disable-next-line no-undef
      document.querySelector('input[type="radio"]').click()
    })
    const submitBtn = await $('button.govuk-button')
    await submitBtn.waitForClickable()
    await submitBtn.click()
    await browser.waitUntil(
      async () => !(await browser.getUrl()).includes('/stub/login'),
      { timeout: 15000, timeoutMsg: 'Stub login did not redirect after login' }
    )
  }

  async switchToOperator() {
    await super.open('/auth/stub/login?type=operator')
    await $('input[type="radio"]').waitForExist({ timeout: 15000 })
  }

  async switchToRegulator() {
    await this.switchToRegulatorLink.click()
  }

  get signOutLink() {
    return $('a[href="/auth/logout"]')
  }

  async signOut() {
    await browser.url('/auth/logout')
  }
}

export default new LoginPage()
