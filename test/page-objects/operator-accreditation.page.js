import { $, $$ } from '@wdio/globals'
import { Page } from 'page-objects/page'

class OperatorAccreditationPage extends Page {
  get pageHeading() {
    return $('h1')
  }

  // RA-357: "Start new accreditation application" creates an application, so
  // it is a crumb-carrying POST form rather than an anchor. The submit button
  // keeps the start-new-link testid, so callers that only care about the
  // control being offered are unaffected.
  get startNewLink() {
    return $('[data-testid="start-new-link"]')
  }

  get startNewForm() {
    return $('[data-testid="start-new-form"]')
  }

  async startNewFormAction() {
    await this.startNewForm.waitForExist()
    return this.startNewForm.getAttribute('action')
  }

  async clickStartNew() {
    await this.clickReliably(this.startNewLink)
  }

  get withdrawLink() {
    return $('[data-testid="withdraw-link"]')
  }

  get applyAnotherLink() {
    return $('[data-testid="apply-another-link"]')
  }

  get errorMessage() {
    return $('[data-testid="error-message"]')
  }

  // A seed failure replaces the whole landing page with an error summary
  // ("We were unable to start your application. Please try again."), so its
  // absence has to be asserted rather than inferred from the rest of the page.
  // Returns the message when it is on screen and null when it is not, so a
  // regression fails with the offending copy in the assertion output.
  async seedErrorMessage() {
    return (await this.errorMessage.isExisting())
      ? this.errorMessage.getText()
      : null
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

  // The accreditation year the rendered application belongs to — the direct
  // on-page check that a restart stays in the same year rather than jumping to
  // the next one.
  get applicationPeriod() {
    return $('[data-testid="application-period"]')
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
