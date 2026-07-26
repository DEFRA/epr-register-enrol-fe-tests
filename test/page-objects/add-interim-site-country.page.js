import { Page } from 'page-objects/page'

class AddInterimSiteCountryPage extends Page {
  get pageHeading() {
    return $('[data-testid="page-heading"]')
  }

  get countryInput() {
    return $('[data-testid="country-input"]')
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

  async enterCountry(country) {
    await this.countryInput.waitForDisplayed()
    await this.countryInput.setValue(country)
  }

  async continue() {
    await this.continueButton.waitForDisplayed()
    await this.continueButton.scrollIntoView()
    await this.continueButton.click()
  }
}

export default new AddInterimSiteCountryPage()
