import { $ } from '@wdio/globals'
import { Page } from 'page-objects/page'

class BusinessPlanPage extends Page {
  open(applicationId) {
    return super.open(`/accreditation/business-plan/${applicationId}`)
  }

  get pageHeading() {
    return $('[data-testid="page-heading"]')
  }

  get introText() {
    return $('[data-testid="intro-text"]')
  }

  get backLink() {
    return $('[data-testid="back-link"]')
  }

  get errorSummary() {
    return $('[data-testid="error-summary"]')
  }

  get continueButton() {
    return $('[data-testid="continue-button"]')
  }

  get saveAndComeBackButton() {
    return $('[data-testid="save-come-back-button"]')
  }

  fieldInput(fieldId) {
    return $(`[data-testid="input-${fieldId}"]`)
  }

  fieldError(fieldId) {
    return $(`[data-testid="field-error-${fieldId}"]`)
  }

  async fillPercentages(values) {
    for (const [field, value] of Object.entries(values)) {
      await this.fieldInput(field).setValue(String(value))
    }
  }

  async fillEvenSplit() {
    const fields = [
      'newInfrastructurePercent',
      'priceSupportPercent',
      'businessCollectionsPercent',
      'communicationsPercent',
      'newMarketsPercent',
      'newUsesPercent'
    ]
    for (const field of fields) {
      await this.fieldInput(field).setValue('16')
    }
    // Adjust last field so total = 100 (16*5 + 20 = 100)
    await this.fieldInput('newUsesPercent').setValue('20')
  }
}

export default new BusinessPlanPage()
