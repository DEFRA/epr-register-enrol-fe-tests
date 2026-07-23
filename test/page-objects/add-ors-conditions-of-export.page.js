import { Page } from 'page-objects/page'

class AddOrsConditionsOfExportPage extends Page {
  get pageHeading() {
    return $('[data-testid="page-heading"]')
  }

  get radioYes() {
    return $('[data-testid="radio-yes"]')
  }

  get radioNo() {
    return $('[data-testid="radio-no"]')
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

  async selectYes() {
    const label = await $('label[for="conditionsOfExport-yes"]')
    await label.waitForDisplayed()
    await label.click()
  }

  async selectNo() {
    const label = await $('label[for="conditionsOfExport-no"]')
    await label.waitForDisplayed()
    await label.click()
  }

  async continue() {
    await this.continueButton.waitForDisplayed()
    await this.continueButton.click()
  }
}

export default new AddOrsConditionsOfExportPage()
