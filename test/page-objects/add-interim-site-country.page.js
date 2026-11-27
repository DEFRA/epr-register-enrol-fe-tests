import {
  enterAutocompleteValue,
  waitForAutocomplete
} from 'page-objects/accessible-autocomplete'
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
    // Country is the only field here, so there's nothing else to wait on
    // first, and nothing after it to blur it.
    await waitForAutocomplete(this.countryInput, { label: 'Country field' })
    await enterAutocompleteValue(this.countryInput, country)
  }

  async continue() {
    await this.clickReliably(this.continueButton)
  }
}

export default new AddInterimSiteCountryPage()
