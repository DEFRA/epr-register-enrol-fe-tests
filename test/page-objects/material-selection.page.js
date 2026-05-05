<<<<<<< feature/RA-105-prns-tonnage
import { $ } from '@wdio/globals'
=======
import { $, $$ } from '@wdio/globals'
>>>>>>> main
import { Page } from 'page-objects/page'

class MaterialSelectionPage extends Page {
  open() {
    return super.open('/accreditation/material-selection')
  }

  get pageHeading() {
    return $('[data-testid="page-heading"]')
  }

<<<<<<< feature/RA-105-prns-tonnage
  get continueButton() {
    return $('[data-testid="continue-button"]')
=======
  get backLink() {
    return $('[data-testid="back-link"]')
>>>>>>> main
  }

  get errorSummary() {
    return $('[data-testid="error-summary"]')
  }

<<<<<<< feature/RA-105-prns-tonnage
  radioOption(value) {
    return $(`[data-testid="material-option-${value.toLowerCase()}"]`)
  }

  async selectMaterial(value) {
    await this.radioOption(value).click()
    await this.continueButton.click()
=======
  get fieldError() {
    return $('[data-testid="field-error"]')
  }

  get materialRadios() {
    return $$('[data-testid^="material-option-"]')
  }

  get steelRadio() {
    return $('[data-testid="material-option-steel"]')
  }

  get woodRadio() {
    return $('[data-testid="material-option-wood"]')
  }

  get aluminiumRadio() {
    return $('[data-testid="material-option-aluminium"]')
  }

  get fibreRadio() {
    return $('[data-testid="material-option-fibre"]')
  }

  get glassRadio() {
    return $('[data-testid="material-option-glass"]')
  }

  get paperRadio() {
    return $('[data-testid="material-option-paper"]')
  }

  get plasticRadio() {
    return $('[data-testid="material-option-plastic"]')
  }

  get continueButton() {
    return $('[data-testid="continue-button"]')
  }

  selectMaterial(value) {
    return $(`[data-testid="material-option-${value.toLowerCase()}"]`).click()
>>>>>>> main
  }
}

export default new MaterialSelectionPage()
