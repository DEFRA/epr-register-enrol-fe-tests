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

  // RA-486: new row for the recycling-operation-details step added to this
  // wizard, mirroring the ORS CYA's equivalent row.
  get recyclingOperationRow() {
    return $('[data-testid="row-recycling-operation"]')
  }

  get recyclingOperationValue() {
    return $('[data-testid="value-recycling-operation"]')
  }

  get changeRecyclingOperationLink() {
    return $('[data-testid="change-recycling-operation"]')
  }

  get errorSummary() {
    return $('[data-testid="error-summary"]')
  }

  // RA-486: this page now gets a real back link (previously missing),
  // pointing at the new recycling-operation-details step.
  get backLink() {
    return $('[data-testid="back-link"]')
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
