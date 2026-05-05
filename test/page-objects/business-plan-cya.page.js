import { $ } from '@wdio/globals'
import { Page } from 'page-objects/page'

class BusinessPlanCyaPage extends Page {
  open(applicationId) {
    return super.open(`/accreditation/business-plan-cya/${applicationId}`)
  }

  get pageHeading() {
    return $('[data-testid="page-heading"]')
  }

  get subHeading() {
    return $('[data-testid="sub-heading"]')
  }

  get backLink() {
    return $('[data-testid="back-link"]')
  }

  get errorSummary() {
    return $('[data-testid="error-summary"]')
  }

  get percentSummaryList() {
    return $('[data-testid="percent-summary-list"]')
  }

  get confirmButton() {
    return $('[data-testid="confirm-button"]')
  }

  get saveAndComeBackButton() {
    return $('[data-testid="save-come-back-button"]')
  }

  percentValue(fieldId) {
    return $(`[data-testid="percent-value-${fieldId}"]`)
  }

  changePercentLink(fieldId) {
    return $(`[data-testid="change-percent-${fieldId}"]`)
  }

  detailValue(fieldId) {
    return $(`[data-testid="detail-value-${fieldId}"]`)
  }

  changeDetailLink(fieldId) {
    return $(`[data-testid="change-detail-${fieldId}"]`)
  }
}

export default new BusinessPlanCyaPage()
