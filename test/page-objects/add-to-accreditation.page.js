import { Page } from 'page-objects/page'

// RA-492 (f04/f09): "Add to accreditation: {siteName} ({orsId})" summary for
// one registered ORS, at .../manage-overseas-sites/{applicationId}/add/{siteId}.
//
// Every row is addressed by its rowId: site-name, location, coordinates,
// contact-name, contact-email, contact-phone, recycling-operation,
// basel-codes, repatriated-loads, conditions-of-export, bes-evidence.
// A row's action reads "Add information" when the field was never filled,
// "Change" when it is filled and editable, and is absent when it is locked
// (coordinates, recycling-operation, conditions-of-export once set).
class AddToAccreditationPage extends Page {
  get pageHeading() {
    return $('[data-testid="page-heading"]')
  }

  get siteSummary() {
    return $('[data-testid="site-summary"]')
  }

  get continueButton() {
    return $('[data-testid="continue-button"]')
  }

  // A link-styled button in a POST form: removes this site from the
  // in-progress request and returns to Manage overseas reprocessing sites.
  get cancelLink() {
    return $('[data-testid="cancel-link"]')
  }

  get errorSummary() {
    return $('[data-testid="error-summary"]')
  }

  row(rowId) {
    return $(`[data-testid="row-${rowId}"]`)
  }

  rowValue(rowId) {
    return $(`[data-testid="row-${rowId}-value"]`)
  }

  rowAction(rowId) {
    return $(`[data-testid="row-${rowId}-action"]`)
  }

  rowMissingTag(rowId) {
    return $(`[data-testid="row-${rowId}-missing"]`)
  }

  rowError(rowId) {
    return $(`[data-testid="row-${rowId}-error"]`)
  }

  errorSummaryItem(rowId) {
    return $(`[data-testid="error-${rowId}"]`)
  }

  async openRowAction(rowId) {
    await this.clickAndWaitForNextPage(this.rowAction(rowId))
  }

  async continue() {
    await this.clickAndWaitForNextPage(this.continueButton)
  }
}

export default new AddToAccreditationPage()
