import { Page } from 'page-objects/page'

class AddInterimSiteCyaPage extends Page {
  get pageHeading() {
    return $('[data-testid="page-heading"]')
  }

  get summaryList() {
    return $('[data-testid="summary-list"]')
  }

  get countryRow() {
    return $('[data-testid="row-country"]')
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

  get errorSummary() {
    return $('[data-testid="error-summary"]')
  }

  get cancelLink() {
    return $('[data-testid="cancel-link"]')
  }

  get submitButton() {
    return $('[data-testid="submit-button"]')
  }

  async submit() {
    await this.clickReliably(this.submitButton)
  }
}

export default new AddInterimSiteCyaPage()
