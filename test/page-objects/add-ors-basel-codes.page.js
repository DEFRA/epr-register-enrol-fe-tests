import { Page } from 'page-objects/page'

class AddOrsBaselCodesPage extends Page {
  get pageHeading() {
    return $('[data-testid="page-heading"]')
  }

  get code1Input() {
    return $('[data-testid="basel-code-1-input"]')
  }

  get code2Input() {
    return $('[data-testid="basel-code-2-input"]')
  }

  get code3Input() {
    return $('[data-testid="basel-code-3-input"]')
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

  async enterCodes({ code1, code2, code3 }) {
    await this.code1Input.waitForDisplayed()
    await this.code1Input.setValue(code1)
    if (code2) await this.code2Input.setValue(code2)
    if (code3) await this.code3Input.setValue(code3)
  }

  async continue() {
    await this.continueButton.waitForDisplayed()
    await this.continueButton.scrollIntoView()
    await this.continueButton.click()
  }
}

export default new AddOrsBaselCodesPage()
