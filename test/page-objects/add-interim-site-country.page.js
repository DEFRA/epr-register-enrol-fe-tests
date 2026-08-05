import { browser } from '@wdio/globals'
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
    // The country field is progressively enhanced from a <select> into a GDS
    // accessible-autocomplete <input> by a deferred JS module. On this page
    // country is the only field, so there's nothing else to wait on first —
    // interacting before enhancement lands hits the raw <select>, which
    // doesn't accept typed text the way the enhanced widget does.
    await browser.waitUntil(
      async () => (await this.countryInput.getTagName()) === 'input',
      {
        timeout: 10000,
        timeoutMsg: 'Country field did not enhance into an autocomplete input'
      }
    )
    await this.countryInput.setValue(country)
  }

  async continue() {
    await this.clickReliably(this.continueButton)
  }
}

export default new AddInterimSiteCountryPage()
