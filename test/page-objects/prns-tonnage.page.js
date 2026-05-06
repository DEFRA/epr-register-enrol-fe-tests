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

  selectTonnage(value) {
    return $(`[data-testid="tonnage-option-${value.toLowerCase()}"]`).click()
  }

  async saveAndContinue(tonnageValue) {
    await this.selectTonnage(tonnageValue)
    await this.continueButton.click()
  }
}

export default new PrnsTonnagePage()
