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
    const operationInput = $(`#recycling-operation-code-${code.toLowerCase()}`)
    const operationLabel = $(
      `label[for="recycling-operation-code-${code.toLowerCase()}"]`
    )
    await operationLabel.waitForDisplayed()
    if (await operationInput.isSelected()) {
      return
    }
    await operationLabel.click()
  }

  async selectOperationCodes(codes) {
    for (const code of codes) {
      await this.selectOperationCode(code)
    }
  }

  // The page offers one primary code, R3, R4 or R5, depending on the
  // material (R12 and R13 on their own are rejected), so it is read off the
  // page rather than passed in. Returns the code selected.
  async selectPrimaryOperationCode() {
    for (const code of ['R3', 'R4', 'R5']) {
      if (
        await $(`#recycling-operation-code-${code.toLowerCase()}`).isExisting()
      ) {
        await this.selectOperationCode(code)
        return code
      }
    }
    throw new Error(
      'No primary recycling operation code (R3, R4 or R5) offered'
    )
  }

  async continue() {
    await this.clickReliably(this.continueButton)
  }
}

export default new AddOrsRecyclingOperationPage()
