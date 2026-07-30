import { Page } from 'page-objects/page'

class AddOrsBaselCodesPage extends Page {
  get siteSummary() {
    return $('[data-testid="site-summary"]')
  }

  get pageHeading() {
    return $('[data-testid="page-heading"]')
  }

  get guidanceLink() {
    return $('[data-testid="guidance-link"]')
  }

  codeInput(index) {
    return $(`[data-testid="basel-code-${index}-input"]`)
  }

  removeCodeButton(index) {
    return $(`[data-testid="remove-code-${index}-button"]`)
  }

  get addCodeButton() {
    return $('[data-testid="add-code-button"]')
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

  async enterCodes(codes = []) {
    const values = codes.length > 0 ? codes : ['']

    for (let i = 1; i < values.length; i++) {
      await this.addCodeButton.waitForDisplayed()
      await this.addCodeButton.click()
    }

    for (let i = 0; i < values.length; i++) {
      const input = this.codeInput(i + 1)
      await input.waitForDisplayed()
      await input.setValue(values[i])
    }
  }

  async continue() {
    await this.continueButton.waitForDisplayed()
    await this.continueButton.scrollIntoView()
    await this.continueButton.click()
  }
}

export default new AddOrsBaselCodesPage()
