import { $ } from '@wdio/globals'
import { Page } from 'page-objects/page'

class PrnsTonnagePage extends Page {
  open(applicationId) {
    return super.open(`/accreditation/prns-tonnage/${applicationId}`)
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

  get continueButton() {
    return $('[data-testid="continue-button"]')
  }

  get saveAndComeBackButton() {
    return $('[data-testid="save-come-back-button"]')
  }

  radioOption(value) {
    return $(`[data-testid="tonnage-option-${value.toLowerCase()}"]`)
  }

  async selectTonnage(value) {
    await this.radioOption(value).click()
  }

  async saveAndContinue(value) {
    await this.selectTonnage(value)
    await this.continueButton.click()
  }

  async saveAndComeLater(value) {
    await this.selectTonnage(value)
    await this.saveAndComeBackButton.click()
  }
}

export default new PrnsTonnagePage()
