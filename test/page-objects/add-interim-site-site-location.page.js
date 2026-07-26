import { Page } from 'page-objects/page'

class AddInterimSiteSiteLocationPage extends Page {
  get pageHeading() {
    return $('[data-testid="page-heading"]')
  }

  get addressLine1Input() {
    return $('[data-testid="address-line1-input"]')
  }

  get addressLine2Input() {
    return $('[data-testid="address-line2-input"]')
  }

  get townOrCityInput() {
    return $('[data-testid="town-or-city-input"]')
  }

  get stateOrRegionInput() {
    return $('[data-testid="state-or-region-input"]')
  }

  get postcodeInput() {
    return $('[data-testid="postcode-input"]')
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

  async enterLocation({
    addressLine1,
    addressLine2,
    townOrCity,
    stateOrRegion,
    postcode
  }) {
    await this.addressLine1Input.waitForDisplayed()
    await this.addressLine1Input.setValue(addressLine1)
    if (addressLine2) await this.addressLine2Input.setValue(addressLine2)
    await this.townOrCityInput.setValue(townOrCity)
    if (stateOrRegion) await this.stateOrRegionInput.setValue(stateOrRegion)
    if (postcode) await this.postcodeInput.setValue(postcode)
  }

  async continue() {
    await this.continueButton.waitForDisplayed()
    await this.continueButton.scrollIntoView()
    await this.continueButton.click()
  }
}

export default new AddInterimSiteSiteLocationPage()
