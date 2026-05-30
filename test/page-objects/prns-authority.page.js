import { $ } from '@wdio/globals'
import { Page } from 'page-objects/page'

class PrnsAuthorityPage extends Page {
  open(applicationId) {
    return super.open(`/accreditation/prns-authority/${applicationId}`)
  }

  get pageHeading() {
    return $('[data-testid="page-heading"]')
  }

  get backLink() {
    return $('[data-testid="back-link"]')
  }

  get errorSummary() {
    return $('[data-testid="error-summary"]')
  }

  get fieldError() {
    return $('[data-testid="field-error"]')
  }

  get authorisersTable() {
    return $('[data-testid="authorisers-table"]')
  }

  get noAuthorisersMessage() {
    return $('[data-testid="no-authorisers-message"]')
  }

  get addAuthoriserToggle() {
    return $('[data-testid="add-authoriser-toggle"]')
  }

  get addAuthoriserButton() {
    return $('[data-testid="add-authoriser-button"]')
  }

  get newFullNameInput() {
    return $('[data-testid="new-full-name-input"]')
  }

  get newEmailInput() {
    return $('[data-testid="new-email-input"]')
  }

  get newFullNameError() {
    return $('[data-testid="new-full-name-error"]')
  }

  get newEmailError() {
    return $('[data-testid="new-email-error"]')
  }

  get continueButton() {
    return $('[data-testid="continue-button"]')
  }

  get saveAndComeBackButton() {
    return $('[data-testid="save-come-back-button"]')
  }

  authoriserCheckbox(index) {
    return $(`[data-testid="authoriser-checkbox-${index}"]`)
  }

  async addAuthoriser(fullName, email) {
    await this.addAuthoriserToggle.click()
    await this.newFullNameInput.setValue(fullName)
    await this.newEmailInput.setValue(email)
    await this.addAuthoriserButton.click()
  }

  async saveAndContinue(emailsToSelect) {
    for (const email of emailsToSelect) {
      const checkbox = await $(`input[value="${email}"]`)
      const checked = await checkbox.getAttribute('checked')
      if (!checked) await checkbox.click()
    }
    await this.continueButton.click()
  }

  async saveAndComeLater() {
    await this.saveAndComeBackButton.click()
  }
}

export default new PrnsAuthorityPage()
