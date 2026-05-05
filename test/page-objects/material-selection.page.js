import { $ } from '@wdio/globals'
import { Page } from 'page-objects/page'

class MaterialSelectionPage extends Page {
  open() {
    return super.open('/accreditation/material-selection')
  }

  get pageHeading() {
    return $('[data-testid="page-heading"]')
  }

  get continueButton() {
    return $('[data-testid="continue-button"]')
  }

  get errorSummary() {
    return $('[data-testid="error-summary"]')
  }

  radioOption(value) {
    return $(`[data-testid="material-option-${value.toLowerCase()}"]`)
  }

  async selectMaterial(value) {
    await this.radioOption(value).click()
    await this.continueButton.click()
  }
}

export default new MaterialSelectionPage()
