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

  get recyclingOperationRow() {
    return $('[data-testid="row-recycling-operation"]')
  }

  get baselCode1Row() {
    return $('[data-testid="row-basel-code-1"]')
  }

  get repatriatedLoadsRow() {
    return $('[data-testid="row-repatriated-loads"]')
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
    await this.submitButton.click()
  }
}

export default new AddOrsCyaPage()
