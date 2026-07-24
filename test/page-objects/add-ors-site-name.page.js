import { Page } from 'page-objects/page'

class AddOrsSiteNamePage extends Page {
  get pageHeading() {
    return $('[data-testid="page-heading"]')
  }

  get siteNameInput() {
    return $('[data-testid="site-name-input"]')
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

  async enterSiteName(name) {
    await this.siteNameInput.waitForDisplayed()
    await this.siteNameInput.setValue(name)
  }

  async continue() {
    await this.continueButton.waitForDisplayed()
    await this.continueButton.click()
  }
}

export default new AddOrsSiteNamePage()
