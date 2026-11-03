import { Page } from 'page-objects/page'

// RA-492 (f05): "Accreditation requests" — the in-progress add-ORS requests
// against a granted accreditation, with the in-year charge (AC03/AC04), at
// .../manage-overseas-sites/{applicationId}/requests.
class AccreditationRequestsPage extends Page {
  get pageHeading() {
    return $('[data-testid="page-heading"]')
  }

  get requestsTable() {
    return $('[data-testid="requests-table"]')
  }

  get requestRows() {
    return $$('[data-testid^="request-row-"]')
  }

  get noRequests() {
    return $('[data-testid="no-requests"]')
  }

  get chargeInset() {
    return $('[data-testid="charge-inset"]')
  }

  get chargeCount() {
    return $('[data-testid="charge-count"]')
  }

  get chargePerOrs() {
    return $('[data-testid="charge-per-ors"]')
  }

  get chargeTotal() {
    return $('[data-testid="charge-total"]')
  }

  get addAnotherRequestButton() {
    return $('[data-testid="add-another-request"]')
  }

  get continueButton() {
    return $('[data-testid="continue-button"]')
  }

  get cancelLink() {
    return $('[data-testid="cancel-link"]')
  }

  requestRow(orsId) {
    return $(`[data-testid="request-row-${orsId}"]`)
  }

  requestSiteName(orsId) {
    return $(`[data-testid="request-site-name-${orsId}"]`)
  }

  requestType(orsId) {
    return $(`[data-testid="request-type-${orsId}"]`)
  }

  requestStatus(orsId) {
    return $(`[data-testid="request-status-${orsId}"]`)
  }

  requestViewLink(orsId) {
    return $(`[data-testid="request-view-${orsId}"]`)
  }

  async addAnotherRequest() {
    await this.clickAndWaitForNextPage(this.addAnotherRequestButton)
  }

  async continue() {
    await this.clickAndWaitForNextPage(this.continueButton)
  }
}

export default new AccreditationRequestsPage()
