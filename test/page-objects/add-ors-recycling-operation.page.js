import { Page } from 'page-objects/page'

class AddOrsRecyclingOperationPage extends Page {
  get pageHeading() {
    return $('[data-testid="page-heading"]')
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
    const operationLabel = $(
      `label[for="recycling-operation-code-${code.toLowerCase()}"]`
    )
    await operationLabel.waitForDisplayed()
    await operationLabel.click()
  }

  async selectOperationCodes(codes) {
    for (const code of codes) {
      await this.selectOperationCode(code)
    }
  }

  async continue() {
    await this.continueButton.waitForDisplayed()
    await this.continueButton.click()
  }
}

export default new AddOrsRecyclingOperationPage()
