import { Page } from 'page-objects/page'

class AddInterimSiteSiteContactPage extends Page {
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

  async setFieldValue(input, value) {
    await input.setValue(value)
    // Headless Chrome occasionally drops a setValue on this page under CI
    // load (autocomplete-triggered refocus mid-type) — verify it stuck and
    // retry once rather than silently submitting a blank field.
    if ((await input.getValue()) !== value) {
      await input.setValue(value)
    }
  }

  async enterContactDetails({ name, email, phone }) {
    await this.contactNameInput.waitForDisplayed()
    if (name) await this.setFieldValue(this.contactNameInput, name)
    if (email) await this.setFieldValue(this.contactEmailInput, email)
    if (phone) await this.setFieldValue(this.contactPhoneInput, phone)
  }

  async continue() {
    await this.continueButton.waitForDisplayed()
    await this.continueButton.scrollIntoView()
    await this.continueButton.click()
  }
}

export default new AddInterimSiteSiteContactPage()
