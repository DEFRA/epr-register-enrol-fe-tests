import { Page } from 'page-objects/page'

class AddOrsRepatriatedLoadsPage extends Page {
  get pageHeading() {
    return $('[data-testid="page-heading"]')
  }

  get textarea() {
    return $('[data-testid="repatriated-loads-textarea"]')
  }

  get errorSummary() {
    return $('[data-testid="error-summary"]')
  }

  get backLink() {
    return $('[data-testid="back-link"]')
  }

  get cancelLink() {
    return $('[data-testid="cancel-link"]')
  }

  get continueButton() {
    return $('[data-testid="continue-button"]')
  }

  async enterDescription(text) {
    await this.textarea.waitForDisplayed()
    await this.textarea.setValue(text)
  }

  async continue() {
    await this.continueButton.waitForDisplayed()
    await this.continueButton.click()
  }
}

export default new AddOrsRepatriatedLoadsPage()
