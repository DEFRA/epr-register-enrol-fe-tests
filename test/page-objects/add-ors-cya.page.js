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

  get baselCode1Row() {
    return $('[data-testid="row-basel-code-1"]')
  }

  get baselCode2Row() {
    return $('[data-testid="row-basel-code-2"]')
  }

  get baselCode3Row() {
    return $('[data-testid="row-basel-code-3"]')
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

  async submit() {
    await this.submitButton.waitForDisplayed()
    await this.submitButton.scrollIntoView()
    await this.submitButton.click()
  }
}

export default new AddOrsCyaPage()
