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
    await this.userRadioButton.waitForExist()
    await $('label[for="user-1"]').click()
    await this.loginButton.click()
  }

  async loginAsOperator() {
    const firstRadio = await $('input[type="radio"]')
    await firstRadio.waitForExist({ timeout: 15000 })
    const id = await firstRadio.getAttribute('id')
    await $(`label[for="${id}"]`).waitForDisplayed()
    await $(`label[for="${id}"]`).click()
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
