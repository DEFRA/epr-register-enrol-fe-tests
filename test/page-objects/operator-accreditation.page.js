import { $, $$ } from '@wdio/globals'
import { Page } from 'page-objects/page'

class OperatorAccreditationPage extends Page {
  open() {
    return super.open('/operator-accreditation')
  }

  get pageHeading() {
    return $('h1')
  }

  get reExBackLink() {
    return $('[data-testid="reex-back-link"]')
  }

  get startNewLink() {
    return $('[data-testid="start-new-link"]')
  }

  get applyAnotherLink() {
    return $('[data-testid="apply-another-link"]')
  }

  get errorMessage() {
    return $('[data-testid="error-message"]')
  }

  get applicationCards() {
    return $$('[data-testid="application-card"]')
  }

  get statusTags() {
    return $$('[data-testid="status-tag"]')
  }

  get continueLinks() {
    return $$('[data-testid="continue-link"]')
  }

  get viewLinks() {
    return $$('[data-testid="view-link"]')
  }
}

export default new OperatorAccreditationPage()
