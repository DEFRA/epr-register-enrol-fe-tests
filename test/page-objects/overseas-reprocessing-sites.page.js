import { Page } from 'page-objects/page'

class OverseasReprocessingSitesPage extends Page {
  get pageHeading() {
    return $('h1')
  }

  get siteCheckboxes() {
    return $$('.govuk-checkboxes__input')
  }

  get siteCheckboxLabels() {
    return $$('.govuk-checkboxes__label')
  }

  get continueButton() {
    return $('button=Continue')
  }

  async selectAllSites() {
    const checkboxes = await this.siteCheckboxes
    for (const checkbox of checkboxes) {
      const checked = await checkbox.isSelected()
      if (!checked) {
        const id = await checkbox.getAttribute('id')
        await $(`label[for="${id}"]`).click()
      }
    }
  }

  get addNewOrsButton() {
    return $('[data-testid="add-new-ors-button"]')
  }

  get successBanner() {
    return $('[data-testid="ors-success-banner"]')
  }

  get confirmAndContinueButton() {
    return $('button=Confirm and continue')
  }

  async continue() {
    await this.continueButton.waitForDisplayed()
    await this.continueButton.scrollIntoView()
    await this.continueButton.click()
  }

  async confirmAndContinue() {
    await this.confirmAndContinueButton.waitForDisplayed()
    await this.confirmAndContinueButton.scrollIntoView()
    await this.confirmAndContinueButton.click()
  }
}

export default new OverseasReprocessingSitesPage()
