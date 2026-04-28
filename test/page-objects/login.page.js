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
    await this.userRadioButton.click()
    await this.loginButton.click()
  }

  async switchToOperator() {
    await this.switchToOperatorLink.click()
  }

  async switchToRegulator() {
    await this.switchToRegulatorLink.click()
  }

  get signOutLink() {
    return $('a[href="/auth/logout"]')
  }

  async signOut() {
    await this.signOutLink.click()
  }
}

export default new LoginPage()
