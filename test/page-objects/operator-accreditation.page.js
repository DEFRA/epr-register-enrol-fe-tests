import { $, $$ } from '@wdio/globals'
import { Page } from 'page-objects/page'

class OperatorAccreditationPage extends Page {
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

  get OrgNameTags() {
    return $('[data-testid="organisation-name"]')
  }

  get SiteNameTags() {
    return $('[data-testid="site-name"]')
  }

  get MaterialTags() {
    return $('[data-testid="material-display"]')
  }

  get accreditationYear() {
    return $('[data-testid="accreditation-year"]')
  }

  get applicationStatus() {
    return $('[data-testid="application-status"]')
  }

  get continueLinks() {
    return $$('[data-testid="continue-button"]')
  }

  get firstContinueLink() {
    return $('[data-testid="continue-button"]')
  }

  async clickContinue() {
    await this.firstContinueLink.waitForDisplayed()
    await this.firstContinueLink.scrollIntoView()
    await this.firstContinueLink.click()
  }

  get viewLinks() {
    return $$('[data-testid="view-link"]')
  }
}

export default new OperatorAccreditationPage()
