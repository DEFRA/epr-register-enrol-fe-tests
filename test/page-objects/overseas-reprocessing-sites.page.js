import { Page } from 'page-objects/page'

class OverseasReprocessingSitesPage extends Page {
  get pageHeading() {
    return $('[data-testid="page-heading"]')
  }

  get addNewOrsButton() {
    return $('[data-testid="add-new-ors-button"]')
  }

  get successBanner() {
    return $('[data-testid="ors-success-banner"]')
  }

  get interimSiteSuccessBanner() {
    return $('[data-testid="interim-site-success-banner"]')
  }

  get promoteSuccessBanner() {
    return $('[data-testid="ors-promote-success-banner"]')
  }

  get continueButton() {
    return $('[data-testid="continue-button"]')
  }

  get saveAndComeLaterButton() {
    return $('[data-testid="save-come-back-button"]')
  }

  async continue() {
    await this.continueButton.waitForDisplayed()
    await this.continueButton.scrollIntoView()
    await this.continueButton.click()
  }

  async saveAndComeLater() {
    await this.saveAndComeLaterButton.waitForDisplayed()
    await this.saveAndComeLaterButton.scrollIntoView()
    await this.saveAndComeLaterButton.click()
  }

  accreditedSiteRow(siteId) {
    return $(`[data-testid="accredited-site-row-${siteId}"]`)
  }

  registeredSiteRow(siteId) {
    return $(`[data-testid="registered-site-row-${siteId}"]`)
  }

  newSiteRow(siteId) {
    return $(`[data-testid="new-site-row-${siteId}"]`)
  }

  registeredSiteAddedRow(siteId) {
    return $(`[data-testid="registered-sites-added-row-${siteId}"]`)
  }

  removeAccreditedButton(siteId) {
    return $(`[data-testid="remove-button-accredited-${siteId}"]`)
  }

  async removeFromAccreditation(siteId) {
    const button = this.removeAccreditedButton(siteId)
    await button.waitForDisplayed()
    await button.scrollIntoView()
    await button.click()
  }

  addToAccreditationButton(siteId) {
    return $(`[data-testid="add-button-registered-${siteId}"]`)
  }

  async addToAccreditation(siteId) {
    const button = this.addToAccreditationButton(siteId)
    await button.waitForDisplayed()
    await button.scrollIntoView()
    await button.click()
  }

  removeNewSiteButton(siteId) {
    return $(`[data-testid="remove-button-new-${siteId}"]`)
  }

  async removeNewSite(siteId) {
    const button = this.removeNewSiteButton(siteId)
    await button.waitForDisplayed()
    await button.scrollIntoView()
    await button.click()
  }

  removeRegisteredSiteAddedButton(siteId) {
    return $(`[data-testid="remove-button-registered-added-${siteId}"]`)
  }

  async removeRegisteredSiteAdded(siteId) {
    const button = this.removeRegisteredSiteAddedButton(siteId)
    await button.waitForDisplayed()
    await button.scrollIntoView()
    await button.click()
  }
}

export default new OverseasReprocessingSitesPage()
