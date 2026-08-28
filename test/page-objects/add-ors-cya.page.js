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

  // RA-486: this page now always gets a real back link (pointing at
  // site-contact-details, the last wizard step before CYA) — previously
  // absent.
  get backLink() {
    return $('[data-testid="back-link"]')
  }

  get submitButton() {
    return $('[data-testid="submit-button"]')
  }

  // RA-486: "Save and add interim site" is now always rendered here,
  // independent of whether R12/R13 was selected on this ORS's recycling
  // operations — adding an interim site is a standalone action, not gated on
  // those codes any more.
  get saveAndAddInterimSiteButton() {
    return $('[data-testid="save-and-add-interim-site-button"]')
  }

  async submit() {
    await this.clickReliably(this.submitButton)
  }

  async saveAndAddInterimSite() {
    await this.clickReliably(this.saveAndAddInterimSiteButton)
  }
}

export default new AddOrsCyaPage()
