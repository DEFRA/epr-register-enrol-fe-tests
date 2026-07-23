import { Page } from 'page-objects/page'

class AddOrsSiteLocationPage extends Page {
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

  get countryInput() {
    return $('[data-testid="country-input"]')
  }

  get coordinatesInput() {
    return $('[data-testid="coordinates-input"]')
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
    country,
    coordinates
  }) {
    await this.addressLine1Input.waitForDisplayed()
    await this.addressLine1Input.setValue(addressLine1)
    if (addressLine2) await this.addressLine2Input.setValue(addressLine2)
    await this.townOrCityInput.setValue(townOrCity)
    await this.countryInput.setValue(country)
    if (coordinates) await this.coordinatesInput.setValue(coordinates)
  }

  async continue() {
    await this.continueButton.waitForDisplayed()
    await this.continueButton.click()
  }
}

export default new AddOrsSiteLocationPage()
