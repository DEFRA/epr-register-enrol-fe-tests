import { $ } from '@wdio/globals'
import { Page } from 'page-objects/page'

class OperatorAccreditationPage extends Page {
  open(
    orgId = 'stub-org-1',
    siteId = 'Stub Site Alpha',
    material = 'Plastic',
    year = new Date().getFullYear()
  ) {
    return super.open(
      `/operator-accreditation/${orgId}/${siteId}/${material}/${year}`
    )
  }

  get pageHeading() {
    return $('h1')
  }

  get reExBackLink() {
    return $('[data-testid="reex-back-link"]')
  }

  get continueButton() {
    return $('[data-testid="continue-button"]')
  }

  get applicationSummary() {
    return $('[data-testid="application-summary"]')
  }

  get siteName() {
    return $('[data-testid="site-name"]')
  }

  get materialDisplay() {
    return $('[data-testid="material-display"]')
  }

  get statusTag() {
    return $('[data-testid="status-tag"]')
  }

  get errorMessage() {
    return $('[data-testid="error-message"]')
  }
}

export default new OperatorAccreditationPage()
