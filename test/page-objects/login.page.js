import { Page } from 'page-objects/page'

class LoginPage extends Page {
  open() {
    return super.open('/')
  }

  get userRadioButton() {
    return $('#user-1')
  }

  get loginButton() {
    return $(".govuk-button[type='submit']")
  }

  async loginAsUser() {
    await this.userRadioButton.click()
    await this.loginButton.click()
  }
}

export default new LoginPage()
