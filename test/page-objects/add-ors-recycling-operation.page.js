import { Page } from 'page-objects/page'

class AddOrsRecyclingOperationPage extends Page {
  get pageHeading() {
    return $('[data-testid="page-heading"]')
  }

  get operationCodeSelect() {
    return $('[data-testid="recycling-operation-select"]')
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

  async selectOperationCode(code) {
    await this.operationCodeSelect.waitForDisplayed()
    await this.operationCodeSelect.selectByAttribute('value', code)
  }

  async continue() {
    await this.continueButton.waitForDisplayed()
    await this.continueButton.click()
  }
}

export default new AddOrsRecyclingOperationPage()
