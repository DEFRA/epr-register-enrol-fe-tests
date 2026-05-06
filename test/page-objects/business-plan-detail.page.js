import { $ } from '@wdio/globals'
import { Page } from 'page-objects/page'

class BusinessPlanDetailPage extends Page {
  open(applicationId) {
    return super.open(`/accreditation/business-plan-detail/${applicationId}`)
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

  textareaInput(fieldId) {
    return $(`[data-testid="textarea-${fieldId}"]`)
  }

  fieldError(fieldId) {
    return $(`[data-testid="field-error-${fieldId}"]`)
  }
}

export default new BusinessPlanDetailPage()
