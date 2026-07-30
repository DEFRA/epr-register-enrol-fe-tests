import { Page } from 'page-objects/page'

class AddOrsCyaPage extends Page {
  get pageHeading() {
    return $('[data-testid="page-heading"]')
  }

  get summaryList() {
    return $('[data-testid="summary-list"]')
  }

  get siteNameRow() {
    return $('[data-testid="row-site-name"]')
  }

  get locationRow() {
    return $('[data-testid="row-location"]')
  }

  get contactNameRow() {
    return $('[data-testid="row-contact-name"]')
  }

  get contactEmailRow() {
    return $('[data-testid="row-contact-email"]')
  }

  get contactPhoneRow() {
    return $('[data-testid="row-contact-phone"]')
  }

  get recyclingOperationRow() {
    return $('[data-testid="row-recycling-operation"]')
  }

  get baselCodesRow() {
    return $('[data-testid="row-basel-codes"]')
  }

  deleteCodeButton(index) {
    return $(`[data-testid="delete-code-${index}"]`)
  }

  async deleteCode(index) {
    const button = this.deleteCodeButton(index)
    await button.waitForDisplayed()
    await button.scrollIntoView()
    await button.click()
  }

  get repatriatedLoadsRow() {
    return $('[data-testid="row-repatriated-loads"]')
  }

  get conditionsOfExportRow() {
    return $('[data-testid="row-conditions-of-export"]')
  }

  get changeSiteNameLink() {
    return $('[data-testid="change-site-name"]')
  }

  get cancelLink() {
    return $('[data-testid="cancel-link"]')
  }

  get submitButton() {
    return $('[data-testid="submit-button"]')
  }

  get saveAndAddInterimSiteButton() {
    return $('[data-testid="save-and-add-interim-site-button"]')
  }

  async submit() {
    await this.submitButton.waitForDisplayed()
    await this.submitButton.scrollIntoView()
    await this.submitButton.click()
  }

  async saveAndAddInterimSite() {
    await this.saveAndAddInterimSiteButton.waitForDisplayed()
    await this.saveAndAddInterimSiteButton.scrollIntoView()
    await this.saveAndAddInterimSiteButton.click()
  }
}

export default new AddOrsCyaPage()
