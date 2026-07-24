import { Page } from 'page-objects/page'

class AddOrsSiteContactPage extends Page {
  get pageHeading() {
    return $('[data-testid="page-heading"]')
  }

  get contactNameInput() {
    return $('[data-testid="contact-name-input"]')
  }

  get contactEmailInput() {
    return $('[data-testid="contact-email-input"]')
  }

  get contactPhoneInput() {
    return $('[data-testid="contact-phone-input"]')
  }

  get errorSummary() {
    return $('[data-testid="error-summary"]')
  }

  get backLink() {
    return $('[data-testid="back-link"]')
  }

  get cancelLink() {
    return $('[data-testid="cancel-link"]')
  }

  get continueButton() {
    return $('[data-testid="continue-button"]')
  }

  async enterContactDetails({ name, email, phone }) {
    await this.contactNameInput.waitForDisplayed()
    await this.contactNameInput.setValue(name)
    await this.contactEmailInput.setValue(email)
    if (phone) await this.contactPhoneInput.setValue(phone)
  }

  async continue() {
    await this.continueButton.waitForDisplayed()
    await this.continueButton.click()
  }
}

export default new AddOrsSiteContactPage()
