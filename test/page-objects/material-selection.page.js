import { $, $$ } from '@wdio/globals'
import { Page } from 'page-objects/page'

class MaterialSelectionPage extends Page {
  open() {
    return super.open('/accreditation/material-selection')
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
  }
}

export default new MaterialSelectionPage()
