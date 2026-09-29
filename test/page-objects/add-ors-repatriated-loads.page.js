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

  // RA-361: the inline error govukCharacterCount renders next to the
  // textarea itself (controller.js#buildTextareaInput sets
  // data-testid="repatriated-loads-error" on it), distinct from
  // errorSummary above. The live-clearing fix in application.js only ever
  // removes this element once the field's own word count is back within
  // the 500-word limit — it never touches the error summary.
  get fieldError() {
    return $('[data-testid="repatriated-loads-error"]')
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
    await this.clickReliably(this.continueButton)
  }
}

export default new AddOrsRepatriatedLoadsPage()
